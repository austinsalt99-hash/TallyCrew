import { defaultCache } from "@serwist/next/worker";
import { NetworkFirst, CacheableResponsePlugin, ExpirationPlugin, Serwist } from "serwist";
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

// Employee-facing routes we make available offline (last-known page shell +
// data). Everything else — admin, auth, marketing — is intentionally left to
// the browser's normal network handling.
const NAV_PATHS = new Set(["/", "/dashboard", "/schedule", "/profile", "/settings"]);
const API_PATHS = new Set(["/api/me", "/api/events", "/api/log-config", "/api/submissions/employee"]);

const runtimeCaching: RuntimeCaching[] = [
  {
    matcher: ({ request, url }) => request.mode === "navigate" && NAV_PATHS.has(url.pathname),
    handler: new NetworkFirst({
      cacheName: "pages-cache",
      networkTimeoutSeconds: 4,
      plugins: [new CacheableResponsePlugin({ statuses: [200] })],
    }),
  },
  {
    // Query strings are preserved as distinct cache keys by default, which is
    // what we want here — /api/events?from=A&to=B and ?from=C&to=D are
    // legitimately different data, not the same resource.
    matcher: ({ request, url }) => request.method === "GET" && API_PATHS.has(url.pathname),
    handler: new NetworkFirst({
      cacheName: "api-cache",
      networkTimeoutSeconds: 4,
      plugins: [
        new CacheableResponsePlugin({ statuses: [200] }),
        // Sized for the offline preload: about a month of weeks and month views,
        // each stored once per URL. Entries expire after 35 days unless refreshed.
        new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 35 }),
      ],
    }),
  },
  ...defaultCache,
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching,
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();
