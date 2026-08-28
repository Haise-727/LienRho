import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle for ECS Fargate (see Dockerfile).
  output: "standalone",
};

export default nextConfig;
