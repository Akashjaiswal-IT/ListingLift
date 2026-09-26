import { httpLink, httpBatchStreamLink } from "@repo/trpc/client";
import { env } from "~/env.js";

interface CreateTRPCHttpBatchClientClientOpts {
  enableStreaming?: boolean;
}

export const createTRPCHttpBatchClientClient = (opts?: CreateTRPCHttpBatchClientClientOpts) => {
  const c = opts?.enableStreaming ? httpBatchStreamLink : httpLink;
  return c({
    url: env.NEXT_PUBLIC_API_URL ?? "/trpc",
    async fetch(url, options) {
      const headers = new Headers(options?.headers);
      if (typeof window !== "undefined" && (window as any).Clerk?.session) {
        try {
          const token = await (window as any).Clerk.session.getToken();
          if (token) {
            headers.set("Authorization", `Bearer ${token}`);
          }
        } catch {}
      }

      return fetch(url, {
        ...options,
        headers,
        credentials: "include",
      });
    },
  });
};
