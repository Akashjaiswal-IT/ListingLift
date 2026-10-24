import { ListingObject, CreditLedger, runInTransaction, isDuplicateKeyError, Types } from "@repo/database";
import { deductCredits, refundCredits } from "./credit.service";

/** The listing was not in a state that allows this (already queued/processing, or changed meanwhile). */
export class ListingBusyError extends Error {
  constructor(message = "This listing is already being generated or has changed. Please refresh and try again.") {
    super(message);
    this.name = "ListingBusyError";
  }
}

/**
 * Charges for a generation and claims the listing for it, in ONE transaction:
 *   listing status -> "queued" (only from an allowed state) + its inputs + creditsCharged
 *   + the user's credit deduction + the DEBIT ledger row.
 * Two taps, two tabs or a retried request can therefore never charge twice or queue the same
 * listing twice: only one claim can match. Queue the job only AFTER this resolves.
 *
 * Without a transaction (development only) the deduction runs first and is refunded if the
 * claim does not match, so the worst case is never a free generation.
 */
export async function chargeAndClaimListing(params: {
  listingObjectId: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  /** Mongo filter conditions the listing must still satisfy at claim time. */
  claimFilter: Record<string, unknown>;
  /** Fields to store on the listing together with the claim. */
  set: Record<string, unknown>;
  /** Credits to charge; 0 = claim only (e.g. retrying a failure that was never refunded). */
  credits: number;
  description: string;
}): Promise<{ newBalance: number | undefined }> {
  return runInTransaction(async (session) => {
    let newBalance: number | undefined;
    if (params.credits > 0) {
      const res = await deductCredits({
        userId: params.userId,
        amount: params.credits,
        description: params.description,
        referenceId: String(params.listingObjectId),
        referenceType: "listing_object",
        session,
      });
      newBalance = res.newBalance;
    }

    // Fields passed as undefined are cleared (same as assigning undefined and saving before).
    const toSet: Record<string, unknown> = {};
    const toUnset: Record<string, 1> = { generationStage: 1, errorMessage: 1 };
    for (const [key, value] of Object.entries(params.set)) {
      if (value === undefined) toUnset[key] = 1;
      else toSet[key] = value;
    }

    const claimed = await ListingObject.findOneAndUpdate(
      { _id: params.listingObjectId, userId: params.userId, ...params.claimFilter },
      {
        $set: {
          ...toSet,
          status: "queued",
          ...(params.credits > 0 ? { creditsCharged: params.credits, creditsRefunded: false } : {}),
        },
        $unset: toUnset,
      },
      { new: true, session }
    );

    if (!claimed) {
      if (!session && params.credits > 0) {
        // No transaction to roll back (development): undo the deduction explicitly.
        await refundCredits({
          userId: params.userId,
          amount: params.credits,
          description: "Automatic refund — generation could not start",
          referenceId: String(params.listingObjectId),
          referenceType: "listing_object",
        });
      }
      throw new ListingBusyError();
    }
    return { newBalance };
  });
}

/**
 * Refunds a listing's generation charge exactly once, in ONE transaction:
 *   creditsRefunded false -> true (+ status "failed") + the user's credits + the REFUND ledger row.
 * The conditional flip is the exactly-once guard: a second call (retry, worker re-run,
 * reconciler) matches nothing. Returns whether this call did the refund.
 */
export async function refundListingCharge(params: {
  listingObjectId: Types.ObjectId | string;
  reason: "failed" | "not_queued" | "stuck";
  errorMessage?: string;
  retryCount?: number;
}): Promise<{ refunded: boolean; amount: number }> {
  return runInTransaction(async (session) => {
    const claimed = await ListingObject.findOneAndUpdate(
      { _id: params.listingObjectId, creditsRefunded: { $ne: true }, creditsCharged: { $gt: 0 } },
      {
        $set: {
          creditsRefunded: true,
          status: "failed",
          ...(params.errorMessage ? { errorMessage: params.errorMessage } : {}),
          ...(params.retryCount !== undefined ? { retryCount: params.retryCount } : {}),
        },
      },
      { new: true, session }
    );
    if (!claimed) return { refunded: false, amount: 0 };

    const title = claimed.userTitle || "listing";
    const description =
      params.reason === "not_queued"
        ? `Automatic refund — could not queue generation for ${title}`
        : params.reason === "stuck"
        ? `Automatic refund — generation for ${title} did not finish`
        : `Automatic refund for failed generation of ${title}`;

    await refundCredits({
      userId: claimed.userId,
      amount: claimed.creditsCharged,
      description,
      referenceId: String(claimed._id),
      referenceType: "listing_object",
      session,
    });
    return { refunded: true, amount: claimed.creditsCharged };
  });
}

