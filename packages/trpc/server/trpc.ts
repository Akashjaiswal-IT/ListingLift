import { initTRPC, TRPCError } from "@trpc/server";
import { OpenApiMeta } from "trpc-to-openapi";
import { Context } from "./context";

export const tRPCContext = initTRPC
  .meta<OpenApiMeta>()
  .context<Context>()
  .create({});

export const router = tRPCContext.router;
export const middleware = tRPCContext.middleware;

export const publicProcedure = tRPCContext.procedure;

// Enforces Clerk authentication and resolves User document
const isAuthed = middleware(async ({ ctx, next }) => {
  if (!ctx.clerkUserId || !ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to perform this action",
    });
  }

  return next({
    ctx: {
      ...ctx,
      clerkUserId: ctx.clerkUserId,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = tRPCContext.procedure.use(isAuthed);

// Enforces Admin role
const isAdmin = middleware(async ({ ctx, next }) => {
  if (!ctx.clerkUserId || !ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to perform this action",
    });
  }

  if (ctx.user.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have administrative privileges",
    });
  }

  return next({
    ctx: {
      ...ctx,
      clerkUserId: ctx.clerkUserId,
      user: ctx.user,
    },
  });
});

export const adminProcedure = tRPCContext.procedure.use(isAdmin);
