import * as trpcExpress from "@trpc/server/adapters/express";
import { getAuth, clerkClient } from "@clerk/express";
import { User, IUser, CreditLedger, connectToDatabase, runInTransaction, isDuplicateKeyError } from "@repo/database";
import { TRIAL_CREDITS } from "@repo/services";

export interface Context {
  clerkUserId: string | null;
  user: IUser | null;
  auth: ReturnType<typeof getAuth> | null;
  req?: any;
  res?: any;
}

export async function createContext(
  opts: trpcExpress.CreateExpressContextOptions
): Promise<Context> {
  const { req, res } = opts;
  let auth: ReturnType<typeof getAuth> | null = null;
  let clerkUserId: string | null = null;
  let user: IUser | null = null;

  try {
    auth = getAuth(req);
    clerkUserId = auth?.userId || null;
    if (clerkUserId) {
      await connectToDatabase();
      user = await User.findOne({ clerkId: clerkUserId });

      // Ensure existing users have a referral code
      if (user && !user.referralCode) {
        user.referralCode = `PESH-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        await user.save().catch(() => {});
      }

      // Just-In-Time Provisioning: If user logged in but webhook has not created them yet
      if (!user) {
        user = await provisionUser(clerkUserId);
      }
    }
  } catch {
    // Unauthenticated fallback
  }

  return {
    req,
    res,
    auth,
    clerkUserId,
    user,
  };
}

/**
 * Creates the account and its trial-credit ledger row in ONE transaction. If the Clerk webhook
 * created the same user a moment earlier, the unique clerkId index rejects this insert and the
 * existing account is returned instead (no duplicate account, no second trial).
 */
async function createUserWithTrial(doc: Record<string, unknown>, ledgerDescription: string): Promise<IUser | null> {
  try {
    return await runInTransaction(async (session) => {
      const [created] = await User.create([{ ...doc, creditBalance: TRIAL_CREDITS, lifetimeCreditsEarned: TRIAL_CREDITS, lifetimeCreditsSpent: 0, role: "user" }], { session });
      await CreditLedger.create(
        [
          {
            userId: created!._id,
            type: "TRIAL",
            amount: TRIAL_CREDITS,
            balanceAfter: TRIAL_CREDITS,
            description: ledgerDescription,
            createdAt: new Date(),
          },
        ],
        { session }
      );
      return created as IUser;
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) return User.findOne({ clerkId: doc.clerkId });
    throw err;
  }
}

async function provisionUser(clerkUserId: string): Promise<IUser | null> {
  const newReferralCode = `PESH-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  let clerkUser;
  try {
    clerkUser = await clerkClient.users.getUser(clerkUserId);
  } catch (fetchErr) {
    if (process.env.NODE_ENV === "production") {
      // In production, never create placeholder accounts with fake email addresses
      // Leave user null so protectedProcedure safely requests re-authentication
      console.error(
        "[SECURITY] Failed to fetch Clerk user details during production JIT provisioning:",
        fetchErr
      );
      return null;
    }
    // Local dev fallback only
    return createUserWithTrial(
      { clerkId: clerkUserId, fullName: "Seller", email: `${clerkUserId}@example.com` },
      "Welcome bonus trial credits (Dev Fallback)"
    );
  }

  const primaryEmail = clerkUser.emailAddresses?.[0]?.emailAddress || "";
  const fullName =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
    primaryEmail.split("@")[0] ||
    "Seller";
  try {
    return await createUserWithTrial(
      {
        clerkId: clerkUserId,
        fullName,
        email: primaryEmail,
        profileImageUrl: clerkUser.imageUrl,
        referralCode: newReferralCode,
      },
      "Welcome bonus trial credits"
    );
  } catch (createErr) {
    console.error("JIT provisioning failed:", createErr);
    return null;
  }
}
