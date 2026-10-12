// Public host for generated images (the assets Worker or a custom domain).
const publicAssetHost = (() => {
  try {
    return process.env.R2_PUBLIC_URL ? new URL(process.env.R2_PUBLIC_URL).hostname : null;
  } catch {
    return null;
  }
})();

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.r2.dev',
      },
      {
        protocol: 'https',
        hostname: '**.cloudflarestorage.com',
      },
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
      },
      {
        protocol: 'https',
        hostname: 'images.clerk.dev',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      ...(publicAssetHost ? [{ protocol: /** @type {const} */ ('https'), hostname: publicAssetHost }] : []),
    ],
  },
  async redirects() {
    return [
      { source: '/dashboard', destination: '/app/dashboard', permanent: true },
      { source: '/generate', destination: '/app/generate', permanent: true },
      { source: '/history', destination: '/app/history', permanent: true },
      { source: '/credits', destination: '/app/credits', permanent: true },
      { source: '/profile', destination: '/app/profile', permanent: true },
      { source: '/listing/:id', destination: '/app/listing/:id', permanent: true },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
