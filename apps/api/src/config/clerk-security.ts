import { logger } from "@repo/logger";

export interface ClerkSecurityConfig {
  publishableKey: string;
  secretKey: string;
  webhookSecret?: string;
  isProduction: boolean;
}

/**
 * Validates that Clerk credentials match the current execution environment (development vs production)
 * to strictly prevent key cross-contamination and security vulnerabilities.
 */
export function validateClerkEnvironment(nodeEnv: string = process.env.NODE_ENV || "development"): ClerkSecurityConfig {
  const isProduction = nodeEnv === "production" || nodeEnv === "prod";

  const publishableKey =
    process.env.CLERK_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    "";

  const secretKey = process.env.CLERK_SECRET_KEY || "";
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

  // In production, keys MUST be provided and MUST be live keys
  if (isProduction) {
    if (!publishableKey) {
      throw new Error(
        "[SECURITY CRITICAL] CLERK_PUBLISHABLE_KEY (or NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) is required in production."
      );
    }

    if (!secretKey) {
      throw new Error(
        "[SECURITY CRITICAL] CLERK_SECRET_KEY is required in production."
      );
    }

    // STRICT ENVIRONMENT SEPARATION: Disallow test keys in production
    if (publishableKey.startsWith("pk_test_")) {
      throw new Error(
        "[SECURITY VIOLATION] Attempting to run with a Clerk TEST key (pk_test_...) in PRODUCTION environment. " +
        "You must configure live production keys (pk_live_...) to avoid mixing development and production user data."
      );
    }

    if (secretKey.startsWith("sk_test_")) {
      throw new Error(
        "[SECURITY VIOLATION] Attempting to run with a Clerk TEST secret key (sk_test_...) in PRODUCTION environment. " +
        "You must configure live production keys (sk_live_...) to prevent unauthorized security bypass."
      );
    }

    if (!publishableKey.startsWith("pk_live_")) {
      throw new Error(
        "[SECURITY WARNING] Production Clerk Publishable Key should start with 'pk_live_'. Please verify your Clerk production dashboard."
      );
    }

    if (!secretKey.startsWith("sk_live_")) {
      throw new Error(
        "[SECURITY WARNING] Production Clerk Secret Key should start with 'sk_live_'. Please verify your Clerk production dashboard."
      );
    }

    if (webhookSecret && !webhookSecret.startsWith("whsec_")) {
      logger.warn(
        "[SECURITY WARNING] CLERK_WEBHOOK_SECRET in production does not start with 'whsec_'. Ensure this is a valid Svix secret."
      );
    }

    logger.info("Clerk Production Security Configuration validated successfully (Live Keys Active).");
  } else {
    // In development / test mode
    if (publishableKey.startsWith("pk_live_") || secretKey.startsWith("sk_live_")) {
      throw new Error(
        "[SECURITY ALERT] Detected Clerk LIVE PRODUCTION key in DEVELOPMENT environment! " +
        "Running local code with production keys will modify live customer data. " +
        "Please use test keys (pk_test_... / sk_test_...) for local development."
      );
    }

    logger.debug("Clerk Development Security Configuration validated (Test Keys Active).");
  }

  return {
    publishableKey,
    secretKey,
    webhookSecret,
    isProduction,
  };
}
