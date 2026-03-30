const CACHE_NAME = 'englift-v00-09';

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // Только статические файлы (словари, офлайн-страница)
      const staticFiles = [
        '/offline.html',
        '/manifest.json',
        '/dict-A1.json',
        '/dict-A2.json',
        '/dict-B1.json',
        '/dict-B2.json',
        '/dict-C1.json',
        '/dict-C2.json',
      ];
      for (const file of staticFiles) {
        try {
          await cache.add(file);
        } catch (e) {}
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Пропускаем API и аудио
  if (
    url.hostname.includes('supabase.co') ||
    url.pathname.startsWith('/audio/') ||
    url.pathname.startsWith('/audio-male/') ||
    url.pathname.startsWith('/audio-idioms/')
  ) {
    return;
  }

  // JS и CSS — network-first (всегда свежие)
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches
            .open(CACHE_NAME)
            .then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request)),
    );
    return;
  }

  // HTML (навигация) — network-first
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches
            .open(CACHE_NAME)
            .then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match('/offline.html')),
    );
    return;
  }

  // Остальное (шрифты, картинки, JSON) — cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches
            .open(CACHE_NAME)
            .then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    }),
  );
});
