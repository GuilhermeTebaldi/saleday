const CACHE_NAME = 'saleday-cache-v1';
const FILES_TO_CACHE = ['/', '/index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

const shouldSkipCache = (request) => {
  try {
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return true;
    return url.pathname.startsWith('/api');
  } catch {
    return true;
  }
};

const cacheResponse = async (request, response) => {
  if (
    !response ||
    response.status !== 200 ||
    response.type === 'opaque' ||
    request.method !== 'GET'
  ) {
    return response;
  }
  const cache = await caches.open(CACHE_NAME);
  cache.put(request, response.clone());
  return response;
};

const navigationRequest = (event) => {
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => cacheResponse(event.request, networkResponse))
      .catch(() => caches.match(event.request))
  );
};

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  if (event.request.mode === 'navigate') {
    navigationRequest(event);
    return;
  }

  if (shouldSkipCache(event.request)) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }
      return fetch(event.request).then((networkResponse) =>
        cacheResponse(event.request, networkResponse)
      );
    })
  );
});
