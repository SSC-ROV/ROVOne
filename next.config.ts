import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // The Work page was renamed to Tasks; keep old bookmarks and links working.
    return [{ source: "/work", destination: "/tasks", permanent: true }];
  },
};

export default nextConfig;
