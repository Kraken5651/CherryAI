import type { NextConfig } from "next";

import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
