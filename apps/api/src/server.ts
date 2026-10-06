import path from "node:path";
import dotenv from "dotenv";

// Ensure root .env is loaded
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

import crypto from "node:crypto";
import mongoose from "mongoose";
import express from "express";
import helmet from "helmet";
import { logger } from "@repo/logger";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import { getRedisConnection } from "@repo/services";

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

// Attach a request id to every request (generated, or trusted from an upstream
// proxy's X-Request-Id). Echoing it back in the response header lets you trace a
// single request across the web app, the API logs and your error tracker.
app.use((req, res, next) => {
  const raw = req.headers["x-request-id"];
  const id = typeof raw === "string" && raw.length <= 128 && /^[\w\-.:]+$/.test(raw) ? raw : crypto.randomUUID();
  (req as any).requestId = id;
  res.setHeader("x-request-id", id);
  next();
});

// Secure HTTP headers. CSP is disabled here on purpose: this is a JSON API (the
// Next.js app owns page-level CSP), and the Scalar docs UI at /docs needs inline
// scripts. CORP is set to cross-origin so the web app on another origin can read
// responses normally.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

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
    // Cap the request body. Image uploads go directly to R2 via presigned URLs,
    // so API payloads are always small JSON — 1mb is generous and stops a client
    // from sending a huge body to exhaust memory.
    limit: "1mb",
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

// A real health check: verify the dependencies the server actually needs, so an
// orchestrator (Docker/Caddy/Kubernetes) can restart the process when it's
// genuinely unable to serve. A 200 means "I can do my job"; 503 means "don't
// send me traffic". We time-box the checks so a hung dependency can't hang here.
app.get("/health", async (_req, res) => {
  const withTimeout = <T>(p: Promise<T>, ms = 2000) =>
    Promise.race([
      p,
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
    ]);

  const checks: Record<string, "ok" | "down"> = { mongo: "down", redis: "down" };

  try {
    await withTimeout(mongoose.connection.db!.admin().ping());
    checks.mongo = "ok";
  } catch {
    /* stays "down" */
  }
  try {
    await withTimeout(getRedisConnection().ping());
    checks.redis = "ok";
  } catch {
    /* stays "down" */
  }

  const healthy = checks.mongo === "ok" && checks.redis === "ok";
  return res.status(healthy ? 200 : 503).json({ healthy, checks });
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
