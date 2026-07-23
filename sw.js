/* ============================================================================
 * CalBingo — service worker
 * Makes the game work offline after the first load: a guest can lose signal
 * and still refresh / reopen the tab. Precaches every asset on install.
 *   • Pages (navigations): network-first, so deployed updates show when online,
 *     with the cached page served when offline.
 *   • Assets (css/js/fonts): cache-first for instant, offline-proof loads.
 * Relative URLs everywhere so it also works from a subdirectory (GitHub Pages).
 * Bump CACHE_VERSION whenever you change any cached file to force a refresh.
 * ==========================================================================*/
const CACHE_VERSION = "calbingo-v25";

const ASSETS = [
  "./",
  "./index.html",
  "./host.html",
  "./manifest.json",
  "./icon.svg",
  "./css/style.css",
  "./css/fonts.css",
  "./js/prompts.js",
  "./js/confetti.js",
  "./js/config.js",
  "./js/store.js",
  "./js/bingo.js",
  "./vendor/qrcode.min.js",
  "./vendor/supabase.min.js",
  "./fonts/dmsans-latin.woff2",
  "./fonts/dmsans-latinext.woff2",
  "./fonts/fraunces-latin.woff2",
  "./fonts/fraunces-latinext.woff2",
  "./fonts/fraunces-italic-latin.woff2",
  "./fonts/fraunces-italic-latinext.woff2",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      // Best-effort: don't let one 404 abort the whole precache.
      .then((cache) => Promise.all(
        ASSETS.map((url) => cache.add(url).catch(() => {}))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Pages: try the network first, fall back to cache when offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("./index.html")))
    );
    return;
  }

  // Assets: serve from cache, fall back to network (and cache the result).
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
