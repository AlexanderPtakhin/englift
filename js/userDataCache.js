// js/userDataCache.js
(function () {
  let db = null;
  const DB_NAME = 'EngLiftCache';
  const DB_VERSION = 2;
  const WORD_STORE = 'words';
  const IDIOM_STORE = 'idioms';
  const PHRASE_STORE = 'phrases';

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
        if (!db.objectStoreNames.contains(WORD_STORE)) {
          const wordStore = db.createObjectStore(WORD_STORE, { keyPath: 'id' });
          wordStore.createIndex('updatedAt', 'updatedAt');
        }
        if (!db.objectStoreNames.contains(IDIOM_STORE)) {
          const idiomStore = db.createObjectStore(IDIOM_STORE, {
            keyPath: 'id',
          });
          idiomStore.createIndex('updatedAt', 'updatedAt');
        }
        if (!db.objectStoreNames.contains(PHRASE_STORE)) {
          const phraseStore = db.createObjectStore(PHRASE_STORE, {
            keyPath: 'id',
          });
          phraseStore.createIndex('updatedAt', 'updatedAt');
        }
      };
    });
  }

  // Сохранить массив слов одной транзакцией
  async function saveWords(wordsArray) {
    if (!wordsArray.length) return;
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(WORD_STORE, 'readwrite');
      const store = tx.objectStore(WORD_STORE);
      for (const word of wordsArray) store.put(word);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // Сохранить массив идиом
  async function saveIdioms(idiomsArray) {
    if (!idiomsArray.length) return;
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDIOM_STORE, 'readwrite');
      const store = tx.objectStore(IDIOM_STORE);
      for (const idiom of idiomsArray) store.put(idiom);
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

  // Пакетное удаление идиом
  async function deleteIdioms(idiomIds) {
    if (!idiomIds.length) return;
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDIOM_STORE, 'readwrite');
      const store = tx.objectStore(IDIOM_STORE);
      for (const id of idiomIds) store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // Загрузить все слова
  async function getAllWords() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(WORD_STORE, 'readonly');
      const store = tx.objectStore(WORD_STORE);
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  // Загрузить все идиомы
  async function getAllIdioms() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDIOM_STORE, 'readonly');
      const store = tx.objectStore(IDIOM_STORE);
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  // Очистить всё (при логауте)
  async function clearAllWords() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(WORD_STORE, 'readwrite');
      const store = tx.objectStore(WORD_STORE);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function clearAllIdioms() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDIOM_STORE, 'readwrite');
      const store = tx.objectStore(IDIOM_STORE);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // Сохранить массив фраз
  async function savePhrases(phrasesArray) {
    if (!phrasesArray.length) return;
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PHRASE_STORE, 'readwrite');
      const store = tx.objectStore(PHRASE_STORE);
      for (const phrase of phrasesArray) store.put(phrase);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // Пакетное удаление фраз
  async function deletePhrases(phraseIds) {
    if (!phraseIds.length) return;
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PHRASE_STORE, 'readwrite');
      const store = tx.objectStore(PHRASE_STORE);
      for (const id of phraseIds) store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // Загрузить все фразы
  async function getAllPhrases() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PHRASE_STORE, 'readonly');
      const store = tx.objectStore(PHRASE_STORE);
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  async function clearAllPhrases() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PHRASE_STORE, 'readwrite');
      const store = tx.objectStore(PHRASE_STORE);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  window.UserDataCache = {
    saveWords,
    saveIdioms,
    savePhrases,
    deleteWords,
    deleteIdioms,
    deletePhrases,
    getAllWords,
    getAllIdioms,
    getAllPhrases,
    clearAllWords,
    clearAllIdioms,
    clearAllPhrases,
  };
})();
