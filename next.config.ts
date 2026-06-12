import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root so Turbopack does not infer the parent directory
  // (which contains an unrelated lockfile) as the project root.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
