import mongoose from "mongoose";

/**
 * Database-level rules that hold even if some code path has a bug.
 *
 * - users.creditBalance can never be written below 0. Mongoose's `min` does not apply to
 *   `$inc`, so this is a MongoDB schema validator on the collection itself.
 *   validationLevel "moderate" checks inserts and updates to documents that are already valid,
 *   so it can never block existing data.
 *
 * Unique (idempotency) indexes are declared on the models and built by Mongoose on startup.
 * Safe to call on every start: collMod is idempotent.
 */
export async function ensureDbGuards(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) return;
  const validator = {
    $jsonSchema: {
      properties: {
        creditBalance: { bsonType: ["int", "long", "double", "decimal"], minimum: 0 },
      },
    },
  };
  // MongoDB refuses collMod while an index build runs on the collection, and Mongoose builds the
  // models' indexes right after connecting - so wait for those first, then retry briefly.
  await Promise.allSettled(Object.values(mongoose.models).map((model) => model.init()));

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const exists = await db.listCollections({ name: "users" }, { nameOnly: true }).hasNext();
      if (!exists) {
        await db.createCollection("users", { validator, validationLevel: "moderate", validationAction: "error" });
      } else {
        await db.command({ collMod: "users", validator, validationLevel: "moderate", validationAction: "error" });
      }
      return;
    } catch (err) {
      const indexBuildRunning = /index build/i.test(String((err as Error)?.message));
      if (indexBuildRunning && attempt < 5) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        continue;
      }
      // Never block startup on a guard: log loudly instead.
      console.error("[db] Could not apply the users.creditBalance >= 0 validator:", err);
      return;
    }
  }
}
