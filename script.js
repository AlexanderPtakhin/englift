import { saveWordToDb, deleteWordFromDb, saveAllWordsToDb } from './db.js';
import { getCompleteWordData } from './api.js';
import './auth.js';

// ============================================================
// GRAVATAR FUNCTION
// ============================================================
function getGravatarUrl(email, size = 80) {
  const hash = md5(email.trim().toLowerCase());
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=mp`;
}

// ============================================================
// API LOADING INDICATOR
// ============================================================
window.showApiLoading = function (show) {
  const loadingEl = document.getElementById('api-loading');
  if (loadingEl) {
    loadingEl.style.display = show ? 'flex' : 'none';
  }
};

// ============================================================
// CONSTANTS
// ============================================================
const CONSTANTS = {
  XP_PER_LEVEL: 200,
  STORAGE_KEYS: {
    WORDS: 'englift_v1',
    XP: 'englift_xp',
    STREAK: 'englift_streak',
    SPEECH: 'englift_speech',
    DARK_MODE: 'engliftDark',
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
    AUTO_LANG: 'en-US',
  },
};

// ============================================================
// SPEECH RECOGNITION SUPPORT
// ============================================================
const speechRecognitionSupported = !!(
  window.SpeechRecognition || window.webkitSpeechRecognition
);
let speechRecognition = null;

if (speechRecognitionSupported) {
  speechRecognition = new (
    window.SpeechRecognition || window.webkitSpeechRecognition
  )();
  speechRecognition.lang = CONSTANTS.SPEECH.AUTO_LANG;
  speechRecognition.continuous = false;
  speechRecognition.interimResults = false;
  speechRecognition.maxAlternatives = 1;
}

// Проверка схожести произнесенного слова с правильным
function checkSpeechSimilarity(spoken, correct) {
  if (!spoken || !correct) return false;

  // Точное совпадение
  if (spoken === correct) return true;

  // Удаляем артикли и предлоги для сравнения
  const cleanSpoken = spoken
    .replace(/\b(a|an|the|in|on|at|to|for|of|with)\b/gi, '')
    .trim();
  const cleanCorrect = correct
    .replace(/\b(a|an|the|in|on|at|to|for|of|with)\b/gi, '')
    .trim();

  if (cleanSpoken === cleanCorrect) return true;

  // Проверяем содержит ли одно другое
  if (cleanSpoken.includes(cleanCorrect) || cleanCorrect.includes(cleanSpoken))
    return true;

  // Расстояние Левенштейна для похожих слов
  const distance = levenshteinDistance(cleanSpoken, cleanCorrect);
  const maxLength = Math.max(cleanSpoken.length, cleanCorrect.length);
  const similarity = 1 - distance / maxLength;

  // Считаем правильным если схожесть > 80%
  return similarity > CONSTANTS.SPEECH.SIMILARITY_THRESHOLD;
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

// Показываем предупреждение если Speech Recognition не поддерживается
if (!speechRecognitionSupported) {
  const speechCheckbox = document.querySelector('input[data-ex="speech"]');
  if (speechCheckbox) {
    speechCheckbox.disabled = true;
    speechCheckbox.parentElement.style.opacity = '0.5';
    speechCheckbox.parentElement.title =
      'Ваш браузер не поддерживает распознавание речи (используйте Chrome/Edge)';
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
      <div>${message}</div>
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
const SK = CONSTANTS.STORAGE_KEYS.WORDS;
const XP_K = CONSTANTS.STORAGE_KEYS.XP;
const STREAK_K = CONSTANTS.STORAGE_KEYS.STREAK;
const SPEECH_K = CONSTANTS.STORAGE_KEYS.SPEECH;

// Функция для получения ключа с учётом текущего пользователя
function getStorageKey() {
  // Если пользователь авторизован – добавляем его uid
  const userId = window.authExports?.auth?.currentUser?.uid;
  const key = userId ? `${SK}_${userId}` : SK;
  console.log('getStorageKey():', key, 'userId:', userId);
  return key;
}

let words = [];
let streak = { count: 0, lastDate: null };
let speechCfg = { voiceURI: '', rate: 0.9, pitch: 1.0, accent: 'US' };
let xpData = { xp: 0, level: 1, badges: [] };

function load() {
  try {
    const key = getStorageKey();
    console.log('Loading from localStorage with key:', key);
    words = JSON.parse(localStorage.getItem(key)) || [];
    words.forEach(w => {
      if (!w.stats.nextReview) {
        w.stats.nextReview = new Date().toISOString();
        w.stats.interval = 1;
        w.stats.easeFactor = 2.5;
      }
    });
  } catch (e) {
    words = [];
  }
  try {
    streak = JSON.parse(localStorage.getItem(STREAK_K)) || {
      count: 0,
      lastDate: null,
    };
  } catch (e) {}
  try {
    const s = JSON.parse(localStorage.getItem(SPEECH_K));
    if (s) speechCfg = s;
  } catch (e) {}
  try {
    const x = JSON.parse(localStorage.getItem(XP_K));
    if (x) xpData = x;
  } catch (e) {}
}
function save() {
  try {
    if (!window.authExports?.auth?.currentUser) {
      console.warn('No user, skipping localStorage save');
      return false;
    }
    const key = getStorageKey();
    console.log(
      'Saving to localStorage with key:',
      key,
      'words count:',
      words.length,
    );
    const data = JSON.stringify(words);
    // Проверяем размер данных перед сохранением
    if (data.length > 5 * 1024 * 1024) {
      // 5MB limit
      console.warn('Data size exceeds 5MB, trimming...');
      words = words.slice(0, 1000); // Оставляем только первые 1000 слов
    }
    localStorage.setItem(key, data);

    // Сохраняем в Firebase асинхронно (не блокируем UI)
    saveAllWordsToDb(words).catch(e => {
      console.error('Firebase save error:', e);
    });

    return true;
  } catch (e) {
    console.error('Save error:', e);
    if (e.name === 'QuotaExceededError') {
      toast('❌ Хранилище переполнено. Удалите старые слова.', 'danger');
    } else {
      toast('❌ Ошибка сохранения', 'danger');
    }
    return false;
  }
}

// Делаем save глобальным для доступа из db.js
window.save = save;

function saveXP() {
  localStorage.setItem(XP_K, JSON.stringify(xpData));
}
function saveStreak() {
  localStorage.setItem(STREAK_K, JSON.stringify(streak));
}
function saveSpeech() {
  localStorage.setItem(SPEECH_K, JSON.stringify(speechCfg));
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

function mkWord(en, ru, ex, tags, phonetic = null) {
  return {
    id: generateId(),
    en: en.trim(),
    ru: ru.trim(),
    ex: (ex || '').trim(),
    phonetic: phonetic || null,
    tags: tags || [],
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
    },
  };
}
async function addWord(en, ru, ex, tags, phonetic = null) {
  // Валидация входных данных
  if (!validateEnglish(en)) {
    toast(
      '❌ Неверный формат английского слова. Используйте только буквы, дефисы и апострофы.',
      'danger',
    );
    return false;
  }

  if (!validateRussian(ru)) {
    toast(
      '❌ Неверный формат перевода. Используйте только русские буквы и знаки препинания.',
      'danger',
    );
    return false;
  }

  if (!validateExample(ex)) {
    toast(
      '❌ Неверный формат примера. Проверьте наличие недопустимых символов.',
      'danger',
    );
    return false;
  }

  if (!validateTags(tags)) {
    toast(
      '❌ Неверный формат тегов. Используйте буквы, цифры, дефисы и подчеркивания.',
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

  // Проверка на дубликаты
  if (words.some(w => w.en.toLowerCase() === normalizedEn.toLowerCase())) {
    toast('⚠️ Слово «' + esc(normalizedEn) + '» уже есть в словаре', 'warning');
    return false;
  }

  const newWord = mkWord(
    normalizedEn,
    normalizedRu,
    normalizedEx,
    normalizedTags,
    normalizedPhonetic,
  );
  words.push(newWord);

  // Очищаем кеш рендеринга при добавлении нового слова
  renderCache.clear();

  // Проверяем успешность сохранения
  if (!save()) {
    // Откатываем изменения если сохранение не удалось
    words.pop();
    return false;
  }

  // Показываем индикатор синхронизации
  updateSyncIndicator('syncing');
  toast('🔄 Синхронизация...', 'info');

  // Устанавливаем флаг локальных изменений
  window.hasLocalChanges = true;

  // Асинхронная синхронизация с обработкой ошибок
  try {
    await saveWordToDb(newWord);
    updateSyncIndicator('synced');
    toast('✅ Синхронизировано', 'success');
  } catch (error) {
    console.error('Error saving word to DB:', error);
    updateSyncIndicator('error');
    toast('❌ Ошибка синхронизации', 'danger');
  }

  gainXP(5, 'новое слово');
  visibleLimit = 30; // <-- сброс при добавлении слова

  return true;
}
async function delWord(id) {
  try {
    // Показываем индикатор синхронизации
    updateSyncIndicator('syncing');
    toast('🔄 Удаление...', 'info');

    // Сначала удаляем из Firestore
    await deleteWordFromDb(id);

    // Только потом обновляем локальный массив
    words = words.filter(w => w.id !== id);

    // Очищаем кеш рендеринга при удалении слова
    renderCache.clear();

    // Сбрасываем лимит видимых слов
    visibleLimit = 30;

    save();

    updateSyncIndicator('synced');
    toast('✅ Слово удалено', 'success');
  } catch (error) {
    updateSyncIndicator('error');
    toast('❌ Ошибка удаления: ' + error.message, 'danger');
  }
}
async function updWord(id, data) {
  const w = words.find(w => w.id === id);
  if (w) {
    Object.assign(w, data, { updatedAt: new Date().toISOString() }); // добавляем updatedAt
    save();
    renderCache.clear(); // <-- добавляем очистку кеша рендеринга

    // Устанавливаем флаг локальных изменений
    window.hasLocalChanges = true;

    try {
      await saveWordToDb(w);
    } catch (error) {
      console.error('Error updating word in DB:', error);
      toast('⚠️ Ошибка синхронизации изменений', 'warning');
    }
  }
}
function updStats(id, correct) {
  const w = words.find(w => w.id === id);
  if (!w) return;
  w.stats.shown++;
  w.stats.lastPracticed = new Date().toISOString();
  if (correct) {
    w.stats.correct++;
    w.stats.streak++;
    w.stats.easeFactor = Math.max(1.3, w.stats.easeFactor + 0.1);
    if (w.stats.interval <= 1) {
      w.stats.interval = 3;
    } else if (w.stats.interval <= 3) {
      w.stats.interval = 7;
    } else {
      w.stats.interval = Math.round(w.stats.interval * w.stats.easeFactor);
    }
  } else {
    w.stats.streak = 0;
    w.stats.interval = 1;
    w.stats.easeFactor = Math.max(1.3, w.stats.easeFactor - 0.2);
  }
  const next = new Date();
  next.setDate(next.getDate() + w.stats.interval);
  w.stats.nextReview = next.toISOString();
  const wasLearned = w.stats.learned;
  w.stats.learned = w.stats.streak >= 3;
  if (!wasLearned && w.stats.learned) {
    gainXP(20, 'слово выучено 🌟');
    autoCheckBadges(); // Автоматическая проверка бейджей
  }
  save();
}

// ============================================================
// XP + BADGES
// ============================================================
const XP_PER_LEVEL = CONSTANTS.XP_PER_LEVEL;

const BADGES_DEF = [
  {
    id: 'first_word',
    icon: '🌱',
    name: 'Первое слово',
    desc: 'Добавь 1 слово',
    check: () => words.length >= 1,
  },
  {
    id: 'words_10',
    icon: '📚',
    name: 'Начинающий',
    desc: '10 слов в словаре',
    check: () => words.length >= 10,
  },
  {
    id: 'words_50',
    icon: '📖',
    name: 'Читатель',
    desc: '50 слов в словаре',
    check: () => words.length >= 50,
  },
  {
    id: 'words_100',
    icon: '🏆',
    name: 'Словарь',
    desc: '100 слов в словаре',
    check: () => words.length >= 100,
  },
  {
    id: 'learned_1',
    icon: '⭐',
    name: 'Первый успех',
    desc: 'Выучи 1 слово',
    check: () => words.filter(w => w.stats.learned).length >= 1,
  },
  {
    id: 'learned_10',
    icon: '🌟',
    name: 'Усердный',
    desc: 'Выучи 10 слов',
    check: () => words.filter(w => w.stats.learned).length >= 10,
  },
  {
    id: 'learned_50',
    icon: '💫',
    name: 'Мастер слов',
    desc: 'Выучи 50 слов',
    check: () => words.filter(w => w.stats.learned).length >= 50,
  },
  {
    id: 'streak_3',
    icon: '🔥',
    name: 'На огне',
    desc: '3 дня подряд',
    check: () => streak.count >= 3,
  },
  {
    id: 'streak_7',
    icon: '🚀',
    name: 'Неделя практики',
    desc: '7 дней подряд',
    check: () => streak.count >= 7,
  },
  {
    id: 'streak_30',
    icon: '👑',
    name: 'Легенда',
    desc: '30 дней подряд',
    check: () => streak.count >= 30,
  },
  {
    id: 'xp_500',
    icon: '💎',
    name: 'Алмазный',
    desc: 'Набери 500 XP',
    check: () => xpData.xp + (xpData.level - 1) * XP_PER_LEVEL >= 500,
  },
  {
    id: 'xp_1000',
    icon: '🎖️',
    name: 'Ветеран',
    desc: 'Набери 1000 XP',
    check: () => xpData.xp + (xpData.level - 1) * XP_PER_LEVEL >= 1000,
  },
  {
    id: 'xp_2500',
    icon: '👑',
    name: 'Легенда',
    desc: 'Набери 2500 XP',
    check: () => xpData.xp + (xpData.level - 1) * XP_PER_LEVEL >= 2500,
  },
  {
    id: 'xp_5000',
    icon: '🌟',
    name: 'Мастер',
    desc: 'Набери 5000 XP',
    check: () => xpData.xp + (xpData.level - 1) * XP_PER_LEVEL >= 5000,
  },
  {
    id: 'perfect',
    icon: '🎯',
    name: 'Снайпер',
    desc: 'Сессия без ошибок (5+ слов)',
    check: () => false,
  },
  {
    id: 'level_5',
    icon: '⚡',
    name: 'Прокачан',
    desc: 'Достигни 5 уровня',
    check: () => xpData.level >= 5,
  },
  {
    id: 'level_10',
    icon: '🦅',
    name: 'Орёл',
    desc: 'Достигни 10 уровня',
    check: () => xpData.level >= 10,
  },
  {
    id: 'streak_100',
    icon: '🔥',
    name: 'Непоколебимый',
    desc: '100 дней подряд',
    check: () => streak.count >= 100,
  },
  {
    id: 'words_500',
    icon: '📚',
    name: 'Словарный гений',
    desc: '500 слов в словаре',
    check: () => words.length >= 500,
  },
  {
    id: 'learned_100',
    icon: '🌟',
    name: 'Мастер слов',
    desc: 'Выучи 100 слов',
    check: () => words.filter(w => w.stats.learned).length >= 100,
  },
];

function xpNeeded(lvl) {
  return lvl * XP_PER_LEVEL;
}

function gainXP(amount, reason = '') {
  xpData.xp += amount;
  while (xpData.xp >= xpNeeded(xpData.level)) {
    xpData.xp -= xpNeeded(xpData.level);
    xpData.level++;
    showLevelUpBanner(xpData.level);
  }
  saveXP();
  renderXP();
  showXPToast('+' + amount + ' XP' + (reason ? ' · ' + reason : ''));
}

function checkBadges(perfectSession) {
  let newBadges = [];
  BADGES_DEF.forEach(def => {
    if (xpData.badges.includes(def.id)) return;
    const earned = def.id === 'perfect' ? !!perfectSession : def.check();
    if (earned) {
      xpData.badges.push(def.id);
      newBadges.push(def);
    }
  });
  if (newBadges.length) {
    saveXP();
    newBadges.forEach((b, i) =>
      setTimeout(
        () => toast(b.icon + ' Бейдж: «' + b.name + '»!', 'success'),
        i * 600,
      ),
    );
    renderBadges();
  }
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
  setInterval(() => {
    autoCheckBadges();
  }, 30000); // 30 секунд
}

function showXPToast(msg) {
  const el = document.createElement('div');
  el.className = 'xp-toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

function showLevelUpBanner(lvl) {
  const el = document.createElement('div');
  el.className = 'level-up-banner';
  el.innerHTML =
    '🎉 Уровень ' +
    lvl +
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
  const fill = document.getElementById('xp-bar-fill');
  const num = document.getElementById('xp-num');
  const lvl = document.getElementById('xp-level-lbl');
  if (fill) fill.style.width = pct + '%';
  if (num) num.textContent = xpData.xp + '/' + needed;
  if (lvl) lvl.textContent = '⚡ Ур. ' + xpData.level;
  const stXP = document.getElementById('st-xp');
  const stLvl = document.getElementById('st-level');
  if (stXP) stXP.textContent = xpData.xp + ' / ' + needed + ' XP';
  if (stLvl) stLvl.textContent = 'Уровень ' + xpData.level;
}

function renderBadges() {
  const grid = document.getElementById('badges-grid');
  if (!grid) return;
  grid.innerHTML = BADGES_DEF.map(def => {
    const ok = xpData.badges.includes(def.id);
    return (
      '<div class="badge-card ' +
      (ok ? 'unlocked' : 'locked') +
      '">' +
      '<div class="badge-icon">' +
      def.icon +
      '</div>' +
      '<div class="badge-name">' +
      def.name +
      '</div>' +
      '<div class="badge-desc">' +
      def.desc +
      '</div></div>'
    );
  }).join('');
}

function updStreak() {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (streak.lastDate === today) return;
  if (streak.lastDate === yesterday) streak.count++;
  else streak.count = 1;
  streak.lastDate = today;
  saveStreak();
}

// ============================================================
// SPEECH ENGINE
// ============================================================
const synth = window.speechSynthesis;
let voices = [];
let speechSupported = !!synth;

// Оптимизированный AudioContext для звуков
let audioContext = null;

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

function loadVoices() {
  voices = synth ? synth.getVoices() : [];
  const accentSelect =
    document.getElementById('modal-accent-select') ||
    document.getElementById('accent-select');
  const sel =
    document.getElementById('modal-voice-select') ||
    document.getElementById('voice-select');
  const selectedAccent = accentSelect ? accentSelect.value : 'US';

  // Фильтруем голоса по акценту
  let filteredVoices = voices;
  if (selectedAccent === 'US') {
    filteredVoices = voices.filter(
      v => v.lang.startsWith('en-US') || v.lang.startsWith('en_'),
    );
  } else if (selectedAccent === 'UK') {
    filteredVoices = voices.filter(
      v => v.lang.startsWith('en-GB') || v.lang.startsWith('en_GB'),
    );
  }

  // Если нет голосов для выбранного акцента, используем все английские
  if (filteredVoices.length === 0) {
    filteredVoices = voices.filter(v => v.lang.startsWith('en'));
  }

  // Если все еще нет голосов, используем все доступные
  if (filteredVoices.length === 0) {
    filteredVoices = voices;
  }

  sel.innerHTML = '';
  filteredVoices.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.voiceURI;
    opt.textContent = `${v.name} (${v.lang})`;
    if (v.voiceURI === speechCfg.voiceURI) opt.selected = true;
    sel.appendChild(opt);
  });

  if (!sel.value && sel.options.length) {
    speechCfg.voiceURI = sel.options[0].value;
    saveSpeech();
  }
}

if (synth) {
  synth.onvoiceschanged = loadVoices;
  loadVoices();
} else {
  document.getElementById('no-speech-banner').style.display = 'block';
  const noSpeechStats = document.getElementById('no-speech-stats');
  const noSpeechModal = document.getElementById('no-speech-modal');
  const speechControls = document.getElementById('speech-controls');
  const speechModalControls = document.getElementById('speech-modal-controls');

  if (noSpeechStats) noSpeechStats.style.display = 'block';
  if (noSpeechModal) noSpeechModal.style.display = 'block';
  if (speechControls) speechControls.style.display = 'none';
  if (speechModalControls) speechModalControls.style.display = 'none';
}

function speak(text, onEnd) {
  if (!speechSupported || !text) return;
  synth.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = 'en-US';
  const voice = voices.find(v => v.voiceURI === speechCfg.voiceURI);
  if (voice) utt.voice = voice;
  utt.rate = speechCfg.rate;
  utt.pitch = speechCfg.pitch;
  if (onEnd) utt.onend = onEnd;
  synth.speak(utt);
}

function speakBtn(text, btn) {
  if (!speechSupported) return;
  const wasActive = btn.classList.contains('speaking');
  if (wasActive) {
    synth.cancel();
    btn.classList.remove('speaking');
    btn.innerHTML =
      '<span class="material-symbols-outlined">sound_detection_loud_sound</span>';
    return;
  }
  btn.classList.add('speaking');
  btn.innerHTML =
    '<div class="audio-wave"><span></span><span></span><span></span><span></span><span></span></div>';
  speak(text, () => {
    btn.classList.remove('speaking');
    btn.innerHTML =
      '<span class="material-symbols-outlined">sound_detection_loud_sound</span>';
  });
}

// Speech settings UI
function setupSpeechListeners() {
  const accentSelect =
    document.getElementById('modal-accent-select') ||
    document.getElementById('accent-select');
  const voiceSelect =
    document.getElementById('modal-voice-select') ||
    document.getElementById('voice-select');
  const speedRange =
    document.getElementById('modal-speed-range') ||
    document.getElementById('speed-range');
  const pitchRange =
    document.getElementById('modal-pitch-range') ||
    document.getElementById('pitch-range');
  const speedVal =
    document.getElementById('modal-speed-val') ||
    document.getElementById('speed-val');
  const pitchVal =
    document.getElementById('modal-pitch-val') ||
    document.getElementById('pitch-val');
  const testBtn =
    document.getElementById('modal-test-voice-btn') ||
    document.getElementById('test-voice-btn');

  if (accentSelect) {
    accentSelect.addEventListener('change', e => {
      speechCfg.accent = e.target.value;
      saveSpeech();
      loadVoices(); // Перезагружаем голоса для нового акцента
    });
  }

  if (voiceSelect) {
    voiceSelect.addEventListener('change', e => {
      speechCfg.voiceURI = e.target.value;
      saveSpeech();
    });
  }

  if (speedRange) {
    speedRange.addEventListener('input', e => {
      speechCfg.rate = +e.target.value;
      if (speedVal) speedVal.textContent = e.target.value + 'x';
      saveSpeech();
    });
  }

  if (pitchRange) {
    pitchRange.addEventListener('input', e => {
      speechCfg.pitch = +e.target.value;
      if (pitchVal) pitchVal.textContent = (+e.target.value).toFixed(1);
      saveSpeech();
    });
  }

  if (testBtn) {
    testBtn.addEventListener('click', function () {
      const btn = this;
      const orig = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '🔊 Играет...';
      speak('Test pronunciation. This is how your voice sounds.', () => {
        btn.innerHTML = orig;
        btn.disabled = false;
      });
    });
  }

  // Set initial values
  if (speedRange) speedRange.value = speechCfg.rate;
  if (speedVal) speedVal.textContent = speechCfg.rate + 'x';
  if (pitchRange) pitchRange.value = speechCfg.pitch;
  if (pitchVal) pitchVal.textContent = speechCfg.pitch.toFixed(1);
}

// Initialize listeners when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupSpeechListeners);
} else {
  setupSpeechListeners();
}

// ============================================================
// TOAST
// ============================================================
function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  el.textContent = msg;
  document.getElementById('toast-box').appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity .3s';
    setTimeout(() => el.remove(), 320);
  }, 2600);
}

// ============================================================
// TABS
// ============================================================
function switchTab(name) {
  if (name === 'words') {
    visibleLimit = 30; // <-- сброс при переключении на слова
    renderWotd(); // Вызываем без await, т.к. в синхронной функции
    updateDueBadge();
  }
  if (name === 'practice') {
    renderStats();
  }
  document
    .querySelectorAll('.nav-btn')
    .forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document
    .querySelectorAll('.tab-pane')
    .forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
  if (name === 'stats') renderStats();
  if (name === 'words') renderWords();
}

// Экспортируем функции глобально
window.switchTab = switchTab;
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
  // Синхронизация счетчика слов
  const wordsCount = document.getElementById('words-count');
  const mobileWordsCount = document.getElementById('mobile-words-count');
  if (wordsCount && mobileWordsCount) {
    mobileWordsCount.textContent = wordsCount.textContent;
  }

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

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
  console.log('=== PWA DEBUG START ===');

  // Проверка хедера
  const header = document.querySelector('header');
  const headerContent = document.querySelector('.header-content');
  const installBtn = document.getElementById('install-btn');
  const syncBtn = document.getElementById('sync-indicator');
  const userMenu = document.getElementById('user-menu');
  const headerRight = document.querySelector('.header-right');

  console.log('Header elements found:', {
    header: !!header,
    headerContent: !!headerContent,
    installBtn: !!installBtn,
    syncBtn: !!syncBtn,
    userMenu: !!userMenu,
    headerRight: !!headerRight,
  });

  // Проверка стилей
  if (header) {
    const headerStyles = window.getComputedStyle(header);
    console.log('Header styles:', {
      display: headerStyles.display,
      padding: headerStyles.padding,
      zIndex: headerStyles.zIndex,
      position: headerStyles.position,
    });
  }

  if (headerContent) {
    const contentStyles = window.getComputedStyle(headerContent);
    console.log('Header content styles:', {
      display: contentStyles.display,
      maxWidth: contentStyles.maxWidth,
      margin: contentStyles.margin,
    });
  }

  // Проверка кнопки установки
  if (installBtn) {
    console.log(
      'Install button found, current display:',
      installBtn.style.display,
    );
    installBtn.style.display = 'flex';
    installBtn.style.background = 'red';
    installBtn.style.border = '2px solid yellow';
    console.log('Install button forced visible for debug');
  }

  console.log('=== PWA DEBUG END ===');

  syncMobileNav('words'); // Активная вкладка по умолчанию
  syncBadges(); // Синхронизируем бейджи
  initPWAInstall(); // Инициализация PWA установки
});

// ===== PWA INSTALLATION =====
let deferredPrompt;

// Детектор устройства
function detectDevice() {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;

  // iOS
  if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
    return 'ios';
  }

  // Android
  if (/android/i.test(userAgent)) {
    return 'android';
  }

  // Desktop
  return 'desktop';
}

// Показываем инструкцию для iOS
function showiOSInstallInstructions() {
  const instructions = `
    <div style="text-align: center; line-height: 1.6;">
      <p style="font-size: 1.1rem; margin-bottom: 1rem;"><strong>📱 Установка на iPhone</strong></p>
      <p style="margin-bottom: 1rem;">Чтобы добавить приложение на главный экран:</p>
      <ol style="text-align: left; margin: 0 auto 1rem; padding-left: 1.5rem; max-width: 300px;">
        <li>Нажмите кнопку <strong>"Поделиться" 📤</strong> (внизу)</li>
        <li>Прокрутите вниз и выберите <strong>"На главный экран"</strong></li>
        <li>Нажмите <strong>"Добавить"</strong> в правом верхнем углу</li>
      </ol>
      <p style="color: var(--muted); font-size: 0.9rem;">Приложение будет доступно на главном экране как нативное приложение!</p>
    </div>
  `;

  // Показываем модальное окно с инструкциями
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <h3>📱 Установка на iPhone</h3>
      ${instructions}
      <button class="btn btn-primary" onclick="this.closest('.modal-overlay').remove()">Понятно</button>
    </div>
  `;

  document.body.appendChild(modal);

  // Стили для модального окна
  if (!document.querySelector('#install-modal-styles')) {
    const style = document.createElement('style');
    style.id = 'install-modal-styles';
    style.textContent = `
      .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 1rem;
      }
      .modal-content {
        background: var(--card);
        border-radius: var(--radius);
        padding: 2rem;
        max-width: 400px;
        width: 100%;
        box-shadow: var(--shadow-hover);
      }
      .modal-content h3 {
        margin-bottom: 1rem;
        color: var(--text);
        text-align: center;
      }
      .modal-content button {
        margin-top: 1.5rem;
        width: 100%;
      }
    `;
    document.head.appendChild(style);
  }
}

