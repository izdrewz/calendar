const CACHE_NAME = "focus-week-planner-v14-mock-layout";
const ASSETS = [
  "./",
  "./index.html",
  "./planner.html",
  "./safe.html",
  "./update.html",
  "./styles.css",
  "./life-admin.css",
  "./planner-compact.css",
  "./planner-mock-layout.css",
  "./app.js",
  "./planner-piles.js",
  "./planner-compact.js",
  "./planner-mock-layout.js",
  "./ics-export-safe.js",
  "./manifest.webmanifest",
  "./stock.html",
  "./gifts.html",
  "./table-app.js"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.searchParams.has("fresh")) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }
  event.respondWith(fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request)));
});
