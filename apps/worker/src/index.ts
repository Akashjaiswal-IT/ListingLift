import { Worker } from "bullmq";
import { logger } from "@repo/logger";
import { connectToDatabase, disconnectDatabase } from "@repo/database";
import {
  getRedisConnection,
  IMAGE_GENERATION_QUEUE_NAME,
  RE_EDIT_QUEUE_NAME,
} from "@repo/services";
import { env } from "./env";
import { processImageGeneration } from "./processors/image-generation.processor";
import { processReEdit } from "./processors/re-edit.processor";

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

  const redis = getRedisConnection();

  // 1. Image Generation Worker (Concurrency: 3)
  const imageGenerationWorker = new Worker(
    IMAGE_GENERATION_QUEUE_NAME,
    async (job) => {
      return await processImageGeneration(job);
    },
    {
      connection: redis,
      concurrency: 3,
      lockDuration: 180000, // 3 minutes
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

  // 2. Re-Edit Worker (Concurrency: 3)
  const reEditWorker = new Worker(
    RE_EDIT_QUEUE_NAME,
    async (job) => {
      return await processReEdit(job);
    },
    {
      connection: redis,
      concurrency: 3,
      lockDuration: 120000, // 2 minutes
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

  logger.info("All BullMQ Workers active and listening for generation jobs.");

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down worker process gracefully...`);
    try {
      await imageGenerationWorker.close();
      await reEditWorker.close();
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
