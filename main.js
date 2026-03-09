import { supabase } from './supabase.js';
import {
  saveWordToDb,
  deleteWordFromDb,
  saveUserData,
  loadWordsOnce,
} from './db.js';

// Экспортируем для использования в других скриптах
window.authExports = {
  auth: supabase.auth,
  saveWordToDb,
  deleteWordFromDb,
  saveUserData,
  loadWordsOnce,
};

// Регистрация сервис-воркера для PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(new URL('./sw.js', import.meta.url))
      .then(reg => console.log('SW registered:', reg))
      .catch(err => console.error('SW registration failed:', err));
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
