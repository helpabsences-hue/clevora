/*
 * Parcolia service worker.
 * - App files (/_next/static, icons) are cached: the app opens fast and works on a weak network.
 * - Pages and data are NEVER cached (they hold the agency's private data): they always
 *   come from the network; when there is no network, a simple "offline" page is shown.
 */
const VERSION = "parcolia-v1";
const STATIC = `${VERSION}-static`;
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC).then((cache) => cache.addAll([OFFLINE_URL, "/icons/icon-192.png"])).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Pages: network only, offline page when there is no network.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Immutable app files: cache first.
  // Static files and the ID-scan engine (/ocr): cache first, they never change for a build.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/ocr/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC).then((cache) => cache.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
  // Everything else (data, API, images from Supabase…): default network behaviour.
});