console.log('=== PWA SCRIPT LOADED ===');
console.log('Device detected:', detectDevice());

// Проверяем элементы сразу
setTimeout(() => {
  console.log('=== PWA TIMEOUT DEBUG START ===');

  const header = document.querySelector('header');
  const headerContent = document.querySelector('.header-content');
  const installBtn = document.getElementById('install-btn');
  const syncBtn = document.getElementById('sync-indicator');
  const userMenu = document.getElementById('user-menu');
  const headerRight = document.querySelector('.header-right');

  console.log('Header elements found (timeout):', {
    header: !!header,
    headerContent: !!headerContent,
    installBtn: !!installBtn,
    syncBtn: !!syncBtn,
    userMenu: !!userMenu,
    headerRight: !!headerRight,
  });

  if (installBtn) {
    console.log(
      'Install button found in timeout, current display:',
      installBtn.style.display,
    );
    installBtn.style.display = 'flex';
    console.log('Install button forced visible in timeout');

    // Добавляем обработчик клика с разной логикой для устройств
    installBtn.addEventListener('click', () => {
      console.log('Install button clicked!');
      const device = detectDevice();

      if (device === 'ios') {
        // Показываем инструкцию для iPhone
        showiOSInstallInstructions();
      } else if (device === 'android') {
        // Пытаемся установить через PWA промпт
        if (!deferredPrompt) {
          toast('PWA установка доступна только в Chrome', 'warning');
          return;
        }

        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(choiceResult => {
          if (choiceResult.outcome === 'accepted') {
            toast('Приложение успешно установлено!', 'success');
            installBtn.style.display = 'none';
          }
          deferredPrompt = null;
        });
      } else {
        // Desktop - показываем общую инструкцию
        toast('Установка доступна на мобильных устройствах', 'info');
      }
    });
  }

  console.log('=== PWA TIMEOUT DEBUG END ===');
}, 1000);

