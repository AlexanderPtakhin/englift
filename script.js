import {
  saveWordToDb,
  deleteWordFromDb,
  saveAllWordsToDb,
  saveUserData,
} from './db.js';
import { getCompleteWordData } from './api.js';
import { auth } from './firebase.js';
import './auth.js';

// Инициализация глобальных переменных
window.words = [];

// Daily Goals configuration
const DAILY_GOALS = [
  {
    id: 'add_new',
    label: 'Добавить 5 новых слов',
    target: 5,
    icon: 'add_circle',
    xpReward: 30,
  },
  {
    id: 'review',
    label: 'Повторить 15 слов',
    target: 15,
    icon: 'repeat',
    xpReward: 50,
  },
  {
    id: 'practice_time',
    label: 'Практиковать 10+ минут',
    target: 10, // в минутах
    icon: 'timer',
    xpReward: 40,
  },
];

// Daily progress tracking
window.dailyProgress = {
  add_new: 0,
  review: 0,
  practice_time: 0,
  completed: false,
  lastReset: null,
};

// CEFR levels tracking
window.cefrLevels = {
  A1: 0,
  A2: 0,
  B1: 0,
  B2: 0,
  C1: 0,
  C2: 0,
};

// XSS protection function

// Добавь в самое начало файла (рядом с другими let)
let saveTimeout = null;

// Универсальная функция сохранения всех данных пользователя
function saveAllUserData() {
  if (!auth.currentUser) return;

  const userData = {
    xpData,
    streak,
    speechCfg,
    darkTheme: document.body.classList.contains('dark'),
  };

  saveUserData(auth.currentUser.uid, userData).catch(e =>
    console.error('Error saving all user data:', e),
  );
}

// ============================================================
// DEBUG CONFIGURATION
// ============================================================
const DEBUG =
  location.hostname === 'localhost' || location.hostname === '127.0.0.1';

// Conditional debug logging
const debugLog = (...args) => {
  if (DEBUG) console.log(...args);
};

// ============================================================
// WEEK STATISTICS (простая замена графика)
// ============================================================
function renderWeekChart() {
  debugLog('=== renderWeekChart called ===');

  // Защита от вызова до загрузки слов
  if (!window.words || !Array.isArray(window.words)) {
    debugLog('Words not loaded yet, skipping renderWeekChart');
    return;
  }

  // Ищем контейнер, а не canvas (т.к. canvas заменен на HTML)
  const container = document.querySelector('.week-chart-container');
  debugLog('Container found:', !!container);
  if (!container) return;

  // Ищем существующий HTML или canvas
  const existingContent =
    container.querySelector('[data-week-chart]') ||
    container.querySelector('#weekChart');
  console.log('Existing content found:', !!existingContent);

  console.log(
    'Words available:',
    !!window.words,
    'Count:',
    window.words?.length,
  );

  // Показываем заглушку, если слов еще нет
  if (
    !window.words ||
    !Array.isArray(window.words) ||
    window.words.length === 0
  ) {
    console.log('No window.words data available, showing placeholder');
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
      // Если нет контента, добавляем в начало контейнера
      container.insertAdjacentHTML('afterbegin', placeholderHtml);
    }
    return;
  }

  // Считаем статистику за последние 7 дней
  const stats = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  console.log('Today (local):', today.toLocaleDateString('ru-RU'));

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);

    const count = window.words.filter(w => {
      const dateField = w.stats?.lastPracticed || w.updatedAt || w.createdAt;
      if (!dateField) return false;
      try {
        const wordDate = new Date(dateField);
        // Устанавливаем начало дня в местном времени для точного сравнения
        wordDate.setHours(0, 0, 0, 0);
        const targetDate = new Date(d);
        targetDate.setHours(0, 0, 0, 0);

        const result = wordDate.getTime() === targetDate.getTime();
        if (result && i === 0) {
          console.log(
            `Found word for today ${d.toLocaleDateString('ru-RU')}:`,
            w.en,
            'from date:',
            dateField,
          );
        }
        return result;
      } catch {
        return false;
      }
    }).length;

    console.log(`Day ${d.toLocaleDateString('ru-RU')}: ${count} window.words`);

    stats.push({
      day: d.toLocaleDateString('ru-RU', { weekday: 'short' }),
      date: d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'numeric' }),
      count: count,
    });
  }

  const total = stats.reduce((a, b) => a + b.count, 0);
  console.log('Total window.words:', total, 'Stats array:', stats);

  // Создаем красивый HTML вместо графика
  const html = `
    <div data-week-chart style="padding: 1rem; text-align: center;">
      <div style="
        display: flex; 
        justify-content: space-around; 
        margin-bottom: 1rem; 
        flex-wrap: wrap; 
        gap: 0.25rem;
        align-items: center;
      ">
        ${stats
          .map(
            stat => `
          <div style="
            text-align: center; 
            min-width: 55px; 
            max-width: 75px;
            flex: 1;
          ">
            <div style="font-size: 0.85rem; color: var(--muted); margin-bottom: 0.2rem;">
              ${stat.day}
            </div>
            <div style="
              font-size: 0.75rem; 
              color: var(--muted); 
              opacity: 0.7; 
              margin-bottom: 0.2rem;
            ">
              ${stat.date}
            </div>
            <div style="
              font-size: 1.3rem; 
              font-weight: 700; 
              color: ${stat.count > 0 ? 'var(--primary)' : 'var(--muted)'};
              margin-top: 0.2rem;
            ">
              ${stat.count}
            </div>
          </div>
        `,
          )
          .join('')}
      </div>
      <div style="
        padding: 0.75rem;
        background: var(--bg-secondary);
        border-radius: 8px;
        margin-top: 1rem;
      ">
        <div style="font-size: 0.95rem; color: var(--muted);">
          Всего за 7 дней: 
          <span style="color: var(--primary); font-weight: 700; font-size: 1.2rem;">
            ${total}
          </span>
          слов
        </div>
      </div>
    </div>
  `;

  console.log('Setting innerHTML...');

  if (existingContent) {
    existingContent.outerHTML = html;
  } else {
    // Если нет контента, добавляем в начало контейнера
    container.insertAdjacentHTML('afterbegin', html);
  }

  console.log('renderWeekChart completed');
}

// ============================================================
// GLOBAL FUNCTIONS FOR AUTH.JS
// ============================================================
window.showApiLoading = function (show) {
  const loadingEl = document.getElementById('api-loading');
  if (loadingEl) {
    loadingEl.style.display = show ? 'flex' : 'none';
  }
};

// Hide loading on page load
window.showApiLoading(false);

// ============================================================
// CONSTANTS
// ============================================================
// Разбирает строку с несколькими вариантами перевода (разделители / , ;)
function parseAnswerVariants(str) {
  if (!str) return [];
  return str
    .split(/[\/,;]/)
    .map(s => s.trim().toLowerCase())
    .filter(s => s);
}

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

// Обработчики для карточек упражнений
document.querySelectorAll('.exercise-card').forEach(card => {
  card.addEventListener('click', () => {
    card.classList.toggle('selected');
  });
});

