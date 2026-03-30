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
  window.toast?.(
    'Ошибка: ' + (event.error?.message || event.message),

    'danger',
  );

  window.forceHideLoader?.();
});

// Обработка необработанных Promise rejection

window.addEventListener('unhandledrejection', function (event) {
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
  navigator.serviceWorker
    .register(new URL('./sw.js', import.meta.url), { updateViaCache: 'none' })
    .then(reg => {
      reg.update();
    });
  let refreshing = false;
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
    await import('./script.js');
    await import('./auth.js');
  });
} else {
  import('./script.js').then(() => import('./auth.js'));
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
