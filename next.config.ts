import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/benchmark": ["./benchmarks/results/**/*.json"],
  },
};

export default nextConfig;
