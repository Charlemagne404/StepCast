const CACHE_NAME = "pwa-cache-v5";
const APP_SHELL_URLS = [
    "./",
    "./index.html",
    "./style.css",
    "./script.js",
    "./map.js",
    "./storageHandler.js",
    "./spotifyfetch.js",
    "./data.js",
    "./cookies.js",
    "./manifest.json",
    "./privacy-policy.html",
    "./icons/192_logo.png",
    "./icons/512_logo.png",
    "./icons/undo-circular-arrow.png",
];

self.addEventListener("install", (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL_URLS)),
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil((async () => {
        const cacheNames = await caches.keys();
        await Promise.all(
            cacheNames
                .filter((cacheName) => cacheName !== CACHE_NAME)
                .map((cacheName) => caches.delete(cacheName)),
        );
        await self.clients.claim();
    })());
});

self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") {
        return;
    }

    const requestUrl = new URL(event.request.url);
    if (requestUrl.origin !== self.location.origin) {
        return;
    }

    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);

        try {
            const networkResponse = await fetch(event.request);
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
        } catch (error) {
            const cachedResponse = await cache.match(event.request);
            if (cachedResponse) {
                return cachedResponse;
            }

            if (event.request.mode === "navigate") {
                const appShellFallback = await cache.match("./index.html");
                if (appShellFallback) {
                    return appShellFallback;
                }
            }

            throw error;
        }
    })());
});
