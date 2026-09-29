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

import { validateClerkEnvironment } from "./config/clerk-security";

export const app = express();

// Validate Clerk configuration and ensure strict environment separation (no dev/prod mix-up)
const clerkConfig = validateClerkEnvironment(env.NODE_ENV);

const openApiDocument = generateOpenApiDocument(serverRouter, {
  title: "Peshkar AI OpenAPI",
  version: "1.0.0",
  baseUrl: env.BASE_URL.concat("/api"),
});

// Production-hardened CORS
const allowedOriginsList = [
  env.FRONTEND_URL,
  ...(env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()) : []),
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile clients, curl, server-to-server webhooks)
      if (!origin) return callback(null, true);

      if (env.NODE_ENV === "development" || env.NODE_ENV === "test") {
        // In local development, permit localhost, loopback, and local tunnels
        if (
          origin.startsWith("http://localhost:") ||
          origin.startsWith("http://127.0.0.1:") ||
          origin.includes(".loca.lt") ||
          origin.includes(".trycloudflare.com")
        ) {
          return callback(null, true);
        }
      }

      // In production, strictly match against whitelist
      if (allowedOriginsList.includes(origin)) {
        return callback(null, true);
      }

      logger.warn(`[SECURITY] Blocked CORS request from unauthorized origin: ${origin}`);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// Preserve raw body buffer for Clerk and Razorpay webhook signature verification
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf;
    },
  })
);

// Apply Clerk middleware with environment key validation
if (clerkConfig.publishableKey) {
  app.use(
    clerkMiddleware({
      publishableKey: clerkConfig.publishableKey,
      secretKey: clerkConfig.secretKey,
    })
  );
} else if (clerkConfig.isProduction) {
  throw new Error("[SECURITY CRITICAL] Clerk middleware cannot start in production without credentials.");
}

// Health & Root status
app.get("/", (_req, res) => {
  return res.json({ message: "Peshkar AI API is running..." });
});

app.get("/health", (_req, res) => {
  return res.json({ message: "Peshkar AI server is healthy", healthy: true });
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