function initPWAInstall() {
  const installBtn = document.getElementById('install-btn');

  // Слушаем событие beforeinstallprompt
  window.addEventListener('beforeinstallprompt', e => {
    // Предотвращаем автоматическое появление промпта
    e.preventDefault();
    // Сохраняем событие для последующего использования
    deferredPrompt = e;
    // Показываем кнопку установки
    if (installBtn) {
      installBtn.style.display = 'flex';
      console.log('PWA install prompt available, button shown');
    }
  });

  // Обработчик клика по кнопке установки
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      console.log('Install button clicked in initPWAInstall!');
      const device = detectDevice();

      if (device === 'ios') {
        // Показываем инструкцию для iPhone
        showiOSInstallInstructions();
      } else if (device === 'android') {
        // Пытаемся установить через PWA промпт
        if (!deferredPrompt) {
          toast('PWA установка доступна только в Chrome', 'warning');
          return;
        }

        try {
          // Показываем промпт установки
          deferredPrompt.prompt();

          // Ждём ответа пользователя
          const { outcome } = await deferredPrompt.userChoice;

          if (outcome === 'accepted') {
            console.log('Пользователь установил PWA');
            toast('Приложение успешно установлено!', 'success');
            installBtn.style.display = 'none';
          } else {
            console.log('Пользователь отменил установку PWA');
          }

          // Очищаем deferredPrompt
          deferredPrompt = null;
        } catch (error) {
          console.error('Ошибка при установке PWA:', error);
          toast('Ошибка установки приложения', 'error');
        }
      } else {
        // Desktop - показываем общую инструкцию
        toast('Установка доступна на мобильных устройствах', 'info');
      }
    });
  }

  // Проверяем, установлено ли уже приложение
  if (window.matchMedia('(display-mode: standalone)').matches) {
    if (installBtn) {
      installBtn.style.display = 'none';
    }
  }
}

// ============================================================
// DARK MODE
// ============================================================
function applyDark(on) {
  document.body.classList.toggle('dark', on);
  const darkToggle = document.getElementById('dark-toggle');
  if (darkToggle) {
    const icon = on ? 'sunny' : 'dark_mode';
    darkToggle.innerHTML = `<span class="material-symbols-outlined">${icon}</span>`;
  }

  // Update dropdown menu theme toggle checkbox
  const themeCheckbox = document.getElementById('theme-checkbox');
  if (themeCheckbox) themeCheckbox.checked = on;

  // Update theme icon next to toggle
  const themeIcon = document.querySelector(
    '#dropdown-theme-toggle .material-symbols-outlined',
  );
  if (themeIcon) {
    const icon = on ? 'sunny' : 'dark_mode';
    themeIcon.textContent = icon;
  }
}

// Theme toggle handlers
const darkToggle = document.getElementById('dark-toggle');
if (darkToggle) {
  darkToggle.addEventListener('click', () => {
    const on = !document.body.classList.contains('dark');
    localStorage.setItem(CONSTANTS.STORAGE_KEYS.DARK_MODE, on);
    applyDark(on);
  });
}

// New theme toggle checkbox handler
const themeCheckbox = document.getElementById('theme-checkbox');
if (themeCheckbox) {
  themeCheckbox.addEventListener('change', e => {
    const on = e.target.checked;
    localStorage.setItem(CONSTANTS.STORAGE_KEYS.DARK_MODE, on);
    applyDark(on);
  });
}

if (localStorage.getItem(CONSTANTS.STORAGE_KEYS.DARK_MODE) === 'true')
  applyDark(true);

// ============================================================
// RENDER WORDS
// ============================================================
let activeFilter = 'all',
  searchQ = '',
  sortBy = 'date-desc',
  tagFilter = '';

// Infinite scroll переменные
let visibleLimit = 30; // сколько слов показываем сейчас
const PAGE_SIZE = 20; // сколько подгружаем за раз
let isLoadingMore = false; // флаг, чтобы не делать множественных запросов
let intersectionObserver = null; // сам наблюдатель

// Кеширование для оптимизации
let renderCache = new Map();
let searchDebounceTimer = null;

// Управление индикатором синхронизации
function updateSyncIndicator(status, message = '') {
  const indicator = document.getElementById('sync-indicator');
  const icon = indicator?.querySelector('.material-symbols-outlined');

  if (!indicator) return;

  // Удаляем все классы статуса
  indicator.classList.remove('syncing', 'synced', 'error', 'offline');

  // Добавляем класс статуса и устанавливаем иконку
  switch (status) {
    case 'syncing':
      indicator.classList.add('syncing');
      icon.textContent = 'sync';
      indicator.title = 'Синхронизация...';
      break;
    case 'synced':
      indicator.classList.add('synced');
      icon.textContent = 'check_circle';
      indicator.title = 'Синхронизировано';
      break;
    case 'error':
      indicator.classList.add('error');
      icon.textContent = 'error';
      indicator.title = message || 'Ошибка синхронизации';
      break;
    case 'offline':
      indicator.classList.add('offline');
      icon.textContent = 'wifi_off';
      indicator.title = 'Офлайн';
      break;
    default:
      icon.textContent = 'sync';
      indicator.title = message || 'Синхронизация...';
  }
}

// Принудительная синхронизация
async function forceSync() {
  if (!window.authExports?.auth?.currentUser) {
    toast('❌ Сначала авторизуйтесь', 'danger');
    return;
  }

  updateSyncIndicator('syncing', 'Принудительная синхронизация...');

  try {
    const localWords = window._getLocalWords?.() || [];
    const result =
      await window.authExports?.syncLocalWordsWithFirestore?.(localWords);

    if (result?.success) {
      if (result.mergedWords) window._setWords(result.mergedWords);
      updateSyncIndicator('synced', 'Синхронизировано');
      toast('✅ Синхронизация завершена', 'success');
    } else {
      throw new Error(result?.error || 'Ошибка синхронизации');
    }
  } catch (error) {
    console.error('Force sync error:', error);
    updateSyncIndicator('error', 'Ошибка синхронизации');
    toast('❌ Ошибка: ' + error.message, 'danger');
  }
}

// Объединение слов с обнаружением конфликтов
function mergeWords(localWords, firestoreWords) {
  const merged = [];
  const conflicts = [];

  // Создаем Map для быстрого доступа
  const firestoreMap = new Map(firestoreWords.map(w => [w.id, w]));

  // Добавляем слова из Firestore
  firestoreWords.forEach(word => {
    merged.push({ ...word });
  });

  // Добавляем локальные слова, которых нет в Firestore
  localWords.forEach(localWord => {
    const firestoreWord = firestoreMap.get(localWord.id);

    if (!firestoreWord) {
      // Новое слово - добавляем
      merged.push({ ...localWord });
    } else if (firestoreWord.updatedAt !== localWord.updatedAt) {
      // Конфликт - слово изменено в обоих местах
      conflicts.push({
        local: localWord,
        remote: firestoreWord,
        resolution: 'remote', // по умолчанию выбираем удаленную версию
      });
    }
  });

  // Показываем уведомление о конфликтах
  if (conflicts.length > 0) {
    showConflictNotification(conflicts);
  }

  return merged;
}

// Показ уведомления о конфликтах
function showConflictNotification(conflicts) {
  const message = `Обнаружено ${conflicts.length} конфликт(ов) при синхронизации. Использована версия из облака.`;
  toast('⚠️ ' + message, 'warning', 5000);

  // Логируем конфликты для отладки
  console.log('Sync conflicts:', conflicts);
}

// Отслеживание состояния сети
function setupNetworkMonitoring() {
  const updateNetworkStatus = () => {
    if (navigator.onLine) {
      updateSyncIndicator('synced', 'Онлайн');
      // Если есть несохранённые изменения, запускаем forceSync
      if (window.hasLocalChanges) {
        forceSync();
        window.hasLocalChanges = false;
      }
    } else {
      updateSyncIndicator('offline', 'Офлайн');
    }
  };

  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);

  // Начальный статус
  updateNetworkStatus();
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
    let list = words;

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

    document.getElementById('words-count').textContent = words.length;
    updateDueBadge();
    document.getElementById('words-subtitle').textContent =
      list.length !== words.length
        ? `(${list.length} из ${words.length})`
        : `— ${words.length} слов`;

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

function getCachedCard(word) {
  // Создаем хеш от всего содержимого слова для корректного кеширования
  const contentHash = `${word.id}_${word.en}_${word.ru}_${word.ex}_${word.tags.join('_')}_${word.stats.learned}_${word.stats.streak}_${word.stats.nextReview}`;

  if (renderCache.has(contentHash)) {
    const cachedHTML = renderCache.get(contentHash);
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = cachedHTML;
    return tempDiv.firstElementChild;
  }

  const card = makeCard(word);
  renderCache.set(contentHash, card.outerHTML);

  // Ограничиваем размер кеша
  if (renderCache.size > CONSTANTS.LIMITS.MAX_CACHE_SIZE) {
    const firstKey = renderCache.keys().next().value;
    renderCache.delete(firstKey);
  }

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
  card.innerHTML = `
    <div class="wc-top">
      <div class="word-icon-container">
        <div class="wc-english">${esc(w.en.charAt(0).toUpperCase() + w.en.slice(1))}</div>
        ${w.stats.learned ? '<span class="material-symbols-outlined done-icon">done_outline</span>' : ''}
      </div>
      <div class="wc-audio-group">
        ${speechSupported ? `<button class="btn-audio audio-card-btn" data-word="${safeAttr(w.en)}" title="Произнести"><span class="material-symbols-outlined">sound_detection_loud_sound</span></button>` : ''}
      </div>
    </div>
    <div class="wc-russian">${esc(w.ru.toLowerCase())}</div>
    ${w.phonetic ? `<div class="wc-phonetic">${esc(w.phonetic)}</div>` : ''}
    ${w.ex ? `<div class="wc-example">${esc(w.ex)}</div>` : ''}
    <div class="wc-footer">
      <div class="wc-streak">${w.stats.streak >= 3 ? '<span class="streak-fire">🔥</span>' : Array.from({ length: 3 }, (_, i) => `<span class="streak-emoji${w.stats.streak > i ? ' active' : ''}">🔥</span>`).join('')}</div>
      <div class="wc-badges">
        ${w.tags.map(t => `<span class="badge-tag tag-filter-btn" data-tag="${esc(t)}">${esc(t)}</span>`).join('')}
      </div>
    </div>
    <div class="wc-actions">
      <div class="wc-actions-left">
        <button class="btn btn-secondary btn-sm edit-btn" data-id="${w.id}"><span class="material-symbols-outlined">edit</span></button>
        <button class="btn btn-danger btn-sm del-btn" data-id="${w.id}"><span class="material-symbols-outlined">delete</span></button>
      </div>
      <div class="wc-actions-right">
        ${(() => {
          const now = new Date();
          const next = new Date(w.stats.nextReview || now);
          const diff = Math.round((next - now) / 86400000);

          if (diff <= 0 && !w.stats.learned) {
            return (
              '<span class="repeat-indicator" data-id="' +
              w.id +
              '" title="Начать изучение слова"><span class="material-symbols-outlined">brightness_alert</span></span>'
            );
          } else if (diff === 1) {
            return '<span class="due-soon"><span class="material-symbols-outlined">refresh</span> Завтра</span>';
          } else if (diff > 1 && diff <= 7) {
            return `<span class="due-soon"><span class="material-symbols-outlined">refresh</span> ${diff}д</span>`;
          } else if (diff > 7) {
            return `<span class="due-later"><span class="material-symbols-outlined">refresh</span> ${diff}д</span>`;
          }
          return '';
        })()}
      </div>
    </div>
  `;
  return card;
}

