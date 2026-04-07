// === SERVICE WORKER REGISTRATION (НЕ МИНИФИЦИРУЕТСЯ) ===
(function() {
  'use strict';
  
  if (!('serviceWorker' in navigator)) {
    console.log('[SW] Service Worker не поддерживается');
    return;
  }
  
  const swFileMeta = document.querySelector('meta[name="sw-file"]')?.content;
  const appVersion = document.querySelector('meta[name="app-version"]')?.content;
  
  const SW_URL = swFileMeta || '/sw.js';
  console.log('[SW] Регистрация:', SW_URL);
  console.log('[SW] Версия:', appVersion);
  
  const registerSW = async () => {
    try {
      const registration = await navigator.serviceWorker.register(SW_URL, {
        updateViaCache: 'none',
        scope: '/'
      });
      console.log('[SW] Зарегистрирован:', registration);

      // Проверка обновлений каждые 30 минут, но не во время упражнений
      setInterval(() => {
        const isInLesson = 
          document.body.classList.contains('exercise-active') ||
          document.body.classList.contains('modal-open') ||
          document.body.classList.contains('bs-open') ||
          window.isSessionActive;
          
        if (!isInLesson) {
          registration.update();
        }
      }, 30 * 60 * 1000);

      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            if (window.toast) {
              window.toast('🔄 Доступна новая версия, обновляем...', 'info', 'refresh');
            }
            setTimeout(() => window.location.reload(), 2000);
          }
        });
      });
    } catch (err) {
      console.error('[SW] Ошибка регистрации:', err);
    }
  };

  document.addEventListener('DOMContentLoaded', registerSW);

  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data?.type === 'SW_UPDATED') {
      if (window.toast) {
        window.toast('🔄 Обновление приложения...', 'info', 'refresh');
      }
      setTimeout(() => window.location.reload(), 1500);
    }
  });

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
})();
