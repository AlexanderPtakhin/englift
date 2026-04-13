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
    let manifest = null;
    try {
      manifest = await fetch('data-manifest.json').then(r => r.json());
      console.log('[API] Манифест загружен из data-manifest.json');
    } catch {
      try {
        manifest = await fetch('./data-manifest.json').then(r => r.json());
        console.log('[API] Манифест загружен из ./data-manifest.json');
      } catch {
        console.log(
          '[API] Манифест не найден, используем значения по умолчанию',
        );
        manifest = {
          A1: { version: '2.0' },
          A2: { version: '2.0' },
          B1: { version: '2.0' },
          B2: { version: '2.0' },
          C1: { version: '2.0' },
          C2: { version: '2.0' },
        };
      }
    }
    dataManifest = manifest;
    return dataManifest;
  } catch (error) {
    console.error('Ошибка загрузки манифеста:', error);
    return {
      A1: { version: '2.0' },
      A2: { version: '2.0' },
      B1: { version: '2.0' },
      B2: { version: '2.0' },
      C1: { version: '2.0' },
      C2: { version: '2.0' },
    };
  }
}

// Проверка версии уровня по localStorage
async function checkLevelVersion(level) {
  const manifest = await loadDataManifest();
  if (!manifest) return true;

  const storedVersion = localStorage.getItem(`dict_${level}_version`);
  const currentVersion = manifest?.[level]?.version;
  if (!currentVersion) return true;

  // Если в localStorage нет версии, но данные уже есть в IndexedDB —
  // не трогаем, просто восстанавливаем метаданные
  if (!storedVersion) {
    const hasData = await isLevelLoaded(level);
    if (hasData) {
      console.log(
        `[API] Level ${level}: data exists in IndexedDB, restoring version metadata`,
      );
      localStorage.setItem(`dict_${level}_version`, currentVersion);
      return true;
    }
    return false;
  }

  return storedVersion === currentVersion;
}

// Получить список уровней которых нет или они устарели
async function getMissingLevels() {
  const manifest = await loadDataManifest();
  return ALL_LEVELS.filter(lvl => {
    if (levelsLoaded.has(lvl)) return false;
    const stored = localStorage.getItem(`dict_${lvl}_version`);
    const current = manifest?.[lvl]?.version;
    return !stored || stored !== current;
  });
}

// Очистка конкретного уровня в IndexedDB
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

