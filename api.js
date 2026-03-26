// api.js
(function () {
  const ALL_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  let loadingPromise = null;
  let levelsLoaded = new Set();
  let backgroundLoadingPromise = null;

  async function loadLevel(level) {
    console.log(`📥 loadLevel: Начинаем загрузку уровня ${level}`);

    const response = await fetch(`dict-${level}.json`);
    const words = await response.json();

    console.log(
      `📊 loadLevel: Загружено ${words.length} слов из файла dict-${level}.json`,
    );
    console.log(
      `📝 loadLevel: Первые 5 слов:`,
      words.slice(0, 5).map(w => w.en),
    );

    // Добавляем поле cefr к каждому слову
    const wordsWithCefr = words.map(w => ({
      ...w,
      cefr: level,
    }));

    console.log(
      `🏷️ loadLevel: Добавлено поле cefr=${level} к ${wordsWithCefr.length} словам`,
    );

    // Сохраняем в IndexedDB
    await window.WordBankDB.saveWordsBatch(wordsWithCefr);

    console.log(`✅ loadLevel: Уровень ${level} успешно сохранён в IndexedDB`);

    // Проверяем сколько слов реально сохранилось
    const db = await window.WordBankDB.openDB();
    const tx = db.transaction('words', 'readonly');
    const store = tx.objectStore('words');
    const index = store.index('cefr');

    const count = await new Promise(resolve => {
      const req = index.count(level);
      req.onsuccess = () => resolve(req.result);
    });

    console.log(
      `🔍 loadLevel: Проверка - в IndexedDB ${count} слов уровня ${level}`,
    );

    if (count !== words.length) {
      console.warn(
        `⚠️ loadLevel: Расхождение! Файл: ${words.length}, БД: ${count}, разница: ${words.length - count}`,
      );
    }

    levelsLoaded.add(level);
    console.log(`✅ Уровень ${level} загружен`);
  }

  async function backgroundLoad() {
    const remaining = ALL_LEVELS.filter(lvl => !levelsLoaded.has(lvl));
    console.log('🔄 Начинаем фоновую загрузку уровней:', remaining);

    for (const level of remaining) {
      await loadLevel(level);
    }

    // Автоматически переключаем на 'all' после загрузки всех уровней
    if (
      window.user_settings &&
      window.user_settings.bankWordLevel === 'A1' &&
      !window.user_settings.bankWordLevelExplicit
    ) {
      console.log('🚀 Все уровни загружены, переключаем на все слова');
      window.user_settings.bankWordLevel = 'all';
      window.user_settings.bankWordLevelExplicit = false;
      window.markProfileDirty?.('usersettings', window.user_settings);
      if (window.toast) {
        window.toast(
          'Теперь доступны все уровни слов! 🚀',
          'success',
          'auto_awesome',
        );
      }
    }
  }

  // Загрузка словаря в IndexedDB (быстрый старт с A1)
  async function loadWordBank() {
    console.log('🔍 loadWordBank вызван');

    // Проверяем доступность WordBankDB
    if (!window.WordBankDB) {
      console.error('❌ window.WordBankDB не доступен!');
      return;
    }

    // Если уже загружается, ждём завершения
    if (loadingPromise) {
      console.log('🔍 loadWordBank: Уже загружается, ждём завершения...');
      return loadingPromise;
    }

    loadingPromise = (async () => {
      console.log('🔍 loadWordBank: Начинаем быструю загрузку...');

      // Проверяем, загружен ли уже словарь
      const loaded = await window.WordBankDB.isBankLoaded();
      console.log('🔍 loadWordBank: Словарь уже загружен?', loaded);

      if (loaded) {
        console.log('✅ loadWordBank: Словарь уже загружен');
        return;
      }

      console.log(
        '📥 loadWordBank: Загружаем только A1 для быстрого старта...',
      );

      // Загружаем только A1 для быстрого старта
      await loadLevel('A1');

      // Запускаем фоновую загрузку остальных уровней
      if (!backgroundLoadingPromise) {
        backgroundLoadingPromise = backgroundLoad().catch(console.warn);
      }
    })();

    return loadingPromise;
  }

  // Поиск слов по английскому префиксу
  async function searchWords(prefix, limit = 15) {
    if (!prefix) return [];
    await loadWordBank();
    return window.WordBankDB.searchWords(prefix, limit);
  }

  // Поиск слов по русскому префиксу
  async function searchRussian(prefix, limit = 15) {
    if (!prefix) return [];
    await loadWordBank();
    return window.WordBankDB.searchRussian(prefix, limit);
  }

  // Получение случайного слова с фильтрацией по уровню
  async function getRandomNewWord(level = 'all') {
    if (!window.WordBankDB) {
      console.error('❌ window.WordBankDB не доступен в getRandomNewWord!');
      return null;
    }

    await loadWordBank();
    return window.WordBankDB.getRandomWord(level);
  }

  // Простая диагностика словаря
  async function debugWordBank() {
    console.log('🔬 debugWordBank: Начинаем диагностику...');

    if (!window.WordBankDB) {
      console.error('❌ window.WordBankDB не доступен!');
      return null;
    }

    try {
      const db = await window.WordBankDB.openDB();
      const tx = db.transaction('words', 'readonly');
      const store = tx.objectStore('words');

      // Получаем все слова
      const allWords = await new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      console.log(
        `📊 debugWordBank: Всего слов в IndexedDB: ${allWords.length}`,
      );

      // Группируем по уровням
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

      return {
        total: allWords.length,
        byLevel,
      };
    } catch (error) {
      console.error('❌ debugWordBank: Ошибка диагностики:', error);
      return null;
    }
  }

  // Экспортируем API глобально
  window.WordAPI = {
    loadWordBank,
    searchWords,
    searchRussian,
    getRandomNewWord,
    debugWordBank,
    levelsLoaded, // Для отслеживания загруженных уровней
  };
})();
