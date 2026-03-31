const CACHE_NAME = 'englift-v1054';

// Логирование всех событий SW
const log = (category, message, data = null) => {
  const timestamp = new Date().toLocaleTimeString();
  const prefix = `[${timestamp}] SW ${category}`;

  if (data) {
    console.log(`${prefix}: ${message}`, data);
  } else {
    console.log(`${prefix}: ${message}`);
  }
};

self.addEventListener('message', event => {
  log('MESSAGE', 'Получено сообщение:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    log('MESSAGE', 'SKIP_WAITING - вызываем skipWaiting()');
    self.skipWaiting();
  }
});

self.addEventListener('install', event => {
  log('INSTALL', 'Начинается установка SW');
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      log('INSTALL', 'Кэш открыт');

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

      log('INSTALL', `Добавляем ${staticFiles.length} файлов в кэш`);
      for (const file of staticFiles) {
        try {
          await cache.add(file);
          log('INSTALL', `Файл добавлен в кэш: ${file}`);
        } catch (e) {
          log('INSTALL', `Ошибка добавления файла ${file}:`, e);
        }
      }

      log('INSTALL', 'Вызываем skipWaiting()');
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', event => {
  log('ACTIVATE', 'Активация SW');
  event.waitUntil(
    caches
      .keys()
      .then(keys => {
        log('ACTIVATE', `Найдено кэшей: ${keys.length}`);
        const oldCaches = keys.filter(k => k !== CACHE_NAME);
        log('ACTIVATE', `Удаляем старые кэши: ${oldCaches.length}`);
        return Promise.all(
          oldCaches.map(k => {
            log('ACTIVATE', `Удаляем кэш: ${k}`);
            return caches.delete(k);
          }),
        );
      })
      .then(() => {
        log('ACTIVATE', 'Вызываем clients.claim()');
        return self.clients.claim();
      }),
  );
});

self.addEventListener('fetch', event => {
  const url = event.request.url;
  log('FETCH', `Запрос: ${event.request.method} ${url}`);

  if (event.request.method !== 'GET') {
    log('FETCH', 'Пропускаем не-GET запрос');
    return;
  }

  const urlObj = new URL(event.request.url);

  // Пропускаем API и аудио
  if (
    urlObj.hostname.includes('supabase.co') ||
    urlObj.pathname.startsWith('/audio/') ||
    urlObj.pathname.startsWith('/audio-male/') ||
    urlObj.pathname.startsWith('/audio-idioms/')
  ) {
    log('FETCH', 'Пропускаем API/аудио запрос');
    return;
  }

  // JS и CSS — network-first (всегда свежие)
  if (urlObj.pathname.endsWith('.js') || urlObj.pathname.endsWith('.css')) {
    log('FETCH', 'JS/CSS - network-first');
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
    log('FETCH', 'HTML навигация - network-first');
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
  log('FETCH', 'Остальное - cache-first');
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        log('FETCH', 'Найдено в кэше');
        return cached;
      }
      log('FETCH', 'Не найдено в кэше, делаем запрос');
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
