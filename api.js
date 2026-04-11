// Обновленная версия api.js с версионированием и оптимизациями
console.log('[API] api.js загружается');
const ALL_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
let loadingPromise = null;
let levelsLoaded = new Set();
let backgroundLoadingPromise = null;
let dictionaryLoadStarted = false;
let dataManifest = null;
let cachedWordBank = null;
let cachedWordBankByLevel = null;

// Загрузка манифеста версий
async function loadDataManifest() {
  if (dataManifest) return dataManifest;

  try {
    // Пробуем разные пути для манифеста
    let manifest = null;

    try {
      manifest = await fetch('data-manifest.json').then(r => r.json());
      console.log('[API] Манифест загружен из data-manifest.json');
    } catch {
      try {
        manifest = await fetch('./data-manifest.json').then(r => r.json());
        console.log('[API] Манифест загружен из ./data-manifest.json');
      } catch {
        // Если файл не найден, просто используем значения по умолчанию без ошибки
        console.log(
          '[API] Манифест не найден, используем значения по умолчанию',
        );
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
    console.error('Ошибка загрузки манифеста:', error);
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
  console.log(`[API] Loading level ${level}...`);

  // Check version before loading
  const isCurrentVersion = await checkLevelVersion(level);
  const isLoaded = await window.WordBankDB.isBankLoaded();

  if (isLoaded && isCurrentVersion) {
    console.log(`[API] Level ${level} already loaded and current, skipping`);
    levelsLoaded.add(level);
    return;
  }

  // If version outdated, clear old data
  if (isLoaded && !isCurrentVersion) {
    console.log(`[API] Level ${level} version outdated, clearing old data...`);
    await clearLevel(level);
  }

  try {
    console.log(`[API] Fetching ${level}/dict-${level}.json...`);
    const response = await fetch(`${level}/dict-${level}.json`);
    if (!response.ok) {
      console.error(`[API] HTTP error loading ${level}:`, response.status);
      throw new Error(`HTTP ${response.status}`);
    }
    const words = await response.json();
    console.log(`[API] Level ${level} loaded:`, words.length, 'words');

    // Add unique ID and CEFR tag
    const wordsWithIdAndCefr = words.map((word, index) => ({
      ...word,
      id: `${word.en}_${level}_${index}`, // Unique ID
      cefr: level, // Add CEFR tag
    }));

    console.log(
      `[API] Saving ${wordsWithIdAndCefr.length} words to IndexedDB...`,
    );
    // Save to IndexedDB
    await window.WordBankDB.saveWordsBatch(wordsWithIdAndCefr);
    console.log(`[API] Level ${level} saved to IndexedDB`);

    // Save version to localStorage
    const manifest = await loadDataManifest();
    if (manifest && manifest[level]?.version) {
      localStorage.setItem(`dict_${level}_version`, manifest[level].version);
      console.log(
        `[API] Level ${level} version ${manifest[level].version} saved to localStorage`,
      );
    }

    levelsLoaded.add(level);
    console.log(`[API] Level ${level} loading completed`);
  } catch (error) {
    console.error(`[API] Error loading level ${level}:`, error);
    throw error;
  }
}

// Оптимизированная фоновая загрузка - параллельная
async function backgroundLoad() {
  const remaining = ALL_LEVELS.filter(lvl => !levelsLoaded.has(lvl));

  if (remaining.length === 0) {
    console.log(
      '[API] Все уровни уже загружены, фоновая загрузка не требуется',
    );
    return;
  }

  console.log('[API] Начало фоновой загрузки для уровней:', remaining);

  try {
    // Загружаем все файлы параллельно
    console.log('[API] Загрузка всех оставшихся уровней параллельно...');
    const levelPromises = remaining.map(async level => {
      const response = await fetch(`${level}/dict-${level}.json`);
      if (!response.ok) {
        console.warn(
          `[API] Уровень ${level} недоступен (${response.status}), пропускаем`,
        );
        return null;
      }
      const words = await response.json();
      console.log(
        `[API] Фоновая загрузка: Уровень ${level} загружен, ${words.length} слов`,
      );
      return { level, words };
    });

    const levelData = (await Promise.all(levelPromises)).filter(Boolean);
    console.log(
      `[API] Фоновая загрузка: ${levelData.length} уровней загружены успешно`,
    );

    // Сохраняем последовательно (чтобы не перегружать IndexedDB)
    for (const { level, words } of levelData) {
      console.log(`[API] Фоновая загрузка: Обработка уровня ${level}...`);

      // Check version before saving
      const isCurrentVersion = await checkLevelVersion(level);
      const isLoaded = await window.WordBankDB.isBankLoaded();

      if (isLoaded && !isCurrentVersion) {
        console.log(
          `[API] Фоновая загрузка: Уровень ${level} устарел, очищаем...`,
        );
        await clearLevel(level);
      }

      const wordsWithIdAndCefr = words.map((word, index) => ({
        ...word,
        id: `${word.en}_${level}_${index}`,
        cefr: level,
      }));

      console.log(
        `[API] Фоновая загрузка: Сохранение ${wordsWithIdAndCefr.length} слов для уровня ${level}...`,
      );
      await window.WordBankDB.saveWordsBatch(wordsWithIdAndCefr);

      // Save version
      const manifest = await loadDataManifest();
      if (manifest && manifest[level]?.version) {
        localStorage.setItem(`dict_${level}_version`, manifest[level].version);
      }

      levelsLoaded.add(level);
      console.log(`[API] Фоновая загрузка: Уровень ${level} завершен`);
    }

    console.log('[API] Фоновая загрузка завершена для всех уровней');
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

  // Если загрузка уже была начата, просто ждём текущий promise
  if (loadingPromise) {
    console.log(
      '[API] Dictionary already loading, waiting for existing promise...',
    );
    return loadingPromise;
  }

  // Если загрузка уже завершена (или хотя бы начата) – не запускаем повторно
  if (dictionaryLoadStarted) {
    console.log('[API] Dictionary load already started, skipping duplicate');
    return;
  }

  dictionaryLoadStarted = true;
  loadingPromise = (async () => {
    try {
      console.log('[API] Loading version manifest...');
      await loadDataManifest();

      console.log('[API] Checking if dictionary is already loaded...');
      const loaded = await window.WordBankDB.isBankLoaded();

      if (loaded) {
        console.log('[API] Dictionary already fully loaded');

        // Show current status
        try {
          const status = await window.WordAPI.checkVersions();
          console.log('[API] Current version status:', status);

          // Show loaded levels
          console.log(
            '[API] Currently loaded levels:',
            Array.from(levelsLoaded),
          );

          // Show debug info
          const debugInfo = await window.WordAPI.debugWordBank();
          if (debugInfo) {
            console.log('[API] Dictionary debug info:', debugInfo);
          }
        } catch (e) {
          console.log('[API] Error getting debug info:', e.message);
        }

        return;
      }

      console.log('[API] Dictionary not loaded, starting with level A1...');
      // Очищаем кеш перед загрузкой новых данных
      cachedWordBank = null;
      cachedWordBankByLevel = null;
      await loadLevel('A1');

      console.log('[API] Starting background load for remaining levels...');
      if (!backgroundLoadingPromise) {
        backgroundLoadingPromise = backgroundLoad().catch(console.warn);
      }
    } catch (error) {
      console.error('[API] Error loading dictionary:', error);
      dictionaryLoadStarted = false; // сбросить при ошибке
      throw error;
    }
  })();

  return loadingPromise;
}

// Кеширование банка слов в памяти для мгновенного доступа
async function getCachedWordBank() {
  if (cachedWordBank) return cachedWordBank;

  const db = await window.WordBankDB.openDB();
  const tx = db.transaction('words', 'readonly');
  const store = tx.objectStore('words');
  const allWords = await new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  cachedWordBank = allWords;
  cachedWordBankByLevel = {};

  for (const w of allWords) {
    const level = w.cefr;
    if (!cachedWordBankByLevel[level]) cachedWordBankByLevel[level] = [];
    cachedWordBankByLevel[level].push(w);
  }

  console.log('[API] Word bank cached in memory:', allWords.length, 'words');
  return cachedWordBank;
}

// Принудительное обновление всех уровней
async function forceUpdateAllLevels() {
  // Очищаем кеш
  cachedWordBank = null;
  cachedWordBankByLevel = null;

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
  loadingPromise = null;

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
    const bank = await getCachedWordBank();
    let pool = level === 'all' ? bank : cachedWordBankByLevel[level] || [];
    if (!pool.length) return null;
    // Исключаем уже добавленные пользователем слова
    const userWordsSet = new Set(
      (window.words || []).map(w => w.en.toLowerCase()),
    );
    const available = pool.filter(w => !userWordsSet.has(w.en.toLowerCase()));
    if (available.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * available.length);
    return available[randomIndex];
  },
  debugWordBank: async () => {
    if (!window.WordBankDB) {
      console.error('WordBankDB not available!');
      return null;
    }
    try {
      const db = await window.WordBankDB.openDB();
      const tx = db.transaction('words', 'readonly');
      const store = tx.objectStore('words');
      const allWords = await new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const byLevel = {};
      for (const word of allWords) {
        const level = word.cefr;
        if (!byLevel[level]) byLevel[level] = [];
        byLevel[level].push(word);
      }
      console.log('[API] Dictionary debug info calculated:', {
        total: allWords.length,
        byLevel,
      });
      return { total: allWords.length, byLevel };
    } catch (error) {
      console.error('Error diagnosing WordBank:', error);
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

// =============================================
// ИДИОМЫ - IndexedDB кеширование (аналог WordAPI)
// =============================================

let idiomLoadingPromise = null;
let idiomDataManifest = null;
let idiomLoadStarted = false;

async function loadIdiomDataManifest() {
  if (idiomDataManifest) return idiomDataManifest;
  try {
    const response = await fetch('/idioms-manifest.json');
    if (response.ok) {
      idiomDataManifest = await response.json();
      console.log('[API] Идиомы манифест загружен');
    } else {
      throw new Error('Manifest not found');
    }
  } catch {
    console.log(
      '[API] Идиомы манифест не найден, используем значения по умолчанию',
    );
    idiomDataManifest = { version: '1.0', total: 0 };
  }
  return idiomDataManifest;
}

async function checkIdiomVersion() {
  const manifest = await loadIdiomDataManifest();
  const storedVersion = localStorage.getItem('idiom_bank_version');
  return storedVersion === manifest.version;
}

async function loadIdiomBank() {
  if (!window.IdiomBankDB) {
    console.error('[API] IdiomBankDB не доступен');
    return;
  }
  if (idiomLoadingPromise) return idiomLoadingPromise;
  if (idiomLoadStarted) {
    console.log('[API] Загрузка идиом уже запущена');
    return;
  }
  idiomLoadStarted = true;

  idiomLoadingPromise = (async () => {
    try {
      await loadIdiomDataManifest();
      const isCurrentVersion = await checkIdiomVersion();
      const loaded = await window.IdiomBankDB.isBankLoaded();

      if (loaded && isCurrentVersion) {
        console.log('[API] Идиомы уже загружены и актуальны');
        return;
      }

      if (loaded && !isCurrentVersion) {
        console.log('[API] Идиомы устарели, очищаем...');
        await window.IdiomBankDB.clearAll();
      }

      console.log('[API] Загрузка идиом из JSON...');
      const response = await fetch('/idioms/idioms.json');
      if (!response.ok) throw new Error('Failed to load idioms.json');
      const idioms = await response.json();

      const idiomsWithId = idioms.map((idiom, idx) => ({
        ...idiom,
        id: `idiom_${idx}_${idiom.idiom.replace(/\s/g, '_')}`,
      }));

      const saved = await window.IdiomBankDB.saveIdiomsBatch(idiomsWithId);
      localStorage.setItem('idiom_bank_version', idiomDataManifest.version);
      console.log(`[API] Загружено ${saved} идиом в IndexedDB`);
    } catch (error) {
      console.error('[API] Ошибка загрузки идиом:', error);
      idiomLoadStarted = false;
      throw error;
    }
  })();
  return idiomLoadingPromise;
}

window.IdiomAPI = {
  loadIdiomBank,
  getRandomNewIdiom: async (level = 'all') => {
    await loadIdiomBank();
    const allIdioms = await window.IdiomBankDB.getAllIdioms();
    if (!allIdioms.length) return null;

    // Идиомы пока не имеют поля level, поэтому игнорируем фильтрацию по уровню
    let pool = allIdioms;

    // Исключаем уже добавленные пользователем идиомы
    const userIdiomsSet = new Set(
      (window.idioms || []).map(i => i.idiom.toLowerCase()),
    );
    const available = pool.filter(
      i => !userIdiomsSet.has(i.idiom.toLowerCase()),
    );

    if (available.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * available.length);
    return available[randomIndex];
  },
  searchIdioms: async (query, limit = 15) => {
    await loadIdiomBank();
    return window.IdiomBankDB.searchIdioms(query, limit);
  },
  forceUpdateAllIdioms: async () => {
    localStorage.removeItem('idiom_bank_version');
    await window.IdiomBankDB.clearAll();
    idiomLoadingPromise = null;
    idiomLoadStarted = false;
    await loadIdiomBank();
  },
};
