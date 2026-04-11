// idiomBankDB.js
(function () {
  let db = null;
  const DB_NAME = 'EngLiftIdiomBank';
  const DB_VERSION = 1;
  const STORE_NAME = 'idioms';

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
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('idiom', 'idiom', { unique: false });
      };
    });
  }

  async function isBankLoaded() {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    return new Promise(resolve => {
      const req = store.count();
      req.onsuccess = () => resolve(req.result > 0);
      req.onerror = () => resolve(false);
    });
  }

  async function saveIdiomsBatch(idioms, batchSize = 500) {
    const db = await openDB();
    let totalSaved = 0;
    for (let i = 0; i < idioms.length; i += batchSize) {
      const batch = idioms.slice(i, i + batchSize);
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const idiom of batch) {
        store.put(idiom);
      }
      await new Promise((resolve, reject) => {
        tx.oncomplete = () => {
          totalSaved += batch.length;
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      });
    }
    return totalSaved;
  }

  async function getAllIdioms() {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    return new Promise(resolve => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve([]);
    });
  }

  async function getRandomIdiom(level = 'all') {
    const all = await getAllIdioms();
    if (all.length === 0) return null;
    let pool = all;
    if (level !== 'all') {
      pool = all.filter(i => i.level === level);
    }
    if (pool.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * pool.length);
    return pool[randomIndex];
  }

  async function searchIdioms(query, limit = 15) {
    const all = await getAllIdioms();
    const lowerQuery = query.toLowerCase();
    const filtered = all.filter(
      item =>
        item.idiom.toLowerCase().includes(lowerQuery) ||
        (item.meaning && item.meaning.toLowerCase().includes(lowerQuery)),
    );
    return filtered.slice(0, limit);
  }

  async function clearAll() {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    return new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  window.IdiomBankDB = {
    openDB,
    isBankLoaded,
    saveIdiomsBatch,
    getAllIdioms,
    getRandomIdiom,
    searchIdioms,
    clearAll,
  };
})();
