import * as trpcExpress from "@trpc/server/adapters/express";
import { getAuth, clerkClient } from "@clerk/express";
import { User, IUser, connectToDatabase } from "@repo/database";

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

      // Just-In-Time Provisioning: If user logged in but webhook has not created them yet
      if (!user) {
        const trialCredits = 10;
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
            creditHistory: [
              {
                type: "TRIAL",
                amount: trialCredits,
                balanceAfter: trialCredits,
                description: "Welcome bonus trial credits",
                createdAt: new Date(),
              },
            ],
            role: "user",
          });
        } catch {
          user = await User.create({
            clerkId: clerkUserId,
            fullName: "Seller",
            email: `${clerkUserId}@example.com`,
            creditBalance: trialCredits,
            lifetimeCreditsEarned: trialCredits,
            lifetimeCreditsSpent: 0,
            creditHistory: [
              {
                type: "TRIAL",
                amount: trialCredits,
                balanceAfter: trialCredits,
                description: "Welcome bonus trial credits",
                createdAt: new Date(),
              },
            ],
            role: "user",
          });
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
