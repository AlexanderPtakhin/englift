// Обновленная версия api.js с версионированием и оптимизациями
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
        console.log('📋 Манифест не найден, используем значения по умолчанию');
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
    console.log('📋 Манифест версий загружен:', dataManifest);
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

  console.log(
    `🔍 Проверка версии ${level}: хранимая=${storedVersion}, текущая=${currentVersion}`,
  );

  if (storedVersion !== currentVersion) {
    console.log(`🔄 Уровень ${level} устарел, нужно обновить`);
    return false; // Нужно обновить
  }

  return true; // Актуальная версия
}

// Очистка уровня при обновлении
async function clearLevel(level) {
  console.log(`🗑️ Очищаем уровень ${level} из IndexedDB`);

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
        console.log(`✅ Уровень ${level} очищен`);
        resolve();
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// Обновленная функция загрузки уровня с версионированием
async function loadLevel(level) {
  console.log(`📥 loadLevel: Начинаем загрузку уровня ${level}`);

  // Проверяем версию перед загрузкой
  const isCurrentVersion = await checkLevelVersion(level);
  const isLoaded = await window.WordBankDB.isBankLoaded();

  if (isLoaded && isCurrentVersion) {
    console.log(`✅ Уровень ${level} уже загружен и актуален`);
    levelsLoaded.add(level);
    return;
  }

  // Если версия устарела, очищаем старые данные
  if (isLoaded && !isCurrentVersion) {
    await clearLevel(level);
  }

  try {
    const response = await fetch(`dict-${level}.json`);
    const words = await response.json();

    console.log(
      `📊 loadLevel: Загружено ${words.length} слов из файла dict-${level}.json`,
    );

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

    console.log(`✅ Уровень ${level} успешно загружен и сохранен`);
    levelsLoaded.add(level);
  } catch (error) {
    console.error(`❌ Ошибка загрузки уровня ${level}:`, error);
    throw error;
  }
}

// Оптимизированная фоновая загрузка - параллельная
async function backgroundLoad() {
  const remaining = ALL_LEVELS.filter(lvl => !levelsLoaded.has(lvl));
  console.log('🔄 Начинаем фоновую загрузку уровней:', remaining);

  if (remaining.length === 0) {
    console.log('✅ Все уровни уже загружены');
    return;
  }

  try {
    // Загружаем все файлы параллельно
    const levelPromises = remaining.map(async level => {
      console.log(`📥 Параллельная загрузка ${level}...`);
      const response = await fetch(`dict-${level}.json`);
      const words = await response.json();

      return { level, words };
    });

    const levelData = await Promise.all(levelPromises);

    // Сохраняем последовательно (чтобы не перегружать IndexedDB)
    for (const { level, words } of levelData) {
      console.log(`💾 Сохраняем уровень ${level} в IndexedDB...`);

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
      console.log(`✅ Уровень ${level} сохранен`);
    }

    console.log('🎉 Все уровней успешно загружены в фоновом режиме');
  } catch (error) {
    console.error('❌ Ошибка фоновой загрузки:', error);
  }
}

// Обновленная функция loadWordBank с версионированием
async function loadWordBank() {
  console.log('🔍 loadWordBank вызван');

  if (!window.WordBankDB) {
    console.error('❌ window.WordBankDB не доступен!');
    return;
  }

  if (loadingPromise) {
    console.log('🔍 loadWordBank: Уже загружается, ждём завершения...');
    return loadingPromise;
  }

  loadingPromise = (async () => {
    console.log('🔍 loadWordBank: Начинаем быструю загрузку...');

    // Загружаем манифест версий
    await loadDataManifest();

    // Проверяем, загружен ли уже словарь
    const loaded = await window.WordBankDB.isBankLoaded();
    console.log('🔍 loadWordBank: Словарь уже загружен?', loaded);

    if (loaded) {
      console.log('✅ loadWordBank: Словарь уже загружен');
      return;
    }

    console.log('📥 loadWordBank: Загружаем только A1 для быстрого старта...');
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
  console.log('🔄 Принудительное обновление всех уровней...');

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

  console.log('✅ Все уровни принудительно обновлены');
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
      console.error('❌ window.WordBankDB не доступен в getRandomNewWord!');
      return null;
    }
    await loadWordBank();
    return window.WordBankDB.getRandomWord(level);
  },
  debugWordBank: async () => {
    console.log('🔬 debugWordBank: Начинаем диагностику...');
    if (!window.WordBankDB) {
      console.error('❌ window.WordBankDB не доступен!');
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
      console.log(
        `📊 debugWordBank: Всего слов в IndexedDB: ${allWords.length}`,
      );
      const byLevel = {};
      for (const word of allWords) {
        const level = word.cefr;
        if (!byLevel[level]) byLevel[level] = [];
        byLevel[level].push(word);
      }
      console.log('📊 debugWordBank: Распределение по уровням:');
      for (const [level, words] of Object.entries(byLevel)) {
        console.log(`  ${level}: ${words.length} слов`);
      }
      return { total: allWords.length, byLevel };
    } catch (error) {
      console.error('❌ debugWordBank: Ошибка диагностики:', error);
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

console.log(
  '🚀 Обновленный WordAPI загружен с версионированием и оптимизациями',
);
