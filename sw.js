const CACHE_NAME = 'enguply-v2-3dff7ffb';

// Критическое логирование для важных событий
const log = (category, ...args) => {
  console.log(`[SW:${category}]`, ...args);
};

const logError = (category, ...args) => {
  console.error(`[SW:${category}]`, ...args);
};

const logCache = (action, url, result) => {
  console.log(`[SW:CACHE] ${action}: ${url} → ${result}`);
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
  log('INSTALL', `CACHE_NAME: ${CACHE_NAME}`);
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      log('INSTALL', '📂 Кэш открыт, добавляем файлы');
      return cache.addAll([
        '/offline.html',
        '/manifest.json',
      ]).then(() => {
        log('INSTALL', '✅ Файлы успешно добавлены в кэш');
      }).catch(error => {
        logError('INSTALL', '❌ Ошибка добавления файлов:', error);
      });
    })
  );
  log('INSTALL', '🚀 Вызываем skipWaiting()');
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  log('ACTIVATE', '⚡ Активация SW');
  log('ACTIVATE', `CACHE_NAME: ${CACHE_NAME}`);
  event.waitUntil(
    caches
      .keys()
      .then(keys => {
        log('ACTIVATE', `🔍 Найдено кэшей: ${keys.length}`);
        log('ACTIVATE', `Список кэшей:`, keys);
        const oldCaches = keys.filter(k => k !== CACHE_NAME);
        log('ACTIVATE', `🗑️ Старые кэши для удаления: ${oldCaches.length}`, oldCaches);
        return Promise.all(
          oldCaches.map(k => {
            log('ACTIVATE', `Удаляем кэш: ${k}`);
            return caches.delete(k);
          }),
        );
      })
      .then(() => {
        log('ACTIVATE', '✅ Удаление старых кэшей завершено');
        log('ACTIVATE', '📡 Уведомляем клиентов');
        return self.clients.matchAll({
          type: 'window',
          includeUncontrolled: true,
        });
      })
      .then(clients => {
        log('ACTIVATE', `👥 Найдено клиентов: ${clients.length}`);
        clients.forEach(client => {
          log('ACTIVATE', `📤 Отправляем сообщение клиенту: ${client.url}`);
          client.postMessage({ type: 'SW_UPDATED', version: CACHE_NAME });
        });
        log('ACTIVATE', '🎯 Вызываем clients.claim()');
        return self.clients.claim();
      }),
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    log('FETCH', `⏭️ Пропускаем не-GET запрос: ${request.method} ${url.pathname}`);
    return;
  }

  log('FETCH', `📥 Запрос: ${url.pathname}`);

  // 1. Supabase / API — всегда сеть (без SW-кеша)
  if (
    url.pathname.startsWith('/rest/v1/') ||
    url.pathname.startsWith('/auth/v1/') ||
    url.pathname.startsWith('/realtime/v1/') ||
    url.pathname.startsWith('/storage/v1/') ||
    url.pathname.startsWith('/functions/v1/')
  ) {
    log('FETCH', `🔗 API запрос, пропускаем без кеширования: ${url.pathname}`);
    return;
  }

  // 2. data-manifest.json — ВСЕГДА сеть (он маленький, это источник правды о версиях)
  if (url.pathname === '/data-manifest.json') {
    log('FETCH', `📋 Data-manifest, всегда из сети: ${url.pathname}`);
    event.respondWith(fetch(request, { cache: 'no-store' }));
    return;
  }

  // 3. Словари (dict-*.json) — cache-first с фоновым обновлением
  if (url.pathname.match(/^\/[A-C][1-2]\/dict-.*\.json$/)) {
    log('FETCH', `📚 Словарь, cache-first с фоновым обновлением: ${url.pathname}`);
    event.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        const cached = await cache.match(request);
        if (cached) {
          logCache('CACHED', url.pathname, '✅ Взято из кеша');
        } else {
          logCache('CACHED', url.pathname, '❌ Не в кеше, загрузка из сети');
        }
        
        // Параллельно обновляем в фоне
        fetch(request, { cache: 'no-store' }).then(response => {
          if (response.status === 200) {
            logCache('UPDATE', url.pathname, '🔄 Обновлено в фоне');
            cache.put(request, response.clone());
          } else {
            logError('UPDATE', url.pathname, `❌ Ошибка обновления: ${response.status}`);
          }
        }).catch(error => {
          logError('UPDATE', url.pathname, `❌ Ошибка сети: ${error.message}`);
        });
        
        return cached || fetch(request, { cache: 'no-store' });
      })
    );
    return;
  }

  // 4. Истории (story/*.json) — cache-first с фоновым обновлением
  if (url.pathname.startsWith('/story/')) {
    log('FETCH', `📖 История, cache-first с фоновым обновлением: ${url.pathname}`);
    event.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        const cached = await cache.match(request);
        if (cached) {
          logCache('CACHED', url.pathname, '✅ Взято из кеша');
        } else {
          logCache('CACHED', url.pathname, '❌ Не в кеше, загрузка из сети');
        }
        
        // Параллельно обновляем в фоне
        fetch(request, { cache: 'no-store' }).then(response => {
          if (response.status === 200) {
            logCache('UPDATE', url.pathname, '🔄 Обновлено в фоне');
            cache.put(request, response.clone());
          } else {
            logError('UPDATE', url.pathname, `❌ Ошибка обновления: ${response.status}`);
          }
        }).catch(error => {
          logError('UPDATE', url.pathname, `❌ Ошибка сети: ${error.message}`);
        });
        
        return cached || fetch(request, { cache: 'no-store' });
      })
    );
    return;
  }

  // 5. Глаголы — network-first (они меньше и чаще меняются)
  if (url.pathname.includes('/verb/')) {
    log('FETCH', `🔤 Глаголы, network-first: ${url.pathname}`);
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            logCache('SAVE', url.pathname, '💾 Сохранено в кеш');
            cache.put(request, clone);
          });
          return response;
        })
        .catch(() => {
          logCache('FALLBACK', url.pathname, '🔄 Попытка взять из кеша');
          return caches.match(request);
        })
    );
    return;
  }

  // 6. Пропускаем аудио (story аудио и генерируемые)
  if (
    url.pathname.startsWith('/audio/') ||
    url.pathname.startsWith('/audio-male/') ||
    url.pathname.match(/^\/[A-C][1-2]\/(?:man|women)\//)
  ) {
    log('FETCH', `🎵 Аудио, пропускаем без кеширования: ${url.pathname}`);
    return;
  }

  // 7. Остальные JSON — network-first
  if (url.pathname.endsWith('.json')) {
    log('FETCH', `📄 JSON файл, network-first: ${url.pathname}`);
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            logCache('SAVE', url.pathname, '💾 Сохранено в кеш');
            cache.put(request, clone);
          });
          return response;
        })
        .catch(() => {
          logCache('FALLBACK', url.pathname, '🔄 Попытка взять из кеша');
          return caches.match(request);
        })
    );
    return;
  }

  // 8. JS/CSS — для хешированных файлов cache-first, для остальных network-first
  if (
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css')
  ) {
    // Проверяем есть ли хеш в имени файла (например ENG.9a88c94c.js)
    const hasHash = /\.[a-f0-9]{8,}\.(js|css)$/i.test(url.pathname);
    
    if (hasHash) {
      // Хешированные файлы - cache-first
      log('FETCH', `🎨 Хешированный JS/CSS, cache-first: ${url.pathname}`);
      event.respondWith(
        caches.open(CACHE_NAME).then(async cache => {
          const cached = await cache.match(request);
          if (cached) {
            logCache('CACHED', url.pathname, '✅ Взято из кеша');
            return cached;
          }
          logCache('NETWORK', url.pathname, '🌐 Загрузка из сети');
          const response = await fetch(request);
          if (response.ok) {
            await cache.put(request, response.clone());
            logCache('SAVE', url.pathname, '💾 Сохранено в кеш');
          }
          return response;
        })
      );
    } else {
      // Файлы без хеша - network-first
      log('FETCH', `🎨 JS/CSS файл без хеша, network-first: ${url.pathname}`);
      event.respondWith(
        fetch(request, { cache: 'no-store' })
          .catch(() => {
            logCache('FALLBACK', url.pathname, '🔄 Попытка взять из кеша');
            return caches.match(request);
          })
      );
    }
    return;
  }

  // 9. HTML (навигация) — network-first (выше картинок, чтобы корневой путь обрабатывался правильно)
  if (request.mode === 'navigate' || url.pathname === '/') {
    log('FETCH', `🌐 HTML навигация, network-first: ${url.pathname}`);
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .catch(() => {
          logCache('OFFLINE', url.pathname, '📴 Офлайн режим, показываем offline.html');
          return caches.match('/offline.html');
        })
    );
    return;
  }

  // 10. Картинки, шрифты — cache-first
  log('FETCH', `🖼️ Картинка/шрифт, cache-first: ${url.pathname}`);
  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      const cached = await cache.match(request);
      if (cached) {
        logCache('CACHED', url.pathname, '✅ Взято из кеша');
        return cached;
      }
      logCache('NETWORK', url.pathname, '🌐 Загрузка из сети');
      try {
        const response = await fetch(request);
        if (response.ok) {
          await cache.put(request, response.clone());
          logCache('SAVE', url.pathname, '💾 Сохранено в кеш');
        }
        return response;
      } catch (error) {
        logCache('ERROR', url.pathname, '❌ Ошибка загрузки');
        return new Response('Error', { status: 500 });
      }
    })
  );
});
