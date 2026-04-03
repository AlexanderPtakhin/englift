// Обновленная версия api.js с версионированием и оптимизациями
console.log('[API] api.js загружается');
const ALL_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
let loadingPromise = null;
let levelsLoaded = new Set();
let backgroundLoadingPromise = null;
let dataManifest = null;

// Загрузка манифеста версий
async function loadDataManifest() {
  if (dataManifest) return dataManifest;

  try {
    // Пробуем разные пути для манифеста
    let manifest = null;

    try {
      manifest = await fetch('data-manifest.json').then(r => r.json());
    } catch {
      try {
        manifest = await fetch('./data-manifest.json').then(r => r.json());
      } catch {
        // Если файл не найден, просто используем значения по умолчанию без ошибки
        manifest = {
          A1: { version: '1.0' },
          A2: { version: '1.0' },
          B1: { version: '1.0' },
          B2: { version: '1.0' },
          C1: { version: '1.0' },
          C2: { version: '1.0' },
        };
      }
    }

    dataManifest = manifest;
    return dataManifest;
  } catch (error) {
    console.error('❌ Критическая ошибка загрузки манифеста:', error);
    return {
      A1: { version: '1.0' },
      A2: { version: '1.0' },
      B1: { version: '1.0' },
      B2: { version: '1.0' },
      C1: { version: '1.0' },
      C2: { version: '1.0' },
    };
  }
}

// Проверка версии уровня
async function checkLevelVersion(level) {
  const manifest = await loadDataManifest();
  if (!manifest) return true; // Если нет манифеста, считаем актуальным

  const storedVersion = localStorage.getItem(`dict_${level}_version`);
  const currentVersion = manifest[level]?.version;

  if (storedVersion !== currentVersion) {
    return false; // Нужно обновить
  }

  return true; // Актуальная версия
}

