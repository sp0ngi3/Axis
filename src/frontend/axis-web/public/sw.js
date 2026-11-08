const SHELL_CACHE = 'axis-shell-v2';
const RUNTIME_CACHE = 'axis-runtime-v2';
const APP_SHELL = [
  '/offline.html',
  '/manifest.webmanifest',
  '/axis-icon.svg',
  '/icons/axis-192.png',
  '/icons/axis-512.png',
  '/icons/axis-apple-touch.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(precacheShell());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('axis-') && key !== SHELL_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

async function precacheShell() {
  const cache = await caches.open(SHELL_CACHE);
  await cache.addAll(APP_SHELL);

  const indexResponse = await fetch('/', { cache: 'reload' });
  if (!indexResponse.ok) throw new Error('Axis shell could not be downloaded.');
  const html = await indexResponse.clone().text();
  const assetPaths = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)]
    .map((match) => match[1]);

  await cache.put('/', indexResponse);
  await cache.addAll(assetPaths);
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Axis records must always go directly to the API and SQLite. Never cache API reads or writes.
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  event.respondWith(cacheFirstAsset(request));
});

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put('/', response.clone());
    }
    return response;
  } catch {
    return await caches.match('/') || await caches.match('/offline.html');
  }
}

async function cacheFirstAsset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}