// Audio buttons on word cards
document.getElementById('words-grid').addEventListener('click', e => {
  if (
    e.target.classList.contains('audio-card-btn') ||
    e.target.closest('.audio-card-btn')
  ) {
    const btn = e.target.classList.contains('audio-card-btn')
      ? e.target
      : e.target.closest('.audio-card-btn');
    speakBtn(btn.dataset.word, btn);
    return;
  }

  // Transcription button handler
  if (
    e.target.classList.contains('transcription-btn') ||
    e.target.closest('.transcription-btn')
  ) {
    const btn = e.target.classList.contains('transcription-btn')
      ? e.target
      : e.target.closest('.transcription-btn');

    // Create tooltip to show transcription
    const existingTooltip = document.querySelector('.transcription-tooltip');
    if (existingTooltip) existingTooltip.remove();

    const tooltip = document.createElement('div');
    tooltip.className = 'transcription-tooltip';
    tooltip.textContent = btn.dataset.phonetic;
    tooltip.style.cssText = `
      position: absolute;
      background: var(--card);
      border: 2px solid var(--primary);
      color: var(--text);
      padding: 0.5rem 0.8rem;
      border-radius: 8px;
      font-family: 'Courier New', monospace;
      font-size: 0.9rem;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 1000;
      pointer-events: none;
      white-space: nowrap;
    `;

    document.body.appendChild(tooltip);

    const rect = btn.getBoundingClientRect();
    tooltip.style.top = rect.bottom + 5 + 'px';
    tooltip.style.left =
      rect.left + rect.width / 2 - tooltip.offsetWidth / 2 + 'px';

    // Remove tooltip after 3 seconds
    setTimeout(() => {
      if (tooltip.parentNode) tooltip.remove();
    }, 3000);

    return;
  }
  const id = e.target.dataset.id;
  if (!id) {
    // Проверяем если кликнули на иконку внутри кнопки
    const btn = e.target.closest('.del-btn, .edit-btn');
    if (btn) {
      const btnId = btn.dataset.id;
      if (!btnId) return;

      if (btn.classList.contains('del-btn')) {
        pendingDelId = btnId;
        document.getElementById('del-modal').classList.add('open');
      }
      if (btn.classList.contains('edit-btn')) {
        const w = words.find(x => x.id === btnId);
        if (!w) return;
        const card = btn.closest('.word-card');
        card.classList.add('editing');
        card.innerHTML = `
          <div class="form-group"><label>English</label><input type="text" class="e-en form-control" value="${safeAttr(w.en)}"></div>
          <div class="form-group"><label>Русский</label><input type="text" class="e-ru form-control" value="${safeAttr(w.ru)}"></div>
          <div class="form-group"><label>Транскрипция</label><input type="text" class="e-phonetic form-control" value="${safeAttr(w.phonetic || '')}"></div>
          <div class="form-group"><label>Пример</label><input type="text" class="e-ex form-control" value="${safeAttr(w.ex)}"></div>
          <div class="form-group"><label>Теги</label><input type="text" class="e-tags form-control" value="${safeAttr(w.tags.join(', '))}"></div>
          <div class="form-actions">
            <button class="btn btn-primary btn-sm save-edit-btn" data-id="${w.id}"><span class="material-symbols-outlined">save</span></button>
            <button class="btn btn-secondary btn-sm cancel-edit-btn"><span class="material-symbols-outlined">close</span></button>
          </div>
        `;

        // Добавляем обработчики для кнопок
        card
          .querySelector('.save-edit-btn')
          .addEventListener('click', function (e) {
            e.stopPropagation();
            const id = this.dataset.id;
            const card = this.closest('.word-card');
            updWord(id, {
              en: card.querySelector('.e-en').value.trim(),
              ru: card.querySelector('.e-ru').value.trim(),
              phonetic: card.querySelector('.e-phonetic').value.trim(),
              ex: card.querySelector('.e-ex').value.trim(),
              tags: normalizeTags(card.querySelector('.e-tags').value),
            });
            toast('✅ Слово обновлено!');
            renderWords();
          });

        card
          .querySelector('.cancel-edit-btn')
          .addEventListener('click', function (e) {
            e.stopPropagation();
            renderWords();
          });
      }
    }
    return;
  }

  if (e.target.classList.contains('del-btn')) {
    pendingDelId = id;
    document.getElementById('del-modal').classList.add('open');
  }
  if (e.target.classList.contains('edit-btn')) {
    const w = words.find(x => x.id === id);
    if (!w) return;
    const card = e.target.closest('.word-card');
    card.classList.add('editing');
    card.innerHTML = `
      <div class="form-group"><label>English</label><input type="text" class="e-en form-control" value="${safeAttr(w.en)}"></div>
      <div class="form-group"><label>Русский</label><input type="text" class="e-ru form-control" value="${safeAttr(w.ru)}"></div>
      <div class="form-group"><label>Транскрипция</label><input type="text" class="e-phonetic form-control" value="${safeAttr(w.phonetic || '')}"></div>
      <div class="form-group"><label>Пример</label><input type="text" class="e-ex form-control" value="${safeAttr(w.ex)}"></div>
      <div class="form-group"><label>Теги</label><input type="text" class="e-tags form-control" value="${safeAttr(w.tags.join(', '))}"></div>
      <div class="form-actions">
        <button class="btn btn-primary btn-sm save-edit-btn" data-id="${w.id}"><span class="material-symbols-outlined">save</span></button>
        <button class="btn btn-secondary btn-sm cancel-edit-btn"><span class="material-symbols-outlined">close</span></button>
      </div>
    `;

    // Добавляем обработчики для кнопок
    card
      .querySelector('.save-edit-btn')
      .addEventListener('click', function (e) {
        e.stopPropagation();
        const id = this.dataset.id;
        const card = this.closest('.word-card');
        updWord(id, {
          en: card.querySelector('.e-en').value.trim(),
          ru: card.querySelector('.e-ru').value.trim(),
          phonetic: card.querySelector('.e-phonetic').value.trim(),
          ex: card.querySelector('.e-ex').value.trim(),
          tags: normalizeTags(card.querySelector('.e-tags').value),
        });
        toast('✅ Слово обновлено!');
        renderWords();
      });

    card
      .querySelector('.cancel-edit-btn')
      .addEventListener('click', function (e) {
        e.stopPropagation();
        renderWords();
      });
  }
});

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

document.getElementById('words-grid').addEventListener('click', e => {
  const tb = e.target.closest('.tag-filter-btn');
  if (!tb) return;
  e.stopPropagation();
  const tag = tb.dataset.tag.toLowerCase();
  tagFilter = tagFilter === tag ? '' : tag;
  visibleLimit = 30; // <-- сброс
  renderWords();
});
// Delete modal
let pendingDelId = null;
let searchTimer = null; // <-- добавляем searchTimer

document.getElementById('search-input').addEventListener('input', e => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchQ = e.target.value;
    visibleLimit = 30; // <-- сброс
    renderWords();
  }, 280);
});
document.getElementById('del-confirm').addEventListener('click', () => {
  if (pendingDelId) {
    const wSnap = words.find(w => w.id === pendingDelId);
    delWord(pendingDelId);
    pendingDelId = null;
    visibleLimit = 30; // <-- сброс
    renderWords();
    // Undo toast
    const undoEl = document.createElement('div');
    undoEl.className = 'toast warning toast-undo';
    undoEl.innerHTML =
      '<span>🗑 «' +
      esc(wSnap ? wSnap.en : 'Слово') +
      '» удалено</span>' +
      '<button class="toast-undo-btn">↩ Отменить</button>';
    document.getElementById('toast-box').appendChild(undoEl);
    let undone = false;
    undoEl.querySelector('.toast-undo-btn').addEventListener('click', () => {
      undone = true;
      if (wSnap) {
        words.push(wSnap);
        save();
        visibleLimit = 30; // <-- сброс
        renderWords();
      }
      undoEl.remove();
      toast('↩️ «' + wSnap.en + '» восстановлено!', 'success');
    });
    setTimeout(() => {
      if (!undone) {
        undoEl.style.opacity = '0';
        undoEl.style.transition = 'opacity .3s';
        setTimeout(() => undoEl.remove(), 320);
      }
    }, 5000);
  }
  document.getElementById('del-modal').classList.remove('open');
});
document
  .getElementById('del-cancel')
  .addEventListener('click', () =>
    document.getElementById('del-modal').classList.remove('open'),
  );

// ============================================================
// ADD WORDS
// ============================================================

// Функция поиска слова в dictionary.json
async function findWordInDictionary(word) {
  try {
    const response = await fetch('dictionary.json');
    if (!response.ok) return null;

    const dictionary = await response.json();
    const foundWord = dictionary.find(
      w => w.en.toLowerCase() === word.toLowerCase(),
    );

    if (foundWord) {
      return {
        en: foundWord.en,
        ru: foundWord.ru,
        phonetic: foundWord.phonetic,
        examples: foundWord.examples || [],
        tags: foundWord.tags || [],
      };
    }
    return null;
  } catch (error) {
    console.error('Error loading dictionary.json:', error);
    return null;
  }
}

// Обработчик кнопки автозаполнения
document.getElementById('auto-fill-btn').addEventListener('click', async () => {
  const enInput = document.getElementById('f-en');
  const englishWord = enInput.value.trim();

  if (!englishWord) {
    toast('⚠️ Сначала введите английское слово', 'warning');
    enInput.focus();
    return;
  }

  // Проверяем, что это действительно английское слово
  if (!validateEnglish(englishWord)) {
    toast('❌ Неверный формат английского слова', 'danger');
    return;
  }

  try {
    console.log('Searching for word:', englishWord);

    // Сначала ищем в dictionary.json
    let data = await findWordInDictionary(englishWord);
    let source = 'dictionary.json';

    // Если не нашли в dictionary.json, используем API
    if (!data) {
      console.log('Word not found in dictionary.json, trying API...');
      data = await window.WordAPI.getCompleteWordData(englishWord);
      source = 'API';
    }

    console.log(`Received data from ${source}:`, data);

    // Заполняем поля полученными данными
    const ruInput = document.getElementById('f-ru');
    const phoneticInput = document.getElementById('f-phonetic');
    const exInput = document.getElementById('f-ex');
    const tagsInput = document.getElementById('f-tags');

    let filledFields = 0;

    if (data.ru && data.ru.trim()) {
      ruInput.value = data.ru;
      ruInput.classList.add('auto-filled');
      filledFields++;
      console.log('Translation filled:', data.ru);
    } else {
      console.log('No translation received');
    }

    if (data.phonetic) {
      phoneticInput.value = data.phonetic;
      phoneticInput.classList.add('auto-filled');
      filledFields++;
      console.log('Phonetic filled:', data.phonetic);
    } else {
      console.log('No phonetic received');
    }

    if (data.examples && data.examples.length > 0) {
      exInput.value = data.examples[0];
      exInput.classList.add('auto-filled');
      filledFields++;
      console.log('Example filled:', data.examples[0]);
    } else {
      console.log('No examples received');
    }

    if (data.tags && data.tags.length > 0) {
      tagsInput.value = data.tags.slice(0, 3).join(', ');
      tagsInput.classList.add('auto-filled');
      filledFields++;
      console.log('Tags filled:', data.tags);
    } else {
      console.log('No tags received');
    }

    if (filledFields > 0) {
      toast(
        `✅ Получено ${filledFields} поля! Проверьте и добавьте слово`,
        'success',
      );
    } else {
      toast(
        '⚠️ Данные не найдены. Попробуйте другое слово или введите вручную',
        'warning',
      );
    }

    // Перемещаем фокус на следующее поле если перевод уже заполнен
    if (data.ru && data.ru.trim()) {
      exInput.focus();
    } else {
      ruInput.focus();
    }
  } catch (error) {
    console.error('API Error:', error);
    toast(`❌ Ошибка: ${error.message}. Попробуйте ввести вручную`, 'danger');
  }
});

