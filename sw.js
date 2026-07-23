/* ============================================================================
 * CalBingo — service worker
 * Makes the game work offline after the first load: a guest can lose signal
 * and still refresh / reopen the tab. Precaches every asset on install.
 *   • Everything we serve is NETWORK-FIRST: an online visitor always gets the
 *     freshest deploy (no more stale cached code after a push), and the cached
 *     copy is served only as an offline fallback.
 *   • Cross-origin requests (e.g. Supabase) pass straight through, untouched.
 * Relative URLs everywhere so it also works from a subdirectory (GitHub Pages).
 * Bump CACHE_VERSION whenever you change any cached file to force a refresh.
 * ==========================================================================*/
const CACHE_VERSION = "calbingo-v27";

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

  // Only manage our own origin; let cross-origin (e.g. Supabase) go to network.
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Network-first: online always gets the latest deploy; cache is the offline
  // fallback (and, for a navigation offline, the app shell).
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((r) => r || (req.mode === "navigate" ? caches.match("./index.html") : Response.error()))
      )
  );
});
