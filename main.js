import { supabase } from './supabase.js';
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
  console.error('Глобальная ошибка:', event.error);
  window.toast?.(
    'Ошибка: ' + (event.error?.message || event.message),
    'danger',
  );
  window.forceHideLoader?.();
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
  navigator.serviceWorker
    .register(new URL('./sw.js', import.meta.url), {
      scope: '/',
      updateViaCache: 'none', // ←←← ВОТ ЭТО ГЛАВНОЕ
    })
    .then(reg => {
      console.log('SW registered:', reg);

      // Если есть ожидающий воркер — активируем сразу
      if (reg.waiting) {
        console.log('Есть waiting worker, отправляем SKIP_WAITING');
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      // Следим за появлением новой версии
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker?.addEventListener('statechange', () => {
          if (
            newWorker.state === 'installed' &&
            navigator.serviceWorker.controller
          ) {
            console.log('Новая версия установлена, активируем');
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });
    })
    .catch(err => console.error('SW registration failed:', err));

  // При активации нового SW перезагружаем страницу (только один раз)
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      console.log('🔄 Новый SW активирован, перезагружаем...');
      window.location.reload();
    }
  });
}

// Ждём загрузки DOM и подключаем остальные скрипты
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    import('./auth.js');
    import('./script.js');
  });
} else {
  import('./auth.js');
  import('./script.js');
}

// Принудительное скрытие спиннера через 10 секунд на случай ошибок
setTimeout(() => {
  console.log('Проверка спиннера через 10 секунд');
  const loader = document.getElementById('loading-indicator');
  if (loader && loader.style.display !== 'none') {
    console.warn('Спиннер всё ещё виден, скрываем принудительно');
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
    console.warn('Спиннер всё ещё виден, удаляем принудительно');
    window.forceHideLoader?.();
  }
}, 8000);
