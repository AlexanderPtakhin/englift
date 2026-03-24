// Service Worker для агрессивного кеширования
const CACHE_NAME = 'englift-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/main.js',
  '/script.js',
  '/fonts/material-symbols-outlined.woff2',
  '/icons/icon-192x192.png'
];

const DYNAMIC_CACHE = 'englift-dynamic-v1';

// Установка SW и кеширование статических ресурсов
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Кеширование статических ресурсов...');
        return cache.addAll(STATIC_ASSETS);
      })
  );
});

// Стратегия кеширования: Cache First для статических, Network First для данных
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Статические ресурсы - Cache First
  if (STATIC_ASSETS.includes(url.pathname) || 
      url.pathname.startsWith('/fonts/') || 
      url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          return response || fetch(event.request);
        })
    );
    return;
  }
  
  // JSON данные - Network First с кешированием
  if (url.pathname.endsWith('.json')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Кешируем успешные ответы
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE)
              .then(cache => cache.put(event.request, responseClone));
          }
          return response;
        })
        .catch(() => {
          // При ошибке сети пробуем достать из кеша
          return caches.match(event.request);
        })
    );
    return;
  }
  
  // API запросы - Network Only (не кешируем)
  if (url.pathname.startsWith('/api/') || url.pathname.includes('supabase')) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // Остальное - Network First
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(DYNAMIC_CACHE)
            .then(cache => cache.put(event.request, responseClone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// Очистка старых кешей
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME && name !== DYNAMIC_CACHE)
          .map(name => caches.delete(name))
      );
    })
  );
});
