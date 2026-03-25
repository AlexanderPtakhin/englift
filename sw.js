const CACHE_NAME = 'englift-v11';

// Обработка команды на немедленную активацию
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Установка — кэшируем основные файлы для офлайн-работы
self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cache =>
        cache.addAll([
          '/offline.html',
          '/index.html',
          '/style.css',
          '/main.js',
          '/script.js',
          '/api.js',
          '/auth.js',
          '/db.js',
          '/manifest.json',
          '/icons/icon-192.png',
          '/icons/icon-512.png',
        ]),
      ),
  );
  self.skipWaiting();
});

// Активация — удаляем старые кэши
self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => {
        return Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => {
              return caches.delete(key);
            }),
        );
      })
      .then(() => {
        // Немедленно захватываем контроль над всеми клиентами (вкладками)
        return self.clients.claim();
      }),
  );
});

// Перехват запросов — динамический кэш + fallback на offline
self.addEventListener('fetch', event => {
  // Не трогаем не-GET запросы (POST к Supabase и т.д.)
  if (event.request.method !== 'GET') return;

  // Не кэшируем запросы к Supabase API
  if (event.request.url.includes('supabase.co')) return;

  // Не кэшируем аудиофайлы
  if (
    event.request.url.includes('/audio/') ||
    event.request.url.includes('/audio-male/') ||
    event.request.url.includes('/audio-idioms/')
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request)
        .then(response => {
          // Кэшируем только успешные ответы и не кэшируем частичные ответы (status 206)
          if (response.ok && response.status !== 206) {
            const clone = response.clone();
            caches
              .open(CACHE_NAME)
              .then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          if (event.request.mode === 'navigate') {
            return caches.match('/offline.html').then(
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
