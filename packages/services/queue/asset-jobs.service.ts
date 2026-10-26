import { ListingObject } from "@repo/database";
import { createListingBundleZip } from "../download/bundle.service";
import {
  regenerateListingCards,
  type RegenerateCardsParams,
  type RegeneratedCards,
} from "../card/card-regeneration.service";
import { getAssetsQueue, getAssetsQueueEvents } from "./queue.service";

/**
 * Heavy asset work the API hands to the worker ("assets" queue) and waits for:
 * - "regenerate-cards": re-render the three social cards of a listing
 * - "bundle-zip": build the listing ZIP (photos, cards, copy, spreadsheet) and sign a download URL
 */
export interface AssetJobMap {
  "regenerate-cards": { data: RegenerateCardsParams; result: RegeneratedCards };
  "bundle-zip": {
    data: { listingObjectId: string; userId: string };
    result: { downloadUrl: string; s3Key: string };
  };
}
export type AssetJobName = keyof AssetJobMap;

/** How long the API waits for an asset job before giving up (the job is dropped if not started). */
export const ASSET_JOB_TIMEOUT_MS = Number(process.env.ASSET_JOB_TIMEOUT_MS) || 90_000;

/** The worker did not finish the job in time (busy, or not running). */
export class AssetJobTimeoutError extends Error {
  constructor(name: string, timeoutMs: number) {
    super(`Asset job "${name}" did not finish within ${Math.round(timeoutMs / 1000)}s`);
    this.name = "AssetJobTimeoutError";
  }
}

/** Does the work of one asset job. Called by the worker (and by the API when ASSET_JOBS_INLINE=1). */
export async function executeAssetJob<N extends AssetJobName>(
  name: N,
  data: AssetJobMap[N]["data"]
): Promise<AssetJobMap[N]["result"]> {
  switch (name) {
    case "regenerate-cards":
      return (await regenerateListingCards(data as RegenerateCardsParams)) as AssetJobMap[N]["result"];
    case "bundle-zip": {
      const { listingObjectId, userId } = data as AssetJobMap["bundle-zip"]["data"];
      const listing = await ListingObject.findOne({ _id: listingObjectId, userId });
      if (!listing) {
        throw new Error("Listing not found");
      }
      return (await createListingBundleZip(listing)) as AssetJobMap[N]["result"];
    }
    default:
      throw new Error(`Unknown asset job: ${String(name)}`);
  }
}

// Job results travel through Redis as JSON, so dates come back as strings.
function reviveResult<N extends AssetJobName>(name: N, result: any): AssetJobMap[N]["result"] {
  if (name === "regenerate-cards" && result) {
    for (const key of ["whatsappCard", "instagramPost", "instagramStory"] as const) {
      if (result[key]?.generatedAt) {
        result[key] = { ...result[key], generatedAt: new Date(result[key].generatedAt) };
      }
    }
  }
  return result;
}

/**
 * Runs an asset job on the worker and waits for its result. Set ASSET_JOBS_INLINE=1 (local dev
 * without a worker) to run it in-process instead. Throws AssetJobTimeoutError when the worker
 * doesn't finish in time, or an Error with the worker's failure message when the job fails.
 */
export async function runAssetJob<N extends AssetJobName>(
  name: N,
  data: AssetJobMap[N]["data"],
  timeoutMs: number = ASSET_JOB_TIMEOUT_MS
): Promise<AssetJobMap[N]["result"]> {
  if (process.env.ASSET_JOBS_INLINE === "1") {
    return executeAssetJob(name, data);
  }

  const events = await getAssetsQueueEvents();
  const job = await getAssetsQueue().add(name, data, {
    jobId: `${name}_${(data as { listingObjectId?: string }).listingObjectId ?? "x"}_${Date.now()}`,
  });

  const started = Date.now();
  try {
    const result = await job.waitUntilFinished(events, timeoutMs);
    return reviveResult(name, result);
  } catch (err) {
    const timedOut =
      Date.now() - started >= timeoutMs - 100 ||
      (err instanceof Error && /timed out before finishing/i.test(err.message));
    if (!timedOut) throw err;

    // Don't let a job nobody waits for anymore run later (only possible while it hasn't started)
    try {
      const state = await job.getState();
      if (state === "waiting" || state === "delayed" || state === "prioritized") {
        await job.remove();
      }
    } catch {
      // Best effort
    }
    throw new AssetJobTimeoutError(name, timeoutMs);
  }
}
