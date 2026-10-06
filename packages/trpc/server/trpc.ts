import { initTRPC, TRPCError } from "@trpc/server";
import { OpenApiMeta } from "trpc-to-openapi";
import { captureServerException } from "@repo/services";
import { Context } from "./context";

export const tRPCContext = initTRPC
  .meta<OpenApiMeta>()
  .context<Context>()
  .create({
    // Central error shaping. tRPC already flattens Zod errors into `shape`; here
    // we additionally make sure that in production we never leak a raw internal
    // error message (e.g. a Mongo or OpenAI stack detail) to the client. Expected
    // errors (NOT_FOUND, PRECONDITION_FAILED, TOO_MANY_REQUESTS, …) keep their
    // helpful messages; only unexpected 500s are masked.
    errorFormatter({ shape, error }) {
      if (
        process.env.NODE_ENV === "production" &&
        error.code === "INTERNAL_SERVER_ERROR"
      ) {
        return { ...shape, message: "Something went wrong. Please try again." };
      }
      return shape;
    },
  });

export const router = tRPCContext.router;
export const middleware = tRPCContext.middleware;

// Applied to every procedure below. It logs failures once, in one place, instead
// of each route doing its own `catch (err: any)`. Unexpected 500s are also sent
// to PostHog error tracking; expected errors are only logged at debug level so
// normal control flow (a NOT_FOUND, an insufficient-credits PRECONDITION_FAILED)
// doesn't spam error logs.
const errorLogger = middleware(async ({ next, path, type }) => {
  const result = await next();
  if (!result.ok) {
    const err = result.error;
    if (err.code === "INTERNAL_SERVER_ERROR") {
      console.error(`[tRPC] ${type} ${path} failed:`, err.message, err.stack);
      captureServerException(err, { trpcPath: path, trpcType: type });
    } else {
      console.debug(`[tRPC] ${type} ${path} -> ${err.code}: ${err.message}`);
    }
  }
  return result;
});

export const publicProcedure = tRPCContext.procedure.use(errorLogger);

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

export const protectedProcedure = tRPCContext.procedure.use(errorLogger).use(isAuthed);

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

export const adminProcedure = tRPCContext.procedure.use(errorLogger).use(isAdmin);
