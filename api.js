// ============================================================
// API MODULE - Внешние сервисы для перевода и примеров
// ============================================================

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
    console.log('Translation URL:', url);

    const response = await fetch(url);
    console.log('Translation response status:', response.status);

    if (!response.ok) {
      throw new Error(`MyMemory API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Translation response data:', data);

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
      console.log('Dictionary URL:', url);

      const response = await fetch(url);
      console.log('Dictionary response status:', response.status);

      if (!response.ok) {
        if (response.status === 404) {
          console.log(`Word "${word}" not found in dictionary at ${url}`);
          continue; // Пробуем следующий URL
        }
        throw new Error(`Dictionary API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('Dictionary response data:', data);

      // Проверяем, что данные не пустые
      if (!data || (Array.isArray(data) && data.length === 0)) {
        console.log(`Empty response from ${url}, trying next...`);
        continue;
      }

      // Обрабатываем данные из всех доступных определений
      const examples = [];
      const tags = new Set();
      const definitions = [];

      const entries = Array.isArray(data) ? data : [data];

      console.log('Processing entries:', entries.length);

      entries.forEach((entry, entryIndex) => {
        console.log(`Processing entry ${entryIndex}:`, entry);

        // Собираем теги из частей речи с приоритезацией
        if (entry.meanings) {
          console.log(
            `Found ${entry.meanings.length} meanings in entry ${entryIndex}`,
          );

          // Сортируем meanings по количеству определений (самые используемые первые)
          const sortedMeanings = entry.meanings.sort(
            (a, b) =>
              (b.definitions ? b.definitions.length : 0) -
              (a.definitions ? a.definitions.length : 0),
          );

          sortedMeanings.forEach((meaning, meaningIndex) => {
            console.log(
              `Processing meaning ${meaningIndex}:`,
              meaning.partOfSpeech,
            );

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
                  console.log(`Added main tag: ${partOfSpeech}`);
                }
              } else {
                tags.add(partOfSpeech);
                console.log(`Added tag: ${partOfSpeech}`);
              }
            }

            // Собираем примеры и определения
            if (meaning.definitions) {
              console.log(
                `Found ${meaning.definitions.length} definitions in meaning ${meaningIndex}`,
              );

              meaning.definitions.forEach((def, defIndex) => {
                console.log(`Processing definition ${defIndex}:`, def);

                // Добавляем определение
                if (def.definition) {
                  definitions.push(def.definition);
                  console.log(
                    `Added definition: ${def.definition.substring(0, 50)}...`,
                  );
                }

                // Добавляем примеры - ищем во всех определениях!
                if (def.example) {
                  examples.push(def.example);
                  console.log(`Found example: ${def.example}`);
                }
              });
            }
          });
        } else {
          console.log(`No meanings found in entry ${entryIndex}`);
        }
      });

      console.log('Processed examples:', examples);
      console.log('Processed tags:', Array.from(tags));

      // Генерируем дополнительные теги на основе анализа слова
      const generatedTags = generateTags(word, examples);
      generatedTags.forEach(tag => tags.add(tag));

      // Если примеров от API нет, генерируем свои
      if (examples.length === 0) {
        console.log('No examples from API, generating examples...');
        const generatedExamples = generateExamples(word);
        examples.push(...generatedExamples);
        console.log('Generated examples:', generatedExamples);
      }

      const result = {
        examples: examples.slice(0, 3), // Ограничиваем 3 примерами
        tags: Array.from(tags).slice(0, 5), // Ограничиваем 5 тегами
        definitions: definitions.slice(0, 2), // Ограничиваем 2 определениями
      };

      console.log('Final result:', result);

      // Если нашли хоть что-то полезное, кешируем и возвращаем
      if (result.examples.length > 0 || result.tags.length > 0) {
        // Кешируем результат
        apiCache.set(cacheKey, {
          data: result,
          timestamp: Date.now(),
        });

        return result;
      } else {
        console.log(`No useful data from ${url}, trying next...`);
        continue;
      }
    } catch (error) {
      console.error(`Dictionary error for ${url}:`, error);
      continue; // Пробуем следующий URL
    }
  }

  // Если все URL не сработали, генерируем базовые теги и примеры
  console.log('All dictionary URLs failed, generating basic tags and examples');
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
  try {
    // Показываем индикатор загрузки
    if (window.showApiLoading) {
      window.showApiLoading(true);
    }

    // Параллельно запрашиваем перевод и данные слова
    const [translationResult, wordData] = await Promise.all([
      translateText(englishWord),
      getWordData(englishWord),
    ]);

    return {
      translation: translationResult.translation,
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
};

console.log('API module loaded');
