import { ListingObject } from "@repo/database";
import { enqueueImageGeneration, getImageGenerationQueue, getReEditQueue } from "../queue/queue.service";
import { refundListingCharge, refundReEditCharge } from "../charges.service";
import { RE_EDIT_CREDIT_COST } from "../credit.service";

/**
 * Repairs work that a crash left half-done. A database transaction can't cover these cases because
 * the job queue lives in Redis, outside MongoDB. Runs every few minutes from the worker.
 *
 *  1. "queued" for 10+ min with no live job (e.g. crash after charging, before queuing) -> queue it.
 *  2. "processing" for 30+ min with no live job (worker died mid-job)                  -> refund, mark failed.
 *  3. "failed" with its charge never refunded for 15+ min (refund hit an error)        -> refund.
 *  4. a re-edit "processing" for 15+ min with no live job                                -> refund, mark failed.
 *
 * Every repair is conditional and exactly-once (the same guarded refunds the normal flows use), so
 * running it twice, or alongside a live worker, is safe.
 */

const LIVE_STATES = new Set(["waiting", "active", "delayed", "prioritized", "waiting-children"]);
const BATCH = 50;
const minutesAgo = (m: number) => new Date(Date.now() - m * 60 * 1000);

async function jobIsLive(kind: "generation" | "re_edit", jobId?: string | null): Promise<boolean> {
  if (!jobId) return false;
  const queue = kind === "generation" ? getImageGenerationQueue() : getReEditQueue();
  const job = await queue.getJob(jobId);
  if (!job) return false;
  return LIVE_STATES.has(await job.getState());
}

export interface ReconcileSummary {
  requeued: number;
  refundedStuck: number;
  refundedFailed: number;
  refundedReEdits: number;
}

export async function reconcileStuckWork(log: (msg: string) => void = () => {}): Promise<ReconcileSummary> {
  const summary: ReconcileSummary = { requeued: 0, refundedStuck: 0, refundedFailed: 0, refundedReEdits: 0 };

  // 1. Stuck in "queued"
  const queued = await ListingObject.find({ status: "queued", updatedAt: { $lt: minutesAgo(10) } }).limit(BATCH);
  for (const listing of queued) {
    if (await jobIsLive("generation", listing.bullmqJobId)) continue;
    const jobId = await enqueueImageGeneration(String(listing._id));
    // Only record it if the listing is still the same stuck one.
    await ListingObject.updateOne({ _id: listing._id, status: "queued" }, { $set: { bullmqJobId: jobId } });
    summary.requeued++;
    log(`Re-queued stuck listing ${listing._id} as job ${jobId}`);
  }

  // 2. Stuck in "processing"
  const processing = await ListingObject.find({ status: "processing", updatedAt: { $lt: minutesAgo(30) } }).limit(BATCH);
  for (const listing of processing) {
    if (await jobIsLive("generation", listing.bullmqJobId)) continue;
    const res = await refundListingCharge({
      listingObjectId: listing._id,
      reason: "stuck",
      errorMessage: "Generation did not finish. Your credits were refunded — please try again.",
    });
    if (res.refunded) summary.refundedStuck++;
    else {
      // Nothing charged (or already refunded): just stop showing it as running.
      await ListingObject.updateOne(
        { _id: listing._id, status: "processing" },
        { $set: { status: "failed", errorMessage: "Generation did not finish. Please try again." } }
      );
    }
    log(`Closed stuck processing listing ${listing._id} (refunded: ${res.refunded})`);
  }

  // 3. Failed but never refunded
  const unrefunded = await ListingObject.find({
    status: "failed",
    creditsCharged: { $gt: 0 },
    creditsRefunded: { $ne: true },
    updatedAt: { $lt: minutesAgo(15) },
  }).limit(BATCH);
  for (const listing of unrefunded) {
    const res = await refundListingCharge({ listingObjectId: listing._id, reason: "failed" });
    if (res.refunded) {
      summary.refundedFailed++;
      log(`Refunded failed listing ${listing._id} (${res.amount} credits)`);
    }
  }

  // 4. Stuck re-edits
  const reEdits = await ListingObject.find({
    "reEditStatus.status": "processing",
    "reEditStatus.updatedAt": { $lt: minutesAgo(15) },
  }).limit(BATCH);
  for (const listing of reEdits) {
    const status = listing.reEditStatus;
    if (!status || (await jobIsLive("re_edit", status.jobId))) continue;
    const res = await refundReEditCharge({
      listingObjectId: listing._id,
      userId: listing.userId,
      credits: RE_EDIT_CREDIT_COST,
      chargeId: status.chargeId,
      legacyJobId: status.jobId,
      errorMessage: "The re-edit did not finish. Your 1 credit has been refunded.",
      description: `Refund for re-edit that did not finish (${listing.userTitle || "image"})`,
    });
    if (res.refunded) summary.refundedReEdits++;
    else {
      await ListingObject.updateOne(
        { _id: listing._id, "reEditStatus.status": "processing" },
        { $set: { "reEditStatus.status": "failed", "reEditStatus.updatedAt": new Date() } }
      );
    }
    log(`Closed stuck re-edit on listing ${listing._id} (refunded: ${res.refunded})`);
  }

  return summary;
}
