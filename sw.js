const CACHE_NAME = 'englift-v2';

// Установка — кэшируем ТОЛЬКО offline.html, остальное динамически
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.add('/offline.html')),
  );
  self.skipWaiting();
});

// Активация — удаляем старые кэши
self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

// Перехват запросов — динамический кэш + fallback на offline
self.addEventListener('fetch', event => {
  // Не трогаем не-GET запросы (POST к Supabase и т.д.)
  if (event.request.method !== 'GET') return;

  // Не кэшируем запросы к Supabase API
  if (event.request.url.includes('supabase.co')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request)
        .then(response => {
          // Кэшируем только успешные ответы
          if (response.ok) {
            const clone = response.clone();
            caches
              .open(CACHE_NAME)
              .then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          if (event.request.mode === 'navigate') {
            return caches
              .match('/offline.html')
              .then(
                r =>
                  r ||
                  new Response('Offline', {
                    status: 503,
                    statusText: 'Service Unavailable',
                  }),
              );
          }
          return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable',
          });
        });
    }),
  );
});
