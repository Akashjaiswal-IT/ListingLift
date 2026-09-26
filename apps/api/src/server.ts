import path from "node:path";
import dotenv from "dotenv";

// Ensure root .env is loaded
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

import express from "express";
import { logger } from "@repo/logger";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";

import * as trpcExpress from "@trpc/server/adapters/express";
import { generateOpenApiDocument, createOpenApiExpressMiddleware } from "trpc-to-openapi";
import { apiReference } from "@scalar/express-api-reference";

import { serverRouter, createContext } from "@repo/trpc/server";

import { env } from "./env";
import { webhookRouter } from "./routes/webhooks";
import { sseRouter } from "./routes/sse";

export const app = express();

const openApiDocument = generateOpenApiDocument(serverRouter, {
  title: "ListingLift OpenAPI",
  version: "1.0.0",
  baseUrl: env.BASE_URL.concat("/api"),
});

if (env.NODE_ENV !== "prod") {
  app.use(
    cors({
      origin: "*",
    }),
  );
}

// Preserve raw body buffer for Clerk and Razorpay webhook signature verification
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf;
    },
  })
);

// Apply Clerk middleware with environment key fallback
const clerkPubKey =
  process.env.CLERK_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (clerkPubKey) {
  try {
    app.use(
      clerkMiddleware({
        publishableKey: clerkPubKey,
        secretKey: process.env.CLERK_SECRET_KEY,
      })
    );
  } catch (e: any) {
    logger.warn("Clerk middleware initialization skipped in dev: " + e.message);
  }
}

// Health & Root status
app.get("/", (_req, res) => {
  return res.json({ message: "ListingLift API is running..." });
});

app.get("/health", (_req, res) => {
  return res.json({ message: "ListingLift server is healthy", healthy: true });
});

// Webhooks
app.use("/webhooks", webhookRouter);

// SSE Text Generation Route
app.use("/api/generate", sseRouter);

// API Documentation
logger.debug(`openapi.json: ${env.BASE_URL}/openapi.json`);
app.get("/openapi.json", (_req, res) => {
  return res.json(openApiDocument);
});

logger.debug(`docs: ${env.BASE_URL}/docs`);
app.use("/docs", apiReference({ url: "/openapi.json" }));

// OpenAPI Express routes
app.use(
  "/api",
  createOpenApiExpressMiddleware({
    router: serverRouter,
    createContext,
  }),
);

// tRPC routes
app.use(
  "/trpc",
  trpcExpress.createExpressMiddleware({
    router: serverRouter,
    createContext,
  }),
);

export default app;
