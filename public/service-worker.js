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

  const url = new URL(event.request.url);

  // Navegação SPA: sempre network-first (e cacheia o index)
  if (event.request.mode === 'navigate') {
    navigationRequest(event);
    return;
  }

  // API / backend: network-first para não travar curtidas, favoritos, etc.
  const isApiRequest =
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/products') ||
    url.pathname.startsWith('/favorites');

  if (isApiRequest) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => cacheResponse(event.request, networkResponse))
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Demais arquivos estáticos (CSS, JS, imagens): cache-first
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