document.getElementById('single-form').addEventListener('submit', e => {
  e.preventDefault();

  const en = document.getElementById('f-en').value.trim();
  const ru = document.getElementById('f-ru').value.trim();
  const phonetic = document.getElementById('f-phonetic').value.trim();
  const ex = document.getElementById('f-ex').value.trim();
  const tagsString = document.getElementById('f-tags').value;

  // Нормализация тегов
  const tags = normalizeTags(tagsString);

  // Добавляем слово с валидацией
  const success = addWord(en, ru, ex, tags, phonetic);

  if (success) {
    // Сбрасываем значения полей
    e.target.reset();

    // Сбрасываем стили auto-filled
    const fields = ['f-en', 'f-ru', 'f-phonetic', 'f-ex', 'f-tags'];
    fields.forEach(fieldId => {
      const field = document.getElementById(fieldId);
      if (field) {
        field.classList.remove('auto-filled');
      }
    });

    document.getElementById('f-en').focus();
    toast(`✅ «${esc(en)}» добавлено!`, 'success');

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

let bulkParsed = [];
document.getElementById('parse-bulk-btn').addEventListener('click', () => {
  const lines = document
    .getElementById('bulk-text')
    .value.split('\n')
    .filter(l => l.trim());
  bulkParsed = lines
    .map(l => {
      const parts = l.split('-').map(p => p.trim());
      return { en: parts[0] || '', ru: parts[1] || '' };
    })
    .filter(w => w.en && w.ru);
  const tbody = document.getElementById('bulk-tbody');
  tbody.innerHTML = bulkParsed
    .map(
      (w, i) =>
        `<tr><td><input type="checkbox" class="bchk" data-i="${i}" checked></td><td>${esc(w.en)}</td><td>${esc(w.ru)}</td></tr>`,
    )
    .join('');
  document.getElementById('bulk-preview-wrap').style.display = bulkParsed.length
    ? 'block'
    : 'none';
  document.getElementById('import-bulk-btn').style.display = bulkParsed.length
    ? 'inline-flex'
    : 'none';
  document.getElementById('import-bulk-btn').textContent =
    `✅ Импортировать ${bulkParsed.length} слов`;
});
document.getElementById('import-bulk-btn').addEventListener('click', () => {
  const checked = [...document.querySelectorAll('.bchk:checked')].map(
    c => +c.dataset.i,
  );
  checked.forEach(i =>
    addWord(bulkParsed[i].en, bulkParsed[i].ru, '', [], null),
  );
  document.getElementById('bulk-preview-wrap').style.display = 'none';
  document.getElementById('import-bulk-btn').style.display = 'none';
  document.getElementById('bulk-text').value = '';
  bulkParsed = [];
  toast(`✅ Импортировано ${checked.length} слов!`);
  visibleLimit = 30; // <-- сброс
  renderWords();
  switchTab('words');
});

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('over');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('over');
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', e => {
  if (e.target.files[0]) handleFile(e.target.files[0]);
});

let fileParsed = [];
function handleFile(file) {
  const showPreview = () => {
    const tbody = document.getElementById('file-tbody');
    tbody.innerHTML = fileParsed
      .map(
        (w, i) =>
          `<tr><td><input type="checkbox" class="fchk" data-i="${i}" ${words.find(x => x.en.toLowerCase() === w.en.toLowerCase()) ? '' : 'checked'}></td>` +
          `<td>${esc(w.en)}${words.find(x => x.en.toLowerCase() === w.en.toLowerCase()) ? ` <span style="color:var(--warning);font-size:.75rem">⚠️ уже есть</span>` : ''}</td>` +
          `<td>${esc(w.ru)}</td><td>${esc(w.ex)}</td></tr>`,
      )
      .join('');
    document.getElementById('file-preview-wrap').style.display =
      fileParsed.length ? 'block' : 'none';
    const btn = document.getElementById('import-file-btn');
    const newCount = fileParsed.filter(
      w => !words.find(x => x.en.toLowerCase() === w.en.toLowerCase()),
    ).length;
    btn.style.display = fileParsed.length ? 'block' : 'none';
    btn.textContent = `✅ Импортировать ${newCount} новых слов${fileParsed.length - newCount > 0 ? ' (' + (fileParsed.length - newCount) + ' дублей пропустим)' : ''}`;
  };
  if (file.name.endsWith('.csv')) {
    const reader = new FileReader();
    reader.onload = e => {
      let raw = e.target.result;
      if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
      const lines = raw.split('\n').filter(l => l.trim());
      const hasHdr =
        lines[0].toLowerCase().includes('english') ||
        lines[0].toLowerCase().includes('russian');
      const dataL = hasHdr ? lines.slice(1) : lines;
      const parseL = line => {
        const cols = [];
        let cur = '',
          inQ = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            inQ = !inQ;
          } else if ((ch === ',' || ch === '\t') && !inQ) {
            cols.push(cur.trim());
            cur = '';
          } else cur += ch;
        }
        cols.push(cur.trim());
        return cols.map(s => s.replace(/^"|"$/g, '').replace(/""/g, '"'));
      };
      fileParsed = dataL
        .map(l => {
          const cols = parseL(l);
          return {
            en: cols[0] || '',
            ru: cols[1] || '',
            ex: cols[2] || '',
          };
        })
        .filter(w => w.en && w.ru);
      showPreview();
    };
    reader.readAsText(file, 'UTF-8');
  } else {
    const reader = new FileReader();
    reader.onload = e => {
      const wb = XLSX.read(e.target.result, { type: 'binary' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      fileParsed = data
        .slice(1)
        .map(r => ({
          en: (r[0] || '').toString().trim(),
          ru: (r[1] || '').toString().trim(),
          ex: (r[2] || '').toString().trim(),
        }))
        .filter(w => w.en && w.ru);
      showPreview();
    };
    reader.readAsBinaryString(file);
  }
}
document.getElementById('import-file-btn').addEventListener('click', () => {
  const checked = [...document.querySelectorAll('.fchk:checked')].map(
    c => +c.dataset.i,
  );
  let added = 0;
  checked.forEach(i => {
    const w = fileParsed[i];
    if (!words.find(x => x.en.toLowerCase() === w.en.toLowerCase())) {
      words.push(mkWord(w.en, w.ru, w.ex, w.tags || [], null));
      added++;
    }
  });
  document.getElementById('file-preview-wrap').style.display = 'none';
  document.getElementById('import-file-btn').style.display = 'none';
  fileParsed = [];
  toast(`✅ Импортировано ${added} слов из файла!`);
  visibleLimit = 30; // <-- сброс
  renderWords();
  switchTab('words');
});

// ============================================================
// IMPORT / EXPORT
// ============================================================
let pendingImport = null;

function openIOModal(mode = 'export') {
  document.getElementById('io-export-view').style.display =
    mode === 'export' ? 'block' : 'none';
  document.getElementById('io-import-view').style.display =
    mode === 'import' ? 'block' : 'none';
  document.getElementById('io-modal').classList.add('open');
}
function closeIOModal() {
  document.getElementById('io-modal').classList.remove('open');
  pendingImport = null;
}

document
  .getElementById('dropdown-export')
  .addEventListener('click', () => openIOModal('export'));
document
  .getElementById('dropdown-speech-settings')
  .addEventListener('click', () => {
    document.getElementById('speech-modal').classList.add('open');
    // Sync values when opening modal
    const modalAccent = document.getElementById('modal-accent-select');
    const modalVoice = document.getElementById('modal-voice-select');
    const modalSpeed = document.getElementById('modal-speed-range');
    const modalPitch = document.getElementById('modal-pitch-range');
    const modalSpeedVal = document.getElementById('modal-speed-val');
    const modalPitchVal = document.getElementById('modal-pitch-val');

    if (modalAccent) modalAccent.value = speechCfg.accent || 'US';
    if (modalSpeed) modalSpeed.value = speechCfg.rate;
    if (modalSpeedVal) modalSpeedVal.textContent = speechCfg.rate + 'x';
    if (modalPitch) modalPitch.value = speechCfg.pitch;
    if (modalPitchVal) modalPitchVal.textContent = speechCfg.pitch.toFixed(1);

    // Reload voices for modal
    loadVoices();
  });
document
  .getElementById('io-close-export')
  .addEventListener('click', closeIOModal);
document.getElementById('io-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeIOModal();
});

// Speech modal handlers
document.getElementById('speech-modal-cancel').addEventListener('click', () => {
  document.getElementById('speech-modal').classList.remove('open');
});

document.getElementById('speech-modal-save').addEventListener('click', () => {
  document.getElementById('speech-modal').classList.remove('open');
  toast('Настройки произношения сохранены', 'success');
});

document.getElementById('speech-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) {
    document.getElementById('speech-modal').classList.remove('open');
  }
});

// Back to export view
document.getElementById('io-back-btn').addEventListener('click', () => {
  document.getElementById('io-export-view').style.display = 'block';
  document.getElementById('io-import-view').style.display = 'none';
  pendingImport = null;
});

// Switch to import view
document.getElementById('io-to-import').addEventListener('click', () => {
  document.getElementById('io-export-view').style.display = 'none';
  document.getElementById('io-import-view').style.display = 'block';
});

