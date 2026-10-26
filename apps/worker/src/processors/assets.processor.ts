import { Job } from "bullmq";
import { logger } from "@repo/logger";
import { executeAssetJob, type AssetJobName } from "@repo/services";

/**
 * Runs one job from the "assets" queue: card re-rendering or a listing ZIP bundle that the API
 * requested and is waiting for. The return value goes back to the API as the job result.
 */
export async function processAssetJob(job: Job) {
  const started = Date.now();
  const result = await executeAssetJob(job.name as AssetJobName, job.data);
  logger.info(`Asset job ${job.name} (${job.id}) finished in ${Date.now() - started}ms`);
  return result;
}
