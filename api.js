// ============================================================
// API MODULE - Внешние сервисы для перевода и примеров
// ============================================================

// Локальный банк слов
let wordBank = null;

const BANK_CACHE_KEY = 'englift_wordbank_cache';
const BANK_VERSION_KEY = 'englift_wordbank_version';
const CURRENT_BANK_VERSION = '2026-03-01-v5';

// Emergency fallback если JSON не загрузится
const EMERGENCY_WORDS = [
  {
    en: 'go',
    ru: 'идти / ехать',
    phonetic: '/ɡoʊ/',
    examples: [{ text: 'I go to the market every Sunday.', translation: '' }],
    tags: ['A1', 'verb', 'everyday'],
  },
  {
    en: 'come',
    ru: 'приходить / приезжать',
    phonetic: '/kʌm/',
    examples: [{ text: 'She came home late yesterday.', translation: '' }],
    tags: ['A1', 'verb', 'everyday'],
  },
  {
    en: 'eat',
    ru: 'есть / кушать',
    phonetic: '/iːt/',
    examples: [
      { text: 'We eat dinner together as a family.', translation: '' },
    ],
    tags: ['A1', 'verb', 'everyday'],
  },
  {
    en: 'drink',
    ru: 'пить / напиток',
    phonetic: '/drɪŋk/',
    examples: [
      { text: 'He drinks a glass of water every morning.', translation: '' },
    ],
    tags: ['A1', 'verb', 'everyday'],
  },
  {
    en: 'sleep',
    ru: 'спать',
    phonetic: '/sliːp/',
    examples: [{ text: 'I usually sleep for eight hours.', translation: '' }],
    tags: ['A1', 'verb', 'everyday'],
  },
];

/**
 * Загружает банк слов — сначала пытается из dictionary.json,
 * если не получилось — fallback на встроенный WORD_BANK
 */
