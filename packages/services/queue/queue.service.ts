import { Queue } from "bullmq";
import Redis from "ioredis";

let redisConnection: Redis | null = null;

export function getRedisConnection(): Redis {
  if (!redisConnection) {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    redisConnection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return redisConnection;
}

export const IMAGE_GENERATION_QUEUE_NAME = "image-generation";
export const RE_EDIT_QUEUE_NAME = "re-edit";

let imageGenQueue: Queue | null = null;
let reEditQueue: Queue | null = null;

export function getImageGenerationQueue(): Queue {
  if (!imageGenQueue) {
    imageGenQueue = new Queue(IMAGE_GENERATION_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    });
  }
  return imageGenQueue;
}

export function getReEditQueue(): Queue {
  if (!reEditQueue) {
    reEditQueue = new Queue(RE_EDIT_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: "exponential",
          delay: 4000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    });
  }
  return reEditQueue;
}

export async function enqueueImageGeneration(listingObjectId: string): Promise<string> {
  const queue = getImageGenerationQueue();
  const job = await queue.add(
    "generate-listing-images",
    { listingObjectId },
    { jobId: `gen_${listingObjectId}` }
  );
  return job.id || `gen_${listingObjectId}`;
}

export async function enqueueReEdit(params: {
  listingObjectId: string;
  generatedImageId: string;
  newPrompt: string;
}): Promise<string> {
  const queue = getReEditQueue();
  const job = await queue.add(
    "re-edit-image",
    params,
    { jobId: `reedit_${params.generatedImageId}_${Date.now()}` }
  );
  return job.id || `reedit_${params.generatedImageId}`;
}
