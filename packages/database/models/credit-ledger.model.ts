import mongoose, { Schema, Document, Types, Model } from "mongoose";

/**
 * Append-only credit ledger.
 *
 * Previously every credit movement was pushed into an array embedded in the User
 * document (`user.creditHistory`). That has two problems:
 *   1. The array grows forever. MongoDB documents are capped at 16MB, and every
 *      read of the user loaded the entire history.
 *   2. `balanceAfter` was patched with a SECOND save() after the atomic $inc,
 *      which can record the wrong running balance under concurrent writes.
 *
 * A separate, insert-only collection fixes both: each entry is its own immutable
 * document written exactly once (no second save, no race on the balance field),
 * the user document stays small, and history is paginated with an index instead
 * of being loaded wholesale. This is the standard "append-only ledger" pattern.
 */
export type CreditEntryType = "PURCHASE" | "DEBIT" | "REFUND" | "BONUS" | "TRIAL";
export type CreditReferenceType = "payment" | "listing_object" | "re_edit";

export interface ICreditLedgerEntry extends Document {
  userId: Types.ObjectId;
  type: CreditEntryType;
  amount: number; // positive = earned, negative = spent
  balanceAfter: number;
  description: string;
  referenceId?: string;
  referenceType?: CreditReferenceType;
  createdAt: Date;
}

const CreditLedgerSchema = new Schema<ICreditLedgerEntry>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: ["PURCHASE", "DEBIT", "REFUND", "BONUS", "TRIAL"],
      required: true,
    },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    description: { type: String, required: true },
    referenceId: { type: String },
    referenceType: { type: String, enum: ["payment", "listing_object", "re_edit"] },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

// Primary access pattern: a user's history, newest first (paginated).
CreditLedgerSchema.index({ userId: 1, createdAt: -1 });
// Used for idempotency checks (has this referenceId already been refunded?).
CreditLedgerSchema.index({ userId: 1, referenceId: 1 });

export const CreditLedger: Model<ICreditLedgerEntry> =
  (mongoose.models.CreditLedger as Model<ICreditLedgerEntry>) ||
  mongoose.model<ICreditLedgerEntry>("CreditLedger", CreditLedgerSchema);