async function loadWordBank() {
  console.log('🔍 loadWordBank started');

  // Принудительная очистка кеша для отладки
  if (
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1') &&
    window.DEBUG
  ) {
    console.log('Отладочный режим: принудительно очищаем кеш word bank');
    localStorage.removeItem(BANK_CACHE_KEY);
    localStorage.removeItem(BANK_VERSION_KEY);
    wordBank = null;
  }

  if (wordBank) return wordBank;

  // 1. Проверяем кэш
  const cachedVersion = localStorage.getItem(BANK_VERSION_KEY);
  const cachedData = localStorage.getItem(BANK_CACHE_KEY);

  // Принудительно очищаем кеш если версия изменилась
  if (cachedVersion !== CURRENT_BANK_VERSION) {
    console.log(
      `Версия изменилась с ${cachedVersion} на ${CURRENT_BANK_VERSION}, очищаем кеш`,
    );
    localStorage.removeItem(BANK_CACHE_KEY);
    localStorage.removeItem(BANK_VERSION_KEY);
  }

  if (cachedVersion === CURRENT_BANK_VERSION && cachedData) {
    try {
      wordBank = JSON.parse(cachedData);

      // Конвертируем примеры в новый формат если нужно
      wordBank = wordBank.map(word => {
        // Если examples уже в правильном формате (массив объектов)
        if (
          word.examples &&
          Array.isArray(word.examples) &&
          word.examples.length > 0 &&
          typeof word.examples[0] === 'object' &&
          word.examples[0].text
        ) {
          return word;
        }

        // Если examples - это массив строк или смешанный формат, конвертируем все в объекты
        if (word.examples && Array.isArray(word.examples)) {
          return {
            ...word,
            examples: word.examples.map(ex => {
              if (typeof ex === 'string') {
                // Это строка - создаем объект
                return { text: ex, translation: '' };
              } else if (typeof ex === 'object' && ex.text) {
                // Это объект - проверяем наличие translation
                return {
                  text: ex.text || '',
                  translation: ex.translation || '',
                };
              } else {
                // Неизвестный формат
                return { text: '', translation: '' };
              }
            }),
          };
        }

        // Если examples нет или неправильный формат
        return {
          ...word,
          examples: [],
        };
      });

      console.log(`Кэш: ${wordBank.length} слов (v${CURRENT_BANK_VERSION})`);
      console.log('Пример конвертированного слова из кэша:', wordBank[0]);
      return wordBank;
    } catch (e) {
      console.warn('Кэш повреждён, загружаем заново');
    }
  }

  // 2. Пробуем загрузить JSON
  try {
    console.log('Пытаемся загрузить dictionary.json...');
    console.log('URL запроса:', './dictionary.json');

    const response = await fetch('./dictionary.json', { cache: 'no-cache' });

    if (!response.ok) {
      console.error('Failed to load dictionary:', response.status);
      if (typeof window !== 'undefined' && window.toast) {
        window.toast(
          '⚠️ Не удалось загрузить словарь. Используются базовые слова.',
          'warning',
        );
      }
      return [];
    }

    const data = await response.json();
    console.log('Dictionary loaded successfully');

    // Конвертируем примеры в новый формат если нужно
    wordBank = data.map(word => {
      // Если examples уже в правильном формате (массив объектов)
      if (
        word.examples &&
        Array.isArray(word.examples) &&
        word.examples.length > 0 &&
        typeof word.examples[0] === 'object' &&
        word.examples[0].text
      ) {
        return word;
      }

      // Если examples - это массив строк или смешанный формат, конвертируем все в объекты
      if (word.examples && Array.isArray(word.examples)) {
        return {
          ...word,
          examples: word.examples.map(ex => {
            if (typeof ex === 'string') {
              // Это строка - создаем объект
              return { text: ex, translation: '' };
            } else if (typeof ex === 'object' && ex.text) {
              // Это объект - проверяем наличие translation
              return {
                text: ex.text || '',
                translation: ex.translation || '',
              };
            } else {
              // Неизвестный формат
              return { text: '', translation: '' };
            }
          }),
        };
      }

      // Если examples нет или неправильный формат
      return {
        ...word,
        examples: [],
      };
    });

    console.log(`Успешно загружено ${wordBank.length} слов из dictionary.json`);
    console.log('Пример конвертированного слова:', wordBank[0]);
    console.log(
      'Проверяем слово "stand" в загруженных данных:',
      wordBank.find(w => w.en === 'stand') ? 'НАЙДЕНО' : 'НЕ НАЙДЕНО',
    );
    console.log(
      'Первые 3 слова:',
      wordBank
        .slice(0, 3)
        .map(w => `${w.en}: ${w.phonetic || 'нет транскрипции'}`),
    );

    // Сохраняем в кэш
    localStorage.setItem(BANK_CACHE_KEY, JSON.stringify(wordBank));
    localStorage.setItem(BANK_VERSION_KEY, CURRENT_BANK_VERSION);

    return wordBank;
  } catch (error) {
    console.error('Error loading dictionary:', error);
    if (typeof window !== 'undefined' && window.toast) {
      window.toast(
        '⚠️ Ошибка загрузки словаря. Используются базовые слова.',
        'warning',
      );
    }

    // Emergency fallback
    wordBank = EMERGENCY_WORDS;
    console.log(`Emergency fallback → ${wordBank.length} слов`);
    return wordBank;
  }
}