// Показываем предупреждение если Speech Recognition не поддерживается
if (!speechRecognitionSupported) {
  const speechCard = document.querySelector('.exercise-card[data-ex="speech"]');
  if (speechCard) {
    speechCard.style.opacity = '0.5';
    speechCard.style.pointerEvents = 'none';
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
const SK = CONSTANTS.STORAGE_KEYS.WORDS;
const XP_K = CONSTANTS.STORAGE_KEYS.XP;
const STREAK_K = CONSTANTS.STORAGE_KEYS.STREAK;
const SPEECH_K = CONSTANTS.STORAGE_KEYS.SPEECH;

// Функции для получения ключей
function getXPKey() {
  const userId = window.authExports?.auth?.currentUser?.uid;
  return userId
    ? `${CONSTANTS.STORAGE_KEYS.XP}_${userId}`
    : CONSTANTS.STORAGE_KEYS.XP;
}
function getStreakKey() {
  const userId = window.authExports?.auth?.currentUser?.uid;
  return userId
    ? `${CONSTANTS.STORAGE_KEYS.STREAK}_${userId}`
    : CONSTANTS.STORAGE_KEYS.STREAK;
}
function getSpeechKey() {
  const userId = window.authExports?.auth?.currentUser?.uid;
  return userId
    ? `${CONSTANTS.STORAGE_KEYS.SPEECH}_${userId}`
    : CONSTANTS.STORAGE_KEYS.SPEECH;
}

let streak = { count: 0, lastDate: null };
let speechCfg = { voiceURI: '', rate: 0.9, pitch: 1.0, accent: 'US' };
let xpData = { xp: 0, level: 1, badges: [] };
let isSaving = false; // Защита от параллельного сохранения
let badgeCheckInterval = null; // Идентификатор интервала проверки бейджей

// Глобальные функции для обновления XP и streak из других модулей
window.updateXpData = function (newXpData) {
  console.log('updateXpData called with:', newXpData);
  // Полностью заменяем xpData данными из Firebase
  xpData = { ...newXpData }; // Полная замена, а не слияние
  renderXP();
  console.log('xpData after update:', xpData);
};

window.updateStreak = function (newStreak) {
  console.log('updateStreak called with:', newStreak);
  // Полностью заменяем streak данными из Firebase
  streak = { ...newStreak }; // Полная замена, а не слияние
  renderStats(); // streak отображается в статистике
  console.log('streak after update:', streak);
};

// Global function to update daily progress from Firebase
window.updateDailyProgress = function (newDailyProgress) {
  console.log('updateDailyProgress called with:', newDailyProgress);
  // Полностью заменяем dailyProgress данными из Firebase
  window.dailyProgress = { ...newDailyProgress }; // Полная замена, а не слияние
  renderStats(); // Обновляем отображение
  console.log('dailyProgress after update:', window.dailyProgress);
};

// Daily goals reset function
function resetDailyGoalsIfNeeded() {
  const today = new Date().toDateString();
  if (window.dailyProgress.lastReset !== today) {
    window.dailyProgress = {
      add_new: 0,
      review: 0,
      practice_time: 0,
      completed: false,
      lastReset: today,
    };
    // Сохраняем в Firebase для персистентности
    if (auth.currentUser) {
      saveUserData(auth.currentUser.uid, {
        dailyProgress: window.dailyProgress,
      });
    }
  }
}

// Check daily goals completion and give rewards
function checkDailyGoalsCompletion() {
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
    gainXP(totalReward, 'все ежедневные цели выполнены! 🎉');

    // Save to Firebase for persistence
    if (auth.currentUser) {
      saveUserData(auth.currentUser.uid, {
        dailyProgress: window.dailyProgress,
      });
    }

    toast(
      '🎉 Все ежедневные цели выполнены! +' + totalReward + ' XP',
      'success',
    );

    // Trigger confetti animation
    spawnConfetti();
    renderStats(); // Update display
  } else {
    // Also save progress for persistence
    if (auth.currentUser) {
      saveUserData(auth.currentUser.uid, {
        dailyProgress: window.dailyProgress,
      });
    }
  }
}

async function load() {
  try {
    debugLog('Loading words from Firebase only...');
    // Сбрасываем ежедневные цели при загрузке
    resetDailyGoalsIfNeeded();

    // Больше не используем localStorage для слов
    window.words = [];

    // Загрузка будет происходить через Firebase listener в auth.js
    debugLog('Words array initialized, waiting for Firebase sync...');
  } catch (e) {
    window.words = [];
    debugLog('Error in load function:', e);
  }
}

// Миграция переводов примеров из dictionary.json в существующие слова
async function migrateExampleTranslations() {
  console.log('🔄 Starting migration of example translations...');

  try {
    const bank = await window.WordAPI.loadWordBank();
    if (!bank) {
      console.log('❌ No word bank available for migration');
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
        console.log(`✅ Copied examples for "${word.en}"`);
      } else {
        // Если примеры есть, но перевод пустой, пробуем найти соответствующий пример в банке
        word.examples = word.examples.map((ex, idx) => {
          if (ex.translation) return ex; // уже есть перевод

          const bankExample = bankWord.examples[idx];
          if (bankExample && bankExample.translation) {
            ex.translation = bankExample.translation;
            updated++;
            console.log(
              `✅ Updated translation for "${word.en}" example ${idx}`,
            );
          }
          return ex;
        });
      }
      return word;
    });

    if (updated > 0) {
      debouncedSave();
      toast(`Обновлено переводов для ${updated} примеров`, 'success');
      console.log(
        `✅ Migration completed: ${updated} example translations updated`,
      );
    } else {
      console.log('ℹ️ No migrations needed - all examples have translations');
    }
  } catch (error) {
    console.error('❌ Migration error:', error);
  }
}

// Загрузка слов из dictionary.json при первом запуске
async function loadDictionaryFromJson() {
  try {
    console.log('Loading dictionary.json for initial words...');
    const response = await fetch('./dictionary.json');
    if (!response.ok) {
      console.error('Failed to load dictionary.json:', response.status);
      window.words = [];
      return;
    }

    const data = await response.json();
    console.log(`Loaded ${data.length} words from dictionary.json`);

    // Преобразуем в формат приложения
    window.words = data.map(w => ({
      id: generateId(),
      en: w.en,
      ru: w.ru,
      ex: w.examples?.[0]?.text || '',
      examples: w.examples || [],
      phonetic: w.phonetic || '',
      tags: w.tags || [],
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
      },
    }));

    console.log(
      `Initialized ${window.words.length} words from dictionary.json`,
    );

    // Инициализация слов - только через Firebase
    debugLog(`Initialized ${window.words.length} words from dictionary.json`);
    debugLog('Words will be synced to Firebase on user login');
  } catch (error) {
    console.error('Error loading dictionary.json:', error);
    window.words = [];
  }
}

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
    if (!window.authExports?.auth?.currentUser) {
      console.warn('No user, skipping Firebase save');
      return false;
    }
    debugLog('Saving words to Firebase only, count:', window.words.length);
    const data = JSON.stringify(window.words);
    // Проверяем размер данных перед сохранением
    if (data.length > 5 * 1024 * 1024) {
      // 5MB limit
      debugLog('Data size exceeds 5MB, trimming...');
      window.words = window.words.slice(0, 1000); // Оставляем только первые 1000 слов
    }

    debugLog('Saving words to Firebase only, count:', window.words.length);

    // Сохраняем только в Firebase (localStorage больше не используем для слов)
    saveAllWordsToDb(window.words, silent).catch(e => {
      console.error('Firebase save error:', e);
      if (!silent) {
        toast('Ошибка синхронизации', 'danger', 'sync_problem');
      }
    });

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

// Делаем speak глобальным для доступа из HTML
window.speak = speak;

