// Импортируем все необходимые модули
import { auth, db } from './firebase.js';
import {
  saveAllWordsToDb,
  subscribeToWords,
  unsubscribeWords,
  syncLocalWordsWithFirestore,
  userRef,
  loadWordsOnce,
  batchSaveWords,
} from './db.js';

// Экспортируем функции для использования в других скриптах
window.authExports = {
  auth,
  db,
  saveAllWordsToDb,
  subscribeToWords,
  unsubscribeWords,
  syncLocalWordsWithFirestore,
  userRef,
  loadWordsOnce,
  batchSaveWords,
};

// Ждем полной загрузки DOM перед загрузкой остальных скриптов
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    import('./script.js');
    import('./auth.js');
  });
} else {
  import('./script.js');
  import('./auth.js');
}
