// Импортируем все необходимые модули
import { auth } from './firebase.js';
import {
  saveAllWordsToDb,
  subscribeToWords,
  unsubscribeWords,
  syncLocalWordsWithFirestore,
} from './db.js';

// Экспортируем функции для использования в других скриптах
window.authExports = {
  auth,
  saveAllWordsToDb,
  subscribeToWords,
  unsubscribeWords,
  syncLocalWordsWithFirestore,
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
