/**
 * PostHog AI Observability Telemetry
 * Captures LLM calls (OpenAI, Gemini) with input, output, tokens, and latency.
 * Completely non-blocking and fail-safe.
 */

export interface TrackAIGenerationParams {
  provider: "openai" | "gemini";
  model: string;
  input: unknown;
  output: unknown;
  inputTokens?: number;
  outputTokens?: number;
  latencySeconds: number;
  distinctId?: string;
  traceId?: string;
  isError?: boolean;
  errorMessage?: string;
}

export function trackAIGeneration(params: TrackAIGenerationParams): void {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY || process.env.POSTHOG_API_KEY;
  if (!apiKey || apiKey.includes("placeholder") || apiKey.includes("YOUR_POSTHOG_KEY")) {
    return;
  }

  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || process.env.POSTHOG_HOST || "https://us.i.posthog.com";

  try {
    // Non-blocking fire-and-forget fetch to PostHog's capture API
    fetch(`${host.replace(/\/$/, "")}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        event: "$ai_generation",
        distinct_id: params.distinctId || "system",
        timestamp: new Date().toISOString(),
        properties: {
          $ai_provider: params.provider,
          $ai_model: params.model,
          $ai_input: params.input,
          $ai_output_choices: Array.isArray(params.output)
            ? params.output
            : [
                {
                  role: "assistant",
                  content:
                    typeof params.output === "string"
                      ? params.output
                      : JSON.stringify(params.output),
                },
              ],
          $ai_input_tokens: params.inputTokens ?? 0,
          $ai_output_tokens: params.outputTokens ?? 0,
          $ai_latency: params.latencySeconds,
          $ai_trace_id: params.traceId,
          $ai_is_error: !!params.isError,
          ...(params.errorMessage ? { $ai_error: params.errorMessage } : {}),
        },
      }),
    }).catch(() => {
      // Silently ignore any network issues so user flow is never interrupted
    });
  } catch {
    // Completely fail-safe
  }
}
