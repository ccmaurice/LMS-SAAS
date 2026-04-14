/**
 * Minimal service worker so Chrome/Edge can treat the site as an installable PWA.
 * Pass-through fetch only (no offline cache) — avoids stale Next.js chunks during navigation.
 */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
