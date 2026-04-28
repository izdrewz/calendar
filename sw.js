const CACHE_NAME = "focus-week-planner-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./life-admin.css",
  "./app.js",
  "./manifest.webmanifest",
  "./stock.html",
  "./gifts.html",
  "./table-app.js"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
