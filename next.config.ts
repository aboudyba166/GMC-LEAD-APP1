import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  /** Managed hosts (e.g. Hostinger Node) */
  poweredByHeader: false,
};

export default nextConfig;