// Export JSON (full backup)
document.getElementById('io-export-json').addEventListener('click', () => {
  const backup = {
    version: 2,
    exportedAt: new Date().toISOString(),
    words,
    xpData,
    streak,
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json',
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download =
    'englift-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  toast('💾 Бэкап сохранён!', 'success');
  closeIOModal();
});

// Export CSV
document.getElementById('io-export-csv').addEventListener('click', () => {
  if (!words.length) {
    toast('Нет слов', 'warning');
    return;
  }
  const rows = [
    'English,Russian,Example,Tags',
    ...words.map(
      w =>
        `"${(w.en || '').replace(/"/g, '""')}","${(w.ru || '').replace(/"/g, '""')}","${(w.ex || '').replace(/"/g, '""')}","${(w.tags || []).join(';')}"`,
    ),
  ];
  const a = document.createElement('a');
  a.href = URL.createObjectURL(
    new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' }),
  );
  a.download =
    'englift-words-' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  toast('📄 CSV скачан!', 'success');
  closeIOModal();
});
document.getElementById('io-export-anki').addEventListener('click', () => {
  if (!words.length) {
    toast('Нет слов', 'warning');
    return;
  }
  const rows = words.map(w => {
    const front = w.ex
      ? `${w.en}<br><i style="font-size:.85em;opacity:.7">${w.ex}</i>`
      : w.en;
    const tags = w.tags.join(' ');
    return [front, w.ru, tags].join('	');
  });

  const blob = new Blob([rows.join('\n')], {
    type: 'text/tab-separated-values',
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `englift_anki_${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  toast('🃏 Anki файл скачан!', 'success');
});

function handleImportFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    let content = e.target.result;
    // Убираем BOM (utf-8-sig)
    if (content.charCodeAt(0) === 0xfeff) content = content.slice(1);
    const infoEl = document.getElementById('io-import-info');
    const actionsEl = document.getElementById('io-import-actions');
    try {
      if (file.name.endsWith('.json')) {
        const data = JSON.parse(content);
        if (!data.words || !Array.isArray(data.words))
          throw new Error('Неверный формат JSON');
        pendingImport = { type: 'json', data };
        infoEl.innerHTML = `✅ Найдено слов: <b>${esc(data.words.length.toString())}</b>${data.xpData ? ' · XP и бейджи будут восстановлены' : ''}<br><span style="color:var(--danger);font-size:.75rem">⚠️ Текущие слова будут заменены!</span>`;
      } else if (file.name.endsWith('.csv')) {
        const lines = content
          .trim()
          .split('\n')
          .filter(l => l.trim());
        const hasHeader =
          lines[0].toLowerCase().includes('english') ||
          lines[0].toLowerCase().includes('russian');
        const dataLines = hasHeader ? lines.slice(1) : lines;
        const parseCSVLine = line => {
          const cols = [];
          let cur = '',
            inQ = false;
          for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
              inQ = !inQ;
            } else if ((ch === ',' || ch === '\t') && !inQ) {
              cols.push(cur.trim());
              cur = '';
            } else cur += ch;
          }
          cols.push(cur.trim());
          return cols.map(s => s.replace(/^"|"$/g, '').replace(/""/g, '"'));
        };
        const parsed = dataLines
          .map(line => {
            const cols = parseCSVLine(line);
            return {
              en: cols[0] || '',
              ru: cols[1] || '',
              ex: cols[2] || '',
              tags: normalizeTags(cols[3] || ''),
            };
          })
          .filter(w => w.en && w.ru);
        if (!parsed.length) throw new Error('Не найдено слов в CSV');
        pendingImport = { type: 'csv', data: parsed };
        infoEl.innerHTML = `✅ Найдено слов: <b>${esc(parsed.length.toString())}</b><br><span style="color:var(--warning);font-size:.75rem">ℹ️ Слова будут добавлены к существующим</span>`;
      } else {
        throw new Error('Неверный формат файла');
      }
      infoEl.style.display = 'block';
      actionsEl.style.display = 'flex';
    } catch (err) {
      infoEl.innerHTML = '❌ Ошибка: ' + err.message;
      infoEl.style.display = 'block';
      actionsEl.style.display = 'none';
      pendingImport = null;
    }
  };
  reader.readAsText(file, 'utf-8');
}

const importDropZone = document.getElementById('io-drop-zone');
const importFileInput = document.getElementById('io-file-input');

importDropZone.addEventListener('click', () => importFileInput.click());
importFileInput.addEventListener('change', e =>
  handleImportFile(e.target.files[0]),
);

importDropZone.addEventListener('dragover', e => {
  e.preventDefault();
  importDropZone.classList.add('drag-over');
});
importDropZone.addEventListener('dragleave', () =>
  importDropZone.classList.remove('drag-over'),
);
importDropZone.addEventListener('drop', e => {
  e.preventDefault();
  importDropZone.classList.remove('drag-over');
  handleImportFile(e.dataTransfer.files[0]);
});

// Создание резервной копии перед импортом
function createBackup() {
  const backup = {
    words: words,
    xpData: xpData,
    streak: streak,
    speechCfg: speechCfg,
    timestamp: new Date().toISOString(),
    version: '1.0',
  };

  const backupData = JSON.stringify(backup, null, 2);
  const blob = new Blob([backupData], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `englift-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return backup;
}

// Показ предпросмотра импорта с опцией резервного копирования
function showImportPreview(importData) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;

  const content = document.createElement('div');
  content.className = 'modal-content';
  content.style.cssText = `
    background: var(--card);
    border-radius: var(--radius);
    padding: 2rem;
    max-width: 500px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
  `;

  const wordsCount = importData.words ? importData.words.length : 0;
  const currentWordsCount = words.length;

  content.innerHTML = `
    <h2 style="margin-bottom: 1rem; color: var(--text);">📦 Предпросмотр импорта</h2>
    
    <div style="background: var(--bg); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
      <h3 style="margin-bottom: 0.5rem; color: var(--text);">📊 Статистика импорта:</h3>
      <ul style="margin: 0; padding-left: 1.5rem; color: var(--muted);">
        <li>Слов в файле: <strong>${esc(wordsCount.toString())}</strong></li>
        <li>Текущих слов: <strong>${esc(currentWordsCount.toString())}</strong></li>
        ${importData.xpData ? '<li>Содержит данные XP и бейджи</li>' : ''}
        ${importData.streak ? '<li>Содержит данные streak</li>' : ''}
      </ul>
    </div>
    
    <div style="background: var(--warning); color: white; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
      <strong>⚠️ Внимание!</strong><br>
      Текущие слова (${esc(currentWordsCount.toString())}) будут заменены на слова из файла (${esc(wordsCount.toString())}).
    </div>
    
    <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
      <button id="create-backup-btn" class="btn btn-secondary" style="flex: 1;">
        💾 Создать резервную копию
      </button>
      <button id="import-without-backup-btn" class="btn btn-danger" style="flex: 1;">
        🔄 Импортировать без копии
      </button>
    </div>
    
    <button id="cancel-import-btn" class="cancel-edit-btn" style="width: 100%; margin-top: 1rem;">
      <span class="material-symbols-outlined">close</span>
    </button>
  `;

  modal.appendChild(content);
  document.body.appendChild(modal);

  // Обработчики
  document.getElementById('create-backup-btn').addEventListener('click', () => {
    createBackup();
    modal.remove();
    performImport(importData);
  });

  document
    .getElementById('import-without-backup-btn')
    .addEventListener('click', () => {
      if (
        confirm(
          'Вы уверены, что хотите импортировать без создания резервной копии?',
        )
      ) {
        modal.remove();
        performImport(importData);
      }
    });

  document.getElementById('cancel-import-btn').addEventListener('click', () => {
    modal.remove();
  });

  modal.addEventListener('click', e => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

// Выполнение импорта
function performImport(importData) {
  words = importData.words || [];
  if (importData.xpData) {
    xpData = importData.xpData;
    saveXP();
  }
  if (importData.streak) {
    streak = importData.streak;
    saveStreak();
  }
  if (importData.speechCfg) {
    speechCfg = importData.speechCfg;
    saveSpeech();
  }

  save();
  visibleLimit = 30; // <-- сброс
  renderWords();
  renderStats();
  renderXP();
  renderBadges();

  toast(
    '✅ Бэкап восстановлен! ' + words.length + ' слов загружено',
    'success',
  );

  // Закрываем модальное окно импорта
  const importModal = document.getElementById('import-modal');
  if (importModal) {
    importModal.style.display = 'none';
  }
}

// Confirm import
document.getElementById('io-confirm-import').addEventListener('click', () => {
  if (!pendingImport) return;

  if (pendingImport.type === 'json') {
    // Показываем предпросмотр для JSON импорта
    showImportPreview(pendingImport.data);
  } else if (pendingImport.type === 'csv') {
    // Для CSV импортируем сразу (добавляем слова, не заменяем)
    let added = 0;
    pendingImport.data.forEach(w => {
      if (!words.find(x => x.en.toLowerCase() === w.en.toLowerCase())) {
        words.push(mkWord(w.en, w.ru, w.ex, w.tags || [], null));
        added++;
      }
    });
    save();
    renderWords();
    renderStats();
    toast('✅ Добавлено ' + added + ' новых слов!', 'success');
    closeIOModal();
    pendingImport = null;
    fileInput.value = '';
  }
});

// ============================================================
// PRACTICE
// ============================================================
let session = null,
  sIdx = 0,
  sResults = { correct: [], wrong: [] };
let autoPron = true,
  lastSessionConfig = null;

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

document
  .getElementById('start-btn')
  .addEventListener('click', () => startSession());

function startSession(cfg) {
  sResults = { correct: [], wrong: [] };
  sIdx = 0;
  words.forEach(w => delete w._matched);

  let countVal, filterVal, exTypes, types, pool;

  if (cfg && cfg.countVal !== undefined) {
    // Повтор той же сессии
    ({ countVal, filterVal, exTypes } = cfg);
    types = speechSupported ? exTypes : exTypes.filter(t => t !== 'dictation');
    if (!types.length) {
      toast('Диктант недоступен без синтеза речи', 'danger');
      return;
    }
    pool = [...words];
    if (filterVal === 'learning') pool = pool.filter(w => !w.stats.learned);
    if (filterVal === 'due') {
      const now = new Date();
      pool = pool.filter(w => new Date(w.stats.nextReview) <= now);
    }
    if (filterVal === 'random') pool = pool.sort(() => Math.random() - 0.5);
    if (!pool.length) {
      toast('Нет слов для практики', 'warning');
      return;
    }
    const cnt =
      countVal === 'all'
        ? pool.length
        : Math.min(parseInt(countVal), pool.length);
    pool = pool.sort(() => Math.random() - 0.5).slice(0, cnt);
  } else {
    // Новая сессия из настроек
    countVal = document.querySelector('.chip[data-count].on').dataset.count;
    filterVal = document.querySelector('.chip[data-filter-w].on').dataset
      .filterW;
    exTypes = [...document.querySelectorAll('[data-ex]:checked')].map(
      c => c.dataset.ex,
    );
    if (!exTypes.length) {
      toast('Выбери тип упражнений', 'warning');
      return;
    }
    types = speechSupported ? exTypes : exTypes.filter(t => t !== 'dictation');
    if (!types.length) {
      toast('Диктант недоступен без синтеза речи', 'danger');
      return;
    }
    pool = [...words];
    if (filterVal === 'learning') pool = pool.filter(w => !w.stats.learned);
    if (filterVal === 'due') {
      const now = new Date();
      pool = pool.filter(w => new Date(w.stats.nextReview) <= now);
    }
    if (filterVal === 'random') pool = pool.sort(() => Math.random() - 0.5);
    if (!pool.length) {
      toast('Нет слов для практики', 'warning');
      return;
    }
    const count =
      countVal === 'all'
        ? pool.length
        : Math.min(parseInt(countVal), pool.length);
    pool = pool.sort(() => Math.random() - 0.5).slice(0, count);
    lastSessionConfig = { countVal, filterVal, exTypes };
  }

  const dirVal =
    document.querySelector('.chip[data-dir].on')?.dataset.dir || 'both';
  session = { words: pool, exTypes: types, dir: dirVal };
  document.getElementById('practice-setup').style.display = 'none';
  document.getElementById('practice-results').style.display = 'none';
  document.getElementById('practice-ex').style.display = 'block';
  nextExercise();
}

function nextExercise() {
  const hkHint = document.getElementById('hotkeys-hint');
  if (hkHint) hkHint.style.display = 'flex';
  if (sIdx >= session.words.length) {
    showResults();
    return;
  }
  const w = session.words[sIdx];
  const t = session.exTypes[Math.floor(Math.random() * session.exTypes.length)];
  document.getElementById('prog-fill').style.width =
    Math.round((sIdx / session.words.length) * 100) + '%';
  document.getElementById('ex-counter').textContent =
    `${sIdx + 1} / ${session.words.length}`;
  const content = document.getElementById('ex-content');
  const btns = document.getElementById('ex-btns');
  btns.innerHTML = '';

  // Auto-pronounce: вынесено внутрь каждого упражнения (учитывает направление)

  if (t === 'match') {
    // Берём до 6 слов из оставшихся
    const batchSize = Math.min(6, session.words.length - sIdx);
    if (batchSize < 2) {
      // Меньше 2 слов — пропускаем match, берём flash
      session.exTypes = session.exTypes.filter(x => x !== 'match');
      if (!session.exTypes.length) session.exTypes = ['flash'];
      nextExercise();
      return;
    }
    const batch = session.words.slice(sIdx, sIdx + batchSize);
    runMatchExercise(batch, elapsed => {
      sIdx += batchSize;
      toast(`🧩 Все пары за ${elapsed}s!`, 'success');
      nextExercise();
    });
    return;
  }

  if (t === 'flash') {
    document.getElementById('ex-type-lbl').textContent = '🃏 Флеш-карточка';
    const dir = session.dir || 'both';
    const showRU = dir === 'ru-en' || (dir === 'both' && Math.random() > 0.5);
    const frontWord = showRU ? w.ru : w.en;
    const backWord = showRU ? w.en : w.ru;
    content.innerHTML = `
      <div class="flashcard-scene" id="fc-scene">
        <div class="flashcard-inner" id="fc-inner">
          <div class="card-face front">
            <div style="display:flex;align-items:center;gap:.75rem">
              <div class="card-word">${esc(frontWord)}</div>
              ${!showRU && speechSupported ? `<button class="btn-audio" id="fc-audio-btn" title="Произнести">🔊</button>` : ''}
            </div>
            <div class="card-hint" style="font-size:.7rem;opacity:.5">${showRU ? 'RU' : 'EN'} · нажми для перевода</div>
          </div>
          <div class="card-face back">
            <div class="card-trans">${esc(backWord)}</div>
            ${!showRU && w.ex ? `<div class="card-ex">${esc(w.ex)}</div>` : ''}
          </div>
        </div>
      </div>
    `;
    document.getElementById('fc-scene').addEventListener('click', e => {
      if (e.target.closest('.btn-audio')) return;
      document.getElementById('fc-inner').classList.toggle('flipped');
    });
    if (!showRU && speechSupported) {
      document.getElementById('fc-audio-btn').addEventListener('click', e => {
        e.stopPropagation();
        speakBtn(w.en, e.currentTarget);
      });
    }
    if (autoPron && !showRU && speechSupported)
      setTimeout(() => speak(w.en), 300);
    btns.innerHTML = `<button class="btn btn-success" id="knew-btn">💚 Знал</button><button class="btn btn-danger" id="didnt-btn">❤️ Не знал</button>`;
    document.getElementById('knew-btn').onclick = () => recordAnswer(true);
    document.getElementById('didnt-btn').onclick = () => recordAnswer(false);
  } else if (t === 'speech') {
    if (!speechRecognitionSupported) {
      // Если Speech Recognition не поддерживается, заменяем на другое упражнение
      session.exTypes = session.exTypes.filter(x => x !== 'speech');
      if (!session.exTypes.length) session.exTypes = ['flash'];
      nextExercise();
      return;
    }

    document.getElementById('ex-type-lbl').textContent = '🎤 Произнеси вслух';
    content.innerHTML = `
      <div class="speech-exercise">
        <div class="speech-prompt">
          <div class="speech-word">${esc(w.en)}</div>
          <div class="speech-hint">Произнеси это слово вслух на английском</div>
          ${w.ru ? `<div class="speech-translation">Перевод: ${esc(w.ru)}</div>` : ''}
        </div>
        <div class="speech-controls">
          <button class="btn btn-primary btn-lg" id="speech-start-btn">
            <span class="speech-icon">🎤</span>
            <span class="speech-text">Начать запись</span>
          </button>
          <div class="speech-status" id="speech-status"></div>
          <div class="speech-result" id="speech-result"></div>
        </div>
      </div>
    `;

    let isRecording = false;
    let recognitionTimeout = null;

    const startBtn = document.getElementById('speech-start-btn');
    const statusEl = document.getElementById('speech-status');
    const resultEl = document.getElementById('speech-result');

    function startRecording() {
      if (isRecording) return;

      isRecording = true;
      startBtn.classList.add('recording');
      startBtn.querySelector('.speech-icon').textContent = '⏹️';
      startBtn.querySelector('.speech-text').textContent = 'Остановить запись';
      statusEl.innerHTML =
        '<div class="recording-indicator">🔴 Слушаю...</div>';
      resultEl.innerHTML = '';

      // Останавливаем запись через 5 секунд автоматически
      recognitionTimeout = setTimeout(() => {
        stopRecording();
      }, CONSTANTS.SPEECH.RECOGNITION_TIMEOUT);

      speechRecognition.onresult = event => {
        const transcript = event.results[0][0].transcript.toLowerCase().trim();
        const confidence = event.results[0][0].confidence;
        const correctWord = w.en.toLowerCase().trim();

        // Проверяем схожесть слов
        const isCorrect = checkSpeechSimilarity(transcript, correctWord);

        resultEl.innerHTML = `
          <div class="speech-feedback">
            <div class="speech-heard">Ты сказал: "<strong>${esc(transcript)}</strong>"</div>
            <div class="speech-confidence">Уверенность: ${Math.round(confidence * 100)}%</div>
            <div class="speech-verdict ${isCorrect ? 'correct' : 'incorrect'}">
              ${isCorrect ? '✅ Отлично! Правильно!' : '❌ Попробуй еще раз'}
            </div>
          </div>
        `;

        setTimeout(() => {
          recordAnswer(isCorrect);
          if (isCorrect) {
            gainXP(15, 'произношение 🎤'); // Бонус за произношение
          }
          sIdx++;
          nextExercise();
        }, 2000);
      };

      speechRecognition.onerror = event => {
        console.error('Speech recognition error:', event.error);
        statusEl.innerHTML =
          '<div class="speech-error">❌ Ошибка распознавания. Попробуй еще раз.</div>';
        stopRecording();
      };

      speechRecognition.onend = () => {
        stopRecording();
      };

      speechRecognition.start();
    }

    function stopRecording() {
      if (!isRecording) return;

      isRecording = false;
      startBtn.classList.remove('recording');
      startBtn.querySelector('.speech-icon').textContent = '🎤';
      startBtn.querySelector('.speech-text').textContent = 'Начать запись';
      statusEl.innerHTML = '';

      if (recognitionTimeout) {
        clearTimeout(recognitionTimeout);
        recognitionTimeout = null;
      }

      speechRecognition.stop();
    }

    startBtn.addEventListener('click', () => {
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    });

    // Автовоспроизведение слова
    if (autoPron && speechSupported) {
      setTimeout(() => speak(w.en), 500);
    }
  } else if (t === 'multi') {
    document.getElementById('ex-type-lbl').textContent = '🎯 Выбор ответа';
    const dir = session.dir || 'both';
    const isRUEN = dir === 'ru-en' || (dir === 'both' && Math.random() > 0.5);
    const question = isRUEN ? w.ru : w.en;
    const correct = isRUEN ? w.en : w.ru;
    const others = words
      .filter(x => x.id !== w.id)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map(x => (isRUEN ? x.en : x.ru));
    let options = [...others, correct]
      .sort(() => Math.random() - 0.5)
      .slice(0, 4);
    if (!options.includes(correct)) options[0] = correct;
    if (autoPron && !isRUEN && speechSupported)
      setTimeout(() => speak(w.en), 300);
    content.innerHTML = `
      <div class="mc-question">
        ${esc(question)}
        ${!isRUEN && speechSupported ? `<button class="btn-audio" id="mc-audio-btn">🔊</button>` : ''}
      </div>
      <div class="mc-grid">${options.map(o => `<button class="mc-btn" data-ans="${esc(o)}">${esc(o)}</button>`).join('')}</div>
    `;
    if (!isRUEN && speechSupported)
      document.getElementById('mc-audio-btn').addEventListener('click', e => {
        e.stopPropagation();
        speakBtn(w.en, e.currentTarget);
      });
    content.querySelectorAll('.mc-btn').forEach(b =>
      b.addEventListener('click', () => {
        const ok = b.dataset.ans === correct;
        content.querySelectorAll('.mc-btn').forEach(x => {
          x.disabled = true;
          if (x.dataset.ans === correct) x.classList.add('correct');
        });
        if (!ok) b.classList.add('wrong');
        if (ok && speechSupported) speak(w.en);
        setTimeout(() => recordAnswer(ok), 1100);
      }),
    );
  } else if (t === 'type') {
    document.getElementById('ex-type-lbl').textContent = '⌨️ Напиши перевод';
    const dir = session.dir || 'both';
    const isRUEN = dir === 'ru-en' || (dir === 'both' && Math.random() > 0.5);
    const question = isRUEN ? w.ru : w.en;
    const answer = isRUEN ? w.en : w.ru;
    if (autoPron && !isRUEN && speechSupported)
      setTimeout(() => speak(w.en), 300);
    content.innerHTML = `
      <div class="ta-word">
        ${esc(question)}
        ${!isRUEN && speechSupported ? `<button class="btn-audio" id="ta-audio-btn">🔊</button>` : ''}
      </div>
      <div class="ta-row">
        <input type="text" class="form-control" id="ta-input" placeholder="${isRUEN ? 'Напиши по-английски...' : 'Введи перевод...'}" autocomplete="off" autocorrect="off" spellcheck="false">
        <button class="btn btn-primary" id="ta-submit">Проверить</button>
      </div>
      <div class="ta-feedback" id="ta-fb"></div>
    `;
    if (!isRUEN && speechSupported)
      document.getElementById('ta-audio-btn').addEventListener('click', e => {
        e.stopPropagation();
        speakBtn(w.en, e.currentTarget);
      });
    const inp = document.getElementById('ta-input');
    inp.focus();
    const check = () => {
      const val = inp.value.trim().toLowerCase();
      const ok = val === answer.toLowerCase();
      const fb = document.getElementById('ta-fb');
      fb.className = 'ta-feedback ' + (ok ? 'ok' : 'err');
      fb.textContent = ok ? '✅ Верно!' : '❌ Правильно: ' + answer;
      inp.disabled = true;
      document.getElementById('ta-submit').disabled = true;
      if (ok && speechSupported) speak(w.en);
      setTimeout(() => recordAnswer(ok), 1300);
    };
    document.getElementById('ta-submit').onclick = check;
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') check();
    });
  } else if (t === 'dictation') {
    document.getElementById('ex-type-lbl').textContent = '🔊 Диктант';
    content.innerHTML = `
      <div class="dictation-card">
        <div class="dictation-big">🔊</div>
        <div class="dictation-hint">Послушай слово и напиши его по-английски</div>
        <div class="dictation-reveal" id="dict-reveal">${esc(w.en)}</div>
      </div>
      <div class="ta-row" style="margin-top:1rem">
        <input type="text" id="dict-input" placeholder="Напиши слово по-английски..." autocomplete="off" autocorrect="off" spellcheck="false">
        <button class="btn btn-primary" id="dict-submit">Проверить</button>
      </div>
      <div class="ta-feedback" id="dict-fb"></div>
    `;
    // Play immediately
    setTimeout(() => speak(w.en), 200);
    btns.innerHTML = `<button class="btn btn-secondary" id="dict-replay">🔁 Повтор</button>`;
    document.getElementById('dict-replay').onclick = () => speak(w.en);
    const inp = document.getElementById('dict-input');
    inp.focus();
    const check = () => {
      const val = inp.value.trim().toLowerCase();
      const ok = val === w.en.toLowerCase();
      const fb = document.getElementById('dict-fb');
      fb.className = 'ta-feedback ' + (ok ? 'ok' : 'err');
      fb.textContent = ok ? '✅ Верно!' : '❌ Правильно: ' + w.en;
      document.getElementById('dict-reveal').style.display = 'block';
      inp.disabled = true;
      document.getElementById('dict-submit').disabled = true;
      setTimeout(() => recordAnswer(ok), 1400);
    };
    document.getElementById('dict-submit').onclick = check;
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') check();
    });
  }
}

function recordAnswer(correct) {
  playSound(correct ? 'correct' : 'wrong');
  updStats(session.words[sIdx].id, correct);
  updStreak();
  if (correct) sResults.correct.push(session.words[sIdx]);
  else sResults.wrong.push(session.words[sIdx]);
  sIdx++;
  nextExercise();
}

function showResults() {
  const hkHint = document.getElementById('hotkeys-hint');
  if (hkHint) hkHint.style.display = 'none';
  updateDueBadge();
  renderStats();
  document.getElementById('practice-ex').style.display = 'none';
  document.getElementById('practice-results').style.display = 'block';
  const resTotal = sResults.correct.length + sResults.wrong.length;
  const resCorrect = sResults.correct.length;
  const resPct = resTotal ? Math.round((resCorrect / resTotal) * 100) : 0;
  document.getElementById('r-score').textContent = `${resCorrect}/${resTotal}`;
  document.getElementById('r-label').textContent =
    `правильно · ${resPct}% точность`;
  const r = 50,
    cx = 65,
    cy = 65,
    circ = 2 * Math.PI * r;
  document.getElementById('r-ring').innerHTML = `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--border)" stroke-width="10"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--primary)" stroke-width="10"
      stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - resPct / 100)}"
      transform="rotate(-90 ${cx} ${cy})" style="transition:stroke-dashoffset .8s ease"/>
    <text x="${cx}" y="${cy + 7}" text-anchor="middle" font-size="20" font-weight="800" fill="var(--text)">${resPct}%</text>
  `;
  document.getElementById('r-correct').innerHTML = sResults.correct
    .map(w => `<li>${esc(w.en)} — ${esc(w.ru)}</li>`)
    .join('');
  document.getElementById('r-wrong').innerHTML = sResults.wrong
    .map(w => `<li>${esc(w.en)} — ${esc(w.ru)}</li>`)
    .join('');
  spawnConfetti();
  // XP
  const xpCorrect = resCorrect;
  const xpTotal = resTotal;
  if (xpCorrect > 0) gainXP(xpCorrect * 3, xpCorrect + ' правильных');
  const isPerfect = xpTotal >= 5 && xpCorrect === xpTotal;
  if (isPerfect) gainXP(10, 'идеальная сессия 🎯');
  updStreak();
  checkBadges(isPerfect);
}

document.getElementById('again-btn').addEventListener('click', () => {
  document.getElementById('practice-results').style.display = 'none';
  startSession(lastSessionConfig);
});
document.getElementById('setup-btn').addEventListener('click', () => {
  document.getElementById('practice-results').style.display = 'none';
  document.getElementById('practice-setup').style.display = 'block';
});

// ============================================================
// CONFETTI
// ============================================================
function spawnConfetti() {
  document.querySelectorAll('.confetti-piece').forEach(p => p.remove());
  const colors = [
    '#6C63FF',
    '#22C55E',
    '#F59E0B',
    '#EF4444',
    '#8B84FF',
    '#34D399',
  ];
  for (let i = 0; i < 60; i++) {
    const p = document.createElement('div');
    const s = 8 + Math.random() * 8;
    p.className = 'confetti-piece';
    p.style.cssText = `left:${Math.random() * 100}vw;top:-20px;width:${s}px;height:${s}px;background:${colors[Math.floor(Math.random() * colors.length)]};border-radius:${Math.random() > 0.5 ? '50%' : '3px'};animation-duration:${2 + Math.random() * 2}s;animation-delay:${Math.random() * 0.8}s;`;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 4000);
  }
}

