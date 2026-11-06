import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The parent directory is itself a git repository, so Next.js would otherwise
  // infer the workspace root as the home directory and watch the whole thing.
  // Pin the root to this project.
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
  // The floating dev-tools badge in the corner is noise on the shop laptop.
  devIndicators: false,
};

export default nextConfig;
