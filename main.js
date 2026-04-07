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