// Глобальный словарь популярных слов для использования в разных функциях
const SPECIAL_WORDS = {
  apple: ['noun', 'food', 'fruit', 'common'],
  banana: ['noun', 'food', 'fruit', 'common'],
  computer: ['noun', 'technology', 'common'],
  phone: ['noun', 'technology', 'common'],
  happy: ['adjective', 'emotion', 'common'],
  sad: ['adjective', 'emotion', 'common'],
  run: ['verb', 'action', 'common'],
  go: ['verb', 'action', 'common'],
  make: ['verb', 'action', 'common'],
  take: ['verb', 'action', 'common'],
  get: ['verb', 'action', 'common'],
  eat: ['verb', 'action', 'common'],
  sleep: ['verb', 'action', 'common'],
  work: ['verb', 'work', 'common'],
  play: ['verb', 'action', 'common'],
  study: ['verb', 'work', 'common'],
  learn: ['verb', 'work', 'common'],
  beautiful: ['adjective', 'positive', 'common'],
  important: ['adjective', 'common'],
  big: ['adjective', 'common'],
  small: ['adjective', 'common'],
  good: ['adjective', 'positive', 'common'],
  bad: ['adjective', 'negative', 'common'],
  book: ['noun', 'education', 'common'],
  car: ['noun', 'transport', 'common'],
  house: ['noun', 'place', 'common'],
  school: ['noun', 'education', 'place', 'common'],
  friend: ['noun', 'person', 'common'],
  family: ['noun', 'person', 'common'],
  water: ['noun', 'common'],
  food: ['noun', 'common'],
  time: ['noun', 'common'],
  day: ['noun', 'time', 'common'],
  night: ['noun', 'time', 'common'],
  morning: ['noun', 'time', 'common'],
};

// Конфигурация API
const API_CONFIG = {
  MyMemory: {
    URL: 'https://api.mymemory.translated.net/get',
    EMAIL: 'alex.ptakhin@gmail.com', // Ваш email для повышенных лимитов
  },
  FreeDictionary: {
    URL: 'https://api.dictionaryapi.dev/api/v2/entries/en',
    FALLBACK_URL: 'https://api.dictionaryapi.dev/api/v1/entries/en', // Резервный URL
  },
};

// Кеширование запросов
const apiCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 минут

// Утилиты
function getCacheKey(service, query) {
  return `${service}:${query.toLowerCase()}`;
}

function isCacheValid(timestamp) {
  return Date.now() - timestamp < CACHE_DURATION;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\//g, '&#x2F;');
}

// ============================================================
// MYMEMORY API - Перевод
// ============================================================

/**
 * Переводит текст с английского на русский через MyMemory API
 * @param {string} text - Текст для перевода
 * @returns {Promise<{translation: string, confidence: number}>}
 */
async function translateText(text) {
  const cacheKey = getCacheKey('mymemory', text);
  const cached = apiCache.get(cacheKey);

  if (cached && isCacheValid(cached.timestamp)) {
    return cached.data;
  }

  try {
    const url = `${API_CONFIG.MyMemory.URL}?q=${encodeURIComponent(text)}&langpair=en|ru&de=${encodeURIComponent(API_CONFIG.MyMemory.EMAIL)}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`MyMemory API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.responseStatus === 200 && data.responseData.translatedText) {
      const result = {
        translation: data.responseData.translatedText,
        confidence: data.responseData.match || 0,
      };

      // Кешируем результат
      apiCache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
      });

      return result;
    } else {
      console.error('Translation API unexpected response:', data);
      throw new Error('Translation not found');
    }
  } catch (error) {
    console.error('Translation error:', error);
    throw new Error('Не удалось выполнить перевод');
  }
}

// ============================================================
// FREE DICTIONARY API - Примеры и теги
// ============================================================

/**
 * Получает определения, примеры и теги для английского слова
 * @param {string} word - Английское слово
 * @returns {Promise<{examples: string[], tags: string[], definitions: string[]}>}
 */
