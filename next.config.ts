import type { NextConfig } from "next";

// Sub-path deployment (e.g. https://bianlianfangjiwen.top/worldcup).
// Set NEXT_PUBLIC_BASE_PATH at build time; empty string keeps local dev at root.
// This value is inlined into the client bundle, so it must be set before `next build`.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  basePath: basePath || undefined,
  // Self-contained production build (.next/standalone/server.js) — no node_modules
  // install needed on the server.
  output: "standalone",
  // Ensure the value is available to client code (also auto-inlined via NEXT_PUBLIC_ prefix).
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
