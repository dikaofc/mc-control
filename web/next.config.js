/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Produce a single Node server file for container/standalone deploys.
  output: 'standalone',
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  // The dashboard talks to the manager API set via NEXT_PUBLIC_MANAGER_URL.
  // On Railway set NEXT_PUBLIC_MANAGER_URL to the manager service's URL.
};

module.exports = nextConfig;
