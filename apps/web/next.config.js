/** @type {import('next').NextConfig} */
const nextConfig = {
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