// ============================================================
// STATS
// ============================================================
function renderStats() {
  const total = words.length;
  // SRS: due count
  const now = new Date();
  const dueCount = words.filter(
    w => new Date(w.stats.nextReview || now) <= now,
  ).length;
  document.getElementById('st-due').textContent = dueCount;
  const pillEl = document.getElementById('due-pill');
  if (pillEl) pillEl.textContent = dueCount;
  const learned = words.filter(w => w.stats.learned).length;
  const pct = total ? Math.round((learned / total) * 100) : 0;
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const thisWeek = words.filter(w => new Date(w.createdAt) > weekAgo).length;
  document.getElementById('st-total').textContent = total;
  document.getElementById('st-learned').textContent = learned;
  document.getElementById('st-learned-bar').style.width = pct + '%';
  document.getElementById('st-streak').textContent = streak.count;
  document.getElementById('st-week').textContent = thisWeek;

  // Sparkline
  const days = [],
    labels = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toDateString();
    days.push(
      words.filter(w => new Date(w.createdAt).toDateString() === ds).length,
    );
    labels.push(['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][d.getDay()]);
  }
  const maxV = Math.max(...days, 1);
  const pts = days
    .map((v, i) => `${i * (400 / 6)},${80 - (v / maxV) * 65}`)
    .join(' ');
  document.getElementById('spark-svg').innerHTML = `
    <polyline points="${pts}" fill="none" stroke="var(--primary)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    ${days
      .map((v, i) => {
        const x = i * (400 / 6),
          y = 80 - (v / maxV) * 65;
        return `<circle cx="${x}" cy="${y}" r="5" fill="var(--primary)"/>${v ? `<text x="${x}" y="${y - 10}" text-anchor="middle" font-size="13" fill="var(--text)" font-weight="700">${v}</text>` : ''}`;
      })
      .join('')}
  `;
  document.getElementById('spark-labels').innerHTML = labels
    .map(l => `<span>${l}</span>`)
    .join('');

  const practiced = words.filter(w => w.stats.shown > 0);
  const hard = [...practiced]
    .sort(
      (a, b) =>
        a.stats.correct / a.stats.shown - b.stats.correct / b.stats.shown,
    )
    .slice(0, 5);
  const easy = [...practiced]
    .sort(
      (a, b) =>
        b.stats.correct / b.stats.shown - a.stats.correct / a.stats.shown,
    )
    .slice(0, 5);

  document.getElementById('st-hard').innerHTML =
    hard
      .map(
        w => `
    <li>
      <span>${esc(w.en)}</span>
      <div style="display:flex;align-items:center;gap:.5rem">
        ${speechSupported ? `<button class="btn-audio wlist-audio" data-word="${esc(w.en)}" style="width:28px;height:28px;font-size:.8rem">🔊</button>` : ''}
        <span class="cnt">${w.stats.correct}/${w.stats.shown}</span>
      </div>
    </li>
  `,
      )
      .join('') || '<li style="color:var(--muted)">Нет данных</li>';

  document.getElementById('st-easy').innerHTML =
    easy
      .map(
        w => `
    <li>
      <span>${esc(w.en)}</span>
      <div style="display:flex;align-items:center;gap:.5rem">
        ${speechSupported ? `<button class="btn-audio wlist-audio" data-word="${esc(w.en)}" style="width:28px;height:28px;font-size:.8rem">🔊</button>` : ''}
        <span class="cnt">${Math.round((w.stats.correct / w.stats.shown) * 100)}%</span>
      </div>
    </li>
  `,
      )
      .join('') || '<li style="color:var(--muted)">Нет данных</li>';

  // Audio in stats lists
  document.querySelectorAll('.wlist-audio').forEach(btn => {
    btn.addEventListener('click', () => speakBtn(btn.dataset.word, btn));
  });

  // Update speech settings UI
  const speedRange =
    document.getElementById('modal-speed-range') ||
    document.getElementById('speed-range');
  const speedVal =
    document.getElementById('modal-speed-val') ||
    document.getElementById('speed-val');
  const pitchRange =
    document.getElementById('modal-pitch-range') ||
    document.getElementById('pitch-range');
  const pitchVal =
    document.getElementById('modal-pitch-val') ||
    document.getElementById('pitch-val');

  if (speedRange) speedRange.value = speechCfg.rate;
  if (speedVal) speedVal.textContent = speechCfg.rate + 'x';
  if (pitchRange) pitchRange.value = speechCfg.pitch;
  if (pitchVal) pitchVal.textContent = speechCfg.pitch.toFixed(1);

  // Устанавливаем выбранный акцент
  const accentSelect =
    document.getElementById('modal-accent-select') ||
    document.getElementById('accent-select');
  if (accentSelect) {
    accentSelect.value = speechCfg.accent || 'US';
  }

  setTimeout(loadVoices, 100);
}

// ============================================================
// INIT
// ============================================================
// Мост для Firebase
window._getLocalWords = () => words;
window._setWords = async newWords => {
  console.log(
    '_setWords called with',
    newWords.length,
    'words. Current user:',
    window.authExports?.auth?.currentUser?.uid,
  );
  words = newWords;
  visibleLimit = 30; // <-- сброс
  renderWords();
  renderStats();
  renderXP();
  updateDueBadge();
  await renderWotd();
};

// Инициализация индикатора синхронизации и мониторинга сети
document.addEventListener('DOMContentLoaded', () => {
  // Обработчик клика на индикатор синхронизации
  const syncIndicator = document.getElementById('sync-indicator');
  if (syncIndicator) {
    syncIndicator.addEventListener('click', forceSync);
  }

  // Настройка мониторинга сети
  setupNetworkMonitoring();

  // Запуск периодической проверки бейджей
  startBadgeAutoCheck();
});

load();
updStreak();
updateDueBadge();
renderWotd(); // Это вызов в синхронном контексте, оставляем без await
renderWords();
renderXP();
renderBadges();
renderStats();

// === ЗВУКИ ===
function playSound(type) {
  try {
    const ctx = getAudioContext();
    if (type === 'correct') {
      const oscs = [];
      [
        [523.25, 0, 0.12],
        [659.25, 0.06, 0.12],
      ].forEach(([freq, delay, dur]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, ctx.currentTime + delay);
        gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + delay + 0.02);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          ctx.currentTime + delay + dur,
        );
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + dur + 0.05);
        oscs.push(osc);
      });
      oscs[oscs.length - 1].onended = () => {
        // Не закрываем контекст - переиспользуем его
      };
    } else {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(330, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
      osc.onended = () => {
        // Не закрываем контекст - переиспользуем его
      };
    }
  } catch (e) {
    console.error('Error playing sound:', e);
  }
}

