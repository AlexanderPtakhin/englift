// js/wordBankDB.js
(function () {
  let db = null;
  const DB_NAME = 'EngLiftWordBank';
  const DB_VERSION = 3; // увеличили версию
  const STORE_NAME = 'words';
  const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

  // Вспомогательная функция открытия БД
  function openDB() {
    return new Promise((resolve, reject) => {
      if (db && db.name === DB_NAME && db.version === DB_VERSION) {
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
        if (db.objectStoreNames.contains(STORE_NAME)) {
          db.deleteObjectStore(STORE_NAME);
        }
        // Составной ключ (en + ru)
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: ['en', 'ru'],
        });
        store.createIndex('cefr', 'cefr', { unique: false });
        store.createIndex('word', 'en', { unique: false });
        store.createIndex('ru', 'ru', { unique: false });
      };
    });
  }

  // Проверка, есть ли данные
  async function isBankLoaded() {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    return new Promise(resolve => {
      const req = store.count();
      req.onsuccess = () => {
        const count = req.result;
        const loaded = count > 0;

        // Если словарь загружен, инициализируем levelsLoaded
        if (loaded && window.WordAPI) {
          checkLoadedLevels();
        }

        resolve(loaded);
      };
      req.onerror = () => {
        resolve(false);
      };
    });
  }

  // Проверка какие уровни уже загружены
  async function checkLoadedLevels() {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const cefrIndex = store.index('cefr');

    const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    let totalWords = 0;

    for (const level of levels) {
      const req = cefrIndex.count(level);
      await new Promise(resolve => {
        req.onsuccess = () => {
          if (req.result > 0) {
            window.WordAPI.levelsLoaded.add(level);
            totalWords += req.result;
          }
          resolve();
        };
        req.onerror = resolve;
      });
    }

    return totalWords;
  }

  // Сохранение слов пачками с правильным управлением транзакциями
  async function saveWordsBatch(words, batchSize = 500) {
    // Фильтруем слова, у которых есть и en, и ru (на случай битых данных)
    const validWords = words.filter(w => w.en && w.ru);

    const db = await openDB();
    let totalSaved = 0;

    for (let i = 0; i < validWords.length; i += batchSize) {
      const batch = validWords.slice(i, i + batchSize);

      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      for (const word of batch) {
        store.put(word);
      }

      await new Promise((resolve, reject) => {
        tx.oncomplete = () => {
          totalSaved += batch.length;
          resolve();
        };
        tx.onerror = () => {
          console.error(
            `❌ saveWordsBatch: Ошибка сохранения пачки:`,
            tx.error,
          );
          reject(tx.error);
        };
      });
    }

    return totalSaved;
  }

  // Поиск по английскому слову (префикс)
  async function searchWords(prefix, limit = 15) {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('word');
    const lower = prefix.toLowerCase();
    const upper = lower + '\uffff';
    const range = IDBKeyRange.bound(lower, upper);
    const results = [];
    return new Promise((resolve, reject) => {
      const request = index.openCursor(range);
      request.onerror = () => reject(request.error);
      request.onsuccess = event => {
        const cursor = event.target.result;
        if (cursor && results.length < limit) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
    });
  }

  // Поиск по русскому переводу (префикс)
  async function searchRussian(prefix, limit = 15) {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('ru');
    const lower = prefix.toLowerCase();
    const upper = lower + '\uffff';
    const range = IDBKeyRange.bound(lower, upper);
    const results = [];
    return new Promise((resolve, reject) => {
      const request = index.openCursor(range);
      request.onerror = () => reject(request.error);
      request.onsuccess = event => {
        const cursor = event.target.result;
        if (cursor && results.length < limit) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
    });
  }

  // Получение случайного слова
  async function getRandomWord(cefrLevel = null) {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    if (cefrLevel && cefrLevel !== 'all') {
      const index = store.index('cefr');
      const range = IDBKeyRange.only(cefrLevel);
      const words = [];
      return new Promise((resolve, reject) => {
        const request = index.openCursor(range);
        request.onerror = () => reject(request.error);
        request.onsuccess = event => {
          const cursor = event.target.result;
          if (cursor) {
            words.push(cursor.value);
            cursor.continue();
          } else {
            if (words.length === 0) resolve(null);
            else resolve(words[Math.floor(Math.random() * words.length)]);
          }
        };
      });
    } else {
      const count = await new Promise(resolve => {
        const req = store.count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(0);
      });
      if (count === 0) return null;
      const randomIndex = Math.floor(Math.random() * count);
      let i = 0;
      return new Promise((resolve, reject) => {
        const request = store.openCursor();
        request.onerror = () => reject(request.error);
        request.onsuccess = event => {
          const cursor = event.target.result;
          if (!cursor) resolve(null);
          if (i === randomIndex) {
            resolve(cursor.value);
          } else {
            i++;
            cursor.continue();
          }
        };
      });
    }
  }

  // Подсчёт оставшихся слов в банке (исключая уже добавленные)
  async function getRemainingWordsCount() {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    return new Promise(resolve => {
      const request = store.getAll();
      request.onsuccess = () => {
        const allWords = request.result || [];
        const totalInBank = allWords.length;

        const userWords = Array.isArray(window.words) ? window.words : [];
        const userSet = new Set(
          userWords.map(w => (w.en || '').trim().toLowerCase()).filter(Boolean),
        );

        const remaining = allWords.filter(
          word => !userSet.has((word.en || '').trim().toLowerCase()),
        ).length;

        resolve({
          totalInBank,
          userWordsCount: userSet.size,
          remaining,
        });
      };
      request.onerror = () =>
        resolve({ totalInBank: 0, userWordsCount: 0, remaining: 0 });
    });
  }

  // Экспортируем функции глобально
  window.WordBankDB = {
    openDB,
    isBankLoaded,
    saveWordsBatch,
    searchWords,
    searchRussian,
    getRandomWord,
    getRemainingWordsCount,
  };
})();
