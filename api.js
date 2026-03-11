// ============================================================
// API MODULE - Только загрузка локального банка слов
// ============================================================

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
 * если не получилось — fallback на EMERGENCY_WORDS
 */
async function loadWordBank() {
  if (wordBank) return wordBank;

  // Принудительная очистка кеша для отладки
  if (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  ) {
    localStorage.removeItem(BANK_CACHE_KEY);
    localStorage.removeItem(BANK_VERSION_KEY);
    wordBank = null;
  }

  // 1. Проверяем кэш
  const cachedVersion = localStorage.getItem(BANK_VERSION_KEY);
  const cachedData = localStorage.getItem(BANK_CACHE_KEY);

  if (cachedVersion !== CURRENT_BANK_VERSION) {
    localStorage.removeItem(BANK_CACHE_KEY);
    localStorage.removeItem(BANK_VERSION_KEY);
  }

  if (cachedVersion === CURRENT_BANK_VERSION && cachedData) {
    try {
      wordBank = JSON.parse(cachedData);
      return wordBank;
    } catch (e) {
      console.warn('Кэш повреждён, загружаем заново');
    }
  }

  // 2. Пробуем загрузить JSON
  try {
    const response = await fetch('./dictionary.json', { cache: 'no-cache' });
    if (!response.ok) {
      console.error('Failed to load dictionary:', response.status);
      return [];
    }
    const data = await response.json();
    wordBank = data;

    // Сохраняем в кэш
    localStorage.setItem(BANK_CACHE_KEY, JSON.stringify(wordBank));
    localStorage.setItem(BANK_VERSION_KEY, CURRENT_BANK_VERSION);

    return wordBank;
  } catch (error) {
    console.error('Error loading dictionary:', error);
    wordBank = EMERGENCY_WORDS;
    return wordBank;
  }
}

/**
 * Получает случайное слово из банка, которого нет у пользователя
 * @returns {Promise<Object>} - Случайное слово из банка
 */
async function getRandomNewWord() {
  const bank = await loadWordBank();
  if (!bank || bank.length === 0) return null;

  const userWords = window.words || [];
  const available = bank.filter(
    item => !userWords.some(w => w.en.toLowerCase() === item.en.toLowerCase()),
  );

  if (available.length === 0) {
    const randomWord = bank[Math.floor(Math.random() * bank.length)];
    return randomWord;
  }

  const randomWord = available[Math.floor(Math.random() * available.length)];
  return randomWord;
}

// Экспортируем функции для использования в основном модуле
window.WordAPI = {
  loadWordBank,
  getRandomNewWord,
};
