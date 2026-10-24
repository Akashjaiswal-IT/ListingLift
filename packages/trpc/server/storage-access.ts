import { TRPCError } from "@trpc/server";
import { ListingObject, Types } from "@repo/database";

/**
 * Throws FORBIDDEN unless the caller owns `s3Key`: their own uploads, or the generated images and
 * cards of one of their own listings. Every endpoint that signs a storage key must call this.
 */
export async function assertOwnsStorageKey(s3Key: string, userId: unknown): Promise<void> {
  const [prefix, owner] = s3Key.split("/");
  const me = String(userId);
  let allowed = false;
  if (prefix === "uploads") {
    allowed = owner === me;
  } else if ((prefix === "generated" || prefix === "cards") && owner && Types.ObjectId.isValid(owner)) {
    allowed = !!(await ListingObject.exists({ _id: owner, userId }));
  }
  if (!allowed || s3Key.includes("..")) {
    throw new TRPCError({ code: "FORBIDDEN", message: "You do not have access to this file" });
  }
}
