const CACHE_NAME = "dona-shell-v2";

const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./data/caba-ongs.json",
  "./manifest.webmanifest",
  "./favicon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./workspace-bg.jpg",
];

const BYPASS_HOSTS = [
  "script.google.com",
  "script.googleusercontent.com",
  "generativelanguage.googleapis.com",
  "nominatim.openstreetmap.org",
  "drive.google.com",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch(() => {})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (
    BYPASS_HOSTS.some((h) => url.hostname.includes(h)) ||
    (url.hostname === "127.0.0.1" && url.port === "8787") ||
    url.pathname.endsWith("/exec")
  ) {
    return;
  }

  if (url.origin !== self.location.origin) {
    return;
  }

  // Excluir mapa.html explícitamente del fallback SPA de index.html
  if (url.pathname.endsWith("/mapa.html") || url.pathname === "/mapa.html") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put("./index.html", clone));
          }
          return res;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok && res.type === "basic") {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, clone));
        }
        return res;
      });
    })
  );
});