const REEDIT_STALE_MS = 15 * 60 * 1000;

/**
 * Charges for a re-edit and claims the listing's re-edit slot, in ONE transaction:
 *   reEditStatus -> "processing" (only if no re-edit is running) + a new chargeId
 *   + the user's credit deduction + the DEBIT ledger row.
 * One re-edit per listing at a time: a second tap is rejected instead of charged. A slot left
 * "processing" for over 15 minutes (crashed job) is treated as free again.
 */
export async function chargeAndClaimReEdit(params: {
  listingObjectId: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  generatedImageId: string;
  credits: number;
  description: string;
}): Promise<{ newBalance: number; chargeId: string }> {
  const chargeId = new Types.ObjectId().toString();
  return runInTransaction(async (session) => {
    const res = await deductCredits({
      userId: params.userId,
      amount: params.credits,
      description: params.description,
      referenceId: String(params.listingObjectId),
      referenceType: "re_edit",
      session,
    });

    const now = new Date();
    const claimed = await ListingObject.findOneAndUpdate(
      {
        _id: params.listingObjectId,
        userId: params.userId,
        "generatedImages._id": new Types.ObjectId(params.generatedImageId),
        $or: [
          { "reEditStatus.status": { $ne: "processing" } },
          { "reEditStatus.updatedAt": { $lt: new Date(now.getTime() - REEDIT_STALE_MS) } },
        ],
      },
      {
        $set: {
          reEditStatus: {
            status: "processing",
            targetImageId: params.generatedImageId,
            chargeId,
            updatedAt: now,
          },
        },
      },
      { new: true, session }
    );

    if (!claimed) {
      if (!session) {
        await refundCredits({
          userId: params.userId,
          amount: params.credits,
          description: "Automatic refund — re-edit could not start",
          referenceId: String(params.listingObjectId),
          referenceType: "re_edit",
        });
      }
      throw new ListingBusyError("A re-edit is already in progress for this listing. Please wait for it to finish.");
    }
    return { newBalance: res.newBalance, chargeId };
  });
}

/**
 * Refunds a re-edit charge exactly once, in ONE transaction: the user's credits + the REFUND
 * ledger row (unique key "reedit-refund:<chargeId>") + reEditStatus "failed".
 * A duplicate (job re-run, reconciler) is rejected by the unique key and reported as not refunded.
 */
export async function refundReEditCharge(params: {
  listingObjectId: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  credits: number;
  /** chargeId from the claim; legacy jobs queued before chargeIds existed pass their job id instead. */
  chargeId?: string;
  legacyJobId?: string;
  errorMessage: string;
  description: string;
}): Promise<{ refunded: boolean }> {
  const key = params.chargeId
    ? `reedit-refund:${params.chargeId}`
    : `reedit-refund:legacy:${params.listingObjectId}:${params.legacyJobId ?? "unknown"}`;
  try {
    return await runInTransaction(async (session) => {
      // Fast path for repeats; the unique key below is the real guarantee.
      if (await CreditLedger.exists({ idempotencyKey: key }).session(session)) return { refunded: false };
      await refundCredits({
        userId: params.userId,
        amount: params.credits,
        description: params.description,
        referenceId: key,
        referenceType: "re_edit",
        idempotencyKey: key,
        session,
      });
      await ListingObject.updateOne(
        {
          _id: params.listingObjectId,
          ...(params.chargeId ? { "reEditStatus.chargeId": params.chargeId } : {}),
        },
        {
          $set: {
            "reEditStatus.status": "failed",
            "reEditStatus.errorMessage": params.errorMessage,
            "reEditStatus.updatedAt": new Date(),
          },
        },
        { session: session ?? undefined }
      );
      return { refunded: true };
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) return { refunded: false };
    throw err;
  }
}