async function getWordData(word) {
  const cacheKey = getCacheKey('dictionary', word);
  const cached = apiCache.get(cacheKey);

  if (cached && isCacheValid(cached.timestamp)) {
    return cached.data;
  }

  // Пробуем основной URL, потом fallback
  const urls = [
    `${API_CONFIG.FreeDictionary.URL}/${encodeURIComponent(word)}`,
    `${API_CONFIG.FreeDictionary.FALLBACK_URL}/${encodeURIComponent(word)}`,
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 404) {
          continue; // Пробуем следующий URL
        }
        throw new Error(`Dictionary API error: ${response.status}`);
      }

      const data = await response.json();

      // Проверяем, что данные не пустые
      if (!data || (Array.isArray(data) && data.length === 0)) {
        continue;
      }

      // Обрабатываем данные из всех доступных определений
      const examples = [];
      const tags = new Set();
      const definitions = [];

      const entries = Array.isArray(data) ? data : [data];

      entries.forEach((entry, entryIndex) => {
        // Собираем теги из частей речи с приоритезацией
        if (entry.meanings) {
          // Сортируем meanings по количеству определений (самые используемые первые)
          const sortedMeanings = entry.meanings.sort(
            (a, b) =>
              (b.definitions ? b.definitions.length : 0) -
              (a.definitions ? a.definitions.length : 0),
          );

          sortedMeanings.forEach((meaning, meaningIndex) => {
            // Добавляем часть речи как тег
            if (meaning.partOfSpeech) {
              const partOfSpeech = meaning.partOfSpeech.toLowerCase();

              // Фильтруем странные части речи для популярных слов
              const isCommonWord = SPECIAL_WORDS[word.toLowerCase()];
              if (isCommonWord) {
                // Для популярных слов используем только основные части речи
                const mainPos = ['noun', 'verb', 'adjective', 'adverb'];
                if (mainPos.includes(partOfSpeech)) {
                  tags.add(partOfSpeech);
                }
              } else {
                tags.add(partOfSpeech);
              }
            }

            // Собираем примеры и определения
            if (meaning.definitions) {
              meaning.definitions.forEach((def, defIndex) => {
                // Добавляем определение
                if (def.definition) {
                  definitions.push(def.definition);
                }

                // Добавляем примеры - ищем во всех определениях!
                if (def.example) {
                  examples.push(def.example);
                }
              });
            }
          });
        } else {
          // Нет meanings - пропускаем эту запись
        }
      });

      // Генерируем дополнительные теги на основе анализа слова
      const generatedTags = generateTags(word, examples);
      generatedTags.forEach(tag => tags.add(tag));

      // Если примеров от API нет, генерируем свои
      if (examples.length === 0) {
        const generatedExamples = generateExamples(word);
        examples.push(...generatedExamples);
      }

      const result = {
        examples: examples.slice(0, 3), // Ограничиваем 3 примерами
        tags: Array.from(tags).slice(0, 5), // Ограничиваем 5 тегами
        definitions: definitions.slice(0, 2), // Ограничиваем 2 определениями
      };

      // Если нашли хоть что-то полезное, кешируем и возвращаем
      if (result.examples.length > 0 || result.tags.length > 0) {
        // Кешируем результат
        apiCache.set(cacheKey, {
          data: result,
          timestamp: Date.now(),
        });

        return result;
      } else {
        continue;
      }
    } catch (error) {
      console.error(`Dictionary error for ${url}:`, error);
      continue; // Пробуем следующий URL
    }
  }

  // Если все URL не сработали, генерируем базовые теги и примеры
  const basicTags = generateTags(word, []);
  const generatedExamples = generateExamples(word);

  const fallbackResult = {
    examples: generatedExamples,
    tags: basicTags,
    definitions: [],
  };

  // Кешируем fallback результат на shorter time
  apiCache.set(cacheKey, {
    data: fallbackResult,
    timestamp: Date.now(),
  });

  return fallbackResult;
}

/**
 * Генерирует теги на основе анализа слова и примеров
 * @param {string} word - Слово для анализа
 * @param {string[]} examples - Массив примеров
 * @returns {string[]} - Массив тегов
 */
