import type { NextConfig } from "next";

// Next evaluates this file before it loads .env, so load it here. Built into Node.
try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local in CI or on Vercel - the platform supplies the variables
}

// The dev server is reached through Caddy under a real domain, not localhost.
const devOrigins = (process.env.DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  allowedDevOrigins: devOrigins,

  // Stops Next writing AGENTS.md and CLAUDE.md into the repo on every dev run.
  agentRules: false,

  // restiq-web#304: the Windows hub till runs a standalone build pointed at
  // its own local POS service via RESTIQ_API_URL, set at start - not build.
  // Opt-in, so the Vercel build is exactly as before.
  ...(process.env.RESTIQ_STANDALONE === "1" && { output: "standalone" as const }),
};

export default nextConfig;
