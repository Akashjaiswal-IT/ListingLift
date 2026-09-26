import { router, publicProcedure, protectedProcedure } from "../../trpc";
import { getCreditPacks } from "@repo/services";
import { User } from "@repo/database";

export const creditsRouter = router({
  getPacks: publicProcedure.query(() => {
    return getCreditPacks();
  }),

  getBalance: protectedProcedure.query(async ({ ctx }) => {
    const user = await User.findById(ctx.user._id).select("creditBalance");
    return {
      balance: user?.creditBalance ?? 0,
    };
  }),
});
