const CACHE_NAME = 'englift-v2336-05';

// Критическое логирование для важных событий
const log = (category, ...args) => {
  console.log(`[SW:${category}]`, ...args);
};

self.addEventListener('message', event => {
  log('MESSAGE', 'Получено сообщение:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    log('MESSAGE', 'SKIP_WAITING - вызываем skipWaiting()');
    self.skipWaiting();
  }
});

self.addEventListener('install', event => {
  log('INSTALL', '📦 Начинается установка SW');
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      log('INSTALL', 'Кэш открыт');

      // Только статические файлы (словари, офлайн-страница)
      const staticFiles = [
        '/offline.html',
        '/manifest.json',
        '/data-manifest.json',
        '/A1/dict-A1.json',
        '/A2/dict-A2.json',
        '/B1/dict-B1.json',
        '/B2/dict-B2.json',
        '/C1/dict-C1.json',
        '/C2/dict-C2.json',
      ];

      log('INSTALL', `✅ Добавлено ${staticFiles.length} файлов в кэш`);
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
  log('ACTIVATE', '⚡ Активация SW');
  event.waitUntil(
    caches
      .keys()
      .then(keys => {
        log('ACTIVATE', `Найдено кэшей: ${keys.length}`);
        const oldCaches = keys.filter(k => k !== CACHE_NAME);
        log('ACTIVATE', `🗑️ Удалено старых кэшей: ${oldCaches.length}`);
        return Promise.all(
          oldCaches.map(k => {
            log('ACTIVATE', `Удаляем кэш: ${k}`);
            return caches.delete(k);
          }),
        );
      })
      .then(() => {
        log('ACTIVATE', 'Вызываем clients.claim()');
        // Уведомляем все вкладки о новой версии
        return self.clients.matchAll({
          type: 'window',
          includeUncontrolled: true,
        });
      })
      .then(clients => {
        log('ACTIVATE', `Найдено клиентов: ${clients.length}`);
        clients.forEach(client => {
          client.postMessage({ type: 'SW_UPDATED', version: CACHE_NAME });
        });
        return self.clients.claim();
      }),
  );
});

self.addEventListener('fetch', event => {
  const url = event.request.url;

  if (event.request.method !== 'GET') {
    return;
  }

  const urlObj = new URL(event.request.url);

  // Пропускаем API и аудио (только генерируемые аудио)
  if (
    urlObj.hostname.includes('supabase.co') ||
    urlObj.pathname.startsWith('/audio/') ||
    urlObj.pathname.startsWith('/audio-male/') ||
    urlObj.pathname.startsWith('/audio-idioms/') ||
    urlObj.pathname.match(/^\/[A-C][1-2]\/(?:man|women)\//) ||
    urlObj.pathname.startsWith('/idioms/')
  ) {
    return;
  }

  // JS и CSS — network-first (всегда свежие)
  if (urlObj.pathname.endsWith('.js') || urlObj.pathname.endsWith('.css')) {
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
      if (cached) {
        return cached;
      }
      return fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches
              .open(CACHE_NAME)
              .then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(error => {
          console.warn(
            'SW: Ошибка загрузки ресурса:',
            event.request.url,
            error,
          );
          // Возвращаем пустой ответ для аудио файлов, чтобы не ломать приложение
          if (event.request.url.includes('/sound/')) {
            return new Response('', { status: 200, statusText: 'OK' });
          }
          // Для остальных файлов пробуем вернуть из кэша или пустой ответ
          return caches.match(event.request).then(cached => {
            return (
              cached ||
              new Response('', { status: 404, statusText: 'Not Found' })
            );
          });
        });
    }),
  );
});
