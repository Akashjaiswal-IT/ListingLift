import { Queue, Worker } from "bullmq";
import { logger } from "@repo/logger";
import { connectToDatabase, disconnectDatabase, assertTransactionsSupported, ensureDbGuards } from "@repo/database";
import {
  getRedisConnection,
  IMAGE_GENERATION_QUEUE_NAME,
  RE_EDIT_QUEUE_NAME,
  ASSETS_QUEUE_NAME,
  reconcileStuckWork,
} from "@repo/services";

const MAINTENANCE_QUEUE_NAME = "maintenance";
const RECONCILE_EVERY_MS = 5 * 60 * 1000;
// Jobs at once per queue; raise only if your Gemini limits (AI Studio) allow it.
const GENERATION_CONCURRENCY = Number(process.env.WORKER_GENERATION_CONCURRENCY) || 3;
const RE_EDIT_CONCURRENCY = Number(process.env.WORKER_RE_EDIT_CONCURRENCY) || 3;
// Card re-rendering and ZIP bundles are CPU-bound; on a 1-vCPU server one at a time is fastest.
const ASSETS_CONCURRENCY = Number(process.env.WORKER_ASSETS_CONCURRENCY) || 1;
// BullMQ only honours manual rate limits (worker.rateLimit) when a limiter is configured. This one
// is deliberately loose; the real Gemini limits are enforced per call by the shared Gemini limiter.
const QUEUE_LIMITER = { max: 30, duration: 60_000 };
import { env } from "./env";
import { processImageGeneration } from "./processors/image-generation.processor";
import { processReEdit } from "./processors/re-edit.processor";
import { processAssetJob } from "./processors/assets.processor";

async function main() {
  logger.info("==================================================");
  logger.info("  Peshkar AI BullMQ Worker Service Starting...   ");
  logger.info("==================================================");
  logger.info(`Environment: ${env.NODE_ENV}`);
  logger.info(`Redis URL: ${env.REDIS_URL}`);

  try {
    await connectToDatabase();
    logger.info("Connected to MongoDB successfully in worker process");
  } catch (err) {
    logger.error("Failed to connect to MongoDB in worker process", { err });
    process.exit(1);
  }

  // Money flows need MongoDB transactions (replica set). Refuse to run without them in production.
  try {
    await assertTransactionsSupported();
  } catch (err) {
    logger.error(String((err as Error).message));
    process.exit(1);
  }
  await ensureDbGuards();

  const redis = getRedisConnection();

  // 1. Image Generation Worker
  const imageGenerationWorker: Worker = new Worker(
    IMAGE_GENERATION_QUEUE_NAME,
    async (job) => {
      return await processImageGeneration(job, {
        rateLimit: (ms) => imageGenerationWorker.rateLimit(ms),
      });
    },
    {
      connection: redis,
      concurrency: GENERATION_CONCURRENCY,
      lockDuration: 180000, // 3 minutes (renewed automatically while the job runs)
      limiter: QUEUE_LIMITER,
    }
  );

  imageGenerationWorker.on("completed", (job) => {
    logger.info(`Job ${job.id} on queue '${IMAGE_GENERATION_QUEUE_NAME}' completed`);
  });

  imageGenerationWorker.on("failed", (job, err) => {
    logger.error(`Job ${job?.id} on queue '${IMAGE_GENERATION_QUEUE_NAME}' failed:`, {
      err: err.message,
    });
  });

  // 2. Re-Edit Worker
  const reEditWorker = new Worker(
    RE_EDIT_QUEUE_NAME,
    async (job) => {
      return await processReEdit(job);
    },
    {
      connection: redis,
      concurrency: RE_EDIT_CONCURRENCY,
      lockDuration: 120000, // 2 minutes (renewed automatically while the job runs)
      limiter: QUEUE_LIMITER,
    }
  );

  reEditWorker.on("completed", (job) => {
    logger.info(`Job ${job.id} on queue '${RE_EDIT_QUEUE_NAME}' completed`);
  });

  reEditWorker.on("failed", (job, err) => {
    logger.error(`Job ${job?.id} on queue '${RE_EDIT_QUEUE_NAME}' failed:`, {
      err: err.message,
    });
  });

  // 3. Assets Worker (card re-rendering + ZIP bundles requested by the API, which waits for them)
  const assetsWorker = new Worker(ASSETS_QUEUE_NAME, processAssetJob, {
    connection: redis,
    concurrency: ASSETS_CONCURRENCY,
    lockDuration: 120000,
  });

  assetsWorker.on("failed", (job, err) => {
    logger.error(`Job ${job?.id} on queue '${ASSETS_QUEUE_NAME}' failed:`, {
      err: err.message,
    });
  });

  // 4. Maintenance: every 5 minutes repair work a crash left half-done (stuck "queued" listings,
  // unrefunded failures, stuck re-edits). One scheduler entry, so it runs once per interval even
  // with several worker replicas.
  const maintenanceQueue = new Queue(MAINTENANCE_QUEUE_NAME, { connection: redis });
  await maintenanceQueue.upsertJobScheduler(
    "reconcile-stuck-work",
    { every: RECONCILE_EVERY_MS },
    { name: "reconcile", opts: { removeOnComplete: 20, removeOnFail: 50 } }
  );
  const maintenanceWorker = new Worker(
    MAINTENANCE_QUEUE_NAME,
    async () => {
      const summary = await reconcileStuckWork((msg) => logger.info(`[reconcile] ${msg}`));
      return summary;
    },
    { connection: redis, concurrency: 1 }
  );
  maintenanceWorker.on("failed", (job, err) => {
    logger.error(`Maintenance job ${job?.id} failed:`, { err: err.message });
  });

  logger.info(
    `All BullMQ Workers active (generation x${GENERATION_CONCURRENCY}, re-edit x${RE_EDIT_CONCURRENCY}, assets x${ASSETS_CONCURRENCY}, maintenance every 5 min).`
  );

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down worker process gracefully...`);
    try {
      await imageGenerationWorker.close();
      await reEditWorker.close();
      await assetsWorker.close();
      await maintenanceWorker.close();
      await maintenanceQueue.close();
      await disconnectDatabase();
      logger.info("Worker process closed cleanly.");
      process.exit(0);
    } catch (err) {
      logger.error("Error during graceful shutdown:", { err });
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  logger.error("Fatal error in worker service", { err });
  process.exit(1);
});
