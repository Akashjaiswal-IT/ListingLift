import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

/**
 * Strict SSRF protection: only permit downloads from verified R2 storage domains.
 */
function isAllowedStorageUrl(url: URL): boolean {
  // Must use HTTPS
  if (url.protocol !== "https:") return false;

  const hostname = url.hostname.toLowerCase();

  // Cloudflare R2 default endpoints
  if (hostname.endsWith(".r2.cloudflarestorage.com")) return true;
  if (hostname.endsWith(".r2.dev")) return true;

  // Custom configured R2 public domain (if present in environment)
  const configuredPublic = process.env.R2_PUBLIC_URL;
  if (configuredPublic) {
    try {
      const publicUrl = new URL(configuredPublic);
      if (hostname === publicUrl.hostname.toLowerCase()) return true;
    } catch {
      // ignore invalid env URL
    }
  }

  // Deny all other hosts (blocks localhost, 127.0.0.1, 169.254.169.254 metadata, etc.)
  return false;
}

const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
]);

export async function GET(req: NextRequest) {
  // 1. Authentication Check (requires logged-in user in production)
  try {
    const { userId } = await auth();
    if (process.env.CLERK_SECRET_KEY && !userId) {
      return new NextResponse("Unauthorized: login required to download assets", {
        status: 401,
      });
    }
  } catch {
    // If Clerk is unconfigured in development, proceed gracefully
  }

  const { searchParams } = new URL(req.url);
  const fileUrl = searchParams.get("url");
  const rawFilename = searchParams.get("filename") || "download";

  if (!fileUrl) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  // 2. URL parsing & SSRF validation
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(fileUrl);
  } catch {
    return new NextResponse("Invalid URL format", { status: 400 });
  }

  if (!isAllowedStorageUrl(parsedUrl)) {
    return new NextResponse("Forbidden: storage host not permitted", { status: 403 });
  }

  // 3. Fetch from verified upstream storage
  try {
    const upstreamRes = await fetch(parsedUrl.toString(), {
      // Prevent upstream redirects from escaping to unallowed domains
      redirect: "error",
    });

    if (!upstreamRes.ok) {
      return new NextResponse(`Storage error: ${upstreamRes.status} ${upstreamRes.statusText}`, {
        status: upstreamRes.status,
      });
    }

    const contentType = upstreamRes.headers.get("content-type") || "application/octet-stream";
    const baseType = contentType.split(";")[0]?.trim().toLowerCase() || "";

    // 4. Content-Type verification (only images and zip archives)
    if (!ALLOWED_CONTENT_TYPES.has(baseType)) {
      return new NextResponse("Forbidden content type", { status: 415 });
    }

    // 5. Header injection & Path traversal defense
    const safeFilename = rawFilename
      .replace(/[\r\n\0]/g, "") // Block CRLF header injection
      .replace(/[/\\]/g, "_")   // Block path traversal
      .replace(/[^a-zA-Z0-9._-]/g, "_"); // Whitelist safe chars

    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Content-Disposition", `attachment; filename="${safeFilename}"`);
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");

    const contentLength = upstreamRes.headers.get("content-length");
    if (contentLength) {
      headers.set("Content-Length", contentLength);
    }

    return new NextResponse(upstreamRes.body, {
      status: 200,
      headers,
    });
  } catch (err: any) {
    return new NextResponse(`Download error: ${err?.message || "Unknown error"}`, {
      status: 500,
    });
  }
}
