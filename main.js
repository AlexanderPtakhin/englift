// Импортируем все необходимые модули
import { auth, db } from './firebase.js';
import {
  saveAllWordsToDb,
  subscribeToWords,
  unsubscribeWords,
  syncLocalWordsWithFirestore,
  userRef,
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
};

// Ждем полной загрузки DOM перед загрузкой остальных скриптов
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    import('./auth.js');
    import('./script.js');
  });
} else {
  import('./auth.js');
  import('./script.js');
}