// === DUE BADGE ===
function updateDueBadge() {
  const badge = document.getElementById('due-badge');
  if (!badge) return;
  const now = new Date();
  const due = words.filter(
    w => new Date(w.stats.nextReview || now) <= now,
  ).length;
  if (due > 0) {
    badge.textContent = due > 99 ? '99+' : due;
    badge.style.display = 'inline-block';
  } else badge.style.display = 'none';
}

// === WORD OF THE DAY ===
async function renderWotd() {
  const wrap = document.getElementById('wotd-wrap');
  if (!wrap) return;

  console.log('renderWotd called, words.length:', words.length);

  // Показываем загрузку
  wrap.innerHTML = `<div class="wotd-card">
    <div style="text-align: center; padding: 1rem;">
      <div class="loading-spinner" style="margin: 0 auto 0.5rem;"></div>
      <div style="color: var(--muted); font-size: 0.9rem;">Загружаем слово дня...</div>
    </div>
  </div>`;

  try {
    // Получаем случайное слово из банка
    const randomWord = await window.WordAPI.getRandomNewWord();

    if (!randomWord) {
      wrap.innerHTML = `<div class="wotd-card">
        <div style="text-align: center; padding: 1rem; color: var(--muted);">
          Не удалось загрузить слово дня. Попробуйте позже.
        </div>
      </div>`;
      return;
    }

    console.log('Random word from bank:', randomWord);

    // Формируем пример (берём первый из массива)
    const example =
      randomWord.examples && randomWord.examples.length > 0
        ? randomWord.examples[0]
        : '';

    wrap.innerHTML = `<div class="wotd-card">
    <div>
      <div class="wotd-label">☀️ Слово дня</div>
      <div class="wotd-en">${esc(randomWord.en.charAt(0).toUpperCase() + randomWord.en.slice(1))}</div>
      <div class="wotd-ru">${esc(randomWord.ru)}</div>
      ${randomWord.phonetic ? `<div class="wotd-phonetic">${esc(randomWord.phonetic)}</div>` : ''}
      ${example ? `<div class="wotd-ex">${esc(example)}</div>` : ''}
      ${
        randomWord.tags && randomWord.tags.length > 0
          ? `<div class="wotd-tags">${randomWord.tags.map(tag => `<span class="tag">${esc(tag)}</span>`).join(' ')}</div>`
          : ''
      }
    </div>
    <div style="display: flex; gap: 0.5rem;">
      ${speechSupported ? `<button class="wotd-audio" id="wotd-audio-btn"><span class="material-symbols-outlined">volume_up</span></button>` : ''}
      <button class="wotd-add-btn" id="wotd-add-btn"><span class="material-symbols-outlined">add</span></button>
    </div>
  </div>`;

    // Обработчик аудио
    if (speechSupported) {
      const audioBtn = document.getElementById('wotd-audio-btn');
      if (audioBtn) {
        audioBtn.addEventListener('click', function () {
          speakBtn(randomWord.en, this);
        });
      }
    }

    // Обработчик добавления слова
    const addBtn = document.getElementById('wotd-add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        console.log('Trying to add word:', randomWord.en);
        console.log('Current words array:', words);
        console.log('Words length:', words.length);

        // Проверяем, нет ли уже такого слова
        const existingWord = words.find(
          w => w.en.toLowerCase() === randomWord.en.toLowerCase(),
        );
        console.log('Existing word found:', existingWord);

        if (existingWord) {
          toast('Это слово уже есть в словаре!', 'warning');
          return;
        }

        // Добавляем слово
        const newWord = mkWord(
          randomWord.en,
          randomWord.ru,
          example,
          randomWord.tags || [],
          randomWord.phonetic || null,
        );

        words.unshift(newWord);
        save();
        renderWords();
        toast(`Слово "${randomWord.en}" добавлено в словарь!`, 'success');

        // Обновляем слово дня
        setTimeout(renderWotd, 500);
      });
    }
  } catch (error) {
    console.error('Error rendering word of the day:', error);
    wrap.innerHTML = `<div class="wotd-card">
      <div style="text-align: center; padding: 1rem; color: var(--danger);">
        Не удалось загрузить слово дня
      </div>
    </div>`;
  }
}

// === MATCH MADNESS ===
function runMatchExercise(words6, onComplete) {
  const content = document.getElementById('ex-content');
  const btns = document.getElementById('ex-btns');
  btns.innerHTML = '';
  document.getElementById('ex-type-lbl').textContent = '🧩 Найди пары';

  // Перемешиваем переводы отдельно
  const enWords = [...words6];
  const ruWords = [...words6].sort(() => Math.random() - 0.5);

  let selectedEN = null; // { el, word }
  let matched = 0;
  const total = words6.length;
  let startTime = Date.now();

  content.innerHTML = `
    <div class="match-timer" id="match-timer">0.0s</div>
    <div class="match-grid" id="match-grid"></div>
    <div class="match-progress" id="match-progress">0 / ${total} пар</div>
  `;

  // Тикаем таймер
  const timerEl = document.getElementById('match-timer');
  window._matchTimerInterval = setInterval(() => {
    if (timerEl)
      timerEl.textContent = ((Date.now() - startTime) / 1000).toFixed(1) + 's';
  }, 100);

  const grid = document.getElementById('match-grid');

  function renderGrid() {
    grid.innerHTML = '';
    for (let i = 0; i < total; i++) {
      const enW = enWords[i];
      const ruW = ruWords[i];

      // EN кнопка
      const enBtn = document.createElement('button');
      enBtn.className = 'match-btn';
      enBtn.dataset.id = enW.id;
      enBtn.dataset.side = 'en';
      enBtn.textContent = enW.en;
      if (enW._matched) {
        enBtn.classList.add('correct');
        enBtn.disabled = true;
      }

      // RU кнопка
      const ruBtn = document.createElement('button');
      ruBtn.className = 'match-btn';
      ruBtn.dataset.id = ruW.id;
      ruBtn.dataset.side = 'ru';
      ruBtn.textContent = ruW.ru;
      if (ruW._matched) {
        ruBtn.classList.add('correct');
        ruBtn.disabled = true;
      }

      grid.appendChild(enBtn);
      grid.appendChild(ruBtn);
    }
  }
  renderGrid();

  // Делегируем клики
  grid.addEventListener('click', e => {
    const btn = e.target.closest('.match-btn');
    if (!btn || btn.disabled || btn.classList.contains('correct')) return;
    const side = btn.dataset.side;
    const id = btn.dataset.id;

    if (side === 'en') {
      // Снять предыдущий selected EN
      grid
        .querySelectorAll('.match-btn[data-side="en"].selected')
        .forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedEN = { el: btn, id };
      return;
    }

    // Клик по RU — проверяем
    if (!selectedEN) return;

    if (selectedEN.id === id) {
      // Совпадение!
      playSound('correct');
      btn.classList.add('correct');
      selectedEN.el.classList.remove('selected');
      selectedEN.el.classList.add('correct');
      // Помечаем слово как matched
      words6.find(w => w.id === id)._matched = true;
      enWords.find(w => w.id === id)._matched = true;
      ruWords.find(w => w.id === id)._matched = true;
      selectedEN = null;
      matched++;
      document.getElementById('match-progress').textContent =
        `${matched} / ${total} пар`;
      // Обновляем статистику
      updStats(id, true);
      updStreak();
      sResults.correct.push(words6.find(w => w.id === id));

      if (matched === total) {
        clearInterval(window._matchTimerInterval);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        setTimeout(() => {
          // Очищаем _matched
          words6.forEach(w => delete w._matched);
          enWords.forEach(w => delete w._matched);
          ruWords.forEach(w => delete w._matched);
          onComplete(elapsed);
        }, 600);
      }
    } else {
      // Ошибка
      playSound('wrong');
      btn.classList.add('wrong');
      selectedEN.el.classList.add('wrong');
      updStats(selectedEN.id, false);
      sResults.wrong.push(words6.find(w => w.id === selectedEN.id));
      setTimeout(() => {
        btn.classList.remove('wrong');
        if (selectedEN) selectedEN.el.classList.remove('wrong', 'selected');
        selectedEN = null;
      }, 400);
    }
  });
}

// === HOTKEYS ===
document.addEventListener('keydown', e => {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName))
    return;
  const exPane = document.getElementById('practice-ex');
  if (!exPane || exPane.style.display === 'none') return;
  const key = e.key;
  if (key === ' ' || key === 'f' || key === 'F') {
    const fc = document.getElementById('fc-inner');
    if (fc) {
      e.preventDefault();
      fc.classList.toggle('flipped');
    }
    return;
  }
  if (key === 'y' || key === 'Y' || key === 'ArrowRight') {
    const b = document.getElementById('knew-btn');
    if (b && !b.disabled) {
      e.preventDefault();
      b.click();
    }
    return;
  }
  if (key === 'n' || key === 'N' || key === 'ArrowLeft') {
    const b = document.getElementById('didnt-btn');
    if (b && !b.disabled) {
      e.preventDefault();
      b.click();
    }
    return;
  }
  if (['1', '2', '3', '4'].includes(key)) {
    const btns = [...document.querySelectorAll('.mc-btn:not([disabled])')];
    if (btns[+key - 1]) {
      e.preventDefault();
      btns[+key - 1].click();
    }
    return;
  }
  if (key === 'p' || key === 'P') {
    const ab =
      document.getElementById('fc-audio-btn') ||
      document.getElementById('mc-audio-btn') ||
      document.getElementById('ta-audio-btn');
    if (ab) {
      e.preventDefault();
      ab.click();
    }
  }
});

// === EXIT SESSION ===
document.getElementById('ex-exit-btn').addEventListener('click', () => {
  if (!confirm('Выйти из урока?')) return;

  // Останавливаем все активные процессы
  words.forEach(w => delete w._matched);
  clearInterval(window._matchTimerInterval);

  // Останавливаем Speech Recognition если активно
  if (speechRecognition && speechRecognitionSupported) {
    try {
      speechRecognition.stop();
    } catch (e) {
      console.log('Speech recognition already stopped');
    }
  }

  // Останавливаем синтез речи если активен
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }

  document.getElementById('practice-ex').style.display = 'none';
  document.getElementById('practice-setup').style.display = 'block';
  const hkHint = document.getElementById('hotkeys-hint');
  if (hkHint) hkHint.style.display = 'none';
});
// === PWA ===
(function initPWA() {
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
  // Убираем установку manifest href, так как теперь используем отдельный файл

  if ('serviceWorker' in navigator) {
    const swCode = `
      const CACHE = 'englift-v1';
      const ASSETS = [self.location.href];
      self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))));
      self.addEventListener('fetch', e => e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))));
    `;
    const swBlob = new Blob([swCode], { type: 'application/javascript' });
    navigator.serviceWorker
      .register(URL.createObjectURL(swBlob))
      .catch(() => {});
  }
})();

// Очистка данных пользователя (при выходе или перед загрузкой нового пользователя)
window.clearUserData = function () {
  console.log(
    'clearUserData called. Current user:',
    window.authExports?.auth?.currentUser?.uid,
  );
  // Удаляем только данные в памяти, localStorage не трогаем
  words = [];
  renderCache.clear();
  visibleLimit = 30;

  // Очистить DOM
  const grid = document.getElementById('words-grid');
  if (grid) grid.innerHTML = '';
  const empty = document.getElementById('empty-words');
  if (empty) empty.style.display = 'block';

  // Сбросить статистику, бейджи и XP
  xpData = { xp: 0, level: 1, badges: [] };
  streak = { count: 0, lastDate: null };
  speechCfg = { voiceURI: '', rate: 0.9, pitch: 1.0, accent: 'US' };

  // Обновить интерфейс
  renderStats();
  renderXP();
  renderBadges();
  updateDueBadge();
  applyDark(false); // Сбрасываем тему на светлую (по желанию)
  switchTab('words');
};

// ============================================================
// INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // Инициализация
  load();
  renderWords();
  renderStats();
  renderXP();
  renderBadges();
  applyDark(localStorage.getItem('engliftDark') === 'true');
  switchTab('words');
});