function generateTags(word, examples) {
  const tags = new Set();
  const lowerWord = word.toLowerCase();

  // Анализируем окончания слова для определения времени/формы
  if (lowerWord.endsWith('ing')) {
    tags.add('verb');
    tags.add('continuous');
  }
  if (lowerWord.endsWith('ed')) {
    tags.add('verb');
    tags.add('past');
  }
  if (
    lowerWord.endsWith('s') &&
    !lowerWord.endsWith('ss') &&
    lowerWord.length > 2
  ) {
    tags.add('plural');
  }

  // Анализируем длину слова (только для непопулярных слов)
  if (!SPECIAL_WORDS[lowerWord]) {
    if (word.length <= 4) tags.add('basic');
    else if (word.length <= 8) tags.add('intermediate');
    else tags.add('advanced');
  }

  // Анализируем примеры для контекстных тегов
  const allText = [word, ...examples].join(' ').toLowerCase();

  // Временные теги
  if (
    allText.includes('time') ||
    allText.includes('when') ||
    allText.includes('day') ||
    allText.includes('morning') ||
    allText.includes('night') ||
    allText.includes('today')
  ) {
    tags.add('time');
  }

  // Люди и места
  if (
    allText.includes('person') ||
    allText.includes('people') ||
    allText.includes('he') ||
    allText.includes('she') ||
    allText.includes('they') ||
    allText.includes('someone')
  ) {
    tags.add('person');
  }

  if (
    allText.includes('place') ||
    allText.includes('where') ||
    allText.includes('here') ||
    allText.includes('there') ||
    allText.includes('location')
  ) {
    tags.add('place');
  }

  // Модальные глаголы
  if (
    allText.includes('can') ||
    allText.includes('will') ||
    allText.includes('might') ||
    allText.includes('could') ||
    allText.includes('would') ||
    allText.includes('should')
  ) {
    tags.add('modal');
  }

  // Еда и напитки (особенно для apple!)
  if (
    allText.includes('eat') ||
    allText.includes('food') ||
    allText.includes('drink') ||
    allText.includes('fruit') ||
    allText.includes('meal') ||
    allText.includes('taste')
  ) {
    tags.add('food');
  }

  // Работа и учеба
  if (
    allText.includes('work') ||
    allText.includes('job') ||
    allText.includes('study') ||
    allText.includes('learn') ||
    allText.includes('school') ||
    allText.includes('education')
  ) {
    tags.add('work');
  }

  // Эмоции и чувства
  if (
    allText.includes('feel') ||
    allText.includes('happy') ||
    allText.includes('sad') ||
    allText.includes('angry') ||
    allText.includes('love') ||
    allText.includes('emotion')
  ) {
    tags.add('emotion');
  }

  // Технологии
  if (
    allText.includes('computer') ||
    allText.includes('phone') ||
    allText.includes('internet') ||
    allText.includes('technology') ||
    allText.includes('digital') ||
    allText.includes('online')
  ) {
    tags.add('technology');
  }

  // Добавляем общие части речи на основе анализа слова
  if (lowerWord.endsWith('ly') && word.length > 4) {
    tags.add('adverb');
  }

  if (
    lowerWord.endsWith('tion') ||
    lowerWord.endsWith('sion') ||
    lowerWord.endsWith('ment')
  ) {
    tags.add('noun');
    tags.add('abstract');
  }

  if (
    lowerWord.endsWith('ful') ||
    lowerWord.endsWith('less') ||
    lowerWord.endsWith('ous')
  ) {
    tags.add('adjective');
  }

  if (SPECIAL_WORDS[lowerWord]) {
    SPECIAL_WORDS[lowerWord].forEach(tag => tags.add(tag));
  }

  return Array.from(tags);
}

/**
 * Генерирует примеры использования слова на основе шаблонов
 * @param {string} word - Слово для которого генерируем примеры
 * @returns {string[]} - Массив примеров
 */
