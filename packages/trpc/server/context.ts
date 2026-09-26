import * as trpcExpress from "@trpc/server/adapters/express";
import { getAuth } from "@clerk/express";
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
