import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, adminProcedure } from "../../trpc";
import { User, ListingObject, Payment, CreditLedger, runInTransaction } from "@repo/database";
import { enqueueImageGeneration } from "@repo/services";

// Estimates from Google's official per-image prices at ~₹95/$ (Oct 2026); replace with logged token costs.
const EST_IMAGE_COST_INR = 4.5; // one 1K Nano Banana 2.1 call ($0.0336 output + reference-image input + thinking); 2K Pro calls ~₹6.2
const EST_CHECK_COST_INR = 1; // gpt-4.1 fidelity judge, at most once per Gemini call
const EST_TEXT_COST_INR = 1.5; // gpt-4.1 photo analysis + gpt-4.1-mini listing text per listing

export const adminRouter = router({
  getStats: adminProcedure.query(async () => {
    const [totalUsers, totalListings, completedListings, failedListings, totalPayments, imageTotals] =
      await Promise.all([
        User.countDocuments(),
        ListingObject.countDocuments(),
        ListingObject.countDocuments({ status: "completed" }),
        ListingObject.countDocuments({ status: "failed" }),
        Payment.aggregate([
          { $match: { status: "captured" } },
          { $group: { _id: null, totalPaise: { $sum: "$amountPaise" }, totalCredits: { $sum: "$creditsPurchased" } } },
        ]),
        ListingObject.aggregate([
          { $match: { status: "completed" } },
          // Each image records how many Gemini calls it took (retries); older images have no count, so assume 1.
          {
            $group: {
              _id: null,
              calls: {
                $sum: {
                  $sum: {
                    $map: {
                      input: { $ifNull: ["$generatedImages", []] },
                      as: "img",
                      in: { $ifNull: ["$$img.attempts", 1] },
                    },
                  },
                },
              },
            },
          },
        ]),
      ]);

    const revenueRupees = (totalPayments[0]?.totalPaise || 0) / 100;
    const creditsSold = totalPayments[0]?.totalCredits || 0;
    const geminiCalls: number = imageTotals[0]?.calls || 0;
    const estimatedAiCostRupees =
      geminiCalls * (EST_IMAGE_COST_INR + EST_CHECK_COST_INR) + completedListings * EST_TEXT_COST_INR;

    return {
      totalUsers,
      totalListings,
      completedListings,
      failedListings,
      revenueRupees,
      creditsSold,
      estimatedAiCostRupees,
      estimatedProfitRupees: Math.max(0, revenueRupees - estimatedAiCostRupees),
    };
  }),

  getUsers: adminProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(20),
        search: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const skip = (input.page - 1) * input.limit;
      const query: any = {};

      if (input.search) {
        query.$or = [
          { fullName: { $regex: input.search, $options: "i" } },
          { email: { $regex: input.search, $options: "i" } },
          { storeName: { $regex: input.search, $options: "i" } },
        ];
      }

      const [users, total] = await Promise.all([
        User.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(input.limit)
          .lean(),
        User.countDocuments(query),
      ]);

      return {
        users,
        total,
        page: input.page,
        totalPages: Math.ceil(total / input.limit),
      };
    }),

  getUserById: adminProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      const user = await User.findById(input.userId).lean();
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      const recentListings = await ListingObject.find({ userId: input.userId })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

      return { user, recentListings };
    }),

  adjustCredits: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        amount: z.number().int(),
        reason: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const incFields: Record<string, number> = { creditBalance: input.amount };
      if (input.amount > 0) {
        incFields.lifetimeCreditsEarned = input.amount;
      }

      // ONE transaction: balance change + ledger row. A deduction can't take the balance below 0.
      const newBalance = await runInTransaction(async (session) => {
        const user = await User.findOneAndUpdate(
          { _id: input.userId, ...(input.amount < 0 ? { creditBalance: { $gte: -input.amount } } : {}) },
          { $inc: incFields },
          { new: true, session }
        );

        if (!user) {
          const exists = await User.exists({ _id: input.userId }).session(session);
          throw new TRPCError(
            exists
              ? { code: "BAD_REQUEST", message: "That would take the balance below 0" }
              : { code: "NOT_FOUND", message: "User not found" }
          );
        }

        await CreditLedger.create(
          [
            {
              userId: user._id,
              type: input.amount >= 0 ? "BONUS" : "DEBIT",
              amount: input.amount,
              balanceAfter: user.creditBalance,
              description: `Admin adjustment: ${input.reason}`,
              createdAt: new Date(),
            },
          ],
          { session }
        );
        return user.creditBalance;
      });

      return { success: true, newBalance };
    }),

  getJobs: adminProcedure
    .input(
      z.object({
        status: z.enum(["uploaded", "queued", "processing", "completed", "failed"]).optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(50).default(20),
      })
    )
    .query(async ({ input }) => {
      const query: any = {};
      if (input.status) query.status = input.status;

      const skip = (input.page - 1) * input.limit;
      const [jobs, total] = await Promise.all([
        ListingObject.find(query)
          .populate("userId", "fullName email storeName")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(input.limit)
          .lean(),
        ListingObject.countDocuments(query),
      ]);

      return {
        jobs,
        total,
        page: input.page,
        totalPages: Math.ceil(total / input.limit),
      };
    }),

  retryJob: adminProcedure
    .input(z.object({ listingObjectId: z.string() }))
    .mutation(async ({ input }) => {
      const listing = await ListingObject.findById(input.listingObjectId);
      if (!listing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Listing not found" });
      }

      listing.status = "queued";
      listing.errorMessage = undefined;
      await listing.save();

      const jobId = await enqueueImageGeneration(String(listing._id));
      listing.bullmqJobId = jobId;
      await listing.save();

      return { success: true, jobId };
    }),
});