// Проверяет, есть ли конкретный уровень в IndexedDB
async function isLevelLoaded(level) {
  try {
    const db = await window.WordBankDB.openDB();
    const tx = db.transaction('words', 'readonly');
    const store = tx.objectStore('words');
    const index = store.index('cefr');
    const range = IDBKeyRange.only(level);
    return new Promise((resolve, reject) => {
      const req = index.count(range);
      req.onsuccess = () => resolve(req.result > 0);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    return false;
  }
}

// Загрузка одного уровня
async function loadLevel(level) {
  console.log(`[API] Loading level ${level}...`);

  // Проверяем версию конкретного уровня по localStorage
  const isCurrentVersion = await checkLevelVersion(level);

  if (isCurrentVersion && levelsLoaded.has(level)) {
    console.log(`[API] Level ${level} already loaded and current, skipping`);
    return;
  }

  // Версия устарела — чистим только этот уровень
  if (!isCurrentVersion) {
    console.log(`[API] Level ${level} version outdated, clearing...`);
    await clearLevel(level);
  }

  try {
    console.log(`[API] Fetching ${level}/dict-${level}.json...`);
    const response = await fetch(`${level}/dict-${level}.json`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const words = await response.json();
    console.log(`[API] Level ${level} loaded: ${words.length} words`);

    const wordsWithIdAndCefr = words.map((word, index) => ({
      ...word,
      id: `${word.en}_${level}_${index}`,
      cefr: level,
    }));

    await window.WordBankDB.saveWordsBatch(wordsWithIdAndCefr);
    console.log(`[API] Level ${level} saved to IndexedDB`);

    const manifest = await loadDataManifest();
    if (manifest?.[level]?.version) {
      localStorage.setItem(`dict_${level}_version`, manifest[level].version);
    }

    levelsLoaded.add(level);
    console.log(`[API] Level ${level} loading completed ✅`);
  } catch (error) {
    console.error(`[API] Error loading level ${level}:`, error);
    throw error;
  }
}

// Фоновая загрузка — всегда проверяет что реально не хватает
async function backgroundLoad() {
  // ✅ Используем localStorage а не только in-memory levelsLoaded
  const remaining = await getMissingLevels();

  if (remaining.length === 0) {
    console.log(
      '[API] Все уровни уже загружены, фоновая загрузка не требуется',
    );
    return;
  }

  console.log('[API] Фоновая загрузка уровней:', remaining);

  try {
    // Загружаем все файлы параллельно
    const levelPromises = remaining.map(async level => {
      try {
        const response = await fetch(`${level}/dict-${level}.json`);
        if (!response.ok) {
          console.warn(
            `[API] Уровень ${level} недоступен (${response.status}), пропускаем`,
          );
          return null;
        }
        const words = await response.json();
        console.log(
          `[API] Фоновая загрузка: ${level} загружен, ${words.length} слов`,
        );
        return { level, words };
      } catch (e) {
        console.warn(`[API] Ошибка загрузки ${level}:`, e.message);
        return null;
      }
    });

    const levelData = (await Promise.all(levelPromises)).filter(Boolean);
    console.log(`[API] Фоновая загрузка: ${levelData.length} уровней скачано`);

    // Сохраняем последовательно чтобы не перегружать IndexedDB
    for (const { level, words } of levelData) {
      const isCurrentVersion = await checkLevelVersion(level);
      const isLoaded = await isLevelLoaded(level);

      if (isLoaded && isCurrentVersion) {
        console.log(`[API] ${level} already current, skipping`);
        levelsLoaded.add(level);
        continue;
      }

      if (isLoaded && !isCurrentVersion) {
        console.log(`[API] ${level} version outdated, clearing...`);
        await clearLevel(level);
      }

      const wordsWithIdAndCefr = words.map((word, index) => ({
        ...word,
        id: `${word.en}_${level}_${index}`,
        cefr: level,
      }));

      await window.WordBankDB.saveWordsBatch(wordsWithIdAndCefr);

      const manifest = await loadDataManifest();
      if (manifest?.[level]?.version) {
        localStorage.setItem(`dict_${level}_version`, manifest[level].version);
      }

      levelsLoaded.add(level);
      cachedWordBank = null; // Сбрасываем кеш чтобы новые слова были доступны
      cachedWordBankByLevel = null;
      console.log(`[API] Фоновая загрузка: ${level} ✅`);
    }

    console.log('[API] Фоновая загрузка завершена 🎉');
  } catch (error) {
    console.error('Ошибка фоновой загрузки:', error);
    // Сбрасываем промис чтобы можно было попробовать снова
    backgroundLoadingPromise = null;
  }
}

// Главная функция загрузки словаря
async function loadWordBank() {
  if (!window.WordBankDB) {
    console.error('[API] ❌ WordBankDB не доступен!');
    return;
  }
  console.log('[API] Загрузка словаря...');

  // Если загрузка уже идёт — ждём её
  if (loadingPromise) {
    console.log(
      '[API] Dictionary already loading, waiting for existing promise...',
    );
    return loadingPromise;
  }

  if (dictionaryLoadStarted) {
    console.log('[API] Dictionary load already started, skipping duplicate');
    return;
  }

  dictionaryLoadStarted = true;
  loadingPromise = (async () => {
    try {
      await loadDataManifest();

      const isAnythingLoaded = await window.WordBankDB.isBankLoaded();

      if (isAnythingLoaded) {
        // ✅ Восстанавливаем levelsLoaded из localStorage (после перезагрузки страницы он пустой)
        const manifest = dataManifest;
        ALL_LEVELS.forEach(lvl => {
          const stored = localStorage.getItem(`dict_${lvl}_version`);
          if (stored && stored === manifest?.[lvl]?.version) {
            levelsLoaded.add(lvl);
          }
        });

        const missing = await getMissingLevels();

        if (missing.length === 0) {
          console.log('[API] Dictionary already fully loaded ✅');
        } else {
          // ✅ Ключевой фикс: есть хоть что-то → показываем сразу
          // но фоновую загрузку ОБЯЗАТЕЛЬНО запускаем
          console.log(
            '[API] Dictionary partially loaded, missing levels:',
            missing,
          );
          console.log(
            '[API] Starting background load to complete dictionary...',
          );
          if (!backgroundLoadingPromise) {
            backgroundLoadingPromise = backgroundLoad().catch(e => {
              console.warn('[API] Background load failed:', e);
              backgroundLoadingPromise = null; // сбрасываем чтобы можно было retry
            });
          }
        }

        try {
          const debugInfo = await window.WordAPI.debugWordBank();
          if (debugInfo) console.log('[API] Dictionary debug info:', debugInfo);
        } catch (e) {}

        return;
      }

      // IndexedDB пустая — грузим A1 синхронно, остальное фоном
      console.log('[API] Dictionary not loaded, starting with level A1...');
      cachedWordBank = null;
      cachedWordBankByLevel = null;
      await loadLevel('A1');

      console.log('[API] Starting background load for remaining levels...');
      if (!backgroundLoadingPromise) {
        backgroundLoadingPromise = backgroundLoad().catch(e => {
          console.warn('[API] Background load failed:', e);
          backgroundLoadingPromise = null;
        });
      }
    } catch (error) {
      console.error('[API] Error loading dictionary:', error);
      dictionaryLoadStarted = false;
      loadingPromise = null;
      throw error;
    }
  })();

  return loadingPromise;
}

// Кеш банка слов в памяти
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
  cachedWordBank = null;
  cachedWordBankByLevel = null;
  ALL_LEVELS.forEach(level => localStorage.removeItem(`dict_${level}_version`));
  const db = await window.WordBankDB.openDB();
  const tx = db.transaction('words', 'readwrite');
  await tx.objectStore('words').clear();
  levelsLoaded.clear();
  loadingPromise = null;
  dictionaryLoadStarted = false;
  backgroundLoadingPromise = null;
  await loadWordBank();
}

// Экспорт API
window.WordAPI = {
  loadWordBank,
  searchWords: async (prefix, limit = 15) => {
    if (!prefix) return [];
    if (!cachedWordBank) {
      await loadWordBank();
    }
    return window.WordBankDB.searchWords(prefix, limit);
  },
  searchRussian: async (prefix, limit = 15) => {
    if (!prefix) return [];
    if (!cachedWordBank) {
      await loadWordBank();
    }
    return window.WordBankDB.searchRussian(prefix, limit);
  },
  getRandomNewWord: async (level = 'all') => {
    if (!window.WordBankDB) {
      console.error('WordBankDB не доступен!');
      return null;
    }
    // Сначала проверяем кеш, только если пустой - грузим
    if (!cachedWordBank) {
      await loadWordBank();
    }
    const bank = await getCachedWordBank();
    let pool = level === 'all' ? bank : cachedWordBankByLevel[level] || [];
    if (!pool.length) return null;
    const userWordsSet = new Set(
      (window.words || []).map(w => w.en.toLowerCase()),
    );
    const available = pool.filter(w => !userWordsSet.has(w.en.toLowerCase()));
    if (available.length === 0) return null;
    return available[Math.floor(Math.random() * available.length)];
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
  forceUpdateAllLevels,
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
// ИДИОМЫ
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
    const userIdiomsSet = new Set(
      (window.idioms || []).map(i => i.idiom.toLowerCase()),
    );
    const available = allIdioms.filter(
      i => !userIdiomsSet.has(i.idiom.toLowerCase()),
    );
    if (available.length === 0) return null;
    return available[Math.floor(Math.random() * available.length)];
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
