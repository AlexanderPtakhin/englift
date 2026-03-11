const CACHE_NAME = 'englift-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/style.css',
  '/main.js',
  '/auth.js',
  '/script.js',
  '/api.js',
  '/db.js',
  '/supabase.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Установка — кэшируем основные файлы
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    }),
  );
  self.skipWaiting();
});

// Активация — удаляем старые кэши
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)),
      );
    }),
  );
  self.clients.claim();
});

// Перехват запросов — сначала кэш, потом сеть, с fallback на offline.html
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).catch(() => {
        // Если запрос не удался (офлайн), возвращаем offline.html для навигационных запросов
        if (event.request.mode === 'navigate') {
          return caches.match('/offline.html');
        }
        // Для остальных запросов можно вернуть пустой ответ или ошибку
        return new Response('Offline', {
          status: 503,
          statusText: 'Service Unavailable',
        });
      });
    }),
  );
});
