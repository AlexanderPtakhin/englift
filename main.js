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
  loadPhrasesOnce,
  savePhraseToDb,
  deletePhraseFromDb,
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

  loadPhrasesOnce,

  savePhraseToDb,

  deletePhraseFromDb,
};

// Ждём загрузки DOM и подключаем остальные скрипты

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    console.log('[INIT] 📦 DOM загружен, импорт скриптов...');
    await import('./script.js');
    await import('./auth.js');
    console.log('[INIT] ✅ Все скрипты импортированы');

    // Service Worker Registration
    if ('serviceWorker' in navigator) {
      const swFileMeta = document.querySelector(
        'meta[name="sw-file"]',
      )?.content;
      const SW_URL = swFileMeta || '/sw.js';
      console.log('[SW] Регистрация:', SW_URL);

      try {
        const registration = await navigator.serviceWorker.register(SW_URL, {
          updateViaCache: 'none',
          scope: '/',
        });
        console.log('[SW] Зарегистрирован:', registration);

        // Проверка обновлений каждые 5 минут
        setInterval(
          () => {
            const isInLesson =
              document.body.classList.contains('exercise-active') ||
              document.body.classList.contains('modal-open') ||
              document.body.classList.contains('bs-open') ||
              window.isSessionActive;

            if (!isInLesson) {
              console.log('[SW] Проверка обновлений...');
              registration.update();
            }
          },
          5 * 60 * 1000,
        );

        // Принудительное обновление при загрузке страницы
        setTimeout(() => {
          console.log('[SW] Принудительная проверка при загрузке...');
          registration.update();
        }, 1000);

        if (registration.waiting) {
          console.log('[SW] Найден waiting worker, отправляем SKIP_WAITING');
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        registration.addEventListener('updatefound', () => {
          console.log('[SW] Найдено обновление SW');
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            console.log('[SW] Состояние нового worker:', newWorker.state);
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              console.log(
                '[SW] Новый worker установлен, отправляем SKIP_WAITING',
              );
              newWorker.postMessage({ type: 'SKIP_WAITING' });
              if (window.toast) {
                window.toast(
                  '🔄 Доступна новая версия, обновляем...',
                  'info',
                  'refresh',
                );
              }
              setTimeout(() => window.location.reload(), 2000);
            }
          });
        });
      } catch (err) {
        console.error('[SW] Ошибка регистрации:', err);
      }
    } else {
      console.log('[SW] Service Worker не поддерживается');
    }
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
