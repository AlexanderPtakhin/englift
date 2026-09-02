// js/userDataCache.js
(function () {
  let db = null;
  const DB_NAME = 'EngUplyCache';
  const DB_VERSION = 3; // Увеличена версия для миграции на userId-ключи
  const WORD_STORE = 'words';
  // REMOVED: phrases functionality
  // const PHRASE_STORE = 'phrases';

  function getUserId() {
    return window.currentUserId || 'unknown';
  }

  function openDB() {
    return new Promise((resolve, reject) => {
      if (db && db.name === DB_NAME) {
        resolve(db);
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        db = request.result;
        resolve(db);
      };
      request.onupgradeneeded = event => {
        const db = event.target.result;
        // Миграция на составные ключи с userId для изоляции данных
        if (event.oldVersion < 3) {
          // Удаляем старые stores без userId-изоляции
          if (db.objectStoreNames.contains(WORD_STORE)) {
            db.deleteObjectStore(WORD_STORE);
          }
        }
        if (!db.objectStoreNames.contains(WORD_STORE)) {
          const wordStore = db.createObjectStore(WORD_STORE, { keyPath: 'id' });
          wordStore.createIndex('userId', 'userId');
          wordStore.createIndex('updatedAt', 'updatedAt');
        }
      };
    });
  }

  // Сохранить массив слов одной транзакцией
  async function saveWords(wordsArray) {
    if (!wordsArray.length) return;
    const userId = getUserId();
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(WORD_STORE, 'readwrite');
      const store = tx.objectStore(WORD_STORE);
      for (const word of wordsArray) {
        // Добавляем userId к каждому слову для изоляции
        store.put({ ...word, userId });
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // Пакетное удаление слов
  async function deleteWords(wordIds) {
    if (!wordIds.length) return;
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(WORD_STORE, 'readwrite');
      const store = tx.objectStore(WORD_STORE);
      for (const id of wordIds) store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // Загрузить все слова для текущего пользователя
  async function getAllWords() {
    const userId = getUserId();
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(WORD_STORE, 'readonly');
      const store = tx.objectStore(WORD_STORE);
      const index = store.index('userId');
      const request = index.openCursor(userId);
      const results = [];
      request.onerror = () => reject(request.error);
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          console.log('[CACHE] getAllWords loaded:', results.length, 'words');
          resolve(results);
        }
      };
    });
  }

  // Очистить всё для текущего пользователя (при логауте)
  async function clearAllWords() {
    const userId = getUserId();
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(WORD_STORE, 'readwrite');
      const store = tx.objectStore(WORD_STORE);
      const index = store.index('userId');
      const request = index.openCursor(userId);
      request.onerror = () => reject(tx.error);
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
    });
  }

  // REMOVED: phrases functionality
  // // Сохранить массив фраз
  // async function savePhrases(phrasesArray) {
  //   if (!phrasesArray.length) return;
  //   const db = await openDB();
  //   return new Promise((resolve, reject) => {
  //     const tx = db.transaction(PHRASE_STORE, 'readwrite');
  //     const store = tx.objectStore(PHRASE_STORE);
  //     for (const phrase of phrasesArray) store.put(phrase);
  //     tx.oncomplete = () => resolve();
  //     tx.onerror = () => reject(tx.error);
  //   });
  // }

  // // Пакетное удаление фраз
  // async function deletePhrases(phraseIds) {
  //   if (!phraseIds.length) return;
  //   const db = await openDB();
  //   return new Promise((resolve, reject) => {
  //     const tx = db.transaction(PHRASE_STORE, 'readwrite');
  //     const store = tx.objectStore(PHRASE_STORE);
  //     for (const id of phraseIds) store.delete(id);
  //     tx.oncomplete = () => resolve();
  //     tx.onerror = () => reject(tx.error);
  //   });
  // }

  // // Загрузить все фразы
  // async function getAllPhrases() {
  //   const db = await openDB();
  //   return new Promise((resolve, reject) => {
  //     const tx = db.transaction(PHRASE_STORE, 'readonly');
  //     const store = tx.objectStore(PHRASE_STORE);
  //     const request = store.getAll();
  //     request.onerror = () => reject(request.error);
  //     request.onsuccess = () => resolve(request.result || []);
  //   });
  // }

  // async function clearAllPhrases() {
  //   const db = await openDB();
  //   return new Promise((resolve, reject) => {
  //     const tx = db.transaction(PHRASE_STORE, 'readwrite');
  //     const store = tx.objectStore(PHRASE_STORE);
  //     store.clear();
  //     tx.oncomplete = () => resolve();
  //     tx.onerror = () => reject(tx.error);
  //   });
  // }

  window.UserDataCache = {
    saveWords,
    // REMOVED: phrases functionality
    // savePhrases,
    deleteWords,
    // deletePhrases,
    getAllWords,
    // getAllPhrases,
    clearAllWords,
    // clearAllPhrases,
  };
})();
