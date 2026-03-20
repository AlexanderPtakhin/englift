import { supabase } from './supabase.js';

import {
  loadWords,
  saveWords,
  loadIdioms,
  saveIdioms,
  saveUserData,
  loadUserData,
  saveUserSettings,
  loadUserSettings,
  searchUsers,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  getFriends,
  getIncomingRequests,
  getOutgoingRequests,
  getFriendsLeaderboard,
  saveWordToDb, // ← добавить
  deleteWordFromDb, // ← добавить
  saveIdiomToDb, // ← добавить
  deleteIdiomFromDb, // ← добавить
} from './db.js';

import './auth.js';

// Импортируем банк идиом
import idiomsBankData from './idioms.json';

// =============================================

// КОНСТАНТЫ (в самом верху, чтобы auth.js их видел)

// =============================================

// Debug flag - должен быть определен до использования в функциях

const DEBUG =
  location.hostname === 'localhost' || location.hostname === '127.0.0.1';

// =============================================

// ГЛОБАЛЬНЫЕ КОНСТАНТЫ

// =============================================

const CONSTANTS = {
  XP_PER_LEVEL: 200,
  STORAGE_KEYS: {
    WORDS: 'englift_words',
    IDIOMS: 'englift_idioms',
    XP: 'englift_xp',
    STREAK: 'englift_streak',
    SPEECH: 'englift_speech_settings',
  },
  LIMITS: {
    MAX_WORD_LENGTH: 100,
    MAX_TRANSLATION_LENGTH: 200,
    MAX_EXAMPLE_LENGTH: 500,
    MAX_TAG_LENGTH: 30,
    MAX_TAGS: 10,
    MAX_VISIBLE_WORDS: 100,
    MAX_CACHE_SIZE: 200,
    LOCAL_STORAGE_LIMIT: 4 * 1024 * 1024, // 4MB
  },
  SPEECH: {
    SIMILARITY_THRESHOLD: 0.8,
    RECOGNITION_TIMEOUT: 5000,
    AUTO_LANG: 'ru-RU',
  },
};

const XP_PER_LEVEL = CONSTANTS.XP_PER_LEVEL;

// =============================================

// НЕМЕДЛЕННАЯ ИНИЦИАЛИЗАЦИЯ ТЕМЫ (чтобы не было мерцания)

// =============================================

(function initThemeFromStorage() {
  const saved = JSON.parse(
    localStorage.getItem('englift_user_settings') || '{}',
  );
  const baseTheme = saved.baseTheme || 'lavender';
  const dark = saved.dark ?? false;

  // Применяем классы напрямую (без вызова applyTheme, чтобы не запускать лишнюю логику)
  const html = document.documentElement;
  html.classList.remove(
    'theme-ocean',
    'theme-forest',
    'theme-purple',
    'theme-sunset',
    'theme-sky',
    'theme-sand',
    'theme-graphite',
    'dark',
  );
  if (baseTheme !== 'lavender') html.classList.add(`theme-${baseTheme}`);
  if (dark) html.classList.add('dark');

  // Записываем в глобальные настройки, чтобы потом использовать
  window.user_settings = window.user_settings || {};
  window.user_settings.baseTheme = baseTheme;
  window.user_settings.dark = dark;
})();

// =============================================

// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ (объявляются ДО их использования)

// =============================================

// Глобальные массивы данных
window.words = [];
window.idioms = []; // глобальный массив идиом
window.idiomsBank = []; // банк идиом из JSON

// User settings and progress
window.user_settings = {
  voice: 'female',
  reviewLimit: 100,
};
window.dailyProgress = {
  add_new: 0,
  review: 0,
  practice_time: 0,
  completed: false,
  lastReset: new Date().toISOString().split('T')[0],
};
window.cefrLevels = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 };
window.dailyReviewCount = 0;
window.lastReviewResetDate = null;
window.postponedToastShown = false;

// Streak and XP
let streak = { count: 0, lastDate: null };
let xpData = { xp: 0, level: 1, badges: [] };

// Practice session variables
let sResults = { correct: [], wrong: [] };
let sIdx = 0;
let session = null;
let autoPron = true;
let lastSessionConfig = null;
let currentExerciseTimer = null;
window.isSessionActive = false;

// Practice modes
let practiceMode = 'normal';
let selectedWordExercises = []; // массив выбранных упражнений для слов
let selectedIdiomExercises = []; // массив выбранных упражнений для идиом

// Exam mode variables
let examTime = 600; // секунд (по умолчанию 10 мин)
let examQuestions = 50;
let examTimerInterval = null;
let practiceStartTime = null;

// Filter and search variables
let activeFilter = 'all',
  searchQ = '',
  sortBy = 'date-desc',
  tagFilter = '';

// Infinite scroll variables
let visibleLimit = 30;
let isLoadingMore = false;
let intersectionObserver = null;
let renderCache = new Map();
let searchDebounceTimer = null;

// Idioms variables
let idiomsVisibleLimit = 30;
let idiomsIsLoadingMore = false;
let idiomsIntersectionObserver = null;
let idiomsSearchQuery = '';
let idiomsSortBy = 'date-desc';
let idiomsTagFilter = '';
let idiomsActiveFilter = 'all';

// Sync and save variables
let isSaving = false;
let badgeCheckInterval = null;
let refreshScheduled = false;
let retryAttempts = 0;
let wordBankCache = null;
let fileParsed = [];
let lastFetchedWordData = null;
let lastFetchedIdiomData = null;
let pendingWordUpdates = new Map();
let pendingIdiomUpdates = new Map();
let wordSyncTimer;
let idiomSyncTimer;
let saveTimeout;
let audioContext = null;
let currentRecognition = null;
let currentTooltip = null;

// Constants
const PAGE_SIZE = 20;
const MAX_RETRY_ATTEMPTS = 3;
const speechRecognitionSupported = !!(
  window.SpeechRecognition || window.webkitSpeechRecognition
);

// Daily goals configuration
const DAILY_GOALS = [
  {
    id: 'add_new',
    target: 5,
    icon: 'add_circle',
    label: 'Новых слов',
    unit: 'слова',
    xpReward: 10,
  },
  {
    id: 'review',
    target: 20,
    icon: 'repeat',
    label: 'Повторений',
    unit: 'раз',
    xpReward: 15,
  },
  {
    id: 'practice_time',
    target: 15,
    icon: 'schedule',
    label: 'Время практики',
    unit: 'мин',
    xpReward: 20,
  },
];

// Badges definition
const BADGES_DEF = [
  // ===== Слова в словаре =====
  {
    id: 'first_word',
    name: 'Первое слово',
    description: 'Добавьте первое слово в словарь',
    icon: 'emoji_events',
    condition: data => data.totalWords >= 1,
    progress: data => ({ current: Math.min(data.totalWords, 1), target: 1 }),
    category: 'collection',
    rarity: 'common',
    xp: 10,
  },
  {
    id: 'word_collector_10',
    name: 'Коллекционер слов',
    description: 'Добавьте 10 слов в словарь',
    icon: 'collections_bookmark',
    condition: data => data.totalWords >= 10,
    progress: data => ({ current: Math.min(data.totalWords, 10), target: 10 }),
    category: 'collection',
    rarity: 'common',
    xp: 25,
  },
  {
    id: 'word_collector_50',
    name: 'Словесный энтузиаст',
    description: 'Добавьте 50 слов в словарь',
    icon: 'menu_book',
    condition: data => data.totalWords >= 50,
    progress: data => ({ current: Math.min(data.totalWords, 50), target: 50 }),
    category: 'collection',
    rarity: 'rare',
    xp: 100,
  },
  {
    id: 'word_collector_100',
    name: 'Лексикон',
    description: 'Добавьте 100 слов в словарь',
    icon: 'auto_stories',
    condition: data => data.totalWords >= 100,
    progress: data => ({
      current: Math.min(data.totalWords, 100),
      target: 100,
    }),
    category: 'collection',
    rarity: 'epic',
    xp: 200,
  },
  {
    id: 'word_collector_500',
    name: 'Мастер лексики',
    description: 'Добавьте 500 слов в словарь',
    icon: 'local_library',
    condition: data => data.totalWords >= 500,
    progress: data => ({
      current: Math.min(data.totalWords, 500),
      target: 500,
    }),
    category: 'collection',
    rarity: 'legendary',
    xp: 500,
  },
  // ===== Идиомы в словаре =====
  {
    id: 'first_idiom',
    name: 'Первая идиома',
    description: 'Добавьте первую идиому в словарь',
    icon: 'theater_comedy',
    condition: data => data.totalIdioms >= 1,
    progress: data => ({ current: Math.min(data.totalIdioms, 1), target: 1 }),
    category: 'collection',
    rarity: 'common',
    xp: 15,
  },
  {
    id: 'idiom_collector_25',
    name: 'Идиоматическийcollector',
    description: 'Добавьте 25 идиом в словарь',
    icon: 'sentiment_satisfied',
    condition: data => data.totalIdioms >= 25,
    progress: data => ({ current: Math.min(data.totalIdioms, 25), target: 25 }),
    category: 'collection',
    rarity: 'rare',
    xp: 75,
  },
  {
    id: 'idiom_collector_100',
    name: 'Идиоматический мастер',
    description: 'Добавьте 100 идиом в словарь',
    icon: 'psychology',
    condition: data => data.totalIdioms >= 100,
    progress: data => ({
      current: Math.min(data.totalIdioms, 100),
      target: 100,
    }),
    category: 'collection',
    rarity: 'epic',
    xp: 250,
  },
  // ===== Прогресс изучения =====
  {
    id: 'first_learned',
    name: 'Первое изученное',
    description: 'Изучите первое слово или идиому',
    icon: 'school',
    condition: data => data.learnedWords >= 1,
    progress: data => ({ current: Math.min(data.learnedWords, 1), target: 1 }),
    category: 'learning',
    rarity: 'common',
    xp: 20,
  },
  {
    id: 'learning_streak_3',
    name: 'Серия обучения',
    description: 'Изучите 3 слова/идиомы подряд',
    icon: 'local_fire_department',
    condition: data => data.learningStreak >= 3,
    progress: data => ({
      current: Math.min(data.learningStreak, 3),
      target: 3,
    }),
    category: 'learning',
    rarity: 'common',
    xp: 30,
  },
  {
    id: 'learning_streak_10',
    name: 'Горячая серия',
    description: 'Изучите 10 слов/идиом подряд',
    icon: 'whatshot',
    condition: data => data.learningStreak >= 10,
    progress: data => ({
      current: Math.min(data.learningStreak, 10),
      target: 10,
    }),
    category: 'learning',
    rarity: 'rare',
    xp: 75,
  },
  {
    id: 'knowledge_master_25',
    name: 'Знаток основ',
    description: 'Изучите 25 слов/идиом',
    icon: 'psychology',
    condition: data => data.learnedWords >= 25,
    progress: data => ({
      current: Math.min(data.learnedWords, 25),
      target: 25,
    }),
    category: 'learning',
    rarity: 'rare',
    xp: 100,
  },
  {
    id: 'knowledge_master_100',
    name: 'Эрудит',
    description: 'Изучите 100 слов/идиом',
    icon: 'workspace_premium',
    condition: data => data.learnedWords >= 100,
    progress: data => ({
      current: Math.min(data.learnedWords, 100),
      target: 100,
    }),
    category: 'learning',
    rarity: 'epic',
    xp: 300,
  },
  // ===== Практика и повторение =====
  {
    id: 'first_session',
    name: 'Первое занятие',
    description: 'Завершите первую сессию практики',
    icon: 'play_circle',
    condition: data => data.totalSessions >= 1,
    progress: data => ({ current: Math.min(data.totalSessions, 1), target: 1 }),
    category: 'practice',
    rarity: 'common',
    xp: 25,
  },
  {
    id: 'practice_regular',
    name: 'Регулярность',
    description: 'Завершите 5 сессий практики',
    icon: 'calendar_today',
    condition: data => data.totalSessions >= 5,
    progress: data => ({ current: Math.min(data.totalSessions, 5), target: 5 }),
    category: 'practice',
    rarity: 'common',
    xp: 50,
  },
  {
    id: 'practice_dedicated',
    name: 'Преданность',
    description: 'Завершите 25 сессий практики',
    icon: 'event_available',
    condition: data => data.totalSessions >= 25,
    progress: data => ({
      current: Math.min(data.totalSessions, 25),
      target: 25,
    }),
    category: 'practice',
    rarity: 'rare',
    xp: 125,
  },
  {
    id: 'practice_master',
    name: 'Мастер практики',
    description: 'Завершите 100 сессий практики',
    icon: 'military_tech',
    condition: data => data.totalSessions >= 100,
    progress: data => ({
      current: Math.min(data.totalSessions, 100),
      target: 100,
    }),
    category: 'practice',
    rarity: 'epic',
    xp: 400,
  },
  {
    id: 'accuracy_perfection',
    name: 'Точность мастера',
    description: 'Достигните 95% точности в сессии',
    icon: 'target',
    condition: data => data.bestAccuracy >= 95,
    progress: data => ({
      current: Math.min(data.bestAccuracy, 95),
      target: 95,
      format: val => `${val}%`,
    }),
    category: 'practice',
    rarity: 'rare',
    xp: 150,
  },
  // ===== Ежедневные цели =====
  {
    id: 'daily_goal_first',
    name: 'Цель дня',
    description: 'Выполните первую ежедневную цель',
    icon: 'today',
    condition: data => data.dailyGoalsCompleted >= 1,
    progress: data => ({
      current: Math.min(data.dailyGoalsCompleted, 1),
      target: 1,
    }),
    category: 'daily',
    rarity: 'common',
    xp: 30,
  },
  {
    id: 'daily_goal_regular',
    name: 'Планер дня',
    description: 'Выполните все ежедневные цели 7 раз',
    icon: 'date_range',
    condition: data => data.perfectDays >= 7,
    progress: data => ({ current: Math.min(data.perfectDays, 7), target: 7 }),
    category: 'daily',
    rarity: 'rare',
    xp: 200,
  },
  {
    id: 'daily_goal_consistent',
    name: 'Последовательность',
    description: 'Выполните все ежедневные цели 30 дней',
    icon: 'calendar_month',
    condition: data => data.perfectDays >= 30,
    progress: data => ({ current: Math.min(data.perfectDays, 30), target: 30 }),
    category: 'daily',
    rarity: 'epic',
    xp: 500,
  },
  // ===== Серии (streaks) =====
  {
    id: 'streak_beginner',
    name: 'Начало серии',
    description: 'Достигните 3-дневной серии',
    icon: 'local_fire_department',
    condition: data => data.streak >= 3,
    progress: data => ({ current: Math.min(data.streak, 3), target: 3 }),
    category: 'streak',
    rarity: 'common',
    xp: 40,
  },
  {
    id: 'streak_regular',
    name: 'Привычка',
    description: 'Достигните 7-дневной серии',
    icon: 'whatshot',
    condition: data => data.streak >= 7,
    progress: data => ({ current: Math.min(data.streak, 7), target: 7 }),
    category: 'streak',
    rarity: 'common',
    xp: 75,
  },
  {
    id: 'streak_dedicated',
    name: 'Преданность',
    description: 'Достигните 30-дневной серии',
    icon: 'local_fire_department',
    condition: data => data.streak >= 30,
    progress: data => ({ current: Math.min(data.streak, 30), target: 30 }),
    category: 'streak',
    rarity: 'rare',
    xp: 300,
  },
  {
    id: 'streak_master',
    name: 'Мастер серии',
    description: 'Достигните 100-дневной серии',
    icon: 'workspace_premium',
    condition: data => data.streak >= 100,
    progress: data => ({
      current: Math.min(data.streak, 100),
      target: 100,
    }),
    category: 'streak',
    rarity: 'epic',
    xp: 1000,
  },
  {
    id: 'streak_legendary',
    name: 'Легенда серии',
    description: 'Достигните 365-дневной серии',
    icon: 'emoji_events',
    condition: data => data.streak >= 365,
    progress: data => ({
      current: Math.min(data.streak, 365),
      target: 365,
    }),
    category: 'streak',
    rarity: 'legendary',
    xp: 3650,
  },
  // ===== Особые достижения =====
  {
    id: 'variety_explorer',
    name: 'Исследователь',
    description: 'Попробуйте все типы упражнений',
    icon: 'explore',
    condition: data => data.exercisesTried >= 8,
    progress: data => ({
      current: Math.min(data.exercisesTried, 8),
      target: 8,
    }),
    category: 'special',
    rarity: 'rare',
    xp: 200,
  },
  {
    id: 'speed_demon',
    name: 'Скоростной демон',
    description: 'Завершите сессию со средней скоростью < 3 сек/вопрос',
    icon: 'speed',
    condition: data => data.bestSpeed <= 3,
    progress: data => ({
      current: Math.max(5 - data.bestSpeed, 0),
      target: 2,
      format: val => `${data.bestSpeed}с`,
    }),
    category: 'special',
    rarity: 'epic',
    xp: 250,
  },
  {
    id: 'perfectionist',
    name: 'Перфекционист',
    description: 'Завершите 10 сессий с точностью 100%',
    icon: 'grade',
    condition: data => data.perfectSessions >= 10,
    progress: data => ({
      current: Math.min(data.perfectSessions, 10),
      target: 10,
    }),
    category: 'special',
    rarity: 'epic',
    xp: 400,
  },
  // ===== Уровни и опыт =====
  {
    id: 'level_5',
    name: 'Новичок',
    description: 'Достигните 5 уровня',
    icon: 'stars',
    condition: data => data.level >= 5,
    progress: data => ({ current: Math.min(data.level, 5), target: 5 }),
    category: 'level',
    rarity: 'common',
    xp: 50,
  },
  {
    id: 'level_10',
    name: 'Ученик',
    description: 'Достигните 10 уровня',
    icon: 'auto_awesome',
    condition: data => data.level >= 10,
    progress: data => ({ current: Math.min(data.level, 10), target: 10 }),
    category: 'level',
    rarity: 'rare',
    xp: 150,
  },
  {
    id: 'level_25',
    name: 'Эксперт',
    description: 'Достигните 25 уровня',
    icon: 'workspace_premium',
    condition: data => data.level >= 25,
    progress: data => ({ current: Math.min(data.level, 25), target: 25 }),
    category: 'level',
    rarity: 'epic',
    xp: 500,
  },
  {
    id: 'level_50',
    name: 'Мастер',
    description: 'Достигните 50 уровня',
    icon: 'military_tech',
    condition: data => data.level >= 50,
    progress: data => ({ current: Math.min(data.level, 50), target: 50 }),
    category: 'level',
    rarity: 'legendary',
    xp: 1500,
  },
];

// Global flags
window.profileFullyLoaded = false;
window.pendingWordUpdates = pendingWordUpdates;
window.pendingIdiomUpdates = pendingIdiomUpdates;

// =============================================

// ФУНКЦИИ НОРМАЛИЗАЦИИ ДАННЫХ

// =============================================

// Функция нормализации русского текста (е/ё)
function normalizeRussian(text) {
  return text.replace(/ё/g, 'е').replace(/Ё/g, 'Е');
}

// Функция проверки ответа с учетом е/ё
function checkAnswerWithNormalization(userAnswer, correctAnswer) {
  const normalizedUser = normalizeRussian(userAnswer);
  const normalizedCorrect = normalizeRussian(correctAnswer);
  return normalizedUser === normalizedCorrect;
}

function normalizeWord(word) {
  return {
    ...word,
    examplesAudio:
      Array.isArray(word.examples_audio) && word.examples_audio.length
        ? word.examples_audio
        : Array.isArray(word.examplesaudio) && word.examplesaudio.length
          ? word.examplesaudio
          : Array.isArray(word.examplesAudio)
            ? word.examplesAudio
            : [],
    // Нормализация для нового поля
    stats: word.stats
      ? {
          ...word.stats,
          correctExerciseTypes: Array.isArray(word.stats.correctExerciseTypes)
            ? word.stats.correctExerciseTypes
            : word.stats.learned
              ? ['legacy']
              : [],
        }
      : undefined,
  };
}

function normalizeIdiom(idiom) {
  return {
    ...idiom,
    examplesAudio:
      Array.isArray(idiom.examples_audio) && idiom.examples_audio.length
        ? idiom.examples_audio
        : Array.isArray(idiom.examplesaudio) && idiom.examplesaudio.length
          ? idiom.examplesaudio
          : Array.isArray(idiom.examplesAudio)
            ? idiom.examplesAudio
            : [],
    // Нормализация для нового поля
    stats: idiom.stats
      ? {
          ...idiom.stats,
          correctExerciseTypes: Array.isArray(idiom.stats.correctExerciseTypes)
            ? idiom.stats.correctExerciseTypes
            : idiom.stats.learned
              ? ['legacy']
              : [],
        }
      : undefined,
  };
}

// Делаем функции доступными глобально
window.normalizeWord = normalizeWord;
window.normalizeIdiom = normalizeIdiom;
window.normalizeRussian = normalizeRussian;
window.checkAnswerWithNormalization = checkAnswerWithNormalization;

// =============================================

// КЭШ СЛОВАРЯ - оптимизация загрузки

// =============================================

// =============================================

// ПРЕДГЕНЕРИРОВАННОЕ АУДИО ИЗ ПАПКИ /audio/

// =============================================

function playAudio(filename, onEnd) {
  if (!filename) {
    if (onEnd) onEnd();
    return console.warn('Нет файла аудио');
  }

  // Определяем папку в зависимости от настроек голоса
  const voicePreference = window.user_settings?.voice || 'female';
  const audioFolder = voicePreference === 'male' ? '/audio-male/' : '/audio/';

  const audio = new Audio(`${audioFolder}${filename}`);

  audio.volume = 1.0;

  audio.onended = () => {
    if (onEnd) onEnd();
  };

  audio.play().catch(err => {
    console.warn('Браузер заблокировал автозвук:', err);
    window.toast?.('Нажми ещё раз на динамик', 'info');
    if (onEnd) onEnd(); // убираем волну в случае ошибки
  });
}

function playIdiomAudio(filename, onEnd) {
  console.log('🎵 playIdiomAudio called with:', filename);
  if (!filename) {
    if (onEnd) onEnd();
    return console.warn('Нет файла аудио для идиомы');
  }

  // Определяем папку в зависимости от настроек голоса
  const voicePreference = window.user_settings?.voice || 'female';
  const audioFolder =
    voicePreference === 'male' ? '/audio-idioms/' : '/female-idioms/';
  const audioPath = `${audioFolder}${filename}`;
  console.log('🎵 Audio path:', audioPath);
  const audio = new Audio(audioPath);

  audio.volume = 1.0;

  audio.onended = () => {
    console.log('🎵 Audio ended');
    if (onEnd) onEnd();
  };

  audio.play().catch(err => {
    console.warn('🎵 Audio play error:', err);
    window.toast?.('Нажми ещё раз на динамик', 'info');
    if (onEnd) onEnd(); // убираем волну в случае ошибки
  });
}

// Глобальные функции для всего сайта

window.speakWord = function (wordObj, onEnd) {
  // Поддерживаем разные форматы входных данных

  let audioFile = null;

  if (typeof wordObj === 'string') {
    // Если передана строка, ищем слово в словаре

    const word = window.words.find(w => w.en === wordObj || w.id === wordObj);

    if (word) {
      audioFile = word.audio;
    }
  } else if (wordObj && wordObj.en) {
    // Если передан объект слова

    audioFile = wordObj.audio;
  } else if (wordObj && wordObj.word) {
    // Если передан объект с полем word (для упражнений)

    const word = window.words.find(
      w => w.en === wordObj.word || w.id === wordObj.word,
    );

    if (word) {
      audioFile = word.audio;
    }
  }

  if (!audioFile) {
    console.warn('Аудио файл не найден для:', wordObj);
    if (onEnd) onEnd(); // чтобы волна убралась даже при ошибке
    return;
  }

  playAudio(audioFile, onEnd);
};

window.speakIdiom = function (idiomId) {
  const idiom = window.idioms.find(i => i.id === idiomId);
  if (!idiom) return;
  if (idiom.audio) playIdiomAudio(idiom.audio);
  else speakText(idiom.idiom);
};

window.playExampleAudio = function (wordObj) {
  if (!wordObj || !wordObj.examplesAudio || !wordObj.examplesAudio.length)
    return;

  playAudio(wordObj.examplesAudio[0]);
};

// Conditional debug logging

const debugLog = (...args) => {
  if (DEBUG) console.log(...args);
};

// File import variables

// Функция обновления счётчика идиом
function updateIdiomsCount() {
  // Бейджи убраны из nav, updateDueBadge теперь всё обновляет
  updateDueBadge();
}

// ============================================================
// THEME MANAGEMENT
// ============================================================

window.applyTheme = function (baseTheme = 'lavender', dark = false) {
  const html = document.documentElement;

  // Убираем все старые классы тем
  html.classList.remove(
    'theme-ocean',
    'theme-forest',
    'theme-purple',
    'theme-sunset',
    'theme-sky',
    'theme-sand',
    'theme-graphite',
    'dark',
  );

  // Добавляем новую тему (если не lavender, потому что lavender — класс по умолчанию (терракота))
  if (baseTheme !== 'lavender') {
    html.classList.add(`theme-${baseTheme}`);
  }

  // Управляем тёмным режимом
  if (dark) {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }

  // Обновляем глобальные настройки
  window.user_settings = window.user_settings || {};
  window.user_settings.baseTheme = baseTheme;
  window.user_settings.dark = dark;

  // Сохраняем в localStorage
  const saved = JSON.parse(
    localStorage.getItem('englift_user_settings') || '{}',
  );
  saved.baseTheme = baseTheme;
  saved.dark = dark;
  localStorage.setItem('englift_user_settings', JSON.stringify(saved));

  // Обновляем чекбокс в дропдауне (если есть)
  const themeCheckbox = document.getElementById('theme-checkbox');
  if (themeCheckbox) themeCheckbox.checked = dark;

  // Обновляем иконку в хедере
  const headerThemeIcon = document.getElementById('theme-icon');
  if (headerThemeIcon) {
    headerThemeIcon.textContent = dark ? 'light_mode' : 'dark_mode';
  }

  // Обновляем иконку рядом с чекбоксом (старый код, можно удалить позже)
  const themeIcon = document.querySelector(
    '#dropdown-theme-toggle .material-symbols-outlined',
  );
  if (themeIcon) {
    themeIcon.textContent = dark ? 'sunny' : 'dark_mode';
  }

  // Помечаем профиль грязным для синхронизации с сервером
  if (window.currentUserId) {
    window.scheduleProfileSave();
  }

  console.log(
    `🎨 Тема применена: ${baseTheme} ${dark ? '(тёмная)' : '(светлая)'}`,
  );
};

window.profileFullyLoaded = false;

function markWordDirty(wordId) {
  const word = window.words?.find(w => w.id === wordId);

  if (word) {
    pendingWordUpdates.set(wordId, { ...word }); // Копируем слово

    scheduleWordSync();
  }
}

function scheduleWordSync(delay = 3000) {
  // 3 секунды (было 30)

  if (wordSyncTimer) clearTimeout(wordSyncTimer);

  wordSyncTimer = setTimeout(() => {
    syncPendingWords();
  }, delay);
}

async function syncPendingWords() {
  if (
    !navigator.onLine ||
    pendingWordUpdates.size === 0 ||
    !window.currentUserId
  )
    return;

  const wordsToSync = Array.from(pendingWordUpdates.values());

  for (const item of wordsToSync) {
    if (item._deleted) {
      // Удаляем с сервера

      try {
        await deleteWordFromDb(item.id);

        console.log(`✅ Удалено слово "${item.en}" с сервера`);

        pendingWordUpdates.delete(item.id); // убираем из очереди
      } catch (e) {
        console.error(`❌ Ошибка удаления слова "${item.en}":`, e);

        // остаётся в очереди для повторной попытки
      }
    } else {
      // Сохраняем или обновляем слово через saveWordToDb с upsert
      try {
        console.log(`💾 Синхронизация слова "${item.en}" с ID: ${item.id}`);

        await saveWordToDb(item);
        pendingWordUpdates.delete(item.id);
        console.log(`✅ Слово "${item.en}" синхронизировано`);
      } catch (e) {
        console.error(`❌ Ошибка синхронизации слова "${item.en}":`, e);
      }
    }
  }

  console.log(`✅ Синхронизировано ${wordsToSync.length} операций`);
}

function markIdiomDirty(id) {
  const idiom = window.idioms?.find(i => i.id === id);
  if (idiom) {
    pendingIdiomUpdates.set(id, { ...idiom });
    scheduleIdiomSync();
  }
}

function scheduleIdiomSync(delay = 3000) {
  if (idiomSyncTimer) clearTimeout(idiomSyncTimer);
  idiomSyncTimer = setTimeout(() => {
    syncPendingIdioms();
  }, delay);
}

async function syncPendingIdioms() {
  if (
    !navigator.onLine ||
    pendingIdiomUpdates.size === 0 ||
    !window.currentUserId
  )
    return;

  const idiomsToSync = Array.from(pendingIdiomUpdates.values());
  for (const item of idiomsToSync) {
    if (item._deleted) {
      try {
        await deleteIdiomFromDb(item.id);
        console.log(`✅ Удалена идиома "${item.idiom}" с сервера`);
        pendingIdiomUpdates.delete(item.id);
      } catch (e) {
        console.error(`❌ Ошибка удаления идиомы "${item.idiom}":`, {
          message: e.message,
          details: e.details,
          hint: e.hint,
          code: e.code,
          status: e.status,
          statusText: e.statusText,
          error: e.error,
        });
      }
    } else {
      try {
        await saveIdiomToDb(item);
        pendingIdiomUpdates.delete(item.id);
        console.log(`✅ Идиома "${item.idiom}" синхронизирована`);
      } catch (e) {
        console.error(`❌ Ошибка синхронизации идиомы "${item.idiom}":`, {
          message: e.message,
          details: e.details,
          hint: e.hint,
          code: e.code,
          status: e.status,
          statusText: e.statusText,
          error: e.error,
          idiom_data: item,
        });
      }
    }
  }
}

window.syncPendingIdioms = syncPendingIdioms;

function mergeWordsWithServer(serverWords) {
  // Защита от перезаписи пустыми данными

  if (!serverWords || serverWords.length === 0) {
    console.log(
      '📥 Сервер вернул пустой массив слов, сохраняем локальные данные',
    );

    return;
  }

  // Простая логика: серверные слова имеют приоритет

  let updatedCount = 0;

  let addedCount = 0;

  serverWords.forEach(serverWord => {
    const localIndex = window.words.findIndex(w => w.id === serverWord.id);

    if (localIndex >= 0) {
      // Обновляем локальное слово

      window.words[localIndex] = serverWord;

      updatedCount++;
    } else {
      // Добавляем новое слово

      window.words.push(serverWord);

      addedCount++;
    }
  });

  if (updatedCount > 0 || addedCount > 0) {
    console.log(
      `🔄 Синхронизация слов: +${addedCount} новых, ↻${updatedCount} обновлено`,
    );
  }
}

// =============================================

// ПРОФИЛЬ — ТОЧНО ТАКАЯ ЖЕ СИСТЕМА, КАК СЛОВА (ФИНАЛЬНАЯ ВЕРСИЯ)

// =============================================

async function syncProfileToServer() {
  if (!window.currentUserId) {
    console.warn('Нет userId, пропускаем сохранение');
    return;
  }

  const profileData = {
    xp: xpData.xp || 0,
    level: xpData.level || 1,
    badges: xpData.badges || [],
    streak: streak.count || 0,
    laststreakdate: streak.lastDate || null,
    dailyprogress: window.dailyProgress || {},
    dailyreviewcount: window.dailyReviewCount || 0,
    lastreviewreset: window.lastReviewResetDate || null,
    usersettings: window.user_settings,
    darktheme: document.documentElement.classList.contains('dark'),
    total_words: window.words.length,
    total_idioms: window.idioms.length,
    learned_words: window.words.filter(w => w.stats?.learned).length,
  };

  try {
    await saveUserData(window.currentUserId, profileData);
    console.log('✅ Профиль сохранён на сервер');
  } catch (e) {
    console.error('❌ Ошибка сохранения профиля:', e);
    window.toast?.(
      'Не удалось сохранить прогресс. Проверьте соединение.',
      'warning',
    );
  }
}

// Делаем доступной из auth.js
window.syncProfileToServer = syncProfileToServer;

// Debounced версия с задержкой 500мс
let profileSaveTimer = null;

function scheduleProfileSave() {
  if (profileSaveTimer) clearTimeout(profileSaveTimer);
  profileSaveTimer = setTimeout(() => {
    syncProfileToServer();
    profileSaveTimer = null;
  }, 500); // 500 мс задержки
}

// Делаем доступной глобально
window.scheduleProfileSave = scheduleProfileSave;

// Сохранение при закрытии страницы
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    if (profileSaveTimer) {
      clearTimeout(profileSaveTimer);
      syncProfileToServer(); // пытаемся отправить перед закрытием
    }
  }
});

// Синхронизация слов с сервером (унифицированная функция)

async function syncWordsToServer() {
  console.log(
    '🔄 syncWordsToServer вызван - используем пакетную синхронизацию',
  );

  await syncPendingWords();
}

// Отложенная синхронизация при восстановлении соединения

function scheduleDelayedSync(delay = 30000) {
  console.log('🔄 scheduleDelayedSync вызван с задержкой:', delay);

  console.log('🔄 Текущий syncTimeout:', syncTimeout);

  if (syncTimeout) {
    console.log('⚠️ Отменяем предыдущий таймер синхронизации');

    clearTimeout(syncTimeout);
  }

  syncTimeout = setTimeout(async () => {
    console.log('🔄 Запускаем отложенную синхронизацию слов');

    try {
      const user = await getCurrentUser();

      if (user) {
        await syncWordsToServer();

        console.log('✅ Отложенная синхронизация завершена');
      } else {
        console.log('❌ Нет пользователя для синхронизации');
      }
    } catch (error) {
      console.error('❌ Ошибка отложенной синхронизации:', error);
    }
  }, delay);

  console.log('🔄 Таймер синхронизации установлен на', delay, 'мс');
}

// Инициализация переменных ДО их использования

// Daily progress tracking - должно быть объявлено ДО использования

window.dailyProgress = {
  add_new: 0,

  review: 0,

  practice_time: 0,

  completed: false,

  lastReset: new Date().toISOString().split('T')[0], // "2026-03-05"
};

// User settings with defaults - должно быть объявлено ДО использования

window.user_settings = window.user_settings || {
  voice: 'female',
  reviewLimit: 100,
};

// CEFR levels tracking - должно быть объявлено ДО использования

window.cefrLevels = {
  A1: 0,

  A2: 0,

  B1: 0,

  B2: 0,

  C1: 0,

  C2: 0,
};

// ВРЕМЕННЫЙ СБРОС ЛИМИТА ПОЛЬЗОВАТЕЛЯ ДЛЯ ТЕСТОВ - УДАЛЕНО

// УДАЛЕНО: todayReviewedCount - заменено на dailyReviewCount

// УДАЛЕНО: lastReviewedReset - заменено на lastReviewResetDate

window.postponedToastShown = false;

// ============================================================

// ДНЕВНОЙ ЛИМИТ ПОВТОРЕНИЙ (новая простая логика)

// ============================================================

window.dailyReviewCount = 0; // сколько упражнений сделано сегодня

window.lastReviewResetDate = null; // дата последнего сброса (строка YYYY-MM-DD)

// Проверка и сброс счётчика, если наступил новый день

function checkAndResetDailyCount() {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  if (window.lastReviewResetDate !== today) {
    window.dailyReviewCount = 0;

    window.lastReviewResetDate = today;

    console.log('🔄 Дневной счётчик сброшен');

    // Помечаем профиль как изменённый, чтобы сохранить новую дату

    if (window.currentUserId) {
      scheduleProfileSave();
    }
  }
}

// Получить текущий лимит из настроек (или значение по умолчанию)

function getReviewLimit() {
  // Если reviewLimit установлен (даже 0 или 9999) – возвращаем его
  // Если не установлен – возвращаем 100
  return window.user_settings?.reviewLimit ?? 100;
}

// Проверить, можно ли начать сессию с указанным количеством слов

// Возвращает true, если можно, иначе false (и показывает модалку)

function canStartSession(requestedCount) {
  const limit = getReviewLimit();

  const remaining = limit - window.dailyReviewCount;

  if (remaining <= 0) {
    // Лимит исчерпан – показываем модалку

    showLimitModal(limit);

    return false;
  }

  if (requestedCount > remaining) {
    // Запрошено больше, чем осталось – показываем предупреждение и берём только остаток

    toast(
      `⏰ Осталось только ${remaining} упражнений на сегодня. Будет показано ${remaining} из ${requestedCount} слов.`,

      'info',

      'schedule',
    );

    // Но мы всё равно разрешаем старт, просто позже обрежем массив

    return true;
  }

  return true;
}

// Увеличить счётчик на 1 (вызывается при каждом ответе)

function incrementDailyCount() {
  // Сначала проверяем, не наступил ли новый день

  checkAndResetDailyCount();

  window.dailyReviewCount++;

  console.log(`📈 Счетчик упражнений увеличен до ${window.dailyReviewCount}`);

  if (window.currentUserId) {
    scheduleProfileSave();
  }
}

// Универсальная функция для обновления всего интерфейса

function refreshUI() {
  if (refreshScheduled) return;

  refreshScheduled = true;

  requestAnimationFrame(() => {
    renderWords();

    renderStats();

    renderWeekChart();

    renderXP();

    renderBadges();

    updateDueBadge();

    refreshScheduled = false;
  });
}

// Делаем функции доступными глобально

window.refreshUI = refreshUI;

window.markWordDirty = markWordDirty;

// window.backupProfileToLocalStorage = backupProfileToLocalStorage;

window.applyProfileData = applyProfileData;

// Глобальная функция для отладки лимитов

window.debugLimits = function () {
  console.log('🔍 === ОТЛАДКА ЛИМИТОВ ===');

  console.log('📊 Текущий счетчик:', window.dailyReviewCount);

  console.log('📅 Дата сброса:', window.lastReviewResetDate);

  console.log('⚙️ Настройки:', window.user_settings?.reviewLimit);

  console.log('🆔 ID пользователя:', window.currentUserId);

  console.log('📈 Лимит:', getReviewLimit());

  console.log('🔄 Осталось:', getReviewLimit() - window.dailyReviewCount);

  console.log('📅 Сегодня:', new Date().toISOString().split('T')[0]);

  console.log('========================');
};

// window.isProfileEmpty = isProfileEmpty;

// Загрузка слов из localStorage при старте

function loadWordsFromLocalStorage() {
  const saved = localStorage.getItem('englift_words');

  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      window.words = parsed.map(normalizeWord);
    } catch (e) {
      console.error('Ошибка парсинга localStorage:', e);

      window.words = [];
    }
  } else {
    window.words = [];
  }
}

function loadIdiomsFromLocalStorage() {
  const saved = localStorage.getItem('englift_idioms');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      window.idioms = parsed.map(normalizeIdiom);
    } catch (e) {
      window.idioms = [];
    }
  } else {
    window.idioms = [];
  }

  // Добавим тестовую идиому для отладки
  if (window.idioms.length === 0) {
    const testIdiom = {
      id: generateId(),
      idiom: 'Test Idiom',
      meaning: 'Тестовая идиома',
      definition: 'Это тестовая идиома для проверки',
      example: 'This is a test idiom example.',
      example_translation: 'Это пример тестовой идиомы.',
      phonetic: 'tɛst ˈaɪdiəm',
      tags: ['тест', 'отладка'],
      audio: '9e3049ecdac760ae41bba8d10e3410ce.mp3',
      examplesAudio: ['8014da9fc5f5462c4c25c14718756ebd_ex1.mp3'],
    };
    window.idioms.push(testIdiom);
    localStorage.setItem('englift_idioms', JSON.stringify(window.idioms));
    console.log('🎯 Добавлена тестовая идиома:', testIdiom);
  }

  updateIdiomsCount(); // обновляем счётчик после загрузки из localStorage
}

async function loadIdiomsBank() {
  try {
    // Используем импортированные данные напрямую
    if (idiomsBankData && Array.isArray(idiomsBankData)) {
      window.idiomsBank = idiomsBankData;
      console.log(
        `📚 Загружено ${idiomsBankData.length} идиом из банка через импорт`,
      );
      return;
    }

    // Fallback: пробуем разные пути к файлу
    const paths = ['/idioms.json', './idioms.json', 'idioms.json'];
    let data = null;

    for (const path of paths) {
      try {
        const response = await fetch(path);
        if (response.ok) {
          data = await response.json();
          console.log(
            `📚 Загружено ${data.length} идиом из банка по пути: ${path}`,
          );
          break;
        }
      } catch (e) {
        console.log(`Путь ${path} не сработал, пробуем следующий...`);
      }
    }

    if (!data) {
      throw new Error('Не удалось загрузить idioms.json ни по одному из путей');
    }

    window.idiomsBank = data;
  } catch (e) {
    console.error('Ошибка загрузки банка идиом:', e);
    window.idiomsBank = [];
  }
}

// Вызываем сразу после объявления window.words

loadWordsFromLocalStorage();
loadIdiomsFromLocalStorage(); // сразу после объявления window.idioms

// Debounce функция для оптимизации renderStats

function debounce(fn, delay) {
  let timer;

  return (...args) => {
    clearTimeout(timer);

    timer = setTimeout(() => fn(...args), delay);
  };
}

const debouncedRenderStats = debounce(renderStats, 800);

// Debounce для saveUserData чтобы не убивать квоту

const debouncedSaveUserData = debounce((uid, data) => {
  saveUserData(uid, data).catch(e =>
    console.error('Error saving user data:', e),
  );
}, 5000); // 5 секунд debounce

// Немедленное сохранение для критических данных (XP, бейджи)

const immediateSaveUserData = async (uid, data) => {
  try {
    console.log('⚡ Немедленно сохраняем критические данные:', data);

    await saveUserData(uid, data);
  } catch (error) {
    console.error('Ошибка при немедленном сохранении:', error);

    throw error;
  }
};

// Делаем immediateSaveUserData глобальным для доступа из auth.js

window.immediateSaveUserData = immediateSaveUserData;

// ============================================================

// DELAYED SYNC SYSTEM (offline-first)

// ============================================================

// XSS protection function

// Универсальная функция сохранения всех данных пользователя

async function saveAllUserData() {
  if (!window.currentUserId) return;

  debouncedSaveUserData(window.currentUserId, {
    xp: xpData.xp,

    level: xpData.level,

    badges: xpData.badges,

    streak: streak.count,

    laststreakdate: streak.lastDate,

    dailyprogress: window.dailyProgress,

    lastreviewreset: window.lastReviewResetDate,

    dailyreviewcount: window.dailyReviewCount,

    usersettings: window.user_settings,

    darktheme: document.documentElement.classList.contains('dark'),
  });
}

// НОВАЯ saveProfileData — только помечает dirty

async function saveProfileData() {
  scheduleProfileSave();
}

// syncSaveProfile — тоже через очередь

function syncSaveProfile() {
  if (!window.currentUserId || !window.profileFullyLoaded) return;

  scheduleProfileSave();
}

// Retry механизм

function scheduleRetrySave() {
  if (retryAttempts >= MAX_RETRY_ATTEMPTS) {
    console.warn('⚠️ Максимальное количество повторных попыток исчерпано');

    retryAttempts = 0;

    return;
  }

  retryAttempts++;

  const delay = Math.min(1000 * Math.pow(2, retryAttempts), 30000);

  console.log(
    `🔄 Повторная попытка сохранения профиля через ${delay}мс (попытка ${retryAttempts})`,
  );

  setTimeout(() => {
    saveProfileData();
  }, delay);
}

// Экспортируем глобально

window.saveProfileData = saveProfileData;

// debouncedSaveProfile removed - use scheduleProfileSave instead

// Сохранение через Beacon при закрытии - удалено, используется unified обработчик в конце файла

// Синхронное сохранение профиля при закрытии страницы

function syncSaveProfile() {
  if (!window.currentUserId || !window.profileFullyLoaded) return;

  scheduleProfileSave(); // тоже через очередь
}

// Экспортируем глобально

window.syncSaveProfile = syncSaveProfile;

// ============================================================

// SAFE USER FUNCTIONS

// ============================================================

// Безопасное получение пользователя с ожиданием сессии

async function getCurrentUser() {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) return user;
  } catch (error) {
    console.warn(
      'Ошибка получения пользователя (сеть недоступна):',

      error.message,
    );

    return null;
  }

  // Fallback - ждем восстановления сессии

  return new Promise(resolve => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        subscription.unsubscribe();

        resolve(session?.user || null);
      }
    });
  });
}

// Безопасное сохранение статистики

async function safeSaveStats(changes) {
  try {
    const user = await getCurrentUser();

    if (user) {
      await saveUserData(user.id, changes);

      console.log('✅ Статистика сохранена безопасно');
    } else {
      console.log('❌ Нет пользователя для сохранения статистики');
    }
  } catch (err) {
    console.error('Ошибка сохранения статистики:', err);
  }
}

// ============================================================

// WEEK STATISTICS (простая замена графика)

// ============================================================

function renderWeekChart() {
  // Защита от вызова до загрузки слов
  if (!window.words || !Array.isArray(window.words)) {
    debugLog('Words not loaded yet, skipping renderWeekChart');
    return;
  }

  // Защита от вызова до загрузки идиом
  if (!window.idioms || !Array.isArray(window.idioms)) {
    debugLog('Idioms not loaded yet, skipping renderWeekChart');
    return;
  }

  // Ищем контейнер
  const container = document.querySelector('.week-chart-container');
  if (!container) return;

  const existingContent =
    container.querySelector('[data-week-chart]') ||
    container.querySelector('#weekChart');

  if (
    !window.words ||
    !Array.isArray(window.words) ||
    window.words.length === 0 ||
    !window.idioms ||
    !Array.isArray(window.idioms) ||
    window.idioms.length === 0
  ) {
    const placeholderHtml = `
      <div data-week-chart style="padding: 2rem; text-align: center;">
        <div style="color: var(--muted); opacity: 0.7;">
          Загрузка статистики...
        </div>
      </div>
    `;
    if (existingContent) {
      existingContent.outerHTML = placeholderHtml;
    } else {
      const header = container.querySelector('.daily-cap-header');
      if (header) {
        header.insertAdjacentHTML('afterend', placeholderHtml);
      } else {
        container.insertAdjacentHTML('beforeend', placeholderHtml);
      }
    }
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dayStr = d.toLocaleDateString('ru-RU', { weekday: 'short' });
    const dateStr = d.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'numeric',
    });

    // Считаем слова, добавленные в этот день
    const wordsCount = window.words.filter(w => {
      const created = new Date(w.created_at || w.createdAt);
      created.setHours(0, 0, 0, 0);
      return created.getTime() === d.getTime();
    }).length;

    // Считаем идиомы, добавленные в этот день
    const idiomsCount = window.idioms.filter(i => {
      const created = new Date(i.created_at || i.createdAt);
      created.setHours(0, 0, 0, 0);
      return created.getTime() === d.getTime();
    }).length;

    days.push({
      day: dayStr,
      date: dateStr,
      words: wordsCount,
      idioms: idiomsCount,
      total: wordsCount + idiomsCount,
    });
  }

  const maxTotal = Math.max(...days.map(d => d.total), 1);

  // Генерируем HTML с двумя столбиками
  const html = `
    <div data-week-chart>
      <div class="week-chart">
        <div class="week-stats">
          ${days
            .map(
              d => `
            <div class="week-stat-item">
              <div class="week-day">${d.day}</div>
              <div class="week-date">${d.date}</div>
              <div class="week-bars">
                <div class="week-bar words-bar" style="height: ${(d.words / maxTotal) * 40}px"></div>
                <div class="week-bar idioms-bar" style="height: ${(d.idioms / maxTotal) * 40}px"></div>
              </div>
              <div class="week-count">${d.total}</div>
            </div>
          `,
            )
            .join('')}
        </div>
        <div class="week-total">
          <span><span class="material-symbols-outlined">menu_book</span> ${days.reduce((a, d) => a + d.words, 0)} слов</span>
          <span><span class="material-symbols-outlined">theater_comedy</span> ${days.reduce((a, d) => a + d.idioms, 0)} идиом</span>
        </div>
      </div>
    </div>
  `;

  if (existingContent) {
    existingContent.outerHTML = html;
  } else {
    const header = container.querySelector('.daily-cap-header');
    if (header) {
      header.insertAdjacentHTML('afterend', html);
    } else {
      container.insertAdjacentHTML('beforeend', html);
    }
  }
}

// ============================================================

// GLOBAL FUNCTIONS FOR AUTH.JS

// ============================================================

// ============================================================

// CONSTANTS

// ============================================================

// Разбирает строку с несколькими вариантами перевода (разделители / , ;)

function parseAnswerVariants(str) {
  if (!str) return [];

  return str

    .split(/[\/,;]/)

    .map(s => normalizeRussian(s.trim().toLowerCase()))

    .filter(s => s);
}

// Универсальная функция для HTML фидбека
function getFeedbackHTML(word, isCorrect, confidence = null) {
  const icon = isCorrect ? 'check_circle' : 'cancel';
  const title = isCorrect ? 'Верно!' : 'Неверно.';
  // ← вот эти две строки:
  const displayWord = word.idiom ? word.idiom.toLowerCase() : word.en;
  const displayTrans = word.idiom
    ? parseAnswerVariants(word.meaning).join(', ') || word.meaning
    : parseAnswerVariants(word.ru).join(', ') || word.ru;
  let extra = '';
  if (confidence !== null) {
    extra = `<br><small>Совпадение: ${confidence}%</small>`;
  }
  return `
    <span class="material-symbols-outlined">${icon}</span>
    <div>
      <strong>${title}</strong><br>
      ${displayWord} — ${displayTrans}
      ${extra}
    </div>
  `;
}

// ============================================================

// УТИЛИТЫ

// ============================================================

function formatTag(tag) {
  // Если тег похож на уровень CEFR (буква + цифра), делаем заглавными
  if (/^[a-c][1-2]$/i.test(tag)) return tag.toUpperCase();
  return tag;
}

// ============================================================

// ГЛОБАЛЬНЫЕ ФУНКЦИИ ДЛЯ АВТОРИЗАЦИИ

// ============================================================

function applyProfileData(data) {
  console.log('applyProfileData вызван с:', data);

  if (!data) return;

  window.updateXpData?.({
    xp: data.xp ?? 0,
    level: data.level ?? 1,
    badges: data.badges ?? [],
  });

  window.updateStreak?.({
    count: data.streak ?? 0,
    lastDate: data.laststreakdate ?? null,
  });

  if (data.dailyprogress) {
    console.log('🔍 Применяем dailyprogress:', data.dailyprogress);
    window.updateDailyProgress?.(data.dailyprogress);
  }

  if (data.dailyreviewcount !== undefined) {
    window.dailyReviewCount = data.dailyreviewcount;
  }

  if (data.lastreviewreset) {
    window.lastReviewResetDate = data.lastreviewreset;
  }

  // Настройки пользователя
  console.log('📥 Загруженные usersettings из профиля:', data.usersettings);
  window.user_settings = {
    voice: 'female',
    reviewLimit: 100,
    showPhonetic: data.usersettings?.showPhonetic ?? true,
    baseTheme: data.usersettings?.baseTheme || 'lavender',
    dark: data.usersettings?.dark ?? false,
    ...(data.usersettings || {}),
  };

  // Применяем тему
  console.log('🎨 Применяем тему из данных:', {
    baseTheme: window.user_settings.baseTheme,
    dark: window.user_settings.dark,
  });
  window.applyTheme(window.user_settings.baseTheme, window.user_settings.dark);

  window.lastProfileUpdate = data.updated_at
    ? new Date(data.updated_at).getTime()
    : Date.now();
}

// ============================================================

// SPEECH RECOGNITION SUPPORT

// ============================================================

// Проверка схожести произнесенного слова с правильным

function checkSpeechSimilarity(spoken, correct) {
  if (!spoken || !correct) return { isCorrect: false, confidence: 0 };

  // Точное совпадение

  if (spoken === correct) return { isCorrect: true, confidence: 100 };

  // Удаляем артикли и предлоги для сравнения

  const cleanSpoken = spoken

    .replace(/\b(a|an|the|in|on|at|to|for|of|with)\b/gi, '')

    .trim();

  const cleanCorrect = correct

    .replace(/\b(a|an|the|in|on|at|to|for|of|with)\b/gi, '')

    .trim();

  if (cleanSpoken === cleanCorrect) return { isCorrect: true, confidence: 95 };

  // Проверяем содержит ли одно другое

  if (cleanSpoken.includes(cleanCorrect) || cleanCorrect.includes(cleanSpoken))
    return { isCorrect: true, confidence: 85 };

  // Расстояние Левенштейна для похожих слов

  const distance = levenshteinDistance(cleanSpoken, cleanCorrect);

  const maxLength = Math.max(cleanSpoken.length, cleanCorrect.length);

  const similarity = 1 - distance / maxLength;

  const confidencePercentage = Math.round(similarity * 100);

  // Считаем правильным если схожесть > 80%

  return {
    isCorrect: similarity > CONSTANTS.SPEECH.SIMILARITY_THRESHOLD,

    confidence: confidencePercentage,
  };
}

// Расстояние Левенштейна для сравнения строк

function levenshteinDistance(str1, str2) {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,

          matrix[i][j - 1] + 1,

          matrix[i - 1][j] + 1,
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

// Инициализация обработчиков для карточек упражнений
updateExerciseSelection();

// Показываем предупреждение если Speech Recognition не поддерживается

if (!speechRecognitionSupported) {
  const speechCard = document.querySelector('.exercise-card[data-ex="speech"]');

  if (speechCard) {
    speechCard.style.opacity = '0.5';

    speechCard.style.pointerEvents = 'none';
  }

  const speechSentenceCard = document.querySelector(
    '.exercise-card[data-ex="speech-sentence"]',
  );

  if (speechSentenceCard) {
    speechSentenceCard.style.opacity = '0.5';

    speechSentenceCard.style.pointerEvents = 'none';
  }
}

// Улучшенная функция экранирования HTML (полная защита от XSS)

function esc(str) {
  if (!str) return '';

  return String(str)
    .replace(/&/g, '&amp;')

    .replace(/</g, '&lt;')

    .replace(/>/g, '&gt;')

    .replace(/"/g, '&quot;')

    .replace(/'/g, '&#39;')

    .replace(/\//g, '&#x2F;');
}

// Безопасное экранирование для HTML атрибутов (защита от XSS в value="")

function safeAttr(str) {
  if (!str) return '';

  return String(str)
    .replace(/&/g, '&amp;')

    .replace(/</g, '&lt;')

    .replace(/>/g, '&gt;')

    .replace(/"/g, '&quot;')

    .replace(/'/g, '&#39;')

    .replace(/\//g, '&#x2F;');
}

// Валидация английского слова

function validateEnglish(word) {
  if (!word || typeof word !== 'string') return false;

  const trimmed = word.trim();

  if (trimmed.length < 1 || trimmed.length > CONSTANTS.LIMITS.MAX_WORD_LENGTH)
    return false;

  // Проверяем на допустимые символы (буквы, дефисы, апострофы)

  return /^[a-zA-Z\s\-\']+$/.test(trimmed);
}

// Заполнение полей формы из объекта данных

function fillFormWithData(data) {
  const ruInput = document.getElementById('modal-word-ru');

  const exInput = document.getElementById('modal-word-ex');

  const exTransInput = document.getElementById('modal-word-ex-translation');

  const tagsInput = document.getElementById('modal-word-tags');

  // Сбрасываем классы auto-filled у всех полей

  [ruInput, exInput, exTransInput, tagsInput].forEach(input => {
    if (input) input.classList.remove('auto-filled');
  });

  let filledFields = 0;

  if (data.ru && data.ru.trim()) {
    ruInput.value = data.ru;

    ruInput.classList.add('auto-filled');

    filledFields++;
  }

  if (data.examples && data.examples.length > 0) {
    const firstExample = data.examples[0];

    exInput.value = firstExample.text || firstExample;

    exInput.classList.add('auto-filled');

    filledFields++;

    if (exTransInput) {
      exTransInput.value = firstExample.translation || '';

      if (firstExample.translation) {
        exTransInput.classList.add('auto-filled');

        filledFields++;
      }
    }
  }

  if (data.tags && data.tags.length > 0) {
    tagsInput.value = data.tags.slice(0, 3).join(', ');

    tagsInput.classList.add('auto-filled');

    filledFields++;
  }

  if (filledFields > 0) {
    console.log(`✓ Получено ${filledFields} поля через автодополнение слова`);
  } else {
    console.log(
      '⚠ Данные не найдены. Попробуйте другое слово или введите вручную',
    );
  }
}

function fillIdiomFormWithData(data) {
  const meaningInput = document.getElementById('modal-idiom-ru');
  const definitionInput = document.getElementById('modal-idiom-definition');
  const exInput = document.getElementById('modal-idiom-ex');
  const exTransInput = document.getElementById('modal-idiom-ex-translation');
  const tagsInput = document.getElementById('modal-idiom-tags');

  // Сбрасываем классы auto-filled
  [meaningInput, definitionInput, exInput, exTransInput, tagsInput].forEach(
    input => {
      if (input) input.classList.remove('auto-filled');
    },
  );

  let filledFields = 0;

  if (data.meaning && data.meaning.trim()) {
    meaningInput.value = data.meaning;
    meaningInput.classList.add('auto-filled');
    filledFields++;
  }

  if (data.definition && data.definition.trim()) {
    definitionInput.value = data.definition;
    definitionInput.classList.add('auto-filled');
    filledFields++;
  }

  if (data.example && data.example.trim()) {
    exInput.value = data.example;
    exInput.classList.add('auto-filled');
    filledFields++;
  }

  if (data.example_translation && data.example_translation.trim()) {
    exTransInput.value = data.example_translation;
    exTransInput.classList.add('auto-filled');
    filledFields++;
  }

  if (data.tags && data.tags.length > 0) {
    tagsInput.value = data.tags.slice(0, 5).join(', ');
    tagsInput.classList.add('auto-filled');
    filledFields++;
  }

  if (filledFields > 0) {
    console.log(`✓ Получено ${filledFields} полей через автодополнение`);
  } else {
    console.log(
      '⚠ Данные не найдены. Попробуйте другую идиому или введите вручную',
    );
  }
}

// Валидация русского перевода

function validateRussian(translation) {
  if (!translation || typeof translation !== 'string') return false;

  const trimmed = translation.trim();

  if (
    trimmed.length < 1 ||
    trimmed.length > CONSTANTS.LIMITS.MAX_TRANSLATION_LENGTH
  )
    return false;

  // Проверяем на допустимые символы (буквы, знаки препинания)

  return /^[а-яА-ЯёЁ\s\-\.\,\!\?\(\)\[\]\"\'\;\/]+$/.test(trimmed);
}

// Валидация примера (усиленная защита от HTML инъекций)

function validateExample(example) {
  if (!example) return true; // пример опциональный

  const trimmed = example.trim();

  if (trimmed.length > CONSTANTS.LIMITS.MAX_EXAMPLE_LENGTH) return false;

  // Полная проверка на XSS и HTML инъекции

  const dangerousPatterns = [
    /<script/i,

    /javascript:/i,

    /on\w+\s*=/i, // onclick, onload, onerror и т.д.

    /<iframe/i,

    /<object/i,

    /<embed/i,

    /<link/i,

    /<meta/i,

    /@import/i,

    /expression\s*\(/i,

    /vbscript:/i,

    /data:text\/html/i,

    /<img[^>]*onerror/i,

    /<svg[^>]*onload/i,

    /<body[^>]*onload/i,

    /<input[^>]*onfocus/i,

    /<select[^>]*onchange/i,

    /<textarea[^>]*onfocus/i,
  ];

  // Проверяем только на опасные паттерны, разрешаем большинство символов

  return !dangerousPatterns.some(pattern => pattern.test(trimmed));
}

// Валидация тегов

function validateTags(tags) {
  if (!Array.isArray(tags)) return false;

  return tags.every(tag => {
    if (typeof tag !== 'string') return false;

    const trimmed = tag.trim();

    return (
      trimmed.length > 0 &&
      trimmed.length <= CONSTANTS.LIMITS.MAX_TAG_LENGTH &&
      /^[a-zA-Zа-яА-ЯёЁ0-9\s\-\_]+$/.test(trimmed)
    );
  });
}

// Очистка и нормализация тегов (улучшенная)

function normalizeTags(tagsString) {
  if (!tagsString || typeof tagsString !== 'string') return [];

  return tagsString

    .split(',')

    .map(
      tag =>
        tag

          .trim()

          .toLowerCase()

          .replace(/\s+/g, '-') // пробелы → дефис

          .replace(/[^a-z0-9а-яё\-\_]/g, ''), // только буквы, цифры, дефис, подчеркивание
    )

    .filter(
      tag => tag.length > 0 && tag.length <= CONSTANTS.LIMITS.MAX_TAG_LENGTH,
    )

    .slice(0, CONSTANTS.LIMITS.MAX_TAGS); // Максимум 10 тегов
}

// ============================================================

// LOADING INDICATORS

// ============================================================

function showLoading(message = 'Загрузка...') {
  const overlay = document.createElement('div');

  overlay.className = 'loading-overlay';

  overlay.id = 'loading-overlay';

  overlay.innerHTML = `







    <div class="loading-modal">







      <div class="loading-spinner"></div>







      <div>${esc(message)}</div>







    </div>







  `;

  document.body.appendChild(overlay);
}

function hideLoading() {
  const overlay = document.getElementById('loading-overlay');

  if (overlay) overlay.remove();
}

// Делаем функции глобальными для доступа из других модулей

window.showLoading = showLoading;

window.hideLoading = hideLoading;

function setButtonLoading(button, loading = true) {
  if (loading) {
    button.classList.add('loading');

    button.disabled = true;
  } else {
    button.classList.remove('loading');

    button.disabled = false;
  }
}

// ============================================================

// DATA

// ============================================================

// Функции для получения ключей

async function getXPKey() {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return user
      ? `${CONSTANTS.STORAGE_KEYS.XP}_${user.id}`
      : CONSTANTS.STORAGE_KEYS.XP;
  } catch {
    return CONSTANTS.STORAGE_KEYS.XP;
  }
}

async function getStreakKey() {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return user
      ? `${CONSTANTS.STORAGE_KEYS.STREAK}_${user.id}`
      : CONSTANTS.STORAGE_KEYS.STREAK;
  } catch {
    return CONSTANTS.STORAGE_KEYS.STREAK;
  }
}

async function getSpeechKey() {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return user
      ? `${CONSTANTS.STORAGE_KEYS.SPEECH}_${user.id}`
      : CONSTANTS.STORAGE_KEYS.SPEECH;
  } catch {
    return CONSTANTS.STORAGE_KEYS.SPEECH;
  }
}

// Глобальные функции для обновления XP и streak из других модулей

window.updateXpData = function (newXpData) {
  // Полностью заменяем xpData данными из Supabase

  xpData = { ...newXpData };

  renderXP();
};

window.updateStreak = function (newStreak) {
  // Полностью заменяем streak данными из Supabase

  streak = { ...newStreak };

  renderStats();
};

// Global function to update daily progress from Supabase

window.updateDailyProgress = function (newDailyProgress) {
  // Принимаем данные с сервера, но оставляем локальные значения, если они больше
  const merged = {
    add_new: Math.max(
      window.dailyProgress?.add_new || 0,
      newDailyProgress.add_new || newDailyProgress.addnew || 0,
    ),
    review: Math.max(
      window.dailyProgress?.review || 0,
      newDailyProgress.review || 0,
    ),
    practice_time: Math.max(
      window.dailyProgress?.practice_time || 0,
      newDailyProgress.practice_time || newDailyProgress.practicetime || 0,
    ),
    completed:
      newDailyProgress.completed || window.dailyProgress?.completed || false,
    lastReset:
      newDailyProgress.lastReset ||
      newDailyProgress.last_reset ||
      window.dailyProgress?.lastReset ||
      new Date().toISOString().split('T')[0],
  };
  window.dailyProgress = merged;

  // Debug: Log merged daily progress
  console.log('🔍 Объединённый daily_progress:', window.dailyProgress);

  renderStats();
};

// Daily goals reset function

async function resetDailyGoalsIfNeeded() {
  const today = new Date().toISOString().split('T')[0]; // "2026-03-05"

  if (window.dailyProgress.lastReset !== today) {
    window.dailyProgress = {
      add_new: 0,

      review: 0,

      practice_time: 0,

      completed: false,

      lastReset: today,
    };

    // Mark profile as dirty to ensure reset is saved
    scheduleProfileSave();

    // Update UI to show reset goals immediately
    refreshUI();

    // Сохраняем в Supabase для персистентности

    if (window.currentUserId) {
      try {
        debouncedSaveUserData(window.currentUserId, {
          daily_progress: window.dailyProgress,
        });
      } catch (err) {
        console.error('Error saving daily progress:', err);
      }
    }
  }
}

function resetAddForm() {
  // Сбрасываем модальную форму слова
  const wordForm = document.getElementById('add-word-form');
  if (wordForm) {
    wordForm.reset();
    // Удаляем класс auto-filled со всех полей в форме
    wordForm.querySelectorAll('.auto-filled').forEach(el => {
      el.classList.remove('auto-filled');
    });
    // Дополнительная очистка всех полей формы
    wordForm.querySelectorAll('input').forEach(input => {
      input.classList.remove('auto-filled');
      input.value = '';
    });
    lastFetchedWordData = null;
  }

  // Сбрасываем модальную форму идиомы
  const idiomForm = document.getElementById('add-idiom-form');
  if (idiomForm) {
    idiomForm.reset();
    // Удаляем класс auto-filled со всех полей в форме идиомы
    idiomForm.querySelectorAll('.auto-filled').forEach(el => {
      el.classList.remove('auto-filled');
    });
    idiomForm.querySelectorAll('input').forEach(input => {
      input.classList.remove('auto-filled');
      input.value = '';
    });
    lastFetchedIdiomData = null; // очищаем данные автозаполнения идиомы
  }
}

// Check daily goals completion and give rewards

async function checkDailyGoalsCompletion() {
  const allCompleted = DAILY_GOALS.every(goal => {
    return window.dailyProgress[goal.id] >= goal.target;
  });

  if (allCompleted && !window.dailyProgress.completed) {
    window.dailyProgress.completed = true;

    // Calculate total reward

    const totalReward = DAILY_GOALS.reduce(
      (sum, goal) => sum + goal.xpReward,

      0,
    );

    // Give bonus XP

    gainXP(
      totalReward,

      'все ежедневные цели выполнены <span class="material-symbols-outlined" style="vertical-align: middle; font-size: 16px;">celebration</span>',
    );

    // Update UI immediately after gaining XP
    refreshUI();

    toast(
      '🎉 Все ежедневные цели выполнены! +' + totalReward + ' XP',

      'success',
    );

    // Trigger confetti animation

    spawnConfetti();

    refreshUI(); // Update display
  }
}

// Загрузка банка слов для автодополнения (теперь через кэш)

window.wordBank = [];

// Инициализация при старте
window.WordAPI.loadWordBank().then(bank => {
  window.wordBank = bank;
});

async function load() {
  try {
    // Сначала пробуем загрузить из localStorage

    const local = localStorage.getItem('englift_words');

    if (local) {
      window.words = JSON.parse(local);

      debugLog('Loaded', window.words.length, 'words from localStorage');
    }

    // Восстанавливаем статистику из страховки если нужно
    // ЗАКОММЕНТИРОВАНО - теперь используем upsert в Supabase
    /*
    try {
      const backup = localStorage.getItem('englift_lastknown_progress');

      if (backup) {
        const backupData = JSON.parse(backup);

        console.log('🔄 Восстанавливаем данные из страховки:', backupData);

        // Восстанавливать ТОЛЬКО если backup сегодняшний

        const today = new Date().toISOString().split('T')[0];

        if (backupData.daily_progress?.lastReset === today) {
          const localIsToday = window.dailyProgress?.lastReset === today;

          if (!localIsToday) {
            window.updateDailyProgress?.(backupData.daily_progress);
          } else {
            // merge — берём максимум

            window.updateDailyProgress?.({
              add_new: Math.max(
                window.dailyProgress.add_new || 0,

                backupData.daily_progress.add_new || 0,
              ),

              review: Math.max(
                window.dailyProgress.review || 0,

                backupData.daily_progress.review || 0,
              ),

              practice_time: Math.max(
                window.dailyProgress.practice_time || 0,

                backupData.daily_progress.practice_time || 0,
              ),

              completed:
                window.dailyProgress.completed ||
                backupData.daily_progress.completed,

              lastReset: today,
            });
          }
        } else {
          console.log(
            '🔄 Backup не сегодняшний, пропускаем восстановление daily_progress',
          );
        }

        if (window.xpData?.xp < backupData.xp) {
          window.updateXpData?.({
            xp: backupData.xp,

            level: backupData.level,

            badges: [],
          });
        }

        if (window.streak?.count < backupData.streak) {
          window.updateStreak?.({
            count: backupData.streak,

            lastDate: backupData.last_streak_date,
          });
        }
      }
    } catch (e) {
      console.warn('Ошибка восстановления из страховки:', e);
    }
    */

    // Сбрасываем счетчик повторений при загрузке - УДАЛЕНО (будет вызываться в applyProfileData)

    // Загрузка будет происходить через Supabase listener в auth.js
  } catch (e) {
    window.words = [];
  }
}

// Миграция переводов примеров из dictionary.json в существующие слова

async function migrateExampleTranslations() {
  try {
    // Проверяем, выполняли ли уже миграцию

    const migrationKey = 'englift_example_translations_migrated';

    if (localStorage.getItem(migrationKey) === 'true') {
      console.log('📦 Миграция переводов уже выполнялась ранее');

      return;
    }

    const bank = await window.WordAPI.loadWordBank();

    if (!bank) {
      return;
    }

    let updated = 0;

    window.words = window.words.map(word => {
      const bankWord = bank.find(
        w => w.en.toLowerCase() === word.en.toLowerCase(),
      );

      if (!bankWord) {
        console.log(`⚠️ Word "${word.en}" not found in dictionary`);

        return word;
      }

      // Если у слова нет примеров или они пустые, копируем из банка

      if (!word.examples || word.examples.length === 0) {
        word.examples = bankWord.examples.map(ex => ({ ...ex }));

        updated++;
      } else {
        // Если примеры есть, но перевод пустой, пробуем найти соответствующий пример в банке

        word.examples = word.examples.map((ex, idx) => {
          if (ex.translation) return ex; // уже есть перевод

          const bankExample = bankWord.examples[idx];

          if (bankExample && bankExample.translation) {
            ex.translation = bankExample.translation;

            updated++;
          }

          return ex;
        });
      }

      return word;
    });

    if (updated > 0) {
      debouncedSave();

      toast(`Обновлено переводов для ${updated} примеров`, 'success');

      console.log(`📦 Миграция завершена: обновлено ${updated} переводов`);
    }

    // Помечаем что миграция выполнена

    localStorage.setItem(migrationKey, 'true');
  } catch (error) {
    console.error('❌ Migration error:', error);
  }
}

// Загрузка слов из dictionary.json при первом запуске - УДАЛЕНО ДЛЯ БЕЗОПАСНОСТИ

// async function loadDictionaryFromJson() { ... }

// НОВАЯ функция — тихое сохранение с задержкой

function debouncedSave() {
  if (saveTimeout) clearTimeout(saveTimeout);

  saveTimeout = setTimeout(() => {
    save(true); // true = тихий режим
  }, 800); // 800 мс — оптимально
}

function save(silent = false) {
  if (isSaving) return Promise.resolve();

  isSaving = true;

  try {
    // Сохраняем в localStorage для офлайн-режима

    if (!silent) {
      localStorage.setItem('englift_words', JSON.stringify(window.words));
    }

    const data = JSON.stringify(window.words);

    // Проверяем размер данных перед сохранением

    if (data.length > 5 * 1024 * 1024) {
      // 5MB limit

      debugLog('Data size exceeds 5MB, trimming...');

      window.words = window.words.slice(0, 1000); // Оставляем только первые 1000 слов
    }

    return true;
  } catch (e) {
    console.error('Error saving window.words:', e);

    if (!silent) {
      toast('Ошибка сохранения', 'danger', 'save');
    }

    return false;
  } finally {
    isSaving = false;
  }
}

// Делаем save глобальным для доступа из db.js

window.save = save;

// Делаем speak глобальным для доступа из HTML - УДАЛЕНО, теперь используем window.speakWord

async function saveXP() {
  try {
    const user = await getCurrentUser();

    if (user) {
      await immediateSaveUserData(user.id, {
        xp: xpData.xp,

        level: xpData.level,

        badges: xpData.badges,
      });

      console.log('✅ XP сохранено');
    }
  } catch (error) {
    console.error('Ошибка сохранения XP:', error);

    // Пробуем сохранить через debounce (если проблема с сетью, повторится позже)

    if (window.currentUserId) {
      debouncedSaveUserData(window.currentUserId, {
        xp: xpData.xp,

        level: xpData.level,

        badges: xpData.badges,
      });
    }
  }
}

async function saveStreak() {
  const key = await getStreakKey();

  localStorage.setItem(key, JSON.stringify(streak));

  saveAllUserData();
}

// Fallback для генерации UUID в старых браузерах

function generateId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback для старых браузеров

  return 'xxxx-xxxx-4xxx-yxxx-xxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;

    const v = c === 'x' ? r : (r & 0x3) | 0x8;

    return v.toString(16);
  });
}

function mkWord(
  en,

  ru,

  ex,

  tags,

  phonetic = null,

  examples = null,

  audio = null,

  examplesAudio = null,
) {
  // Если передан массив examples в новом формате – используем его

  let examplesArray = examples;

  if (!examplesArray) {
    // Если есть старая строка ex, создаём один пример без перевода

    if (ex && ex.trim()) {
      examplesArray = [{ text: ex.trim(), translation: '' }];
    } else {
      examplesArray = [];
    }
  }

  return {
    id: generateId(),

    en: en.trim(),

    ru: ru.trim(),

    ex: (ex || '').trim(), // сохраняем для совместимости

    phonetic: phonetic || null,

    tags: tags || [],

    examples: examplesArray,

    audio: audio, // новое поле

    examplesAudio: examplesAudio, // новое поле

    createdAt: new Date().toISOString(),

    updatedAt: new Date().toISOString(), // добавляем updatedAt

    stats: {
      shown: 0,

      correct: 0,

      streak: 0,

      lastPracticed: null,

      learned: false,

      nextReview: new Date().toISOString(),

      interval: 1,

      easeFactor: 2.5,

      correctExerciseTypes: [], // ← новое поле
    },
  };
}

async function addWord(
  en,

  ru,

  ex,

  tags,

  phonetic = null,

  examples = null,

  audio = null,

  examplesAudio = null,
) {
  console.log('🔄 addWord вызван с параметрами:', {
    en,

    ru,

    ex,

    tags,

    phonetic,

    examples,
  });

  // Валидация входных данных

  if (!validateEnglish(en)) {
    toast(
      '✗ Неверный формат английского слова. Используйте только буквы, дефисы и апострофы.',

      'danger',
    );

    return false;
  }

  if (!validateRussian(ru)) {
    toast(
      '✗ Неверный формат перевода. Используйте только русские буквы и знаки препинания.',

      'danger',
    );

    return false;
  }

  if (!validateExample(ex)) {
    toast(
      '✗ Неверный формат примера. Проверьте наличие недопустимых символов.',

      'danger',
    );

    return false;
  }

  if (!validateTags(tags)) {
    toast(
      '✗ Неверный формат тегов. Используйте буквы, цифры, дефисы и подчеркивания.',

      'danger',
    );

    return false;
  }

  // Нормализация данных

  const normalizedEn = en.trim();

  const normalizedRu = ru.trim();

  const normalizedPhonetic = phonetic ? phonetic.trim() : '';

  const normalizedEx = ex ? ex.trim() : '';

  const normalizedTags = tags;

  // Проверка дубликата — ТОЛЬКО по твоему словарю (window.words)
  const isDuplicate = window.words.some(w => {
    if (w.en.toLowerCase() !== normalizedEn.toLowerCase()) return false;
    const existingRuVariants = parseAnswerVariants(w.ru);
    const newRuVariants = parseAnswerVariants(normalizedRu);
    return newRuVariants.some(v => existingRuVariants.includes(v));
  });

  if (isDuplicate) {
    toast(
      'Слово «' + esc(normalizedEn) + '» с таким переводом уже есть',
      'warning',
    );
    return false;
  }

  try {
    const newWord = mkWord(
      normalizedEn,

      normalizedRu,

      normalizedEx,

      normalizedTags,

      normalizedPhonetic,

      examples,

      audio, // передаем параметр

      examplesAudio, // передаем параметр
    );

    window.words.push(newWord);

    // Сразу сохраняем в localStorage

    localStorage.setItem('englift_words', JSON.stringify(window.words));

    // --- МГНОВЕННОЕ СОХРАНЕНИЕ НА СЕРВЕР (если есть интернет) ---

    if (navigator.onLine && window.currentUserId) {
      try {
        await saveWordToDb(newWord);

        console.log(`✅ Слово "${normalizedEn}" мгновенно сохранено на сервер`);
      } catch (e) {
        console.warn(
          `⚠️ Ошибка мгновенного сохранения "${normalizedEn}", добавляем в очередь`,

          e,
        );

        markWordDirty(newWord.id); // в очередь как запасной вариант
      }
    } else {
      console.log('📴 Офлайн или нет пользователя – слово в очереди');

      markWordDirty(newWord.id);
    }

    // Очищаем кеш рендеринга

    renderCache.clear();

    // Обновляем прогресс ежедневных целей

    resetDailyGoalsIfNeeded();

    window.dailyProgress.add_new = (window.dailyProgress.add_new || 0) + 1;

    checkDailyGoalsCompletion();

    gainXP(5, 'новое слово');

    visibleLimit = 30; // сброс при добавлении слова

    // Сохраняем профиль (один раз!)

    window.saveProfileData?.();

    // Пересчитываем уровни CEFR и обновляем интерфейс

    recalculateCefrLevels();

    // Debug: Check add_new value before refreshUI
    console.log('🔍 add_new после увеличения:', window.dailyProgress.add_new);

    // Update UI to show daily goals progress immediately
    refreshUI();

    console.log('✅ addWord завершен успешно');

    return true;
  } catch (error) {
    console.error('Error adding word:', error);

    toast('Ошибка добавления слова: ' + error.message, 'danger', 'add_word');

    return false;
  }
}

async function delWord(id) {
  const word = window.words.find(w => w.id === id);

  if (!word) return;

  // Добавляем в очередь с флагом удаления

  pendingWordUpdates.set(id, { ...word, _deleted: true });

  scheduleWordSync(); // запускаем синхронизацию

  // Удаляем из локального массива

  window.words = window.words.filter(w => w.id !== id);

  // Сохраняем в localStorage

  debouncedSave();

  // Обновляем интерфейс

  renderCache.clear();

  visibleLimit = 30;

  recalculateCefrLevels();

  refreshUI();

  scheduleProfileSave(); // ← ДОБАВЬ ЭТО

  // Если есть интернет, пробуем сразу удалить (опционально)

  if (navigator.onLine && window.currentUserId) {
    try {
      await deleteWordFromDb(id);

      // Если успешно, убираем из очереди

      pendingWordUpdates.delete(id);

      console.log(`✅ Слово "${word.en}" удалено с сервера`);
    } catch (e) {
      console.error('❌ Ошибка удаления с сервера, осталось в очереди', e);

      // Остаётся в очереди, повторится позже
    }
  }
}

async function updWord(id, data) {
  const w = window.words.find(w => w.id === id);

  if (w) {
    Object.assign(w, data, { updatedAt: new Date().toISOString() }); // добавляем updatedAt

    // Отмечаем слово для пакетной синхронизации вместо немедленного сохранения

    markWordDirty(id);

    renderCache.clear(); // <-- добавляем очистку кеша рендеринга

    // Устанавливаем флаг локальных изменений

    window.hasLocalChanges = true;

    // Пересчитываем уровни CEFR после обновления

    recalculateCefrLevels();

    // Обновляем интерфейс

    refreshUI();

    // Сохраняем изменения в localStorage

    debouncedSave();
  }

  scheduleProfileSave(); // ← ДОБАВЬ ЭТО
}

async function addIdiom(
  idiom,
  meaning,
  definition = '',
  ex = '',
  phonetic = '',
  tagsString = '',
  audio = null,
  examplesAudio = [],
  exampleTranslation = '', // Добавляем параметр для перевода примера
) {
  console.log(
    '🎯 addIdiom called with exampleTranslation:',
    exampleTranslation,
  );
  // Валидация
  if (!idiom || !idiom.trim()) {
    toast('Идиома не может быть пустой', 'danger');
    return false;
  }
  if (!meaning || !meaning.trim()) {
    toast('Значение не может быть пустым', 'danger');
    return false;
  }

  // Нормализация тегов
  const tags = normalizeTags(tagsString); // используем существующую функцию

  // Преобразуем пример (ex) в массив examples (как у слов)
  const examples =
    ex && typeof ex === 'string' && ex.trim()
      ? [{ text: ex.trim(), translation: '' }]
      : [];

  const newIdiom = {
    id: generateId(),
    idiom: idiom.trim(),
    meaning: meaning.trim(),
    definition: definition.trim(),
    ex: ex && typeof ex === 'string' ? ex.trim() : '',
    example: ex && typeof ex === 'string' ? ex.trim() : '', // Добавляем поле example
    example_translation:
      exampleTranslation && typeof exampleTranslation === 'string'
        ? exampleTranslation.trim()
        : '', // Сохраняем перевод примера
    examples: examples,
    phonetic: phonetic && typeof phonetic === 'string' ? phonetic.trim() : '',
    tags: tags,
    audio: audio,
    examplesAudio: examplesAudio || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    stats: {
      shown: 0,
      correct: 0,
      streak: 0,
      lastPracticed: null,
      learned: false,
      nextReview: new Date().toISOString(),
      interval: 1,
      easeFactor: 2.5,
      correctExerciseTypes: [], // ← новое поле
    },
  };

  // Проверка дубликата: одинаковый idiom и совпадающее meaning (хотя бы частично)
  const isDuplicate = window.idioms.some(
    i =>
      i.idiom.toLowerCase() === newIdiom.idiom.toLowerCase() &&
      normalizeRussian(i.meaning.toLowerCase()) ===
        normalizeRussian(newIdiom.meaning.toLowerCase()),
  );
  if (isDuplicate) {
    toast(`Идиома «${idiom}» с таким значением уже есть`, 'warning');
    return false;
  }

  window.idioms.push(newIdiom);
  localStorage.setItem('englift_idioms', JSON.stringify(window.idioms));
  updateIdiomsCount(); // обновляем счётчик

  if (navigator.onLine && window.currentUserId) {
    try {
      await saveIdiomToDb(newIdiom);
    } catch (e) {
      markIdiomDirty(newIdiom.id);
    }
  } else {
    markIdiomDirty(newIdiom.id);
  }

  renderIdioms(); // обновляем отображение
  gainXP(5, 'новая идиома');
  return true;
}

async function delIdiom(id) {
  const idiom = window.idioms.find(i => i.id === id);
  if (!idiom) return;

  pendingIdiomUpdates.set(id, { ...idiom, _deleted: true });
  scheduleIdiomSync();

  window.idioms = window.idioms.filter(i => i.id !== id);
  localStorage.setItem('englift_idioms', JSON.stringify(window.idioms));
  updateIdiomsCount(); // обновляем счётчик
  renderIdioms();
}

async function updIdiom(id, data) {
  const i = window.idioms.find(i => i.id === id);
  if (i) {
    Object.assign(i, data, { updatedAt: new Date().toISOString() });
    markIdiomDirty(id);
    localStorage.setItem('englift_idioms', JSON.stringify(window.idioms));
    renderIdioms();
  }
}

function updStats(id, correct, exerciseType) {
  const w = window.words.find(w => w.id === id);

  if (!w) {
    console.log('❌ Слово не найдено для updStats:', id);

    return;
  }

  w.stats.shown++;

  w.stats.lastPracticed = new Date().toISOString();

  if (correct) {
    w.stats.correct++;

    w.stats.streak++;

    w.stats.easeFactor = Math.max(
      1.3,

      Math.min(2.5, w.stats.easeFactor + 0.05),
    );

    // Добавляем тип упражнения, если его ещё нет
    if (!w.stats.correctExerciseTypes.includes(exerciseType)) {
      w.stats.correctExerciseTypes.push(exerciseType);
    }

    if (w.stats.interval <= 1) {
      w.stats.interval = 3;
    } else if (w.stats.interval <= 3) {
      w.stats.interval = 7;
    } else if (w.stats.interval <= 7) {
      w.stats.interval = 14;
    } else if (w.stats.interval <= 14) {
      w.stats.interval = 30;
    } else if (w.stats.interval <= 30) {
      w.stats.interval = 60;
    } else {
      // Максимальный интервал - 180 дней (6 месяцев)

      w.stats.interval = Math.min(180, Math.round(w.stats.interval * 1.2));
    }
  } else {
    w.stats.streak = 0;

    w.stats.interval = 1;

    w.stats.easeFactor = Math.max(1.3, w.stats.easeFactor - 0.2);
    // Массив correctExerciseTypes НЕ трогаем!
  }

  const next = new Date();

  next.setDate(next.getDate() + w.stats.interval);

  w.stats.nextReview = next.toISOString();

  // Новый критерий выученности: legacy ИЛИ минимум 3 разных типа
  const wasLearned = w.stats.learned;
  w.stats.learned =
    w.stats.correctExerciseTypes.includes('legacy') ||
    w.stats.correctExerciseTypes.length >= 3;

  if (!wasLearned && w.stats.learned) {
    gainXP(
      20,

      'слово выучено <span class="material-symbols-outlined" style="vertical-align: middle; font-size: 16px;">star</span>',
    );

    autoCheckBadges(); // Автоматическая проверка бейджей
  }

  // Отмечаем слово для пакетной синхронизации

  markWordDirty(id);
}

// Функция для проверки и обновления бейджей

function xpNeeded(lvl) {
  return lvl * XP_PER_LEVEL;
}

function gainXP(amount, reason = '') {
  console.log('⭐ gainXP вызван:', {
    amount,

    reason,

    currentXP: xpData.xp,

    currentLevel: xpData.level,
  });

  xpData.xp += amount;

  while (xpData.xp >= xpNeeded(xpData.level)) {
    xpData.xp -= xpNeeded(xpData.level);

    xpData.level++;

    showLevelUpBanner(xpData.level);
  }

  // Немедленно обновляем интерфейс

  renderXP();

  // Показываем тост сразу

  toast('+' + amount + ' XP' + (reason ? ' · ' + reason : ''), 'xp', 'bolt');

  // Сохраняем профиль через dirty flag

  console.log('💾 Вызываем scheduleProfileSave из gainXP');

  scheduleProfileSave();

  // Проверяем бейджи

  checkBadges();

  renderBadges();

  console.log(
    '✅ gainXP завершен, новый уровень:',

    xpData.level,

    'новый XP:',

    xpData.xp,
  );
}

function checkBadges(perfectSession) {
  let newBadges = [];

  // Собираем данные для проверки условий бейджей
  const totalWords = window.words ? window.words.length : 0;
  const totalIdioms = window.idioms ? window.idioms.length : 0;
  const learnedWords = window.words
    ? window.words.filter(w => w.level >= 5).length
    : 0;
  const learnedIdioms = window.idioms
    ? window.idioms.filter(i => i.level >= 5).length
    : 0;

  const badgeData = {
    totalWords,
    totalIdioms,
    learnedWords,
    learnedIdioms,
    xp: xpData.xp,
    level: xpData.level,
    streak: streak.count,
  };

  BADGES_DEF.forEach(def => {
    if (xpData.badges.includes(def.id)) return;

    let earned;
    if (def.id === 'accuracy_perfection') {
      // Для бейджа точности используем perfectSession напрямую
      earned = !!perfectSession;
    } else {
      // Для остальных бейджей вызываем condition с данными
      earned = def.condition(badgeData);
    }

    if (earned) {
      xpData.badges.push(def.id);
      newBadges.push(def);
    }
  });

  if (newBadges.length) {
    // Показываем тосты немедленно

    newBadges.forEach((b, i) =>
      setTimeout(
        () => toast(b.icon + ' Бейдж: «' + b.name + '»!', 'success'),

        i * 600,
      ),
    );

    // Сохраняем асинхронно

    saveXP();
  }

  renderBadges();
}

// Автоматическая проверка бейджей при изменении данных

function autoCheckBadges() {
  const previousBadges = [...xpData.badges];

  checkBadges();

  // Если появились новые бейджи, показываем уведомление

  const newBadges = xpData.badges.filter(id => !previousBadges.includes(id));

  if (newBadges.length > 0) {
    const newBadgeDefs = BADGES_DEF.filter(def => newBadges.includes(def.id));

    console.log(
      'Автоматически получены бейджи:',

      newBadgeDefs.map(b => b.name),
    );
  }
}

// Периодическая проверка бейджей (каждые 30 секунд)

function startBadgeAutoCheck() {
  if (badgeCheckInterval) clearInterval(badgeCheckInterval);

  badgeCheckInterval = setInterval(() => {
    autoCheckBadges();
  }, 30000); // 30 секунд
}

// Добавить обработчик visibilitychange для экономии ресурсов

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (badgeCheckInterval) {
      clearInterval(badgeCheckInterval);

      badgeCheckInterval = null;
    }
  } else {
    startBadgeAutoCheck();
  }
});

function showLevelUpBanner(lvl) {
  const el = document.createElement('div');

  el.className = 'level-up-banner';

  el.innerHTML =
    '<span class="material-symbols-outlined" style="vertical-align: middle; margin-right: 8px;">celebration</span>Уровень ' +
    esc(lvl.toString()) +
    '!<br><span style="font-size:.85rem;font-weight:600;opacity:.9">Так держать!</span>';

  document.body.appendChild(el);

  setTimeout(() => {
    el.style.transition = 'transform .4s ease, opacity .4s ease';

    el.style.transform = 'translate(-50%,-50%) scale(0)';

    el.style.opacity = '0';

    setTimeout(() => el.remove(), 400);
  }, 2200);
}

function renderXP() {
  const needed = xpNeeded(xpData.level);

  const pct = Math.min(100, Math.round((xpData.xp / needed) * 100));

  const fill = document.getElementById('xp-bar'); // id="xp-bar" в HTML

  if (fill) fill.style.width = pct + '%';

  const stXP = document.getElementById('st-xp');

  const stLvlNum = document.getElementById('st-level-num');

  if (stXP) stXP.textContent = xpData.xp + ' / ' + needed + ' XP';

  if (stLvlNum) stLvlNum.textContent = xpData.level;
}

function getBadgeProgress(def) {
  if (xpData.badges.includes(def.id)) return null; // Уже получен

  const currentXP = xpData.xp + (xpData.level - 1) * XP_PER_LEVEL;

  const stats = {
    total: window.words.length,

    learned: window.words.filter(w => w.stats?.learned).length,
  };

  const currentWords = stats.total;

  const currentLearned = stats.learned;

  const currentStreak = streak.count;

  // Прогресс по количеству слов

  if (def.id.startsWith('words_')) {
    const target = parseInt(def.id.split('_')[1]);

    const remaining = Math.max(0, target - currentWords);

    return {
      type: 'words',

      current: currentWords,

      target: target,

      remaining: remaining,

      progress: Math.min(100, (currentWords / target) * 100),
    };
  }

  // Прогресс по выученным словам

  if (def.id.startsWith('learned_')) {
    const target = parseInt(def.id.split('_')[1]);

    const remaining = Math.max(0, target - currentLearned);

    return {
      type: 'learned',

      current: currentLearned,

      target: target,

      remaining: remaining,

      progress: Math.min(100, (currentLearned / target) * 100),
    };
  }

  // Прогресс по стрику

  if (def.id.startsWith('streak_')) {
    // Соответствие ID → целевое значение
    const streakTargets = {
      streak_beginner: 3,
      streak_regular: 7,
      streak_dedicated: 30,
      streak_master: 100,
      streak_legendary: 365,
    };
    const target = streakTargets[def.id] || 0;
    const remaining = Math.max(0, target - currentStreak);
    return {
      type: 'streak',
      current: currentStreak,
      target: target,
      remaining: remaining,
      progress: Math.min(100, (currentStreak / target) * 100),
    };
  }

  // Прогресс по XP

  if (def.id.startsWith('xp_')) {
    const target = parseInt(def.id.split('_')[1]);

    const remaining = Math.max(0, target - currentXP);

    return {
      type: 'xp',

      current: currentXP,

      target: target,

      remaining: remaining,

      progress: Math.min(100, (currentXP / target) * 100),
    };
  }

  // ── ИДИОМЫ ─────────────────────────────────────
  if (def.id.startsWith('idioms')) {
    const target = parseInt(def.id.replace('idioms', ''));
    const current = window.idioms.length;
    return {
      type: 'idioms',
      current,
      target,
      remaining: Math.max(0, target - current),
      progress: Math.min(100, (current / target) * 100),
    };
  }
  if (def.id.startsWith('idiomlearned')) {
    const target = parseInt(def.id.replace('idiomlearned', ''));
    const current = window.idioms.filter(i => i.stats?.learned).length;
    return {
      type: 'idiomlearned',
      current,
      target,
      remaining: Math.max(0, target - current),
      progress: Math.min(100, (current / target) * 100),
    };
  }

  return null;
}

function renderBadges() {
  const grid = document.getElementById('badges-grid');

  if (!grid) return;

  grid.innerHTML = BADGES_DEF.map(def => {
    const ok = xpData.badges.includes(def.id);

    const progress = ok ? null : getBadgeProgress(def);

    return (
      '<div class="badge-card ' +
      (ok ? 'unlocked' : 'locked') +
      '">' +
      '<div class="badge-icon">' +
      (def.icon.includes('⭐')
        ? def.icon
        : `<span class="material-symbols-outlined">${def.icon}</span>`) +
      '</div>' +
      '<div class="badge-name">' +
      def.name +
      '</div>' +
      '<div class="badge-desc">' +
      def.description +
      '</div>' +
      (progress
        ? `







        <div class="badge-progress">







          <div class="badge-progress-bar">







            <div class="badge-progress-fill" style="width: ${progress.progress}%"></div>







          </div>







          <div class="badge-progress-text">







            ${progress.remaining > 0 ? `Осталось: ${getProgressText(progress)}` : 'Почти готово!'}







          </div>







        </div>







      `
        : '') +
      '</div>'
    );
  }).join('');
}

function getProgressText(progress) {
  switch (progress.type) {
    case 'words':
      return `${progress.remaining} ${getWordForm(progress.remaining, 'слово', 'слова', 'слов')}`;

    case 'learned':
      return `${progress.remaining} ${getWordForm(progress.remaining, 'слово', 'слова', 'слов')} выучить`;

    case 'streak':
      return `${progress.remaining} ${getWordForm(progress.remaining, 'день', 'дня', 'дней')}`;

    case 'xp':
      return `${progress.remaining} XP`;

    case 'idioms':
      return `ещё ${progress.remaining} идиом`;

    case 'idiomlearned':
      return `ещё ${progress.remaining} выучить`;

    default:
      return `${progress.remaining}`;
  }
}

function getWordForm(n, one, few, many) {
  if (n % 10 === 1 && n % 100 !== 11) return one;

  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return few;

  return many;
}

function updStreak() {
  console.log('🔥 updStreak вызван, текущий streak:', streak);

  const today = new Date().toISOString().split('T')[0]; // "2026-03-05"

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  if (streak.lastDate === today) {
    console.log('🔥 Сегодня streak уже обновлен');

    return;
  }

  if (streak.lastDate === yesterday) streak.count++;
  else streak.count = 1;

  streak.lastDate = today;

  console.log('🔥 Новый streak:', streak);

  scheduleProfileSave(); // ← сохраняем с задержкой

  renderBadges();
  checkBadges(); // ← добавляем проверку бейджей
  console.log('✅ updStreak завершен');
}

// ============================================================

// SPEECH ENGINE

// ============================================================

// Оптимизированный AudioContext для звуков

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  return audioContext;
}

// ============================================================

// TOAST

// ============================================================

function showLimitModal(limit) {
  const now = new Date();

  const midnight = new Date(now);

  midnight.setHours(24, 0, 0, 0);

  const diff = midnight - now;

  const hours = Math.floor(diff / (1000 * 60 * 60));

  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  const timeUntilReset = `${hours} ч ${minutes} мин`;

  const modal = document.createElement('div');

  modal.className = 'modal-overlay';

  modal.style.cssText = `



    position: fixed;



    top: 0;



    left: 0;



    width: 100%;



    height: 100%;



    background: rgba(0, 0, 0, 0.7);



    display: flex;



    align-items: center;



    justify-content: center;



    z-index: 10000;



    animation: fadeIn 0.3s ease;



  `;

  modal.innerHTML = `



    <div style="



      background: var(--bg-primary);



      border-radius: 16px;



      padding: 32px;



      max-width: 400px;



      text-align: center;



      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);



      animation: slideUp 0.3s ease;



    ">



      <div style="



        width: 64px;



        height: 64px;



        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);



        border-radius: 50%;



        display: flex;



        align-items: center;



        justify-content: center;



        margin: 0 auto 20px;



      ">



        <span class="material-symbols-outlined" style="color: white; font-size: 32px;">timer_off</span>



      </div>



      



      <h2 style="margin: 0 0 16px 0; color: var(--text-primary); font-size: 24px;">



        Дневной лимит достигнут! ⭐



      </h2>



      



      <p style="margin: 0 0 24px 0; color: var(--text-secondary); line-height: 1.6;">



        Ты отлично поработал сегодня! <br>



        Выполнил все <strong>${limit}</strong> упражнений. <br><br>



        Отдохни, закрепи материал и возвращайся завтра для новых достижений! 💪

        

        <p style="margin-top: 8px; font-size: 0.9rem;">Лимит сбросится через ${timeUntilReset}</p>



      </p>



      



      <button onclick="this.closest('.modal-overlay').remove(); document.getElementById('practice-setup').style.display='block';" style="



        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);



        color: white;



        border: none;



        border-radius: 12px;



        padding: 14px 28px;



        font-size: 16px;



        font-weight: 600;



        cursor: pointer;



        transition: transform 0.2s ease, box-shadow 0.2s ease;



      " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 20px rgba(102, 126, 234, 0.4)'" 



         onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">



        Понятно, отдохну! 😌



      </button>



      



      <div style="margin-top: 16px; font-size: 14px; color: var(--text-muted);">



        Совет: можешь изменить лимит в настройках если хочешь заниматься больше



      </div>



    </div>



  `;

  // Добавляем стили анимации если их нет

  if (!document.querySelector('#limit-modal-styles')) {
    const style = document.createElement('style');

    style.id = 'limit-modal-styles';

    style.textContent = `



      @keyframes fadeIn {



        from { opacity: 0; }



        to { opacity: 1; }



      }



      @keyframes slideUp {



        from { 



          opacity: 0;



          transform: translateY(20px);



        }



        to { 



          opacity: 1;



          transform: translateY(0);



        }



      }



    `;

    document.head.appendChild(style);
  }

  document.body.appendChild(modal);
  document.body.classList.add('modal-open'); // Блокируем скролл

  // Автоматически закрываем через 10 секунд и возвращаем к практике

  setTimeout(() => {
    if (modal.parentNode) {
      modal.remove();
      document.body.classList.remove('modal-open'); // Возвращаем скролл
      document.getElementById('practice-setup').style.display = 'block';
    }
  }, 10000);
}

function toast(msg, type = '', icon = '') {
  console.log('Toast вызван:', msg, type, icon);
  const el = document.createElement('div');

  el.className = 'toast' + (type ? ' ' + type : '');

  if (icon) {
    el.innerHTML = `<span class="material-symbols-outlined" style="font-size: 1.2em; vertical-align: middle; margin-right: 8px;">${icon}</span>${msg}`;
  } else {
    el.textContent = msg;
  }

  const toastBox = document.getElementById('toast-box');
  if (!toastBox) {
    console.error('Toast box не найден!');
    return;
  }

  toastBox.appendChild(el);
  console.log('Toast добавлен в DOM');

  // Увеличиваем время для важных сообщений

  const isImportant =
    msg.includes('лимит') || msg.includes('Лимит') || type === 'danger';

  const duration = isImportant ? 6000 : 4000; // 6 секунд для лимитов, 4 для обычных

  setTimeout(() => {
    el.style.opacity = '0';

    el.style.transition = 'opacity .3s';

    setTimeout(() => el.remove(), 320);
  }, duration);
}

// Делаем toast доступной глобально
window.toast = toast;

// ============================================================

// TABS

// ============================================================

// Update due badge function

function updateDueBadge() {
  const now = new Date();

  // Считаем due слова
  const wordsDue = window.words.filter(
    w => new Date(w.stats?.nextReview) <= now,
  ).length;

  // Считаем due идиомы
  const idiomsDue = window.idioms.filter(
    i => new Date(i.stats?.nextReview || 0) <= now,
  ).length;

  const totalDue = wordsDue + idiomsDue;

  // Бейдж над "Практикой" в навигации — просто точка
  const desktopBadge = document.getElementById('due-count');
  const mobileBadge = document.getElementById('mobile-due-count');
  const displayDue = totalDue.toString();
  if (desktopBadge) {
    desktopBadge.textContent = displayDue;
    desktopBadge.style.display = totalDue > 0 ? 'flex' : 'none';
  }
  if (mobileBadge) {
    mobileBadge.textContent = displayDue;
    mobileBadge.style.display = totalDue > 0 ? 'flex' : 'none';
  }

  // Счётчики на чипах внутри Практики
  const wordsChipBadge = document.getElementById('practice-words-due');
  const idiomsChipBadge = document.getElementById('practice-idioms-due');

  if (wordsChipBadge) {
    wordsChipBadge.textContent = wordsDue > 0 ? wordsDue : '';
    wordsChipBadge.style.display = wordsDue > 0 ? 'inline-flex' : 'none';
  }
  if (idiomsChipBadge) {
    idiomsChipBadge.textContent = idiomsDue > 0 ? idiomsDue : '';
    idiomsChipBadge.style.display = idiomsDue > 0 ? 'inline-flex' : 'none';
  }

  // Обновляем due-pill в фильтрах практики в зависимости от режима
  const duePill = document.getElementById('due-pill');
  if (duePill) {
    const currentMode =
      document.querySelector('#practice-mode .chip.on')?.dataset.mode ||
      'normal';
    const pillCount = currentMode === 'idioms' ? idiomsDue : wordsDue;
    duePill.textContent = pillCount;
    duePill.style.display = pillCount > 0 ? 'inline' : 'none';
  }
}

// NEW renderStats function with idioms support
function renderStats() {
  const now = new Date();
  const weekAgo = new Date(Date.now() - 7 * 86400000);

  // ── СЛОВА ──────────────────────────────────────
  let wordsDue = 0,
    wordsLearned = 0,
    wordsThisWeek = 0;
  const wordsWithStats = [];
  for (const w of window.words) {
    if (new Date(w.stats.nextReview) <= now) wordsDue++;
    if (w.stats.learned) wordsLearned++;
    if (new Date(w.created_at || w.createdAt) >= weekAgo) wordsThisWeek++;
    if (w.stats?.shown > 0) wordsWithStats.push(w);
  }
  const wordsTotal = window.words.length;
  const wordsPct = wordsTotal
    ? Math.round((wordsLearned / wordsTotal) * 100)
    : 0;

  // ── ИДИОМЫ ─────────────────────────────────────
  let idiomsDue = 0,
    idiomsLearned = 0,
    idiomsThisWeek = 0;
  const idiomsWithStats = [];
  for (const i of window.idioms) {
    if (new Date(i.stats?.nextReview || 0) <= now) idiomsDue++;
    if (i.stats?.learned) idiomsLearned++;
    if (new Date(i.created_at || i.createdAt) >= weekAgo) idiomsThisWeek++;
    if (i.stats?.shown > 0) idiomsWithStats.push(i);
  }
  const idiomsTotal = window.idioms.length;
  const idiomsPct = idiomsTotal
    ? Math.round((idiomsLearned / idiomsTotal) * 100)
    : 0;

  // ── ОБЩЕЕ ──────────────────────────────────────
  const totalAll = wordsTotal + idiomsTotal;
  const totalLearned = wordsLearned + idiomsLearned;
  const totalDue = wordsDue + idiomsDue;
  const totalPct = totalAll ? Math.round((totalLearned / totalAll) * 100) : 0;
  const thisWeek = wordsThisWeek + idiomsThisWeek;

  // ── Совместимость со старыми ID ─────────────────
  document.getElementById('st-due')?.textContent !== undefined &&
    (document.getElementById('st-due').textContent = totalDue);
  document.getElementById('st-total') &&
    (document.getElementById('st-total').textContent = wordsTotal);
  document.getElementById('st-learned') &&
    (document.getElementById('st-learned').textContent = wordsLearned);
  if (document.getElementById('st-learned-bar'))
    document.getElementById('st-learned-bar').style.width = wordsPct + '%';
  if (document.getElementById('st-streak'))
    document.getElementById('st-streak').textContent = streak.count;
  if (document.getElementById('st-week'))
    document.getElementById('st-week').textContent = thisWeek;

  // ── due-pill ────────────────────────────────────
  const pillEl = document.getElementById('due-pill');
  const currentMode =
    document.querySelector('.practice-mode .chip.on')?.dataset.mode || 'normal';
  if (pillEl) {
    const pillCount = currentMode === 'idioms' ? idiomsDue : wordsDue;
    pillEl.textContent = pillCount;
    pillEl.style.display = pillCount > 0 ? 'inline' : 'none';
  }

  // ── ПРОГРЕСС КАРТОЧКИ ───────────────────────────
  const pc = document.getElementById('st-progress-cards');
  if (pc) {
    const dueBadgeW =
      wordsDue > 0
        ? `<span class="stat-due-chip"><span class="material-symbols-outlined">schedule</span> ${wordsDue}</span>`
        : '';
    const dueBadgeI =
      idiomsDue > 0
        ? `<span class="stat-due-chip"><span class="material-symbols-outlined">schedule</span> ${idiomsDue}</span>`
        : '';

    pc.innerHTML = `
      <div class="spc-card">
        <div class="spc-header">
          <span class="material-symbols-outlined spc-icon words-icon">menu_book</span>
          <span class="spc-title">Слова</span>
          <span class="spc-pct">${wordsPct}%</span>
        </div>
        <div class="spc-bar-wrap">
          <div class="spc-bar-fill words" style="width:${wordsPct}%"></div>
        </div>
        <div class="spc-nums">
          <span><span class="material-symbols-outlined stat-icon-small">check_circle</span> ${wordsLearned} выучено</span>
          <span><span class="material-symbols-outlined stat-icon-small">menu_book</span> ${wordsTotal} всего</span>
          ${dueBadgeW}
        </div>
      </div>

      <div class="spc-card">
        <div class="spc-header">
          <span class="material-symbols-outlined spc-icon idioms-icon">theater_comedy</span>
          <span class="spc-title">Идиомы</span>
          <span class="spc-pct">${idiomsPct}%</span>
        </div>
        <div class="spc-bar-wrap">
          <div class="spc-bar-fill idioms" style="width:${idiomsPct}%"></div>
        </div>
        <div class="spc-nums">
          <span><span class="material-symbols-outlined stat-icon-small">check_circle</span> ${idiomsLearned} выучено</span>
          <span><span class="material-symbols-outlined stat-icon-small">theater_comedy</span> ${idiomsTotal} всего</span>
          ${dueBadgeI}
        </div>
      </div>

      <div class="spc-card spc-total">
        <div class="spc-header">
          <span class="material-symbols-outlined spc-icon total-icon">auto_awesome</span>
          <span class="spc-title">Общий прогресс</span>
          <span class="spc-pct total-pct">${totalPct}%</span>
        </div>
        <div class="spc-bar-wrap combined">
          <div class="spc-bar-fill words" style="width:${totalAll ? (wordsLearned / totalAll) * 100 : 0}%"></div>
          <div class="spc-bar-fill idioms" style="width:${totalAll ? (idiomsLearned / totalAll) * 100 : 0}%; margin-left: 2px"></div>
        </div>
        <div class="spc-legend">
          <span><span class="spc-dot words"></span>Слова</span>
          <span><span class="spc-dot idioms"></span>Идиомы</span>
        </div>
        <div class="spc-nums">
          <span><span class="material-symbols-outlined stat-icon-small">psychology</span> ${totalLearned} из ${totalAll} единиц</span>
        </div>
      </div>
    `;
  }

  // ── HARD / EASY СЛОВА ───────────────────────────
  const makeWordItem = w => {
    return `<li>
      <span class="word-info">
        <strong>${esc(w.en)}</strong>
      </span>
      <button class="btn-audio audio-card-btn" onclick="window.speakWord('${w.id}')" title="Прослушать">
        <span class="material-symbols-outlined">volume_up</span>
      </button>
    </li>`;
  };

  const hardWords = [...wordsWithStats]
    .map(w => ({ ...w, accuracy: w.stats.correct / w.stats.shown }))
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 5);
  const easyWords = [...wordsWithStats]
    .map(w => ({ ...w, accuracy: w.stats.correct / w.stats.shown }))
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, 5);

  const stHardEl = document.getElementById('st-hard');
  if (stHardEl)
    stHardEl.innerHTML = hardWords.length
      ? hardWords.map(makeWordItem).join('')
      : `<li class="stat-empty">Пока нет данных</li>`;

  const stEasyEl = document.getElementById('st-easy');
  if (stEasyEl)
    stEasyEl.innerHTML = easyWords.length
      ? easyWords.map(makeWordItem).join('')
      : `<li class="stat-empty">Пока нет данных</li>`;

  // ── HARD / EASY ИДИОМЫ ──────────────────────────
  const makeIdiomItem = i => {
    return `<li>
      <span class="word-info">
        <strong>${esc(i.idiom.toLowerCase())}</strong>
      </span>
      <button class="btn-audio audio-card-btn" onclick="window.speakIdiom('${i.id}')" title="Прослушать">
        <span class="material-symbols-outlined">volume_up</span>
      </button>
    </li>`;
  };

  const hardIdioms = [...idiomsWithStats]
    .map(i => ({ ...i, accuracy: i.stats.correct / i.stats.shown }))
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 5);
  const easyIdioms = [...idiomsWithStats]
    .map(i => ({ ...i, accuracy: i.stats.correct / i.stats.shown }))
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, 5);

  const stHardIdiomsEl = document.getElementById('st-hard-idioms');
  if (stHardIdiomsEl)
    stHardIdiomsEl.innerHTML = hardIdioms.length
      ? hardIdioms.map(makeIdiomItem).join('')
      : `<li class="stat-empty">Попрактикуйся в идиомах!</li>`;

  const stEasyIdiomsEl = document.getElementById('st-easy-idioms');
  if (stEasyIdiomsEl)
    stEasyIdiomsEl.innerHTML = easyIdioms.length
      ? easyIdioms.map(makeIdiomItem).join('')
      : `<li class="stat-empty">Попрактикуйся в идиомах!</li>`;

  renderDailyGoals();
  recalculateCefrLevels();
  renderCefrLevels();

  // daily cap bar
  const capProgress = document.getElementById('daily-cap-progress');
  if (capProgress) {
    const limit = getReviewLimit();
    const pct = Math.min(
      100,
      Math.round((window.dailyReviewCount / limit) * 100),
    );
    const done = window.dailyReviewCount >= limit;
    capProgress.innerHTML = `
      <div class="daily-cap-info">
        <div class="daily-cap-count">
          <strong>${window.dailyReviewCount}</strong> / ${limit === 9999 ? '∞' : limit}
        </div>
        <div class="daily-cap-status">${done ? '✅ выполнено' : Math.round(pct) + '%'}</div>
      </div>
      <div class="daily-cap-bar">
        <div class="daily-cap-fill ${done ? 'completed' : ''}" style="width:${pct}%"></div>
      </div>`;
  }
  const reviewedCountEl = document.getElementById('today-reviewed-count');
  if (reviewedCountEl) reviewedCountEl.textContent = window.dailyReviewCount;
}

// Render daily goals separately

function renderDailyGoals() {
  const container = document.getElementById('daily-goals-list');

  if (!container) return;

  // Debug: Log current daily progress values
  console.log('🔍 Рендерим daily_goals с данными:', window.dailyProgress);

  let html = '';

  DAILY_GOALS.forEach(goal => {
    const current = window.dailyProgress[goal.id] || 0;

    const remaining = Math.max(0, goal.target - current);

    const percent = Math.min(100, Math.round((current / goal.target) * 100));

    const done = current >= goal.target;

    html += `







      <div class="goal-item ${done ? 'completed' : 'locked'}">







        <div class="goal-icon">







          <span class="material-symbols-outlined">${goal.icon}</span>







        </div>







        <div class="goal-content">







          <div class="goal-name">${goal.label}</div>







          <div class="goal-desc">Награда: ${goal.xpReward} XP</div>







          <div class="goal-progress">







            <div class="goal-progress-bar">







              <div class="goal-progress-fill" style="width: ${percent}%"></div>







            </div>







          </div>







          ${!done ? `<div class="goal-progress-text">Осталось: ${remaining}</div>` : ''}







        </div>







      </div>







    `;
  });

  container.innerHTML = html;
}

// Render CEFR levels separately

function renderCefrLevels() {
  const container = document.getElementById('cefr-grid');

  if (!container) return;

  let html = '';

  Object.keys(window.cefrLevels).forEach(level => {
    const count = window.cefrLevels[level] || 0;

    html += `







      <div class="cefr-level">







        <div class="cefr-label">${level}</div>







        <div class="cefr-count">${count}</div>







        <small>слов</small>







      </div>







    `;
  });

  container.innerHTML = html;
}

// Recalculate CEFR levels from words

function recalculateCefrLevels() {
  const levels = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 };

  window.words.forEach(w => {
    if (w.tags) {
      w.tags.forEach(tag => {
        if (levels.hasOwnProperty(tag)) levels[tag]++;
      });
    }
  });

  window.cefrLevels = levels;
}

// Confetti animation for completed daily goals

function spawnConfetti() {
  const colors = ['#2563eb', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];

  const confettiCount = 50;

  for (let i = 0; i < confettiCount; i++) {
    setTimeout(() => {
      const confetti = document.createElement('div');

      confetti.style.cssText = `







        position: fixed;







        top: 50%;







        left: 50%;







        width: 10px;







        height: 10px;







        background: ${colors[Math.floor(Math.random() * colors.length)]};







        border-radius: 50%;







        pointer-events: none;







        z-index: 9999;







        animation: confetti-fall ${2 + Math.random() * 2}s ease-out forwards;







        transform: translate(-50%, -50%);







      `;

      document.body.appendChild(confetti);

      setTimeout(() => confetti.remove(), 4000);
    }, i * 30);
  }
}

// Add confetti animation styles

if (!document.getElementById('confetti-styles')) {
  const confettiStyles = document.createElement('style');

  confettiStyles.id = 'confetti-styles';

  confettiStyles.textContent = `







  @keyframes confetti-fall {







    0% {







      transform: translate(-50%, -50%) translateY(0) rotate(0deg);







      opacity: 1;







    }







    100% {







      transform: translate(-50%, -50%) translateY(300px) rotate(720deg);







      opacity: 0;







    }







  }







`;

  document.head.appendChild(confettiStyles);
}

function switchTab(name) {
  const currentActivePane = document.querySelector('.tab-pane.active');
  const currentActiveTab = currentActivePane
    ? currentActivePane.id.replace('tab-', '')
    : null;

  if (name === 'words') {
    visibleLimit = 30; // <-- сброс при переключении на слова

    renderRandomBankWord(); // Вызываем без await, т.к. в синхронной функции

    refreshUI();
  }

  if (name === 'practice') {
    refreshUI();
  }

  document

    .querySelectorAll('.nav-btn')

    .forEach(b => b.classList.toggle('active', b.dataset.tab === name));

  document

    .querySelectorAll('.tab-pane')

    .forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));

  if (name === 'stats') {
    refreshUI();

    setTimeout(() => renderWeekChart(), 100); // оставляем для графика
  }

  if (name === 'idioms') {
    idiomsVisibleLimit = 30;
    renderIdioms();
    renderRandomBankIdiom(); // показываем случайную идиому из банка
  }

  if (name === 'friends') {
    loadFriendsDataNew();
  }

  // Управление видимостью плавающих кнопок при переключении вкладок
  updateFloatingButtonsForTab(name);

  if (name === 'words') refreshUI(); // уже обновлено выше, но оставим для надежности

  // Скроллим наверх при переключении вкладок (особенно для мобильных)

  if (window.innerWidth <= 768) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// Экспортируем функции глобально

window.switchTab = switchTab;

window.renderWeekChart = renderWeekChart;

document

  .querySelectorAll('.nav-btn[data-tab]')

  .forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));

// Обработчики для мобильного меню

document

  .querySelectorAll('.mobile-nav-btn[data-tab]')

  .forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));

// Синхронизация активных состояний между десктопным и мобильным меню

function syncMobileNav(activeTab) {
  // Убираем active у всех десктопных кнопок

  document.querySelectorAll('.nav-btn[data-tab]').forEach(btn => {
    btn.classList.remove('active');
  });

  // Добавляем active к нужной десктопной кнопке

  const desktopBtn = document.querySelector(
    `.nav-btn[data-tab="${activeTab}"]`,
  );

  if (desktopBtn) {
    desktopBtn.classList.add('active');
  }

  // Убираем active у всех мобильных кнопок

  document.querySelectorAll('.mobile-nav-btn[data-tab]').forEach(btn => {
    btn.classList.remove('active');
  });

  // Добавляем active к нужной мобильной кнопке

  const mobileBtn = document.querySelector(
    `.mobile-nav-btn[data-tab="${activeTab}"]`,
  );

  if (mobileBtn) {
    mobileBtn.classList.add('active');
  }
}

// Обновляем switchTab для синхронизации меню

const originalSwitchTab = switchTab;

switchTab = function (name) {
  originalSwitchTab(name);

  syncMobileNav(name);
};

// Синхронизация бейджей между десктопной и мобильной версиями

function syncBadges() {
  // Синхронизация счетчика повторений
  const dueCount = document.getElementById('due-count');
  const mobileDueCount = document.getElementById('mobile-due-count');

  if (dueCount && mobileDueCount) {
    mobileDueCount.textContent = dueCount.textContent;
  }
}

// Добавляем вызов syncBadges в существующую функцию updateDueBadge

const originalUpdateDueBadge = updateDueBadge;

updateDueBadge = function () {
  originalUpdateDueBadge();

  syncBadges();
};

// ============================================================
// THEME MANAGEMENT

// ============================================================

// New theme toggle checkbox handler

const themeCheckbox = document.getElementById('theme-checkbox');

if (themeCheckbox) {
  themeCheckbox.addEventListener('change', async e => {
    const on = e.target.checked;
    const baseTheme = window.user_settings?.baseTheme || 'lavender';
    console.log('🎨 Theme checkbox changed:', { on, baseTheme });
    window.applyTheme(baseTheme, on);

    // после изменения чекбокса
    window.user_settings.dark =
      document.documentElement.classList.contains('dark');
    if (window.currentUserId) scheduleProfileSave();
  });
}

// Убираем немедленное применение темы из localStorage

// Теперь тема применяется только из профиля после загрузки

// ============================================================

// RENDER WORDS

// ============================================================

// Функции для работы со словами и идиомами

function updateSyncIndicator(status, message = '') {
  // Индикатор синхронизации отключен

  return;
}

// Принудительная синхронизация

// Объединение слов с обнаружением конфликтов

window.mergeWords = function (localWords, remoteWords) {
  // Создаём карту серверных слов

  const remoteMap = new Map(remoteWords.map(w => [w.id, w]));

  // Результат – все серверные слова

  const merged = [...remoteWords];

  // Добавляем локальные слова, которых нет на сервере и которые не в очереди на удаление

  for (const localWord of localWords) {
    if (!remoteMap.has(localWord.id) && !pendingWordUpdates.has(localWord.id)) {
      merged.push(localWord);
    }
  }

  return merged;
};

// Показ уведомления о конфликтах

function showConflictNotification(conflicts) {
  const message = `Обнаружено ${conflicts.length} конфликт(ов) при синхронизации. Использована версия из облака.`;

  toast('' + message, 'warning', 'warning', 5000);

  // Логируем конфликты для отладки

  console.log('Sync conflicts:', conflicts);
}

// Отслеживание состояния сети

async function syncAfterReconnect() {
  if (!navigator.onLine || !window.currentUserId) return;

  try {
    await window.authExports.loadWordsOnce(remoteWords => {
      const localWords = window.words || [];

      const merged = window.mergeWords
        ? window.mergeWords(localWords, remoteWords)
        : remoteWords;

      window.words = merged;

      localStorage.setItem('englift_words', JSON.stringify(window.words));

      refreshUI();
    });
  } catch (e) {
    console.warn('Ошибка автосинхронизации:', e);
  }
}

function setupNetworkMonitoring() {
  const updateNetworkStatus = () => {
    if (navigator.onLine) {
      // updateSyncIndicator('synced', 'Онлайн');

      // Запускаем автосинхронизацию при возвращении сети

      syncAfterReconnect();

      // Если есть несохранённые изменения, запускаем forceSync

      if (window.hasLocalChanges) {
        // forceSync();

        window.hasLocalChanges = false;
      }
    } else {
      // updateSyncIndicator('offline', 'Офлайн');

      toast(
        '📵 Соединение потеряно. Изменения сохранятся локально.',

        'warning',
      );
    }
  };

  window.addEventListener('online', updateNetworkStatus);

  window.addEventListener('offline', updateNetworkStatus);

  // Начальный статус

  // updateNetworkStatus();
}

function renderWords() {
  const grid = document.getElementById('words-grid');

  const empty = document.getElementById('empty-words');

  const trigger = document.getElementById('load-more-trigger');

  const loadingMore = document.getElementById('loading-more');

  // Отключаем старый наблюдатель (на всякий случай)

  if (intersectionObserver) {
    intersectionObserver.disconnect();

    intersectionObserver = null;
  }

  requestAnimationFrame(() => {
    let list = window.words;

    // Фильтры

    if (activeFilter === 'learning') list = list.filter(w => !w.stats.learned);

    if (activeFilter === 'learned') list = list.filter(w => w.stats.learned);

    if (searchQ) {
      const q = searchQ.toLowerCase();

      list = list.filter(
        w =>
          w.en.toLowerCase().includes(q) ||
          w.ru.toLowerCase().includes(q) ||
          w.tags.some(t => t.toLowerCase().includes(q)),
      );
    }

    if (tagFilter)
      list = list.filter(w =>
        w.tags.map(t => t.toLowerCase()).includes(tagFilter),
      );

    list = sortWords(list, sortBy);

    updateDueBadge();

    const subtitleEl = document.getElementById('words-subtitle');
    if (subtitleEl) {
      subtitleEl.textContent =
        list.length !== window.words.length
          ? `(${list.length} из ${window.words.length})`
          : `— ${window.words.length} слов`;
    }

    if (!list.length) {
      grid.innerHTML = '';

      empty.style.display = 'block';

      if (trigger) trigger.style.display = 'none';

      if (loadingMore) loadingMore.style.display = 'none';

      return;
    }

    empty.style.display = 'none';

    const visibleList = list.slice(0, visibleLimit);

    const fragment = document.createDocumentFragment();

    visibleList.forEach(w => {
      const card = getCachedCard(w);

      fragment.appendChild(card);
    });

    grid.innerHTML = '';

    grid.appendChild(fragment);

    updateTagFilterIndicator();

    if (list.length > visibleLimit) {
      if (trigger) trigger.style.display = 'block';

      if (loadingMore) loadingMore.style.display = 'none'; // скрываем индикатор загрузки

      setupLoadMoreObserver(list.length);
    } else {
      if (trigger) trigger.style.display = 'none';

      if (loadingMore) loadingMore.style.display = 'none';
    }
  });
}

// Инкрементальное добавление слова в DOM без полного рендера

function addWordToDOM(word) {
  const grid = document.getElementById('words-grid');

  const empty = document.getElementById('empty-words');

  // Если сетка пуста, скрываем сообщение о пустоте

  if (empty && empty.style.display !== 'none') {
    empty.style.display = 'none';
  }

  // Создаем карточку и добавляем в начало

  const card = getCachedCard(word);

  grid.prepend(card);

  // Обновляем счетчики

  updateWordsCount();
}

function updateWordsCount() {
  const el = document.getElementById('words-count');
  if (el) el.textContent = window.words.length;

  updateDueBadge();

  // Обновляем subtitle

  let list = window.words;

  if (activeFilter === 'learning') list = list.filter(w => !w.stats.learned);

  if (activeFilter === 'learned') list = list.filter(w => w.stats.learned);

  if (searchQ) {
    const q = searchQ.toLowerCase();

    list = list.filter(
      w =>
        w.en.toLowerCase().includes(q) ||
        w.ru.toLowerCase().includes(q) ||
        w.tags.some(t => t.toLowerCase().includes(q)),
    );
  }

  if (tagFilter)
    list = list.filter(w =>
      w.tags.map(t => t.toLowerCase()).includes(tagFilter),
    );

  const subtitleEl = document.getElementById('words-subtitle');
  if (subtitleEl) {
    subtitleEl.textContent =
      list.length !== window.words.length
        ? `(${list.length} из ${window.words.length})`
        : `— ${window.words.length} слов`;
  }
}

function setupLoadMoreObserver(totalCount) {
  const trigger = document.getElementById('load-more-trigger');

  if (!trigger) return;

  // Если наблюдатель уже есть – отключаем и создаём новый (чтобы не дублировать)

  if (intersectionObserver) {
    intersectionObserver.disconnect();
  }

  intersectionObserver = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        // Если триггер виден и мы не грузим прямо сейчас

        if (entry.isIntersecting && !isLoadingMore) {
          isLoadingMore = true;

          // Показываем индикатор загрузки

          const loadingMore = document.getElementById('loading-more');

          if (loadingMore) loadingMore.style.display = 'block';

          // Подгружаем следующую порцию

          visibleLimit += PAGE_SIZE;

          renderWords(); // перерендерим с новым лимитом

          // сброс после рендера с увеличенной задержкой

          setTimeout(() => {
            isLoadingMore = false;
          }, 500);
        }
      });
    },

    {
      root: null, // относительно окна

      threshold: 0.1, // срабатывает, когда 10% триггера видно

      rootMargin: '50px', // подгружаем чуть заранее, чтобы не было видно пустоты
    },
  );

  intersectionObserver.observe(trigger);
}

function sortWords(list, sortBy) {
  const sortedList = [...list];

  switch (sortBy) {
    case 'date-asc':
      return sortedList.sort((a, b) =>
        (a.added || a.createdAt || 0)

          .toString()

          .localeCompare((b.added || b.createdAt || 0).toString()),
      );

    case 'date-desc':
      return sortedList.sort((a, b) =>
        (b.added || b.createdAt || 0)

          .toString()

          .localeCompare((a.added || a.createdAt || 0).toString()),
      );

    case 'alpha-asc':
      return sortedList.sort((a, b) => a.en.localeCompare(b.en));

    case 'alpha-desc':
      return sortedList.sort((a, b) => b.en.localeCompare(a.en));

    case 'progress-asc':
      return sortedList.sort(
        (a, b) =>
          (a.stats.shown ? a.stats.correct / a.stats.shown : 1) -
          (b.stats.shown ? b.stats.correct / b.stats.shown : 1),
      );

    case 'progress-desc':
      return sortedList.sort(
        (a, b) =>
          (b.stats.shown ? b.stats.correct / b.stats.shown : 1) -
          (a.stats.shown ? a.stats.correct / a.stats.shown : 1),
      );

    default:
      return sortedList;
  }
}

function sortIdioms(list, sortBy) {
  const sortedList = [...list];

  switch (sortBy) {
    case 'date-asc':
      return sortedList.sort((a, b) =>
        (a.createdAt || 0)
          .toString()
          .localeCompare((b.createdAt || 0).toString()),
      );

    case 'date-desc':
      return sortedList.sort((a, b) =>
        (b.createdAt || 0)
          .toString()
          .localeCompare((a.createdAt || 0).toString()),
      );

    case 'alpha-asc':
      return sortedList.sort((a, b) => a.idiom.localeCompare(b.idiom));

    case 'alpha-desc':
      return sortedList.sort((a, b) => b.idiom.localeCompare(a.idiom));

    case 'progress-asc':
      return sortedList.sort(
        (a, b) =>
          (a.stats.shown ? a.stats.correct / a.stats.shown : 1) -
          (b.stats.shown ? b.stats.correct / b.stats.shown : 1),
      );

    case 'progress-desc':
      return sortedList.sort(
        (a, b) =>
          (b.stats.shown ? b.stats.correct / b.stats.shown : 1) -
          (a.stats.shown ? a.stats.correct / a.stats.shown : 1),
      );

    default:
      return sortedList;
  }
}

function getCachedCard(word) {
  // НЕ используем кеш для карточек с обработчиками событий - они теряются при cloneNode

  // Всегда создаем новую карточку чтобы сохранить обработчики клика

  const card = makeCard(word);

  return card;
}

function updateTagFilterIndicator() {
  let tagInd = document.getElementById('tag-filter-indicator');

  if (tagFilter) {
    if (!tagInd) {
      tagInd = document.createElement('div');

      tagInd.id = 'tag-filter-indicator';

      const grid = document.getElementById('words-grid');

      grid.parentNode.insertBefore(tagInd, grid);
    }

    tagInd.innerHTML = `<span class="tag-filter-indicator">🏷 ${esc(tagFilter)} &nbsp;✕ очистить</span>`;

    tagInd.querySelector('.tag-filter-indicator').onclick = () => {
      tagFilter = '';

      renderWords();
    };
  } else {
    if (tagInd) tagInd.remove();
  }
}

// Оптимизированный поиск с debounce

function optimizedSearch(query) {
  clearTimeout(searchDebounceTimer);

  searchDebounceTimer = setTimeout(() => {
    searchQ = query;

    renderWords();
  }, 300);
}

function makeCard(w) {
  const card = document.createElement('div');
  card.className = 'word-card';
  card.dataset.id = w.id;

  // Сохраняем все данные в data-атрибутах для раскрытия
  card.dataset.en = w.en;
  card.dataset.ru = w.ru;
  card.dataset.examples = JSON.stringify(w.examples || []);
  card.dataset.tags = JSON.stringify(w.tags || []);
  card.dataset.learned = w.stats.learned;

  // Базовая разметка (свёрнутое состояние)
  // Генерируем индикаторы прогресса
  const progressLevel = w.stats.learned
    ? 3
    : w.stats.correctExerciseTypes?.length || 0;
  const indicators = Array.from({ length: 3 }, (_, i) => {
    const dotClass = i < progressLevel ? 'filled' : '';
    return `<div class="progress-dot ${dotClass}"></div>`;
  }).join('');

  // Tooltip текст
  let tooltipText = 'Не изучено';
  if (w.stats.learned) {
    tooltipText = 'Выучено ✨';
  } else if (progressLevel > 0) {
    tooltipText = `Прогресс: ${progressLevel}/3 упражнения`;
  }

  card.innerHTML = `
    <div class="progress-indicators" data-tooltip="${tooltipText}">${indicators}</div>
    <div class="word-card-header">
      <div class="word-main">
        <h3 class="word-title">${esc(w.en)}</h3>
        ${window.user_settings?.showPhonetic && w.phonetic ? `<div class="word-phonetic">${esc(w.phonetic)}</div>` : ''}
      </div>
      <div class="word-actions">
        <button class="audio-btn" data-word="${w.id}" title="Прослушать">
          <span class="material-symbols-outlined">volume_up</span>
        </button>
      </div>
    </div>
    <div class="word-translation">${parseAnswerVariants(w.ru).join(', ') || esc(w.ru)}</div>
    <div class="word-card-footer">
      <span class="expand-hint">Нажмите, чтобы раскрыть</span>
      <span class="material-symbols-outlined expand-icon">expand_more</span>
    </div>
  `;

  // Обработчик клика для раскрытия
  card.addEventListener('click', e => {
    if (
      e.target.closest('.audio-btn') ||
      e.target.closest('.edit-btn') ||
      e.target.closest('.delete-btn') ||
      e.target.closest('.example-audio-btn')
    ) {
      return;
    }
    card.classList.toggle('expanded');
    const expandHint = card.querySelector('.expand-hint');
    const expandIcon = card.querySelector('.expand-icon');
    if (card.classList.contains('expanded')) {
      expandHint.textContent = 'Нажмите, чтобы свернуть';
      expandIcon.textContent = 'expand_less';
    } else {
      expandHint.textContent = 'Нажмите, чтобы раскрыть';
      expandIcon.textContent = 'expand_more';
    }
    updateExpandedContent(card);
  });

  return card;
}

function updateExpandedContent(card) {
  if (!card.classList.contains('expanded')) {
    const extra = card.querySelector('.word-card-extra');

    if (extra) {
      extra.remove();
    }

    return;
  }

  if (card.querySelector('.word-card-extra')) {
    return;
  }

  // Декодируем HTML-сущности перед парсингом JSON

  function decodeHtmlEntities(str) {
    const div = document.createElement('div');

    div.innerHTML = str;

    return div.textContent || div.innerText || '';
  }

  let examples = [];

  let tags = [];

  try {
    const decodedExamples = decodeHtmlEntities(card.dataset.examples || '[]');

    examples = JSON.parse(decodedExamples);
  } catch (e) {
    console.error('Ошибка парсинга examples для карточки', card.dataset.id, e);

    examples = [];
  }

  try {
    const decodedTags = decodeHtmlEntities(card.dataset.tags || '[]');

    tags = JSON.parse(decodedTags);
  } catch (e) {
    console.error('Ошибка парсинга tags для карточки', card.dataset.id, e);

    tags = [];
  }

  const extraDiv = document.createElement('div');

  extraDiv.className = 'word-card-extra';

  let examplesHtml = '';

  if (examples.length > 0) {
    examplesHtml = `
      <div class="word-examples">
        ${examples
          .map(
            ex => `
          <div class="example-item">
            <div style="display: flex; align-items: center; gap: 8px;">
              <p style="margin: 0; flex: 1;">${esc(ex.text)}</p>
              <button class="example-audio-btn" data-example-index="${examples.indexOf(ex)}" title="Прослушать предложение">
                <span class="material-symbols-outlined" style="font-size: 16px;">volume_up</span>
              </button>
            </div>
            ${ex.translation ? `<span class="example-translation">${esc(ex.translation)}</span>` : ''}
          </div>
        `,
          )
          .join('')}
      </div>
    `;
  }

  let tagsHtml = '';

  if (tags.length > 0) {
    tagsHtml = `
      <div class="word-tags">
        ${tags.map(tag => `<span class="tag" data-tag="${esc(tag)}">${esc(formatTag(tag))}</span>`).join('')}
      </div>
    `;
  }

  extraDiv.innerHTML = `
    ${examplesHtml}
    ${tagsHtml}
    <div class="word-actions-extra">



      <button class="edit-btn" data-id="${card.dataset.id}" title="Редактировать">



        <span class="material-symbols-outlined">edit</span>



      </button>



      <button class="delete-btn" data-id="${card.dataset.id}" title="Удалить">



        <span class="material-symbols-outlined">delete</span>



      </button>



    </div>



  `;

  card.appendChild(extraDiv);
}

// Глобальная функция для получения HTML примера

function getExampleHtmlForCard(card, index) {
  const examples = JSON.parse(card.dataset.examples || '[]');

  if (examples.length === 0) return '';

  const ex = examples[index];

  if (!ex) return '';

  const translation = ex.translation || '';

  const hasMultiple = examples.length > 1;

  return `







      <div class="wc-example">







        <div class="example-text">







          <span class="example-text-content">${esc(ex.text)}</span>







          <button class="example-translate" title="Перевод примера">







            <span class="material-symbols-outlined">info</span>







          </button>







        </div>







        ${
          hasMultiple
            ? `







          <button class="example-prev" title="Предыдущий пример">







            <span class="material-symbols-outlined">chevron_left</span>







          </button>







          <button class="example-next" title="Следующий пример">







            <span class="material-symbols-outlined">chevron_right</span>







          </button>







        `
            : ''
        }







      </div>







    `;
}

// === УЛУЧШЕННЫЙ ТУЛТИП (рекомендую заменить полностью) ===

function showTooltip(text, targetElement) {
  // Проверяем, что элемент всё ещё в DOM

  if (!targetElement || !targetElement.isConnected) return;

  // Удаляем предыдущий тултип

  if (currentTooltip) currentTooltip.remove();

  const displayText = text && text.trim() ? text : 'Перевод не добавлен';

  const tooltip = document.createElement('div');

  tooltip.className = 'custom-tooltip';

  tooltip.textContent = displayText;

  // КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ:

  tooltip.style.position = 'fixed'; // ← fixed, а не absolute

  tooltip.style.zIndex = '9999';

  tooltip.style.visibility = 'hidden';

  tooltip.style.pointerEvents = 'none';

  document.body.appendChild(tooltip); // ← всегда в body

  const rect = targetElement.getBoundingClientRect();

  const tipRect = tooltip.getBoundingClientRect();

  // Центрируем по горизонтали под кнопкой

  let left = rect.left + rect.width / 2 - tipRect.width / 2;

  let top = rect.bottom + 8; // снизу от кнопки

  // Не выходим за пределы экрана

  if (left < 12) left = 12;

  if (left + tipRect.width > window.innerWidth - 12) {
    left = window.innerWidth - tipRect.width - 12;
  }

  // Если снизу мало места — показываем сверху

  if (top + tipRect.height > window.innerHeight - 12) {
    top = rect.top - tipRect.height - 8;
  }

  tooltip.style.top = `${top}px`;

  tooltip.style.left = `${left}px`;

  tooltip.style.visibility = 'visible';

  currentTooltip = tooltip;

  // Авто-скрытие через 3.5 секунды

  const timeoutId = setTimeout(() => {
    if (tooltip.parentNode) tooltip.remove();

    if (currentTooltip === tooltip) currentTooltip = null;
  }, 3500);

  // Сохраняем timeoutId для возможной отмены

  tooltip.dataset.timeoutId = timeoutId;
}

// Скрыть тултип при скролле

function hideTooltipOnScroll() {
  if (currentTooltip) {
    // Отменяем авто-скрытие

    if (currentTooltip.dataset.timeoutId) {
      clearTimeout(parseInt(currentTooltip.dataset.timeoutId));
    }

    currentTooltip.remove();

    currentTooltip = null;
  }
}

// Добавляем слушатель скролла

window.addEventListener('scroll', hideTooltipOnScroll, { passive: true });

// Для мобильных устройств - скрываем при touchmove

window.addEventListener('touchmove', hideTooltipOnScroll, { passive: true });

// Audio buttons on word cards

document.getElementById('words-grid')?.addEventListener('click', e => {
  // Обработка аудио-кнопок (оставляем как есть)

  if (e.target.closest('.audio-btn')) {
    const btn = e.target.closest('.audio-btn');

    const wordId = btn.dataset.word;

    const word = window.words.find(w => w.id === wordId);

    if (!word) return;

    // Удаляем предыдущую волну, если она была
    const existingWave = btn.parentNode.querySelector('.audio-wave');
    if (existingWave) {
      // Возвращаем кнопку, если была волна
      const originalBtn = existingWave._originalBtn;
      if (originalBtn && originalBtn.parentNode) {
        originalBtn.style.display = '';
      }
      existingWave.remove();
    }

    // Создаём волну и заменяем ей кнопку
    const wave = document.createElement('div');
    wave.className = 'audio-wave';
    wave.innerHTML =
      '<span></span><span></span><span></span><span></span><span></span>';

    // Сохраняем ссылку на оригинальную кнопку
    wave._originalBtn = btn;

    // Скрываем кнопку и заменяем на волну
    btn.style.display = 'none';
    btn.parentNode.replaceChild(wave, btn);

    // Проигрываем аудио и возвращаем кнопку после окончания
    window.speakWord(word, () => {
      if (wave.parentNode && wave._originalBtn) {
        wave.parentNode.replaceChild(wave._originalBtn, wave);
        wave._originalBtn.style.display = '';
      }
    });

    return;
  }

  // Обработка аудио-кнопок примеров
  if (e.target.closest('.example-audio-btn')) {
    const btn = e.target.closest('.example-audio-btn');
    const card = btn.closest('.word-card');
    const wordId = card.dataset.id;
    const word = window.words.find(w => w.id === wordId);
    const exampleIndex = parseInt(btn.dataset.exampleIndex) || 0;

    if (word) {
      const examplesAudio =
        word.examples_audio || word.examplesAudio || word.examplesaudio;

      // Если пусто — смотрим в банке
      const audioArr = examplesAudio?.length
        ? examplesAudio
        : window.wordBank?.find(
            b => b.en.toLowerCase() === word.en.toLowerCase(),
          )?.examplesAudio;

      // Текст для озвучки (пример или само слово)
      const fallbackText = word.examples?.[exampleIndex]?.text || word.en;
      console.log('🎤 fallbackText:', fallbackText);

      if (audioArr?.length > exampleIndex) {
        const voicePreference = window.user_settings?.voice || 'female';
        const audioFolder =
          voicePreference === 'male' ? '/audio-male/' : '/audio/';
        const audio = new Audio(`${audioFolder}${audioArr[exampleIndex]}`);
        audio.play().catch(err => {
          console.log('❌ Ошибка аудио, fallback to TTS:', err);
          speakText(fallbackText);
        });
      } else {
        speakText(fallbackText);
      }
    }
    return;
  }

  // Обработка клика по тегу (фильтрация)

  if (e.target.closest('.tag')) {
    const tag = e.target.closest('.tag').dataset.tag.toLowerCase();

    console.log('🏷️ Клик по тегу:', tag);

    tagFilter = tag;

    visibleLimit = 30;

    renderWords();

    return;
  }

  // Обработка кнопок редактирования/удаления (они теперь внутри раскрытой карточки)

  if (e.target.closest('.edit-btn')) {
    const id = e.target.closest('.edit-btn').dataset.id;

    startEditWord(id);

    return;
  }

  if (e.target.closest('.delete-btn')) {
    const id = e.target.closest('.delete-btn').dataset.id;

    pendingDelId = id;
    pendingDeleteType = 'word';

    document.getElementById('del-modal').classList.add('open');
    document.body.classList.add('modal-open'); // Блокируем скролл

    return;
  }

  // Если клик был по самой карточке, но не по интерактивным элементам — ничего не делаем,

  // т.к. раскрытие уже обработано в самой карточке (см. makeCard)
});

function startEditWord(id) {
  const w = window.words.find(x => x.id === id);

  if (!w) return;

  const card = document.querySelector(`.word-card[data-id="${id}"]`);

  card.classList.add('editing');

  card.innerHTML = `



    <div class="form-group"><label>English</label><input type="text" class="e-en form-control" value="${safeAttr(w.en)}"></div>



    <div class="form-group"><label>Русский</label><input type="text" class="e-ru form-control" value="${safeAttr(w.ru)}"></div>



    <div class="form-group"><label>Пример</label><input type="text" class="e-ex form-control" value="${safeAttr(w.ex)}"></div>



    <div class="form-group"><label>Перевод примера</label><input type="text" class="e-ex-translation form-control" value="${safeAttr(w.examples?.[0]?.translation || '')}"></div>



    <div class="form-group"><label>Теги</label><input type="text" class="e-tags form-control" value="${safeAttr(w.tags.join(', '))}"></div>



    <div class="form-actions">



      <button class="save-edit-btn" data-id="${w.id}"><span class="material-symbols-outlined">save</span></button>



      <button class="cancel-edit-btn"><span class="material-symbols-outlined">close</span></button>



    </div>



  `;

  // Добавляем обработчики для кнопок

  card.querySelector('.save-edit-btn').addEventListener('click', function (e) {
    e.stopPropagation();

    const id = this.dataset.id;

    const card = this.closest('.word-card');

    updWord(id, {
      en: card.querySelector('.e-en').value.trim(),

      ru: card.querySelector('.e-ru').value.trim(),

      ex: card.querySelector('.e-ex').value.trim(),

      examples: card.querySelector('.e-ex').value.trim()
        ? [
            {
              text: card.querySelector('.e-ex').value.trim(),

              translation: card.querySelector('.e-ex-translation').value.trim(),
            },
          ]
        : [],

      tags: normalizeTags(card.querySelector('.e-tags').value),
    });

    toast('Слово обновлено!', 'success', 'edit');

    renderWords();
  });

  card

    .querySelector('.cancel-edit-btn')

    .addEventListener('click', function (e) {
      e.stopPropagation();

      renderWords();
    });
}

// Pills & search

document.querySelectorAll('.pill').forEach(p =>
  p.addEventListener('click', () => {
    document

      .querySelectorAll('.pill')

      .forEach(x => x.classList.remove('active'));

    p.classList.add('active');

    activeFilter = p.dataset.filter;

    visibleLimit = 30; // <-- сброс

    renderWords();
  }),
);

// Custom select functionality

const customSelect = document.getElementById('sort-select-container');

const customTrigger = document.getElementById('sort-select-trigger');

const customOptions = document.getElementById('sort-select-options');

const customOptionElements = customOptions.querySelectorAll(
  '.custom-select-option',
);

customTrigger.addEventListener('click', () => {
  customOptions.classList.toggle('open');
});

customOptionElements.forEach(option => {
  option.addEventListener('click', () => {
    const value = option.dataset.value;

    const icon = option.querySelector('.material-symbols-outlined').textContent;

    const text = option.querySelector('span:last-child').textContent;

    // Update trigger

    customTrigger.innerHTML = `







      <span class="material-symbols-outlined">${icon}</span>







      <span>${text}</span>







      <span class="material-symbols-outlined">expand_more</span>







    `;

    // Update active state

    customOptionElements.forEach(opt => opt.classList.remove('active'));

    option.classList.add('active');

    // Close dropdown

    customOptions.classList.remove('open');

    // Trigger change event

    sortBy = value;

    visibleLimit = 30; // <-- сброс

    renderWords();
  });
});

// Close dropdown when clicking outside

document.addEventListener('click', e => {
  if (!customSelect.contains(e.target)) {
    customOptions.classList.remove('open');
  }
});

// Custom select functionality for idioms
const idiomCustomSelect = document.getElementById(
  'idiom-sort-select-container',
);
const idiomCustomTrigger = document.getElementById('idiom-sort-select-trigger');
const idiomCustomOptions = document.getElementById('idiom-sort-select-options');
const idiomCustomOptionElements = idiomCustomOptions.querySelectorAll(
  '.custom-select-option',
);

idiomCustomTrigger.addEventListener('click', () => {
  idiomCustomOptions.classList.toggle('open');
});

idiomCustomOptionElements.forEach(option => {
  option.addEventListener('click', () => {
    const value = option.dataset.value;
    const icon = option.querySelector('.material-symbols-outlined').textContent;
    const text = option.querySelector('span:last-child').textContent;

    // Update trigger
    idiomCustomTrigger.innerHTML = `
      <span class="material-symbols-outlined">${icon}</span>
      <span>${text}</span>
      <span class="material-symbols-outlined">expand_more</span>
    `;

    // Update active state
    idiomCustomOptionElements.forEach(opt => opt.classList.remove('active'));
    option.classList.add('active');

    // Close dropdown
    idiomCustomOptions.classList.remove('open');

    // Trigger change event
    idiomsSortBy = value;
    visibleLimit = 30; // <-- сброс
    renderIdioms();
  });
});

// Close dropdown when clicking outside for idioms
document.addEventListener('click', e => {
  if (!idiomCustomSelect.contains(e.target)) {
    idiomCustomOptions.classList.remove('open');
  }
});

// Filter pills for idioms
document.querySelectorAll('.pill[data-target="idioms"]').forEach(pill => {
  pill.addEventListener('click', () => {
    // Remove active from all idioms pills
    document
      .querySelectorAll('.pill[data-target="idioms"]')
      .forEach(p => p.classList.remove('active'));
    pill.classList.add('active');

    idiomsActiveFilter = pill.dataset.filter;
    visibleLimit = 30; // <-- сброс
    renderIdioms();
  });
});

document.getElementById('words-grid')?.addEventListener('click', e => {
  const tb = e.target.closest('.tag-filter-btn');

  if (!tb) return;

  e.stopPropagation();

  const tag = tb.dataset.tag.toLowerCase();

  tagFilter = tagFilter === tag ? '' : tag;

  visibleLimit = 30; // <-- сброс

  renderWords();
});

// Обработчик кликов для карточек идиом
document.getElementById('idioms-grid')?.addEventListener('click', e => {
  // Фильтр по тегу
  const tagBtn = e.target.closest('.tag');
  if (tagBtn && tagBtn.dataset.tag) {
    const tag = tagBtn.dataset.tag.toLowerCase();
    idiomsTagFilter = idiomsTagFilter === tag ? '' : tag;
    idiomsVisibleLimit = 30;
    renderIdioms();
    return;
  }

  if (e.target.closest('.audio-btn')) {
    const btn = e.target.closest('.audio-btn');
    const idiomId = btn.dataset.idiom;
    const idiom = window.idioms.find(i => i.id === idiomId);
    if (!idiom) return;

    // Удаляем предыдущую волну, если она была
    const existingWave = btn.parentNode.querySelector('.audio-wave');
    if (existingWave) {
      // Возвращаем кнопку, если была волна
      const originalBtn = existingWave._originalBtn;
      if (originalBtn && originalBtn.parentNode) {
        originalBtn.style.display = '';
      }
      existingWave.remove();
    }

    // Создаём волну и заменяем ей кнопку
    const wave = document.createElement('div');
    wave.className = 'audio-wave';
    wave.innerHTML =
      '<span></span><span></span><span></span><span></span><span></span>';

    // Сохраняем ссылку на оригинальную кнопку
    wave._originalBtn = btn;

    // Скрываем кнопку и заменяем на волну
    btn.style.display = 'none';
    btn.parentNode.replaceChild(wave, btn);

    // Воспроизводим идиому и возвращаем кнопку после окончания
    if (idiom.audio) {
      playIdiomAudio(idiom.audio, () => {
        if (wave.parentNode && wave._originalBtn) {
          wave.parentNode.replaceChild(wave._originalBtn, wave);
          wave._originalBtn.style.display = '';
        }
      });
    } else {
      speakText(idiom.idiom, () => {
        // через TTS
        if (wave.parentNode && wave._originalBtn) {
          wave.parentNode.replaceChild(wave._originalBtn, wave);
          wave._originalBtn.style.display = '';
        }
      });
    }
    return;
  }

  if (e.target.closest('.example-audio-btn')) {
    const btn = e.target.closest('.example-audio-btn');
    const card = btn.closest('.word-card');
    const idiomId = card.dataset.id;
    const idiom = window.idioms.find(i => i.id === idiomId);
    const exampleIndex = btn.dataset.exampleIndex || 0;

    if (!idiom) return;

    const examplesAudio =
      idiom.examples_audio || idiom.examplesAudio || idiom.examplesaudio;

    // Если пусто — смотрим в банке
    const audioArr = examplesAudio?.length
      ? examplesAudio
      : window.idiomsBank?.find(
          b => b.idiom.toLowerCase() === idiom.idiom.toLowerCase(),
        )?.examplesAudio;

    // Текст для озвучки (пример или сама идиома)
    const fallbackText = idiom.example || idiom.ex || idiom.idiom;
    console.log(' idiom fallbackText:', fallbackText);

    if (audioArr?.length > exampleIndex) {
      // Определяем папку в зависимости от настроек голоса
      const voicePreference = window.user_settings?.voice || 'female';
      const audioFolder =
        voicePreference === 'male' ? '/audio-idioms/' : '/female-idioms/';
      const audio = new Audio(`${audioFolder}${audioArr[exampleIndex]}`);
      audio.play().catch(err => {
        console.log(' Ошибка аудио идиомы, fallback to TTS:', err);
        speakText(fallbackText);
      });
    } else {
      speakText(fallbackText);
    }
    return;
  }

  if (e.target.closest('.edit-btn')) {
    const id = e.target.closest('.edit-btn').dataset.id;
    startEditIdiom(id);
    return;
  }

  if (e.target.closest('.delete-btn')) {
    const id = e.target.closest('.delete-btn').dataset.id;
    pendingDelId = id;
    pendingDeleteType = 'idiom';
    document.getElementById('del-modal').classList.add('open');
    document.body.classList.add('modal-open');
    return;
  }
});

// Delete modal

let pendingDelId = null;
let pendingDeleteType = 'word'; // 'word' или 'idiom'

let searchTimer = null; // <-- добавляем searchTimer

document.getElementById('search-input').addEventListener('input', e => {
  clearTimeout(searchTimer);

  searchTimer = setTimeout(() => {
    searchQ = e.target.value;

    visibleLimit = 30; // <-- сброс

    renderWords();
  }, 280);
});

// Search for idioms
document.getElementById('idioms-search').addEventListener('input', e => {
  clearTimeout(searchTimer);

  searchTimer = setTimeout(() => {
    idiomsSearchQuery = e.target.value;

    visibleLimit = 30; // <-- сброс

    renderIdioms();
  }, 280);
});

document.getElementById('del-confirm').addEventListener('click', () => {
  if (pendingDelId) {
    if (pendingDeleteType === 'word') {
      const wSnap = window.words.find(w => w.id === pendingDelId);
      delWord(pendingDelId);
      pendingDelId = null;
      visibleLimit = 30;
      renderWords();
      toast(`"${esc(wSnap?.en)}" удалено`, 'success', 'delete');
    } else if (pendingDeleteType === 'idiom') {
      const iSnap = window.idioms.find(i => i.id === pendingDelId);

      delIdiom(pendingDelId);

      pendingDelId = null;

      idiomsVisibleLimit = 30;

      renderIdioms();

      // Простой тост для идиом (пока без undo)
      toast(
        `Идиома «${iSnap ? iSnap.idiom : ''}» удалена`,
        'success',
        'delete',
      );
    } else if (pendingDeleteType === 'friend') {
      // Удаление друга
      const userId = window.currentUserId;
      if (!userId) {
        toast('Ошибка: не удалось определить пользователя', 'danger');
        return;
      }
      rejectFriendRequest(userId, pendingDelId)
        .then(() => {
          pendingDelId = null;
          loadFriendsDataNew();
          toast('Удалено из друзей', 'success');
        })
        .catch(err => {
          console.error(err);
          toast('Ошибка удаления', 'danger');
        });
    }
  }

  document.getElementById('del-modal').classList.remove('open');
  document.body.classList.remove('modal-open'); // Возвращаем скролл
});

document.getElementById('del-cancel').addEventListener('click', () => {
  document.getElementById('del-modal').classList.remove('open');
  document.body.classList.remove('modal-open'); // Возвращаем скролл
});

function startEditIdiom(id) {
  const i = window.idioms.find(x => x.id === id);
  if (!i) return;

  const card = document.querySelector(`.word-card[data-id="${id}"]`);
  if (!card) return;

  card.classList.add('editing');
  card.innerHTML = `
    <div class="form-group"><label>Идиома</label>
      <input type="text" class="e-idiom form-control" value="${safeAttr(i.idiom)}"></div>
    <div class="form-group"><label>Перевод</label>
      <input type="text" class="e-meaning form-control" value="${safeAttr(i.meaning)}"></div>
    <div class="form-group"><label>Определение</label>
      <input type="text" class="e-definition form-control" value="${safeAttr(i.definition)}"></div>
    <div class="form-group"><label>Пример</label>
      <input type="text" class="e-example form-control" value="${safeAttr(i.example)}"></div>
    <div class="form-group"><label>Перевод примера</label>
      <input type="text" class="e-exampletranslation form-control" value="${safeAttr(i.example_translation)}"></div>
    <div class="form-group"><label>Теги</label>
      <input type="text" class="e-tags form-control" value="${safeAttr(i.tags.join(', '))}"></div>
    <div class="form-actions">
      <button class="save-edit-idiom-btn" data-id="${i.id}">
        <span class="material-symbols-outlined">save</span>
      </button>
      <button class="cancel-edit-idiom-btn">
        <span class="material-symbols-outlined">close</span>
      </button>
    </div>
  `;

  card
    .querySelector('.save-edit-idiom-btn')
    .addEventListener('click', function (e) {
      e.stopPropagation();
      const id = this.dataset.id;
      updIdiom(id, {
        idiom: card.querySelector('.e-idiom').value.trim(),
        meaning: card.querySelector('.e-meaning').value.trim(),
        definition: card.querySelector('.e-definition').value.trim(),
        example: card.querySelector('.e-example').value.trim(),
        example_translation: card
          .querySelector('.e-exampletranslation')
          .value.trim(),
        tags: normalizeTags(card.querySelector('.e-tags').value),
      });
      toast('Saved!', 'success', 'edit');
      renderIdioms();
    });

  card
    .querySelector('.cancel-edit-idiom-btn')
    .addEventListener('click', function (e) {
      e.stopPropagation();
      renderIdioms();
    });
}

// ============================================================

// ADD WORDS

// ============================================================

document.getElementById('single-form')?.addEventListener('submit', async e => {
  e.preventDefault();

  const en = document.getElementById('f-en').value.trim();

  const ru = document.getElementById('f-ru').value.trim();

  const ex = document.getElementById('f-ex').value.trim();

  const exTranslation = document

    .getElementById('f-ex-translation')

    .value.trim();

  const tagsString = document.getElementById('f-tags').value;

  // Нормализация тегов

  const tags = normalizeTags(tagsString);

  // Преобразуем ex в examples массив с переводом

  const examples = ex ? [{ text: ex, translation: exTranslation }] : [];

  // Извлекаем аудио из сохранённых данных автозаполнения

  const audio = lastFetchedWordData?.audio || null;

  const examplesAudio = lastFetchedWordData?.examplesAudio || null;

  // Добавляем слово с валидацией

  const success = addWord(
    en,

    ru,

    ex,

    tags,

    examples,

    audio,

    examplesAudio,
  );

  if (success) {
    // Сбрасываем значения полей

    e.target.reset();

    // Сбрасываем стили auto-filled

    const fields = ['f-en', 'f-ru', 'f-ex', 'f-ex-translation', 'f-tags'];

    fields.forEach(id => {
      const field = document.getElementById(id);

      if (field) field.classList.remove('auto-filled');
    });

    lastFetchedWordData = null; // очищаем данные автозаполнения

    document.getElementById('f-en').focus();

    const bank =
      window.wordBank instanceof Promise
        ? await window.wordBank
        : window.wordBank;
    const remaining = bank
      ? bank.filter(b => !window.words.find(w => w.en === b.en)).length
      : 0;
    toast(
      `"${esc(en)}" добавлено!<br><span style="opacity:0.8;font-size:0.85em">Ещё ${remaining} слов в банке</span>`,
      'success',
      'add_circle',
    );

    // Переключаемся на словарь чтобы показать анимацию

    switchTab('words');

    setTimeout(() => {
      // Сортировка — новое слово первым

      const activeOption = document.querySelector(
        '.custom-select-option[data-value="date-desc"]',
      );

      if (activeOption && !activeOption.classList.contains('active')) {
        // Сбрасываем все опции

        document

          .querySelectorAll('.custom-select-option')

          .forEach(opt => opt.classList.remove('active'));

        // Активируем нужную

        activeOption.classList.add('active');

        // Обновляем триггер

        const icon = activeOption.querySelector(
          '.material-symbols-outlined',
        ).textContent;

        const text = activeOption.querySelector('span:last-child').textContent;

        document.getElementById('sort-select-trigger').innerHTML = `







          <span class="material-symbols-outlined">${icon}</span>







          <span>${text}</span>







          <span class="material-symbols-outlined">expand_more</span>







        `;

        sortBy = 'date-desc';

        renderWords(); // вызываем renderWords только если изменили сортировку
      }

      setTimeout(() => {
        const newCard = document.querySelector('#words-grid .word-card');

        if (newCard) {
          newCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

          newCard.classList.add('new-word-highlight');
        }
      }, 100);
    }, 100);
  }
});

// Обработчик формы добавления слова в модальном окне
let isSubmittingWord = false;

document
  .getElementById('add-word-form')
  ?.addEventListener('submit', async e => {
    e.preventDefault();

    if (isSubmittingWord) {
      console.log('⚠️ Форма уже отправляется, игнорируем повтор');
      return;
    }

    isSubmittingWord = true;

    try {
      const en = document.getElementById('modal-word-en').value.trim();
      const ru = document.getElementById('modal-word-ru').value.trim();
      const ex = document.getElementById('modal-word-ex').value.trim();
      const exTranslation = document
        .getElementById('modal-word-ex-translation')
        .value.trim();
      const tags = document.getElementById('modal-word-tags').value.trim();

      if (!en || !ru) {
        toast('Заполни английское слово и перевод', 'warning');
        return;
      }

      // === Проверка дубликата перед добавлением ===
      const enLower = en.toLowerCase();
      const ruTrimmed = ru.trim();

      const isDuplicate = window.words.some(w => {
        if (w.en.toLowerCase() !== enLower) return false;
        const existing = parseAnswerVariants(w.ru);
        const newVariants = parseAnswerVariants(ruTrimmed);
        return newVariants.some(v => existing.includes(v));
      });

      if (isDuplicate) {
        toast(
          'Такое слово с этим переводом уже есть в твоём словаре',
          'warning',
        );
        return;
      }

      const examples = ex ? [{ text: ex, translation: exTranslation }] : [];
      const phonetic = lastFetchedWordData?.phonetic || null;

      const success = await addWord(
        en,
        ru,
        ex,
        normalizeTags(tags),
        phonetic,
        examples,
        lastFetchedWordData?.audio || null,
        lastFetchedWordData?.examplesAudio || null,
      );

      if (success) {
        // Ждем загрузки wordBank если еще не загружен
        const bank =
          window.wordBank instanceof Promise
            ? await window.wordBank
            : window.wordBank;
        const remaining = bank
          ? bank.filter(b => !window.words.find(w => w.en === b.en)).length
          : 0;
        toast(
          `"${esc(en)}" добавлено!<br><span style="opacity:0.8;font-size:0.85em">Ещё ${remaining} слов в банке</span>`,
          'success',
          'add_circle',
        );
        closeAddWordModal();
        if (document.querySelector('.tab-pane.active')?.id !== 'tab-words')
          switchTab('words');
      }
    } catch (error) {
      console.error('Ошибка при добавлении слова:', error);
      toast('Ошибка добавления слова', 'danger');
    } finally {
      isSubmittingWord = false;
    }
  });

// Обработчик формы добавления идиомы в модальном окне
let isSubmittingIdiom = false;

document
  .getElementById('add-idiom-form')
  ?.addEventListener('submit', async e => {
    e.preventDefault();
    if (isSubmittingIdiom) {
      console.log('⚠️ Форма идиомы уже отправляется, игнорируем повтор');
      return;
    }
    isSubmittingIdiom = true;

    try {
      const idiom = document.getElementById('modal-idiom-en').value.trim();
      const meaning = document.getElementById('modal-idiom-ru').value.trim();
      const definition = document
        .getElementById('modal-idiom-definition')
        .value.trim();
      const ex = document.getElementById('modal-idiom-ex').value.trim();
      const exTranslation = document
        .getElementById('modal-idiom-ex-translation')
        .value.trim();
      const tags = document.getElementById('modal-idiom-tags').value;

      // Используем данные автозаполнения, если они есть
      const audio = lastFetchedIdiomData?.audio || null;
      const examplesAudio = lastFetchedIdiomData?.examplesAudio || [];
      const phonetic = lastFetchedIdiomData?.phonetic || '';

      const success = await addIdiom(
        idiom,
        meaning,
        definition,
        ex,
        phonetic,
        tags,
        audio,
        examplesAudio,
        exTranslation,
      );

      if (success) {
        const remaining = window.idiomsBank
          ? window.idiomsBank.filter(
              b => !window.idioms.find(i => i.idiom === b.idiom),
            ).length
          : 0;
        toast(
          `"${esc(idiom)}" добавлено!<br><span style="opacity:0.8;font-size:0.85em">Ещё ${remaining} идиом в банке</span>`,
          'success',
          'add_circle',
        );
        closeAddIdiomModal();
        if (document.querySelector('.tab-pane.active')?.id !== 'tab-idioms')
          switchTab('idioms');
        lastFetchedIdiomData = null; // очищаем после добавления
      }
    } catch (error) {
      console.error('Ошибка при добавлении идиомы:', error);
      toast('Ошибка добавления идиомы', 'danger');
    } finally {
      isSubmittingIdiom = false;
    }
  });

// File import variables

// Переменные для автодополнения

let suggestionsVisible = false;

let selectedSuggestionIndex = -1;

// Используем поле из модального окна вместо удаленной формы
const enInput = document.getElementById('modal-word-en');

const suggestionsContainer = document.getElementById(
  'autocomplete-suggestions',
);

// Фильтрация и отображение подсказок

const showSuggestions = debounce(query => {
  if (!query || query.length < 2) {
    suggestionsContainer.style.display = 'none';
    return;
  }

  const lowerQuery = query.toLowerCase();

  // Собираем кандидатов из банка
  const bankCandidates = (window.wordBank || [])
    .filter(item => item.en.toLowerCase().startsWith(lowerQuery))
    .map(item => ({
      en: item.en,
      ru: item.ru,
      tags: item.tags || [],
      phonetic: item.phonetic || null,
      examples: item.examples || [],
      examplesAudio: item.examplesAudio || [],
      audio: item.audio,
      source: 'bank',
    }));

  // Множество уже добавленных слов (чтобы исключить их из подсказок)
  const userWordsEn = new Set(window.words.map(w => w.en.toLowerCase()));

  // Оставляем только те из банка, которых ещё нет у пользователя
  const filteredBankCandidates = bankCandidates.filter(
    c => !userWordsEn.has(c.en.toLowerCase()),
  );

  if (filteredBankCandidates.length === 0) {
    suggestionsContainer.style.display = 'none';
    return;
  }

  // Формируем HTML
  suggestionsContainer.innerHTML = filteredBankCandidates
    .map((c, index) => {
      const tags = c.tags.slice(0, 2).join(' · ');
      return `<div class="suggestion-item" data-index="${index}" data-word="${encodeURIComponent(JSON.stringify(c))}">
        <strong>${c.en}</strong> 
        <span style="color: var(--muted); font-size: 0.8rem;">${c.ru}</span>
        ${tags ? `<span style="color: var(--primary); font-size: 0.7rem;"> (${tags})</span>` : ''}
      </div>`;
    })
    .join('');

  suggestionsContainer.style.display = 'block';
  selectedSuggestionIndex = -1;
}, 200);

// Обработчик ввода

enInput.addEventListener('input', e => {
  const val = e.target.value.trim();

  // Если поле en пустое — очищаем только авто-заполненные поля
  if (val === '') {
    document.querySelectorAll('.auto-filled').forEach(field => {
      if (field.id !== 'modal-word-en') {
        field.value = '';
        field.classList.remove('auto-filled');
      }
    });
    lastFetchedWordData = null;
    showSuggestions(val);
    return;
  }

  // Если есть сохранённые данные автозаполнения и введённый текст не совпадает с последним выбранным словом — сбрасываем
  if (lastFetchedWordData && val !== lastFetchedWordData.en) {
    lastFetchedWordData = null;
  }
  showSuggestions(val);
});

// Обработчик клика на подсказку (через делегирование)

suggestionsContainer.addEventListener('click', e => {
  const target = e.target.closest('.suggestion-item');

  if (!target) return;

  const data = JSON.parse(decodeURIComponent(target.dataset.word));

  enInput.value = data.en;

  // Сохраняем полные данные для последующего использования при сабмите

  lastFetchedWordData = {
    ru: data.ru,

    phonetic: data.phonetic,

    tags: data.tags,

    audio: data.audio,

    examples: data.examples,

    examplesAudio: data.examplesAudio,
  };

  // Заполняем поля формы сразу из данных кандидата

  fillFormWithData(lastFetchedWordData);

  suggestionsContainer.style.display = 'none';

  // Убираем вызов auto-fill-btn – данные уже заполнены
});

// Скрываем подсказки при потере фокуса (с задержкой, чтобы успеть кликнуть)

enInput.addEventListener('blur', () => {
  setTimeout(() => {
    suggestionsContainer.style.display = 'none';
  }, 200);
});

// Возвращаем фокус (чтобы при клике на подсказку поле не теряло фокус раньше)

enInput.addEventListener('focus', () => {
  if (enInput.value.length >= 2) {
    showSuggestions(enInput.value);
  }
});

// Навигация с клавиатуры (стрелки вверх/вниз, Enter)

enInput.addEventListener('keydown', e => {
  const items = suggestionsContainer.querySelectorAll('.suggestion-item');

  if (items.length === 0) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();

    selectedSuggestionIndex = (selectedSuggestionIndex + 1) % items.length;

    updateSelectedItem(items);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();

    selectedSuggestionIndex =
      (selectedSuggestionIndex - 1 + items.length) % items.length;

    updateSelectedItem(items);
  } else if (e.key === 'Enter' && selectedSuggestionIndex !== -1) {
    e.preventDefault();
    selectedItem.click(); // программно кликаем по выбранному элементу
  }
});

function updateSelectedItem(items) {
  items.forEach((item, idx) => {
    if (idx === selectedSuggestionIndex) {
      item.classList.add('selected');

      // Прокрутка, если нужно

      item.scrollIntoView({ block: 'nearest' });
    } else {
      item.classList.remove('selected');
    }
  });
}

// --- Автодополнение для русского перевода ---
const ruInput = document.getElementById('modal-word-ru');
const ruSuggestionsContainer = document.getElementById(
  'ru-autocomplete-suggestions',
);

let selectedRuSuggestionIndex = -1;

function showRussianSuggestions(query) {
  if (!query || query.length < 2) {
    ruSuggestionsContainer.style.display = 'none';
    return;
  }

  const lowerQuery = query.toLowerCase();
  const userWordsEn = new Set(window.words.map(w => w.en.toLowerCase()));

  // Ищем в банке слов, у которых русский перевод начинается с введённой строки
  const candidates = (window.wordBank || [])
    .filter(item => {
      // Приводим русский перевод к нижнему регистру и проверяем, начинается ли с запроса
      const ruLower = item.ru.toLowerCase();
      return (
        ruLower.startsWith(lowerQuery) &&
        !userWordsEn.has(item.en.toLowerCase())
      );
    })
    .map(item => ({
      en: item.en,
      ru: item.ru,
      tags: item.tags || [],
      phonetic: item.phonetic || null,
      examples: item.examples || [],
      examplesAudio: item.examplesAudio || [],
      audio: item.audio,
      source: 'bank',
    }));

  if (candidates.length === 0) {
    ruSuggestionsContainer.style.display = 'none';
    return;
  }

  ruSuggestionsContainer.innerHTML = candidates
    .map((c, index) => {
      const tags = c.tags.slice(0, 2).join(' · ');
      return `<div class="suggestion-item" data-index="${index}" data-word="${encodeURIComponent(JSON.stringify(c))}">
        <strong>${c.en}</strong> 
        <span style="color: var(--muted); font-size: 0.8rem;">${c.ru}</span>
        ${tags ? `<span style="color: var(--primary); font-size: 0.7rem;"> (${tags})</span>` : ''}
      </div>`;
    })
    .join('');

  ruSuggestionsContainer.style.display = 'block';
  selectedRuSuggestionIndex = -1;
}

// Обработчик ввода в русское поле
ruInput.addEventListener('input', e => {
  const val = e.target.value.trim();

  if (val === '') {
    // Очищаем только авто-заполненные поля, кроме самого русского поля
    document.querySelectorAll('.auto-filled').forEach(field => {
      if (field.id !== 'modal-word-ru' && field.id !== 'modal-word-en') {
        field.value = '';
        field.classList.remove('auto-filled');
      }
    });
    lastFetchedWordData = null;
    showRussianSuggestions(val);
    return;
  }

  // Если есть сохранённые данные и введённый русский текст не совпадает с ru из данных — сбрасываем
  if (lastFetchedWordData && val !== lastFetchedWordData.ru) {
    lastFetchedWordData = null;
  }
  showRussianSuggestions(val);
});

// Обработчик клика на подсказку
ruSuggestionsContainer.addEventListener('click', e => {
  const target = e.target.closest('.suggestion-item');
  if (!target) return;

  const data = JSON.parse(decodeURIComponent(target.dataset.word));

  // Заполняем оба поля
  document.getElementById('modal-word-en').value = data.en;
  ruInput.value = data.ru;

  // Сохраняем данные
  lastFetchedWordData = {
    ru: data.ru,
    phonetic: data.phonetic,
    tags: data.tags,
    audio: data.audio,
    examples: data.examples,
    examplesAudio: data.examplesAudio,
  };

  // Заполняем остальные поля формы
  fillFormWithData(lastFetchedWordData);
  ruSuggestionsContainer.style.display = 'none';
});

// Скрываем подсказки при потере фокуса
ruInput.addEventListener('blur', () => {
  setTimeout(() => {
    ruSuggestionsContainer.style.display = 'none';
  }, 200);
});

// Возврат фокуса
ruInput.addEventListener('focus', () => {
  if (ruInput.value.length >= 2) {
    showRussianSuggestions(ruInput.value);
  }
});

// Клавиатурная навигация
ruInput.addEventListener('keydown', e => {
  const items = ruSuggestionsContainer.querySelectorAll('.suggestion-item');
  if (items.length === 0) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedRuSuggestionIndex = (selectedRuSuggestionIndex + 1) % items.length;
    updateRuSelectedItem(items, selectedRuSuggestionIndex);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedRuSuggestionIndex =
      (selectedRuSuggestionIndex - 1 + items.length) % items.length;
    updateRuSelectedItem(items, selectedRuSuggestionIndex);
  } else if (e.key === 'Enter' && selectedRuSuggestionIndex !== -1) {
    e.preventDefault();
    items[selectedRuSuggestionIndex].click();
  }
});

// Функция обновления выделения для русского поля
function updateRuSelectedItem(items, index) {
  items.forEach((item, idx) => {
    if (idx === index) {
      item.classList.add('selected');
      item.scrollIntoView({ block: 'nearest' });
    } else {
      item.classList.remove('selected');
    }
  });
}

// === Автодополнение для идиом ===
const idiomEnInput = document.getElementById('modal-idiom-en');
const idiomSuggestionsContainer = document.createElement('div');
idiomSuggestionsContainer.id = 'idiom-autocomplete-suggestions';
idiomSuggestionsContainer.className = 'autocomplete-suggestions';
idiomEnInput.parentNode.style.position = 'relative';
idiomEnInput.parentNode.appendChild(idiomSuggestionsContainer);

const showIdiomSuggestions = debounce(query => {
  if (!query || query.length < 2) {
    idiomSuggestionsContainer.style.display = 'none';
    return;
  }

  const lowerQuery = query.toLowerCase();

  // Ищем в банке идиом
  const candidates = (window.idiomsBank || [])
    .filter(item => item.idiom.toLowerCase().startsWith(lowerQuery))
    .map(item => ({
      idiom: item.idiom,
      meaning: item.meaning,
      definition: item.definition,
      example: item.example,
      example_translation: item.example_translation,
      tags: item.tags || [],
      phonetic: item.phonetic || null,
      audio: item.audio,
      examplesAudio: item.examplesAudio || [],
      source: 'bank',
    }));

  // Множество уже добавленных идиом (по idiom)
  const userIdiomsSet = new Set(window.idioms.map(i => i.idiom.toLowerCase()));

  // Оставляем только те, которых ещё нет у пользователя
  const filteredCandidates = candidates.filter(
    c => !userIdiomsSet.has(c.idiom.toLowerCase()),
  );

  if (filteredCandidates.length === 0) {
    idiomSuggestionsContainer.style.display = 'none';
    return;
  }

  idiomSuggestionsContainer.innerHTML = filteredCandidates
    .map((c, index) => {
      const tags = c.tags.slice(0, 2).join(' · ');
      return `<div class="suggestion-item" data-index="${index}" data-idiom="${encodeURIComponent(JSON.stringify(c))}">
        <strong>${c.idiom}</strong> 
        <span style="color: var(--muted); font-size: 0.8rem;">${c.meaning}</span>
        ${tags ? `<span style="color: var(--primary); font-size: 0.7rem;"> (${tags})</span>` : ''}
      </div>`;
    })
    .join('');

  idiomSuggestionsContainer.style.display = 'block';
  selectedIdiomSuggestionIndex = -1;
}, 200);

// Обработчик ввода
idiomEnInput.addEventListener('input', e => {
  const val = e.target.value.trim();
  if (val === '') {
    // Очищаем только авто-заполненные поля (кроме самого поля)
    document.querySelectorAll('#add-idiom-form .auto-filled').forEach(field => {
      if (field.id !== 'modal-idiom-en') {
        field.value = '';
        field.classList.remove('auto-filled');
      }
    });
    lastFetchedIdiomData = null;
    showIdiomSuggestions(val);
    return;
  }
  if (lastFetchedIdiomData && val !== lastFetchedIdiomData.idiom) {
    lastFetchedIdiomData = null;
  }
  showIdiomSuggestions(val);
});

// Обработчик клика на подсказку
idiomSuggestionsContainer.addEventListener('click', e => {
  const target = e.target.closest('.suggestion-item');
  if (!target) return;

  const data = JSON.parse(decodeURIComponent(target.dataset.idiom));
  idiomEnInput.value = data.idiom;

  // Сохраняем данные для последующего использования при сабмите
  lastFetchedIdiomData = {
    meaning: data.meaning,
    definition: data.definition,
    example: data.example,
    example_translation: data.example_translation,
    tags: data.tags,
    phonetic: data.phonetic,
    audio: data.audio,
    examplesAudio: data.examplesAudio,
  };

  // Заполняем форму
  fillIdiomFormWithData(lastFetchedIdiomData);
  idiomSuggestionsContainer.style.display = 'none';
});

// Потеря фокуса
idiomEnInput.addEventListener('blur', () => {
  setTimeout(() => {
    idiomSuggestionsContainer.style.display = 'none';
  }, 200);
});

// Возврат фокуса
idiomEnInput.addEventListener('focus', () => {
  if (idiomEnInput.value.length >= 2) {
    showIdiomSuggestions(idiomEnInput.value);
  }
});

// Клавиатурная навигация
let selectedIdiomSuggestionIndex = -1;

idiomEnInput.addEventListener('keydown', e => {
  const items = idiomSuggestionsContainer.querySelectorAll('.suggestion-item');
  if (items.length === 0) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedIdiomSuggestionIndex =
      (selectedIdiomSuggestionIndex + 1) % items.length;
    updateSelectedIdiomItem(items);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedIdiomSuggestionIndex =
      (selectedIdiomSuggestionIndex - 1 + items.length) % items.length;
    updateSelectedIdiomItem(items);
  } else if (e.key === 'Enter' && selectedIdiomSuggestionIndex !== -1) {
    e.preventDefault();
    items[selectedIdiomSuggestionIndex].click();
  }
});

function updateSelectedIdiomItem(items) {
  items.forEach((item, idx) => {
    if (idx === selectedIdiomSuggestionIndex) {
      item.classList.add('selected');
      item.scrollIntoView({ block: 'nearest' });
    } else {
      item.classList.remove('selected');
    }
  });
}

// File import variables

function showPreview() {
  console.log('🎬 showPreview called');

  console.log('📊 fileParsed:', fileParsed);

  console.log('📚 Current window.words count:', window.words.length);

  console.log('🔍 First 5 current window.words:', window.words.slice(0, 5));

  const previewWrap = document.getElementById('file-preview-wrap');

  const tbody = document.getElementById('file-tbody');

  if (!previewWrap || !tbody) {
    console.error('❌ Preview elements not found');

    return;
  }

  // Очищаем существующую таблицу перед генерацией

  tbody.innerHTML = '';

  // Генерируем таблицу заново с правильными состояниями чекбоксов

  const tableRows = fileParsed

    .map((w, i) => {
      const isDuplicate = window.words.some(existing => {
        if (existing.en.toLowerCase() !== w.en.toLowerCase()) return false;

        const existingRuVariants = parseAnswerVariants(existing.ru);

        const newRuVariants = parseAnswerVariants(w.ru);

        return newRuVariants.some(v => existingRuVariants.includes(v));
      });

      const isChecked = !isDuplicate ? 'checked' : '';

      console.log(
        `📝 Word ${i}: "${w.en}" - ${isDuplicate ? 'DUPLICATE (unchecked)' : 'NEW (checked)'}`,
      );

      return `







    <tr>







      <td><input type="checkbox" class="fchk" data-i="${i}" ${isChecked}></td>







      <td>${esc(w.en)}${isDuplicate ? '<br><span style="color: var(--warning); font-size: 0.8em;">(уже есть)</span>' : ''}</td>







      <td>${parseAnswerVariants(w.ru).join(', ') || esc(w.ru)}</td>







      <td>${esc(w.ex || '-')}</td>







    </tr>







  `;
    })

    .join('');

  tbody.innerHTML = tableRows;

  previewWrap.style.display = 'block';

  // Показываем кнопку импорта

  const importBtn = document.getElementById('import-file-btn');

  if (importBtn) {
    importBtn.style.display = 'block';

    console.log('✅ Import button shown');
  } else {
    console.error('❌ Import button not found!');
  }

  // Добавляем сообщение о дубликатах если есть

  const duplicateCount = fileParsed.filter(w =>
    window.words.find(x => x.en.toLowerCase() === w.en.toLowerCase()),
  ).length;

  let warningDiv = null;

  if (duplicateCount > 0) {
    warningDiv = document.createElement('div');

    warningDiv.style.cssText = `







      background: var(--warning);







      color: white;







      padding: 0.75rem;







      border-radius: 8px;







      margin-bottom: 1rem;







      font-size: 0.9rem;







    `;

    warningDiv.innerHTML = `⚠️ Найдено ${duplicateCount} слов, которые уже есть в словаре. Они автоматически сняты с выбора.`;

    previewWrap.parentNode.insertBefore(warningDiv, previewWrap);
  }

  const btn = document.getElementById('import-file-btn');

  console.log('Import button element:', btn);

  if (btn) {
    const newCount = fileParsed.filter(
      w => !window.words.find(x => x.en.toLowerCase() === w.en.toLowerCase()),
    ).length;

    console.log('New window.words count:', newCount);

    console.log('Duplicate count:', fileParsed.length - newCount);

    // Показываем детальную информацию о первых словах

    fileParsed.slice(0, 3).forEach((w, i) => {
      const isDuplicate = window.words.find(
        x => x.en.toLowerCase() === w.en.toLowerCase(),
      );

      console.log(
        `Word ${i}: "${w.en}" - ${isDuplicate ? 'DUPLICATE' : 'NEW'}`,
      );
    });

    btn.style.display = fileParsed.length ? 'block' : 'none';

    btn.textContent = `✓ Импортировать ${newCount} новых слов${fileParsed.length - newCount > 0 ? ' (' + (fileParsed.length - newCount) + ' дублей пропустим)' : ''}`;

    console.log('Button configured, display:', btn.style.display);

    console.log('Button text:', btn.textContent);

    // Назначаем обработчик прямо здесь

    btn.onclick = function () {
      console.log('Import button clicked!');

      console.log('fileParsed length:', fileParsed.length);

      const checkboxes = document.querySelectorAll('.fchk:checked');

      console.log('Checked checkboxes:', checkboxes.length);

      const indices = Array.from(checkboxes).map(cb => parseInt(cb.dataset.i));

      console.log('Selected indices:', indices);

      let added = 0;

      indices.forEach(i => {
        const w = fileParsed[i];

        console.log(`Processing word ${i}:`, w);

        // Валидация

        if (!validateEnglish(w.en)) {
          toast(`Некорректное английское слово: ${w.en}`, 'warning');

          return;
        }

        if (!validateRussian(w.ru)) {
          toast(`Некорректный перевод: ${w.ru}`, 'warning');

          return;
        }

        if (!validateExample(w.ex)) {
          toast(`Некорректный пример: ${w.ex}`, 'warning');

          return;
        }

        const tags = w.tags || [];

        if (!validateTags(tags)) {
          toast(`Некорректные теги: ${tags.join(', ')}`, 'warning');

          return;
        }

        // Проверка дубликатов с учетом перевода

        const isDuplicate = window.words.some(existing => {
          if (existing.en.toLowerCase() !== w.en.toLowerCase()) return false;

          const existingRuVariants = parseAnswerVariants(existing.ru);

          const newRuVariants = parseAnswerVariants(w.ru);

          return newRuVariants.some(v => existingRuVariants.includes(v));
        });

        if (!isDuplicate) {
          const newWord = mkWord(
            w.en,

            w.ru,

            w.ex,

            w.tags || [],

            w.phonetic || null,

            null, // examples - нет в этом контексте

            w.audio || null, // audio

            w.examplesAudio || null, // examplesAudio
          );

          window.words.push(newWord);

          markWordDirty(newWord.id); // добавляем в очередь синхронизации

          added++;

          console.log(`Added word: ${w.en}`);
        } else {
          console.log(`Duplicate skipped: ${w.en}`);
        }
      });

      console.log(`Total added: ${added}`);

      console.log('Saving changes...');

      // Сохраняем изменения

      debouncedSave();

      scheduleProfileSave(); // ← ДОБАВЬ ЭТО

      // Скрываем предпросмотр и кнопку

      document.getElementById('file-preview-wrap').style.display = 'none';

      btn.style.display = 'none';

      fileParsed = [];

      // Очищаем предупреждения о дубликатах

      const warningDivs = document.querySelectorAll(
        'div[style*="background: var(--warning)"]',
      );

      warningDivs.forEach(div => div.remove());

      toast(`Импортировано ${added} слов!`, 'success', 'upload_file');

      visibleLimit = 30;

      renderWords();

      renderStats();

      switchTab('words');

      // Прокручиваем в начало словаря

      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);

      console.log('🏁 Import process completed');
    };

    console.log('✅ Click handler assigned to button');
  } else {
    console.error('❌ Import button not found!');
  }
}

// Функция для получения голоса в зависимости от настроек
function getVoice() {
  const voicePreference = window.user_settings?.voice || 'female';

  // Получаем доступные голоса
  const voices = speechSynthesis.getVoices();
  if (!voices.length) {
    // Голоса ещё не загружены, вернём null
    return null;
  }

  // Ищем подходящий голос
  let targetVoice = null;

  if (voicePreference === 'male') {
    // Ищем мужской голос
    targetVoice = voices.find(
      voice =>
        voice.lang.includes('en') &&
        (voice.name.includes('Male') ||
          voice.name.includes('male') ||
          voice.name.includes('David') ||
          voice.name.includes('Alex') ||
          voice.name.includes('Daniel')),
    );
  } else {
    // Ищем женский голос
    targetVoice = voices.find(
      voice =>
        voice.lang.includes('en') &&
        (voice.name.includes('Female') ||
          voice.name.includes('female') ||
          voice.name.includes('Samantha') ||
          voice.name.includes('Karen') ||
          voice.name.includes('Monica') ||
          voice.name.includes('Zira')),
    );
  }

  // Если не нашли конкретный, берем любой английский
  if (!targetVoice) {
    targetVoice = voices.find(voice => voice.lang.includes('en'));
  }

  console.log('🗣️ getVoice returned:', targetVoice);
  return targetVoice;
}

// Функция для озвучки текста с учетом настроек голоса
function speakText(text) {
  console.log('🗣️ speakText called with:', text);
  if (!window.speechSynthesis) {
    console.error('❌ speechSynthesis not supported');
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  const voice = getVoice();
  if (voice) utterance.voice = voice;
  utterance.onerror = e => console.error('TTS error:', e);
  speechSynthesis.speak(utterance);
  return utterance;
}

// Инициализация голосов при загрузке
if (speechSynthesis.onvoiceschanged !== undefined) {
  speechSynthesis.onvoiceschanged = () => {
    // Голоса загружены
  };
}

// ============================================================

// БЫСТРЫЙ ВВОД НЕСКОЛЬКИХ СЛОВ

// ============================================================

document

  .getElementById('dropdown-speech-settings')

  ?.addEventListener('click', () => {
    const modal = document.getElementById('speech-modal');

    modal.classList.add('open');
    document.body.classList.add('modal-open'); // Блокируем скролл

    // Load practice settings

    const current = window.user_settings?.reviewLimit || 100;

    document.getElementById('review-limit-select').value =
      current === 9999 ? '9999' : current;

    document.getElementById('current-limit-info').innerHTML =
      `Текущий лимит: <strong>${current === 9999 ? 'Без лимита' : current}</strong>`;

    // Load voice settings
    const currentVoice = window.user_settings?.voice || 'female';
    document.getElementById('voice-select').value = currentVoice;

    // Load theme settings
    const baseTheme = window.user_settings?.baseTheme || 'lavender';
    document.getElementById('theme-base-select').value = baseTheme;

    // Load phonetic setting
    const showPhonetic = window.user_settings?.showPhonetic ?? true;
    document.getElementById('show-phonetic').checked = showPhonetic;
  });

// Обработчик кнопки тура
document
  .getElementById('dropdown-start-tour')
  ?.addEventListener('click', () => {
    document.getElementById('user-dropdown').style.display = 'none';
    window.startTour();
  });

// Обработчик кнопки синхронизации

document

  .getElementById('dropdown-sync')

  ?.addEventListener('click', async () => {
    if (!navigator.onLine) {
      toast('⚠️ Нет подключения к интернету', 'warning');

      return;
    }

    // Проверяем на quota exceeded

    if (window.quotaExceeded) {
      toast('⚠️ Лимит запросов исчерпан. Попробуйте позже.', 'warning');

      return;
    }

    toast('Синхронизация...', 'info', 'sync');

    try {
      // Полная синхронизация - замена локальных данных серверными

      const oldCount = window.words.length;

      await window.authExports.loadWordsOnce(serverWords => {
        window.words = serverWords;

        localStorage.setItem('englift_words', JSON.stringify(window.words));

        renderStats();

        console.log(
          `🔄 Синхронизировано: ${oldCount} → ${serverWords.length} слов`,
        );
      });

      toast(
        `✅ Синхронизация завершена (${window.words.length} слов)`,

        'success',
      );
    } catch (e) {
      console.error('Ошибка синхронизации:', e);

      // Проверяем на quota exceeded

      if (
        e.code === 'resource-exhausted' ||
        e.message?.includes('Quota exceeded')
      ) {
        toast(
          '⚠️ Лимит запросов исчерпан. Данные сохранятся локально.',

          'warning',
        );

        window.quotaExceeded = true;
      } else {
        toast('Ошибка синхронизации', 'danger', 'error');
      }
    }
  });

// Speech modal handlers

// === СОХРАНЕНИЕ ТЕМЫ ИЗ МОДАЛКИ ===
const speechModalSave = document.getElementById('speech-modal-save');
const themeSelect = document.getElementById('theme-base-select');

if (speechModalSave && themeSelect) {
  speechModalSave.addEventListener('click', async () => {
    // 1. Читаем все значения из формы
    const newVoice = document.getElementById('voice-select').value;
    const newLimit = document.getElementById('review-limit-select').value;
    const newTheme = document.getElementById('theme-base-select').value;
    const showPhonetic = document.getElementById('show-phonetic').checked;
    const currentDark = window.user_settings?.dark ?? false;

    // 2. Обновляем глобальный объект настроек
    window.user_settings = window.user_settings || {};
    window.user_settings.voice = newVoice;
    window.user_settings.reviewLimit =
      newLimit === '9999' ? 9999 : parseInt(newLimit, 10);
    window.user_settings.baseTheme = newTheme;
    window.user_settings.showPhonetic = showPhonetic;
    // dark не трогаем — он остаётся как был

    // 3. Применяем тему (она уже вызовет scheduleProfileSave)
    window.applyTheme(newTheme, currentDark);

    // 4. Немедленно сохраняем профиль на сервер
    if (window.currentUserId) {
      await window.syncProfileToServer();
    }

    // 5. Обновляем интерфейс, чтобы отобразить новый лимит
    refreshUI();

    // 6. Закрываем модалку и показываем тост
    document.getElementById('speech-modal').classList.remove('open');
    document.body.classList.remove('modal-open');
    window.toast?.('Настройки сохранены!', 'success');
  });
}

// Кнопка закрытия удалена из HTML

document.getElementById('speech-modal-close').addEventListener('click', () => {
  document.getElementById('speech-modal').classList.remove('open');
  document.body.classList.remove('modal-open'); // Возвращаем скролл
});

document.getElementById('speech-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) {
    document.getElementById('speech-modal').classList.remove('open');
    document.body.classList.remove('modal-open'); // Возвращаем скролл
  }
});

// ============================================================

// DANGER ACTIONS

// ============================================================

// Функция показа модального окна подтверждения

function showConfirmModal(message, hintText, expectedText, onConfirm) {
  const modal = document.getElementById('confirm-modal');

  const messageEl = document.getElementById('confirm-message');

  const hintEl = document.getElementById('confirm-hint');

  const inputEl = document.getElementById('confirm-input');

  const confirmBtn = document.getElementById('confirm-action');

  const cancelBtn = document.getElementById('cancel-confirm');

  // Устанавливаем тексты

  messageEl.textContent = message;

  hintEl.textContent = `Напишите "${expectedText}" для подтверждения`;

  inputEl.value = '';

  inputEl.placeholder = `Введите "${expectedText}"`;

  // Показываем модальное окно

  modal.classList.add('open');
  document.body.classList.add('modal-open'); // Блокируем скролл

  // Функция проверки

  const checkInput = () => {
    const isValid = checkAnswerWithNormalization(
      inputEl.value.trim().toLowerCase(),
      expectedText.toLowerCase(),
    );

    confirmBtn.disabled = !isValid;

    confirmBtn.style.opacity = isValid ? '1' : '0.5';
  };

  // Обработчики

  inputEl.addEventListener('input', checkInput);

  inputEl.addEventListener('keyup', e => {
    if (e.key === 'Enter' && !confirmBtn.disabled) {
      onConfirm();

      modal.classList.remove('open');
      document.body.classList.remove('modal-open'); // Возвращаем скролл
    }
  });

  confirmBtn.onclick = () => {
    if (!confirmBtn.disabled) {
      onConfirm();

      modal.classList.remove('open');
      document.body.classList.remove('modal-open'); // Возвращаем скролл
    }
  };

  cancelBtn.onclick = () => {
    modal.classList.remove('open');
    document.body.classList.remove('modal-open'); // Возвращаем скролл
  };

  // Закрытие по клику на фон

  modal.addEventListener('click', e => {
    if (e.target === modal) {
      modal.classList.remove('open');
      document.body.classList.remove('modal-open'); // Возвращаем скролл
    }
  });

  // Начальная проверка

  checkInput();
}

// Кнопка "Стереть все слова"

document.getElementById('clear-words-btn')?.addEventListener('click', () => {
  showConfirmModal(
    'Вы уверены, что хотите стереть ВСЕ слова? Это действие нельзя отменить.',

    'стереть',

    'стереть',

    async () => {
      try {
        console.log('🗑️ Начинаем стирание всех слов...');

        // 1. Очищаем локальные слова

        window.words = [];

        localStorage.removeItem('englift_words');

        renderCache.clear();

        // 2. Удаляем слова с сервера

        if (window.currentUserId) {
          const { error, count } = await supabase

            .from('user_words')

            .delete({ count: 'exact' })

            .eq('user_id', window.currentUserId);

          if (error) {
            console.error('❌ Ошибка удаления слов с сервера:', error);

            toast('Ошибка при удалении слов с сервера', 'danger');

            return;
          }

          console.log(`✅ Удалено ${count} слов с сервера`);
        }

        // 3. Очищаем очередь синхронизации

        pendingWordUpdates.clear();

        // 4. Обновляем интерфейс

        refreshUI();

        scheduleProfileSave(); // пометить профиль как изменённый (изменилось общее кол-во слов)

        toast('✅ Все слова успешно стерты!', 'success');
      } catch (error) {
        console.error('❌ Ошибка при стирании слов:', error);

        toast('Ошибка при стирании слов', 'danger');
      }
    },
  );
});

// Кнопка "Удалить аккаунт"

document.getElementById('delete-account-btn')?.addEventListener('click', () => {
  showConfirmModal(
    'ВНИМАНИЕ! Это удалит ваш аккаунт, все слова, прогресс и настройки навсегда. Это действие НЕЛЬЗЯ отменить!',

    'удалить',

    'удалить',

    async () => {
      console.log('🗑️ Начинаем удаление аккаунта...');

      try {
        // Явно достаём токен из сессии
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) throw new Error('Нет активной сессии');

        const { data, error } = await supabase.functions.invoke(
          'delete-account',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`, // ✅ явно передаём токен
            },
          },
        );

        if (error) throw error;

        console.log('✅ Функция вернула успех:', data);

        await supabase.auth.signOut();
        window.clearUserData?.(true);
        window.toast?.('Аккаунт удалён навсегда', 'success');
        setTimeout(() => window.location.reload(), 800);
      } catch (err) {
        console.error('❌ Ошибка удаления аккаунта:', err);
        window.toast?.(
          'Ошибка: ' + (err.message || err.error || 'Неизвестно'),
          'danger',
        );
      }
    },
  );
});

// Кнопка "Сбросить весь прогресс"
document.getElementById('reset-progress-btn')?.addEventListener('click', () => {
  showConfirmModal(
    'Вы уверены, что хотите сбросить ВЕСЬ прогресс? Все слова, уровень, XP, бейджи и streak будут удалены. Настройки сохранятся.',
    'сбросить',
    'сбросить',
    async () => {
      try {
        console.log('🗑️ Начинаем сброс прогресса...');

        // 1. Удаляем все слова с сервера
        if (window.currentUserId) {
          const { error: wordsError, count } = await supabase
            .from('user_words')
            .delete({ count: 'exact' })
            .eq('user_id', window.currentUserId);
          if (wordsError) throw wordsError;
          console.log(`✅ Удалено ${count} слов с сервера`);
        }

        // 1.5. Удаляем все идиомы с сервера
        if (window.currentUserId) {
          const { error: idiomsError, count: idiomsCount } = await supabase
            .from('user_idioms')
            .delete({ count: 'exact' })
            .eq('user_id', window.currentUserId);
          if (idiomsError) throw idiomsError;
          console.log(`✅ Удалено ${idiomsCount} идиом с сервера`);
        }

        // 2. Сбрасываем профиль на сервере (сохраняем настройки)
        if (window.currentUserId) {
          const today = new Date().toISOString().split('T')[0];
          const { error: profileError } = await supabase
            .from('profiles')
            .update({
              xp: 0,
              level: 1,
              badges: [],
              streak: 0,
              laststreakdate: null,
              dailyprogress: {
                add_new: 0,
                review: 0,
                practice_time: 0,
                completed: false,
                lastReset: today,
              },
              dailyreviewcount: 0,
              lastreviewreset: today,
              // usersettings не трогаем — они сохранятся
            })
            .eq('id', window.currentUserId);
          if (profileError) throw profileError;
          console.log('✅ Профиль сброшен');
        }

        // 3. Очищаем локальные данные
        window.words = [];
        window.idioms = [];
        localStorage.removeItem('englift_words');
        localStorage.removeItem('englift_idioms');
        renderCache.clear();
        pendingWordUpdates.clear();
        pendingIdiomUpdates.clear();

        // 4. Обновляем глобальные переменные статистики
        xpData = { xp: 0, level: 1, badges: [] };
        streak = { count: 0, lastDate: null };
        window.dailyProgress = {
          add_new: 0,
          review: 0,
          practice_time: 0,
          completed: false,
          lastReset: new Date().toISOString().split('T')[0],
        };
        window.dailyReviewCount = 0;
        window.lastReviewResetDate = new Date().toISOString().split('T')[0];

        // 5. Обновляем интерфейс
        refreshUI();
        renderIdioms();
        scheduleProfileSave(); // чтобы сохранить изменения на сервере (если что-то пошло не так)

        toast('✅ Весь прогресс успешно сброшен!', 'success');
      } catch (error) {
        console.error('❌ Ошибка при сбросе прогресса:', error);
        toast('Ошибка при сбросе прогресса', 'danger');
      }
    },
  );
});

// Practice session variables

// Добавляем функцию для принудительного сброса сессии (для отладки)

window.resetSession = function () {
  console.log('🔄 Принудительный сброс сессии');

  window.isSessionActive = false;

  sResults = { correct: [], wrong: [] };

  sIdx = 0;

  session = null;

  currentExerciseTimer = null;

  const startBtn = document.getElementById('start-btn');

  if (startBtn) {
    startBtn.disabled = false;

    startBtn.innerHTML =
      '<span class="material-symbols-outlined">rocket_launch</span> Начать';
  }
};

// Глобальные переменныеая для текущего таймера

document.querySelectorAll('.chip[data-count]').forEach(c =>
  c.addEventListener('click', () => {
    document

      .querySelectorAll('.chip[data-count]')

      .forEach(x => x.classList.remove('on'));

    c.classList.add('on');
  }),
);

document.querySelectorAll('.chip[data-filter-w]').forEach(c =>
  c.addEventListener('click', () => {
    document

      .querySelectorAll('.chip[data-filter-w]')

      .forEach(x => x.classList.remove('on'));

    c.classList.add('on');
  }),
);

document.querySelectorAll('.chip[data-autopron]').forEach(c =>
  c.addEventListener('click', () => {
    document

      .querySelectorAll('.chip[data-autopron]')

      .forEach(x => x.classList.remove('on'));

    c.classList.add('on');

    autoPron = c.dataset.autopron === 'on';
  }),
);

document.querySelectorAll('.chip[data-dir]').forEach(b =>
  b.addEventListener('click', () => {
    document

      .querySelectorAll('.chip[data-dir]')

      .forEach(x => x.classList.remove('on'));

    b.classList.add('on');
  }),
);

document.getElementById('start-btn').addEventListener('click', () => {
  console.log('🔘 Start button clicked!');

  // Проверяем, нет ли уже активной сессии

  if (window.isSessionActive) {
    console.log('⚠️ Session already active, ignoring click');

    return;
  }

  console.log('📊 Current practiceMode before start:', practiceMode);

  console.log('📚 window.words.length:', window.words.length);

  // Блокируем кнопку на время выполнения

  const startBtn = document.getElementById('start-btn');

  startBtn.disabled = true;

  startBtn.textContent = 'Запуск...';

  startSession();

  // Разблокируем кнопку через небольшую задержку (на случай ошибок)

  setTimeout(() => {
    // Разблокируем только если нет активной сессии

    if (!window.isSessionActive) {
      startBtn.disabled = false;

      startBtn.innerHTML =
        '<span class="material-symbols-outlined">rocket_launch</span> Начать';
    }
  }, 2000);
});

// Обработчики переключения режимов практики

document.querySelectorAll('.chip[data-mode]').forEach(c =>
  c.addEventListener('click', () => {
    console.log('🔄 Mode chip clicked:', c.dataset.mode);

    document

      .querySelectorAll('.chip[data-mode]')

      .forEach(x => x.classList.remove('on'));

    c.classList.add('on');

    practiceMode = c.dataset.mode;
    console.log('✅ practiceMode updated to:', practiceMode);

    // Управляем отображением блоков в зависимости от режима
    const exerciseGrid = document.querySelector('.exercise-grid');
    const filterRow = document.querySelector('.setup-row:nth-of-type(5)'); // строка с фильтром слов
    const directionRow = document.querySelector('.setup-row:nth-of-type(7)'); // строка с направлением
    const timedRow = document.querySelector('.setup-row:nth-of-type(8)'); // строка с режимом на время

    // Скрываем навсегда строку с таймером
    if (timedRow) timedRow.style.display = 'none';

    if (practiceMode === 'idioms') {
      // Добавляем класс для скрытия направления
      document.body.classList.add('practice-idioms');

      // Заменяем сетку упражнений на сетку для идиом
      exerciseGrid.innerHTML = `
        <div class="exercise-card selected" data-ex="flash">
          <div class="exercise-icon"><span class="material-symbols-outlined">style</span></div>
          <div class="exercise-name">Флеш-карточки</div>
        </div>
        <div class="exercise-card" data-ex="multi" data-field="meaning">
          <div class="exercise-icon"><span class="material-symbols-outlined">translate</span></div>
          <div class="exercise-name">Перевод идиомы</div>
        </div>
        <div class="exercise-card" data-ex="type">
          <div class="exercise-icon"><span class="material-symbols-outlined">keyboard</span></div>
          <div class="exercise-name">Напиши идиому</div>
        </div>
        <div class="exercise-card" data-ex="idiom-builder">
          <div class="exercise-icon"><span class="material-symbols-outlined">construction</span></div>
          <div class="exercise-name">Собери идиому</div>
        </div>
        <div class="exercise-card" data-ex="context" data-field="example">
          <div class="exercise-icon"><span class="material-symbols-outlined">psychology</span></div>
          <div class="exercise-name">Контекст</div>
        </div>
        <div class="exercise-card" data-ex="multi" data-field="definition">
          <div class="exercise-icon"><span class="material-symbols-outlined">menu_book</span></div>
          <div class="exercise-name">Определение</div>
        </div>
        <div class="exercise-card" data-ex="match">
          <div class="exercise-icon"><span class="material-symbols-outlined">extension</span></div>
          <div class="exercise-name">Сопоставь</div>
        </div>
      `;
      // Меняем заголовок фильтра
      const filterLabel = filterRow?.querySelector('label');
      if (filterLabel)
        filterLabel.innerHTML =
          '<span class="material-symbols-outlined" style="vertical-align: middle; margin-right: 8px">filter_alt</span>Идиомы для практики';

      // Обновляем бейдж "К повторению" для идиом
      updateDueBadge();
    } else {
      // Восстанавливаем сетку для слов
      exerciseGrid.innerHTML = `
        <div class="exercise-card selected" data-ex="flash">
          <div class="exercise-icon"><span class="material-symbols-outlined">style</span></div>
          <div class="exercise-name">Флеш-карточки</div>
        </div>
        <div class="exercise-card" data-ex="multi">
          <div class="exercise-icon"><span class="material-symbols-outlined">quiz</span></div>
          <div class="exercise-name">Множественный выбор</div>
        </div>
        <div class="exercise-card" data-ex="type">
          <div class="exercise-icon"><span class="material-symbols-outlined">keyboard</span></div>
          <div class="exercise-name">Напиши перевод</div>
        </div>
        <div class="exercise-card" data-ex="dictation">
          <div class="exercise-icon"><span class="material-symbols-outlined">headphones</span></div>
          <div class="exercise-name">Диктант</div>
        </div>
        <div class="exercise-card" data-ex="speech">
          <div class="exercise-icon"><span class="material-symbols-outlined">record_voice_over</span></div>
          <div class="exercise-name">Произнеси вслух</div>
        </div>
        <div class="exercise-card" data-ex="speech-sentence">
          <div class="exercise-icon"><span class="material-symbols-outlined">record_voice_over</span></div>
          <div class="exercise-name">Слушай и говори</div>
        </div>
        <div class="exercise-card" data-ex="match">
          <div class="exercise-icon"><span class="material-symbols-outlined">extension</span></div>
          <div class="exercise-name">Найди пары</div>
        </div>
        <div class="exercise-card" data-ex="builder">
          <div class="exercise-icon"><span class="material-symbols-outlined">construction</span></div>
          <div class="exercise-name">Собери слово</div>
        </div>
        <div class="exercise-card" data-ex="context">
          <div class="exercise-icon"><span class="material-symbols-outlined">psychology</span></div>
          <div class="exercise-name">Контекстная догадка</div>
        </div>
      `;
      const filterLabel = filterRow?.querySelector('label');
      if (filterLabel)
        filterLabel.innerHTML =
          '<span class="material-symbols-outlined" style="vertical-align: middle; margin-right: 8px">filter_alt</span>Слова для практики';

      // Обновляем бейдж "К повторению" для слов
      updateDueBadge();
    }

    if (practiceMode !== 'idioms') {
      // Убираем класс practice-idioms
      document.body.classList.remove('practice-idioms');
    }

    // Обновляем выделение упражнений согласно сохраненным значениям
    updateExerciseSelection();

    // Управляем классами вместо прямых манипуляций со стилями
    if (practiceMode === 'exam') {
      document.body.classList.add('exam-mode');
    } else {
      document.body.classList.remove('exam-mode');
    }

    // Показываем/скрываем настройки экзамена
    document.getElementById('exam-settings').style.display =
      practiceMode === 'exam' ? 'block' : 'none';

    // Обновляем статистику экзамена при переключении режима
    if (practiceMode === 'exam') {
      updateExamStats();
    }
  }),
);

// Обработчики настроек экзамена

document.querySelectorAll('.chip[data-exam-time]').forEach(c =>
  c.addEventListener('click', () => {
    document

      .querySelectorAll('.chip[data-exam-time]')

      .forEach(x => x.classList.remove('on'));

    c.classList.add('on');

    examTime = parseInt(c.dataset.examTime);

    updateExamStats();
  }),
);

// Добавляем обработчик для изменения количества слов чтобы обновлять статистику экзамена

document.querySelectorAll('.chip[data-count]').forEach(c =>
  c.addEventListener('click', () => {
    // Обновляем статистику если в режиме экзамена

    if (practiceMode === 'exam') {
      setTimeout(updateExamStats, 10); // Небольшая задержка чтобы UI обновился
    }
  }),
);

// Функция обновления статистики экзамена

function updateExamStats() {
  const time = parseInt(
    document.querySelector('.chip[data-exam-time].on').dataset.examTime,
  );

  // Учитываем выбор количества слов

  const countVal =
    document.querySelector('.chip[data-count].on')?.dataset.count || 'all';

  const total =
    countVal === 'all'
      ? window.words.length
      : Math.min(parseInt(countVal), window.words.length);

  const avg = Math.round(time / total);

  const statsEl = document.getElementById('exam-stats');

  if (statsEl) {
    let message = `${total} слов • `;

    if (avg > 60) {
      message += `${avg} сек/слово (медленно)`;

      statsEl.style.color = 'var(--warning)';
    } else if (avg > 45) {
      message += `${avg} сек/слово`;

      statsEl.style.color = 'var(--muted)';
    } else {
      message += `${avg} сек/слово (быстро)`;

      statsEl.style.color = 'var(--success)';
    }

    statsEl.textContent = message;
  }
}

// Функции для управления выбором упражнений
function updateExerciseSelection() {
  const mode = practiceMode; // 'normal' или 'idioms'
  const selectedArray =
    mode === 'idioms' ? selectedIdiomExercises : selectedWordExercises;
  document.querySelectorAll('.exercise-card').forEach(card => {
    const exType = card.dataset.ex;
    if (selectedArray.includes(exType)) {
      card.classList.add('selected');
    } else {
      card.classList.remove('selected');
    }
  });

  // Удаляем старые обработчики и вешаем новые
  document.querySelectorAll('.exercise-card').forEach(card => {
    card.removeEventListener('click', handleExerciseClick);
    card.addEventListener('click', handleExerciseClick);
  });
}

function handleExerciseClick(e) {
  const card = e.currentTarget;
  const exType = card.dataset.ex;
  const mode = practiceMode;
  const selectedArray =
    mode === 'idioms' ? selectedIdiomExercises : selectedWordExercises;

  const index = selectedArray.indexOf(exType);
  if (index === -1) {
    // добавляем
    selectedArray.push(exType);
    card.classList.add('selected');
  } else {
    // убираем
    selectedArray.splice(index, 1);
    card.classList.remove('selected');
  }
}

// Таймер экзамена

function startExamTimer(seconds) {
  if (examTimerInterval) clearInterval(examTimerInterval);

  let headerContainer = document.querySelector('.exercise-header-container');

  const exitBtn = document.getElementById('ex-exit-btn');

  const exWrap = document.querySelector('.ex-wrap');

  if (!headerContainer && exitBtn && exWrap) {
    // Создаём контейнер и перемещаем в него кнопку

    headerContainer = document.createElement('div');

    headerContainer.className = 'exercise-header-container';

    exWrap.insertBefore(headerContainer, exWrap.firstChild);

    headerContainer.appendChild(exitBtn);
  }

  if (!headerContainer) {
    // Если не удалось создать контейнер (например, нет кнопки), выходим

    console.error('Cannot create timer container');

    return;
  }

  // Удаляем старый таймер, если есть

  const oldTimer = document.getElementById('exam-timer');

  if (oldTimer) oldTimer.remove();

  const timerEl = document.createElement('div');

  timerEl.id = 'exam-timer';

  timerEl.className = 'exercise-timer';

  timerEl.innerHTML = `







    <span class="material-symbols-outlined">hourglass_empty</span>







    <span class="timer-text">${formatTime(seconds)}</span>







  `;

  headerContainer.insertBefore(timerEl, headerContainer.firstChild);

  const endTime = Date.now() + seconds * 1000;

  examTimerInterval = setInterval(() => {
    const remaining = Math.max(0, Math.round((endTime - Date.now()) / 1000));

    const timerText = timerEl.querySelector('.timer-text');

    if (timerText) timerText.textContent = formatTime(remaining);

    if (remaining <= 0) {
      clearInterval(examTimerInterval);

      examTimerInterval = null;

      finishExam();
    }
  }, 200);
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);

  const secs = seconds % 60;

  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function finishExam() {
  // Добавить в начало:

  if (window._matchTimerCancel) {
    window._matchTimerCancel();

    window._matchTimerCancel = null;
  }

  // Останавливаем все таймеры

  if (examTimerInterval) clearInterval(examTimerInterval);

  if (currentExerciseTimer) clearInterval(currentExerciseTimer);

  // Удаляем таймер экзамена если есть

  const examTimerEl = document.getElementById('exam-timer');

  if (examTimerEl) {
    examTimerEl.remove();
  }

  // Возвращаем кнопку на место, если она была в контейнере

  const headerContainer = document.querySelector('.exercise-header-container');

  const exitBtn = document.getElementById('ex-exit-btn');

  const exWrap = document.querySelector('.ex-wrap');

  if (headerContainer && exitBtn && exWrap) {
    // Перемещаем кнопку обратно в конец .ex-wrap

    exWrap.appendChild(exitBtn);

    headerContainer.remove();
  }

  // Показываем результаты

  showResults();
}

// Вспомогательная функция для перемешивания массива

function shuffleArray(array) {
  const shuffled = [...array];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

// УДАЛЕНО: updateTodayReviewedCount - заменено на incrementDailyCount

function getCardsToReview(items = null) {
  // All cards that are due (nextReview <= now)
  const sourceItems = items || window.words;

  let dueCards = sourceItems.filter(w => {
    if (!w.stats || !w.stats.nextReview) return false;

    return new Date(w.stats.nextReview) <= new Date();
  });

  // Sort by urgency (oldest/overdue first)

  dueCards.sort(
    (a, b) => new Date(a.stats.nextReview) - new Date(b.stats.nextReview),
  );

  // УДАЛЕНО: Старая логика лимитов - теперь обрабатывается в canStartSession

  // Просто возвращаем все карточки для повтора, лимит проверится в startSession

  return dueCards;
}

function startSession(cfg) {
  console.log('🚀 startSession called with cfg:', cfg);

  // Защита от повторного запуска сессии

  if (window.isSessionActive === true) {
    console.log('⚠️ Session already active, ignoring startSession call');

    return;
  }

  window.isSessionActive = true;

  // Добавляем обработчик ошибок для всей функции

  try {
    console.log('📊 Current practiceMode:', practiceMode);

    console.log('⏱️ examTime:', examTime);

    console.log('📝 examQuestions:', examQuestions);

    // Start tracking practice time

    practiceStartTime = Date.now();

    // Reset postponed toast notification for new session

    window.postponedToastShown = false;

    sResults = { correct: [], wrong: [] };

    sIdx = 0; // Reset index for new session

    window.words.forEach(w => delete w._matched);

    // 1. Общие параметры (количество слов, фильтр)

    let countVal, filterVal;

    if (cfg && cfg.countVal !== undefined) {
      countVal = cfg.countVal;

      filterVal = cfg.filterVal;
    } else {
      countVal =
        document.querySelector('.chip[data-count].on')?.dataset.count || '5';

      filterVal =
        document.querySelector('.chip[data-filter-w].on')?.dataset.filterW ||
        'all';
    }

    // 2. Формируем пул данных (слова или идиомы)

    // Определяем источник данных (слова или идиомы)
    let dataSource = practiceMode === 'idioms' ? window.idioms : window.words;
    let pool = [...dataSource];

    if (practiceMode === 'idioms') {
      // Для идиом используем упрощенную фильтрацию
      if (filterVal === 'learning')
        pool = pool.filter(item => !item.stats?.learned);
      if (filterVal === 'due') {
        pool = getCardsToReview(pool); // передаем массив идиом
      }
    } else {
      // Для слов сохраняем текущую логику
      if (filterVal === 'learning') pool = pool.filter(w => !w.stats.learned);
      if (filterVal === 'due') {
        pool = getCardsToReview(); // Use capped function
      }
    }

    if (filterVal === 'random') pool = pool.sort(() => Math.random() - 0.5);

    if (!pool.length) {
      const itemType = practiceMode === 'idioms' ? 'идиом' : 'слов';
      toast(`Нет ${itemType} для практики`, 'warning');

      // Сбрасываем флаг активной сессии

      window.isSessionActive = false;

      return;
    }

    const totalCount =
      countVal === 'all'
        ? pool.length
        : Math.min(parseInt(countVal), pool.length);

    pool = pool.sort(() => Math.random() - 0.5).slice(0, totalCount);

    // === НОВЫЙ БЛОК: ПРОВЕРКА ЛИМИТА ===

    if (!canStartSession(pool.length)) {
      // Лимит исчерпан – выходим, не запуская сессию

      window.isSessionActive = false;

      const startBtn = document.getElementById('start-btn');

      if (startBtn) {
        startBtn.disabled = false;

        startBtn.innerHTML =
          '<span class="material-symbols-outlined">rocket_launch</span> Начать';
      }

      return;
    }

    // Если запрошенное количество превышает остаток, обрезаем массив

    const limit = getReviewLimit();

    const remaining = limit - window.dailyReviewCount;

    if (pool.length > remaining) {
      pool = pool.slice(0, remaining);
    }

    // ===================================

    // УДАЛЕНО: Дополнительная проверка лимита - теперь обрабатывается в canStartSession выше

    // 3. Определяем режим и создаем сессию

    if (practiceMode === 'exam') {
      console.log('📝 Starting EXAM mode');

      // Экзамен - используем фиксированный набор типов

      const types = ['multi', 'type', 'builder', 'speech'];

      const dirVal =
        document.querySelector('.chip[data-dir].on')?.dataset.dir || 'both';

      // Создаем сессию для экзамена

      session = {
        items: pool, // вместо words

        exTypes: types,

        dir: dirVal,

        mode: 'exam',

        timeLimit: examTime,

        startTime: Date.now(),

        questionsTotal: totalCount,

        questionsAnswered: 0,

        results: { correct: [], wrong: [] },
      };

      console.log('📝 Session created:', session);

      // Запускаем таймер экзамена

      startExamTimer(examTime);

      // Сохраняем конфигурацию экзамена для повторной сессии

      lastSessionConfig = {
        mode: 'exam',

        examTime,

        examQuestions: countVal,

        dirVal,
      };

      // Показываем экран упражнения

      document.getElementById('practice-setup').style.display = 'none';

      document.getElementById('practice-results').style.display = 'none';

      document.getElementById('practice-ex').style.display = 'block';

      console.log('🎬 Showing exercise screen');

      nextExercise();

      return;
    }

    // 4. Обычный режим

    console.log('📚 Starting NORMAL mode');

    // Получаем выбранные типы упражнений

    let exTypes = [...document.querySelectorAll('.exercise-card.selected')].map(
      c => c.dataset.ex,
    );

    if (!exTypes.length) {
      toast('Выбери тип упражнений', 'warning');

      // Сбрасываем флаг активной сессии

      window.isSessionActive = false;

      // Возвращаем кнопку в исходное состояние

      const startBtn = document.getElementById('start-btn');

      if (startBtn) {
        startBtn.disabled = false;

        startBtn.innerHTML =
          '<span class="material-symbols-outlined">rocket_launch</span> Начать';
      }

      return;
    }

    const dirVal =
      document.querySelector('.chip[data-dir].on')?.dataset.dir || 'both';

    // Создаем сессию для обычного режима

    session = {
      items: pool, // вместо words
      exTypes,
      dir: dirVal,
      mode: practiceMode, // 'normal' или 'idioms'
      dataType: practiceMode, // 'words' или 'idioms'
    };

    // Сохраняем конфигурацию для повторной сессии

    lastSessionConfig = { countVal, filterVal, exTypes };

    // Показываем экран упражнения

    document.getElementById('practice-setup').style.display = 'none';

    document.getElementById('practice-results').style.display = 'none';

    document.getElementById('practice-ex').style.display = 'block';

    console.log('🎬 Showing exercise screen');

    nextExercise();
  } catch (error) {
    console.error('❌ Error in startSession:', error);

    // Сбрасываем флаг активной сессии при ошибке

    window.isSessionActive = false;

    // Показываем ошибку пользователю

    toast('Ошибка при запуске сессии', 'danger');

    // Разблокируем кнопку Start

    const startBtn = document.getElementById('start-btn');

    if (startBtn) {
      startBtn.disabled = false;

      startBtn.textContent = 'Начать';
    }
  }
}

function showResults() {
  console.log('📊 showResults вызван, результаты:', sResults);

  // Добавить в начало:

  if (window._matchTimerCancel) {
    window._matchTimerCancel();

    window._matchTimerCancel = null;
  }

  // Сбрасываем флаг активной сессии

  window.isSessionActive = false;

  // Разблокируем кнопку Start

  const startBtn = document.getElementById('start-btn');

  if (startBtn) {
    startBtn.disabled = false;

    startBtn.innerHTML =
      '<span class="material-symbols-outlined">rocket_launch</span> Начать';
  }

  // Показываем экран результатов

  document.getElementById('practice-ex').style.display = 'none';

  document.getElementById('practice-results').style.display = 'block';

  // Сбрасываем display для results-card если он был скрыт

  const resultsCard = document.querySelector('.results-card');

  if (resultsCard) resultsCard.style.display = '';

  const resTotal = sResults.correct.length + sResults.wrong.length;

  const resCorrect = sResults.correct.length;

  const resPct = resTotal > 0 ? Math.round((resCorrect / resTotal) * 100) : 0;

  console.log('📊 Статистика практики:', {
    total: resTotal,

    correct: resCorrect,

    percent: resPct,
  });

  document.getElementById('r-score').textContent = `${resCorrect}/${resTotal}`;

  document.getElementById('r-label').textContent =
    `правильно · ${resPct}% точность`;

  const r = 50;

  const cx = 65;

  const cy = 65;

  const circ = 2 * Math.PI * r;

  document.getElementById('r-ring').innerHTML = `







    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--border)" stroke-width="10"/>







    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--primary)" stroke-width="10"







      stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - resPct / 100)}"







      transform="rotate(-90 ${cx} ${cy})" style="transition:stroke-dashoffset .8s ease"/>







    <text x="${cx}" y="${cy + 7}" text-anchor="middle" font-size="20" font-weight="800" fill="var(--text)">${resPct}%</text>







  `;

  const isIdiom = session && session.dataType === 'idioms';

  document.getElementById('r-correct').innerHTML = sResults.correct
    .map(item => {
      if (isIdiom) {
        return `<li>${esc(item.idiom).toLowerCase()} — ${parseAnswerVariants(item.meaning).join(', ') || esc(item.meaning)}</li>`;
      } else {
        return `<li>${esc(item.en)} — ${parseAnswerVariants(item.ru).join(', ') || esc(item.ru)}</li>`;
      }
    })
    .join('');

  document.getElementById('r-wrong').innerHTML = sResults.wrong
    .map(item => {
      if (isIdiom) {
        return `<li>${esc(item.idiom).toLowerCase()} — ${parseAnswerVariants(item.meaning).join(', ') || esc(item.meaning)}</li>`;
      } else {
        return `<li>${esc(item.en)} — ${parseAnswerVariants(item.ru).join(', ') || esc(item.ru)}</li>`;
      }
    })
    .join('');

  // Запускаем разные анимации в зависимости от процента правильных ответов

  if (resPct === 0) {
    spawnSadRain(); // 0% - Грустный дождь 🌧️
  } else if (resPct <= 20) {
    spawnFewDrops(); // 1-20% - Несколько капель 🌦️
  } else if (resPct <= 50) {
    spawnLightRain(); // 21-50% - Легкий дождик 🌧️
  } else if (resPct <= 80) {
    spawnSmallConfetti(); // 51-80% - Маленький салют 🎆
  } else if (resPct < 100) {
    spawnGoodConfetti(); // 81-99% - Хороший салют 🎇
  } else {
    spawnEpicConfetti(); // 100% - Большой салют + фейерверк 🎊🎆
  }

  // XP

  const xpCorrect = resCorrect;

  const xpTotal = resTotal;

  if (xpCorrect > 0) gainXP(xpCorrect * 3, xpCorrect + ' правильных');

  const isPerfect = xpTotal >= 5 && xpCorrect === xpTotal;

  if (isPerfect)
    gainXP(
      10,

      'идеальная сессия <span class="material-symbols-outlined" style="vertical-align: middle; font-size: 16px;">target</span>',
    );

  updStreak();

  checkBadges(isPerfect);

  // Обновляем время практики в ежедневных целях

  if (practiceStartTime) {
    const practiceMinutes = Math.round(
      (Date.now() - practiceStartTime) / 60000,
    );

    window.dailyProgress.practice_time =
      (window.dailyProgress.practice_time || 0) + practiceMinutes;

    // Mark profile as dirty to ensure practice time progress is saved
    scheduleProfileSave();

    // Обновляем метку времени сразу (оптимистично)

    window.lastProfileUpdate = Date.now();

    checkDailyGoalsCompletion();

    practiceStartTime = null; // Сбрасываем таймер
  }

  // Обновляем интерфейс после всех изменений

  refreshUI();

  // Немедленно сохраняем статистику после завершения практики

  console.log('💾 Вызываем scheduleProfileSave из showResults');

  scheduleProfileSave();

  console.log('✅ showResults завершен');
}

function cleanupExercise() {
  if (currentExerciseTimer) {
    clearInterval(currentExerciseTimer);

    currentExerciseTimer = null;
  }

  if (currentRecognition) {
    try {
      currentRecognition.stop();
    } catch (e) {}

    currentRecognition = null;
  }

  window._matchTimerCancel?.();

  window._matchTimerCancel = null;

  // Убираем DOM-таймер если остался

  document.getElementById('exercise-timer')?.remove();
}

function nextExercise() {
  cleanupExercise(); // ← ДОБАВЬ В САМОЕ НАЧАЛО

  // Защита от многократного вызова

  if (window.nextExerciseRunning) {
    console.log('⚠️ nextExercise уже выполняется, пропускаем вызов');

    return;
  }

  window.nextExerciseRunning = true;

  console.log('➡️ nextExercise called, session:', session);

  console.log(
    '📊 sIdx:',

    sIdx,

    'session.items.length:',

    session?.items?.length,
  );

  try {
    // Проверяем наличие необходимых DOM элементов

    const progFill = document.getElementById('prog-fill');

    const exCounter = document.getElementById('ex-counter');

    const exTypeLbl = document.getElementById('ex-type-lbl');

    const exContent = document.getElementById('ex-content');

    const exBtns = document.getElementById('ex-btns');

    if (!progFill || !exCounter || !exTypeLbl || !exContent || !exBtns) {
      console.error('Required DOM elements not found');

      toast('Ошибка: отсутствуют необходимые элементы', 'error');

      return;
    }

    // Создаём или получаем контейнер заголовка (для кнопки выхода и таймера)

    let headerContainer = document.querySelector('.exercise-header-container');

    if (!headerContainer) {
      headerContainer = document.createElement('div');

      headerContainer.className = 'exercise-header-container';

      const exWrap = document.querySelector('.ex-wrap');

      const exitBtn = document.getElementById('ex-exit-btn');

      if (exitBtn) {
        headerContainer.appendChild(exitBtn);
      }

      exWrap.insertBefore(headerContainer, exWrap.firstChild);
    }

    if (practiceMode === 'exam') {
      const elapsed = (Date.now() - session.startTime) / 1000;

      if (elapsed >= session.timeLimit) {
        finishExam();

        return;
      }
    }

    if (sIdx >= session.items.length) {
      showResults();

      return;
    }

    const w = session.items[sIdx];

    const t =
      session.exTypes[Math.floor(Math.random() * session.exTypes.length)];

    console.log('🎲 Selected exercise type:', t, 'for word:', w.en);

    if (progFill) {
      progFill.style.width =
        Math.round((sIdx / session.items.length) * 100) + '%';
    }

    if (exCounter) {
      exCounter.textContent = `${sIdx + 1} / ${session.items.length}`;
    }

    if (currentExerciseTimer) {
      clearInterval(currentExerciseTimer);

      currentExerciseTimer = null;
    }

    if (t === 'flash') {
      if (exTypeLbl) {
        exTypeLbl.innerHTML =
          '<span class="material-symbols-outlined">style</span> Карточка';
      }

      if (exCounter) {
        exCounter.textContent = `${sIdx + 1} / ${session.items.length}`;
      }

      const isIdiom = session.dataType === 'idioms';

      let frontWord, backWord, showRU;
      if (isIdiom) {
        frontWord = w.idiom.toLowerCase();
        backWord = w.meaning;
        showRU = false; // ← просто фиксируем значение чтобы шаблон не упал
      } else {
        const dir = session.dir || 'both';

        const showRU =
          dir === 'ru-en' || (dir === 'both' && Math.random() > 0.5);

        if (showRU) {
          // RU на лицевой стороне — разбиваем на варианты и соединяем запятой

          const ruVariants = parseAnswerVariants(w.ru);

          frontWord = ruVariants.length ? ruVariants.join(', ') : w.ru;

          backWord = w.en; // английское слово (может быть несколько, но на обороте мы уже обработали)
        } else {
          frontWord = w.en;

          // на обороте русское — тоже разбиваем и соединяем запятой

          const ruVariants = parseAnswerVariants(w.ru);

          backWord = ruVariants.length ? ruVariants.join(', ') : w.ru;
        }
      }

      if (exContent) {
        exContent.innerHTML = `



          <div class="flashcard-scene" id="fc-scene">



            <div class="flashcard-inner" id="fc-inner">



              <div class="card-face front">



                <div style="display:flex;align-items:center;gap:.75rem">



                  <div class="card-word">${esc(frontWord)}</div>



                  ${frontWord === w.en || isIdiom ? `<button class="btn-audio" id="fc-audio-btn" title="Произнести"><span class="material-symbols-outlined">volume_up</span></button>` : ''}



                </div>



                


              </div>



              <div class="card-face back">



                <div style="display:flex;align-items:center;gap:.75rem;justify-content:center">
                  <div class="card-trans">
                    ${(() => {
                      const variants = parseAnswerVariants(backWord);
                      return variants.join(', ') || esc(backWord);
                    })()}
                  </div>
                  ${backWord === w.en || (isIdiom && backWord === w.idiom) ? `<button class="btn-audio" id="fc-audio-btn-back" title="Произнести"><span class="material-symbols-outlined">volume_up</span></button>` : ''}
                </div>

                
              </div>



            </div>



          </div>



        `;
      }

      if (isIdiom) {
        if (autoPron)
          setTimeout(() => {
            if (w.audio) playIdiomAudio(w.audio);
            else speakText(w.idiom);
          }, 300);
      } else {
        // Озвучиваем только когда на рубашке английское слово (frontWord === w.en)
        if (autoPron && frontWord === w.en)
          setTimeout(() => window.speakWord(w), 300);
      }

      // Изначально скрываем кнопки ответа для карточек

      if (exBtns) {
        exBtns.innerHTML = `<div class="flash-hint">Переверни карточку для ответа</div>`;
      }

      // Добавляем обработку аудио кнопки

      if (isIdiom) {
        // для идиом вешаем аудио при перевороте карточки если есть аудио
        const fcAudioBtn = document.getElementById('fc-audio-btn');
        if (fcAudioBtn)
          fcAudioBtn.addEventListener('click', e => {
            e.stopPropagation();
            if (w.audio) playIdiomAudio(w.audio);
            else speakText(w.idiom);
          });

        // для идиом вешаем аудио и на обратной стороне
        const fcAudioBtnBack = document.getElementById('fc-audio-btn-back');
        if (fcAudioBtnBack)
          fcAudioBtnBack.addEventListener('click', e => {
            e.stopPropagation();
            if (w.audio) playIdiomAudio(w.audio);
            else speakText(w.idiom);
          });
      } else {
        if (frontWord === w.en) {
          const fcAudioBtn = document.getElementById('fc-audio-btn');

          if (fcAudioBtn) {
            fcAudioBtn.addEventListener('click', e => {
              e.stopPropagation();

              window.speakWord(w);
            });
          }
        }

        // Добавляем обработку для кнопки на обратной стороне

        if (backWord === w.en) {
          const fcAudioBtnBack = document.getElementById('fc-audio-btn-back');

          if (fcAudioBtnBack) {
            fcAudioBtnBack.addEventListener('click', e => {
              e.stopPropagation();

              window.speakWord(w);
            });
          }
        }
      }

      const fcScene = document.getElementById('fc-scene');

      if (fcScene) {
        let isFlipped = false;

        fcScene.addEventListener('click', e => {
          if (e.target.closest('.btn-audio')) return;

          const fcInner = document.getElementById('fc-inner');

          if (fcInner) {
            fcInner.classList.toggle('flipped');

            isFlipped = !isFlipped;

            // Показываем кнопки ответа только после переворота

            if (isFlipped && exBtns) {
              exBtns.innerHTML = `<button class="btn-icon" id="knew-btn"><span class="material-symbols-outlined">check</span></button><button class="btn-icon" id="didnt-btn"><span class="material-symbols-outlined">close</span></button>`;

              // Автоозвучивание при перевороте на английскую сторону
              if (autoPron && backWord === w.en && !isIdiom) {
                setTimeout(() => window.speakWord(w), 300);
              }
              // Для идиом не озвучиваем при перевороте, т.к. на обороте русский перевод

              const knewBtn = document.getElementById('knew-btn');

              const didntBtn = document.getElementById('didnt-btn');

              if (knewBtn)
                knewBtn.onclick = () => {
                  playSound('correct');
                  recordAnswer(true, t);

                  sIdx++;

                  nextExercise();
                };

              if (didntBtn)
                didntBtn.onclick = () => {
                  playSound('wrong');
                  recordAnswer(false, t);

                  sIdx++;

                  nextExercise();
                };
            }
          }
        });
      }
    } else if (t === 'multi') {
      if (exBtns) exBtns.innerHTML = ''; // Clear buttons from previous exercises

      if (exTypeLbl) {
        exTypeLbl.innerHTML =
          '<span class="material-symbols-outlined">target</span> Выбор ответа';
      }

      if (exCounter) {
        exCounter.textContent = `${sIdx + 1} / ${session.items.length}`;
      }

      const dir = session.dir || 'both';
      const isIdiom = session.dataType === 'idioms';

      // Объявляем field для использования в дистракторах
      const field = isIdiom
        ? document.querySelector('.exercise-card.selected')?.dataset.field ||
          'meaning'
        : null;

      // --- Определяем направление для этого вопроса ---
      // true  = вопрос на русском, ответ на английском (RU→EN)
      // false = вопрос на английском, ответ на русском (EN→RU)
      const isRUEN =
        !isIdiom &&
        (dir === 'ru-en' || (dir === 'both' && Math.random() > 0.5));

      let question, correctFull;

      if (isIdiom) {
        // Для идиом используем поля idiom/meaning или idiom/definition
        if (field === 'definition') {
          // Показываем определение → угадываем идиому
          question = w.definition;
          correctFull = w.idiom.toLowerCase();
        } else {
          // Показываем идиому → угадываем перевод (meaning)
          question = w.idiom.toLowerCase();
          correctFull = w.meaning;
        }
      } else {
        // Для слов используем стандартную логику
        if (isRUEN) {
          // RU → EN: вопрос = русский перевод, правильный ответ = английское слово
          question = parseAnswerVariants(w.ru).join(', ') || w.ru;
          correctFull = w.en;
        } else {
          // EN → RU: вопрос = английское слово, правильный ответ = русский перевод
          question = w.en;
          correctFull = w.ru;
        }
      }

      const correctVariants = parseAnswerVariants(correctFull);
      const correctDisplay =
        correctVariants.length > 0 ? correctVariants.join(', ') : correctFull;

      // --- Отладочное логирование ---
      console.log('🔍 Multi choice debug:', {
        word: w.en,
        isRUEN,
        question,
        correctDisplay,
        correctVariants,
        direction: isRUEN ? 'RU→EN' : 'EN→RU',
      });

      // --- Сбор дистракторов ---
      let dataSource = isIdiom ? window.idioms : window.words;
      let otherWords = dataSource.filter(x => x.id !== w.id);

      let distractorCandidates = otherWords
        .map(x => {
          let trans;
          if (isIdiom) {
            trans = field === 'definition' ? x.idiom.toLowerCase() : x.meaning;
          } else {
            // ⚠️ КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ:
            // для RU→EN берём английские слова других элементов (x.en)
            // для EN→RU берём русские переводы других элементов (x.ru)
            trans = isRUEN ? x.en : x.ru;
          }
          const variants = parseAnswerVariants(trans);
          return { id: x.id, text: variants.length > 0 ? variants[0] : trans };
        })
        .filter(item => item.text && !correctVariants.includes(item.text)); // убираем пустые и все варианты правильного ответа

      // Перемешиваем и берём до 3 дистракторов
      let distractors = distractorCandidates
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);

      // Формируем опции: правильный ответ + дистракторы
      let options = [{ id: w.id, text: correctDisplay }, ...distractors];
      // Для идиом приводим к нижнему регистру
      if (isIdiom) {
        options = options.map(o => ({ ...o, text: o.text.toLowerCase() }));
      }
      // Перемешиваем окончательно
      options = options.sort(() => Math.random() - 0.5);

      // --- Автоозвучка ---
      // Озвучиваем только если вопрос на английском (EN→RU) и не для идиом с определением
      if (autoPron && !isRUEN && !(isIdiom && field === 'definition')) {
        if (isIdiom) {
          setTimeout(() => {
            if (w.audio) playIdiomAudio(w.audio);
            else speakText(w.idiom);
          }, 300);
        } else {
          setTimeout(() => window.speakWord(w), 300);
        }
      }

      if (exContent) {
        exContent.innerHTML = `



          <div class="mc-question">



            ${esc(question)}



            ${!isRUEN ? `<button class="btn-audio" id="mc-audio-btn"><span class="material-symbols-outlined">volume_up</span></button>` : ''}



          </div>



          <div class="mc-grid">



            ${options.map(o => `<button class="mc-btn" data-id="${o.id}">${esc(o.text)}</button>`).join('')}



          </div>



        `;
      }

      if (!isRUEN && !(isIdiom && field === 'definition')) {
        const mcAudioBtn = document.getElementById('mc-audio-btn');

        if (mcAudioBtn) {
          mcAudioBtn.addEventListener('click', e => {
            e.stopPropagation();
            if (isIdiom) {
              if (w.audio) playIdiomAudio(w.audio);
              else speakText(w.idiom);
            } else window.speakWord(w);
          });
        }
      }

      if (exContent) {
        exContent.querySelectorAll('.mc-btn').forEach(b =>
          b.addEventListener('click', () => {
            const ok = b.dataset.id === w.id;

            exContent.querySelectorAll('.mc-btn').forEach(x => {
              x.disabled = true;

              if (x.dataset.id === w.id) x.classList.add('correct');
            });

            if (!ok) {
              b.classList.add('wrong');
              playSound('wrong');
            }

            if (ok) {
              playSound('correct');
              if (isIdiom) {
                if (w.audio) playIdiomAudio(w.audio);
                else speakText(w.idiom);
              } else window.speakWord(w);
            }

            setTimeout(
              () => {
                recordAnswer(ok, t);

                sIdx++;

                nextExercise();
              },

              ok ? 1500 : 2000,
            );
          }),
        );
      }
    } else if (t === 'idiom-builder') {
      runIdiomBuilderExercise(
        w,
        () => {
          sIdx++;
          nextExercise();
        },
        t,
      );
    } else if (t === 'type') {
      if (exBtns) exBtns.innerHTML = ''; // Clear buttons from previous exercises

      if (exTypeLbl) {
        exTypeLbl.innerHTML =
          '<span class="material-symbols-outlined">keyboard</span> Напиши перевод';
      }

      if (exCounter) {
        exCounter.textContent = `${sIdx + 1} / ${session.items.length}`;
      }

      const isIdiom = session.dataType === 'idioms';

      let question, answer;
      let isRUEN = false; // ← добавь эту строку
      if (isIdiom) {
        question = w.meaning; // показываем перевод
        answer = w.idiom.toLowerCase(); // нужно написать идиому
      } else {
        const dir = session.dir || 'both';

        isRUEN = dir === 'ru-en' || (dir === 'both' && Math.random() > 0.5); // ← убери const

        question = isRUEN ? parseAnswerVariants(w.ru).join(', ') || w.ru : w.en;

        answer = isRUEN ? w.en : w.ru;
      }

      // Отключаем автоозвучку в упражнении "Напиши перевод"

      // if (autoPron && !isRUEN && speechSupported)

      //   setTimeout(() => speak(w.en), 300);

      if (exContent) {
        exContent.innerHTML = `



          <div style="display: flex; flex-direction: column; align-items: center; gap: 1.5rem; margin-top: 4rem;">



            <div class="ta-word" style="text-align: center;">



              ${esc(question)}



            </div>



            <input type="text" class="form-control" id="ta-input" placeholder="${isRUEN ? 'Напиши по-английски...' : 'Введи перевод...'}" autocomplete="off" autocorrect="off" spellcheck="false">



            <button class="btn-icon" id="ta-submit"><span class="material-symbols-outlined">check</span></button>



          </div>



          <div class="feedback-panel" id="ta-fb"></div>



        `;
      }

      // Убираем обработчик аудио кнопки - кнопки больше нет

      // if (!isRUEN && speechSupported) {

      //   const taAudioBtn = document.getElementById('ta-audio-btn');

      //   if (taAudioBtn) {

      //     taAudioBtn.addEventListener('click', e => {

      //       e.stopPropagation();

      //       speakBtn(w.en, e.currentTarget);

      //     });

      //   }

      // }

      const input = document.getElementById('ta-input');

      const submit = document.getElementById('ta-submit');

      const fb = document.getElementById('ta-fb');

      if (input) {
        input.focus();

        if (submit) {
          const checkAnswer = () => {
            const userAnswer = input.value.trim().toLowerCase();
            const normalizedUserAnswer = normalizeRussian(userAnswer);

            const isCorrect = isIdiom
              ? checkAnswerWithNormalization(
                  normalizedUserAnswer,
                  answer.toLowerCase(),
                ) ||
                levenshteinDistance(
                  normalizedUserAnswer,
                  answer.toLowerCase(),
                ) <= 2
              : parseAnswerVariants(answer).some(v =>
                  checkAnswerWithNormalization(
                    normalizedUserAnswer,
                    v.toLowerCase(),
                  ),
                );

            if (input) input.disabled = true;

            if (submit) submit.disabled = true;

            if (fb) {
              if (isCorrect) {
                fb.classList.remove('correct', 'incorrect', 'warning');
                fb.classList.add('correct');
                fb.style.display = 'flex';

                fb.innerHTML = getFeedbackHTML(w, isCorrect);

                if (isIdiom) {
                  if (w.audio) playIdiomAudio(w.audio);
                  else speakText(w.idiom);
                } else window.speakWord(w);

                playSound('correct');

                setTimeout(() => {
                  recordAnswer(true, t);

                  sIdx++;

                  nextExercise();
                }, 1500);
              } else {
                fb.classList.remove('correct', 'incorrect', 'warning');
                fb.classList.add('incorrect');
                fb.style.display = 'flex';

                playSound('wrong');

                fb.innerHTML = getFeedbackHTML(w, isCorrect);

                setTimeout(() => {
                  recordAnswer(false, t);

                  sIdx++;

                  nextExercise();
                }, 2000);
              }
            }
          };

          submit.addEventListener('click', checkAnswer);

          input.addEventListener('keydown', e => {
            if (e.key === 'Enter') checkAnswer();
          });
        }
      }
    } else if (t === 'dictation') {
      if (exTypeLbl) {
        exTypeLbl.innerHTML =
          '<span class="material-symbols-outlined">hearing</span> Диктант';
      }

      if (exCounter) {
        exCounter.textContent = `${sIdx + 1} / ${session.items.length}`;
      }

      if (exContent) {
        exContent.innerHTML = `



          <div style="display: flex; flex-direction: column; align-items: center; gap: 1.5rem; margin-top: 4rem;">



            <button class="btn-icon btn-secondary" id="dict-replay"><span class="material-symbols-outlined">volume_up</span></button>



            <input type="text" id="dict-input" placeholder="Напиши слово по-английски..." autocomplete="off" autocorrect="off" spellcheck="false">



            <button class="btn-icon" id="dict-submit"><span class="material-symbols-outlined">check</span></button>



          </div>



          <div class="feedback-panel" id="dict-fb"></div>



        `;
      }

      setTimeout(() => window.speakWord(w), 200);

      const dictInput = document.getElementById('dict-input');

      const dictSubmit = document.getElementById('dict-submit');

      const dictFb = document.getElementById('dict-fb');

      const dictReplay = document.getElementById('dict-replay');

      if (dictReplay) {
        dictReplay.onclick = () => window.speakWord(w);
      }

      if (dictInput) {
        dictInput.focus();

        if (dictSubmit && dictFb) {
          const check = () => {
            const val = dictInput.value.trim().toLowerCase();
            const normalizedVal = normalizeRussian(val);

            const answerVariants = parseAnswerVariants(w.en);

            const ok = answerVariants.some(v =>
              checkAnswerWithNormalization(normalizedVal, v.toLowerCase()),
            );

            dictFb.classList.remove('correct', 'incorrect', 'warning');
            dictFb.classList.add(ok ? 'correct' : 'incorrect');
            dictFb.style.display = 'flex';

            dictFb.innerHTML = getFeedbackHTML(w, ok);

            if (dictInput) dictInput.disabled = true;

            if (dictSubmit) dictSubmit.disabled = true;

            setTimeout(() => {
              recordAnswer(ok, t);

              sIdx++;

              nextExercise();
            }, 1400);
          };

          dictSubmit.addEventListener('click', check);

          dictInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') check();
          });
        }
      }
    } else if (t === 'builder') {
      if (exBtns) exBtns.innerHTML = ''; // Clear buttons from previous exercises

      if (exTypeLbl) {
        exTypeLbl.innerHTML =
          '<span class="material-symbols-outlined">construction</span> Собери слово';
      }

      if (exCounter) {
        exCounter.textContent = `${sIdx + 1} / ${session.items.length}`;
      }

      const word = w.en.toLowerCase().replace(/[^a-z]/g, ''); // только буквы

      const letters = word.split('');

      const shuffled = [...letters].sort(() => Math.random() - 0.5);

      if (exContent) {
        exContent.innerHTML = `







          <div class="builder-card">







            <div class="builder-question">${parseAnswerVariants(w.ru).join(', ') || esc(w.ru)}</div>







            <div class="builder-answer" id="builder-answer"></div>







            <div class="builder-letters-container">
              <div class="builder-letters" id="builder-letters"></div>
              <div class="feedback-panel" id="builder-fb" style="display: none;"></div>
            </div>







            <div class="builder-hint"></div>







          </div>







          <div class="builder-controls">







            <button class="btn-icon" id="builder-hint-btn"><span class="material-symbols-outlined">lightbulb</span></button>







            <button class="btn-icon" id="builder-reset-btn"><span class="material-symbols-outlined">refresh</span></button>







          </div>














        `;
      }

      // Создаем кнопки для букв
      let builderProcessing = false;

      const lettersContainer = document.getElementById('builder-letters');

      const answerContainer = document.getElementById('builder-answer');

      // Создаем пустые ячейки-заглушки по количеству букв

      answerContainer.innerHTML = '';

      for (let i = 0; i < word.length; i++) {
        const placeholder = document.createElement('span');

        placeholder.className = 'builder-answer-letter placeholder';

        placeholder.textContent = '';

        placeholder.dataset.index = i;

        answerContainer.appendChild(placeholder);
      }

      shuffled.forEach((letter, index) => {
        const letterBtn = document.createElement('button');

        letterBtn.className = 'builder-letter';

        letterBtn.textContent = letter.toUpperCase();

        letterBtn.dataset.letter = letter;

        letterBtn.dataset.index = index;

        letterBtn.addEventListener('click', () => {
          if (builderProcessing) return;
          builderProcessing = true;

          // Проверяем, что кнопка еще не нажата (видима)
          if (letterBtn.style.visibility === 'hidden') {
            builderProcessing = false;
            return; // Если уже скрыта, игнорируем клик
          }

          // Находим первую пустую заглушку

          const firstPlaceholder = answerContainer.querySelector(
            '.builder-answer-letter.placeholder',
          );

          if (!firstPlaceholder) return; // Нет свободных мест

          // Заменяем заглушку на букву

          firstPlaceholder.classList.remove('placeholder');

          firstPlaceholder.textContent = letter.toUpperCase();

          firstPlaceholder.style.cursor = 'pointer';

          firstPlaceholder.style.transition = 'all 0.2s ease';

          firstPlaceholder.title = 'Нажмите, чтобы убрать букву';

          firstPlaceholder.dataset.originalIndex = index;

          firstPlaceholder.dataset.letter = letter.toLowerCase();

          // Добавляем обработчик клика для удаления буквы

          firstPlaceholder.addEventListener('click', () => {
            if (builderProcessing) return;
            builderProcessing = true;

            const originalIndex = firstPlaceholder.dataset.originalIndex;
            if (originalIndex !== undefined) {
              const allLetterBtns =
                document.querySelectorAll('.builder-letter');
              const targetBtn = Array.from(allLetterBtns).find(
                btn => btn.dataset.index === originalIndex,
              );
              if (targetBtn) {
                targetBtn.style.visibility = 'visible';
              }
            }

            // Возвращаем ячейку в состояние заглушки
            firstPlaceholder.classList.add('placeholder');
            firstPlaceholder.textContent = '';
            firstPlaceholder.style.cursor = 'default';
            firstPlaceholder.title = '';
            delete firstPlaceholder.dataset.originalIndex;
            delete firstPlaceholder.dataset.letter;

            // Скрываем фидбек если был
            const fb = document.getElementById('builder-fb');
            if (fb) {
              fb.style.display = 'none';
              fb.textContent = '';
              fb.classList.remove('correct', 'incorrect', 'warning');
              fb.style.display = 'none';
              fb.textContent = '';
            }

            // Проверяем ответ
            checkBuilderAnswer();

            setTimeout(() => {
              builderProcessing = false;
            }, 100);
          });

          // Hover эффект

          firstPlaceholder.addEventListener('mouseenter', () => {
            firstPlaceholder.style.background = 'var(--border)';

            firstPlaceholder.style.borderRadius = '4px';
          });

          firstPlaceholder.addEventListener('mouseleave', () => {
            firstPlaceholder.style.background = 'transparent';
          });

          letterBtn.style.visibility = 'hidden';

          // Проверяем ответ
          checkBuilderAnswer();

          setTimeout(() => {
            builderProcessing = false;
          }, 100);
        });

        lettersContainer.appendChild(letterBtn);
      });

      // Очистка ответа теперь через клик по буквам в ответе

      // Подсказка

      document

        .getElementById('builder-hint-btn')

        .addEventListener('click', () => {
          const currentAnswer = answerContainer.textContent.toLowerCase();

          // Проверяем есть ли ошибки в уже набранных буквах

          let hasError = false;

          for (
            let i = 0;
            i < Math.min(currentAnswer.length, word.length);
            i++
          ) {
            if (currentAnswer[i] !== word[i]) {
              hasError = true;

              break;
            }
          }

          // Если есть ошибка или ответ уже полный, подсказка не нужна

          if (hasError || currentAnswer.length >= word.length) return;

          // Показываем следующую правильную букву

          const nextLetter = word[currentAnswer.length];

          // Находим кнопку с нужной буквой

          const targetBtn = Array.from(
            document.querySelectorAll('.builder-letter'),
          ).find(
            btn =>
              btn.dataset.letter === nextLetter &&
              btn.style.visibility !== 'hidden',
          );

          if (targetBtn) {
            targetBtn.classList.add('builder-hint-pulse');

            setTimeout(() => {
              targetBtn.classList.remove('builder-hint-pulse');
            }, 2000);
          }
        });

      // Обработчик кнопки сброса
      document
        .getElementById('builder-reset-btn')
        .addEventListener('click', () => {
          // Очищаем ответ
          answerContainer.innerHTML = '';
          for (let i = 0; i < word.length; i++) {
            const placeholder = document.createElement('span');
            placeholder.className = 'builder-answer-letter placeholder';
            placeholder.dataset.index = i;
            answerContainer.appendChild(placeholder);
          }

          // Восстанавливаем все кнопки букв
          document.querySelectorAll('.builder-letter').forEach(btn => {
            btn.disabled = false;
            btn.style.visibility = 'visible';
            btn.classList.remove('builder-hint-pulse'); // убираем подсветку
          });

          // Скрываем фидбек
          const fb = document.getElementById('builder-fb');
          if (fb) {
            fb.style.display = 'none';
            fb.textContent = '';
            fb.classList.remove('correct', 'incorrect', 'warning');
          }

          // Показываем контейнер с буквами (на случай если он был скрыт после правильного ответа)
          document.getElementById('builder-letters').style.display = 'flex';
        });

      function checkBuilderAnswer() {
        const currentAnswer = answerContainer.textContent.toLowerCase();
        const fb = document.getElementById('builder-fb');
        const lettersContainer = document.getElementById('builder-letters');

        if (currentAnswer === word) {
          // Скрываем буквы и показываем фидбек
          lettersContainer.style.display = 'none';
          fb.style.display = 'block';
          fb.classList.remove('correct', 'incorrect', 'warning');
          fb.classList.add('correct');
          fb.style.display = 'block';
          fb.innerHTML = getFeedbackHTML(w, true);

          // Озвучиваем слово после правильного ответа
          window.speakWord(w);

          playSound('correct');

          document.querySelectorAll('.builder-letter').forEach(btn => {
            btn.disabled = true;
          });

          setTimeout(() => {
            recordAnswer(true, t);
            sIdx++;
            nextExercise();
          }, 2000);
        } else if (currentAnswer.length >= word.length) {
          // Скрываем буквы и показываем фидбек
          lettersContainer.style.display = 'none';
          fb.style.display = 'block';
          fb.classList.remove('correct', 'incorrect', 'warning');
          fb.classList.add('incorrect');
          fb.style.display = 'block';
          fb.innerHTML = `<span class="material-symbols-outlined">refresh</span><span>Попробуйте ещё раз!</span>`;

          playSound('wrong');
        } else {
          // Показываем буквы и скрываем фидбек при неполном ответе
          lettersContainer.style.display = 'flex';
          fb.style.display = 'none';
          fb.textContent = '';
          fb.classList.remove('correct', 'incorrect', 'warning');
          fb.style.display = 'none';
          fb.textContent = '';
        }
      }
    } else if (t === 'speech') {
      if (exTypeLbl) {
        exTypeLbl.innerHTML =
          '<span class="material-symbols-outlined">record_voice_over</span> Произнеси';
      }

      if (exCounter) {
        exCounter.textContent = `${sIdx + 1} / ${session.items.length}`;
      }

      const promptWord = w.en;

      const expectedWord = w.en;

      if (exContent) {
        exContent.innerHTML = `

          <div class="speech-exercise">

            <div class="speech-prompt">

              <div class="speech-word-container">

                <div class="speech-word">${esc(promptWord)}</div>

                <button class="btn-icon btn-small" id="speech-replay-btn" title="Прослушать слово">

                  <span class="material-symbols-outlined">volume_up</span>

                </button>

              </div>

              <div class="speech-translation" id="speech-translation" style="margin-top: 0.5rem; opacity: 0.7;">

                ${esc(w.ru)}

              </div>

              <div class="speech-hint"></div>

            </div>

            <div class="speech-controls">

              <button class="btn-icon" id="speech-start-btn">

                <span class="material-symbols-outlined">mic</span>

              </button>

              <div class="recording-indicator" id="recording-indicator" style="display: none;">

                <span class="material-symbols-outlined">graphic_eq</span> Говорите...

              </div>

            </div>

            <div class="feedback-panel" id="speech-feedback" style="display: none;"></div>

          </div>

        `;
      }

      const replayBtn = document.getElementById('speech-replay-btn');

      const startBtn = document.getElementById('speech-start-btn');

      const indicator = document.getElementById('recording-indicator');

      const feedback = document.getElementById('speech-feedback');

      // Автоматическая озвучка

      setTimeout(() => {
        window.speakWord(w);
      }, 500);

      if (replayBtn) {
        replayBtn.addEventListener('click', () => {
          window.speakWord(w);
        });
      }

      if (!speechRecognitionSupported) {
        feedback.style.display = 'block';

        feedback.classList.remove('correct', 'incorrect', 'warning');
        feedback.classList.add('warning');
        feedback.style.display = 'block';

        feedback.innerHTML =
          '<span class="material-symbols-outlined">warning</span><span>Распознавание речи не поддерживается вашим браузером.</span>';

        if (startBtn) startBtn.disabled = true;
      }

      startBtn?.addEventListener('click', () => {
        // Скрываем старый фидбек
        if (feedback) {
          feedback.style.display = 'none';
          feedback.innerHTML = '';
          feedback.classList.remove('correct', 'incorrect', 'warning');
        }

        // Если предыдущее распознавание ещё активно – прерываем

        if (currentRecognition) {
          try {
            currentRecognition.abort();
          } catch (e) {}

          currentRecognition = null;
        }

        const SpeechRec =
          window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRec) return;

        const rec = new SpeechRec();

        rec.lang = 'en-US';

        rec.continuous = false;

        rec.interimResults = false;

        rec.maxAlternatives = 3; // больше вариантов – лучше на мобильных

        currentRecognition = rec;

        let recognitionActive = false;

        const timeoutId = setTimeout(() => {
          if (recognitionActive) {
            try {
              rec.abort();
            } catch (e) {}

            recognitionActive = false;
          }
        }, CONSTANTS.SPEECH.RECOGNITION_TIMEOUT); // используем константу (5000 мс)

        rec.onstart = () => {
          recognitionActive = true;

          indicator.style.display = 'flex';

          startBtn.style.display = 'none';

          // Полностью скрываем и сбрасываем фидбек
          feedback.style.display = 'none';
          feedback.classList.remove('correct', 'incorrect', 'warning');
          feedback.textContent = '';
        };

        rec.onresult = event => {
          clearTimeout(timeoutId);

          recognitionActive = false;

          indicator.style.display = 'none';

          startBtn.style.display = 'flex';

          const spoken = event.results[0][0].transcript.trim().toLowerCase();

          const correct = expectedWord.toLowerCase();

          const result = checkSpeechSimilarity(spoken, correct);

          if (result.isCorrect) {
            feedback.classList.remove('correct', 'incorrect', 'warning');
            feedback.classList.add('correct');
            feedback.innerHTML = getFeedbackHTML(
              w,
              result.isCorrect,
              result.confidence,
            );
            feedback.style.display = 'flex';
            playSound('correct');

            // Блокируем кнопки на время показа фидбека
            startBtn.disabled = true;
            if (replayBtn) replayBtn.disabled = true;

            setTimeout(() => {
              recordAnswer(true, t);
              sIdx++;
              nextExercise();
            }, 1500);
          } else {
            feedback.classList.remove('correct', 'incorrect', 'warning');
            feedback.classList.add('incorrect');
            feedback.innerHTML = getFeedbackHTML(
              w,
              result.isCorrect,
              result.confidence,
            );
            feedback.style.display = 'flex';

            playSound('wrong');
            // Кнопки остаются активными – можно попробовать снова
          }

          currentRecognition = null;
        };

        rec.onerror = e => {
          clearTimeout(timeoutId);

          recognitionActive = false;

          indicator.style.display = 'none';

          startBtn.style.display = 'flex';

          let errorMessage = 'Ошибка распознавания.';

          if (e.error === 'not-allowed')
            errorMessage = 'Доступ к микрофону заблокирован.';
          else if (e.error === 'no-speech')
            errorMessage = 'Речь не распознана. Попробуйте ещё раз.';
          else if (e.error === 'audio-capture')
            errorMessage = 'Ошибка микрофона.';
          else if (e.error === 'network') errorMessage = 'Ошибка сети.';
          else if (e.error === 'aborted')
            errorMessage = 'Превышено время ожидания. Попробуйте ещё раз.';

          feedback.classList.remove('correct', 'incorrect', 'warning');
          feedback.classList.add('warning');

          feedback.innerHTML = `<span class="material-symbols-outlined">warning</span><span>${errorMessage}</span>`;

          currentRecognition = null;
        };

        rec.onend = () => {
          clearTimeout(timeoutId);

          if (recognitionActive) {
            // Не было результата, но и не ошибка – возможно, тишина

            indicator.style.display = 'none';

            startBtn.style.display = 'flex';

            feedback.classList.remove('correct', 'incorrect', 'warning');
            feedback.classList.add('warning');
            feedback.style.display = 'block';

            feedback.innerHTML =
              '<span class="material-symbols-outlined">warning</span><span>Не удалось распознать речь. Попробуйте ещё раз.</span>';

            recognitionActive = false;
          }

          currentRecognition = null;
        };

        try {
          rec.start();
        } catch (err) {
          console.error('SpeechRecognition start failed:', err);

          feedback.classList.remove('correct', 'incorrect', 'warning');
          feedback.classList.add('warning');
          feedback.style.display = 'block';

          feedback.innerHTML =
            '<span class="material-symbols-outlined">warning</span><span>Не удалось запустить распознавание.</span>';

          indicator.style.display = 'none';

          startBtn.style.display = 'flex';

          currentRecognition = null;
        }
      });

      // Кнопка пропуска

      if (exBtns) {
        exBtns.innerHTML = `<button class="btn-icon" id="speech-skip"><span class="material-symbols-outlined">skip_next</span></button>`;

        document

          .getElementById('speech-skip')

          ?.addEventListener('click', () => {
            if (currentRecognition) {
              try {
                currentRecognition.abort();
              } catch (e) {}

              currentRecognition = null;
            }

            indicator.style.display = 'none';

            startBtn.style.display = 'flex';

            recordAnswer(false, t);

            sIdx++;

            nextExercise();
          });
      }
    } else if (t === 'match') {
      try {
        if (session.dataType === 'idioms') {
          runIdiomMatchExercise(
            session.items.slice(sIdx, sIdx + 6),
            elapsed => {
              sIdx++;
              nextExercise();
            },
            t,
          );
        } else {
          runMatchExercise(
            session.items.slice(sIdx, sIdx + 6),
            elapsed => {
              sIdx++;
              nextExercise();
            },
            t,
          );
        }
      } catch (error) {
        console.error('Error in match exercise:', error);
        sIdx++;
        nextExercise();
      }
    } else if (t === 'context') {
      try {
        runContextExercise(
          w,
          () => {
            sIdx++;
            nextExercise();
          },
          t,
        );
      } catch (error) {
        console.error('Error in context exercise:', error);

        sIdx++;

        nextExercise();
      }
    } else if (t === 'speech-sentence') {
      try {
        runSpeechSentenceExercise(
          w,
          () => {
            sIdx++;

            nextExercise();
          },
          t,
        );
      } catch (error) {
        console.error('Error in speech-sentence exercise:', error);

        sIdx++;

        nextExercise();
      }
    }
  } catch (error) {
    console.error('Error in nextExercise:', error);

    toast('Ошибка при загрузке упражнения', 'error');

    // Пробуем перейти к следующему упражнению

    sIdx++;
  } finally {
    // Всегда сбрасываем флаг

    window.nextExerciseRunning = false;
  }
}

function updIdiomStats(id, correct, exerciseType) {
  const i = window.idioms.find(i => i.id === id);
  if (!i) return;

  if (!i.stats) {
    i.stats = {
      shown: 0,
      learned: false,
      correct: 0,
      wrong: 0,
      streak: 0,
      lastReview: null,
      nextReview: null,
      interval: 1,
      easeFactor: 2.5,
      correctExerciseTypes: [], // добавим на всякий случай
    };
  }

  i.stats.shown = (i.stats.shown || 0) + 1;
  i.stats.lastReview = new Date().toISOString();
  i.stats[correct ? 'correct' : 'wrong']++;

  if (correct) {
    i.stats.streak++;
    i.stats.easeFactor = Math.max(
      1.3,
      Math.min(2.5, i.stats.easeFactor + 0.05),
    );

    if (!i.stats.correctExerciseTypes.includes(exerciseType)) {
      i.stats.correctExerciseTypes.push(exerciseType);
    }

    if (i.stats.interval <= 1) {
      i.stats.interval = 3;
    } else if (i.stats.interval <= 3) {
      i.stats.interval = 7;
    } else if (i.stats.interval <= 7) {
      i.stats.interval = 14;
    } else if (i.stats.interval <= 14) {
      i.stats.interval = 30;
    } else if (i.stats.interval <= 30) {
      i.stats.interval = 60;
    } else {
      // Максимальный интервал - 180 дней (6 месяцев)
      i.stats.interval = Math.min(180, Math.round(i.stats.interval * 1.2));
    }
  } else {
    i.stats.streak = 0;
    i.stats.interval = 1;
    i.stats.easeFactor = Math.max(1.3, i.stats.easeFactor - 0.2);
    // Массив не трогаем
  }

  const next = new Date();
  next.setDate(next.getDate() + i.stats.interval);
  i.stats.nextReview = next.toISOString();

  const wasLearned = i.stats.learned;
  i.stats.learned =
    i.stats.correctExerciseTypes.includes('legacy') ||
    i.stats.correctExerciseTypes.length >= 3;

  if (!wasLearned && i.stats.learned) {
    gainXP(
      20,
      'идиома выучена <span class="material-symbols-outlined" style="vertical-align: middle; font-size: 16px;">star</span>',
    );
    autoCheckBadges(); // Автоматическая проверка бейджей
  }

  // Save idioms to localStorage
  localStorage.setItem('englift_idioms', JSON.stringify(window.idioms));

  // Update due badge
  updateDueBadge();

  // Mark idiom for synchronization with server
  markIdiomDirty(id);
}

function recordAnswer(correct, exerciseType) {
  // Увеличиваем дневной счётчик

  incrementDailyCount();

  // Останавливаем и удаляем таймер если он есть

  if (currentExerciseTimer) {
    clearInterval(currentExerciseTimer);

    currentExerciseTimer = null;
  }

  // Используем сохраненный таймер из session для надежности

  const timerEl =
    session.currentTimerEl || document.getElementById('exercise-timer');

  if (timerEl) {
    timerEl.remove();

    session.currentTimerEl = null; // Очищаем ссылку
  }

  // Звук больше не нужен в recordAnswer - все звуки играют напрямую в упражнениях

  // Используем соответствующую функцию статистики
  if (session.dataType === 'idioms') {
    updIdiomStats(session.items[sIdx].id, correct, exerciseType);
  } else {
    updStats(session.items[sIdx].id, correct, exerciseType);
  }

  updStreak();

  // В режиме экзамена подсчитываем отвеченные вопросы

  if (practiceMode === 'exam') {
    session.questionsAnswered++;

    if (correct) {
      session.results.correct.push(session.items[sIdx]);
    } else {
      session.results.wrong.push(session.items[sIdx]);
    }

    // Проверяем, отвечены ли все вопросы

    if (session.questionsAnswered >= session.questionsTotal) {
      // Все вопросы отвечены — завершаем экзамен

      finishExam();

      return;
    }

    sIdx++;

    nextExercise();

    return; // Важно: выходим чтобы не продолжать обычную логику
  }

  // Обычный режим - существующая логика

  if (correct) sResults.correct.push(session.items[sIdx]);
  else sResults.wrong.push(session.items[sIdx]);

  // Обновляем прогресс ежедневных целей для правильных ответов

  // Увеличиваем счётчик упражнений за день (для всех ответов, не только правильных)

  // incrementDailyCount() уже вызывается в начале функции

  if (correct) {
    resetDailyGoalsIfNeeded(); // Ensure proper daily reset

    window.dailyProgress.review = (window.dailyProgress.review || 0) + 1;

    // Mark profile as dirty to ensure progress is saved
    scheduleProfileSave();

    // Update UI to show progress immediately
    refreshUI();

    // Обновляем метку времени сразу (оптимистично)

    window.lastProfileUpdate = Date.now();

    checkDailyGoalsCompletion();

    // Бонусные XP за быстрые ответы в режиме на время (только для упражнений с таймером)

    if (session.timed && timerEl) {
      const timerText = timerEl.querySelector('.timer-text');

      const timeRemaining = parseInt(timerText?.textContent || '0');

      if (timeRemaining >= 7) {
        // Бонус за очень быстрый ответ (>=7 секунд осталось)

        gainXP(
          5,

          'быстрый ответ <span class="material-symbols-outlined" style="vertical-align: middle; font-size: 16px;">bolt</span>',
        );
      } else if (timeRemaining >= 4) {
        // Маленький бонус за быстрый ответ (>=4 секунды осталось)

        gainXP(
          2,

          'хороший темп <span class="material-symbols-outlined" style="vertical-align: middle; font-size: 16px;">directions_run</span>',
        );
      }
    }
  }

  // Статистика сохранится в конце сессии через showResults()

  // НЕ переходим автоматически к следующему упражнению - ждем ответа пользователя

  // sIdx++;

  // nextExercise();
}

function finishExam() {
  // Останавливаем все активные таймеры

  if (examTimerInterval) {
    clearInterval(examTimerInterval);

    examTimerInterval = null;
  }

  if (currentExerciseTimer) {
    clearInterval(currentExerciseTimer);

    currentExerciseTimer = null;
  }

  // Удаляем элементы таймеров

  const timerEl = document.getElementById('exercise-timer');

  if (timerEl) timerEl.remove();

  const examTimerEl = document.getElementById('exam-timer');

  if (examTimerEl) examTimerEl.remove();

  // Копируем результаты экзамена в глобальную переменную для отображения

  sResults = session.results;

  // Показываем результаты

  showResults();
}

document.getElementById('repeat-btn').addEventListener('click', () => {
  document.getElementById('practice-results').style.display = 'none';

  startSession(lastSessionConfig);
});

document.getElementById('setup-btn').addEventListener('click', () => {
  document.getElementById('practice-results').style.display = 'none';

  document.getElementById('practice-setup').style.display = 'block';
});

// ============================================================

// CONFETTI ANIMATIONS

// ============================================================

// 0% - Грустный дождь (полный провал)

function spawnSadRain() {
  document.querySelectorAll('.sad-drop').forEach(p => p.remove());

  for (let i = 0; i < 30; i++) {
    const p = document.createElement('div');

    const s = 4 + Math.random() * 6;

    p.className = 'sad-drop';

    p.style.cssText = `







      left:${Math.random() * 100}vw;







      top:-20px;







      width:${s}px;







      height:${s * 2}px;







      background:linear-gradient(to bottom, #94a3b8, #64748b);







      border-radius:50% 50% 50% 50% / 60% 60% 40% 40%;







      animation-duration:${3 + Math.random() * 2}s;







      animation-delay:${Math.random() * 1}s;







      opacity: 0.6;







    `;

    document.body.appendChild(p);

    setTimeout(() => p.remove(), 5000);
  }
}

// 1-20% - Несколько капель (почти провал)

function spawnFewDrops() {
  document.querySelectorAll('.sad-drop').forEach(p => p.remove());

  for (let i = 0; i < 10; i++) {
    const p = document.createElement('div');

    const s = 3 + Math.random() * 4;

    p.className = 'sad-drop';

    p.style.cssText = `







      left:${Math.random() * 100}vw;







      top:-20px;







      width:${s}px;







      height:${s * 2}px;







      background:linear-gradient(to bottom, #cbd5e1, #94a3b8);







      border-radius:50% 50% 50% 50% / 60% 60% 40% 40%;







      animation-duration:${4 + Math.random() * 1}s;







      animation-delay:${Math.random() * 0.5}s;







      opacity: 0.5;







    `;

    document.body.appendChild(p);

    setTimeout(() => p.remove(), 5000);
  }
}

// 21-50% - Легкий дождик (посредственно)

function spawnLightRain() {
  document.querySelectorAll('.sad-drop').forEach(p => p.remove());

  for (let i = 0; i < 20; i++) {
    const p = document.createElement('div');

    const s = 3 + Math.random() * 5;

    p.className = 'sad-drop';

    p.style.cssText = `







      left:${Math.random() * 100}vw;







      top:-20px;







      width:${s}px;







      height:${s * 2}px;







      background:linear-gradient(to bottom, #94a3b8, #64748b);







      border-radius:50% 50% 50% 50% / 60% 60% 40% 40%;







      animation-duration:${3.5 + Math.random() * 1.5}s;







      animation-delay:${Math.random() * 0.8}s;







      opacity: 0.7;







    `;

    document.body.appendChild(p);

    setTimeout(() => p.remove(), 5000);
  }
}

// 51-80% - Маленький салют (неплохо)

function spawnSmallConfetti() {
  document.querySelectorAll('.confetti-piece').forEach(p => p.remove());

  const colors = ['#6C63FF', '#22C55E', '#F59E0B'];

  for (let i = 0; i < 40; i++) {
    const p = document.createElement('div');

    const s = 5 + Math.random() * 8;

    p.className = 'confetti-piece';

    p.style.cssText = `







      left:${Math.random() * 100}vw;







      top:-20px;







      width:${s}px;







      height:${s}px;







      background:${colors[Math.floor(Math.random() * colors.length)]};







      border-radius:${Math.random() > 0.5 ? '50%' : '3px'};







      animation-duration:${2 + Math.random() * 1.5}s;







      animation-delay:${Math.random() * 0.6}s;







      opacity: 0.8;







    `;

    document.body.appendChild(p);

    setTimeout(() => p.remove(), 3500);
  }
}

// 81-99% - Хороший салют (отлично)

function spawnGoodConfetti() {
  document.querySelectorAll('.confetti-piece').forEach(p => p.remove());

  const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1'];

  for (let i = 0; i < 70; i++) {
    const p = document.createElement('div');

    const s = 6 + Math.random() * 10;

    p.className = 'confetti-piece';

    p.style.cssText = `







      left:${Math.random() * 100}vw;







      top:-20px;







      width:${s}px;







      height:${s}px;







      background:${colors[Math.floor(Math.random() * colors.length)]};







      border-radius:${Math.random() > 0.5 ? '50%' : '3px'};







      animation-duration:${1.5 + Math.random() * 2}s;







      animation-delay:${Math.random() * 0.5}s;







      opacity: 0.9;







    `;

    document.body.appendChild(p);

    setTimeout(() => p.remove(), 4000);
  }
}

// 100% - Эпичный салют + фейерверк (идеально)

function spawnEpicConfetti() {
  document.querySelectorAll('.confetti-piece').forEach(p => p.remove());

  document.querySelectorAll('.firework').forEach(p => p.remove());

  const colors = [
    '#FFD700',

    '#FF6B6B',

    '#4ECDC4',

    '#45B7D1',

    '#96CEB4',

    '#FFEAA7',

    '#FF1744',

    '#D500F9',
  ];

  // Больше конфетти для идеального результата

  for (let i = 0; i < 150; i++) {
    const p = document.createElement('div');

    const s = 8 + Math.random() * 12;

    p.className = 'confetti-piece';

    p.style.cssText = `







      left:${Math.random() * 100}vw;







      top:-20px;







      width:${s}px;







      height:${s}px;







      background:${colors[Math.floor(Math.random() * colors.length)]};







      border-radius:${Math.random() > 0.5 ? '50%' : '3px'};







      animation-duration:${1 + Math.random() * 2}s;







      animation-delay:${Math.random() * 0.3}s;







      opacity: 1;







      box-shadow: 0 0 6px rgba(255, 215, 0, 0.6);







    `;

    document.body.appendChild(p);

    setTimeout(() => p.remove(), 4000);
  }

  // Добавляем фейерверки

  setTimeout(() => {
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        const f = document.createElement('div');

        f.className = 'firework';

        const x = 20 + Math.random() * 60; // 20-80% ширины экрана

        f.style.cssText = `







          left:${x}vw;







          top:30vh;







          width:4px;







          height:4px;







          background:#FFD700;







          border-radius:50%;







          animation:fireworkBurst 1s ease-out forwards;







        `;

        document.body.appendChild(f);

        setTimeout(() => f.remove(), 1000);
      }, i * 200);
    }
  }, 500);
}

// Старые функции для совместимости

function spawnVictoryConfetti() {
  spawnGoodConfetti();
}

function spawnConfetti() {
  spawnVictoryConfetti();
}

// ============================================================

// INIT

// ============================================================

// Мост для Supabase

window._getLocalWords = () => window.words;

window._setWords = async newWords => {
  console.log('_setWords called with', newWords.length, 'words');

  // Обновляем слова

  window.words = newWords;

  console.log(
    'Words updated:',

    window.words.length,

    'Total window.words in window:',

    window.words.length,
  );

  visibleLimit = 30; // <-- сброс

  renderWords();

  renderStats();

  renderXP();

  renderBadges();

  updateDueBadge();

  await renderRandomBankWord();

  renderWeekChart();
};

// Инициализация индикатора синхронизации и мониторинга сети

// Обработчик клика на индикатор синхронизации

// const syncIndicator = document.getElementById('sync-indicator');

// if (syncIndicator) {

//   syncIndicator.addEventListener('click', forceSync);

// }

// Настройка мониторинга сети

setupNetworkMonitoring();

// Запуск периодической проверки бейджей

startBadgeAutoCheck();

// ============================================================

// СЛУЧАЙНОЕ СЛОВО ИЗ БАНКА (вместо Word of the Day)

// ============================================================

let currentBankWord = null; // текущее показываемое слово из банка

let shownBankWordEn = new Set(); // слова, которые уже показывали в этой сессии (чтобы избежать повторов)

let addedBankWordEn = new Set(); // слова, которые пользователь уже добавил в свой словарь

/**



 * Получить случайное слово из банка, исключая уже показанные и добавленные



 */

async function getRandomBankWord() {
  const bank = await window.WordAPI.loadWordBank();

  if (!bank || bank.length === 0) return null;

  // Фильтруем: исключаем те, что уже добавлены в словарь пользователя

  const userWordsEn = new Set(window.words.map(w => w.en.toLowerCase()));

  const available = bank.filter(item => {
    const enLower = item.en.toLowerCase();

    return !userWordsEn.has(enLower) && !addedBankWordEn.has(enLower);
  });

  if (available.length === 0) {
    // Если все слова из банка уже в словаре, всё равно показываем случайное (можно без фильтра)

    const randomIndex = Math.floor(Math.random() * bank.length);

    return bank[randomIndex];
  }

  const randomIndex = Math.floor(Math.random() * available.length);

  return available[randomIndex];
}

/**



 * Отрисовать блок со случайным словом из банка



 */

async function renderRandomBankWord() {
  const wrap = document.getElementById('wotd-wrap');

  if (!wrap) return;

  // Если уже есть карточка, добавим класс для плавного исчезновения

  if (wrap.children.length > 0) {
    wrap.classList.add('fade-out');

    await new Promise(r => setTimeout(r, 200));
  }

  const word = await getRandomBankWord();

  if (!word) {
    wrap.innerHTML =
      '<div class="word-bank-card">Не удалось загрузить слово</div>';

    return;
  }

  currentBankWord = word;

  const enLower = word.en.toLowerCase();

  shownBankWordEn.add(enLower);

  const example = word.examples?.[0]?.text || '';

  const exampleTranslation = word.examples?.[0]?.translation || '';

  wrap.innerHTML = `



    <div class="word-bank-card">



      <div class="word-bank-content">



        <div class="word-bank-label">

          <span class="material-symbols-outlined">auto_stories</span>

          Рекомендуемое слово

        </div>



        <div class="word-bank-en-wrapper">

          <div class="word-bank-en">${esc(word.en)}</div>

          <button class="word-bank-audio" title="Прослушать">

            <span class="material-symbols-outlined">volume_up</span>

          </button>

        </div>



        <div class="word-bank-ru">${parseAnswerVariants(word.ru).join(', ') || esc(word.ru)}</div>
        ${word.tags?.length ? `<div class="word-bank-tags">${word.tags.map(tag => `<span class="tag">${esc(formatTag(tag))}</span>`).join('')}</div>` : ''}



      </div>



      <div class="word-bank-actions">



        <div class="word-bank-nav">



          <button class="word-bank-nav-btn" id="bank-word-next" title="Следующее слово"><span class="material-symbols-outlined">chevron_right</span></button>



        </div>



        <button class="word-bank-add-btn" id="bank-word-add"><span class="material-symbols-outlined">add</span> Добавить</button>



      </div>



    </div>



  `;

  const audioBtn = wrap.querySelector('.word-bank-audio');

  if (audioBtn) {
    audioBtn.addEventListener('click', e => {
      e.stopPropagation(); // предотвращаем всплытие, если карточка тоже кликабельна
      const btn = e.currentTarget;
      const word = currentBankWord; // слово, которое сейчас показывается

      // Удаляем предыдущую волну, если она была
      const existingWave = btn.parentNode.querySelector('.audio-wave');
      if (existingWave) {
        const originalBtn = existingWave._originalBtn;
        if (originalBtn && originalBtn.parentNode) {
          originalBtn.style.display = '';
        }
        existingWave.remove();
      }

      // Создаём волну
      const wave = document.createElement('div');
      wave.className = 'audio-wave';
      wave.innerHTML =
        '<span></span><span></span><span></span><span></span><span></span>';
      wave._originalBtn = btn; // запоминаем оригинальную кнопку

      // Скрываем кнопку и заменяем её на волну
      btn.style.display = 'none';
      btn.parentNode.replaceChild(wave, btn);

      // Проигрываем аудио и по окончании возвращаем кнопку
      window.speakWord(word, () => {
        if (wave.parentNode && wave._originalBtn) {
          wave.parentNode.replaceChild(wave._originalBtn, wave);
          wave._originalBtn.style.display = ''; // возвращаем видимость
        }
      });
    });
  }

  wrap.classList.remove('fade-out');

  wrap.classList.add('fade-in');

  setTimeout(() => wrap.classList.remove('fade-in'), 300);

  // Обработчики для кнопок

  document.getElementById('bank-word-next')?.addEventListener('click', () => {
    renderRandomBankWord();
  });

  document

    .getElementById('bank-word-add')

    ?.addEventListener('click', async () => {
      if (!currentBankWord) return;

      const enLower = currentBankWord.en.toLowerCase();

      // Проверяем, нет ли уже такого слова с таким же переводом в словаре

      const isDuplicate = window.words.some(w => {
        if (w.en.toLowerCase() !== enLower) return false;

        const existingRuVariants = parseAnswerVariants(w.ru);

        const newRuVariants = parseAnswerVariants(currentBankWord.ru);

        return newRuVariants.some(v => existingRuVariants.includes(v));
      });

      if (isDuplicate) {
        toast(
          'Слово «' + currentBankWord.en + '» с таким переводом уже есть',

          'warning',
        );

        return;
      }

      // Создаём объект слова

      const newWord = mkWord(
        currentBankWord.en,

        currentBankWord.ru,

        currentBankWord.examples?.[0]?.text || '',

        currentBankWord.tags || [],

        currentBankWord.phonetic || null,

        currentBankWord.examples || [],

        currentBankWord.audio, // ← добавить

        currentBankWord.examplesAudio, // ← добавить
      );

      window.words.unshift(newWord);

      // Сразу сохраняем в localStorage

      localStorage.setItem('englift_words', JSON.stringify(window.words));

      // === ОБНОВЛЕНИЕ ЕЖЕДНЕВНЫХ ЦЕЛЕЙ ===
      resetDailyGoalsIfNeeded();
      window.dailyProgress.add_new = (window.dailyProgress.add_new || 0) + 1;
      scheduleProfileSave(); // Помечаем профиль как изменённый
      checkDailyGoalsCompletion();
      // ====================================

      gainXP(5, 'новое слово из банка');

      addedBankWordEn.add(enLower);

      // --- МГНОВЕННОЕ СОХРАНЕНИЕ НА СЕРВЕР ---

      if (navigator.onLine && window.currentUserId) {
        try {
          await saveWordToDb(newWord);

          console.log(
            `✅ Слово из банка "${currentBankWord.en}" мгновенно сохранено`,
          );
        } catch (e) {
          console.warn(
            `⚠️ Ошибка мгновенного сохранения "${currentBankWord.en}", добавляем в очередь`,

            e,
          );

          markWordDirty(newWord.id);
        }
      } else {
        markWordDirty(newWord.id);
      }

      // Обновляем интерфейс

      addWordToDOM(newWord);

      // Обновляем отображение ежедневных целей
      refreshUI();

      const bank =
        window.wordBank instanceof Promise
          ? await window.wordBank
          : window.wordBank;
      const remaining = bank
        ? bank.filter(b => !window.words.find(w => w.en === b.en)).length
        : 0;
      toast(
        `"${esc(currentBankWord.en)}" добавлено!<br><span style="opacity:0.8;font-size:0.85em">Ещё ${remaining} слов в банке</span>`,
        'success',
        'add_circle',
      );

      // Показываем следующее случайное слово

      renderRandomBankWord();
    });

  // Добавляем поддержку свайпа для мобильных

  const card = wrap.querySelector('.word-bank-card');

  if (card) {
    let touchstartX = 0;

    card.addEventListener(
      'touchstart',

      e => {
        touchstartX = e.changedTouches[0].screenX;
      },

      { passive: true },
    );

    card.addEventListener(
      'touchend',

      e => {
        const touchendX = e.changedTouches[0].screenX;

        if (touchendX < touchstartX - 50) {
          // свайп влево → следующее

          renderRandomBankWord();
        } else if (touchendX > touchstartX + 50) {
          // свайп вправо → предыдущее (тоже новое случайное)

          renderRandomBankWord();
        }
      },

      { passive: true },
    );
  }
}

let currentBankIdiom = null;

async function renderRandomBankIdiom() {
  const wrap = document.getElementById('idiom-bank-wrap');
  if (!wrap) return;

  // Плавное исчезновение
  if (wrap.children.length > 0) {
    wrap.classList.add('fade-out');
    await new Promise(r => setTimeout(r, 200));
  }

  if (!window.idiomsBank || window.idiomsBank.length === 0) {
    wrap.innerHTML =
      '<div class="word-bank-card">Не удалось загрузить идиомы</div>';
    return;
  }

  // Множество идиом пользователя (по полю idiom)
  const userIdiomsSet = new Set(window.idioms.map(i => i.idiom.toLowerCase()));

  // Отфильтровываем те, что уже есть у пользователя
  const available = window.idiomsBank.filter(
    item => !userIdiomsSet.has(item.idiom.toLowerCase()),
  );

  if (available.length === 0) {
    // Если все идиомы уже добавлены, показываем сообщение
    wrap.innerHTML =
      '<div class="word-bank-card">Поздравляем! Все идиомы из банка уже в вашем словаре 🎉</div>';
    wrap.classList.remove('fade-out');
    wrap.classList.add('fade-in');
    setTimeout(() => wrap.classList.remove('fade-in'), 300);
    return;
  }

  const randomIndex = Math.floor(Math.random() * available.length);
  const idiom = available[randomIndex];
  currentBankIdiom = idiom;

  wrap.innerHTML = `
    <div class="word-bank-card">
      <div class="word-bank-content">
        <div class="word-bank-label">
          <span class="material-symbols-outlined">auto_stories</span>
          Рекомендуемая идиома
        </div>
        <div class="word-bank-en-wrapper">
          <div class="word-bank-en">${esc(idiom.idiom).toLowerCase()}</div>
          <button class="word-bank-audio" title="Прослушать">
            <span class="material-symbols-outlined">volume_up</span>
          </button>
        </div>
        <div class="word-bank-ru">${esc(idiom.meaning)}</div>
        ${idiom.tags?.length ? `<div class="word-bank-tags">${idiom.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
      </div>
      <div class="word-bank-actions">
        <div class="word-bank-nav">
          <button class="word-bank-nav-btn" id="bank-idiom-next" title="Следующее">
            <span class="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
        <button class="word-bank-add-btn" id="bank-idiom-add">
          <span class="material-symbols-outlined">add</span> Добавить
        </button>
      </div>
    </div>
  `;

  // Обработчик для аудио
  wrap.querySelector('.word-bank-audio')?.addEventListener('click', e => {
    e.stopPropagation();
    const btn = e.currentTarget;
    const word = currentBankIdiom;

    // Удаляем предыдущую волну, если она была
    const existingWave = btn.parentNode.querySelector('.audio-wave');
    if (existingWave) {
      const originalBtn = existingWave._originalBtn;
      if (originalBtn && originalBtn.parentNode) {
        originalBtn.style.display = '';
      }
      existingWave.remove();
    }

    // Создаём волну
    const wave = document.createElement('div');
    wave.className = 'audio-wave';
    wave.innerHTML =
      '<span></span><span></span><span></span><span></span><span></span>';
    wave._originalBtn = btn; // запоминаем оригинальную кнопку

    // Скрываем кнопку и заменяем на волну
    btn.style.display = 'none';
    btn.parentNode.replaceChild(wave, btn);

    // Проигрываем аудио и возвращаем кнопку после окончания
    if (word.audio) {
      playIdiomAudio(word.audio, () => {
        if (wave.parentNode && wave._originalBtn) {
          wave.parentNode.replaceChild(wave._originalBtn, wave);
          wave._originalBtn.style.display = '';
        }
      });
    } else {
      speakText(word.idiom, () => {
        if (wave.parentNode && wave._originalBtn) {
          wave.parentNode.replaceChild(wave._originalBtn, wave);
          wave._originalBtn.style.display = '';
        }
      });
    }
  });

  wrap.classList.remove('fade-out');
  wrap.classList.add('fade-in');
  setTimeout(() => wrap.classList.remove('fade-in'), 300);

  // Кнопка «Далее»
  document.getElementById('bank-idiom-next')?.addEventListener('click', () => {
    renderRandomBankIdiom();
  });

  // Кнопка «Добавить»
  document
    .getElementById('bank-idiom-add')
    ?.addEventListener('click', async () => {
      if (!currentBankIdiom) return;

      const newIdiom = { ...currentBankIdiom, id: generateId() };
      // убираем поля, которые не нужны при сохранении (если есть лишние)
      delete newIdiom._id; // если есть

      // Сохраняем example_translation правильно
      if (newIdiom.example_translation) {
        newIdiom.example_translation = newIdiom.example_translation;
      }

      console.log(
        '🎯 Adding idiom with example_translation:',
        newIdiom.example_translation,
      );

      const success = await addIdiom(
        newIdiom.idiom,
        newIdiom.meaning,
        newIdiom.definition,
        newIdiom.example,
        newIdiom.phonetic || '',
        newIdiom.tags ? newIdiom.tags.join(', ') : '',
        newIdiom.audio,
        newIdiom.examplesAudio,
        newIdiom.example_translation, // Передаем перевод примера
      );
      if (success) {
        const remaining = window.idiomsBank
          ? window.idiomsBank.filter(
              b => !window.idioms.find(i => i.idiom === b.idiom),
            ).length
          : 0;
        toast(
          `"${esc(currentBankIdiom.idiom)}" добавлено!<br><span style="opacity:0.8;font-size:0.85em">Ещё ${remaining} идиом в банке</span>`,
          'success',
          'add_circle',
        );
        renderRandomBankIdiom(); // показать следующую
      }
    });
}

// Убрали двойной вызов load() - он перетирает данные из Supabase

(async () => {
  // updStreak();
  // updateDueBadge();

  await loadIdiomsBank(); // загружаем банк идиом
  renderRandomBankWord(); // для слов
  renderRandomBankIdiom(); // для идиом
})();

renderWords();

renderXP();

renderBadges();

renderStats();

// === ЗВУКИ ===

function playSound(type) {
  try {
    const ctx = getAudioContext();

    // Возобновляем аудиоконтекст если он приостановлен

    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    if (type === 'correct') {
      // Play success sound MP3 file
      const audio = new Audio('sound/sucsess.mp3');
      audio.volume = 0.1;
      audio.play().catch(e => console.error('Error playing success sound:', e));
    } else {
      // Play wrong sound MP3 file
      const audio = new Audio('sound/wrong.mp3');
      audio.volume = 0.1;
      audio.play().catch(e => console.error('Error playing wrong sound:', e));
    }
  } catch (e) {
    console.error('Error playing sound:', e);
  }
}

function runMatchExercise(initialWords, onComplete, exerciseType) {
  const content = document.getElementById('ex-content');

  const btns = document.getElementById('ex-btns');

  btns.innerHTML = '';

  document.getElementById('ex-type-lbl').innerHTML =
    '<span class="material-symbols-outlined">extension</span> Найди пары';

  content.innerHTML = `



    <div class="match-timer" id="match-timer">0.0s</div>



    <div class="match-progress" id="match-progress"></div>



    <div class="match-grid" id="match-grid"></div>



  `;

  const timerEl = document.getElementById('match-timer');

  const progressEl = document.getElementById('match-progress');

  const grid = document.getElementById('match-grid');

  let startTime = Date.now();

  const wordsCount = Math.min(initialWords.length, 6);

  const currentWords = initialWords.slice(0, wordsCount);

  progressEl.textContent = `Найди ${wordsCount} пар`;

  let timerRunning = true;

  function updateTimer() {
    if (!timerRunning) return;

    timerEl.textContent = ((Date.now() - startTime) / 1000).toFixed(1) + 's';

    requestAnimationFrame(updateTimer);
  }

  requestAnimationFrame(updateTimer);

  // Сохраняем функцию для остановки

  window._matchTimerCancel = () => {
    timerRunning = false;
  };

  const enWords = [...currentWords];

  const ruWords = [...currentWords].sort(() => Math.random() - 0.5);

  grid.innerHTML = '';

  for (let i = 0; i < currentWords.length; i++) {
    const enW = enWords[i];

    const ruW = ruWords[i];

    const enBtn = document.createElement('button');

    enBtn.className = 'match-btn';

    enBtn.dataset.id = enW.id;

    enBtn.dataset.side = 'en';

    enBtn.textContent = enW.en;

    const ruBtn = document.createElement('button');

    ruBtn.className = 'match-btn';

    ruBtn.dataset.id = ruW.id;

    ruBtn.dataset.side = 'ru';

    ruBtn.textContent = ruW.ru;

    grid.appendChild(enBtn);

    grid.appendChild(ruBtn);
  }

  let matchedInRound = 0;

  const totalInRound = currentWords.length;

  let selectedWord = null;

  function clickHandler(e) {
    const btn = e.target.closest('.match-btn');

    if (!btn || btn.disabled || btn.classList.contains('correct')) return;

    const side = btn.dataset.side;

    const id = btn.dataset.id;

    // Отмена выбора при клике на ту же кнопку

    if (selectedWord && selectedWord.element === btn) {
      selectedWord.element.classList.remove('selected');

      selectedWord = null;

      return;
    }

    // Первое нажатие

    if (!selectedWord) {
      btn.classList.add('selected');

      selectedWord = { id, side, element: btn };

      return;
    }

    // Второе нажатие – проверка пары

    if (selectedWord.id === id && selectedWord.side !== side) {
      // Правильно!

      playSound('correct');

      matchedInRound++;

      // Делаем обе кнопки зелёными и неактивными

      btn.classList.add('correct');

      btn.disabled = true;

      selectedWord.element.classList.add('correct');

      selectedWord.element.disabled = true;

      // Обновляем статистику для обоих слов

      updStats(id, true, exerciseType);

      updStats(selectedWord.id, true, exerciseType);

      sResults.correct.push(initialWords.find(w => w.id === id));

      sResults.correct.push(initialWords.find(w => w.id === selectedWord.id));

      selectedWord = null;

      // Если все пары угаданы - завершаем упражнение

      if (matchedInRound === totalInRound) {
        if (window._matchTimerCancel) {
          window._matchTimerCancel();

          window._matchTimerCancel = null;
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        setTimeout(() => onComplete(elapsed), 600);
      }
    } else {
      // Ошибка

      playSound('wrong');

      btn.classList.add('wrong');

      selectedWord.element.classList.add('wrong');

      // Записываем ошибку для первого выбранного слова

      updStats(selectedWord.id, false, exerciseType);

      sResults.wrong.push(initialWords.find(w => w.id === selectedWord.id));

      setTimeout(() => {
        btn.classList.remove('wrong');

        if (selectedWord) {
          selectedWord.element.classList.remove('wrong', 'selected');

          selectedWord = null;
        }
      }, 400);
    }
  }

  grid.addEventListener('click', clickHandler);
}

function runIdiomMatchExercise(items, onComplete, exerciseType) {
  const content = document.getElementById('ex-content');
  const btns = document.getElementById('ex-btns');
  btns.innerHTML = '';
  document.getElementById('ex-type-lbl').innerHTML =
    '<span class="material-symbols-outlined">extension</span> Сопоставь идиому и перевод';

  content.innerHTML = `
    <div class="match-timer" id="match-timer">0.0s</div>
    <div class="match-progress" id="match-progress"></div>
    <div class="match-grid" id="match-grid"></div>
  `;

  const timerEl = document.getElementById('match-timer');
  const progressEl = document.getElementById('match-progress');
  const grid = document.getElementById('match-grid');

  let startTime = Date.now();
  const wordsCount = Math.min(items.length, 6);
  const currentItems = items.slice(0, wordsCount);
  progressEl.textContent = `Найди ${wordsCount} пар`;

  let timerRunning = true;
  function updateTimer() {
    if (!timerRunning) return;
    timerEl.textContent = ((Date.now() - startTime) / 1000).toFixed(1) + 's';
    requestAnimationFrame(updateTimer);
  }
  requestAnimationFrame(updateTimer);
  window._matchTimerCancel = () => {
    timerRunning = false;
  };

  const leftItems = [...currentItems];
  const rightItems = [...currentItems].sort(() => Math.random() - 0.5);

  grid.innerHTML = '';
  for (let i = 0; i < currentItems.length; i++) {
    const left = leftItems[i];
    const right = rightItems[i];

    const leftBtn = document.createElement('button');
    leftBtn.className = 'match-btn';
    leftBtn.dataset.id = left.id;
    leftBtn.dataset.side = 'left';
    leftBtn.textContent = left.idiom.toLowerCase();

    const rightBtn = document.createElement('button');
    rightBtn.className = 'match-btn';
    rightBtn.dataset.id = right.id;
    rightBtn.dataset.side = 'right';
    rightBtn.textContent = right.meaning;

    grid.appendChild(leftBtn);
    grid.appendChild(rightBtn);
  }

  let matchedInRound = 0;
  const totalInRound = currentItems.length;
  let selected = null;

  function clickHandler(e) {
    const btn = e.target.closest('.match-btn');
    if (!btn || btn.disabled || btn.classList.contains('correct')) return;

    const side = btn.dataset.side;
    const id = btn.dataset.id;

    // Отмена выбора при клике на ту же кнопку
    if (selected && selected.element === btn) {
      selected.element.classList.remove('selected');
      selected = null;
      return;
    }

    // Первое нажатие
    if (!selected) {
      btn.classList.add('selected');
      selected = { id, side, element: btn };
      return;
    }

    // Второе нажатие – проверка пары
    if (selected.id === id && selected.side !== side) {
      // Правильно!
      playSound('correct');
      matchedInRound++;

      btn.classList.add('correct');
      btn.disabled = true;
      selected.element.classList.add('correct');
      selected.element.disabled = true;

      // Обновляем статистику для обоих
      updIdiomStats(id, true, exerciseType);
      updIdiomStats(selected.id, true, exerciseType);

      sResults.correct.push(currentItems.find(i => i.id === id));
      sResults.correct.push(currentItems.find(i => i.id === selected.id));

      selected = null;

      if (matchedInRound === totalInRound) {
        if (window._matchTimerCancel) window._matchTimerCancel();
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        setTimeout(() => onComplete(elapsed), 600);
      }
    } else {
      // Ошибка
      playSound('wrong');
      btn.classList.add('wrong');
      selected.element.classList.add('wrong');

      updIdiomStats(selected.id, false, exerciseType);
      sResults.wrong.push(currentItems.find(i => i.id === selected.id));

      setTimeout(() => {
        btn.classList.remove('wrong');
        if (selected) {
          selected.element.classList.remove('wrong', 'selected');
          selected = null;
        }
      }, 400);
    }
  }

  grid.addEventListener('click', clickHandler);
}

// === NEW EXERCISES ===

function runContextExercise(item, onComplete, exerciseType) {
  const content = document.getElementById('ex-content');
  const btns = document.getElementById('ex-btns');
  const exTypeLbl = document.getElementById('ex-type-lbl');
  const exCounter = document.getElementById('ex-counter');

  const isIdiom = session.dataType === 'idioms';

  if (exTypeLbl) {
    exTypeLbl.innerHTML =
      '<span class="material-symbols-outlined">psychology</span> Контекстная догадка';
  }
  if (exCounter) {
    exCounter.textContent = `${sIdx + 1} / ${session.items.length}`;
  }

  // Варианты ответов
  const options = [item];
  const otherItems = session.items.filter(x => x.id !== item.id);

  for (let i = 0; i < 3 && i < otherItems.length; i++) {
    const randomIndex = Math.floor(Math.random() * otherItems.length);
    options.push(otherItems[randomIndex]);
    otherItems.splice(randomIndex, 1);
  }

  // Определяем текст с пропуском
  let exampleText = '';
  let exampleTranslation = '';
  let correctAnswer = '';

  if (isIdiom) {
    // Для идиом используем поле example
    exampleText = item.example || item.ex || '';
    exampleTranslation = item.example_translation || '';
    correctAnswer = item.idiom;
  } else {
    exampleText = item.ex || '';
    exampleTranslation = item.examples?.[0]?.translation || '';
    correctAnswer = item.en;
  }

  // Экранируем спецсимволы для регулярки
  const escapedWord = correctAnswer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const exampleWithBlank = exampleText.replace(
    new RegExp(escapedWord, 'gi'),
    '_____',
  );

  // Перемешиваем варианты
  const shuffledOptions = options.sort(() => Math.random() - 0.5);

  content.innerHTML = `
    <div class="context-exercise">
      <div class="context-sentence">
        <div class="context-text" onclick="this.nextElementSibling.style.display='block'; this.style.background='transparent'; this.onmouseover=null; this.onmouseout=null;" style="cursor: pointer; padding: 0.5rem; border-radius: 8px; transition: background 0.2s;" title="Нажмите для перевода" onmouseover="this.style.background='var(--border)'" onmouseout="this.style.background='transparent'">
          ${esc(exampleWithBlank)}
        </div>
        <div class="context-translation" id="context-translation" style="display: none; margin-top: 0.5rem; color: var(--muted); padding: 0.5rem; background: var(--card); border-radius: 8px;">
          ${esc(exampleTranslation)}
        </div>
      </div>
      <div class="context-options" id="context-options"></div>
      <div class="feedback-panel" id="context-feedback" style="display: none;"></div>
    </div>
  `;

  const optionsContainer = document.getElementById('context-options');
  const feedback = document.getElementById('context-feedback');

  shuffledOptions.forEach(option => {
    const btn = document.createElement('button');
    btn.className = 'context-option-btn';
    btn.textContent = (isIdiom ? option.idiom : option.en).toLowerCase();
    btn.dataset.id = option.id;
    btn.addEventListener('click', () => {
      const isCorrect = option.id === item.id;

      document
        .querySelectorAll('.context-option-btn')
        .forEach(b => (b.disabled = true));

      feedback.style.display = 'block';
      feedback.classList.remove('correct', 'incorrect', 'warning');
      feedback.classList.add(isCorrect ? 'correct' : 'incorrect');
      feedback.innerHTML = isCorrect
        ? `<span class="material-symbols-outlined">check_circle</span><span>Верно!</span>`
        : `<span class="material-symbols-outlined">cancel</span><span>Неверно. Правильный ответ: ${isIdiom ? item.idiom : item.en}</span>`;

      playSound(isCorrect ? 'correct' : 'wrong');

      // Записываем ответ
      if (isCorrect) {
        recordAnswer(true, exerciseType);
      } else {
        recordAnswer(false, exerciseType);
      }

      // Показываем полный пример
      const contextText = document.querySelector('.context-text');
      if (contextText) {
        contextText.textContent = exampleText;
        // Озвучка
        if (isIdiom) {
          if (item.audio) playIdiomAudio(item.audio);
          else speakText(item.idiom);
        } else {
          window.speakWord(item);
        }
      }

      // Кнопка "Далее"
      if (btns) {
        btns.innerHTML = `<button class="btn-icon" id="context-next"><span class="material-symbols-outlined">arrow_forward</span></button>`;
        document
          .getElementById('context-next')
          .addEventListener('click', () => {
            onComplete();
          });
      } else {
        const nextBtn = document.createElement('button');
        nextBtn.className = 'btn btn-primary';
        nextBtn.innerHTML =
          '<span class="material-symbols-outlined">arrow_forward</span> Далее';
        nextBtn.style.marginTop = '1rem';
        nextBtn.addEventListener('click', () => onComplete());
        feedback.parentNode.appendChild(nextBtn);
      }
    });
    optionsContainer.appendChild(btn);
  });

  // Кнопка пропуска
  if (btns) {
    btns.innerHTML = `<button class="btn-icon" id="context-skip"><span class="material-symbols-outlined">skip_next</span></button>`;
    document.getElementById('context-skip')?.addEventListener('click', () => {
      recordAnswer(false, exerciseType);
      onComplete();
    });
  }
}

function runSpeechSentenceExercise(word, onComplete, exerciseType) {
  const content = document.getElementById('ex-content');
  const btns = document.getElementById('ex-btns');
  const exTypeLbl = document.getElementById('ex-type-lbl');
  const exCounter = document.getElementById('ex-counter');

  if (exTypeLbl) {
    exTypeLbl.innerHTML =
      '<span class="material-symbols-outlined">record_voice_over</span> Слушай и говори';
  }

  if (exCounter) {
    exCounter.textContent = `${sIdx + 1} / ${session.items.length}`;
  }

  const hasExample = word.ex && word.ex.trim().length > 0;
  const promptText = hasExample ? word.ex : word.en;
  const expectedWord = promptText;
  const exampleTranslation =
    hasExample && word.examples && word.examples[0]
      ? word.examples[0].translation
      : null;

  content.innerHTML = `
    <div class="speech-exercise">
      <div class="speech-prompt">
        <div class="speech-word-container">
          <div class="speech-word speech-sentence">${esc(promptText)}</div>
          <button class="btn-icon btn-small" id="speech-sentence-replay-btn" title="Прослушать предложение">
            <span class="material-symbols-outlined">volume_up</span>
          </button>
        </div>
        <div class="speech-hint">${!hasExample ? 'Прослушайте слово, затем повторите его' : ''}</div>
        <div class="speech-translation" id="speech-sentence-translation" style="margin-top: 0.5rem; opacity: 0.7;">
          ${!hasExample ? `${parseAnswerVariants(word.ru).join(', ') || esc(word.ru)}` : exampleTranslation ? `${esc(exampleTranslation)}` : ''}
        </div>
      </div>
      <div class="speech-controls">
        <button class="btn-icon" id="speech-sentence-start-btn">
          <span class="material-symbols-outlined">mic</span>
        </button>
        <div class="recording-indicator" id="speech-sentence-recording-indicator" style="display: none;">
          <span class="material-symbols-outlined">graphic_eq</span> Говорите...
        </div>
      </div>
      <div class="feedback-panel" id="speech-sentence-feedback" style="display: none;"></div>
    </div>
  `;

  const replayBtn = document.getElementById('speech-sentence-replay-btn');
  const startBtn = document.getElementById('speech-sentence-start-btn');
  const indicator = document.getElementById(
    'speech-sentence-recording-indicator',
  );
  const feedback = document.getElementById('speech-sentence-feedback');
  const translationEl = document.getElementById('speech-sentence-translation');

  // Автоматическая озвучка при запуске упражнения

  setTimeout(() => {
    console.log('Автоматическая озвучка предложения:', promptText);

    if (hasExample && word.examplesAudio && word.examplesAudio.length > 0) {
      // Если есть пример с аудио - используем его

      window.playExampleAudio(word);
    } else {
      // Иначе озвучиваем как обычное слово

      window.speakWord(word);
    }
  }, 1000);

  // Обработчик кнопки повторного прослушивания

  if (replayBtn) {
    replayBtn.addEventListener('click', () => {
      console.log('Повторная озвучка предложения:', promptText);

      if (hasExample && word.examplesAudio && word.examplesAudio.length > 0) {
        // Если есть пример с аудио - используем его

        window.playExampleAudio(word);
      } else {
        // Иначе озвучиваем как обычное слово

        window.speakWord(word);
      }
    });
  }

  if (!speechRecognitionSupported) {
    feedback.textContent =
      'Распознавание речи не поддерживается вашим браузером.';

    if (startBtn) startBtn.disabled = true;
  }

  startBtn?.addEventListener('click', () => {
    // === ДОБАВЬТЕ ЭТИ СТРОКИ ===
    if (feedback) {
      feedback.style.display = 'none';
      feedback.innerHTML = '';
      feedback.classList.remove('correct', 'incorrect', 'warning');
    }
    if (indicator) indicator.style.display = 'none';
    // ============================

    if (currentRecognition) {
      try {
        currentRecognition.abort();
      } catch (e) {}

      currentRecognition = null;
    }

    const SpeechRec =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRec) return;

    const rec = new SpeechRec();

    rec.lang = 'en-US';

    rec.continuous = false;

    rec.interimResults = false;

    rec.maxAlternatives = 3;

    currentRecognition = rec;

    let recognitionActive = false;

    const timeoutId = setTimeout(() => {
      if (recognitionActive) {
        try {
          rec.abort();
        } catch (e) {}

        recognitionActive = false;
      }
    }, CONSTANTS.SPEECH.RECOGNITION_TIMEOUT);

    rec.onstart = () => {
      recognitionActive = true;

      indicator.style.display = 'flex';

      startBtn.style.display = 'none';

      // Полностью скрываем и сбрасываем фидбек
      feedback.style.display = 'none';
      feedback.classList.remove('correct', 'incorrect', 'warning');
      feedback.textContent = '';
    };

    rec.onresult = event => {
      clearTimeout(timeoutId);
      recognitionActive = false;
      indicator.style.display = 'none';
      startBtn.style.display = 'flex';

      const spoken = event.results[0][0].transcript.trim().toLowerCase();
      const correct = expectedWord.toLowerCase();
      const result = checkSpeechSimilarity(spoken, correct);

      // Создаём объект для фидбека (имитация слова)
      const feedbackWord = {
        en: word.en,
        ru: word.ru,
        idiom: word.idiom,
        meaning: word.meaning,
      };

      if (result.isCorrect) {
        feedback.classList.remove('correct', 'incorrect', 'warning');
        feedback.classList.add('correct');
        feedback.innerHTML = getFeedbackHTML(
          feedbackWord,
          true,
          result.confidence,
        );
        feedback.style.display = 'flex';
        playSound('correct');

        // Отключаем кнопки на время показа фидбека
        startBtn.disabled = true;
        if (replayBtn) replayBtn.disabled = true;

        setTimeout(() => {
          recordAnswer(true, exerciseType);
          onComplete(); // переход к следующему упражнению
        }, 1500);
      } else {
        feedback.classList.remove('correct', 'incorrect', 'warning');
        feedback.classList.add('incorrect');
        feedback.innerHTML = getFeedbackHTML(
          feedbackWord,
          false,
          result.confidence,
        );
        feedback.style.display = 'flex';

        playSound('wrong');
        // Даём ещё одну попытку – кнопки остаются активными
      }
      currentRecognition = null;
    };

    rec.onerror = e => {
      clearTimeout(timeoutId);

      recognitionActive = false;

      indicator.style.display = 'none';

      startBtn.style.display = 'flex';

      let errorMessage = 'Ошибка распознавания.';

      if (e.error === 'not-allowed')
        errorMessage = 'Доступ к микрофону заблокирован.';
      else if (e.error === 'no-speech')
        errorMessage = 'Речь не распознана. Попробуйте ещё раз.';
      else if (e.error === 'audio-capture') errorMessage = 'Ошибка микрофона.';
      else if (e.error === 'network') errorMessage = 'Ошибка сети.';
      else if (e.error === 'aborted')
        errorMessage = 'Превышено время ожидания. Попробуйте ещё раз.';

      feedback.classList.remove('correct', 'incorrect', 'warning');
      feedback.classList.add('warning');

      feedback.innerHTML = `<span class="material-symbols-outlined">warning</span><span>${errorMessage}</span>`;

      currentRecognition = null;
    };

    rec.onend = () => {
      clearTimeout(timeoutId);

      if (recognitionActive) {
        indicator.style.display = 'none';

        startBtn.style.display = 'flex';

        feedback.style.display = 'block';

        feedback.classList.remove('correct', 'incorrect', 'warning');
        feedback.classList.add('warning');
        feedback.style.display = 'block';

        feedback.innerHTML =
          '<span class="material-symbols-outlined">warning</span><span>Не удалось распознать речь. Попробуйте ещё раз.</span>';

        recognitionActive = false;
      }

      currentRecognition = null;
    };

    try {
      rec.start();
    } catch (err) {
      console.error('SpeechRecognition start failed:', err);

      feedback.style.display = 'block';

      feedback.className = 'feedback-panel warning';

      feedback.innerHTML =
        '<span class="material-symbols-outlined">warning</span><span>Не удалось запустить распознавание.</span>';

      indicator.style.display = 'none';

      startBtn.style.display = 'flex';

      currentRecognition = null;
    }
  });

  // Кнопка пропуска

  if (btns) {
    btns.innerHTML = `<button class="btn-icon" id="speech-sentence-skip"><span class="material-symbols-outlined">skip_next</span></button>`;

    document

      .getElementById('speech-sentence-skip')

      ?.addEventListener('click', () => {
        if (currentRecognition) {
          try {
            currentRecognition.abort();
          } catch (e) {}

          currentRecognition = null;
        }

        indicator.style.display = 'none';

        startBtn.style.display = 'flex';

        recordAnswer(false, exerciseType);

        onComplete();
      });
  }
}

function runIdiomBuilderExercise(item, onComplete, exerciseType) {
  const content = document.getElementById('ex-content');
  const btns = document.getElementById('ex-btns');
  const exTypeLbl = document.getElementById('ex-type-lbl');
  const exCounter = document.getElementById('ex-counter');

  exTypeLbl.innerHTML =
    '<span class="material-symbols-outlined">construction</span> Собери идиому';
  exCounter.textContent = `${sIdx + 1} / ${session.items.length}`;

  const phrase = item.idiom.toLowerCase(); // "a busy bee"
  const words = phrase.split(' '); // ["a", "busy", "bee"]
  const shuffled = [...words].sort(() => Math.random() - 0.5);

  content.innerHTML = `
    <div class="builder-card">
      <div class="builder-question">${item.meaning}</div>
      <div class="builder-answer" id="idiom-builder-answer"></div>
      <div class="builder-letters-container">
        <div class="builder-letters" id="idiom-builder-words"></div>
        <div class="feedback-panel" id="idiom-builder-fb" style="display: none;"></div>
      </div>
    </div>
    <div class="builder-controls">
      <button class="btn-icon" id="idiom-builder-hint-btn">
        <span class="material-symbols-outlined">lightbulb</span>
      </button>
      <button class="btn-icon" id="idiom-builder-reset"><span class="material-symbols-outlined">refresh</span></button>
    </div>
  `;

  const answerContainer = document.getElementById('idiom-builder-answer');
  const wordsContainer = document.getElementById('idiom-builder-words');
  const fb = document.getElementById('idiom-builder-fb');

  // Создаём пустые ячейки для ответа
  for (let i = 0; i < words.length; i++) {
    const placeholder = document.createElement('span');
    placeholder.className = 'builder-answer-letter placeholder';
    placeholder.dataset.index = i;
    answerContainer.appendChild(placeholder);
  }

  // Создаём кнопки для слов
  shuffled.forEach((word, index) => {
    const btn = document.createElement('button');
    btn.className = 'builder-letter';
    btn.textContent = word;
    btn.dataset.word = word;
    btn.dataset.index = index;
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      const firstPlaceholder = answerContainer.querySelector(
        '.builder-answer-letter.placeholder',
      );
      if (!firstPlaceholder) return;
      firstPlaceholder.classList.remove('placeholder');
      firstPlaceholder.textContent = word;
      firstPlaceholder.style.cursor = 'pointer';
      firstPlaceholder.title = 'Нажмите, чтобы убрать';
      firstPlaceholder.dataset.word = word;
      btn.disabled = true;
      btn.style.visibility = 'hidden';

      // Добавляем возможность убрать слово кликом на ячейку
      firstPlaceholder.addEventListener('click', function removeHandler() {
        if (!firstPlaceholder.classList.contains('placeholder')) {
          // Найти соответствующую кнопку и включить её
          const targetBtn = Array.from(wordsContainer.children).find(
            b => b.dataset.word === word && b.disabled,
          );
          if (targetBtn) {
            targetBtn.disabled = false;
            targetBtn.style.visibility = 'visible';
          }
          firstPlaceholder.classList.add('placeholder');
          firstPlaceholder.textContent = '';
          firstPlaceholder.style.cursor = 'default';
          firstPlaceholder.title = '';
          delete firstPlaceholder.dataset.word;
          firstPlaceholder.removeEventListener('click', removeHandler);
        }
        checkAnswer();
      });

      checkAnswer();
    });
    wordsContainer.appendChild(btn);
  });

  function checkAnswer() {
    const current = Array.from(answerContainer.children)
      .map(el => el.textContent)
      .join(' ');

    const normalizedCurrent = normalizeRussian(current.toLowerCase());
    const normalizedPhrase = normalizeRussian(phrase.toLowerCase());

    if (normalizedCurrent === normalizedPhrase) {
      wordsContainer.style.display = 'none';
      fb.style.display = 'block';
      fb.className = 'feedback-panel correct';
      fb.innerHTML = getFeedbackHTML({ en: phrase, ru: item.meaning }, true);
      // Озвучиваем идиому
      if (item.audio) playIdiomAudio(item.audio);
      else speakText(phrase);

      playSound('correct');

      setTimeout(() => {
        recordAnswer(true, exerciseType);
        onComplete();
      }, 1500);
    } else if (current.length >= phrase.length) {
      wordsContainer.style.display = 'none';
      fb.style.display = 'block';
      fb.className = 'feedback-panel incorrect';
      fb.innerHTML = `<span class="material-symbols-outlined">refresh</span><span>Попробуйте ещё раз!</span>`;
      // НЕ вызываем recordAnswer(false) и onComplete()
    }
  }

  document
    .getElementById('idiom-builder-reset')
    .addEventListener('click', () => {
      // Сброс
      answerContainer.innerHTML = '';
      for (let i = 0; i < words.length; i++) {
        const placeholder = document.createElement('span');
        placeholder.className = 'builder-answer-letter placeholder';
        placeholder.dataset.index = i;
        answerContainer.appendChild(placeholder);
      }
      wordsContainer.innerHTML = '';
      shuffled.forEach((word, index) => {
        const btn = document.createElement('button');
        btn.className = 'builder-letter';
        btn.textContent = word;
        btn.dataset.word = word;
        btn.dataset.index = index;
        btn.addEventListener('click', () => {
          if (btn.disabled) return;
          const firstPlaceholder = answerContainer.querySelector(
            '.builder-answer-letter.placeholder',
          );
          if (!firstPlaceholder) return;
          firstPlaceholder.classList.remove('placeholder');
          firstPlaceholder.textContent = word;
          firstPlaceholder.style.cursor = 'pointer';
          firstPlaceholder.title = 'Нажмите, чтобы убрать';
          firstPlaceholder.dataset.word = word;
          btn.disabled = true;
          btn.style.visibility = 'hidden';

          firstPlaceholder.addEventListener('click', function removeHandler() {
            if (!firstPlaceholder.classList.contains('placeholder')) {
              const targetBtn = Array.from(wordsContainer.children).find(
                b => b.dataset.word === word && b.disabled,
              );
              if (targetBtn) {
                targetBtn.disabled = false;
                targetBtn.style.visibility = 'visible';
              }
              firstPlaceholder.classList.add('placeholder');
              firstPlaceholder.textContent = '';
              firstPlaceholder.style.cursor = 'default';
              firstPlaceholder.title = '';
              delete firstPlaceholder.dataset.word;
              firstPlaceholder.removeEventListener('click', removeHandler);
            }
            checkAnswer();
          });

          checkAnswer();
        });
        wordsContainer.appendChild(btn);
      });
      wordsContainer.style.display = 'flex';
      fb.style.display = 'none';
      fb.textContent = '';
      fb.classList.remove('correct', 'incorrect', 'warning');
    });

  // Логика подсказки
  document
    .getElementById('idiom-builder-hint-btn')
    ?.addEventListener('click', () => {
      const current = Array.from(answerContainer.children)
        .map(el => el.textContent)
        .join(' ')
        .trim();
      const currentWords = current ? current.split(' ') : [];
      const nextWord = words[currentWords.length];
      if (!nextWord) return;
      const targetBtn = Array.from(wordsContainer.children).find(
        b => b.dataset.word === nextWord && !b.disabled,
      );
      if (targetBtn) {
        targetBtn.classList.add('builder-hint-pulse');
        setTimeout(
          () => targetBtn.classList.remove('builder-hint-pulse'),
          2000,
        );
      }
    });

  // Убираем кнопку пропуска - не нужна как в собери слово
}

// === EXIT SESSION ===

document.getElementById('ex-exit-btn').addEventListener('click', () => {
  // Добавить в начало обработчика:

  if (window._matchTimerCancel) {
    window._matchTimerCancel();

    window._matchTimerCancel = null;
  }

  // Показываем модалку подтверждения

  const modal = document.createElement('div');

  modal.className = 'modal-backdrop';

  modal.style.display = 'flex';

  modal.innerHTML = `







    <div class="modal-box">







      <h3>Выйти из урока?</h3>







      <p>Весь прогресс будет сохранён</p>







      <div class="modal-actions">







        <button class="btn-icon" id="exit-confirm">







          <span class="material-symbols-outlined">check</span>







        </button>







        <button class="btn-icon" id="exit-cancel">







          <span class="material-symbols-outlined">close</span>







        </button>







      </div>







    </div>







  `;

  document.body.appendChild(modal);

  // Обработчики

  document.getElementById('exit-cancel').addEventListener('click', () => {
    document.body.removeChild(modal);
  });

  document.getElementById('exit-confirm').addEventListener('click', () => {
    document.body.removeChild(modal);

    // Сбрасываем флаг активной сессии

    window.isSessionActive = false;

    // Останавливаем все активные процессы

    window.words.forEach(w => delete w._matched);

    if (window._matchTimerCancel) {
      window._matchTimerCancel();

      window._matchTimerCancel = null; // Очищаем ссылку
    }

    // Останавливаем таймер упражнения если активен

    if (currentExerciseTimer) {
      clearInterval(currentExerciseTimer);

      currentExerciseTimer = null;
    }

    // Удаляем элемент таймера если есть

    const timerEl = document.getElementById('exercise-timer');

    if (timerEl) {
      timerEl.remove();
    }

    // Останавливаем Speech Recognition если активно

    if (currentRecognition) {
      try {
        currentRecognition.abort();
      } catch (e) {
        console.log('Speech recognition already stopped');
      }

      currentRecognition = null;
    }

    document.getElementById('practice-ex').style.display = 'none';

    document.getElementById('practice-setup').style.display = 'block';

    // Обновляем кнопку Start

    const startBtn = document.getElementById('start-btn');

    if (startBtn) {
      startBtn.disabled = false;

      startBtn.innerHTML =
        '<span class="material-symbols-outlined">rocket_launch</span> Начать';

      startBtn.classList.remove('loading');
    }
  });
});

// === PWA ===

// Функция initPWA() отключена - используем статический manifest.json

/*



function initPWA() {



  const manifest = {



    name: 'EngLift',







    short_name: 'EngLift',







    description: 'Учи английские слова',







    start_url: './',







    display: 'standalone',







    background_color: '#F0F2FF',







    theme_color: '#6C63FF',







    icons: [



      {



        src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%236C63FF"/><text y=".9em" font-size="80" x="10">📚</text></svg>',







        sizes: '192x192',







        type: 'image/svg+xml',



      },







      {



        src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%236C63FF"/><text y=".9em" font-size="80" x="10">📚</text></svg>',







        sizes: '512x512',







        type: 'image/svg+xml',



      },



    ],



  };







  const blob = new Blob([JSON.stringify(manifest)], {



    type: 'application/json',



  });







  if ('serviceWorker' in navigator) {



    const swCode = `







      const CACHE = 'englift-v1';







      const ASSETS = [self.location.href];







      self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));







      self.addEventListener('fetch', e => e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))));







    `;







    const swBlob = new Blob([swCode], { type: 'application/javascript' });







    navigator.serviceWorker







      .register(URL.createObjectURL(swBlob))







      .catch(() => {});



  }



}



*/

window.clearUserData = function (isExplicitLogout = false) {
  console.log('🧹 clearUserData вызван, explicit:', isExplicitLogout);

  window.profileFullyLoaded = false;
  if (badgeCheckInterval) {
    clearInterval(badgeCheckInterval);
    badgeCheckInterval = null;
  }
  window.words = [];
  window.idioms = []; // очищаем идиомы
  window.pendingWordUpdates?.clear();
  updateIdiomsCount(); // обновляем счётчик после очистки
  if (window.wordSyncTimer) clearTimeout(window.wordSyncTimer);
  if (profileSaveTimer) clearTimeout(profileSaveTimer);

  if (isExplicitLogout) {
    // Сброс данных в памяти
    xpData = { xp: 0, level: 1, badges: [] };
    streak = { count: 0, lastDate: null };
    window.dailyProgress = {
      add_new: 0,
      practice_time: 0,
      review: 0,
      completed: false,
      lastReset: new Date().toISOString().split('T')[0],
    };
    window.dailyReviewCount = 0;
    window.lastReviewResetDate = new Date().toISOString().split('T')[0];

    // Полная очистка localStorage от всех ключей приложения
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('englift_')) {
        localStorage.removeItem(key);
      }
    });
  }

  renderXP();
  renderBadges();
  updateDueBadge();
  switchTab('words');

  // Сбрасываем экран практики
  const exerciseScreen = document.getElementById('practice-ex');
  const startScreen = document.getElementById('practice-setup');
  if (exerciseScreen) exerciseScreen.style.display = 'none';
  if (startScreen) startScreen.style.display = '';
  const resultsCard = document.querySelector('.results-card');
  if (resultsCard) resultsCard.style.display = 'none';
  window.isSessionActive = false;
};

// ============================================================

// GLOBAL FUNCTIONS FOR AUTH.JS

// ============================================================

window.loadData = load; // перезагрузка всех данных из localStorage

window.renderXP = renderXP; // обновление XP

window.renderBadges = renderBadges;

window.renderStats = renderStats;

window.renderWords = renderWords;

function renderIdioms() {
  console.log(
    '🎯 renderIdioms called, idioms count:',
    window.idioms?.length || 0,
  );
  const grid = document.getElementById('idioms-grid');
  const empty = document.getElementById('empty-idioms');
  const trigger = document.getElementById('idioms-load-more-trigger');
  const loadingMore = document.getElementById('idioms-loading-more');

  if (!grid) return; // на случай если вкладка ещё не создана

  // Отключаем старый наблюдатель
  if (idiomsIntersectionObserver) {
    idiomsIntersectionObserver.disconnect();
    idiomsIntersectionObserver = null;
  }

  requestAnimationFrame(() => {
    let list = window.idioms;

    // Фильтр по статусу (all/learning/learned)
    if (idiomsActiveFilter === 'learning') {
      list = list.filter(i => !i.stats?.learned);
    } else if (idiomsActiveFilter === 'learned') {
      list = list.filter(i => i.stats?.learned);
    }

    // Фильтр по поиску
    if (idiomsSearchQuery) {
      const q = idiomsSearchQuery.toLowerCase();
      list = list.filter(
        i =>
          i.idiom.toLowerCase().includes(q) ||
          i.meaning.toLowerCase().includes(q) ||
          (i.tags && i.tags.some(t => t.toLowerCase().includes(q))),
      );
    }

    // Фильтр по тегам (если нужен)
    if (idiomsTagFilter) {
      list = list.filter(
        i =>
          i.tags && i.tags.map(t => t.toLowerCase()).includes(idiomsTagFilter),
      );
    }

    // Сортировка
    list = sortIdioms(list, idiomsSortBy);

    // Обновляем счётчики - бейджи убраны из навигации
    // updateDueBadge() вызовется ниже в renderIdioms
    document.getElementById('idioms-subtitle').textContent =
      list.length !== window.idioms.length
        ? `(${list.length} из ${window.idioms.length})`
        : `— ${window.idioms.length} идиом`;

    if (!list.length) {
      grid.innerHTML = '';
      empty.style.display = 'block';
      if (trigger) trigger.style.display = 'none';
      if (loadingMore) loadingMore.style.display = 'none';
      return;
    }

    empty.style.display = 'none';

    const visibleList = list.slice(0, idiomsVisibleLimit);
    const fragment = document.createDocumentFragment();
    visibleList.forEach(i => fragment.appendChild(makeIdiomCard(i)));
    grid.innerHTML = '';
    grid.appendChild(fragment);

    if (list.length > idiomsVisibleLimit) {
      if (trigger) trigger.style.display = 'block';
      if (loadingMore) loadingMore.style.display = 'none';
      setupIdiomsLoadMoreObserver(list.length);
    } else {
      if (trigger) trigger.style.display = 'none';
      if (loadingMore) loadingMore.style.display = 'none';
    }
  });

  // Update due badge
  updateDueBadge();
}

window.renderIdioms = renderIdioms;

function makeIdiomCard(i) {
  const card = document.createElement('div');
  card.className = 'word-card word-card--idiom';
  card.dataset.id = i.id;

  // Сохраняем все данные в data-атрибутах для раскрытия
  card.dataset.idiom = i.idiom;
  card.dataset.meaning = i.meaning;
  card.dataset.definition = i.definition || '';
  card.dataset.example = i.example || i.ex || '';
  card.dataset.exampleTranslation = i.example_translation || '';
  card.dataset.tags = JSON.stringify(i.tags || []);
  card.dataset.examplesAudio = JSON.stringify(i.examplesAudio || []);

  // Базовая разметка (свёрнутое состояние)
  // Генерируем индикаторы прогресса
  const progressLevel = i.stats?.learned
    ? 3
    : i.stats?.correctExerciseTypes?.length || 0;
  const indicators = Array.from({ length: 3 }, (_, index) => {
    const dotClass = index < progressLevel ? 'filled' : '';
    return `<div class="progress-dot ${dotClass}"></div>`;
  }).join('');

  // Tooltip текст
  let tooltipText = 'Не изучено';
  if (i.stats?.learned) {
    tooltipText = 'Выучено ✨';
  } else if (progressLevel > 0) {
    tooltipText = `Прогресс: ${progressLevel}/3 упражнения`;
  }

  card.innerHTML = `
    <div class="progress-indicators" data-tooltip="${tooltipText}">${indicators}</div>
    <div class="word-card-header">
      <div class="word-main">
        <h3 class="word-title">${esc(i.idiom).toLowerCase()}</h3>
        ${
          window.user_settings?.showPhonetic && i.phonetic
            ? (() => {
                let phoneticDisplay = i.phonetic;
                if (
                  phoneticDisplay &&
                  !phoneticDisplay.startsWith('/') &&
                  !phoneticDisplay.endsWith('/')
                ) {
                  phoneticDisplay = `/${phoneticDisplay}/`;
                }
                return `<div class="word-phonetic">${esc(phoneticDisplay)}</div>`;
              })()
            : ''
        }
      </div>
      <div class="word-actions">
        <button class="audio-btn" data-idiom="${i.id}" title="Прослушать">
          <span class="material-symbols-outlined">volume_up</span>
        </button>
      </div>
    </div>
    <div class="word-translation">${esc(i.meaning)}</div>
    <div class="word-card-footer">
      <span class="expand-hint">Нажмите, чтобы раскрыть</span>
      <span class="material-symbols-outlined expand-icon">expand_more</span>
    </div>
  `;

  // Обработчик клика для раскрытия/сворачивания
  card.addEventListener('click', e => {
    if (
      e.target.closest('.audio-btn') ||
      e.target.closest('.edit-btn') ||
      e.target.closest('.delete-btn') ||
      e.target.closest('.example-audio-btn')
    ) {
      return;
    }
    card.classList.toggle('expanded');
    const expandHint = card.querySelector('.expand-hint');
    const expandIcon = card.querySelector('.expand-icon');
    if (card.classList.contains('expanded')) {
      expandHint.textContent = 'Нажмите, чтобы свернуть';
      expandIcon.textContent = 'expand_less';
    } else {
      expandHint.textContent = 'Нажмите, чтобы раскрыть';
      expandIcon.textContent = 'expand_more';
    }
    updateIdiomExpandedContent(card);
  });

  return card;
}

function updateIdiomExpandedContent(card) {
  if (!card.classList.contains('expanded')) {
    const extra = card.querySelector('.word-card-extra');
    if (extra) extra.remove();
    return;
  }

  if (card.querySelector('.word-card-extra')) return;

  // Достаём данные из data-атрибутов
  const definition = card.dataset.definition;
  const example = card.dataset.example;
  const exampleTranslation = card.dataset.exampleTranslation;
  let examplesAudio = [];
  let tags = [];

  try {
    examplesAudio = JSON.parse(card.dataset.examplesAudio || '[]');
    tags = JSON.parse(card.dataset.tags || '[]');
  } catch (e) {
    console.warn('Ошибка парсинга данных', e);
  }

  const extraDiv = document.createElement('div');
  extraDiv.className = 'word-card-extra';

  let html = '';

  if (definition) {
    html += `<div class="idiom-definition"><strong>Определение:</strong> ${esc(definition)}</div>`;
  }

  if (example) {
    html += `
      <div class="idiom-example">
        <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
          <p style="margin:0; flex:1;">${esc(example)}</p>
          <button class="example-audio-btn" data-example-index="0" title="Прослушать пример"><span class="material-symbols-outlined">volume_up</span></button>
        </div>
        ${exampleTranslation ? `<p class="example-translation">${esc(exampleTranslation)}</p>` : ''}
      </div>
    `;
  }

  if (tags.length) {
    html += `
      <div class="word-tags">
        ${tags.map(t => `<span class="tag" data-tag="${esc(t)}">${esc(t)}</span>`).join('')}
      </div>
    `;
  }

  html += `
    <div class="word-actions-extra">
      <button class="edit-btn" data-id="${card.dataset.id}" title="Редактировать">
        <span class="material-symbols-outlined">edit</span>
      </button>
      <button class="delete-btn" data-id="${card.dataset.id}" title="Удалить">
        <span class="material-symbols-outlined">delete</span>
      </button>
    </div>
  `;

  extraDiv.innerHTML = html;
  card.appendChild(extraDiv);
}

function setupIdiomsLoadMoreObserver(totalCount) {
  const trigger = document.getElementById('idioms-load-more-trigger');
  if (!trigger) return;

  if (idiomsIntersectionObserver) idiomsIntersectionObserver.disconnect();

  idiomsIntersectionObserver = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !idiomsIsLoadingMore) {
          idiomsIsLoadingMore = true;
          const loadingMore = document.getElementById('idioms-loading-more');
          if (loadingMore) loadingMore.style.display = 'block';

          idiomsVisibleLimit += 20; // PAGE_SIZE
          renderIdioms();

          setTimeout(() => {
            idiomsIsLoadingMore = false;
          }, 500);
        }
      });
    },
    { root: null, threshold: 0.1, rootMargin: '50px' },
  );

  idiomsIntersectionObserver.observe(trigger);
}

// Обработчик поиска для идиом
let idiomsSearchTimer = null;
document.getElementById('idioms-search')?.addEventListener('input', e => {
  clearTimeout(idiomsSearchTimer);
  idiomsSearchTimer = setTimeout(() => {
    idiomsSearchQuery = e.target.value;
    idiomsVisibleLimit = 30;
    renderIdioms();
  }, 280);
});

window.updateDueBadge = updateDueBadge;

// Заглушка для loadUserSettings (используется в auth.js)

window.loadUserSettings = function (data) {
  // Пока ничего не делаем - функция-заглушка для совместимости
};

// Обработчики для модального окна добавления идиом
const addIdiomModal = document.getElementById('add-idiom-modal');
const addIdiomModalClose = document.getElementById('add-idiom-modal-close');
const addIdiomBtn = document.getElementById('floating-add-idiom-btn');
const emptyAddBtn = document.getElementById('empty-add-idiom-btn');

function openAddIdiomModal() {
  resetAddForm(); // ← добавить эту строку
  addIdiomModal.classList.add('open');
  document.body.classList.add('modal-open');
}

function closeAddIdiomModal() {
  addIdiomModal.classList.remove('open');
  document.body.classList.remove('modal-open');
  resetAddForm(); // ← добавить эту строку
}

addIdiomBtn?.addEventListener('click', openAddIdiomModal);
emptyAddBtn?.addEventListener('click', openAddIdiomModal);
addIdiomModalClose?.addEventListener('click', closeAddIdiomModal);
addIdiomModal?.addEventListener('click', e => {
  if (e.target === addIdiomModal) closeAddIdiomModal();
});

// Обработчики для модального окна добавления слова
const addWordModal = document.getElementById('add-word-modal');
const addWordModalClose = document.getElementById('add-word-modal-close');
const addWordBtn = document.getElementById('floating-add-word-btn');

function openAddWordModal() {
  // Очищаем форму перед открытием
  resetAddForm();
  addWordModal.classList.add('open');
  document.body.classList.add('modal-open');
}

function closeAddWordModal() {
  addWordModal.classList.remove('open');
  document.body.classList.remove('modal-open');
  resetAddForm(); // ← добавляем сброс полей и подсветки
}

addWordBtn?.addEventListener('click', openAddWordModal);
addWordModalClose?.addEventListener('click', closeAddWordModal);

addWordModal?.addEventListener('click', e => {
  if (e.target === addWordModal) closeAddWordModal();
});

// ============================================================

// ============================================================

// INITIALIZATION

// ============================================================

// Тема теперь применяется через немедленную инициализацию в начале файла

// Унифицированный обработчик visibilitychange

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    // Сохраняем слова в localStorage

    save(true);

    // ← ДОБАВЬ ЭТО: флашим незаконченные слова и профиль при сворачивании

    if (
      pendingWordUpdates.size > 0 &&
      navigator.onLine &&
      window.currentUserId
    ) {
      syncPendingWords();
    }

    if (window.currentUserId) {
      syncProfileToServer();
    }

    // Дополнительно сохраняем в localStorage как страховку
    // ЗАКОММЕНТИРОВАНО - теперь используем Supabase
    /*
    const profileData = JSON.stringify({
      daily_progress: window.dailyProgress,

      xp: window.xpData?.xp || 0,

      level: window.xpData?.level || 1,

      streak: window.streak?.count || 0,

      last_streak_date: window.streak?.lastDate,
    });

    localStorage.setItem('englift_lastknown_progress', profileData);
    */
  }
});

// Инициализация

(async () => {
  await load();

  // Выполняем миграцию переводов после загрузки

  if (window.words && window.words.length > 0) {
    await migrateExampleTranslations();
  }

  // НЕ рендерим сразу! Ждём профиль

  console.log('⏳ Ожидаем загрузки профиля перед первым рендером...');
})();

// Глобальный хук — вызывается из auth.js когда ВСЁ готово

window.onProfileFullyLoaded = async function () {
  window.profileFullyLoaded = true; // ← добавь эту строку

  console.log('✅ profileFullyLoaded = true');

  console.log('🚀 onProfileFullyLoaded — убираем loading и применяем тему');

  console.log('🔍 user_settings:', window.user_settings);

  console.log('🔍 currentUserId:', window.currentUserId);

  // Сразу скрываем индикатор загрузки, даже если слова ещё грузятся
  const loader = document.getElementById('loading-indicator');
  if (loader) {
    loader.style.opacity = '0';
    setTimeout(() => {
      loader.style.display = 'none';
    }, 300);
  }

  // Сначала убираем loading класс - разрешаем показ контента

  document.body.classList.remove('loading');

  // Добавляем authenticated чтобы скрыть auth-gate

  document.body.classList.add('authenticated');

  // Тема уже применена в applyProfileData, не переопределяем!

  // Синхронизируем измененные слова с сервера

  console.log('🚀 Начинаем инициализацию приложения...');

  // ✅ Оставь только это:

  if (window.authExports?.loadWordsOnce && window.currentUserId) {
    try {
      const {
        data: { user },
      } = await window.authExports.auth.getUser();

      if (!user) return;

      await new Promise(resolve => {
        window.authExports.loadWordsOnce(remoteWords => {
          window.words = (remoteWords || []).map(normalizeWord);

          localStorage.setItem('englift_words', JSON.stringify(window.words));

          resolve();
        });
      });
    } catch (e) {
      console.error('onProfileFullyLoaded', e);
    }
  }

  // Загружаем идиомы
  if (window.authExports?.loadIdiomsOnce && window.currentUserId) {
    try {
      await new Promise(resolve => {
        window.authExports.loadIdiomsOnce(remoteIdioms => {
          window.idioms = (remoteIdioms || []).map(normalizeIdiom);
          localStorage.setItem('englift_idioms', JSON.stringify(window.idioms));
          updateIdiomsCount(); // обновляем счётчик после загрузки
          resolve();
        });
      });
    } catch (e) {
      console.error('Ошибка загрузки идиом', e);
    }
  }

  // После загрузки рендерим (если активна вкладка идиом)
  if (document.getElementById('tab-idioms')?.classList.contains('active')) {
    renderIdioms();
  }

  // Update due badge for idioms
  updateDueBadge();

  // Скрываем индикатор загрузки только после завершения синхронизации
  const indicator = document.getElementById('loading-indicator');

  if (indicator) {
    console.log('👁️ Скрываем индикатор загрузки');

    indicator.style.opacity = '0';

    setTimeout(() => {
      indicator.style.display = 'none';

      console.log('✅ Индикатор загрузки скрыт');
    }, 300);
  } else {
    console.warn('⚠️ Индикатор загрузки не найден');
  }

  if (!window.currentUserId) {
    console.log('⚠️ Пользователь не авторизован, пропускаем загрузку слов');
  }

  renderWords();

  setTimeout(() => {
    renderStats();
  }, 100);

  renderXP();

  renderBadges();

  updateDueBadge();

  renderWeekChart();

  renderRandomBankWord();
};

// Если был пропущенный вызов – выполняем сейчас
if (window._pendingProfileLoaded) {
  console.log(
    '🔄 Выполняем пропущенный вызов onProfileFullyLoaded (флаг был установлен)',
  );
  window.onProfileFullyLoaded();
  window._pendingProfileLoaded = false;
} else {
  console.log('✅ Флаг _pendingProfileLoaded не установлен, все в порядке');
}

// Если через 2 секунды Supabase не загрузил тему
setTimeout(() => {
  if (!window.user_settings.baseTheme) {
    const saved = JSON.parse(
      localStorage.getItem('englift_user_settings') || '{}',
    );
    const baseTheme = saved.baseTheme || 'lavender';
    const isDark = saved.dark ?? false;

    console.log('🔄 Fallback: применяем тему из localStorage:', {
      baseTheme,
      isDark,
    });
    window.applyTheme(baseTheme, isDark);
  }
}, 800);

// Таймаут для скрытия индикатора загрузки (на случай проблем)

setTimeout(() => {
  const indicator = document.getElementById('loading-indicator');

  if (indicator && indicator.style.display !== 'none') {
    console.warn('⚠️ Индикатор загрузки все еще виден, скрываем принудительно');

    indicator.style.opacity = '0';

    setTimeout(() => {
      indicator.style.display = 'none';

      console.log('🔒 Индикатор загрузки скрыт принудительно');
    }, 300);
  } else {
    console.log('✅ Индикатор загрузки уже скрыт или не найден');
  }
}, 5000); // Уменьшил до 5 секунд

// Проверяем соединение с Supabase

window.addEventListener('online', () => {
  console.log('Connection restored - checking Supabase');

  if (window.authExports?.auth) {
    // Пытаемся переподключиться к Supabase

    window.authExports.auth.onAuthStateChanged(user => {
      if (user) {
        console.log('Supabase connection restored');

        toast('🟢 Соединение восстановлено', 'success');
      }
    });
  }
});

window.addEventListener('offline', () => {
  console.log('Offline mode activated');

  toast('📴 Оффлайн режим', 'info');
});

// ====================== PWA INSTALL В МЕНЮ ПРОФИЛЯ ======================

let deferredPrompt = null;
const installMenuItem = document.getElementById('dropdown-install-pwa');

// Определяем платформу
function getPlatform() {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return 'ios';
  if (/android/i.test(ua)) return 'android';
  return 'desktop';
}

// Показать инструкцию по ручной установке
function showManualInstallInstructions() {
  const platform = getPlatform();
  let instructions = '';

  if (platform === 'ios') {
    instructions = `
      <div style="text-align: left; line-height: 1.6;">
        <p><strong><span class="material-symbols-outlined" style="vertical-align: middle; margin-right: 4px;">phone_iphone</span>Установка на iPhone/iPad</strong></p>
        <ol style="padding-left: 1.5rem;">
          <li>Нажмите кнопку <strong>«Поделиться»</strong> <span class="material-symbols-outlined" style="vertical-align: middle; margin: 0 4px;">share</span> внизу экрана.</li>
          <li>Прокрутите вниз и выберите <strong>«На экран «Домой»»</strong>.</li>
          <li>Нажмите <strong>«Добавить»</strong> в правом верхнем углу.</li>
        </ol>
        <p style="color: var(--muted); margin-top: 1rem;">Готово! EngLift появится на главном экране как отдельное приложение.</p>
      </div>
    `;
  } else if (platform === 'android') {
    instructions = `
      <div style="text-align: left; line-height: 1.6;">
        <p><strong><span class="material-symbols-outlined" style="vertical-align: middle; margin-right: 4px;">android</span>Установка на Android</strong></p>
        <ol style="padding-left: 1.5rem;">
          <li>Нажмите на меню браузера <strong>⋮</strong> (три точки).</li>
          <li>Выберите <strong>«Добавить на главный экран»</strong>.</li>
          <li>Подтвердите установку.</li>
        </ol>
        <p style="color: var(--muted); margin-top: 1rem;">После этого EngLift будет доступен как приложение.</p>
      </div>
    `;
  } else {
    instructions = `
      <p>На вашем устройстве можно установить EngLift как приложение через меню браузера (обычно «Установить приложение» или «Добавить на главный экран»).</p>
    `;
  }

  // Показываем модальное окно с инструкцией
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop open';
  modal.innerHTML = `
    <div class="modal-box" style="max-width: 500px;">
      <div class="modal-header">
        <h3><span class="material-symbols-outlined" style="vertical-align: middle; margin-right: 4px;">download</span>Установка приложения</h3>
        <button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      ${instructions}
      <div style="display: flex; justify-content: center; margin-top: 1.5rem;">
        <button class="btn btn-primary" onclick="this.closest('.modal-backdrop').remove()">Понятно</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// Показываем пункт меню, если PWA можно установить
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  if (installMenuItem) {
    installMenuItem.style.display = 'flex';
  }
});

// Скрываем после установки
window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  if (installMenuItem) {
    installMenuItem.style.display = 'none';
  }
  toast('Приложение установлено!', 'success', 'celebration');
});

// Обработчик клика по пункту меню
if (installMenuItem) {
  installMenuItem.addEventListener('click', async () => {
    // Если есть нативный промпт
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        toast('Установка...', 'info', 'downloading');
      } else {
        toast('Установка отменена', 'info');
      }
      deferredPrompt = null;
      installMenuItem.style.display = 'none';
    } else {
      // Если промпта нет — показываем инструкцию для iOS/Android
      showManualInstallInstructions();
    }
  });
}

// Если приложение уже запущено в режиме standalone — скрываем пункт навсегда
if (window.matchMedia('(display-mode: standalone)').matches) {
  if (installMenuItem) installMenuItem.style.display = 'none';
}

// ============================================================

// АВТОМАТИЧЕСКАЯ ТИХАЯ СИНХРОНИЗАЦИЯ

// ============================================================

setInterval(
  async () => {
    if (navigator.onLine && window.currentUserId && window.authExports) {
      try {
        // Тихо обновляем данные без показа тоста

        await window.authExports.loadWordsOnce(() => {});

        console.log('🔄 Тихая синхронизация завершена');
      } catch (e) {
        console.warn('⚠️ Ошибка тихой синхронизации:', e);
      }
    }
  },

  10 * 60 * 1000,
); // каждые 10 минут

// ============================================================

// ПЕРИОДИЧЕСКОЕ АВТОСОХРАНЕНИЕ

// ============================================================

setInterval(() => {
  if (window.currentUserId) {
    // Сохраняем профиль

    window.syncSaveProfile?.();

    // Синхронизируем слова, если есть изменения

    if (window.pendingWordUpdates?.size > 0 && navigator.onLine) {
      window.syncPendingWords?.();
    }

    console.log('💾 Автосохранение завершено');
  }
}, 60 * 1000); // каждую минуту

// ============================================================

// ЗАЩИТА ОТ ПОТЕРИ ДАННЫХ ПРИ ЗАКРЫТИИ СТРАНИЦЫ

// ============================================================

// Сохраняем профиль при уходе со страницы

window.addEventListener('beforeunload', () => {
  syncSaveProfile();
});

// Сохраняем профиль при смене видимости (например, переключение вкладок)

// Второй обработчик visibilitychange удален - используется унифицированный выше

// ====================== FLOATING BUTTON SCROLL BEHAVIOR ======================
let lastScrollY = window.scrollY;
const SCROLL_THRESHOLD = 20; // минимальное расстояние для скрытия
const floatingWordBtn = document.getElementById('floating-add-word-btn');
const floatingIdiomBtn = document.getElementById('floating-add-idiom-btn');

function updateFloatingButtonsVisibility() {
  const currentScrollY = window.scrollY;
  const delta = currentScrollY - lastScrollY;

  // Определяем, какая кнопка сейчас активна (по активной вкладке)
  const activeTab = document.querySelector('.tab-pane.active')?.id;
  let activeBtn = null;
  if (activeTab === 'tab-words') activeBtn = floatingWordBtn;
  else if (activeTab === 'tab-idioms') activeBtn = floatingIdiomBtn;

  if (!activeBtn) return;

  if (Math.abs(delta) > SCROLL_THRESHOLD) {
    if (delta > 0) {
      // Скроллим вниз – скрываем
      activeBtn.classList.add('fab-hidden');
    } else {
      // Скроллим вверх – показываем
      activeBtn.classList.remove('fab-hidden');
    }
    lastScrollY = currentScrollY;
  }
}

// Добавляем обработчик скролла с throttle для производительности
let ticking = false;
window.addEventListener('scroll', () => {
  if (!ticking) {
    window.requestAnimationFrame(() => {
      updateFloatingButtonsVisibility();
      ticking = false;
    });
    ticking = true;
  }
});

function updateFloatingButtonsForTab(tabName) {
  if (!floatingWordBtn || !floatingIdiomBtn) {
    console.error('❌ Кнопки не найдены!', {
      floatingWordBtn,
      floatingIdiomBtn,
    });
    return;
  }

  // Сбрасываем lastScrollY, чтобы скролл не мешал
  lastScrollY = window.scrollY;

  if (tabName === 'words') {
    floatingWordBtn.classList.remove('fab-hidden');
    floatingIdiomBtn.classList.add('fab-hidden');
  } else if (tabName === 'idioms') {
    floatingIdiomBtn.classList.remove('fab-hidden');
    floatingWordBtn.classList.add('fab-hidden');
  } else if (tabName === 'friends') {
    floatingWordBtn.classList.add('fab-hidden');
    floatingIdiomBtn.classList.add('fab-hidden');
  } else {
    floatingWordBtn.classList.add('fab-hidden');
    floatingIdiomBtn.classList.add('fab-hidden');
  }
}

// Переключение темы через кнопку в хедере
const themeToggleBtn = document.getElementById('theme-toggle-header');
const themeIcon = document.getElementById('theme-icon');

function updateThemeIcon() {
  const isDark = document.documentElement.classList.contains('dark');
  if (themeIcon) themeIcon.textContent = isDark ? 'light_mode' : 'dark_mode';
}

if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', () => {
    const isDark = document.documentElement.classList.contains('dark');
    const baseTheme = window.user_settings?.baseTheme || 'lavender';
    window.applyTheme(baseTheme, !isDark);
    // Немедленно сохраняем на сервер
    if (window.currentUserId) {
      window.syncProfileToServer();
    }
  });
}

// При загрузке страницы устанавливаем lastScrollY
lastScrollY = window.scrollY;

// Инициализация иконки темы при загрузке DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', updateThemeIcon);
} else {
  updateThemeIcon();
}

// Инициализация видимости кнопок для начальной вкладки
setTimeout(() => {
  updateFloatingButtonsForTab('words');
}, 100);

// PWA мгновенное обновление при активации нового сервис-воркера
if ('serviceWorker' in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      console.log('🔄 Новый сервис-воркер активирован, перезагружаем страницу');
      refreshing = true;
      window.location.reload();
    }
  });
}

// ============================================
// FRIENDS MODULE
// ============================================

let friendsData = { friends: [], requests: [], outgoing: [], leaderboard: [] };
let activeFriendsPanel = 'list';

async function loadFriendsDataNew() {
  if (!window.currentUserId) {
    console.log('⚠️ loadFriendsDataNew: нет userId, пропускаем');
    return;
  }
  try {
    const [friends, incoming, outgoing, leaderboard] = await Promise.all([
      getFriends(window.currentUserId),
      getIncomingRequests(window.currentUserId),
      getOutgoingRequests(window.currentUserId),
      getFriendsLeaderboard(window.currentUserId),
    ]);
    friendsData = {
      friends: friends || [],
      requests: incoming || [],
      outgoing: outgoing || [],
      leaderboard: leaderboard || [],
    };
  } catch (e) {
    console.error('loadFriendsDataNew error', e);
    friendsData = { friends: [], requests: [], outgoing: [], leaderboard: [] };
  }
  renderFriendsTab();
}

function renderFriendsTab() {
  renderFriendsLeaderboard();
  renderFriendsList();
  renderFriendsRequests();
  updateFriendsBadges();
}

// --- ЛИДЕРБОРД ---
function renderFriendsLeaderboard() {
  const container = document.getElementById('friends-leaderboard-list');
  if (!container) return;

  const list = [...friendsData.leaderboard];
  const myId = window.currentUserId;

  if (!list.length) {
    container.innerHTML = `
      <div class="friends-empty">
        <span class="material-symbols-outlined">emoji_events</span>
        <p>Добавь друзей — увидишь лидерборд</p>
      </div>`;
    return;
  }

  const top3 = list.slice(0, 3);
  const rest = list.slice(3);

  // Порядок подиума: 2й слева, 1й по центру, 3й справа
  const podiumOrder = [top3[1] || null, top3[0] || null, top3[2] || null];
  const podiumMedals = [
    '<span class="material-symbols-outlined">workspace_premium</span>', // 2 место
    '<span class="material-symbols-outlined">emoji_events</span>', // 1 место
    '<span class="material-symbols-outlined">military_tech</span>', // 3 место
  ];
  const podiumRanks = [2, 1, 3];

  const top3HTML = `
    <div class="lb-top3">
      ${podiumOrder
        .map((user, i) => {
          if (!user) return '<div></div>';
          const isMe = user.id === myId;
          return `
          <div class="lb-podium-item ${isMe ? 'me' : ''} rank-${podiumRanks[i]}">
            <div class="lb-podium-medal">${podiumMedals[i]}</div>
            <div class="lb-podium-name">${esc(user.username)}${isMe ? ' (ты)' : ''}</div>
            <div class="lb-podium-xp">${user.xp || 0} XP</div>
            <div class="lb-podium-level">lv.${user.level || 1}</div>
          </div>`;
        })
        .join('')}
    </div>`;

  const restHTML = rest
    .map((user, i) => {
      const isMe = user.id === myId;
      return `
      <div class="lb-row ${isMe ? 'me' : ''}">
        <div class="lb-rank">${i + 4}</div>
        <div class="lb-avatar">${user.username?.[0]?.toUpperCase() || '?'}</div>
        <div class="lb-info">
          <div class="lb-name">${esc(user.username)}</div>
          <div class="lb-meta">
            <span class="material-symbols-outlined">menu_book</span>${user.totalwords || user.total_words || 0}
            <span class="material-symbols-outlined">theater_comedy</span>${user.totalidioms || user.total_idioms || 0}
          </div>
        </div>
        <div class="lb-xp">${user.xp || 0} XP</div>
        <div class="lb-streak">
          <span class="material-symbols-outlined">local_fire_department</span>
          ${user.streak || 0}
        </div>
      </div>`;
    })
    .join('');

  container.innerHTML = top3HTML + restHTML;
}

// --- СПИСОК ДРУЗЕЙ ---
function renderFriendsList() {
  const container = document.getElementById('friends-list-content');
  if (!container) return;

  if (!friendsData.friends.length) {
    container.innerHTML = `
      <div class="friends-empty">
        <span class="material-symbols-outlined">people</span>
        <p>Пока нет друзей — найди их через поиск</p>
      </div>`;
    return;
  }

  container.innerHTML = friendsData.friends
    .map(
      friend => `
    <div class="friend-card-new" data-id="${friend.id}">
      <div class="friend-avatar-new">${friend.username?.[0]?.toUpperCase() || '?'}</div>
      <div class="friend-info-new">
        <div class="friend-name-new">${esc(friend.username)}</div>
        <div class="friend-stats-new">
          <span class="friend-stat-chip">
            <span class="material-symbols-outlined">workspace_premium</span>
            lv.${friend.level || 1}
          </span>
          <span class="friend-stat-chip">
            <span class="material-symbols-outlined">bolt</span>
            ${friend.xp || 0} XP
          </span>
          <span class="friend-stat-chip streak-chip">
            <span class="material-symbols-outlined">local_fire_department</span>
            ${friend.streak || 0}
          </span>
          <span class="friend-stat-chip">
            <span class="material-symbols-outlined">menu_book</span>
            ${friend.totalwords || friend.total_words || 0}
          </span>
        </div>
        <div class="friend-extra-new" style="display:none">
          <div class="friend-extra-grid">
            <div class="friend-extra-stat">
              <div class="friend-extra-stat-num">${friend.xp || 0}</div>
              <div class="friend-extra-stat-label">XP</div>
            </div>
            <div class="friend-extra-stat">
              <div class="friend-extra-stat-num">${friend.totalwords || friend.total_words || 0}</div>
              <div class="friend-extra-stat-label">Слов</div>
            </div>
            <div class="friend-extra-stat">
              <div class="friend-extra-stat-num">${friend.totalidioms || friend.total_idioms || 0}</div>
              <div class="friend-extra-stat-label">Идиом</div>
            </div>
            <div class="friend-extra-stat">
              <div class="friend-extra-stat-num">${friend.learnedwords || friend.learned_words || 0}</div>
              <div class="friend-extra-stat-label">Выучено</div>
            </div>
          </div>
          <div style="display:flex;justify-content:flex-end;margin-top:0.5rem">
            <button class="btn-icon btn-danger friend-remove-btn" data-id="${friend.id}" title="Удалить из друзей">
              <span class="material-symbols-outlined">person_remove</span>
            </button>
          </div>
        </div>
      </div>
      <span class="material-symbols-outlined expand-icon" style="color:var(--muted);font-size:1.2rem;flex-shrink:0;transition:transform 0.3s ease">expand_more</span>
    </div>
  `,
    )
    .join('');

  // Раскрытие карточки
  container.querySelectorAll('.friend-card-new').forEach(card => {
    card.addEventListener('click', function (e) {
      if (e.target.closest('.friend-remove-btn')) return;
      this.classList.toggle('expanded');
      const icon = this.querySelector('.expand-icon');
      if (icon)
        icon.style.transform = this.classList.contains('expanded')
          ? 'rotate(180deg)'
          : 'rotate(0deg)';
      const extra = this.querySelector('.friend-extra-new');
      if (extra)
        extra.style.display = this.classList.contains('expanded')
          ? 'block'
          : 'none';

      // Плавно прокручиваем к раскрытой карточке
      if (this.classList.contains('expanded')) {
        setTimeout(() => {
          this.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
      }
    });
  });

  // Удалить друга
  container.querySelectorAll('.friend-remove-btn').forEach(btn => {
    btn.addEventListener('click', async function (e) {
      e.stopPropagation();
      const id = this.dataset.id;

      // Используем обычную модалку как при удалении слов
      pendingDelId = id;
      pendingDeleteType = 'friend';

      document.getElementById('del-modal').classList.add('open');
      document.body.classList.add('modal-open');
    });
  });
}

// --- ЗАЯВКИ ---
function renderFriendsRequests() {
  renderIncomingRequests();
  renderOutgoingRequests();
}

function renderIncomingRequests() {
  const container = document.getElementById('incoming-list');
  const section = document.getElementById('incoming-section');
  if (!container || !section) return;

  if (!friendsData.requests.length) {
    section.style.display = 'none';
    return;
  }
  section.style.display = 'block';

  container.innerHTML = friendsData.requests
    .map(
      req => `
    <div class="request-card">
      <div class="friend-avatar-new" style="width:38px;height:38px;font-size:0.95rem">
        ${req.username?.[0]?.toUpperCase() || '?'}</div>
      <div class="request-info">
        <div class="request-name">${esc(req.username)}</div>
        <div class="request-meta">lv.${req.level || 1} · ${req.xp || 0} XP · ${req.totalwords || req.total_words || 0} слов</div>
      </div>
      <div class="request-actions">
        <button class="btn-icon btn-success accept-req-btn" data-id="${req.id}" title="Принять">
          <span class="material-symbols-outlined">check</span>
        </button>
        <button class="btn-icon btn-danger reject-req-btn" data-id="${req.id}" title="Отклонить">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
    </div>
  `,
    )
    .join('');

  container.querySelectorAll('.accept-req-btn').forEach(btn => {
    btn.addEventListener('click', async function () {
      const friendId = this.dataset.id;
      const userId = window.currentUserId;
      if (!userId) {
        toast('Ошибка: не удалось определить пользователя', 'danger');
        return;
      }
      try {
        await acceptFriendRequest(userId, friendId);
        await loadFriendsDataNew();
        toast('Друг добавлен!', 'success');
      } catch (e) {
        toast('Ошибка', 'danger');
      }
    });
  });

  container.querySelectorAll('.reject-req-btn').forEach(btn => {
    btn.addEventListener('click', async function () {
      const friendId = this.dataset.id;
      const userId = window.currentUserId;
      if (!userId) {
        toast('Ошибка: не удалось определить пользователя', 'danger');
        return;
      }
      try {
        await rejectFriendRequest(userId, friendId);
        await loadFriendsDataNew();
        toast('Заявка отклонена', 'warning');
      } catch (e) {
        toast('Ошибка', 'danger');
      }
    });
  });
}

function renderOutgoingRequests() {
  const container = document.getElementById('outgoing-list');
  const section = document.getElementById('outgoing-section');
  if (!container || !section) return;

  if (!friendsData.outgoing.length) {
    section.style.display = 'none';
    return;
  }
  section.style.display = 'block';

  container.innerHTML = friendsData.outgoing
    .map(
      user => `
    <div class="request-card">
      <div class="friend-avatar-new" style="width:38px;height:38px;font-size:0.95rem">
        ${user.username?.[0]?.toUpperCase() || '?'}</div>
      <div class="request-info">
        <div class="request-name">${esc(user.username)}</div>
        <div class="request-meta">Ожидает ответа...</div>
      </div>
      <div class="request-actions">
        <button class="btn-icon btn-danger cancel-req-btn" data-id="${user.id}" title="Отменить">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
    </div>
  `,
    )
    .join('');

  container.querySelectorAll('.cancel-req-btn').forEach(btn => {
    btn.addEventListener('click', async function () {
      const friendId = this.dataset.id;
      const userId = window.currentUserId;
      if (!userId) {
        toast('Ошибка: не удалось определить пользователя', 'danger');
        return;
      }
      try {
        await rejectFriendRequest(userId, friendId);
        await loadFriendsDataNew();
        toast('Заявка отменена', 'warning');
      } catch (e) {
        toast('Ошибка', 'danger');
      }
    });
  });
}

// --- ПОИСК ---
let friendSearchTimer = null;

document.addEventListener('input', function (e) {
  if (e.target.id !== 'friends-search-input-new') return;
  clearTimeout(friendSearchTimer);
  const q = e.target.value.trim();
  const results = document.getElementById('friends-search-results-new');
  if (!results) return;
  if (!q) {
    results.innerHTML = '';
    return;
  }
  friendSearchTimer = setTimeout(() => doFriendSearch(q), 400);
});

async function doFriendSearch(q) {
  const container = document.getElementById('friends-search-results-new');
  if (!container) return;

  container.innerHTML = '<div class="loading-spinner"></div>';

  try {
    const users = await searchUsers(q, window.currentUserId);

    if (!users || !users.length) {
      container.innerHTML = `
        <div class="friends-empty">
          <span class="material-symbols-outlined">search_off</span>
          <p>Никого не нашли по запросу "${esc(q)}"</p>
        </div>`;
      return;
    }

    container.innerHTML = users
      .map(user => {
        const isFriend = friendsData.friends.some(f => f.id === user.id);
        const isPending = friendsData.outgoing.some(o => o.id === user.id);
        const isIncoming = friendsData.requests.some(r => r.id === user.id);

        let actionBtn = '';
        if (isFriend) {
          actionBtn = `<span style="font-size:0.8rem;color:var(--success);font-weight:700;white-space:nowrap">✓ Друг</span>`;
        } else if (isPending) {
          actionBtn = `<span style="font-size:0.8rem;color:var(--muted);font-weight:700;white-space:nowrap">Отправлено</span>`;
        } else if (isIncoming) {
          actionBtn = `<span style="font-size:0.8rem;color:var(--warning);font-weight:700;white-space:nowrap">Входящая</span>`;
        } else {
          actionBtn = `<button class="btn-icon btn-primary add-friend-btn" data-id="${user.id}" title="Добавить в друзья">
          <span class="material-symbols-outlined">person_add</span>
        </button>`;
        }

        return `
        <div class="search-result-card">
          <div class="friend-avatar-new">${user.username?.[0]?.toUpperCase() || '?'}</div>
          <div class="search-result-info">
            <div class="search-result-name">${esc(user.username)}</div>
            <div class="search-result-meta">lv.${user.level || 1} · ${user.xp || 0} XP · ${user.totalwords || user.total_words || 0} слов</div>
          </div>
          <div class="request-actions">
            ${actionBtn}
          </div>
        </div>
      `;
      })
      .join('');

    // Обработчики кнопок добавления
    container.querySelectorAll('.add-friend-btn').forEach(btn => {
      btn.addEventListener('click', async function () {
        try {
          await sendFriendRequest(window.currentUserId, this.dataset.id);
          await loadFriendsDataNew();

          // Очищаем поиск и скрываем результаты
          const searchInput = document.getElementById(
            'friends-search-input-new',
          );
          const searchResults = document.getElementById(
            'friends-search-results-new',
          );
          if (searchInput) {
            searchInput.value = '';
          }
          if (searchResults) {
            searchResults.innerHTML = '';
          }

          toast('Запрос отправлен!', 'success');
        } catch (e) {
          toast('Ошибка', 'danger');
        }
      });
    });
  } catch (e) {
    console.error('Search error:', e);
    container.innerHTML = `
      <div class="friends-empty">
        <span class="material-symbols-outlined">error</span>
        <p>Ошибка поиска</p>
      </div>`;
  }
}

// --- ПИЛЮЛИ ---
document.addEventListener('click', function (e) {
  const pill = e.target.closest('[data-fpill]');
  if (!pill) return;

  document
    .querySelectorAll('[data-fpill]')
    .forEach(p => p.classList.remove('active'));
  document
    .querySelectorAll('.friends-panel')
    .forEach(p => p.classList.remove('active'));

  pill.classList.add('active');
  activeFriendsPanel = pill.dataset.fpill;

  const panel = document.getElementById(`fpanel-${activeFriendsPanel}`);
  if (panel) panel.classList.add('active');
});

// --- BADGES ---
function updateFriendsBadges() {
  const desktopBadge = document.getElementById('friends-req-badge');
  const mobileBadge = document.getElementById('mobile-friends-req-badge');
  const countBadge = document.getElementById('friends-count-badge');
  const reqCount = document.getElementById('friends-req-count');

  const reqCountNum = friendsData.requests.length;
  const friendsCountNum = friendsData.friends.length;

  // Desktop/Mobile badges
  [desktopBadge, mobileBadge].forEach(badge => {
    if (badge) {
      if (reqCountNum > 0) {
        badge.textContent = reqCountNum > 9 ? '9+' : reqCountNum;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    }
  });

  // Count badges in pills
  if (countBadge) {
    countBadge.textContent = friendsCountNum;
    countBadge.style.display = friendsCountNum > 0 ? 'inline-flex' : 'none';
  }

  if (reqCount) {
    if (reqCountNum > 0) {
      reqCount.textContent = reqCountNum > 9 ? '9+' : reqCountNum;
      reqCount.style.display = 'inline-flex';
    } else {
      reqCount.style.display = 'none';
    }
  }
}

// --- INIT TAB ---
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('tab-friends')) {
    loadFriendsDataNew();
  }
});

switchTab('words');