function saveXP() {
  localStorage.setItem(getXPKey(), JSON.stringify(xpData));
  saveAllUserData();
}
function saveStreak() {
  localStorage.setItem(getStreakKey(), JSON.stringify(streak));
  saveAllUserData();
}
function saveSpeech() {
  localStorage.setItem(getSpeechKey(), JSON.stringify(speechCfg));
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

function mkWord(en, ru, ex, tags, phonetic = null, examples = null) {
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
async function addWord(en, ru, ex, tags, phonetic = null, examples = null) {
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

  // Проверка на дубликаты
  if (
    window.words.some(w => w.en.toLowerCase() === normalizedEn.toLowerCase())
  ) {
    toast(
      'Слово «' + esc(normalizedEn) + '» уже есть в словаре',
      'warning',
      'warning',
    );
    return false;
  }

  const newWord = mkWord(
    normalizedEn,
    normalizedRu,
    normalizedEx,
    normalizedTags,
    normalizedPhonetic,
    examples,
  );
  window.words.push(newWord);

  // Очищаем кеш рендеринга при добавлении нового слова
  renderCache.clear();

  // Проверяем успешность сохранения
  if (!save()) {
    // Откатываем изменения если сохранение не удалось
    window.words.pop();
    return false;
  }

  // Показываем индикатор синхронизации
  updateSyncIndicator('syncing');
  toast('Синхронизация...', 'info', 'sync');

  // Устанавливаем флаг локальных изменений
  window.hasLocalChanges = true;

  // Асинхронная синхронизация с обработкой ошибок
  try {
    await saveWordToDb(newWord);
    toast('Синхронизировано', 'success', 'sync');

    // Обновляем прогресс ежедневных целей ТОЛЬКО после успешного сохранения в Firebase
    resetDailyGoalsIfNeeded(); // Ensure proper daily reset
    window.dailyProgress.add_new = (window.dailyProgress.add_new || 0) + 1;
    checkDailyGoalsCompletion();

    gainXP(5, 'новое слово');
    visibleLimit = 30; // <-- сброс при добавлении слова

    // Пересчитываем уровни CEFR
    recalculateCefrLevels();

    // Обновляем график активности после добавления слова
    renderWeekChart();
  } catch (error) {
    console.error('Error saving word to DB:', error);
    toast('Ошибка синхронизации', 'danger', 'sync_problem');

    // Откатываем изменения если сохранение в Firebase не удалось
    window.words.pop();
    renderCache.clear();
    return false;
  }

  return true;
}
async function delWord(id) {
  try {
    // Показываем индикатор синхронизации
    toast('🔄 Удаление...', 'info');

    // Сначала удаляем из Firestore
    await deleteWordFromDb(id);

    // Только потом обновляем локальный массив
    window.words = window.words.filter(w => w.id !== id);

    // Очищаем кеш рендеринга при удалении слова
    renderCache.clear();

    // Сбрасываем лимит видимых слов
    visibleLimit = 30;

    debouncedSave();

    toast('Слово удалено', 'success', 'delete');

    // Пересчитываем уровни CEFR после удаления
    recalculateCefrLevels();

    // Обновляем график активности после удаления
    renderWeekChart();
  } catch (error) {
    toast('Ошибка удаления: ' + error.message, 'danger', 'delete');
  }
}
async function updWord(id, data) {
  const w = window.words.find(w => w.id === id);
  if (w) {
    Object.assign(w, data, { updatedAt: new Date().toISOString() }); // добавляем updatedAt
    debouncedSave();
    renderCache.clear(); // <-- добавляем очистку кеша рендеринга

    // Устанавливаем флаг локальных изменений
    window.hasLocalChanges = true;

    try {
      await saveWordToDb(w);
    } catch (error) {
      console.error('Error updating word in DB:', error);
      toast('Ошибка синхронизации изменений', 'warning', 'sync_problem');
    }

    // Пересчитываем уровни CEFR после обновления
    recalculateCefrLevels();
  }
}
function updStats(id, correct) {
  const w = window.words.find(w => w.id === id);
  if (!w) return;
  w.stats.shown++;
  w.stats.lastPracticed = new Date().toISOString();
  if (correct) {
    w.stats.correct++;
    w.stats.streak++;
    w.stats.easeFactor = Math.max(
      1.3,
      Math.min(2.5, w.stats.easeFactor + 0.05),
    );
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
  debouncedSave();

  // Обновляем график активности после практики
  renderWeekChart();
}

// ============================================================
// XP + BADGES
// ============================================================
const XP_PER_LEVEL = CONSTANTS.XP_PER_LEVEL;

const BADGES_DEF = [
  {
    id: 'first_word',
    icon: 'emoji_nature',
    name: 'Первое слово',
    desc: 'Добавь 1 слово',
    check: () => window.words.length >= 1,
  },
  {
    id: 'words_10',
    icon: 'menu_book',
    name: 'Начинающий',
    desc: '10 слов в словаре',
    check: () => window.words.length >= 10,
  },
  {
    id: 'words_50',
    icon: 'auto_stories',
    name: 'Читатель',
    desc: '50 слов в словаре',
    check: () => window.words.length >= 50,
  },
  {
    id: 'words_100',
    icon: 'workspace_premium',
    name: 'Словарь',
    desc: '100 слов в словаре',
    check: () => window.words.length >= 100,
  },
  {
    id: 'learned_1',
    icon: 'star',
    name: 'Первый успех',
    desc: 'Выучи 1 слово',
    check: () => window.words.filter(w => w.stats.learned).length >= 1,
  },
  {
    id: 'learned_10',
    icon: 'stars',
    name: 'Усердный',
    desc: 'Выучи 10 слов',
    check: () => window.words.filter(w => w.stats.learned).length >= 10,
  },
  {
    id: 'learned_50',
    icon: 'auto_awesome',
    name: 'Мастер слов',
    desc: 'Выучи 50 слов',
    check: () => window.words.filter(w => w.stats.learned).length >= 50,
  },
  {
    id: 'streak_3',
    icon: 'local_fire_department',
    name: 'На огне',
    desc: '3 дня подряд',
    check: () => streak.count >= 3,
  },
  {
    id: 'streak_7',
    icon: 'rocket_launch',
    name: 'Неделя практики',
    desc: '7 дней подряд',
    check: () => streak.count >= 7,
  },
  {
    id: 'streak_30',
    icon: 'workspace_premium',
    name: 'Легенда',
    desc: '30 дней подряд',
    check: () => streak.count >= 30,
  },
  {
    id: 'xp_500',
    icon: 'diamond',
    name: 'Алмазный',
    desc: 'Набери 500 XP',
    check: () => xpData.xp + (xpData.level - 1) * XP_PER_LEVEL >= 500,
  },
  {
    id: 'xp_1000',
    icon: 'military_tech',
    name: 'Ветеран',
    desc: 'Набери 1000 XP',
    check: () => xpData.xp + (xpData.level - 1) * XP_PER_LEVEL >= 1000,
  },
  {
    id: 'xp_2500',
    icon: 'workspace_premium',
    name: 'Легенда',
    desc: 'Набери 2500 XP',
    check: () => xpData.xp + (xpData.level - 1) * XP_PER_LEVEL >= 2500,
  },
  {
    id: 'xp_5000',
    icon: 'star',
    name: 'Мастер',
    desc: 'Набери 5000 XP',
    check: () => xpData.xp + (xpData.level - 1) * XP_PER_LEVEL >= 5000,
  },
  {
    id: 'perfect',
    icon: 'target',
    name: 'Снайпер',
    desc: 'Сессия без ошибок (5+ слов)',
    check: () => false,
  },
  {
    id: 'level_5',
    icon: 'bolt',
    name: 'Прокачан',
    desc: 'Достигни 5 уровня',
    check: () => xpData.level >= 5,
  },
  {
    id: 'level_10',
    icon: 'flight_takeoff',
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
    check: () => window.words.length >= 500,
  },
  {
    id: 'learned_100',
    icon: '🌟',
    name: 'Мастер слов',
    desc: 'Выучи 100 слов',
    check: () => window.words.filter(w => w.stats.learned).length >= 100,
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
  if (badgeCheckInterval) clearInterval(badgeCheckInterval);
  badgeCheckInterval = setInterval(() => {
    autoCheckBadges();
  }, 30000); // 30 секунд
}

function showXPToast(msg) {
  const el = document.createElement('div');
  el.className = 'xp-toast';
  el.innerHTML = msg; // Используем innerHTML вместо textContent для поддержки HTML
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

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
      (def.icon.includes('🔥')
        ? def.icon
        : `<span class="material-symbols-outlined">${def.icon}</span>`) +
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
  debouncedSave();
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
setupSpeechListeners();

// ============================================================
// TOAST
// ============================================================
function toast(msg, type = '', icon = '') {
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');

  if (icon) {
    el.innerHTML = `<span class="material-symbols-outlined" style="font-size: 1.2em; vertical-align: middle; margin-right: 8px;">${icon}</span>${msg}`;
  } else {
    el.textContent = msg;
  }

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

// Update due badge function
function updateDueBadge() {
  const desktopBadge = document.getElementById('due-count');
  const mobileBadge = document.getElementById('mobile-due-count');
  if (!desktopBadge || !mobileBadge) return;
  const now = new Date();
  const due = window.words.filter(
    w => new Date(w.stats.nextReview || now) <= now,
  ).length;
  const count = due > 99 ? '99+' : due;
  if (desktopBadge) {
    desktopBadge.textContent = count;
    desktopBadge.style.display = due > 0 ? 'inline-block' : 'none';
  }
  if (mobileBadge) {
    mobileBadge.textContent = count;
    mobileBadge.style.display = due > 0 ? 'inline-block' : 'none';
  }
}

// Render stats function
function renderStats() {
  console.log('=== renderStats called ===');
  console.log('window.words.length:', window.words.length);

  const total = window.words.length;
  // SRS: due count
  const now = new Date();
  const dueCount = window.words.filter(
    w => new Date(w.stats.nextReview || now) <= now,
  ).length;
  const stDueEl = document.getElementById('st-due');
  if (stDueEl) stDueEl.textContent = dueCount;
  const pillEl = document.getElementById('due-pill');
  if (pillEl) pillEl.textContent = dueCount;
  const learned = window.words.filter(w => w.stats.learned).length;
  const pct = total ? Math.round((learned / total) * 100) : 0;
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const thisWeek = window.words.filter(
    w => new Date(w.createdAt) > weekAgo,
  ).length;

  console.log('Stats calculated:', {
    total,
    learned,
    pct,
    dueCount,
    thisWeek,
  });

  const stTotalEl = document.getElementById('st-total');
  if (stTotalEl) stTotalEl.textContent = total;
  const stLearnedEl = document.getElementById('st-learned');
  if (stLearnedEl) stLearnedEl.textContent = learned;
  const stLearnedBarEl = document.getElementById('st-learned-bar');
  if (stLearnedBarEl) {
    stLearnedBarEl.style.width = pct + '%';
    console.log('Progress bar updated:', pct + '%', 'element:', stLearnedBarEl);
  } else {
    console.log('Progress bar element not found!');
  }
  const stStreakEl = document.getElementById('st-streak');
  if (stStreakEl) stStreakEl.textContent = streak.count;
  const stWeekEl = document.getElementById('st-week');
  if (stWeekEl) stWeekEl.textContent = thisWeek;

  // Sparkline
  const days = [],
    labels = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toDateString();
    days.push(
      window.words.filter(w => new Date(w.createdAt).toDateString() === ds)
        .length,
    );
    labels.push(['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][d.getDay()]);
  }
  // Старый sparkline код удалён - теперь используем Chart.js
  // График отрисовывается через renderWeekChart()

  // Топ легких и сложных слов
  const wordsWithStats = window.words.filter(w => w.stats && w.stats.shown > 0);

  // Сложные слова (самый низкий процент правильных ответов)
  const hardWords = wordsWithStats
    .map(w => ({
      ...w,
      accuracy: w.stats.correct / w.stats.shown,
    }))
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 5);

  // Легкие слова (самый высокий процент правильных ответов)
  const easyWords = wordsWithStats
    .map(w => ({
      ...w,
      accuracy: w.stats.correct / w.stats.shown,
    }))
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, 5);

  // Отображаем сложные слова
  const stHardEl = document.getElementById('st-hard');
  if (stHardEl) {
    stHardEl.innerHTML = hardWords
      .map(
        w => `
      <li>
        <strong>${esc(w.en)}</strong>
        <button class="btn-audio audio-card-btn" onclick="speak(&quot;${esc(w.en)}&quot;)" title="Произнести">
          <span class="material-symbols-outlined">sound_detection_loud_sound</span>
        </button>
      </li>
    `,
      )
      .join('');
  }

  // Отображаем легкие слова
  const stEasyEl = document.getElementById('st-easy');
  if (stEasyEl) {
    stEasyEl.innerHTML = easyWords
      .map(
        w => `
      <li>
        <strong>${esc(w.en)}</strong>
        <button class="btn-audio audio-card-btn" onclick="speak(&quot;${esc(w.en)}&quot;)" title="Произнести">
          <span class="material-symbols-outlined">sound_detection_loud_sound</span>
        </button>
      </li>
    `,
      )
      .join('');
  }

  // Ежедневные цели
  renderDailyGoals();

  // CEFR уровни (группировка по tags)
  recalculateCefrLevels();
  renderCefrLevels();

  // Daily review cap progress
  const totalDueCount = window.words.filter(
    w => new Date(w.stats.nextReview || new Date()) <= new Date(),
  ).length;
  const capProgress = document.getElementById('daily-cap-progress');
  if (capProgress) {
    const pct = Math.min(
      100,
      Math.round((totalDueCount / MAX_REVIEWS_PER_DAY) * 100),
    );
    capProgress.innerHTML = `
      <div style="font-size: 0.85rem; color: var(--muted); margin-bottom: 0.5rem;">
        : ${Math.min(totalDueCount, MAX_REVIEWS_PER_DAY)} / ${MAX_REVIEWS_PER_DAY} (${pct}%)
      </div>
      <div class="goal-progress" style="height: 6px;">
        <div class="goal-fill" style="width: ${pct}%; background: linear-gradient(90deg, var(--primary), var(--success));"></div>
      </div>
    `;
  }
}

// Render daily goals separately
function renderDailyGoals() {
  const container = document.getElementById('daily-goals-list');
  if (!container) return;

  let html = '';
  DAILY_GOALS.forEach(goal => {
    const current = window.dailyProgress[goal.id] || 0;
    const percent = Math.min(100, Math.round((current / goal.target) * 100));
    const done = current >= goal.target;

    html += `
      <div class="goal-item ${done ? 'goal-completed' : ''}">
        <div class="goal-header">
          <span class="material-symbols-outlined goal-icon">${goal.icon}</span>
          <div class="goal-text">
            ${goal.label}
            <div class="goal-progress">
              <div class="goal-fill" style="width: ${percent}%"></div>
            </div>
          </div>
        </div>
        <div class="goal-counter">${current}/${goal.target}</div>
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
const confettiStyles = document.createElement('style');
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

function switchTab(name) {
  if (name === 'window.words') {
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
  if (name === 'stats') {
    renderStats();
    setTimeout(() => renderWeekChart(), 100);
  }
  if (name === 'window.words') renderWords();

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
      installBtn.classList.add('visible');
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
            installBtn.classList.remove('visible');
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
      installBtn.classList.remove('visible');
    }
  }
}

// Инициализируем PWA установку
initPWAInstall();

// ============================================================
// DARK MODE
// ============================================================
function applyDark(on) {
  console.log('applyDark called with:', on);
  console.log('Body classes before:', document.body.className);

  document.body.classList.toggle('dark', on);
  console.log('Body classes after:', document.body.className);
  console.log('Has dark class:', document.body.classList.contains('dark'));

  // Принудительно обновляем CSS переменные для предотвращения мерцания
  if (on) {
    document.documentElement.style.setProperty('--bg', '#13121f');
    document.documentElement.style.setProperty('--text', '#ffffff');
    document.documentElement.style.setProperty('--bg-secondary', '#1e1e2e');
    document.documentElement.style.setProperty('--border', '#374151');
    document.documentElement.style.setProperty('--muted', '#9ca3af');
    document.documentElement.style.setProperty('--primary', '#60a5fa');
    document.documentElement.style.setProperty('--primary-light', '#93c5fd');
    console.log('Forced dark CSS variables');
  } else {
    document.documentElement.style.setProperty('--bg', '');
    document.documentElement.style.setProperty('--text', '');
    document.documentElement.style.setProperty('--bg-secondary', '');
    document.documentElement.style.setProperty('--border', '');
    document.documentElement.style.setProperty('--muted', '');
    document.documentElement.style.setProperty('--primary', '');
    document.documentElement.style.setProperty('--primary-light', '');
    console.log('Reset CSS variables to default');
  }

  const darkToggle = document.getElementById('dark-toggle');
  if (darkToggle) {
    const icon = on ? 'sunny' : 'dark_mode';
    darkToggle.innerHTML = `<span class="material-symbols-outlined">${icon}</span>`;
    console.log('Dark toggle icon updated to:', icon);
  } else {
    console.log('Dark toggle element not found');
  }

  // Update dropdown menu theme toggle checkbox
  const themeCheckbox = document.getElementById('theme-checkbox');
  if (themeCheckbox) {
    themeCheckbox.checked = on;
    console.log('Theme checkbox updated to:', on);
  } else {
    console.log('Theme checkbox element not found');
  }

  // Update theme icon next to toggle
  const themeIcon = document.querySelector(
    '#dropdown-theme-toggle .material-symbols-outlined',
  );
  if (themeIcon) {
    const icon = on ? 'sunny' : 'dark_mode';
    themeIcon.textContent = icon;
    console.log('Theme icon updated to:', icon);
  } else {
    console.log('Theme icon element not found');
  }
}

// Theme toggle handlers
const darkToggle = document.getElementById('dark-toggle');
if (darkToggle) {
  darkToggle.addEventListener('click', () => {
    const on = !document.body.classList.contains('dark');
    console.log('Theme toggle clicked, new theme:', on);
    localStorage.setItem(CONSTANTS.STORAGE_KEYS.DARK_MODE, on);
    applyDark(on);

    // Сохраняем тему в Firebase
    if (auth.currentUser) {
      console.log(
        'Saving theme to Firebase:',
        on,
        'for user:',
        auth.currentUser.uid,
      );
      saveUserData(auth.currentUser.uid, { darkTheme: on })
        .then(() => {
          console.log('Theme saved to Firebase successfully');
        })
        .catch(e => console.error('Firestore save error (theme):', e));
    } else {
      console.log('No authenticated user - theme not saved to Firebase');
    }
  });
}

// New theme toggle checkbox handler
const themeCheckbox = document.getElementById('theme-checkbox');
if (themeCheckbox) {
  themeCheckbox.addEventListener('change', e => {
    const on = e.target.checked;
    console.log('Theme checkbox changed, new theme:', on);
    localStorage.setItem(CONSTANTS.STORAGE_KEYS.DARK_MODE, on);
    applyDark(on);

    // Сохраняем тему в Firebase
    if (auth.currentUser) {
      console.log(
        'Saving theme to Firebase from checkbox:',
        on,
        'for user:',
        auth.currentUser.uid,
      );
      saveUserData(auth.currentUser.uid, { darkTheme: on })
        .then(() => {
          console.log('Theme saved to Firebase successfully from checkbox');
        })
        .catch(e => console.error('Firestore save error (theme):', e));
    } else {
      console.log(
        'No authenticated user - theme not saved to Firebase from checkbox',
      );
    }
  });
}

// Убираем немедленное применение темы из localStorage
// if (localStorage.getItem(CONSTANTS.STORAGE_KEYS.DARK_MODE) === 'true')
//   applyDark(true);

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
  // Индикатор синхронизации отключен
  return;
}

// Принудительная синхронизация

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
  toast('' + message, 'warning', 'warning', 5000);

  // Логируем конфликты для отладки
  console.log('Sync conflicts:', conflicts);
}

// Отслеживание состояния сети
function setupNetworkMonitoring() {
  const updateNetworkStatus = () => {
    if (navigator.onLine) {
      // updateSyncIndicator('synced', 'Онлайн');
      // Если есть несохранённые изменения, запускаем forceSync
      if (window.hasLocalChanges) {
        // forceSync();
        window.hasLocalChanges = false;
      }
    } else {
      // updateSyncIndicator('offline', 'Офлайн');
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

    document.getElementById('words-count').textContent = window.words.length;
    updateDueBadge();
    document.getElementById('words-subtitle').textContent =
      list.length !== window.words.length
        ? `(${list.length} из ${window.words.length})`
        : `— ${window.words.length} слов`;

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

  // Подготавливаем данные примеров
  const examples = w.examples && w.examples.length ? w.examples : [];
  console.log('🔍 makeCard examples for word:', w.en);
  console.log('🔍 Examples structure:', examples);
  console.log('🔍 First example:', examples[0]);
  const hasMultiple = examples.length > 1;

  // Начальный индекс (можно случайный, но фиксируем при создании)
  const initialIndex =
    examples.length > 0 ? Math.floor(Math.random() * examples.length) : 0;
  // Сохраняем примеры в dataset для доступа из глобальной функции
  card.dataset.examples = JSON.stringify(examples);
  card.dataset.exampleIndex = initialIndex;

  // Функция для получения HTML текущего примера
  const getExampleHtml = index => {
    if (examples.length === 0) return '';
    const ex = examples[index];
    if (!ex) return '';
    const translation = ex.translation || '';
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
  };

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
    <div class="wc-example-container" data-example-container>
      ${getExampleHtml(initialIndex)}
    </div>
    <div class="wc-footer">
      <div class="wc-streak">${w.stats.streak >= 3 ? '<span class="streak-fire"><span class="material-symbols-outlined" style="font-size: 1.5rem;">local_fire_department</span></span>' : Array.from({ length: 3 }, (_, i) => `<span class="streak-emoji${w.stats.streak > i ? ' active' : ''}"><span class="material-symbols-outlined" style="font-size: 1rem;">local_fire_department</span></span>`).join('')}</div>
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

  // Добавляем обработчики для кнопок внутри контейнера примеров
  const container = card.querySelector('[data-example-container]');
  // Обработчики теперь на words-grid через делегирование

  return card;
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
let currentTooltip = null;

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

  // Handle example buttons (prev/next/translate)
  const exampleBtn = e.target.closest(
    '.example-prev, .example-next, .example-translate',
  );
  if (exampleBtn) {
    e.stopPropagation();
    const card = exampleBtn.closest('.word-card');
    if (!card) return;

    const examples = JSON.parse(card.dataset.examples || '[]');
    const currentIndex = parseInt(card.dataset.exampleIndex);
    const container = card.querySelector('[data-example-container]');

    if (
      exampleBtn.classList.contains('example-prev') ||
      exampleBtn.classList.contains('example-next')
    ) {
      // Переключение примеров
      let newIndex = currentIndex;
      if (exampleBtn.classList.contains('example-prev')) {
        newIndex = (newIndex - 1 + examples.length) % examples.length;
      } else {
        newIndex = (newIndex + 1) % examples.length;
      }
      card.dataset.exampleIndex = newIndex;
      container.innerHTML = getExampleHtmlForCard(card, newIndex);
    } else if (exampleBtn.classList.contains('example-translate')) {
      // Показ перевода
      const currentExample = examples[currentIndex];
      if (!currentExample) return;

      const translation = currentExample?.translation || '';
      showTooltip(translation || '', exampleBtn);
    }
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
        const w = window.words.find(x => x.id === btnId);
        if (!w) return;
        const card = btn.closest('.word-card');
        card.classList.add('editing');
        card.innerHTML = `
          <div class="form-group"><label>English</label><input type="text" class="e-en form-control" value="${safeAttr(w.en)}"></div>
          <div class="form-group"><label>Русский</label><input type="text" class="e-ru form-control" value="${safeAttr(w.ru)}"></div>
          <div class="form-group"><label>Транскрипция</label><input type="text" class="e-phonetic form-control" value="${safeAttr(w.phonetic || '')}"></div>
          <div class="form-group"><label>Пример</label><input type="text" class="e-ex form-control" value="${safeAttr(w.ex)}"></div>
          <div class="form-group"><label>Перевод примера</label><input type="text" class="e-ex-translation form-control" value="${safeAttr(w.examples?.[0]?.translation || '')}"></div>
          <div class="form-group"><label>Теги</label><input type="text" class="e-tags form-control" value="${safeAttr(w.tags.join(', '))}"></div>
          <div class="form-actions">
            <button class="btn btn-primary save-edit-btn" data-id="${w.id}"><span class="material-symbols-outlined">save</span></button>
            <button class="btn btn-secondary cancel-edit-btn"><span class="material-symbols-outlined">close</span></button>
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
              examples: card.querySelector('.e-ex').value.trim()
                ? [
                    {
                      text: card.querySelector('.e-ex').value.trim(),
                      translation: card
                        .querySelector('.e-ex-translation')
                        .value.trim(),
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
    }
    return;
  }

  if (e.target.classList.contains('del-btn')) {
    pendingDelId = id;
    document.getElementById('del-modal').classList.add('open');
  }
  if (e.target.classList.contains('edit-btn')) {
    const w = window.words.find(x => x.id === id);
    if (!w) return;
    const card = e.target.closest('.word-card');
    card.classList.add('editing');
    card.innerHTML = `
      <div class="form-group"><label>English</label><input type="text" class="e-en form-control" value="${safeAttr(w.en)}"></div>
      <div class="form-group"><label>Русский</label><input type="text" class="e-ru form-control" value="${safeAttr(w.ru)}"></div>
      <div class="form-group"><label>Транскрипция</label><input type="text" class="e-phonetic form-control" value="${safeAttr(w.phonetic || '')}"></div>
      <div class="form-group"><label>Пример</label><input type="text" class="e-ex form-control" value="${safeAttr(w.ex)}"></div>
      <div class="form-group"><label>Перевод примера</label><input type="text" class="e-ex-translation form-control" value="${safeAttr(w.examples?.[0]?.translation || '')}"></div>
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
          examples: card.querySelector('.e-ex').value.trim()
            ? [
                {
                  text: card.querySelector('.e-ex').value.trim(),
                  translation: card
                    .querySelector('.e-ex-translation')
                    .value.trim(),
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
    const wSnap = window.words.find(w => w.id === pendingDelId);
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
        window.words.push(wSnap);
        debouncedSave();
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
    toast('Сначала введите английское слово', 'warning', 'warning');
    enInput.focus();
    return;
  }

  // Проверяем, что это действительно английское слово
  if (!validateEnglish(englishWord)) {
    toast('Неверный формат английского слова', 'danger', 'error');
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
      exInput.value = data.examples[0].text || data.examples[0];
      exInput.classList.add('auto-filled');
      filledFields++;
      console.log('Example filled:', data.examples[0].text || data.examples[0]);

      const exTransInput = document.getElementById('f-ex-translation');
      if (exTransInput) {
        exTransInput.value = data.examples[0].translation || '';
        if (data.examples[0].translation) {
          exTransInput.classList.add('auto-filled');
          filledFields++;
          console.log(
            'Example translation filled:',
            data.examples[0].translation,
          );
        }
      }
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
        `✓ Получено ${filledFields} поля! Проверьте и добавьте слово`,
        'success',
      );
    } else {
      toast(
        '⚠ Данные не найдены. Попробуйте другое слово или введите вручную',
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
    toast(
      `Ошибка: ${error.message}. Попробуйте ввести вручную`,
      'danger',
      'api_error',
    );
  }
});

document.getElementById('single-form').addEventListener('submit', e => {
  e.preventDefault();

  const en = document.getElementById('f-en').value.trim();
  const ru = document.getElementById('f-ru').value.trim();
  const phonetic = document.getElementById('f-phonetic').value.trim();
  const ex = document.getElementById('f-ex').value.trim();
  const exTranslation = document
    .getElementById('f-ex-translation')
    .value.trim();
  const tagsString = document.getElementById('f-tags').value;

  // Нормализация тегов
  const tags = normalizeTags(tagsString);

  // Преобразуем ex в examples массив с переводом
  const examples = ex ? [{ text: ex, translation: exTranslation }] : [];

  // Добавляем слово с валидацией
  const success = addWord(en, ru, ex, tags, phonetic, examples);

  if (success) {
    // Сбрасываем значения полей
    e.target.reset();

    // Сбрасываем стили auto-filled
    const fields = [
      'f-en',
      'f-ru',
      'f-phonetic',
      'f-ex',
      'f-ex-translation',
      'f-tags',
    ];
    fields.forEach(fieldId => {
      const field = document.getElementById(fieldId);
      if (field) {
        field.classList.remove('auto-filled');
      }
    });

    document.getElementById('f-en').focus();
    toast(`«${esc(en)}» добавлено!`, 'success', 'add_circle');

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
        const newCard = document.querySelector('#window.words-grid .word-card');
        if (newCard) {
          newCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
          newCard.classList.add('new-word-highlight');
        }
      }, 100);
    }, 100);
  }
});
// File import variables
let fileParsed = [];

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
      const isDuplicate = window.words.find(
        x => x.en.toLowerCase() === w.en.toLowerCase(),
      );
      const isChecked = !isDuplicate ? 'checked' : '';
      console.log(
        `📝 Word ${i}: "${w.en}" - ${isDuplicate ? 'DUPLICATE (unchecked)' : 'NEW (checked)'}`,
      );

      return `
    <tr>
      <td><input type="checkbox" class="fchk" data-i="${i}" ${isChecked}></td>
      <td>${esc(w.en)}${isDuplicate ? '<br><span style="color: var(--warning); font-size: 0.8em;">(уже есть)</span>' : ''}</td>
      <td>${esc(w.ru)}</td>
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
  console.log('🔘 Import button element:', btn);

  if (btn) {
    const newCount = fileParsed.filter(
      w => !window.words.find(x => x.en.toLowerCase() === w.en.toLowerCase()),
    ).length;

    console.log('🆕 New window.words count:', newCount);
    console.log('🔄 Duplicate count:', fileParsed.length - newCount);

    // Показываем детальную информацию о первых словах
    fileParsed.slice(0, 3).forEach((w, i) => {
      const isDuplicate = window.words.find(
        x => x.en.toLowerCase() === w.en.toLowerCase(),
      );
      console.log(
        `📝 Word ${i}: "${w.en}" - ${isDuplicate ? 'DUPLICATE' : 'NEW'}`,
      );
    });

    btn.style.display = fileParsed.length ? 'block' : 'none';
    btn.textContent = `✓ Импортировать ${newCount} новых слов${fileParsed.length - newCount > 0 ? ' (' + (fileParsed.length - newCount) + ' дублей пропустим)' : ''}`;

    console.log('📝 Button configured, display:', btn.style.display);
    console.log('📝 Button text:', btn.textContent);

    // Назначаем обработчик прямо здесь
    btn.onclick = function () {
      console.log('📝 Import button clicked!');
      console.log('📊 fileParsed length:', fileParsed.length);

      const checkboxes = document.querySelectorAll('.fchk:checked');
      console.log('📝 Checked checkboxes:', checkboxes.length);

      const indices = Array.from(checkboxes).map(cb => parseInt(cb.dataset.i));
      console.log('📍 Selected indices:', indices);

      let added = 0;
      indices.forEach(i => {
        const w = fileParsed[i];
        console.log(`📝 Processing word ${i}:`, w);
        if (
          !window.words.some(
            existing => existing.en.toLowerCase() === w.en.toLowerCase(),
          )
        ) {
          window.words.push(
            mkWord(w.en, w.ru, w.ex, w.tags || [], w.phonetic || null),
          );
          added++;
          console.log(`✅ Added word: ${w.en}`);
        } else {
          console.log(`⚠️ Duplicate skipped: ${w.en}`);
        }
      });

      console.log(`🎯 Total added: ${added}`);
      console.log('💾 Saving changes...');

      // Сохраняем изменения
      debouncedSave();

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

// IMPORT / EXPORT
// ============================================================

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

// Import drop zone elements
const importDropZone = document.getElementById('io-drop-zone');
const importFileInput = document.getElementById('io-file-input');

// Import drop zone handlers
if (importDropZone) {
  importDropZone.addEventListener('click', () => {
    console.log('🖱️ Drop zone clicked!');
    importFileInput.click();
  });

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
    handleFile(e.dataTransfer.files[0]);
  });
}

if (importFileInput) {
  importFileInput.addEventListener('change', e => {
    console.log('📂 File input changed!');
    handleFile(e.target.files[0]);
  });
}

// Функция обработки файла импорта
function handleFile(file) {
  if (!file) return;

  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    // Excel импорт
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

        // Пропускаем заголовок если есть
        const hasHeader =
          jsonData.length > 0 &&
          (jsonData[0][0]?.toString().toLowerCase().includes('english') ||
            jsonData[0][1]?.toString().toLowerCase().includes('russian'));
        const startIndex = hasHeader ? 1 : 0;

        fileParsed = jsonData
          .slice(startIndex)
          .map(row => {
            const exampleText = row[3]?.toString().trim() || '';
            return {
              en: row[0]?.toString().trim() || '',
              ru: row[1]?.toString().trim() || '',
              phonetic: row[2]?.toString().trim() || '',
              ex: exampleText,
              examples: exampleText
                ? [{ text: exampleText, translation: '' }]
                : [],
              tags: row[4]
                ? row[4]
                    .toString()
                    .split(';')
                    .map(t => t.trim())
                    .filter(t => t)
                : [],
            };
          })
          .filter(w => w.en && w.ru);

        console.log(
          '📁 Excel file parsed successfully:',
          fileParsed.length,
          'window.words',
        );
        showPreview();
      } catch (error) {
        console.error('❌ Error parsing Excel file:', error);
        toast(
          'Ошибка чтения Excel файла: ' + error.message,
          'error',
          'table_chart',
        );
      }
    };
    reader.readAsArrayBuffer(file);
  } else {
    // JSON/CSV импорт
    const reader = new FileReader();

    reader.onload = function (e) {
      const content = e.target.result;

      try {
        if (fileName.endsWith('.json')) {
          // JSON импорт
          const data = JSON.parse(content);
          if (data.window.words && Array.isArray(data.window.words)) {
            fileParsed = data.window.words.map(w => ({
              en: w.en,
              ru: w.ru,
              phonetic: w.phonetic || '',
              ex: w.ex || w.examples?.[0]?.text || '',
              examples: w.examples
                ? w.examples.map(e =>
                    typeof e === 'string' ? { text: e, translation: '' } : e,
                  )
                : [],
              tags: w.tags || [],
            }));
          } else if (Array.isArray(data)) {
            fileParsed = data.map(w => ({
              en: w.en,
              ru: w.ru,
              phonetic: w.phonetic || '',
              ex: w.ex || w.examples?.[0]?.text || '',
              examples: w.examples
                ? w.examples.map(e =>
                    typeof e === 'string' ? { text: e, translation: '' } : e,
                  )
                : [],
              tags: w.tags || [],
            }));
          } else {
            throw new Error('Invalid JSON format');
          }
        } else if (fileName.endsWith('.csv')) {
          // CSV импорт
          const lines = content.split('\n').filter(line => line.trim());
          const hasHeader =
            lines[0] && lines[0].toLowerCase().includes('english');
          const startIndex = hasHeader ? 1 : 0;

          fileParsed = lines
            .slice(startIndex)
            .map(line => {
              const values = parseCSVLine(line);
              const exampleText = values[2]?.trim() || '';
              return {
                en: values[0]?.trim() || '',
                ru: values[1]?.trim() || '',
                ex: exampleText,
                examples: exampleText
                  ? [{ text: exampleText, translation: '' }]
                  : [],
                tags: values[3]
                  ? values[3]
                      .split(';')
                      .map(t => t.trim())
                      .filter(t => t)
                  : [],
              };
            })
            .filter(w => w.en && w.ru);
        } else {
          throw new Error('Unsupported file format');
        }

        console.log(
          '📁 File parsed successfully:',
          fileParsed.length,
          'window.words',
        );
        showPreview();
      } catch (error) {
        console.error('❌ Error parsing file:', error);
        toast('Ошибка чтения файла: ' + error.message, 'error', 'description');
      }
    };

    reader.onerror = function () {
      console.error('❌ Error reading file');
      toast('Ошибка чтения файла', 'error', 'description');
    };

    reader.readAsText(file);
  }
}

// ============================================================
// Обработчики экспорта
// ============================================================

// Экспорт полного бэкапа в JSON
document.getElementById('io-export-json').addEventListener('click', () => {
  const backup = {
    version: 2,
    exportedAt: new Date().toISOString(),
    words: window.words,
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
  URL.revokeObjectURL(a.href); // очищаем память
  toast('Бэкап сохранён!', 'success', 'save');
});

// Экспорт слов в CSV
document.getElementById('io-export-csv').addEventListener('click', () => {
  if (!window.words.length) {
    toast('Нет слов', 'warning');
    return;
  }
  const rows = [
    'English,Russian,Example,Tags',
    ...window.words.map(
      w =>
        `"${(w.en || '').replace(/"/g, '""')}","${(w.ru || '').replace(/"/g, '""')}","${(w.examples?.[0]?.text || '').replace(/"/g, '""')}","${(w.tags || []).join(';')}"`,
    ),
  ];
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download =
    'englift-window.words-' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('CSV скачан!', 'success', 'description');
});

// Экспорт в формат Anki (TSV)
document.getElementById('io-export-anki').addEventListener('click', () => {
  if (!window.words.length) {
    toast('Нет слов', 'warning');
    return;
  }
  const rows = window.words.map(w => {
    const front = w.examples?.[0]?.text
      ? `${w.en}<br><i style="font-size:.85em;opacity:.7">${w.examples[0].text}</i>`
      : w.en;
    const tags = w.tags.join(' ');
    return [front, w.ru, tags].join('\t');
  });
  const blob = new Blob([rows.join('\n')], {
    type: 'text/tab-separated-values',
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `englift_anki_${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Anki файл скачан!', 'success', 'style');
});

// Вспомогательная функция для парсинга CSV с кавычками
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // пропустить следующую кавычку
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

// Practice session variables
let sResults = { correct: [], wrong: [] };
let sIdx = 0;
let session = null;
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

// Practice time tracking
let practiceStartTime = null;

// Daily review cap to prevent overwhelm
const MAX_REVIEWS_PER_DAY = 120; // Can be made configurable later

function getCardsToReview() {
  const now = new Date();
  let due = window.words.filter(
    w => new Date(w.stats.nextReview || now) <= now,
  );

  // Sort by urgency (most overdue first)
  due.sort(
    (a, b) =>
      new Date(a.stats.nextReview || now) - new Date(b.stats.nextReview || now),
  );

  // Apply daily cap
  if (due.length > MAX_REVIEWS_PER_DAY) {
    const originalCount = due.length;
    due = due.slice(0, MAX_REVIEWS_PER_DAY);

    // Show cap notification only once per session
    if (!window.capNotified) {
      toast(
        `Сегодня показано только ${MAX_REVIEWS_PER_DAY} карточек из ${originalCount}. Остальные — завтра!`,
        'info',
        'schedule',
      );
      window.capNotified = true;
    }
  }

  return due;
}

function startSession(cfg) {
  // Start tracking practice time
  practiceStartTime = Date.now();

  sResults = { correct: [], wrong: [] };
  sIdx = 0; // Reset index for new session
  window.words.forEach(w => delete w._matched);

  let countVal, filterVal, exTypes, types, pool;

  if (cfg && cfg.countVal !== undefined) {
    // Повтор той же сессии
    ({ countVal, filterVal, exTypes } = cfg);
    types = speechSupported ? exTypes : exTypes.filter(t => t !== 'dictation');
    if (!types.length) {
      toast('Диктант недоступен без синтеза речи', 'danger');
      return;
    }
    pool = [...window.words];
    if (filterVal === 'learning') pool = pool.filter(w => !w.stats.learned);
    if (filterVal === 'due') {
      pool = getCardsToReview(); // Use capped function
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
    exTypes = [...document.querySelectorAll('.exercise-card.selected')].map(
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
    pool = [...window.words];
    if (filterVal === 'learning') pool = pool.filter(w => !w.stats.learned);
    if (filterVal === 'due') {
      pool = getCardsToReview(); // Use capped function
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
  try {
    const hkHint = document.getElementById('hotkeys-hint');
    if (hkHint) hkHint.style.display = 'flex';
    if (sIdx >= session.words.length) {
      showResults();
      return;
    }
    const w = session.words[sIdx];
    const t =
      session.exTypes[Math.floor(Math.random() * session.exTypes.length)];
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
        // Меньше 2 слов — просто пропускаем match и переходим к следующему слову
        sIdx++;
        nextExercise();
        return;
      }
      const batch = session.words.slice(sIdx, sIdx + batchSize);
      runMatchExercise(batch, elapsed => {
        sIdx += batchSize;
        toast(`Все пары за ${elapsed}s!`, 'success', 'extension');
        nextExercise();
      });
      return;
    }

    if (t === 'flash') {
      document.getElementById('ex-type-lbl').innerHTML =
        '<span class="material-symbols-outlined">style</span> Флеш-карточка';
      document.getElementById('ex-counter').textContent =
        `${sIdx + 1} / ${session.words.length}`;
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
      btns.innerHTML = `<button class="btn-icon" id="knew-btn"><span class="material-symbols-outlined">check</span></button><button class="btn-icon" id="didnt-btn"><span class="material-symbols-outlined">close</span></button>`;
      document.getElementById('knew-btn').onclick = () => recordAnswer(true);
      document.getElementById('didnt-btn').onclick = () => recordAnswer(false);
    } else if (t === 'speech') {
      if (!speechRecognitionSupported) {
        // Если Speech Recognition не поддерживается, заменяем на другое упражнение
        session.exTypes = session.exTypes.filter(x => x !== 'speech');
        if (!session.exTypes.length) session.exTypes = ['flash'];
        nextExercise();
      } else {
        document.getElementById('ex-type-lbl').innerHTML =
          '<span class="material-symbols-outlined">record_voice_over</span> Произнеси вслух';
        document.getElementById('ex-counter').textContent =
          `${sIdx + 1} / ${session.words.length}`;
        content.innerHTML = `
        <div class="speech-exercise">
          <div class="speech-prompt">
            <div class="speech-word">${esc(w.en)}</div>
            <div class="speech-hint">Произнеси это слово вслух на английском</div>
            ${w.ru ? `<div class="speech-translation">${esc(w.ru)}</div>` : ''}
          </div>
          <div class="speech-controls">
            <button id="speech-start-btn">
              <span class="material-symbols-outlined speech-icon">mic</span>
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
          startBtn.querySelector('.speech-icon').textContent = 'stop';
          statusEl.innerHTML =
            '<div class="recording-indicator">🔴 Слушаю...</div>';
          resultEl.innerHTML = '';

          // Останавливаем запись через 5 секунд автоматически
          recognitionTimeout = setTimeout(() => {
            stopRecording();
          }, CONSTANTS.SPEECH.RECOGNITION_TIMEOUT);

          speechRecognition.onresult = event => {
            const transcript = event.results[0][0].transcript
              .toLowerCase()
              .trim();
            const confidence = event.results[0][0].confidence;
            const correctWord = w.en.toLowerCase().trim();

            // Проверяем схожесть слов
            const isCorrect = checkSpeechSimilarity(transcript, correctWord);

            resultEl.innerHTML = `
          <div class="speech-feedback">
            <div class="speech-heard">Ты сказал: "<strong>${esc(transcript)}</strong>"</div>
            <div class="speech-confidence">Уверенность: ${Math.round(confidence * 100)}%</div>
            <div class="speech-verdict ${isCorrect ? 'correct' : 'incorrect'}">
              ${isCorrect ? '✓ Отлично! Правильно!' : '✗ Попробуй еще раз'}
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
          startBtn.querySelector('.speech-icon').textContent = 'mic';
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
      }
    } else if (t === 'multi') {
      document.getElementById('ex-type-lbl').innerHTML =
        '<span class="material-symbols-outlined">target</span> Выбор ответа';
      document.getElementById('ex-counter').textContent =
        `${sIdx + 1} / ${session.words.length}`;
      const dir = session.dir || 'both';
      const isRUEN = dir === 'ru-en' || (dir === 'both' && Math.random() > 0.5);
      const question = isRUEN ? w.ru : w.en;
      const correct = isRUEN ? w.en : w.ru;
      const others = window.words
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
      document.getElementById('ex-type-lbl').innerHTML =
        '<span class="material-symbols-outlined">keyboard</span> Напиши перевод';
      document.getElementById('ex-counter').textContent =
        `${sIdx + 1} / ${session.words.length}`;
      const dir = session.dir || 'both';
      const isRUEN = dir === 'ru-en' || (dir === 'both' && Math.random() > 0.5);
      const question = isRUEN ? w.ru : w.en;
      const answer = isRUEN ? w.en : w.ru;
      if (autoPron && !isRUEN && speechSupported)
        setTimeout(() => speak(w.en), 300);
      content.innerHTML = `
      <div class="ta-word">
        ${esc(question)}
        ${!isRUEN && speechSupported ? `<button class="btn-icon btn-audio" id="ta-audio-btn"><span class="material-symbols-outlined">volume_up</span></button>` : ''}
      </div>
      <div class="ta-row">
        <input type="text" class="form-control" id="ta-input" placeholder="${isRUEN ? 'Напиши по-английски...' : 'Введи перевод...'}" autocomplete="off" autocorrect="off" spellcheck="false">
        <button class="btn-icon" id="ta-submit"><span class="material-symbols-outlined">send</span></button>
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
        const answerVariants = parseAnswerVariants(answer);
        const ok = answerVariants.some(v => v === val);
        const fb = document.getElementById('ta-fb');
        fb.className = 'ta-feedback ' + (ok ? 'ok' : 'err');
        fb.textContent = ok ? '✓ Верно!' : '✗ Правильно: ' + answer;
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
      document.getElementById('ex-type-lbl').innerHTML =
        '<span class="material-symbols-outlined">volume_up</span> Диктант';
      document.getElementById('ex-counter').textContent =
        `${sIdx + 1} / ${session.words.length}`;
      content.innerHTML = `
      <div class="dictation-card">
        <div class="dictation-big"><span class="material-symbols-outlined">volume_up</span></div>
        <div class="dictation-hint">Послушай слово и напиши его по-английски</div>
        <div class="dictation-reveal" id="dict-reveal">${esc(w.en)}</div>
      </div>
      <div class="ta-row" style="margin-top:1rem">
        <input type="text" id="dict-input" placeholder="Напиши слово по-английски..." autocomplete="off" autocorrect="off" spellcheck="false">
        <button class="btn-icon" id="dict-submit"><span class="material-symbols-outlined">check</span></button>
      </div>
      <div class="ta-feedback" id="dict-fb"></div>
    `;
      // Play immediately
      setTimeout(() => speak(w.en), 200);
      btns.innerHTML = `<button class="btn-icon btn-secondary" id="dict-replay"><span class="material-symbols-outlined">volume_up</span></button>`;
      document.getElementById('dict-replay').onclick = () => speak(w.en);
      const inp = document.getElementById('dict-input');
      inp.focus();
      const check = () => {
        const val = inp.value.trim().toLowerCase();
        const answerVariants = parseAnswerVariants(w.en);
        const ok = answerVariants.some(v => v === val);
        const fb = document.getElementById('dict-fb');
        fb.className = 'ta-feedback ' + (ok ? 'ok' : 'err');
        fb.textContent = ok ? '✓ Верно!' : '✗ Правильно: ' + w.en;
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
  } catch (error) {
    console.error('Error in nextExercise:', error);
    toast('Ошибка при загрузке упражнения', 'error');
    // Пробуем перейти к следующему упражнению
    sIdx++;
    nextExercise();
  }
}

function recordAnswer(correct) {
  playSound(correct ? 'correct' : 'wrong');
  updStats(session.words[sIdx].id, correct);
  updStreak();

  // Обновляем прогресс ежедневных целей для правильных ответов
  if (correct) {
    resetDailyGoalsIfNeeded(); // Ensure proper daily reset
    window.dailyProgress.review = (window.dailyProgress.review || 0) + 1;
    checkDailyGoalsCompletion();
  }

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

  // Update practice time progress
  if (practiceStartTime) {
    const minutes = Math.floor((Date.now() - practiceStartTime) / 60000);
    resetDailyGoalsIfNeeded(); // Ensure proper daily reset
    window.dailyProgress.practice_time =
      (window.dailyProgress.practice_time || 0) + minutes;
    checkDailyGoalsCompletion();
    practiceStartTime = null; // Reset for next session
  }

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
  if (isPerfect)
    gainXP(
      10,
      'идеальная сессия <span class="material-symbols-outlined" style="vertical-align: middle; font-size: 16px;">target</span>',
    );
  updStreak();
  checkBadges(isPerfect);
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
// INIT
// ============================================================
// Мост для Firebase
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
  await renderWotd();
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

(async () => {
  await load();
  updStreak();
  updateDueBadge();
  renderWotd(); // Это вызов в синхронном контексте, оставляем без await
})();
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

// === WORD OF THE DAY ===
async function renderWotd() {
  const wrap = document.getElementById('wotd-wrap');
  if (!wrap) return;

  wrap.innerHTML = `<div class="wotd-card">
    <div style="text-align: center; padding: 1rem;">
      <div class="loading-spinner" style="margin: 0 auto 0.5rem;"></div>
      <div style="color: var(--muted); font-size: 0.9rem;">Загружаем слово дня...</div>
    </div>
  </div>`;

  try {
    const randomWord = await window.WordAPI.getRandomNewWord();
    if (!randomWord) {
      wrap.innerHTML = `<div class="wotd-card">
        <div style="text-align: center; padding: 1rem; color: var(--muted);">
          Не удалось загрузить слово дня. Попробуйте позже.
        </div>
      </div>`;
      return;
    }

    // Берём первый пример (или null)
    const example =
      randomWord.examples && randomWord.examples.length > 0
        ? randomWord.examples[0]
        : null;

    wrap.innerHTML = `<div class="wotd-card">
      <div>
        <div class="wotd-label">☀️ Слово дня</div>
        <div class="wotd-en">${esc(randomWord.en.charAt(0).toUpperCase() + randomWord.en.slice(1))}</div>
        <div class="wotd-ru">${esc(randomWord.ru)}</div>
        ${randomWord.phonetic ? `<div class="wotd-phonetic">${esc(randomWord.phonetic)}</div>` : ''}
        ${example ? `<div class="wotd-ex">${esc(example.text)}</div>` : ''}
        ${randomWord.tags?.length ? `<div class="wotd-tags">${randomWord.tags.map(tag => `<span class="tag">${esc(tag)}</span>`).join(' ')}</div>` : ''}
      </div>
      <div style="display: flex; gap: 0.5rem;">
        ${speechSupported ? `<button class="wotd-audio" id="wotd-audio-btn"><span class="material-symbols-outlined">sound_detection_loud_sound</span></button>` : ''}
        <button class="wotd-add-btn" id="wotd-add-btn"><span class="material-symbols-outlined">add</span></button>
      </div>
    </div>`;

    // Обработчики аудио и добавления
    if (speechSupported) {
      document
        .getElementById('wotd-audio-btn')
        ?.addEventListener('click', function () {
          speakBtn(randomWord.en, this);
        });
    }

    document
      .getElementById('wotd-add-btn')
      ?.addEventListener('click', function () {
        if (
          window.words.some(
            w => w.en.toLowerCase() === randomWord.en.toLowerCase(),
          )
        ) {
          console.log('Word already exists, showing warning');
          toast('Это слово уже есть в словаре!', 'warning');
          return;
        }

        console.log('Adding new word...');
        // Добавляем слово, сохраняя все примеры с переводами
        const newWord = mkWord(
          randomWord.en,
          randomWord.ru,
          randomWord.examples?.[0]?.text || '', // для обратной совместимости
          randomWord.tags || [],
          randomWord.phonetic || null,
          randomWord.examples || [], // передаём массив объектов
        );

        console.log('New word created:', newWord);
        window.words.unshift(newWord);

        // Обновляем прогресс ежедневных целей для WOTD
        resetDailyGoalsIfNeeded(); // Ensure proper daily reset
        window.dailyProgress.add_new = (window.dailyProgress.add_new || 0) + 1;
        checkDailyGoalsCompletion();

        // Пересчитываем уровни CEFR
        recalculateCefrLevels();

        debouncedSave();
        renderWords();
        renderStats();
        renderWeekChart();
        toast(`Слово "${randomWord.en}" добавлено в словарь!`, 'success');
        setTimeout(renderWotd, 500);
      });
  } catch (error) {
    console.error('Error rendering word of the day:', error);
    wrap.innerHTML = `<div class="wotd-card">
      <div style="text-align: center; padding: 1rem; color: var(--danger);">
        Не удалось загрузить слово дня
      </div>
    </div>`;
  }
}

function runMatchExercise(words6, onComplete) {
  const content = document.getElementById('ex-content');
  const btns = document.getElementById('ex-btns');
  btns.innerHTML = '';
  document.getElementById('ex-type-lbl').textContent = '🧩 Найди пары';

  // Перемешиваем переводы отдельно
  const enWords = [...words6];
  const ruWords = [...words6].sort(() => Math.random() - 0.5);

  let selectedWord = null; // { el, id, side }
  let matched = 0;
  const total = words6.length;
  let startTime = Date.now();

  content.innerHTML = `
    <div class="match-timer" id="match-timer">0.0s</div>
    <div class="match-grid" id="match-grid"></div>
    <div class="match-progress" id="match-progress">0 / ${total} пар</div>
  `;

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

      const enBtn = document.createElement('button');
      enBtn.className = 'match-btn';
      enBtn.dataset.id = enW.id;
      enBtn.dataset.side = 'en';
      enBtn.textContent = enW.en;
      if (enW._matched) {
        enBtn.classList.add('correct');
        enBtn.disabled = true;
      }

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

  grid.addEventListener('click', e => {
    const btn = e.target.closest('.match-btn');
    if (!btn || btn.disabled || btn.classList.contains('correct')) return;
    const side = btn.dataset.side;
    const id = btn.dataset.id;

    // Если кликнули на ту же выбранную кнопку – снимаем выбор
    if (selectedWord && selectedWord.el === btn) {
      selectedWord.el.classList.remove('selected');
      selectedWord = null;
      return;
    }

    if (!selectedWord) {
      // Первое нажатие – выбираем слово
      btn.classList.add('selected');
      selectedWord = { el: btn, id, side };
      return;
    }

    // Второе нажатие – проверяем пару
    if (selectedWord.id === id && selectedWord.side !== side) {
      // Правильная пара!
      playSound('correct');
      btn.classList.add('correct');
      selectedWord.el.classList.remove('selected');
      selectedWord.el.classList.add('correct');

      // Помечаем слово как matched
      words6.find(w => w.id === id)._matched = true;
      matched++;
      document.getElementById('match-progress').textContent =
        `${matched} / ${total} пар`;
      updStats(id, true);
      updStreak();
      sResults.correct.push(words6.find(w => w.id === id));
      selectedWord = null;

      if (matched === total) {
        clearInterval(window._matchTimerInterval);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        setTimeout(() => {
          words6.forEach(w => delete w._matched);
          onComplete(elapsed);
        }, 600);
      }
    } else {
      // Ошибка
      playSound('wrong');
      btn.classList.add('wrong');
      selectedWord.el.classList.add('wrong');

      updStats(selectedWord.id, false);
      sResults.wrong.push(words6.find(w => w.id === selectedWord.id));

      setTimeout(() => {
        btn.classList.remove('wrong');
        if (selectedWord) {
          selectedWord.el.classList.remove('wrong', 'selected');
          selectedWord = null;
        }
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

    // Останавливаем все активные процессы
    window.words.forEach(w => delete w._matched);
    clearInterval(window._matchTimerInterval);
    window._matchTimerInterval = null; // Очищаем ссылку

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
});

// === PWA ===
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
      self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))));
      self.addEventListener('fetch', e => e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))));
    `;
    const swBlob = new Blob([swCode], { type: 'application/javascript' });
    navigator.serviceWorker
      .register(URL.createObjectURL(swBlob))
      .catch(() => {});
  }
}

// Очистка данных пользователя (при выходе или перед загрузкой нового пользователя)
window.clearUserData = function () {
  console.log('clearUserData called. Current user:', auth?.currentUser?.uid);

  // Очищаем интервал проверки бейджей
  if (badgeCheckInterval) {
    clearInterval(badgeCheckInterval);
    badgeCheckInterval = null;
  }

  // Сбрасываем все пользовательские данные КРОМЕ ТЕМЫ
  window.words = [];
  xpData = { xp: 0, level: 1, badges: [] };
  streak = { count: 0, lastDate: null };
  speechCfg = { voiceURI: '', rate: 0.9, pitch: 1.0, accent: 'US' };
  renderCache.clear();

  // Очищаем DOM
  const grid = document.getElementById('words-grid');
  if (grid) grid.innerHTML = '';
  const empty = document.getElementById('empty-words');
  if (empty) empty.style.display = 'block';

  // Обновить интерфейс
  renderStats();
  renderWords();
  renderXP();
  renderBadges();
  updateDueBadge();
  // НЕ сбрасываем тему - оставляем текущую
  switchTab('words');
};

// ============================================================
// GLOBAL FUNCTIONS FOR AUTH.JS
// ============================================================
window.loadData = load; // перезагрузка всех данных из localStorage
window.renderXP = renderXP; // обновление XP
window.renderBadges = renderBadges;
window.renderStats = renderStats;

// ============================================================
// INITIALIZATION
// ============================================================
// СРАЗУ применяем тему из localStorage
const savedTheme = localStorage.getItem('engliftDark') === 'true';
if (savedTheme) {
  // Применяем тему немедленно через CSS переменные
  document.documentElement.style.setProperty('--bg', '#13121f');
  document.documentElement.style.setProperty('--text', '#ffffff');
  document.documentElement.style.setProperty('--bg-secondary', '#1e1e2e');
  document.documentElement.style.setProperty('--border', '#374151');
  document.documentElement.style.setProperty('--muted', '#9ca3af');
  document.documentElement.style.setProperty('--primary', '#60a5fa');
}

// Инициализация
(async () => {
  await load();

  // Выполняем миграцию переводов после загрузки
  if (window.words && window.words.length > 0) {
    await migrateExampleTranslations();
  }

  renderWords();
  renderStats();
  renderXP();
  renderBadges();
  updateDueBadge();
  renderWeekChart();
})();

// Если через 2 секунды Firebase не загрузил тему, оставляем localStorage
setTimeout(() => {
  if (!window.authExports?.auth?.currentUser) {
    console.log('No Firebase user - keeping localStorage theme');
    // Проверяем доступность Firebase
    if (navigator.onLine) {
      console.log('Online but no Firebase user - using offline mode');
    } else {
      console.log('Offline mode detected - using localStorage only');
      toast('📴 Оффлайн режим', 'info');
    }
  }
}, 2000);

// Проверяем соединение с Firebase
window.addEventListener('online', () => {
  console.log('Connection restored - checking Firebase');
  if (window.authExports?.auth) {
    // Пытаемся переподключиться к Firebase
    window.authExports.auth.onAuthStateChanged(user => {
      if (user) {
        console.log('Firebase connection restored');
        toast('🟢 Соединение восстановлено', 'success');
      }
    });
  }
});

window.addEventListener('offline', () => {
  console.log('Offline mode activated');
  toast('📴 Оффлайн режим', 'info');
});

// ====================== PWA INSTALL BUTTON ======================
let deferredPrompt = null;
const installBtn = document.getElementById('install-btn');

window.addEventListener('beforeinstallprompt', e => {
  console.log('✅ beforeinstallprompt сработал — показываем кнопку PWA');
  e.preventDefault();
  deferredPrompt = e;

  if (installBtn) {
    installBtn.style.display = 'flex';
    installBtn.classList.add('visible');
  }
});

// Клик по кнопке
if (installBtn) {
  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;

    installBtn.style.display = 'none'; // прячем кнопку после клика
    deferredPrompt.prompt();

    const { outcome } = await deferredPrompt.userChoice;
    console.log('PWA install outcome:', outcome);

    if (outcome === 'accepted') {
      toast('🎉 Приложение установлено на главный экран!', 'success');
    } else {
      toast('Установка отменена', 'info');
    }

    deferredPrompt = null;
  });
}

// Для отладки
console.log('PWA install handler подключён');

// Слушаем событие установки PWA
window.addEventListener('appinstalled', () => {
  console.log('PWA успешно установлено!');
  const installBtn = document.getElementById('install-btn');
  if (installBtn) {
    installBtn.innerHTML =
      '<span class="material-symbols-outlined">check_circle</span>';
    installBtn.title = 'Приложение установлено';
    installBtn.style.opacity = '0.7';
    installBtn.style.cursor = 'default';
    installBtn.style.pointerEvents = 'none';
  }
  toast('🎉 Приложение добавлено на главный экран!', 'success');
});

// Проверяем, установлено ли PWA уже
if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
  navigator.serviceWorker
    .getRegistration()
    .then(registration => {
      if (registration && registration.scope === window.location.origin) {
        // PWA уже установлено, скрываем кнопку
        const installBtn = document.getElementById('install-btn');
        if (installBtn) {
          installBtn.style.display = 'none';
        }
      }
    })
    .catch(() => {
      // Ошибка проверки - оставляем как есть
    });
}

switchTab('words');
