/**
 * DebtRadar Service Worker
 * Cache-first strategy for static assets, network-first for API calls.
 */

const CACHE_NAME = "debtradar-v1";

// Assets to pre-cache on install
const PRECACHE_URLS = [
  "/",
  "/manifest.json",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
];

// Install event: pre-cache core assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  // Activate immediately without waiting for reload
  self.skipWaiting();
});

// Activate event: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  // Take control of all clients immediately
  self.clients.claim();
});

// Fetch event: cache-first for static, network-first for API
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API calls: network-first with cache fallback
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Vite assets (hashed filenames): cache-first
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Static assets: cache-first
  if (
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "font" ||
    request.destination === "image"
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Main document: network-first (always fresh) with cache fallback for offline
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // If fetch fails and not in cache, return offline fallback
    if (request.destination === "document") {
      return caches.match("/");
    }
    throw error;
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;

    // For navigation requests, serve cached homepage
    if (request.mode === "navigate") {
      return caches.match("/");
    }

    throw error;
  }
}
