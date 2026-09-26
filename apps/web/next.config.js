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
};

export default nextConfig;
