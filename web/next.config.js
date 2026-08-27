/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Static export: the dashboard is 100% client-side (fetches the manager API),
  // so it builds to plain HTML/JS — ideal for serving from the manager container.
  output: 'export',
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  // The dashboard talks to the manager API set via NEXT_PUBLIC_MANAGER_URL.
  // In combined (same-origin) mode leave it empty to use relative paths.
  images: { unoptimized: true },
};

module.exports = nextConfig;

