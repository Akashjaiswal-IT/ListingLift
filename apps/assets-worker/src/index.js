// Serves generated studio images and social cards from the R2 bucket at
// permanent public URLs (no expiring signatures), e.g.
//   https://peshkar-assets.<account>.workers.dev/generated/<listingId>/studio_1_….webp
//
// Only these prefixes are public. Everything else (user uploads, Excel exports,
// ZIP bundles) returns 404 so private files can't be fetched by guessing keys.
const PUBLIC_PREFIXES = ["generated/", "cards/"];

// Keys include a timestamp and are never overwritten (a re-edit or re-render
// writes a new key), so responses can be cached forever.
const CACHE_CONTROL = "public, max-age=31536000, immutable";

function notFound() {
  return new Response("Not found", { status: 404, headers: { "cache-control": "public, max-age=60" } });
}

export default {
  /**
   * @param {Request} request
   * @param {{ ASSETS: R2Bucket }} env
   * @param {ExecutionContext} ctx
   */
  async fetch(request, env, ctx) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD" } });
    }

    const url = new URL(request.url);
    let key;
    try {
      key = decodeURIComponent(url.pathname.slice(1));
    } catch {
      return notFound();
    }
    if (!PUBLIC_PREFIXES.some((p) => key.startsWith(p)) || key.includes("..")) {
      return notFound();
    }

    // Edge cache first so popular images don't hit R2 on every view.
    const cache = caches.default;
    const cacheKey = new Request(url.origin + url.pathname, { method: "GET" });
    if (request.method === "GET") {
      const cached = await cache.match(cacheKey);
      if (cached) return cached;
    }

    const object = await env.ASSETS.get(key, { onlyIf: request.headers });
    if (object === null) return notFound();

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("cache-control", CACHE_CONTROL);
    headers.set("access-control-allow-origin", "*");

    // Conditional request matched (If-None-Match / If-Modified-Since): no body.
    if (!("body" in object) || !object.body) {
      return new Response(null, { status: 304, headers });
    }

    if (request.method === "HEAD") {
      headers.set("content-length", String(object.size));
      return new Response(null, { status: 200, headers });
    }

    const response = new Response(object.body, { status: 200, headers });
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  },
};