// Очистка уровня при обновлении
async function clearLevel(level) {
  const db = await window.WordBankDB.openDB();
  const tx = db.transaction('words', 'readwrite');
  const store = tx.objectStore('words');
  const index = store.index('cefr');
  const range = IDBKeyRange.only(level);

  return new Promise((resolve, reject) => {
    const request = index.openCursor(range);
    request.onsuccess = event => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// Обновленная функция загрузки уровня с версионированием
async function loadLevel(level) {
  // Проверяем версию перед загрузкой
  const isCurrentVersion = await checkLevelVersion(level);
  const isLoaded = await window.WordBankDB.isBankLoaded();

  if (isLoaded && isCurrentVersion) {
    levelsLoaded.add(level);
    return;
  }

  // Если версия устарела, очищаем старые данные
  if (isLoaded && !isCurrentVersion) {
    await clearLevel(level);
  }

  try {
    const response = await fetch(`dict-${level}.json`);
    if (!response.ok) {
      console.error(`[API] ❌ HTTP ошибка загрузки ${level}:`, response.status);
      throw new Error(`HTTP ${response.status}`);
    }
    const words = await response.json();
    console.log(`[API] ✅ Уровень ${level} загружен:`, words.length, 'слов');

    // Добавляем уникальный ID и CEFR тег
    const wordsWithIdAndCefr = words.map((word, index) => ({
      ...word,
      id: `${word.en}_${level}_${index}`, // Уникальный ID
      cefr: level, // Добавляем CEFR тег
    }));

    // Сохраняем в IndexedDB
    await window.WordBankDB.saveWordsBatch(wordsWithIdAndCefr);

    // Сохраняем версию в localStorage
    const manifest = await loadDataManifest();
    if (manifest && manifest[level]?.version) {
      localStorage.setItem(`dict_${level}_version`, manifest[level].version);
    }

    levelsLoaded.add(level);
  } catch (error) {
    console.error(`[API] ❌ Ошибка загрузки уровня ${level}:`, error);
    throw error;
  }
}

// Оптимизированная фоновая загрузка - параллельная
async function backgroundLoad() {
  const remaining = ALL_LEVELS.filter(lvl => !levelsLoaded.has(lvl));

  if (remaining.length === 0) {
    return;
  }

  try {
    // Загружаем все файлы параллельно
    const levelPromises = remaining.map(async level => {
      const response = await fetch(`dict-${level}.json`);
      const words = await response.json();

      return { level, words };
    });

    const levelData = await Promise.all(levelPromises);

    // Сохраняем последовательно (чтобы не перегружать IndexedDB)
    for (const { level, words } of levelData) {
      // Проверяем версию перед сохранением
      const isCurrentVersion = await checkLevelVersion(level);
      const isLoaded = await window.WordBankDB.isBankLoaded();

      if (isLoaded && !isCurrentVersion) {
        await clearLevel(level);
      }

      const wordsWithIdAndCefr = words.map((word, index) => ({
        ...word,
        id: `${word.en}_${level}_${index}`,
        cefr: level,
      }));

      await window.WordBankDB.saveWordsBatch(wordsWithIdAndCefr);

      // Сохраняем версию
      const manifest = await loadDataManifest();
      if (manifest && manifest[level]?.version) {
        localStorage.setItem(`dict_${level}_version`, manifest[level].version);
      }

      levelsLoaded.add(level);
    }
  } catch (error) {
    console.error('Ошибка фоновой загрузки:', error);
  }
}

// Обновленная функция loadWordBank с версионированием
async function loadWordBank() {
  if (!window.WordBankDB) {
    console.error('[API] ❌ WordBankDB не доступен!');
    return;
  }
  console.log('[API] Загрузка словаря...');

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    // Загружаем манифест версий
    await loadDataManifest();

    // Проверяем, загружен ли уже словарь
    const loaded = await window.WordBankDB.isBankLoaded();

    if (loaded) {
      console.log('[API] Словарь уже загружен');
      return;
    }

    await loadLevel('A1');

    // Запускаем фоновую загрузку остальных уровней
    if (!backgroundLoadingPromise) {
      backgroundLoadingPromise = backgroundLoad().catch(console.warn);
    }
  })();

  return loadingPromise;
}

// Принудительное обновление всех уровней
async function forceUpdateAllLevels() {
  // Очищаем все версии
  ALL_LEVELS.forEach(level => {
    localStorage.removeItem(`dict_${level}_version`);
  });

  // Очищаем IndexedDB
  const db = await window.WordBankDB.openDB();
  const tx = db.transaction('words', 'readwrite');
  const store = tx.objectStore('words');
  await store.clear();

  // Сбрасываем флаги загрузки
  levelsLoaded.clear();

  // Загружаем заново
  await loadWordBank();
}

// Экспортируем API глобально
window.WordAPI = {
  loadWordBank,
  searchWords: async (prefix, limit = 15) => {
    if (!prefix) return [];
    await loadWordBank();
    return window.WordBankDB.searchWords(prefix, limit);
  },
  searchRussian: async (prefix, limit = 15) => {
    if (!prefix) return [];
    await loadWordBank();
    return window.WordBankDB.searchRussian(prefix, limit);
  },
  getRandomNewWord: async (level = 'all') => {
    if (!window.WordBankDB) {
      console.error('WordBankDB не доступен!');
      return null;
    }
    await loadWordBank();
    return window.WordBankDB.getRandomWord(level);
  },
  debugWordBank: async () => {
    if (!window.WordBankDB) {
      console.error('WordBankDB не доступен!');
      return null;
    }
    try {
      const db = await window.WordBankDB.openDB();
      const tx = db.transaction('words', 'readonly');
      const store = tx.objectStore('words');
      const allWords = await new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onsuccess = () => reject(request.error);
      });
      const byLevel = {};
      for (const word of allWords) {
        const level = word.cefr;
        if (!byLevel[level]) byLevel[level] = [];
        byLevel[level].push(word);
      }
      return { total: allWords.length, byLevel };
    } catch (error) {
      console.error('Ошибка диагностики WordBank:', error);
      return null;
    }
  },
  levelsLoaded,
  forceUpdateAllLevels, // Новая функция для принудительного обновления
  checkVersions: async () => {
    const manifest = await loadDataManifest();
    const status = {};
    for (const level of ALL_LEVELS) {
      const storedVersion = localStorage.getItem(`dict_${level}_version`);
      const currentVersion = manifest[level]?.version;
      status[level] = {
        stored: storedVersion,
        current: currentVersion,
        needsUpdate: storedVersion !== currentVersion,
      };
    }
    return status;
  },
};
