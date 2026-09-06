import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 是原生模組，必須排除在打包之外
  // （Next 16 已不在 build 時執行 ESLint，僅保留型別檢查）
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
