import * as trpcExpress from "@trpc/server/adapters/express";
import { getAuth, clerkClient } from "@clerk/express";
import { User, IUser, CreditLedger, connectToDatabase } from "@repo/database";

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
        const trialCredits = 10;
        const newReferralCode = `PESH-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        try {
          const clerkUser = await clerkClient.users.getUser(clerkUserId);
          const primaryEmail =
            clerkUser.emailAddresses?.[0]?.emailAddress || "";
          const fullName =
            [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
            primaryEmail.split("@")[0] ||
            "Seller";

          user = await User.create({
            clerkId: clerkUserId,
            fullName,
            email: primaryEmail,
            profileImageUrl: clerkUser.imageUrl,
            creditBalance: trialCredits,
            lifetimeCreditsEarned: trialCredits,
            lifetimeCreditsSpent: 0,
            referralCode: newReferralCode,
            role: "user",
          });
          await CreditLedger.create({
            userId: user._id,
            type: "TRIAL",
            amount: trialCredits,
            balanceAfter: trialCredits,
            description: "Welcome bonus trial credits",
            createdAt: new Date(),
          });
        } catch (fetchErr) {
          if (process.env.NODE_ENV === "production") {
            // In production, never create placeholder accounts with fake email addresses
            // Leave user null so protectedProcedure safely requests re-authentication
            console.error(
              "[SECURITY] Failed to fetch Clerk user details during production JIT provisioning:",
              fetchErr
            );
          } else {
            // Local dev fallback only
            user = await User.create({
              clerkId: clerkUserId,
              fullName: "Seller",
              email: `${clerkUserId}@example.com`,
              creditBalance: trialCredits,
              lifetimeCreditsEarned: trialCredits,
              lifetimeCreditsSpent: 0,
              role: "user",
            });
            await CreditLedger.create({
              userId: user._id,
              type: "TRIAL",
              amount: trialCredits,
              balanceAfter: trialCredits,
              description: "Welcome bonus trial credits (Dev Fallback)",
              createdAt: new Date(),
            });
          }
        }
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
