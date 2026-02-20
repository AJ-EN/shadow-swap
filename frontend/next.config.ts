import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      ws: false,
    };
    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      ws: false,
    };
    return config;
  },
};

export default nextConfig;
