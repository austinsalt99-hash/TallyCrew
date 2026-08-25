import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

// `next dev` runs on Turbopack by default, which hard-errors if the config
// object has a `webpack` key at all — withSerwistInit() always attaches one,
// so it can't just be passed `disable: true`, it has to be skipped entirely
// in dev (not just its result left unused — calling withSerwistInit() itself
// also logs a Turbopack warning). Production builds run via
// `next build --webpack` (see package.json).
const isDev = process.env.NODE_ENV === "development";

function withOfflineSupport(config: NextConfig): NextConfig {
  if (isDev) return config;
  const withSerwist = withSerwistInit({
    swSrc: "src/app/sw.ts",
    swDest: "public/sw.js",
    cacheOnNavigation: true,
    reloadOnOnline: false,
    additionalPrecacheEntries: [
      { url: "/~offline", revision: process.env.VERCEL_GIT_COMMIT_SHA ?? Date.now().toString() },
    ],
  });
  return withSerwist(config);
}

export default withOfflineSupport(nextConfig);
