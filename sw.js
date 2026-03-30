const CACHE_NAME = 'englift-v00-06';

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      const criticalFiles = [
        '/',
        '/index.html',
        '/login.html',
        '/offline.html',
        '/style.css',
        '/main.js',
        '/script.js',
        '/api.js',
        '/auth.js',
        '/db.js',
        '/tour.js',
        '/manifest.json',
      ];

      const dictionaryFiles = [
        '/dict-A1.json',
        '/dict-A2.json',
        '/dict-B1.json',
        '/dict-B2.json',
        '/dict-C1.json',
        '/dict-C2.json',
      ];

      console.log('📦 SW install: кэшируем критические файлы...');

      // Сначала кэшируем важное (быстро и надёжно)
      for (const file of criticalFiles) {
        try {
          await cache.add(file);
          console.log(`✅ [critical] ${file}`);
        } catch (e) {
          console.warn(`⚠️ Пропущен critical: ${file}`);
        }
      }

      console.log('📦 SW install: кэшируем словари...');

      // Словари кэшируем по одному — если один большой упадёт, остальные всё равно сохранятся
      for (const file of dictionaryFiles) {
        try {
          await cache.add(file);
          console.log(`✅ [dict] ${file}`);
        } catch (e) {
          console.warn(`⚠️ Пропущен словарь (это нормально): ${file}`);
        }
      }

      console.log('✅ SW install завершён успешно');
      await self.skipWaiting(); // Переносим сюда - после кэширования
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

  if (
    event.request.url.includes('supabase.co') ||
    event.request.url.includes('/audio/') ||
    event.request.url.includes('/audio-male/') ||
    event.request.url.includes('/audio-idioms/')
  ) {
    return;
  }

  const url = new URL(event.request.url);

  // Для JS и CSS — сначала сеть (network-first)
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => caches.match(event.request)),
    );
    return;
  }

  // Для остальных (HTML, иконки, JSON) — cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      return (
        cached ||
        fetch(event.request)
          .then(res => {
            if (res && res.status === 200) {
              const clone = res.clone();
              caches
                .open(CACHE_NAME)
                .then(cache => cache.put(event.request, clone));
            }
            return res;
          })
          .catch(() => {
            if (event.request.mode === 'navigate') {
              return caches.match('/offline.html');
            }
            return new Response('Offline', { status: 503 });
          })
      );
    }),
  );
});
