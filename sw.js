// The service worker is served from /pinfolio/, so derive the app base path
// from its own URL instead of assuming the domain root.
const BASE_PATH = new URL(".", self.location.href).pathname;
const CACHE_NAME = "pinfolio-shell-v2";
const APP_SHELL = [
  BASE_PATH,
  `${BASE_PATH}index.html`,
  `${BASE_PATH}pinfolio-icon.svg`,
  `${BASE_PATH}manifest.webmanifest`
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("pinfolio-shell-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never cache API requests or user data.
  if (url.pathname.includes("/rest/") || url.pathname.includes("/auth/") || url.pathname.includes("/functions/")) return;

  event.respondWith(
    fetch(request).then((response) => {
      if (response.ok && (request.destination === "script" || request.destination === "style" || request.destination === "image" || url.pathname === BASE_PATH || url.pathname.endsWith(".html") || url.pathname.endsWith(".webmanifest"))) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    }).catch(async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      if (request.mode === "navigate") {
        return (await caches.match(`${BASE_PATH}index.html`)) || Response.error();
      }
      return Response.error();
    })
  );
});
