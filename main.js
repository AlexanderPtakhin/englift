import { supabase } from './supabase.js';

console.log('[INIT] 🚀 main.js загружается');

import {
  saveWordToDb,
  deleteWordFromDb,
  saveUserData,
  loadWordsOnce,
  loadIdiomsOnce,
  saveIdiomToDb,
  deleteIdiomFromDb,
} from './db.js';

// Импортируем и экспортируем функции темы глобально

import {
  applyTheme,
  updateThemeIcon,
  initTheme,
  setupThemeToggle,
} from './js/theme.js';

window.applyTheme = applyTheme;

window.updateThemeIcon = updateThemeIcon;

window.initTheme = initTheme;

window.setupThemeToggle = setupThemeToggle;

// Глобальный перехват ошибок для отладки

window.addEventListener('error', function (event) {
  console.error('[CRITICAL] ❌ Глобальная ошибка:', event.error);
  window.toast?.(
    'Ошибка: ' + (event.error?.message || event.message),

    'danger',
  );

  window.forceHideLoader?.();
});

// Обработка необработанных Promise rejection

window.addEventListener('unhandledrejection', function (event) {
  console.error(
    '[CRITICAL] ❌ Необработанный Promise rejection:',
    event.reason,
  );
  window.toast?.(
    'Ошибка: ' + (event.reason?.message || event.reason),

    'danger',
  );

  event.preventDefault();
});

// Экспортируем для использования в других скриптах

window.authExports = {
  auth: supabase.auth,

  saveWordToDb,

  deleteWordFromDb,

  saveUserData,

  loadWordsOnce,

  loadIdiomsOnce,

  saveIdiomToDb,

  deleteIdiomFromDb,
};

// === РЕГИСТРАЦИЯ SERVICE WORKER С АВТООБНОВЛЕНИЕМ ===

if ('serviceWorker' in navigator) {
  console.log('[SW] Регистрация Service Worker...');
  navigator.serviceWorker
    .register(new URL('./sw.js', import.meta.url), { updateViaCache: 'none' })
    .then(reg => {
      console.log('[SW] ✅ Service Worker зарегистрирован');

      // Отслеживаем появление нового SW
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          console.log('[SW] 🆕 Новый SW устанавливается');
          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              console.log('[SW] ⏳ Новый SW готов, вызываем skipWaiting');
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        }
      });

      reg.update();
    })
    .catch(err => {
      console.error('[SW] ❌ Ошибка регистрации SW:', err);
    });
  let refreshing = false;
  let updateAvailable = false;

  // Слушаем сообщения от SW
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data && event.data.type === 'SW_UPDATED') {
      console.log('[SW] 🔔 Доступна новая версия:', event.data.version);
      updateAvailable = true;
      // Показываем уведомление пользователю
      if (window.toast) {
        window.toast('Доступна новая версия! Перезагрузка...', 'info', 3000);
      }
      // Автоперезагрузка через 3 секунды
      setTimeout(() => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      }, 3000);
    }
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}

// Ждём загрузки DOM и подключаем остальные скрипты

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    console.log('[INIT] 📦 DOM загружен, импорт скриптов...');
    await import('./script.js');
    await import('./auth.js');
    console.log('[INIT] ✅ Все скрипты импортированы');
  });
} else {
  console.log('[INIT] 📦 DOM уже загружен, немедленный импорт');
  import('./script.js').then(() => import('./auth.js'));
}

// Принудительное скрытие спиннера через 10 секунд на случай ошибок
setTimeout(() => {
  const loader = document.getElementById('loading-indicator');

  if (loader && loader.style.display !== 'none') {
    console.warn('[INIT] ⚠️ Таймаут загрузки (10s), скрываем loader');
    window.forceHideLoader?.();

    window.toast?.(
      'Приложение загружается долго. Проверьте интернет.',

      'warning',
    );
  }
}, 10000);

// Универсальный таймаут для скрытия спиннера через 8 секунд
setTimeout(() => {
  if (document.getElementById('loading-indicator')) {
    window.forceHideLoader?.();
  }
}, 8000);
