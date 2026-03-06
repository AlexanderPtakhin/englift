import { supabase } from './supabase.js';
import {
  saveWordToDb,
  deleteWordFromDb,
  saveUserData,
  loadWordsOnce,
  batchSaveWords,
} from './db.js';

// Экспортируем для использования в других скриптах
window.authExports = {
  auth: supabase.auth,
  saveWordToDb,
  deleteWordFromDb,
  saveUserData,
  loadWordsOnce,
  batchSaveWords,
};

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
