import mongoose, { type ClientSession } from "mongoose";

/**
 * Multi-document ACID transactions.
 *
 * MongoDB only runs transactions on a replica set (a standalone mongod rejects them with
 * "Transaction numbers are only allowed on a replica set member or mongos"). Production must
 * therefore run Mongo as a (single-node) replica set - see docs/runbooks/mongo-replica-set.md.
 *
 * In development a standalone Mongo is still allowed: the work runs without a transaction and a
 * warning is logged once. In production a missing replica set is a hard error, because running
 * money flows without a transaction would silently give up the all-or-nothing guarantee.
 */

let supportCache: boolean | null = null;
let warnedNoTxn = false;

export class TransactionsUnavailableError extends Error {
  constructor() {
    super(
      "MongoDB is not running as a replica set, so transactions are unavailable. " +
        "Production requires a replica set (see docs/runbooks/mongo-replica-set.md)."
    );
    this.name = "TransactionsUnavailableError";
  }
}

/** True when the connected MongoDB supports multi-document transactions (replica set or mongos). */
export async function supportsTransactions(): Promise<boolean> {
  if (supportCache !== null) return supportCache;
  const db = mongoose.connection.db;
  if (!db) return false; // not connected yet - don't cache
  try {
    const hello: any = await db.admin().command({ hello: 1 });
    supportCache = !!hello?.setName || hello?.msg === "isdbgrid";
  } catch {
    supportCache = false;
  }
  return supportCache;
}

/**
 * Call once at service startup (after connecting). In production it throws when transactions are
 * unavailable so the service refuses to run money flows without ACID guarantees.
 */
export async function assertTransactionsSupported(): Promise<void> {
  const ok = await supportsTransactions();
  if (ok) return;
  if (process.env.NODE_ENV === "production") throw new TransactionsUnavailableError();
  console.warn("[db] MongoDB is standalone: transactions disabled (development only).");
}

/**
 * Runs `fn` inside ONE transaction: every write either commits together or not at all.
 *
 * Rules for `fn`:
 *  - pass `{ session }` to every database call inside it;
 *  - no network calls to other systems (Gemini, R2, Razorpay, the job queue) - they can't be
 *    rolled back and a transaction must finish well within MongoDB's 60s lifetime limit;
 *  - it may run more than once (the driver retries transient errors), so it must only derive
 *    its result from what it reads/writes in the database.
 */
export async function runInTransaction<T>(fn: (session: ClientSession | null) => Promise<T>): Promise<T> {
  if (!(await supportsTransactions())) {
    if (process.env.NODE_ENV === "production") throw new TransactionsUnavailableError();
    if (!warnedNoTxn) {
      warnedNoTxn = true;
      console.warn("[db] Running without a transaction: MongoDB is standalone (development only).");
    }
    return fn(null);
  }

  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(
      async () => {
        result = await fn(session);
      },
      { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" }, readPreference: "primary" }
    );
    return result as T;
  } finally {
    await session.endSession();
  }
}

/** True for a MongoDB duplicate-key error (a unique index rejected the write). */
export function isDuplicateKeyError(err: unknown): boolean {
  const e = err as { code?: number; errorResponse?: { code?: number } } | null;
  return e?.code === 11000 || e?.errorResponse?.code === 11000;
}

/** Test hook: forget the cached replica-set check. */
export function resetTransactionSupportCache(): void {
  supportCache = null;
  warnedNoTxn = false;
}