function generateExamples(word) {
  const lowerWord = word.toLowerCase();
  const examples = [];

  // Определяем тип слова по тегам и окончанию
  const isVerb =
    lowerWord.endsWith('ing') ||
    lowerWord.endsWith('ed') ||
    [
      'run',
      'go',
      'make',
      'take',
      'get',
      'eat',
      'sleep',
      'work',
      'play',
      'study',
      'learn',
    ].includes(lowerWord);

  const isNoun =
    !isVerb &&
    (lowerWord.endsWith('tion') ||
      lowerWord.endsWith('sion') ||
      [
        'apple',
        'banana',
        'computer',
        'phone',
        'book',
        'car',
        'house',
        'school',
        'friend',
      ].includes(lowerWord));

  const isAdjective =
    lowerWord.endsWith('ful') ||
    lowerWord.endsWith('less') ||
    lowerWord.endsWith('ous') ||
    lowerWord.endsWith('y') ||
    [
      'happy',
      'sad',
      'big',
      'small',
      'good',
      'bad',
      'beautiful',
      'important',
    ].includes(lowerWord);

  // Шаблоны для разных типов слов
  if (isVerb) {
    examples.push(`I like to ${word} every day.`);
    examples.push(`She wants to ${word} with her friends.`);
    examples.push(`We can ${word} together tomorrow.`);
  } else if (isNoun) {
    examples.push(`This is a very nice ${word}.`);
    examples.push(`I bought a new ${word} yesterday.`);
    examples.push(`The ${word} is on the table.`);
  } else if (isAdjective) {
    examples.push(`It's very ${word} today.`);
    examples.push(`She looks ${word} in that dress.`);
    examples.push(`This is a ${word} book.`);
  } else {
    // Общие шаблоны для неизвестных слов
    examples.push(`The word "${word}" is important to learn.`);
    examples.push(`I need to remember the word "${word}".`);
    examples.push(`Can you use "${word}" in a sentence?`);
  }

  // Особые случаи для популярных слов
  const specialExamples = {
    apple: [
      'I eat an apple every morning.',
      'The apple tree is in our garden.',
      'An apple a day keeps the doctor away.',
    ],
    banana: [
      'I like yellow bananas.',
      'The banana is very sweet.',
      'Monkeys love to eat bananas.',
    ],
    computer: [
      'I work on my computer every day.',
      'The computer is very fast.',
      'My computer needs more memory.',
    ],
    phone: [
      'I got a new phone for my birthday.',
      'The phone battery is low.',
      'She is talking on the phone.',
    ],
    happy: [
      'I am very happy today.',
      'She looks happy with her new toy.',
      'Happy people live longer.',
    ],
    sad: [
      'He looks sad about the news.',
      'I feel sad when it rains.',
      'Sad movies always make me cry.',
    ],
    go: [
      'I go to school every day.',
      'They want to go home now.',
      "Let's go to the park.",
    ],
    make: [
      'I can make a cake for you.',
      'She wants to make new friends.',
      "Don't make noise in the library.",
    ],
    run: [
      'I run in the park every morning.',
      'She can run very fast.',
      "Let's run together!",
    ],
    eat: [
      'I like to eat breakfast early.',
      'We eat dinner at 7 PM.',
      'What do you want to eat?',
    ],
    work: [
      'I work from home today.',
      'She works hard every day.',
      'My work is very interesting.',
    ],
    play: [
      'Children love to play outside.',
      "Let's play a game together.",
      'I play the guitar in my free time.',
    ],
    study: [
      'I need to study for the exam.',
      'She studies at university.',
      'We study English every evening.',
    ],
    learn: [
      'I want to learn a new language.',
      'She learns very quickly.',
      'What did you learn today?',
    ],
    beautiful: [
      'The sunset is beautiful tonight.',
      'She has beautiful eyes.',
      'What a beautiful dress!',
    ],
    good: [
      'This is a good book.',
      'He is a good student.',
      'Good morning! How are you?',
    ],
    big: [
      'That is a big house.',
      'Elephants are big animals.',
      'I have a big family.',
    ],
    small: [
      'I live in a small town.',
      'The kitten is very small.',
      'She has small hands.',
    ],
    time: [
      'What time is it now?',
      "I don't have time for lunch.",
      "Time flies when you're having fun.",
    ],
    day: [
      'I have a busy day tomorrow.',
      'The day was very sunny.',
      'Have a good day at work!',
    ],
    night: [
      'The night is very dark.',
      'I work at night.',
      'Good night, sleep well!',
    ],
  };

  if (specialExamples[lowerWord]) {
    return specialExamples[lowerWord];
  }

  return examples.slice(0, 3); // Возвращаем до 3 примеров
}

// ============================================================
// КОМБИНИРОВАННАЯ ФУНКЦИЯ
// ============================================================

/**
 * Получает полный набор данных для слова: перевод, примеры, теги
 * @param {string} englishWord - Английское слово
 * @returns {Promise<{translation: string, examples: string[], tags: string[]}>}
 */
async function getCompleteWordData(englishWord) {
  const lowerWord = englishWord.toLowerCase().trim();

  try {
    // Показываем индикатор загрузки
    if (window.showApiLoading) {
      window.showApiLoading(true);
    }

    // Сначала проверяем локальный банк
    const bank = await loadWordBank();
    console.log(`Ищем слово "${lowerWord}" в банке из ${bank.length} слов`);
    console.log(
      'Первые 3 слова в банке:',
      bank.slice(0, 3).map(w => w.en),
    );

    const localEntry = bank.find(w => w.en.toLowerCase() === lowerWord);
    console.log(
      `Результат поиска "${lowerWord}":`,
      localEntry ? 'НАЙДЕНО' : 'НЕ НАЙДЕНО',
    );
    if (localEntry) {
      console.log('Найденная запись:', localEntry);
    }

    if (localEntry) {
      console.log(`Found "${englishWord}" in local bank`);
      // Преобразуем примеры в новый формат
      const examples = localEntry.examples
        ? localEntry.examples.map(e =>
            typeof e === 'string' ? { text: e, translation: '' } : e,
          )
        : [];

      return {
        ru: localEntry.ru,
        examples: examples,
        tags: localEntry.tags || [],
        phonetic: localEntry.phonetic || '',
        confidence: 1.0, // 100% уверенность для локальных данных
      };
    }

    // Если не нашли в банке, идём в API
    console.log(`"${englishWord}" not found in local bank, using API`);

    // Параллельно запрашиваем перевод и данные слова
    const [translationResult, wordData] = await Promise.all([
      translateText(englishWord),
      getWordData(englishWord),
    ]);

    return {
      ru: translationResult.translation,
      examples: wordData.examples,
      tags: wordData.tags,
      confidence: translationResult.confidence,
    };
  } catch (error) {
    console.error('Error getting complete word data:', error);
    throw error;
  } finally {
    // Скрываем индикатор загрузки
    if (window.showApiLoading) {
      window.showApiLoading(false);
    }
  }
}

/**
 * Получает случайное слово из банка, которого нет у пользователя
 * @returns {Promise<Object>} - Случайное слово из банка
 */
async function getRandomNewWord() {
  const bank = await loadWordBank();

  if (!bank || bank.length === 0) {
    console.error('Word bank is empty or failed to load');
    return null;
  }

  console.log('Word bank loaded, length:', bank.length);

  // Получаем слова пользователя из глобального массива (если доступен)
  const userWords = window.words || [];
  console.log('User words length:', userWords.length);

  // Фильтруем слова, которых нет в словаре пользователя
  const available = bank.filter(
    item => !userWords.some(w => w.en.toLowerCase() === item.en.toLowerCase()),
  );

  console.log('Available new words:', available.length);

  if (available.length === 0) {
    // Если все слова уже есть, возвращаем случайное из всего банка
    const randomWord = bank[Math.floor(Math.random() * bank.length)];
    console.log('All words exist, returning random:', randomWord.en);
    return randomWord;
  }

  const randomWord = available[Math.floor(Math.random() * available.length)];
  console.log('Returning new word:', randomWord.en);
  return randomWord;
}

// ============================================================
// ОЧИСТКА КЕША
// ============================================================

function clearApiCache() {
  apiCache.clear();
}

// ============================================================
// ЭКСПОРТ
// ============================================================

// Экспортируем функции для использования в основном модуле
window.WordAPI = {
  translateText,
  getWordData,
  getCompleteWordData,
  clearApiCache,
  loadWordBank,
  getRandomNewWord,
};
