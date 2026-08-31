import { supabase } from './supabase.js';

import { initChat, openChatWithFriend, refreshChatBadges } from './js/chat.js';

console.log('[SCRIPT] 🚀 script.js начинает загрузку');

// Инициализация роли пользователя (по умолчанию обычный пользователь)
window.userRole = 'user';

import {

  applyTheme,

  updateThemeIcon,

  initTheme,

  setupThemeToggle,

} from './js/theme.js';

// UserDataCache будет доступен через window.UserDataCache после загрузки скрипта

import {

  esc,

  safeAttr,

  pluralize,

  stripParens,

  normalizeRussian,

  checkAnswerWithNormalization,

  levenshteinDistance,

  parseAnswerVariants,

  generateId,

  debounce,

  toast,

  showLoading,

  hideLoading,

  setButtonLoading,

  getAudioContext,

  playSound,

  playAudio,

  playIdiomAudio,

  speakText,

  getVoice,

  triggerConfetti,

  triggerSadRain,

  triggerFewDrops,

  triggerLightRain,

  triggerSmallConfetti,

  triggerGoodConfetti,

  spawnConfetti,

  spawnSadRain,

  spawnFewDrops,

  spawnLightRain,

  spawnSmallConfetti,

  spawnGoodConfetti,

  spawnEpicConfetti,

} from './js/utils.js';

// ========== МАППИНГ ДАННЫХ ==========

// Преобразование snake_case → camelCase (для данных из Supabase)

function toCamelCase(obj) {

  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) return obj.map(toCamelCase);

  const result = {};

  for (const [key, value] of Object.entries(obj)) {

    const camelKey = key.replace(/_([a-z])/g, (_, letter) =>

      letter.toUpperCase(),

    );

    result[camelKey] = toCamelCase(value);

  }

  return result;

}

// Преобразование camelCase → snake_case (для отправки в Supabase)

function toSnakeCase(obj) {

  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) return obj.map(toSnakeCase);

  const result = {};

  for (const [key, value] of Object.entries(obj)) {

    const snakeKey = key.replace(

      /[A-Z]/g,

      letter => `_${letter.toLowerCase()}`,

    );

    result[snakeKey] = toSnakeCase(value);

  }

  return result;

}

// Нормализация stats: поддерживает и camelCase, и snake_case

function normalizeStats(stats) {

  if (!stats) {

    return {

      shown: 0,

      correct: 0,

      streak: 0,

      lastPracticed: null,

      learned: false,

      nextReview: new Date().toISOString(),

      interval: 1,

      easeFactor: 2.5,

    };

  }

  return {

    shown: stats.shown ?? 0,

    correct: stats.correct ?? 0,

    streak: stats.streak ?? 0,

    lastPracticed: stats.lastPracticed ?? stats.last_practiced ?? null,

    learned: stats.learned ?? false,

    nextReview:

      stats.nextReview ?? stats.next_review ?? new Date().toISOString(),

    interval: stats.interval ?? 1,

    easeFactor: stats.easeFactor ?? stats.ease_factor ?? 2.5,

  };

}

// ========== БЛОКИРОВКА СКРОЛЛА ДЛЯ МОДАЛОК ==========

// Предотвращает прокрутку body когда скроллишь колесом над модалкой

function initModalScrollLock(modalBackdrop) {

  if (!modalBackdrop) return;

  // Блокируем скролл колесом мыши на backdrop

  modalBackdrop.addEventListener(

    'wheel',

    e => {

      // Если цель события - сам backdrop (не контент модалки)

      if (e.target === modalBackdrop) {

        e.preventDefault();

      }

    },

    { passive: false },

  );

  // Блокируем touch скролл на backdrop (для мобильных)

  modalBackdrop.addEventListener(

    'touchmove',

    e => {

      if (e.target === modalBackdrop) {

        e.preventDefault();

      }

    },

    { passive: false },

  );

}

// Глобальная блокировка скролла для всех модалок (делегирование событий)

document.addEventListener(

  'wheel',

  e => {

    const backdrop = e.target.closest('.modal-backdrop');

    const friendModal = e.target.closest('.friend-modal');

    // Если скролл происходит на backdrop (не на контенте модалки)

    if (backdrop && e.target === backdrop) {

      e.preventDefault();

    }

    // Для friend-modal тоже блокируем

    if (friendModal && e.target === friendModal) {

      e.preventDefault();

    }

  },

  { passive: false },

);

document.addEventListener(

  'touchmove',

  e => {

    const backdrop = e.target.closest('.modal-backdrop');

    const friendModal = e.target.closest('.friend-modal');

    if (backdrop && e.target === backdrop) {

      e.preventDefault();

    }

    if (friendModal && e.target === friendModal) {

      e.preventDefault();

    }

  },

  { passive: false },

);

import {

  loadWords,

  loadIdioms,

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

  searchUsers,

  sendFriendRequest,

} from './db.js';

import {

  sendMessage,

  getMessages,

  markMessagesRead,

  compareDictionaries,

  getFriends,

  getFriendRequests,

  getOutgoingRequests,

  getLeaderboard,

  // ========== ЧЕЛЛЕНДЖИ (ЗАКОММЕНТИРОВАНО) ==========
  /*
  getAllActiveChallenges,

  updateAllChallengesProgress,

  createChallenge,

  joinChallenge,

  updateChallengeProgress,

  leaveChallenge,
  */

  toggleReaction,

  // Приглашения в челленджи (ЗАКОММЕНТИРОВАНО)
  /*
  sendChallengeInvite,

  getChallengeInvites,

  acceptChallengeInvite,

  declineChallengeInvite,

  deleteChallenge,
  */

} from './js/social.js';

import { getReactionsForMessages } from './db.js';

// Импортируем банк идиом

import idiomsBankData from './idioms/idioms.json';

// =============================================

// КОНСТАНТЫ (в самом верху, чтобы auth.js их видел)

// =============================================

// Глобальная функция для обновления текста лоадера

window.updateLoaderText = function (text) {

  const loaderText = document.querySelector(

    '#loading-indicator div:last-child',

  );

  if (loaderText) {

    loaderText.textContent = text;

  }

};

// Глобальная функция для мгновенного скрытия лоадера (особенно для Opera Mobile)

window.forceHideLoader = function () {

  const loadingIndicator = document.getElementById('loading-indicator');

  if (loadingIndicator) {

    loadingIndicator.style.display = 'none';

  }

};

// ========== КЕШ СЛОВ И ИДИОМ (IndexedDB) ==========

let dirtyWordIds = new Set();

let dirtyIdiomIds = new Set();

let deletedWordIds = new Set();

let deletedIdiomIds = new Set();

let cacheSaveTimer = null;

// Инициализация глобальных объектов до их использования

window.xpData = window.xpData || { xp: 0, level: 1, badges: [] };

window.streak = window.streak || { count: 0, lastDate: null, bestStreak: 0, freePassUsedThisWeek: false, freePassWeekStart: null };

// Вспомогательная функция для получения локальной даты в формате YYYY-MM-DD

window.getLocalDate = function(date = new Date()) {

  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, '0');

  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;

};

window.dailyProgress = window.dailyProgress || {

  add_new: 0,

  review: 0,

  practice_time: 0,

  completed: false,

  lastReset: null,

};

// Инициализируем lastReset после определения функции

if (!window.dailyProgress.lastReset) {

  window.dailyProgress.lastReset = window.getLocalDate();

}

// Daily goals reset function

async function resetDailyGoalsIfNeeded() {

  const today = window.getLocalDate();
  console.log('[DAILY DEBUG] resetDailyGoalsIfNeeded:', {
    today,
    lastReset: window.dailyProgress.lastReset,
    practiceTimeBefore: window.dailyProgress.practice_time,
    willReset: window.dailyProgress.lastReset !== today
  });

  if (window.dailyProgress.lastReset !== today) {

    window.dailyProgress = {

      add_new: 0,

      review: 0,

      practice_time: 0,

      completed: false,

      lastReset: today,

    };

    // Сбрасываем dailyXp при новом дне
    window.dailyXp = 0;
    markProfileDirty('dailyxp', window.dailyXp);

    // Mark profile as dirty to ensure reset is saved

    markProfileDirty('dailyprogress', window.dailyProgress);

    // Update UI to show reset goals immediately

    refreshUI();

  }

}

window.user_settings = window.user_settings || {

  voice: 'female',

  reviewLimit: 100,

};

// Глобальные массивы - инициализируем сразу!

window.words = [];

window.idioms = [];

window.verbs = [];

window.verbsLoaded = false;

// ===== НОВЫЕ ПОЛЯ ДЛЯ БЕЙДЖЕЙ =====

window.learningStreak = 0;

window.bestAccuracy = 0;

window.dailyGoalsCompleted = 0;

window.perfectSessions = 0;

window.exercisesTried = 0;

window.bestSpeed = Infinity;

window._exercisesTriedSet = new Set(); // для учёта уникальных упражнений

// История повторений за неделю для графика активности

let weeklyReviewHistory = []; // массив объектов { date: "2025-05-11", count: X }

let weeklyReviewDetail = []; // [{ date: "2025-05-11", words: 0, idioms: 0 }]

// Функция обновления истории повторений

function updateWeeklyReviewHistory() {

  const today = window.getLocalDate();

  const existing = weeklyReviewHistory.find(entry => entry.date === today);

  if (existing) {

    existing.count++;

  } else {

    weeklyReviewHistory.push({ date: today, count: 1 });

  }

  // Оставляем только последние 7 дней

  weeklyReviewHistory = weeklyReviewHistory.slice(-7);

  // Сохраняем в localStorage как резервную копию (опционально)

  const key = `englift_weekly_review_${window.currentUserId}`;
  localStorage.setItem(
    key,
    JSON.stringify(weeklyReviewHistory),
  );

  // Синхронизируем с сервером (если пользователь авторизован)

  if (window.currentUserId && window.markProfileDirty) {

    window.markProfileDirty('weekly_review_history', weeklyReviewHistory);

  }

}

// Функция обновления детализации повторений по типам

function updateWeeklyReviewDetail(type) {

  const today = window.getLocalDate();

  let day = weeklyReviewDetail.find(d => d.date === today);

  if (!day) {

    day = { date: today, words: 0, idioms: 0 };

    weeklyReviewDetail.push(day);

  }

  day[type]++;

  // Оставляем только последние 35 дней (для тепловой карты)

  weeklyReviewDetail = weeklyReviewDetail.slice(-35);

  const key = `englift_weekly_review_detail_${window.currentUserId}`;
  localStorage.setItem(
    key,
    JSON.stringify(weeklyReviewDetail),
  );

  if (window.currentUserId && window.markProfileDirty) {

    window.markProfileDirty('weekly_review_detail', weeklyReviewDetail);

  }

}

// window.idiomsBank удалено - теперь используем IdiomBankDB (IndexedDB)

function markWordDirtyForCache(wordId) {

  dirtyWordIds.add(wordId);

  scheduleCacheSave();

}

function markIdiomDirtyForCache(idiomId) {

  dirtyIdiomIds.add(idiomId);

  scheduleCacheSave();

}

function markIdiomDeletedForCache(idiomId) {

  deletedIdiomIds.add(idiomId);

  scheduleCacheSave();

}

function markWordDeletedForCache(wordId) {

  deletedWordIds.add(wordId);

  scheduleCacheSave();

}

function scheduleCacheSave() {

  if (cacheSaveTimer) clearTimeout(cacheSaveTimer);

  cacheSaveTimer = setTimeout(() => {

    flushCache();

  }, 2000);

}

async function flushCache() {

  try {

    if (dirtyWordIds.size) {

      const toSave = Array.from(dirtyWordIds)

        .map(id => window.words.find(w => w.id === id))

        .filter(Boolean);

      if (toSave.length) await window.UserDataCache.saveWords(toSave);

      dirtyWordIds.clear();

    }

    if (dirtyIdiomIds.size) {

      const toSave = Array.from(dirtyIdiomIds)

        .map(id => window.idioms.find(i => i.id === id))

        .filter(Boolean);

      if (toSave.length) await window.UserDataCache.saveIdioms(toSave);

      dirtyIdiomIds.clear();

    }

    if (deletedWordIds.size) {

      await window.UserDataCache.deleteWords(Array.from(deletedWordIds));

      deletedWordIds.clear();

    }

    if (deletedIdiomIds.size) {

      await window.UserDataCache.deleteIdioms(Array.from(deletedIdiomIds));

      deletedIdiomIds.clear();

    }

  } catch (e) {

    console.error('Ошибка сохранения кеша', e);

  }

}

async function loadFromCache() {

  try {

    const [words, idioms] = await Promise.all([

      window.UserDataCache.getAllWords(),

      window.UserDataCache.getAllIdioms(),

    ]);

    window.words = words.length ? words.map(normalizeWord) : [];

    window.idioms = idioms.length ? idioms.map(normalizeIdiom) : [];

    console.log('[CACHE] Загружено из кеша:', window.words.length, 'слов,', window.idioms.length, 'идиом');
    console.log('[CACHE] window.words после присваивания:', window.words.length);

  } catch (e) {

    console.error('[CACHE] Ошибка загрузки кеша:', e);

    // При ошибке кеша оставляем пустые массивы — данные загрузятся с сервера

    window.words = [];

    window.idioms = [];

  }

}



async function loadVerbs() {

  try {

    const [allRes, oftenRes] = await Promise.all([

      fetch('/verb/all/verb_audio.json'),

      fetch('/verb/often/verb_often_audio.json')

    ]);

    const allVerbs = await allRes.json();

    const oftenVerbs = await oftenRes.json();

    const allWithGroup = allVerbs.map(v => ({ ...v, group: 'all', type: 'verb' }));

    const oftenWithGroup = oftenVerbs.map(v => ({ ...v, group: 'often', type: 'verb' }));

    window.verbs = [...allWithGroup, ...oftenWithGroup];

    window.verbsLoaded = true;

    console.log('[VERBS] Загружено глаголов:', window.verbs.length);

  } catch (e) {

    console.error('[VERBS] Ошибка загрузки:', e);

    window.verbs = [];

  }

}

loadVerbs();



window.speakVerb = function (verbObj, onEnd) {

  if (!verbObj) return;

  const audioFile = verbObj.audio;

  const group = verbObj.group || 'all';

  const voice = window.user_settings?.voice || 'female';

  const folder = voice === 'male' ? 'man' : 'women';

  if (audioFile) {

    const path = `verb/${group}/${folder}/${audioFile}`;

    console.log('[VERB AUDIO] path:', path);

    // Используем createManagedAudio напрямую, как playIdiomAudio

    if (typeof createManagedAudio === 'function') {

      createManagedAudio(path, onEnd);

    } else {

      const audio = new Audio(path);

      audio.play().catch(() => {

        const infinitive = Array.isArray(verbObj.en) ? verbObj.en[0] : verbObj.en.split(' – ')[0];

        speakText(infinitive);

        if (onEnd) onEnd();

      });

      if (onEnd) audio.onended = onEnd;

    }

  } else {

    const infinitive = Array.isArray(verbObj.en) ? verbObj.en[0] : verbObj.en.split(' – ')[0];

    speakText(infinitive, onEnd);

  }

};

function dataHasChanged(remote, local) {

  if (remote.length !== local.length) return true;

  if (remote.length === 0) return false;

  const getRemoteTime = item => item?.updated_at || item?.updatedat || '';

  const getLocalTime = item => item?.updatedAt || item?.updatedat || '';

  return getRemoteTime(remote[0]) !== getLocalTime(local[0]);

}

async function syncFromSupabase() {

  if (!navigator.onLine || !window.currentUserId) return;

  try {

    const { data: remoteWords, error: wordsError } = await supabase

      .from('user_words')

      .select('*')

      .eq('user_id', window.currentUserId)

      .order('created_at', { ascending: false })

      .range(0, 19999);

    if (wordsError) throw wordsError;

    const { data: remoteIdioms, error: idiomsError } = await supabase

      .from('user_idioms')

      .select('*')

      .eq('user_id', window.currentUserId)

      .order('updated_at', { ascending: false });

    if (idiomsError) throw idiomsError;

    let needRefresh = false;

    if (dataHasChanged(remoteWords, window.words)) {

      const localMap = new Map(window.words.map(w => [w.id, w]));

      const merged = (remoteWords || [])

        .map(remoteWord => {

          const local = localMap.get(remoteWord.id);

          if (local) {

            return {

              ...remoteWord,

              created_at: local.createdAt || remoteWord.created_at,

              examplesAudio:

                local.examplesAudio || remoteWord.examples_audio || null,

              examples_audio:

                local.examplesAudio || remoteWord.examples_audio || null,

              grammar: local.grammar || remoteWord.grammar,

              cefr: local.cefr || remoteWord.cefr,

              audio: local.audio || remoteWord.audio,

              phonetic: local.phonetic || remoteWord.phonetic,

              stats: remoteWord.stats

                ? {

                    ...remoteWord.stats,

                    correctExerciseTypes:

                      remoteWord.correct_exercise_types || [],

                  }

                : undefined,

            };

          }

          return remoteWord;

        })

        .map(normalizeWord);

      window.words = merged;

      await window.UserDataCache.clearAllWords();

      if (merged.length) await window.UserDataCache.saveWords(merged);

      needRefresh = true;

    }

    if (dataHasChanged(remoteIdioms, window.idioms)) {

      const normalized = (remoteIdioms || []).map(normalizeIdiom);

      window.idioms = normalized;

      // Полная замена — чистим и пишем заново, без upsert

      await window.UserDataCache.clearAllIdioms();

      if (normalized.length) await window.UserDataCache.saveIdioms(normalized);

      needRefresh = true;

      // dirtyIdiomIds не трогаем — уже сохранили напрямую

    }

    if (needRefresh) {

      refreshUI();

      await flushCache();

    }

  } catch (e) {

    console.error('Ошибка синхронизации с Supabase', e);

  }

}

async function migrateFromLocalStorage() {

  const migrationFlag = localStorage.getItem('englift_cache_migrated');

  if (migrationFlag === 'true') return;

  const wordsKey = `englift_words_${window.currentUserId}`;
  const idiomsKey = `englift_idioms_${window.currentUserId}`;
  const localWords = localStorage.getItem(wordsKey);
  const localIdioms = localStorage.getItem(idiomsKey);

  if (localWords) {

    try {

      const words = JSON.parse(localWords);

      if (words.length) {

        await window.UserDataCache.saveWords(words);

      }

    } catch (e) {}

    localStorage.removeItem(wordsKey);

  }

  if (localIdioms) {

    try {

      const idioms = JSON.parse(localIdioms);

      if (idioms.length) {

        await window.UserDataCache.saveIdioms(idioms);

      }

    } catch (e) {}

    localStorage.removeItem(idiomsKey);

  }

  localStorage.setItem('englift_cache_migrated', 'true');

}

// =============================================

// Debug flag - должен быть определен до использования в функциях

const DEBUG =

  location.hostname === 'localhost' || location.hostname === '127.0.0.1';

// =============================================

// ГЛОБАЛЬНЫЕ КОНСТАНТЫ

// =============================================

const CONSTANTS = {

  XP_PER_LEVEL: 300,

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

    AUTO_LANG: 'en-US',

  },

};

const XP_PER_LEVEL = CONSTANTS.XP_PER_LEVEL;

// Автоматическая перезагрузка при обновлении Service Worker

if ('serviceWorker' in navigator) {

  navigator.serviceWorker.addEventListener('controllerchange', () => {

    window.location.reload();

  });

}

// =============================================

// applyProfileData — ПЕРЕНОСИМ В САМОЕ НАЧАЛО (чтобы auth.js видел её сразу)

// =============================================

window.applyProfileData = function (data) {

  if (!data) {

    return;

  }

  if (window._profileApplyingInProgress) {

    return;

  }

  window._profileApplyingInProgress = true;

  // Сохраняем роль пользователя
  if (data.role) {
    window.userRole = data.role;
    console.log('[AUTH] User role:', window.userRole);
  } else {
    window.userRole = 'user';
  }

  // Инициализируем глобальные объекты, если их нет

  // XP и уровень – берём максимум

  if (data.xp !== undefined && data.level !== undefined) {

    if (window.xpData.xp < data.xp) {

      window.updateXpData({

        xp: data.xp,

        level: data.level,

      });

    } else if (window.xpData.xp > data.xp) {

      markProfileDirty('xp', window.xpData.xp);

      markProfileDirty('level', window.xpData.level);

    }

  }

  // Бейджи – берём с сервера как источник истины (без merge для предотвращения утечки данных)

  if (data.badges && Array.isArray(data.badges)) {

    if (JSON.stringify(window.xpData.badges) !== JSON.stringify(data.badges)) {

      window.xpData.badges = data.badges;

      markProfileDirty('badges', window.xpData.badges);

    }

  }

  // Серия занятий

  if (data.streak !== undefined && data.laststreakdate !== undefined) {
    console.log('[MERGE DEBUG] Streak before merge:', {
      localCount: window.streak.count,
      localLastDate: window.streak.lastDate,
      serverCount: data.streak,
      serverLastDate: data.laststreakdate
    });

    if (window.streak.count < data.streak) {

      window.streak.count = data.streak;

      window.streak.lastDate = data.laststreakdate;

    } else if (window.streak.count > data.streak) {

      // Только если локальное значение > 0, отправляем на сервер
      if (window.streak.count > 0) {
        markProfileDirty('streak', window.streak.count);
        markProfileDirty('laststreakdate', window.streak.lastDate);
      }

    } else {
      // Если серия равна, всё равно восстанавливаем lastDate из сервера
      console.log('[MERGE DEBUG] Streak counts equal, overwriting lastDate from server');
      window.streak.lastDate = data.laststreakdate;
    }

  }

  // Новые поля серии
  if (data.best_streak !== undefined) {
    window.streak.bestStreak = data.best_streak;
  }
  // Синхронизация bestStreak с count (защита от рассинхрона)
  if ((window.streak.bestStreak || 0) < (window.streak.count || 0)) {
    window.streak.bestStreak = window.streak.count;
    markProfileDirty('best_streak', window.streak.bestStreak);
  }
  if (data.free_pass_used !== undefined) {
    window.streak.freePassUsedThisWeek = data.free_pass_used;
  }
  if (data.free_pass_week_start !== undefined) {
    window.streak.freePassWeekStart = data.free_pass_week_start;
  }
  if (data.freeze_notification_shown !== undefined) {
    window.streak.freezeNotificationShown = data.freeze_notification_shown;
  }

  // DailyProgress – по каждому полю берём максимум

  const today = window.getLocalDate();

  if (data.dailyprogress) {
    console.log('[MERGE DEBUG] DailyProgress before merge:', {
      localBefore: window.dailyProgress.practice_time,
      serverValue: data.dailyprogress.practice_time,
      serverLastReset: data.dailyprogress.lastReset,
      today: today
    });

    // Проверяем, что данные с сервера за сегодняшний день, иначе игнорируем practice_time
    const isServerDataToday = data.dailyprogress.lastReset === today;

    window.dailyProgress.add_new = Math.max(

      window.dailyProgress.add_new || 0,

      data.dailyprogress.add_new || 0,

    );

    window.dailyProgress.review = Math.max(

      window.dailyProgress.review || 0,

      data.dailyprogress.review || 0,

    );

    window.dailyProgress.practice_time = isServerDataToday
      ? Math.max(
          window.dailyProgress.practice_time || 0,
          data.dailyprogress.practice_time || 0,
        )
      : (window.dailyProgress.practice_time || 0);

    window.dailyProgress.completed =

      window.dailyProgress.completed || data.dailyprogress.completed;

    window.dailyProgress.lastReset = data.dailyprogress.lastReset || today;

  }

  // Проверяем и сбрасываем ежедневные цели если наступил новый день
  // НО сначала сохраняем practice_time если он был накоплен за сегодня до сброса
  if (window.dailyProgress.lastReset !== today && window.dailyProgress.practice_time > 0) {
    // Если practice_time был накоплен за "сегодня" (по локальному времени), но lastReset старый,
    // значит дата изменилась (например, часовой пояс). Сохраняем practice_time во временное поле
    window.dailyProgress._preservedPracticeTime = window.dailyProgress.practice_time;
  }

  resetDailyGoalsIfNeeded();

  // Восстанавливаем practice_time если он был сохранён
  if (window.dailyProgress._preservedPracticeTime) {
    window.dailyProgress.practice_time = window.dailyProgress._preservedPracticeTime;
    delete window.dailyProgress._preservedPracticeTime;
    markProfileDirty('dailyprogress', window.dailyProgress);
  }

  // dailyReviewCount

  if (data.dailyreviewcount !== undefined) {

    if (window.dailyReviewCount < data.dailyreviewcount) {

      window.dailyReviewCount = data.dailyreviewcount;

    } else if (window.dailyReviewCount > data.dailyreviewcount) {

      markProfileDirty('dailyreviewcount', window.dailyReviewCount);

    }

  }

  // dailyXp
  if (data.dailyxp !== undefined) {
    window.dailyXp = Math.max(window.dailyXp || 0, data.dailyxp);
  }

  // lastReviewResetDate – берём более позднюю дату

  if (data.lastreviewreset) {

    if (

      !window.lastReviewResetDate ||

      data.lastreviewreset > window.lastReviewResetDate

    ) {

      window.lastReviewResetDate = data.lastreviewreset;

    } else if (window.lastReviewResetDate > data.lastreviewreset) {

      markProfileDirty('lastreviewreset', window.lastReviewResetDate);

    }

  }

  // Проверяем и сбрасываем ежедневный лимит повторений если наступил новый день

  checkAndResetDailyCount();

  // Настройки – серверные настройки полностью заменяют локальные

  if (data.usersettings) {

    console.log('[PROFILE] Загрузка настроек с сервера:', data.usersettings);

    // Полностью заменяем настройки серверными
    window.user_settings = { ...data.usersettings };

    console.log('[PROFILE] Итоговые настройки после замены:', window.user_settings);

  }

  // Флаги (has_seen_tour и т.д.) – если серверный true, оставляем, иначе не трогаем

  if (data.has_seen_tour === true) {

    window.user_settings.has_seen_tour = true;

  }

  // Восстановление недельной статистики из профиля (если есть)

  if (data.weekly_review_history && Array.isArray(data.weekly_review_history)) {

    weeklyReviewHistory = data.weekly_review_history;

    const key = `englift_weekly_review_${window.currentUserId}`;
    localStorage.setItem(
      key,
      JSON.stringify(weeklyReviewHistory),
    );

  }

  if (data.weekly_review_detail && Array.isArray(data.weekly_review_detail)) {

    weeklyReviewDetail = data.weekly_review_detail;

    const key = `englift_weekly_review_detail_${window.currentUserId}`;
    localStorage.setItem(
      key,
      JSON.stringify(weeklyReviewDetail),
    );

  }

  // ===== НОВЫЕ ПОЛЯ БЕЙДЖЕЙ (загрузка с сервера) =====

  if (data.learning_streak !== undefined) {

    window.learningStreak = Math.max(window.learningStreak || 0, data.learning_streak);

    markProfileDirty('learning_streak', window.learningStreak);

  }

  if (data.best_accuracy !== undefined) {

    window.bestAccuracy = Math.max(window.bestAccuracy || 0, data.best_accuracy);

    markProfileDirty('best_accuracy', window.bestAccuracy);

  }

  if (data.daily_goals_completed !== undefined) {

    window.dailyGoalsCompleted = Math.max(window.dailyGoalsCompleted || 0, data.daily_goals_completed);

    markProfileDirty('daily_goals_completed', window.dailyGoalsCompleted);

  }

  if (data.perfect_sessions !== undefined) {

    window.perfectSessions = Math.max(window.perfectSessions || 0, data.perfect_sessions);

    markProfileDirty('perfect_sessions', window.perfectSessions);

  }

  if (data.exercises_tried !== undefined) {

    window.exercisesTried = Math.max(window.exercisesTried || 0, data.exercises_tried);

    markProfileDirty('exercises_tried', window.exercisesTried);

  }

  if (data.best_speed !== undefined && data.best_speed < window.bestSpeed) {

    window.bestSpeed = data.best_speed;

    markProfileDirty('best_speed', window.bestSpeed);

  }

  if (data.total_sessions !== undefined) {

    window.totalSessions = Math.max(window.totalSessions || 0, data.total_sessions);

    markProfileDirty('total_sessions', window.totalSessions);

  }

  // Тема

  window._applyingProfile = true;

  window.applyTheme(window.user_settings.baseTheme, window.user_settings.dark);

  window._applyingProfile = false;

  // Обновляем банк слов после загрузки настроек

  currentBankWord = null;

  shownBankWordEn.clear();

  renderRandomBankWord();

  window.lastProfileUpdate = data.updated_at

    ? new Date(data.updated_at).getTime()

    : Date.now();

  // Сохраняем в localStorage на всякий случай

  const backup = {

    xp: window.xpData.xp,

    level: window.xpData.level,

    badges: window.xpData.badges,

    streak: window.streak.count,

    last_streak_date: window.streak.lastDate,

    dailyprogress: window.dailyProgress,

    dailyreviewcount: window.dailyReviewCount,

    lastreviewreset: window.lastReviewResetDate,

    usersettings: window.user_settings,

  };

  const key = `englift_lastknown_progress_${window.currentUserId}`;
  localStorage.setItem(key, JSON.stringify(backup));

  window._profileApplyingInProgress = false;

  refreshUI();

};

// Функции triggerConfetti, triggerSadRain, triggerFewDrops перенесены в js/utils.js

// Функции triggerLightRain, triggerSmallConfetti, triggerGoodConfetti перенесены в js/utils.js

// =============================================

// =============================================

// =============================================

// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ (объявляются ДО их использования)

// =============================================

('use strict');

// Отключаем автоматическое восстановление скролла при обновлении страницы

if ('scrollRestoration' in history) {

  history.scrollRestoration = 'manual';

}

// Глобальные переменные

window.DEBUG = false;

window.idioms = []; // глобальный массив идиом (только пользовательские)

// window.idiomsBank удалено - теперь используем IdiomBankDB (IndexedDB)

// User settings and progress

window.user_settings = {

  voice: 'female',

  reviewLimit: 100,

  bankWordLevel: 'all', // ← новое поле

};

window.dailyProgress = {

  add_new: 0,

  review: 0,

  practice_time: 0,

  completed: false,

  lastReset: window.getLocalDate(),

};

window.cefrLevels = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 };

window.dailyReviewCount = 0;

window.lastReviewResetDate = null;

window.postponedToastShown = false;

// Количество непрочитанных сообщений

window.unreadMessagesCount = 0;

// Streak and XP

let streak = { count: 0, lastDate: null };

let xpData = { xp: 0, level: 1, badges: [] };

let pendingXpLogs = []; // Очередь для XP логов в офлайн режиме

// 🔥 ФИКС 1: Привязываем window.xpData и window.streak к локальным переменным

// Теперь все функции работают с ОДНИМИ И ТЕМИ ЖЕ объектами!

window.xpData = xpData;

window.streak = streak;

// Friends data - объявляем здесь чтобы избежать ошибки инициализации

let friendsData = { friends: [], requests: [], outgoing: [], leaderboard: [] };

// Profile version tracking

window.lastProfileUpdate = 0; // время последнего обновления профиля (с сервера)

// Practice session variables

let sResults = { correct: [], wrong: [] };

let sIdx = 0;

window.session = null;

let autoPron = true;

let lastSessionConfig = null;

let currentExerciseTimer = null;

let exerciseAudioToken = 0;

window.isSessionActive = false;

// Practice modes

let practiceMode = 'normal';

let selectedWordExercises = []; // array of selected exercises for words

let selectedIdiomExercises = []; // array of selected exercises for idioms

let selectedVerbExercises = []; // array of selected exercises for verbs

// Variables for preventing repeats in sessions

let recentlyShownIds = [];

const RECENTLY_SHOWN_MAX = 1000; // или любое число, превышающее количество ваших слов

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

window.sortBy = sortBy;

// Infinite scroll variables

let visibleLimit = 30;

let isLoadingMore = false;

let intersectionObserver = null;

let renderCache = new Map();

let searchDebounceTimer = null;

// Variables for infinite scroll optimization

let currentFilteredWords = []; // отфильтрованный и отсортированный список слов

let currentFilteredIdioms = []; // отфильтрованный и отсортированный список идиом

let renderedWordsCount = 0; // количество отрендеренных слов в текущей сетке

let renderedIdiomsCount = 0; // количество отрендеренных идиом в текущей сетке

// Idioms variables

let idiomsVisibleLimit = 30;

let idiomsIsLoadingMore = false;

let idiomsIntersectionObserver = null;

let idiomsSearchQuery = '';

let idiomsSortBy = 'date-desc';

let idiomsTagFilter = '';

let idiomsActiveFilter = 'all';

let verbActiveFilter = 'often'; // Частые глаголы по умолчанию

// Sync and save variables

let refreshScheduled = false;

let badgeCheckInterval = null;

let retryAttempts = 0;

let wordBankCache = null;

let fileParsed = [];

let lastFetchedWordData = null;

let lastFetchedIdiomData = null;

let pendingWordUpdates = new Map();

let pendingIdiomUpdates = new Map();

let wordSyncTimer;

let idiomSyncTimer;

let audioContext = null;

let currentRecognition = null;

let currentTooltip = null;
let currentTooltipTarget = null;
let tooltipHideTimer = null;

function removeCurrentTooltip() {
  if (tooltipHideTimer) {
    clearTimeout(tooltipHideTimer);
    tooltipHideTimer = null;
  }

  if (currentTooltip) {
    currentTooltip.remove();
    currentTooltip = null;
    currentTooltipTarget = null;
  }
}

function positionTooltipBottomLeft(tooltip, targetElement) {
  const gap = 10;
  const edge = 12;

  const rect = targetElement.getBoundingClientRect();
  const tipRect = tooltip.getBoundingClientRect();

  // Position tooltip below and to the left of the target
  let left = rect.right - tipRect.width;
  let top = rect.bottom + gap;
  let placement = 'bottom-left';

  // Ensure tooltip doesn't go off left edge
  if (left < edge) left = edge;

  // Ensure tooltip doesn't go off right edge
  if (left + tipRect.width > window.innerWidth - edge) {
    left = window.innerWidth - tipRect.width - edge;
  }

  // If not enough space below, show above
  if (top + tipRect.height > window.innerHeight - edge) {
    top = rect.top - tipRect.height - gap;
    placement = 'top-left';
  }

  // Ensure tooltip doesn't go off top edge
  if (top < edge) {
    top = edge;
  }

  tooltip.style.left = `${Math.round(left)}px`;
  tooltip.style.top = `${Math.round(top)}px`;
  tooltip.dataset.placement = placement;
}

function showTooltip(text, targetElement, options = {}) {
  if (!targetElement || !targetElement.isConnected) return;

  const displayText = (text || '').trim();
  if (!displayText) return;

  if (currentTooltip && currentTooltipTarget === targetElement) {
    return;
  }

  removeCurrentTooltip();

  const tooltip = document.createElement('div');
  tooltip.className = 'custom-tooltip';
  tooltip.innerHTML = displayText.replace(/\n/g, '<br>');
  tooltip.style.position = 'fixed';
  tooltip.style.pointerEvents = 'none';

  document.body.appendChild(tooltip);

  positionTooltipBottomLeft(tooltip, targetElement);

  // Add is-visible class after positioning
  requestAnimationFrame(() => {
    tooltip.classList.add('is-visible');
  });

  currentTooltip = tooltip;
  currentTooltipTarget = targetElement;

  if (options.autoHide !== false) {
    tooltipHideTimer = setTimeout(() => {
      removeCurrentTooltip();
    }, options.duration || 3500);
  }
}

function hideTooltip() {
  removeCurrentTooltip();
}

function repositionTooltip() {
  if (currentTooltip && currentTooltipTarget?.isConnected) {
    positionTooltipBottomLeft(currentTooltip, currentTooltipTarget);
  } else {
    removeCurrentTooltip();
  }
}

function bindTooltip(el) {
  if (!el || el.dataset.tooltipBound === 'true') return;

  el.dataset.tooltipBound = 'true';

  el.addEventListener('mouseenter', () => {
    showTooltip(el.dataset.tooltip || '', el, { autoHide: false });
  });

  el.addEventListener('mouseleave', hideTooltip);
  el.addEventListener('focus', () => {
    showTooltip(el.dataset.tooltip || '', el, { autoHide: false });
  });
  el.addEventListener('blur', hideTooltip);
}

window.addEventListener('scroll', hideTooltip, { passive: true });
window.addEventListener('touchmove', hideTooltip, { passive: true });
window.addEventListener('resize', repositionTooltip, { passive: true });

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

    xpReward: 5,

  },

  {

    id: 'review',

    target: 20,

    icon: 'repeat',

    label: 'Повторений',

    unit: 'раз',

    xpReward: 10,

  },

  {

    id: 'practice_time',

    target: 900,

    icon: 'schedule',

    label: 'Время практики',

    unit: 'сек',

    xpReward: 10,

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

    name: 'Идиомы 25',

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

    description: 'Выполните все ежедневные цели',

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

    name: 'Последователь',

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

  // ===== Социальные бейджи =====

  {

    id: 'friends_3',

    name: 'Дружелюбный',

    description: 'Добавьте 3 друзей',

    icon: 'group',

    condition: data => data.friendsCount >= 3,

    progress: data => ({ current: Math.min(data.friendsCount, 3), target: 3 }),

    category: 'social',

    rarity: 'common',

    xp: 50,

  },

  {

    id: 'friends_10',

    name: 'Социальный',

    description: 'Добавьте 10 друзей',

    icon: 'groups',

    condition: data => data.friendsCount >= 10,

    progress: data => ({

      current: Math.min(data.friendsCount, 10),

      target: 10,

    }),

    category: 'social',

    rarity: 'rare',

    xp: 150,

  },

  {

    id: 'inviter',

    name: 'Приглашающий',

    description: 'Пригласите 3 друзей через ссылку',

    icon: 'share',

    condition: data => data.invitedCount >= 3,

    progress: data => ({ current: Math.min(data.invitedCount, 3), target: 3 }),

    category: 'social',

    rarity: 'rare',

    xp: 100,

  },

];

// Global flags

window.profileFullyLoaded = false;

window.pendingWordUpdates = pendingWordUpdates;

window.pendingIdiomUpdates = pendingIdiomUpdates;

// =============================================

// ФУНКЦИИ НОРМАЛИЗАЦИИ ДАННЫХ

// =============================================

function normalizeWord(word) {

  const camel = toCamelCase(word);

  // Гарантируем наличие объекта stats

  if (!camel.stats) {

    camel.stats = {

      shown: 0,

      correct: 0,

      streak: 0,

      lastPracticed: null,

      learned: false,

      nextReview: new Date().toISOString(),

      interval: 1,

      easeFactor: 2.5,

      correctExerciseTypes: [],

    };

  }

  const correctExerciseTypes = Array.isArray(camel.stats.correctExerciseTypes)

    ? camel.stats.correctExerciseTypes

    : Array.isArray(camel.stats.correct_exercise_types)

      ? camel.stats.correct_exercise_types

      : camel.stats.learned

        ? ['legacy']

        : [];

  const normalized = {

    ...camel,

    examplesAudio:

      Array.isArray(camel.examplesAudio) && camel.examplesAudio.length

        ? camel.examplesAudio

        : Array.isArray(camel.examples_audio) && camel.examples_audio.length

          ? camel.examples_audio

          : [],

    stats: {

      ...camel.stats,

      correctExerciseTypes,

    },

  };

  return normalized;

}

function normalizeIdiom(idiom) {

  const camel = toCamelCase(idiom);

  return {

    ...camel,

    examplesAudio:

      Array.isArray(camel.examplesAudio) && camel.examplesAudio.length

        ? camel.examplesAudio

        : Array.isArray(camel.examples_audio) && camel.examples_audio.length

          ? camel.examples_audio

          : [],

    stats: camel.stats

      ? {

          ...camel.stats,

          correctExerciseTypes: Array.isArray(camel.stats.correctExerciseTypes)

            ? camel.stats.correctExerciseTypes

            : camel.stats.learned

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

// Функции playAudio и playIdiomAudio перенесены в js/utils.js

// Глобальный массив для отслеживания всех активных аудио

window.activeAudioElements = [];

// Универсальная функция для остановки всех волн аудио

function stopAllAudioWaves() {

  // Останавливаем TTS

  if (window.speechSynthesis) window.speechSynthesis.cancel();

  // Останавливаем все отслеживаемые аудио элементы

  window.activeAudioElements.forEach(audio => {

    try {

      audio.pause();

      audio.currentTime = 0;

    } catch (e) {

      // Игнорируем ошибки

    }

  });

  window.activeAudioElements = [];

  document.querySelectorAll('.audio-wave').forEach(wave => {

    if (wave._originalBtn) {

      // Pattern 1: волна заменила кнопку через replaceChild

      if (wave.parentNode) {

        try {

          wave.parentNode.replaceChild(wave._originalBtn, wave);

          wave._originalBtn.style.display = '';

        } catch (e) {

          wave.remove();

        }

      }

    } else {

      // Pattern 2: волна внутри кнопки (.coll-audio-btn, .example-audio-btn)

      const icon = wave.parentNode?.querySelector('.material-symbols-outlined');

      wave.remove();

      if (icon) icon.style.display = '';

    }

  });

}

// Глобальные функции для всего сайта

window.speakWord = function (wordObj, onEnd) {

  let audioFile = null;

  let cefr = null;

  let wordEn = null;

  if (typeof wordObj === 'string') {

    const word = window.words.find(w => w.en === wordObj || w.id === wordObj);

    if (word) {

      audioFile = word.audio;

      cefr = word.cefr;

      wordEn = word.en;

    }

  } else if (wordObj && wordObj.en) {

    audioFile = wordObj.audio;

    cefr = wordObj.cefr;

    wordEn = wordObj.en;

  } else if (wordObj && wordObj.word) {

    const word = window.words.find(

      w => w.en === wordObj.word || w.id === wordObj.word,

    );

    if (word) {

      audioFile = word.audio;

      cefr = word.cefr;

      wordEn = word.en;

    }

  }

  if (!audioFile) {

    if (onEnd) onEnd();

    return;

  }

  // cefr нет в данных пользователя (старые слова без уровня)

  // ищем в банке слов через IndexedDB

  if (!cefr && wordEn && window.WordBankDB) {

    window.WordBankDB.searchWords(wordEn, 5)

      .then(results => {

        const bankWord = results.find(

          r => r.en.toLowerCase() === wordEn.toLowerCase(),

        );

        const foundCefr = bankWord?.cefr || null;

        // заодно сохраняем cefr обратно в слово чтобы в следующий раз не искать

        if (foundCefr) {

          const w = window.words.find(w => w.en === wordEn);

          if (w) w.cefr = foundCefr;

        }

        playAudio(audioFile, foundCefr, onEnd);

      })

      .catch(() => playAudio(audioFile, null, onEnd));

    return;

  }

  playAudio(audioFile, cefr, onEnd);

};

window.speakIdiom = function (idiomId) {

  const idiom = window.idioms.find(i => i.id === idiomId);

  if (!idiom) return;

  if (idiom.audio) playIdiomAudio(idiom.audio);

  else speakText(idiom.idiom);

};

window.playExampleAudio = function (wordObj, cefr) {

  if (!wordObj || !wordObj.examplesAudio || !wordObj.examplesAudio.length)

    return;

  playAudio(wordObj.examplesAudio[0], cefr);

};

// Conditional debug logging

const debugLog = (...args) => {};

// Умный logger для production

const logger = {

  log: (...args) => {},

  error: (...args) => console.error(...args), // ошибки всегда показываем

  warn: (...args) => console.warn(...args), // предупреждения всегда

  info: (...args) => {},

};

// File import variables

// Функция обновления счётчика идиом

function updateIdiomsCount() {

  // Бейджи убраны из nav, updateDueBadge теперь всё обновляет

  updateDueBadge();

}

// ============================================================

// THEME MANAGEMENT - перенесено в js/theme.js

// ============================================================

window.profileFullyLoaded = false;

function markWordDirty(wordId) {

  const word = window.words?.find(w => w.id === wordId);

  if (word) {

    pendingWordUpdates.set(wordId, toSnakeCase(word));

  }

  scheduleWordSync();

}

window.markWordDirty = markWordDirty;

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

  for (const [wordId, staleItem] of pendingWordUpdates.entries()) {

    if (staleItem._deleted) {

      try {

        await deleteWordFromDb(wordId);

        pendingWordUpdates.delete(wordId);

      } catch (e) {

        console.error('Ошибка удаления слова:', e);

      }

      continue;

    }

    // Всегда берём свежак из window.words — там актуальные stats

    const freshWord = window.words?.find(w => w.id === wordId);

    if (!freshWord) {

      pendingWordUpdates.delete(wordId);

      continue;

    }

    try {

      await saveWordToDb(toSnakeCase(freshWord)); // Конвертируем в snake_case для БД

      pendingWordUpdates.delete(wordId);

    } catch (e) {

      console.error('save failed:', freshWord.en, e);

    }

  }

}

function markIdiomDirty(idiomId) {

  const idiom = window.idioms?.find(i => i.id === idiomId);

  if (idiom) {

    pendingIdiomUpdates.set(idiomId, toSnakeCase(idiom));

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

        pendingIdiomUpdates.delete(item.id);

      } catch (e) {

        console.error(`Ошибка удаления идиомы "${item.idiom}":`, {

          message: e.message,

          details: e.details,

          statusText: e.statusText,

          error: e.error,

        });

      }

    } else {

      try {

        await saveIdiomToDb(item);

        pendingIdiomUpdates.delete(item.id);

      } catch (e) {

        console.error(`Ошибка синхронизации идиомы "${item.idiom}":`, {

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

    // Синхронизация завершена

  }

}

// =============================================

// СИНХРОНИЗАЦИЯ ПРОФИЛЯ (НОВАЯ СИСТЕМА)

// =============================================

// ========== Синхронизация профиля (новая) ==========

const pendingProfileUpdates = new Map();

let profileSyncTimer = null;

function markProfileDirty(key, value) {

  pendingProfileUpdates.set(key, value);

  scheduleProfileSync();

}

function scheduleProfileSync() {

  if (profileSyncTimer) {

    clearTimeout(profileSyncTimer);

  }

  profileSyncTimer = setTimeout(() => {

    syncProfileNow();

  }, 500);

}

// Флаги для предотвращения параллельных синхронизаций

let syncInProgress = false;

async function syncProfileNow() {

  // Если нет userId — нечего синхронизировать

  if (!window.currentUserId) {

    return;

  }

  // Если синхронизация уже идёт — не запускаем параллельную

  if (syncInProgress) {

    return;

  }

  syncInProgress = true;

  // Проверяем интернет-соединение

  if (!navigator.onLine) {

    syncInProgress = false;

    return;

  }

  if (pendingProfileUpdates.size === 0) {

    syncInProgress = false;

    return;

  }

  const updates = Object.fromEntries(pendingProfileUpdates);

  pendingProfileUpdates.clear(); // чистим до запроса

  try {

    // Добавляем таймаут для запроса

    const requestPromise = supabase

      .from('profiles')

      .update(updates)

      .eq('id', window.currentUserId);

    const timeoutPromise = new Promise((_, reject) => {

      setTimeout(() => reject(new Error('Request timeout')), 10000); // 10 секунд таймаут

    });

    const { error } = await Promise.race([requestPromise, timeoutPromise]);

    if (error) {

      throw error;

    }

    window.lastProfileUpdate = Date.now(); // обновляем метку времени (для совместимости, но не используем для сравнения)

    resetProfileRetryCount(); // сбрасываем счётчик повторных попыток

  } catch (err) {

    // Возвращаем данные в очередь при ошибке
    for (const [key, value] of Object.entries(updates)) {
      pendingProfileUpdates.set(key, value);
    }

    // Тост отключен - данные сохраняются локально и будут отправлены позже
    // window.toast?.(
    //   'Ошибка сохранения профиля. Изменения будут отправлены позже.',
    //   'warning',
    // );

    // Восстанавливаем только те ключи, которые не были обновлены за время запроса

    Object.entries(updates).forEach(([k, v]) => {

      if (!pendingProfileUpdates.has(k)) {

        pendingProfileUpdates.set(k, v);

      }

    });

    // Фикс 3: Повторная попытка только если есть что ретраить

    if (pendingProfileUpdates.size > 0) {

      let retryDelay = Math.min(

        60000,

        Math.pow(2, window._profileRetryCount || 0) * 1000,

      );

      window._profileRetryCount = (window._profileRetryCount || 0) + 1;

      setTimeout(() => {

        syncProfileNow();

      }, retryDelay);

    }

  } finally {

    // Фикс 2: Всегда сбрасываем флаг синхронизации

    syncInProgress = false;

  }

}

// При успешном сохранении сбрасываем счётчик повторных попыток

function resetProfileRetryCount() {

  window._profileRetryCount = 0;

}

// Для совместимости со старым кодом (чтобы не ломать)

window.syncProfileToServer = syncProfileNow;

window.scheduleProfileSave = () => {

  // Заглушка для совместимости

}; // заглушка

// Сохранение при закрытии страницы - объединено с основным обработчиком

// Сохранение перед выгрузкой страницы

window.addEventListener('beforeunload', () => {

  syncProfileNow(); // немедленно сохраняем

});

// Периодическое сохранение каждые 60 секунд

setInterval(() => {

  syncProfileNow();

}, 60000);

// Глобальные переменные

window.unreadMessagesCount = 0;

// Функция обновления плавающей кнопки

function updateFloatingChatButton() {

  const btn = document.getElementById('floating-chat-btn');

  const badge = document.getElementById('floating-chat-badge');

  if (!btn) return;

  // Если открыт чат, кнопку скрываем только если нет непрочитанных в других чатах

  if (window.currentChatFriend) {

    if (window.unreadMessagesCount > 0) {

      // Показываем кнопку с бейджем оставшихся сообщений

      btn.style.display = 'flex';

      badge.textContent =

        window.unreadMessagesCount > 9 ? '9+' : window.unreadMessagesCount;

      badge.style.display = 'flex';

    } else {

      // Нет непрочитанных - скрываем кнопку

      btn.style.display = 'none';

      badge.style.display = 'none';

    }

    return;

  }

  if (window.unreadMessagesCount > 0) {

    btn.style.display = 'flex';

    badge.textContent =

      window.unreadMessagesCount > 9 ? '9+' : window.unreadMessagesCount;

    badge.style.display = 'flex';

  } else {

    btn.style.display = 'none';

    badge.style.display = 'none';

  }

}

// Периодическая проверка заявок в друзья раз в минуту

setInterval(() => {

  if (window.currentUserId && navigator.onLine) {

    checkFriendRequests();

  }

}, 60000); // 60 seconds = 1 minute

// Функция проверки новых заявок в друзья

async function checkFriendRequests() {

  try {

    const requests = await getFriendRequests(window.currentUserId);

    const currentCount = friendsData.requests?.length || 0;

    const newCount = requests?.length || 0;

    // Если появились новые заявки

    if (newCount > currentCount && newCount > 0) {

      const latestRequest = requests[0]; // Самая новая заявка

      const senderName = latestRequest.username || 'пользователя';

      toast(`Новая заявка в друзья от ${senderName}!`, 'info', 'person_add');

      playSound('sound/message.mp3');

      // Обновляем данные

      friendsData.requests = requests;

      renderFriendsRequests();

      updateFriendsNavBadge();

    }

  } catch (error) {

    console.error('Error checking friend requests:', error);

  }

}

// Синхронизация слов с сервером (унифицированная функция)

async function syncWordsToServer() {

  await syncPendingWords();

}

// Отложенная синхронизация при восстановлении соединения

function scheduleDelayedSync(delay = 30000) {

  if (syncTimeout) {

    clearTimeout(syncTimeout);

  }

  syncTimeout = setTimeout(async () => {

    try {

      // Временно закомментировано чтобы не мешать редиректу

      // const user = await getCurrentUser();

      // if (user) {

      //   await syncWordsToServer();

      // }

    } catch (e) {

      console.error('❌ Ошибка отложенной синхронизации:', e);

    }

  }, delay);

}

// Инициализация переменных ДО их использования

// Daily progress tracking - должно быть объявлено ДО использования

window.dailyProgress = {

  add_new: 0,

  review: 0,

  practice_time: 0,

  completed: false,

  lastReset: window.getLocalDate(), // "2026-03-05"

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

  const today = window.getLocalDate(); // YYYY-MM-DD

  if (window.lastReviewResetDate !== today) {

    window.dailyReviewCount = 0;

    window.lastReviewResetDate = today;

    // Помечаем профиль как изменённый, чтобы сохранить новую дату

    if (window.currentUserId) {

      markProfileDirty('dailyreviewcount', window.dailyReviewCount);

      markProfileDirty('lastreviewreset', window.lastReviewResetDate);

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

      `Осталось только ${pluralize(remaining, 'упражнение', 'упражнения', 'упражнений')} на сегодня. Будет показано ${remaining} из ${requestedCount} слов.`,

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

  if (window.currentUserId) {

    markProfileDirty('dailyreviewcount', window.dailyReviewCount);

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

    renderMonthHeatmap();

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

  // Отладочная информация о лимитах

};

// window.isProfileEmpty = isProfileEmpty;

// Удалено: старая функция loadIdiomsBank заменена на IdiomAPI.loadIdiomBank

// Идиомы теперь загружаются из IndexedDB в onProfileFullyLoaded

// Debounce функция перенесена в js/utils.js

import { debounce, stopCurrentMediaAudio } from './js/utils.js';

const debouncedRenderStats = debounce(renderStats, 800);

// Handle window resize to update stats display based on screen width

window.addEventListener(

  'resize',

  debounce(() => {

    renderStats();

  }, 200),

);

// Функции debouncedSaveUserData и immediateSaveUserData удалены - заменены на markProfileDirty

// ...

// ============================================================

// DELAYED SYNC SYSTEM (offline-first)

// ============================================================

// XSS protection function

// Функция saveAllUserData удалена - заменена на markProfileDirty

// Функция saveProfileData удалена - заменена на markProfileDirty

// syncSaveProfile — тоже через очередь

function syncSaveProfile() {

  if (!window.currentUserId || !window.profileFullyLoaded) return;

  scheduleProfileSave();

}

// Retry механизм scheduleRetrySave удален - функция не использовалась

// Экспорт saveProfileData удален - функция больше не существует

// debouncedSaveProfile removed - use scheduleProfileSave instead

// Сохранение через Beacon при закрытии - удалено, используется unified обработчик в конце файла

// Старая функция syncSaveProfile заменена на syncProfileNow

window.syncSaveProfile = syncProfileNow;

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

// Функция safeSaveStats удалена - не использовалась

// ============================================================

// WEEK STATISTICS (простая замена графика)

// ============================================================

function getWeekTotal(offsetDays) {
  let total = 0;
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i - offsetDays);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const stats = weeklyReviewDetail.find(day => day.date === dateStr);
    if (stats) total += (stats.words ?? 0) + (stats.idioms ?? 0);
  }
  return total;
}

function renderWeekChart() {
  const container = document.querySelector('.week-chart-container');
  if (!container) return;

  const key = `englift_weekly_review_detail_${window.currentUserId}`;
  const saved = localStorage.getItem(key);
  if (saved) {
    weeklyReviewDetail = JSON.parse(saved).map(day => ({
      date: day.date,
      words: day.words ?? 0,
      idioms: day.idioms ?? 0,
    }));
  }

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const dayName = d.toLocaleDateString('ru-RU', { weekday: 'short' });
    const dateShow = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'numeric' });
    const stats = weeklyReviewDetail.find(day => day.date === dateStr) || { words: 0, idioms: 0 };
    days.push({
      dayName, dateShow,
      words: stats.words ?? 0,
      idioms: stats.idioms ?? 0,
      total: (stats.words ?? 0) + (stats.idioms ?? 0),
      isToday: i === 0,
    });
  }

  const maxValue = Math.max(...days.flatMap(d => [d.words, d.idioms]), 1);
  const goal = window.user_settings?.dailyGoal || 10;
  const goalLinePercent = Math.min(100, (goal / maxValue) * 100);

  const thisWeekTotal = getWeekTotal(0);
  const lastWeekTotal = getWeekTotal(7);
  const trend = lastWeekTotal > 0
    ? Math.round(((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100)
    : null;

  const totalWords = days.reduce((s, d) => s + d.words, 0);
  const totalIdioms = days.reduce((s, d) => s + d.idioms, 0);

  // Вставляем тренд в заголовок только если есть данные
  const header = container.querySelector('.daily-cap-header');
  const existingTrend = header.querySelector('.week-trend');
  if (existingTrend) existingTrend.remove();
  
  if (trend !== null) {
    const trendHtml = `
    <div class="week-trend" data-tooltip="Сравнение с прошлой неделей: ${thisWeekTotal} слов на этой неделе против ${lastWeekTotal} на прошлой" tabindex="0" aria-label="Сравнение с прошлой неделей: ${thisWeekTotal} слов на этой неделе против ${lastWeekTotal} на прошлой">
      <span class="material-symbols-outlined">${trend >= 0 ? 'trending_up' : 'trending_down'}</span>
      ${trend >= 0 ? '+' : ''}${trend}%
    </div>
  `;
    header.insertAdjacentHTML('beforeend', trendHtml);
  }

  // Привязываем тултип к новому элементу
  const newTrend = header.querySelector('.week-trend');
  if (newTrend && typeof bindTooltip === 'function') {
    bindTooltip(newTrend);
  }

  const html = `
    <div class="week-stats">
      <div class="goal-line" style="bottom: ${goalLinePercent}%"></div>
      ${days.map((d, idx) => `
        <div class="week-stat-item${d.isToday ? ' today' : ''}" data-idx="${idx}" data-words="${d.words}" data-idioms="${d.idioms}">
          <div class="week-bars">
            <div class="week-bar words-bar${d.words === 0 ? ' empty' : ''}" data-h="${(d.words / maxValue) * 60}" style="height: 0px"></div>
            <div class="week-bar idioms-bar${d.idioms === 0 ? ' empty' : ''}" data-h="${(d.idioms / maxValue) * 60}" style="height: 0px"></div>
          </div>
          <div class="week-day">${d.dayName}</div>
        </div>
      `).join('')}
    </div>
    <p class="day-detail">Нажми на день, чтобы увидеть разбивку</p>
    <div class="week-total">
      <div class="week-total-item">
        <div class="value">${totalWords}</div>
        <div class="label"><span class="material-symbols-outlined" style="font-size:14px">menu_book</span>слова</div>
      </div>
      <div class="week-total-item">
        <div class="value">${totalIdioms}</div>
        <div class="label"><span class="material-symbols-outlined" style="font-size:14px">theater_comedy</span>идиомы</div>
      </div>
    </div>
  `;

  let weekView = container.querySelector('#activity-week-view');
  if (!weekView) {
    weekView = document.createElement('div');
    weekView.id = 'activity-week-view';
    container.appendChild(weekView);
  }
  weekView.innerHTML = html;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      weekView.querySelectorAll('.week-bar[data-h]').forEach(bar => {
        bar.style.height = bar.dataset.h + 'px';
      });
    });
  });

  weekView.querySelectorAll('.week-stat-item').forEach((item, idx) => {
    item.addEventListener('click', () => {
      const detail = weekView.querySelector('.day-detail');
      const dayInfo = days[idx];
      detail.textContent = `${dayInfo.dayName}, ${dayInfo.dateShow}: слова — ${dayInfo.words}, идиомы — ${dayInfo.idioms}`;
    });
  });

  updateStreakBadge();
  setupActivityTabs(container);
}

function updateStreakBadge() {
  const badge = document.getElementById('activity-streak-count');
  if (badge && window.streak) {
    badge.textContent = window.streak.count || 0;
  }
}

function setupActivityTabs(container) {
  const tabs = container.querySelectorAll('.activity-tab');
  tabs.forEach(tab => {
    const clone = tab.cloneNode(true);
    tab.parentNode.replaceChild(clone, tab);
  });
  container.querySelectorAll('.activity-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('.activity-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const view = tab.dataset.view;
      const weekView = container.querySelector('#activity-week-view');
      let monthView = container.querySelector('#activity-month-view');
      if (view === 'week') {
        if (weekView) weekView.style.display = 'block';
        if (monthView) monthView.style.display = 'none';
      } else {
        if (weekView) weekView.style.display = 'none';
        if (!monthView) {
          monthView = document.createElement('div');
          monthView.id = 'activity-month-view';
          container.appendChild(monthView);
          renderMonthHeatmap(monthView);
        }
        monthView.style.display = 'block';
      }
    });
  });
}

function renderMonthHeatmap(container) {
  if (!container) {
    container = document.querySelector('#activity-month-view');
  }
  if (!container) return;

  const key = `englift_weekly_review_detail_${window.currentUserId}`;
  const saved = localStorage.getItem(key);
  const detail = saved ? JSON.parse(saved) : weeklyReviewDetail;

  const cells = [];
  for (let i = 34; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const stats = detail.find(day => day.date === dateStr);
    const total = stats ? (stats.words ?? 0) + (stats.idioms ?? 0) : 0;
    let level = 0;
    if (total > 0) level = 1;
    if (total >= 50) level = 2;
    if (total >= 80) level = 3;
    if (total >= 100) level = 4;
    cells.push({ dateStr, total, level });
  }

  container.innerHTML = `
    <p style="font-size:0.82rem; color: var(--muted); margin: 0 0 0.5rem; text-align: center;">Последние 35 дней</p>
    <div class="month-heatmap">
      ${cells.map(c => {
        const stats = detail.find(day => day.date === c.dateStr);
        const words = stats ? (stats.words ?? 0) : 0;
        const idioms = stats ? (stats.idioms ?? 0) : 0;
        return `<div class="heatmap-cell level-${c.level}" data-date="${c.dateStr}" data-total="${c.total}" data-tooltip="${c.dateStr}\nСлов: ${words}\nИдиом: ${idioms}" tabindex="0" aria-label="${c.dateStr}: ${words} слов, ${idioms} идиом"></div>`;
      }).join('')}
    </div>
    <div class="heatmap-legend">
      <div class="legend-item"><div class="legend-cell level-0"></div><span>0</span></div>
      <div class="legend-item"><div class="legend-cell level-1"></div><span>1-49</span></div>
      <div class="legend-item"><div class="legend-cell level-2"></div><span>50-79</span></div>
      <div class="legend-item"><div class="legend-cell level-3"></div><span>80-99</span></div>
      <div class="legend-item"><div class="legend-cell level-4"></div><span>100+</span></div>
    </div>
  `;

  // Привязываем тултипы к ячейкам
  container.querySelectorAll('.heatmap-cell').forEach(cell => {
    if (typeof bindTooltip === 'function') {
      bindTooltip(cell);
    }
  });
}

// ============================================================

// GLOBAL FUNCTIONS FOR AUTH.JS

// ============================================================

// CONSTANTS

// ============================================================

// Разбирает строку с несколькими вариантами перевода (разделители / , ;)

function parseAnswerVariants(str) {

  if (!str) return [];

  return str

    .split(/[\/,;]/)

    .map(s => stripParens(normalizeRussian(s.trim().toLowerCase())))

    .filter(s => s);

}

// ====== НОВЫЙ МЕХАНИЗМ ФИДБЕКА ======

function showFeedback({

  word,

  isCorrect,

  confidence,

  onCorrect,

  onIncorrect,

  isSpeechExercise = false,

}) {

  const sheet = document.getElementById('fb-sheet');

  const inner = document.getElementById('fb-sheet-inner');

  const backdrop = document.getElementById('fb-backdrop');

  if (!sheet || !inner) return;

  sheet.className = 'fb-sheet';

  void sheet.offsetWidth;

  const isIdiom = !!word?.idiom;

  let wordEn = isIdiom

    ? word.idiom

    : (word?.en ?? '');

  // Если word.en - массив (глаголы), объединяем с разделителем
  if (Array.isArray(wordEn)) {
    wordEn = wordEn.join('\n');
  } else if (typeof wordEn === 'string') {
    wordEn = wordEn.replace(/,/g, '\n');
  }

  const wordRu = isIdiom

    ? word.meaning

    : parseAnswerVariants(word?.ru ?? '').join(', ');

  const example = word?.ex || word?.example || '';

  if (isCorrect) {

    sheet.classList.add('correct');

    inner.innerHTML = `

      <div class="fb-icon">

        <svg class="fb-svg" viewBox="0 0 36 36" fill="none">

          <circle cx="18" cy="18" r="16" stroke="rgba(34,197,94,0.2)" stroke-width="2"/>

          <path class="fb-check" d="M10 18.5 L15.5 24 L26 13"/>

        </svg>

      </div>

      <div class="fb-text">

        <div class="fb-verdict">Правильно!</div>

        <div class="fb-word-main">${esc(wordEn)}</div>

        <div class="fb-trans-main">${esc(wordRu)}</div>

      </div>

      <button class="btn-pill btn-pill--secondary fb-next-btn">

        <span class="material-symbols-outlined">arrow_forward</span>

        Дальше

      </button>

    `;

  } else {

    sheet.classList.add('incorrect');

    inner.innerHTML = `

      <div class="fb-icon">

        <svg class="fb-svg" viewBox="0 0 36 36" fill="none">

          <circle cx="18" cy="18" r="16" stroke="rgba(239,68,68,0.2)" stroke-width="2"/>

          <line class="fb-x-1" x1="12" y1="12" x2="24" y2="24"/>

          <line class="fb-x-2" x1="24" y1="12" x2="12" y2="24"/>

        </svg>

      </div>

      <div class="fb-text">

        <div class="fb-verdict">Неверно</div>

        <div class="fb-correct-hint">Правильный ответ:<br><strong>${esc(wordEn)}</strong></div>

        <div class="fb-trans-main">${esc(wordRu)}</div>

        ${confidence !== null ? `<div class="fb-confidence">Уверенность: ${Math.round(confidence)}%</div>` : ''}

      </div>

      <button class="btn-pill btn-pill--secondary fb-next-btn">

        <span class="material-symbols-outlined">${isSpeechExercise ? 'refresh' : 'arrow_forward'}</span>

        ${isSpeechExercise ? 'Повторить' : 'Далее'}

      </button>

    `;

  }

  sheet.classList.add('show');

  backdrop.classList.add('show');

  const nextBtn = inner.querySelector('.fb-next-btn');

  if (nextBtn) {

    nextBtn.onclick = () => {

      if (isCorrect) {

        if (onCorrect) {

          onCorrect();

        } else {

          window.proceedToNext();

        }

      } else {

        // Если передан onIncorrect — вызываем его

        if (onIncorrect) {

          onIncorrect();

        }

        // Иначе, если это голосовое упражнение — просто закрываем лист

        else if (isSpeechExercise) {

          hideFeedbackSheet();

        }

        // В остальных случаях переходим к следующему вопросу

        else {

          window.proceedToNext();

        }

      }

    };

  }

}

function hideFeedbackSheet() {

  const sheet = document.getElementById('fb-sheet');

  const backdrop = document.getElementById('fb-backdrop');

  sheet?.classList.remove('show');

  backdrop?.classList.remove('show');

}


window.proceedToNext = function () {

  hideFeedbackSheet();

  sIdx++;

  nextExercise();

};

function getFeedbackHTML(

  word,

  isCorrect,

  confidence = null,

  onCorrect = null,

  onIncorrect = null,

  isSpeechExercise = false,

) {

  showFeedback({

    word,

    isCorrect,

    confidence,

    onCorrect,

    onIncorrect,

    isSpeechExercise,

  });

  return '';

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

// SPEECH RECOGNITION SUPPORT

// ============================================================

// Проверка схожести произнесенного слова с правильным

function checkSpeechSimilarity(spoken, correct) {

  if (!spoken || !correct) return { isCorrect: false, confidence: 0 };

  // Убираем пунктуацию ПЕРЕД всеми сравнениями

  const stripPunct = s =>

    s

      .replace(/[.,!?;:'"()\-]/g, '')

      .replace(/\s+/g, ' ')

      .trim();

  spoken = stripPunct(spoken.toLowerCase());

  correct = stripPunct(correct.toLowerCase());

  if (spoken === correct) return { isCorrect: true, confidence: 100 };

  // ── ОМОФОН ──────────────────────────────────────────────────

  if (window.isHomophone && window.isHomophone(spoken, correct)) {

    return { isCorrect: true, confidence: 90 };

  }

  const cleanSpoken = spoken

    .replace(/\b(a|an|the|in|on|at|to|for|of|with)\b/gi, '')

    .trim();

  const cleanCorrect = correct

    .replace(/\b(a|an|the|in|on|at|to|for|of|with)\b/gi, '')

    .trim();

  if (cleanSpoken === cleanCorrect) return { isCorrect: true, confidence: 95 };

  if (cleanSpoken.includes(cleanCorrect) || cleanCorrect.includes(cleanSpoken))

    return { isCorrect: true, confidence: 85 };

  const distance = levenshteinDistance(cleanSpoken, cleanCorrect);

  const maxLength = Math.max(cleanSpoken.length, cleanCorrect.length);

  const similarity = 1 - distance / maxLength;

  const confidencePercentage = Math.round(similarity * 100);

  // ── ФОНЕТИЧЕСКИ ПОХОЖИЕ ЗАМЕНЫ ────────────────────────────────
  // ASR чаще всего путает: 1) гласные (a/e/i/o/u), 2) парные по звонкости
  // согласные: t/d, p/b, k/g, s/z, f/v. Это шум распознавания, не ошибка
  // произношения. Случайную замену на несвязанный звук (напр. "cat"→"bat")
  // мы НЕ прощаем — это, скорее всего, другое слово.

  const CONFUSABLE_PAIRS = [
    ['t', 'd'], ['p', 'b'], ['k', 'g'], ['s', 'z'], ['f', 'v'],
    ['m', 'n'], ['l', 'r'], ['ch', 'sh'], ['th', 's'], ['th', 'f'],
  ];

  const isVowel = ch => 'aeiou'.includes(ch);

  const isConfusablePair = (a, b) => {
    if (isVowel(a) && isVowel(b)) return true;
    return CONFUSABLE_PAIRS.some(
      ([x, y]) => (x === a && y === b) || (x === b && y === a),
    );
  };

  const findSingleCharDiff = (a, b) => {
    if (a.length !== b.length) return null;
    let diffIndex = -1;
    let diffCount = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        diffCount++;
        diffIndex = i;
        if (diffCount > 1) return null;
      }
    }
    return diffCount === 1 ? diffIndex : null;
  };

  if (distance === 1 && cleanCorrect.length <= 8) {

    const diffIdx = findSingleCharDiff(cleanSpoken, cleanCorrect);

    if (diffIdx !== null) {

      const confusable = isConfusablePair(cleanSpoken[diffIdx], cleanCorrect[diffIdx]);

      if (confusable) {
        return { isCorrect: true, confidence: Math.max(confidencePercentage, 78) };
      }

      // Замена на непохожий звук на коротком слове — явно отклоняем
      if (cleanCorrect.length <= 5) {
        return { isCorrect: false, confidence: confidencePercentage };
      }

    } else if (cleanCorrect.length <= 5) {

      // Вставка/удаление одной буквы на коротком слове (напр. "hlp" → "help")
      return { isCorrect: true, confidence: Math.max(confidencePercentage, 76) };

    }

  }

  // ── СОГЛАСНЫЙ СКЕЛЕТ ──────────────────────────────────────────
  // Если убрать все гласные и оставшиеся согласные совпали — почти
  // наверняка то же слово, просто гласная услышана неверно.

  const consonantSkeleton = s => s.replace(/[aeiou]/g, '');

  if (
    cleanCorrect.length <= 8 &&
    consonantSkeleton(cleanSpoken) === consonantSkeleton(cleanCorrect) &&
    consonantSkeleton(cleanCorrect).length >= 1
  ) {
    return { isCorrect: true, confidence: Math.max(confidencePercentage, 82) };
  }

  // Адаптивный порог: короткие слова сложнее оценивать

  const threshold =

    cleanCorrect.length <= 4

      ? 0.65

      : cleanCorrect.length <= 7

        ? 0.75

        : cleanCorrect.length <= 20

          ? 0.8

          : 0.72;

  return {

    isCorrect: similarity >= threshold,

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

/**

 * Склонение существительного после числительного

 * pluralize(1, 'слово', 'слова', 'слов') → '1 слово'

 * pluralize(3, 'слово', 'слова', 'слов') → '3 слова'

 * pluralize(11, 'слово', 'слова', 'слов') → '11 слов'

 */

function pluralize(n, form1, form2, form5) {

  const abs = Math.abs(n) % 100;

  const rem = abs % 10;

  if (abs >= 11 && abs <= 19) return `${n} ${form5}`;

  if (rem === 1) return `${n} ${form1}`;

  if (rem >= 2 && rem <= 4) return `${n} ${form2}`;

  return `${n} ${form5}`;

}

// Убирает всё в скобках: 'закалять (металл)' → 'закалять'

function stripParens(str) {

  if (!str) return str;

  return str.replace(/\s*\(.*?\)\s*/g, ' ').trim();

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

  } else {

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

  // 🔥 ФИКС 1: Мутируем объект вместо создания нового

  // Теперь window.xpData и xpData - один и тот же объект!

  Object.assign(xpData, newXpData);

  renderXP();

};

window.updateStreak = function (newStreak) {

  // 🔥 ФИКС 1: Мутируем объект вместо создания нового

  Object.assign(streak, newStreak);

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

      window.getLocalDate(),

  };

  window.dailyProgress = merged;

  // Debug: Log merged daily progress

  renderStats();

};

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

      'все ежедневные цели выполнены', // 🔥 ФИКС: Убрал HTML из сообщения

      'celebration', // 🔥 ФИКС: Передаю иконку отдельно

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

    window.dailyGoalsCompleted = (window.dailyGoalsCompleted || 0) + 1;

    markProfileDirty('daily_goals_completed', window.dailyGoalsCompleted);

  }

}

// Загрузка банка слов для автодополнения (теперь через кэш)

window.wordBank = [];

// Инициализация при старте

window.WordAPI.loadWordBank().then(async () => {
  // После загрузки банка получаем кэшированные данные
  if (window.WordAPI && window.WordAPI.getCachedWordBank) {
    window.wordBank = await window.WordAPI.getCachedWordBank();
    console.log('[SCRIPT] WordBank loaded into window.wordBank:', window.wordBank.length);
  } else {
    // Fallback через API если getCachedWordBank не экспортирован
    const debugInfo = await window.WordAPI.debugWordBank();
    if (debugInfo) {
      console.log('[SCRIPT] WordBank available via debugWordBank:', debugInfo.total);
    }
  }
});

async function load() {

  try {

    // Удалено: загрузка из localStorage - теперь используем IndexedDB

    debugLog('Words will be loaded from IndexedDB in onProfileFullyLoaded');

    // Восстанавливаем статистику из страховки если нужно

    // ЗАКОММЕНТИРОВАНО - теперь используем upsert в Supabase

    /*

    try {

      const key = `englift_lastknown_progress_${window.currentUserId}`;
      const backup = localStorage.getItem(key);

      if (backup) {

        const backupData = JSON.parse(backup);

        // Восстанавливать ТОЛЬКО если backup сегодняшний

        const today = window.getLocalDate();

        if (backupData.dailyprogress?.lastReset === today) {

          const localIsToday = window.dailyProgress?.lastReset === today;

          if (!localIsToday) {

            window.updateDailyProgress?.(backupData.dailyprogress);

          } else {

            // merge — берём максимум

            window.updateDailyProgress?.({

              add_new: Math.max(

                window.dailyProgress.add_new || 0,

                backupData.dailyprogress.add_new || 0,

              ),

              review: Math.max(

                window.dailyProgress.review || 0,

                backupData.dailyprogress.review || 0,

              ),

              practice_time: Math.max(

                window.dailyProgress.practice_time || 0,

                backupData.dailyprogress.practice_time || 0,

              ),

              completed:

                window.dailyProgress.completed ||

                backupData.dailyprogress.completed,

              lastReset: today,

            });

          }

        } else {

          // Backup не сегодняшний, пропускаем восстановление dailyprogress

        }

        if (window.xpData?.xp < backupData.xp) {

          window.updateXpData?.({

            xp: backupData.xp,

            level: backupData.level,

            badges: backupData.badges || [], // 🔥 ФИКС 3: Восстанавливаем badges из бэкапа!

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

      toast(`Обновлено переводов для ${updated} примеров`, 'success');

    }

    // Помечаем что миграция выполнена

    localStorage.setItem(migrationKey, 'true');

  } catch (error) {

    console.error('❌ Migration error:', error);

  }

}

// Загрузка слов из dictionary.json при первом запуске - УДАЛЕНО ДЛЯ БЕЗОПАСНОСТИ

// async function loadDictionaryFromJson() { ... }

// Делаем speak глобальным для доступа из HTML - УДАЛЕНО, теперь используем window.speakWord

// Функции saveXP и saveStreak удалены - заменены на markProfileDirty

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

// Функция очистки пользовательских данных из IndexedDB

async function clearLocalWordCache() {

  try {

    await window.UserDataCache.clearAllWords();

    await window.UserDataCache.clearAllIdioms();

  } catch (error) {

    console.error('❌ Ошибка очистки IndexedDB:', error);

  }

}

// Обновление существующих слов данными из WordBankDB

async function updateWordsFromBank() {

  if (!window.WordBankDB || !window.words) return;

  for (const word of window.words) {

    if (!word.grammar && word.en) {

      try {

        const results = await window.WordBankDB.searchWords(word.en, 1);

        const bankWord = results.find(

          r => r.en.toLowerCase() === word.en.toLowerCase(),

        );

        if (bankWord && bankWord.grammar) {

          word.grammar = bankWord.grammar;

          markWordDirtyForCache(word.id);

        }

      } catch (e) {

        console.warn('Ошибка обновления слова из WordBankDB:', e);

      }

    }

  }

}

async function enrichWordsWithBankData() {

  if (!window.WordBankDB) return;

  let updated = 0;

  for (const word of window.words) {

    let changed = false;

    if ((!word.examplesAudio || !word.examplesAudio.length) && word.en) {

      try {

        const results = await window.WordBankDB.searchWords(word.en, 1);

        const bankWord = results.find(

          r => r.en.toLowerCase() === word.en.toLowerCase(),

        );

        if (

          bankWord &&

          bankWord.examplesAudio &&

          bankWord.examplesAudio.length

        ) {

          word.examplesAudio = bankWord.examplesAudio;

          changed = true;

        }

        if (!word.cefr && bankWord?.cefr) {

          word.cefr = bankWord.cefr;

          changed = true;

        }

      } catch (e) {}

    }

    if (changed) {

      markWordDirty(word.id);

      updated++;

    }

  }

  if (updated) {

    refreshUI();

  }

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

  grammar = null,

  cefr = null,

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

    grammar: grammar, // грамматика с коллокациями

    cefr: cefr, // уровень CEFR

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

  // Валидация входных данных

  if (!en || !ru) {

    toast('Введите слово и перевод', 'error');

    return false;

  }

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

  // Загружаем грамматику и CEFR из WordBankDB сразу при добавлении слова

  let grammar = null;

  let cefr = null;

  if (window.WordBankDB) {

    try {

      const results = await window.WordBankDB.searchWords(normalizedEn, 1);

      const bankWord = results.find(

        r => r.en.toLowerCase() === normalizedEn.toLowerCase(),

      );

      if (bankWord) {

        if (bankWord.grammar) {

          grammar = bankWord.grammar;

        }

        if (bankWord.cefr) {

          cefr = bankWord.cefr;

        }

      }

    } catch (e) {

      console.warn('Ошибка загрузки данных из WordBankDB:', e);

    }

  }

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

      grammar, // грамматика с коллокациями

      cefr, // уровень CEFR из банка

    );

    window.words.push(newWord);

    markWordDirtyForCache(newWord.id);

    // Удалено: сохраняем в IndexedDB через кеш

    // --- МГНОВЕННОЕ СОХРАНЕНИЕ НА СЕРВЕР (если есть интернет) ---

    if (navigator.onLine && window.currentUserId) {

      try {

        await saveWordToDb(newWord);

      } catch (e) {

        console.warn(

          `⚠️ Ошибка мгновенного сохранения "${normalizedEn}", добавляем в очередь`,

          e,

        );

        markWordDirty(newWord.id); // в очередь как запасной вариант

      }

    } else {

      markWordDirty(newWord.id);

    }

    // Очищаем кеш рендеринга

    renderCache.clear();

    // Обновляем прогресс ежедневных целей

    resetDailyGoalsIfNeeded();

    // 🔥 ФИКС: НЕ увеличиваем серию за добавление слова!

    // Серия только за упражнения, а не за добавление в словарь

    window.dailyProgress.add_new = (window.dailyProgress.add_new || 0) + 1;

    markProfileDirty('dailyprogress', window.dailyProgress);

    checkDailyGoalsCompletion();

    gainXP(1, 'новое слово');

    // Обновляем прогресс челленджей (ЗАКОММЕНТИРОВАНО)
    /*
    if (window.currentUserId && window.updateAllChallengesProgress) {
      window.updateAllChallengesProgress(window.currentUserId, 'words', 1);
    }
    */

    visibleLimit = 30; // сброс при добавлении слова

    // Обновляем счетчики слов в профиле

    markProfileDirty('total_words', window.words.length);

    markProfileDirty(

      'learned_words',

      window.words.filter(w => w.stats?.learned).length,

    );

    // Пересчитываем уровни CEFR и обновляем интерфейс

    recalculateCefrLevels();

    // УБРАНО: Sync phrases from word examples - фразы создаются только из коллокаций через buildPhrasesFromWords

    // Update UI to show daily goals progress immediately

    refreshUI();

    return true;

  } catch (error) {

    console.error('Error adding word:', error);

    toast(

      'Ошибка добавления слова: ' +

        (error.message || error.toString() || 'неизвестная'),

      'danger',

      'add_word',

    );

    return false;

  }

}

async function delWord(wordId) {

  markWordDeletedForCache(wordId);

  const word = window.words.find(w => w.id === wordId);

  if (!word) return;

  // Добавляем в очередь с флагом удаления

  pendingWordUpdates.set(wordId, { ...word, _deleted: true });

  scheduleWordSync(); // запускаем синхронизацию

  // Удаляем из локального массива

  window.words = window.words.filter(w => w.id !== wordId);

  // Обновляем интерфейс

  renderCache.clear();

  visibleLimit = 30;

  recalculateCefrLevels();

  refreshUI();

  updateDueBadge();

  markProfileDirty('total_words', window.words.length);

  markProfileDirty(

    'learned_words',

    window.words.filter(w => w.stats?.learned).length,

  );

  // Если есть интернет, пробуем сразу удалить (опционально)

  if (navigator.onLine && window.currentUserId) {

    try {

      await deleteWordFromDb(wordId);

      // Если успешно, убираем из очереди

      pendingWordUpdates.delete(wordId);

    } catch (e) {

      console.error('❌ Ошибка удаления с сервера, осталось в очереди', e);

      // Остаётся в очереди, повторится позже

    }

  }

}

async function updWord(id, data) {

  const w = window.words.find(w => w.id === id);

  if (!w) return;

  const oldExamples = w.examples || [];

  Object.assign(w, data, { updatedAt: new Date().toISOString() });

  markWordDirtyForCache(id);

  renderCache.clear();

  window.hasLocalChanges = true;

  recalculateCefrLevels();

  refreshUI();

  if (navigator.onLine && window.currentUserId) {

    try {

      await saveWordToDb(toSnakeCase(w));

    } catch (e) {

      console.warn('??? updWord Supabase error:', e?.message || e);

      markWordDirty(id);

    }

  } else {

    markWordDirty(id);

  }

  // УБРАНО: Sync phrases from word examples - фразы создаются только из коллокаций через buildPhrasesFromWords

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

    exampleTranslation:

      exampleTranslation && typeof exampleTranslation === 'string'

        ? exampleTranslation.trim()

        : '', // Сохраняем перевод примера (camelCase для правильной конвертации)

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

  markIdiomDirtyForCache(newIdiom.id);

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

  gainXP(1, 'новая идиома');

  // Обновляем прогресс челленджей (ЗАКОММЕНТИРОВАНО)
  /*
  if (window.currentUserId && window.updateAllChallengesProgress) {
    window.updateAllChallengesProgress(window.currentUserId, 'words', 1);
  }
  */

  markProfileDirty('total_idioms', window.idioms.length);

  markProfileDirty(

    'learned_idioms',

    window.idioms.filter(i => i.stats?.learned).length,

  );

  return true;

}

async function delIdiom(idiomId) {

  markIdiomDeletedForCache(idiomId);

  const idiom = window.idioms.find(i => i.id === idiomId);

  if (!idiom) return;

  pendingIdiomUpdates.set(idiomId, { ...idiom, _deleted: true });

  scheduleIdiomSync();

  window.idioms = window.idioms.filter(i => i.id !== idiomId);

  updateIdiomsCount(); // обновляем счётчик

  // Обновляем счетчики в профиле

  markProfileDirty('total_idioms', window.idioms.length);

  markProfileDirty(

    'learned_idioms',

    window.idioms.filter(i => i.stats?.learned).length,

  );

  renderIdioms();

}

async function updIdiom(idiomId, data) {

  const i = window.idioms.find(i => i.id === idiomId);

  if (i) {

    Object.assign(i, data, { updatedAt: new Date().toISOString() });

    markIdiomDirtyForCache(idiomId);

    renderIdioms();

  }

}

/**

 * Универсальная SRS-логика для слов и идиом.

 * Заменяет updStats, updIdiomStats.

 */

function calcSrs(stats, correct, exerciseType) {

  const today = window.getLocalDate(); // YYYY-MM-DD

  // Инициализация полей

  stats.shown = (stats.shown || 0) + 1;

  stats.lastPracticed = new Date().toISOString();

  if (!stats.correctExerciseTypes) stats.correctExerciseTypes = [];

  if (!stats.wrong) stats.wrong = 0;

  if (!stats.correct) stats.correct = 0;

  // isDue: nextReview не установлен ИЛИ начало дня nextReview <= сегодня

  // Сравниваем только даты (без времени), чтобы не было эффекта "2 дня и 20 часов"

  const nextReviewDate = stats.nextReview

    ? stats.nextReview.split('T')[0]

    : null;

  const isDue = !nextReviewDate || nextReviewDate <= today;

  if (correct) {

    // Увеличиваем счётчик правильных ответов

    stats.correct++;

    // Тип упражнения добавляем всегда

    if (!stats.correctExerciseTypes.includes(exerciseType)) {

      stats.correctExerciseTypes.push(exerciseType);

    }

    // Прогресс (streak + interval) — только если due И только раз в день

    if (isDue && stats.lastProgressDate !== today) {

      stats.streak = (stats.streak || 0) + 1;

      stats.lastProgressDate = today;

      // Шкала: streak=1→3д, 2→7д, 3→14д, 4→30д, 5→60д, 6→90д, 7+→180д

      const intervals = [1, 3, 7, 14, 30, 60, 90, 180];

      const idx = Math.min(stats.streak, intervals.length - 1);

      stats.interval = intervals[idx];

    }

    // Если не due или уже прокачали сегодня — ничего не меняем

  } else {

    // Неправильный ответ — всегда сбрасываем, даже если не due

    stats.wrong++;

    stats.streak = 0;

    stats.interval = 1;

    stats.lastProgressDate = today; // блокируем улучшение до завтра

    // Защита legacy

    if (stats.wrong >= 3 && stats.correctExerciseTypes.length > 0) {

      const last =

        stats.correctExerciseTypes[stats.correctExerciseTypes.length - 1];

      if (last !== 'legacy') stats.correctExerciseTypes.pop();

    }

  }

  // nextReview считаем от НАЧАЛА СЕГОДНЯШНЕГО ДНЯ + interval дней

  // Это убирает эффект "2 дня 20 часов" вместо "3 дня"

  const next = new Date();

  next.setHours(0, 0, 0, 0);

  next.setDate(next.getDate() + stats.interval);

  stats.nextReview = next.toISOString();

  stats.learned =

    stats.correctExerciseTypes.includes('legacy') ||

    stats.correctExerciseTypes.length >= 3;

  return stats;

}

function updStats(wordId, correct, exerciseType) {

  const w = window.words.find(w => w.id === wordId);

  if (!w) return;

  const wasLearned = w.stats.learned;

  calcSrs(w.stats, correct, exerciseType);

  // Обновляем updatedAt при практике
  w.updatedAt = new Date().toISOString();

  if (!wasLearned && w.stats.learned) {

    const isMobile = window.innerWidth < 1000;
    gainXP(10, 'слово выучено', 'star', isMobile ? 'top' : 'bottom');

    autoCheckBadges();

  }

  markWordDirty(wordId);

  markWordDirtyForCache(wordId);

}

// Функция для проверки и обновления бейджей

function xpNeeded(lvl) {

  return lvl * XP_PER_LEVEL;

}

function gainXP(amount, reason = '', icon = 'bolt', position = 'bottom') {

  xpData.xp += amount;

  while (xpData.xp >= xpNeeded(xpData.level)) {

    xpData.xp -= xpNeeded(xpData.level);

    xpData.level++;

    showLevelUpBanner(xpData.level);

  }

  renderXP();

  toast('+' + amount + ' XP' + (reason ? ' · ' + reason : ''), 'xp', icon, 4000, position);

  // Обновляем прогресс челленджей (ЗАКОММЕНТИРОВАНО)
  /*
  if (window.currentUserId && window.updateAllChallengesProgress) {
    window.updateAllChallengesProgress(window.currentUserId, 'xp', amount);
  }
  */

  markProfileDirty('xp', xpData.xp);

  markProfileDirty('level', xpData.level);

  // Записываем активность и XP для серии
  if (amount > 0) {
    if (!window.dailyXp) window.dailyXp = 0;
    window.dailyXp += amount;
    markProfileDirty('dailyxp', window.dailyXp);
    updStreak(); // updStreak сам запишет активность когда время будет достигнуто
  }

  // Бейджи сохраняются в checkBadges() - дублирование не нужно

  // Проверяем бейджи

  checkBadges();

  renderBadges();

  // Записываем в лог XP (без reason)

  if (window.currentUserId) {

    if (navigator.onLine) {

      // Если онлайн - сразу сохраняем в Supabase

      supabase

        .from('xp_log')

        .insert({

          user_id: window.currentUserId,

          amount: amount,

          created_at: new Date().toISOString(),

        })

        .then(({ error }) => {

          if (error) console.warn('Failed to log XP:', error);

        });

    } else {

      // Если офлайн - добавляем в очередь

      pendingXpLogs.push({

        user_id: window.currentUserId,

        amount: amount,

        created_at: new Date().toISOString(),

      });

    }

  }

}

// Синхронизация XP логов при восстановлении сети

async function flushXpQueue() {

  if (pendingXpLogs.length === 0 || !navigator.onLine) return;

  const logsToSync = [...pendingXpLogs];

  pendingXpLogs = [];

  for (const log of logsToSync) {

    try {

      await supabase.from('xp_log').insert(log);

    } catch (e) {

      console.warn('Failed to sync XP log, re-queueing:', e);

      pendingXpLogs.unshift(log);

      break;

    }

  }

}

// Сброс ожидающих обновлений челленджей в конце сессии
// Больше не нужен - обновление происходит сразу при завершении каждого упражнения

async function flushChallengeUpdates() {
  // Ничего не делаем - челленджи обновляются в finishExercise()
}

function checkBadges(perfectSession = false) {

  // Гард: не проверяем бейджи до полной загрузки профиля
  if (!window.currentUserId || !window.profileFullyLoaded) {
    return;
  }

  const newBadges = [];

  const totalWords = window.words ? window.words.length : 0;

  const totalIdioms = window.idioms ? window.idioms.length : 0;

  const learnedWords = window.words

    ? window.words.filter(w => w.stats?.learned).length

    : 0;

  const learnedIdioms = window.idioms

    ? window.idioms.filter(i => i.stats?.learned).length

    : 0;

  const badgeData = {

    totalWords,

    totalIdioms,

    learnedWords,

    learnedIdioms,

    xp: xpData.xp,

    level: xpData.level,

    streak: streak.count,

    friendsCount: friendsData.friends.length,

    invitedCount: window.currentUserProfile?.invited_count || 0,

    learningStreak: window.learningStreak || 0,

    bestAccuracy: window.bestAccuracy || 0,

    dailyGoalsCompleted: window.dailyGoalsCompleted || 0,

    perfectSessions: window.perfectSessions || 0,

    exercisesTried: window.exercisesTried || 0,

    bestSpeed: window.bestSpeed === Infinity ? 0 : window.bestSpeed,

    totalSessions: window.totalSessions || 0,

  };

  BADGES_DEF.forEach(def => {

    if (xpData.badges.includes(def.id)) return;

    const earned = def.condition(badgeData);

    if (earned) {

      xpData.badges.push(def.id);

      newBadges.push(def);

    }

  });

  if (newBadges.length) {

    // Показываем тосты немедленно

    newBadges.forEach((b, i) => {

      setTimeout(() => {

        toast(

          `Бейдж: «${b.name}»!`,

          'success',

          b.icon, // 🔥 ФИКС: Передаем иконку отдельно, не в HTML!

        );

      }, i * 800);

    });

    // Сохраняем бейджи через новую систему

    markProfileDirty('badges', xpData.badges);

  }

  renderBadges();

}

// Автоматическая проверка бейджей при изменении данных

function autoCheckBadges() {

  const previousBadges = [...xpData.badges];

  checkBadges(false);

  // Если появились новые бейджи, показываем уведомление

  const newBadges = xpData.badges.filter(id => !previousBadges.includes(id));

  if (newBadges.length > 0) {

    const newBadgeDefs = BADGES_DEF.filter(def => newBadges.includes(def.id));

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

  el.innerHTML = `<span class="material-symbols-outlined" style="vertical-align: middle; margin-right: 8px;">celebration</span>Уровень ${esc(lvl.toString())}!<br><span style="font-size:.85rem;font-weight:600;opacity:.9">Так держать!</span>`;

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

  if (xpData.badges.includes(def.id)) return null;

  // Актуальные значения из глобальных переменных

  const valMap = {

    words: window.words ? window.words.length : 0,

    idioms: window.idioms ? window.idioms.length : 0,

    learned: window.words ? window.words.filter(w => w.stats?.learned).length : 0,

    learnedIdioms: window.idioms ? window.idioms.filter(i => i.stats?.learned).length : 0,

    streak: streak.count,

    level: xpData.level,

    dailyGoalsCompleted: window.dailyGoalsCompleted || 0,

    perfectSessions: window.perfectSessions || 0,

    exercisesTried: window.exercisesTried || 0,

    bestSpeed: window.bestSpeed === Infinity ? 0 : window.bestSpeed,

    learningStreak: window.learningStreak || 0,

    bestAccuracy: window.bestAccuracy || 0,

    friends: friendsData.friends ? friendsData.friends.length : 0,

    invited: window.currentUserProfile?.invited_count || 0,

    sessions: window.totalSessions || 0, // нужно обновлять при завершении сессии

  };

  const targets = {

    'first_word': { type: 'words', target: 1 },

    'word_collector_10': { type: 'words', target: 10 },

    'word_collector_50': { type: 'words', target: 50 },

    'word_collector_100': { type: 'words', target: 100 },

    'word_collector_500': { type: 'words', target: 500 },

    'first_idiom': { type: 'idioms', target: 1 },

    'idiom_collector_25': { type: 'idioms', target: 25 },

    'idiom_collector_100': { type: 'idioms', target: 100 },

    'first_learned': { type: 'learned', target: 1 },

    'learning_streak_3': { type: 'learningStreak', target: 3 },

    'learning_streak_10': { type: 'learningStreak', target: 10 },

    'knowledge_master_25': { type: 'learned', target: 25 },

    'knowledge_master_100': { type: 'learned', target: 100 },

    'first_session': { type: 'sessions', target: 1 },

    'practice_regular': { type: 'sessions', target: 5 },

    'practice_dedicated': { type: 'sessions', target: 25 },

    'practice_master': { type: 'sessions', target: 100 },

    'accuracy_perfection': { type: 'bestAccuracy', target: 95 },

    'daily_goal_first': { type: 'dailyGoalsCompleted', target: 1 },

    'daily_goal_regular': { type: 'dailyGoalsCompleted', target: 7 },

    'daily_goal_consistent': { type: 'dailyGoalsCompleted', target: 30 },

    'streak_beginner': { type: 'streak', target: 3 },

    'streak_regular': { type: 'streak', target: 7 },

    'streak_dedicated': { type: 'streak', target: 30 },

    'streak_master': { type: 'streak', target: 100 },

    'streak_legendary': { type: 'streak', target: 365 },

    'variety_explorer': { type: 'exercisesTried', target: 8 },

    'speed_demon': { type: 'bestSpeed', target: 3, reverse: true, maxVal: 10 },

    'perfectionist': { type: 'perfectSessions', target: 10 },

    'level_5': { type: 'level', target: 5 },

    'level_10': { type: 'level', target: 10 },

    'level_25': { type: 'level', target: 25 },

    'level_50': { type: 'level', target: 50 },

    'friends_3': { type: 'friends', target: 3 },

    'friends_10': { type: 'friends', target: 10 },

    'inviter': { type: 'invited', target: 3 },

  };

  const info = targets[def.id];

  if (!info) return null;

  let val = valMap[info.type] || 0;

  const target = info.target;

  let progress;

  if (info.reverse) {

    const maxVal = info.maxVal || target * 2;

    progress = Math.max(0, Math.min(100, ((maxVal - Math.min(val, maxVal)) / (maxVal - target)) * 100));

  } else {

    progress = Math.min(100, (val / target) * 100);

  }

  return {

    type: info.type,

    current: val,

    target: target,

    remaining: Math.max(0, target - val),

    progress: Math.round(progress),

  };

}

function renderBadges() {

  const grid = document.getElementById('badges-grid');

  if (!grid) return;

  // Защита: если данные ещё не загружены

  if (!window.xpData || !window.xpData.badges || !window.words) {

    grid.innerHTML = '<div class="loading-spinner"></div>';

    return;

  }

  const badges = xpData.badges || [];

  grid.innerHTML = BADGES_DEF.map(def => {

    const ok = badges.includes(def.id);

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

    case 'words': return pluralize(progress.remaining, 'слово', 'слова', 'слов');

    case 'learned': return `${pluralize(progress.remaining, 'слово', 'слова', 'слов')} выучить`;

    case 'streak': return pluralize(progress.remaining, 'день', 'дня', 'дней');

    case 'xp': return `${progress.remaining} XP`;

    case 'idioms': return `ещё ${pluralize(progress.remaining, 'идиома', 'идиомы', 'идиом')}`;

    case 'idiomlearned': return `ещё ${pluralize(progress.remaining, 'идиома', 'идиомы', 'идиом')} выучить`;

    case 'learningStreak': return pluralize(progress.remaining, 'слово/идиома', 'слова/идиомы', 'слов/идиом') + ' подряд';

    case 'perfectSessions': return pluralize(progress.remaining, 'сессия', 'сессии', 'сессий') + ' с точностью 100%';

    case 'exercisesTried': return pluralize(progress.remaining, 'тип упражнения', 'типа упражнений', 'типов упражнений');

    case 'bestSpeed': return `${progress.current}с (нужно <3с)`;

    case 'bestAccuracy': return `${progress.remaining}% до 95%`;

    case 'friends': return pluralize(progress.remaining, 'друг', 'друга', 'друзей');

    case 'invited': return pluralize(progress.remaining, 'приглашение', 'приглашения', 'приглашений');

    case 'level': return `${progress.remaining} уровней до ${progress.target}`;

    case 'sessions': return pluralize(progress.remaining, 'сессия', 'сессии', 'сессий');

    case 'dailyGoalsCompleted': return pluralize(progress.remaining, 'день', 'дня', 'дней');

    default: return '';

  }

}

// Вехи серии (число дней → название)
const MILESTONES = [
  { days: 1, label: 'Старт' },
  { days: 2, label: 'Разгон' },
  { days: 3, label: 'Первые шаги' },
  { days: 5, label: 'Почти неделя' },
  { days: 7, label: 'Первая неделя' },
  { days: 10, label: 'Двузначная серия' },
  { days: 14, label: 'Две недели' },
  { days: 21, label: 'Порог привычки' },
  { days: 30, label: 'Месяц в деле' },
  { days: 50, label: 'Полсотни' },
  { days: 75, label: 'Сильный темп' },
  { days: 100, label: 'Сотня' },
  { days: 150, label: 'Длинная дистанция' },
  { days: 200, label: 'Двести подряд' },
  { days: 250, label: 'Серьёзная серия' },
  { days: 300, label: 'Триста подряд' },
  { days: 365, label: 'Год без срывов' },
  { days: 500, label: 'Легендарный ритм' }
];

// Критерии для засчитывания дня
const STREAK_CRITERIA = {
  minPracticeTime: 300 // минимум 5 минут практики за день
};

// === История активности (для таймлайна) ===
function getStreakHistory() {
  try {
    const key = `englift_streak_history_${window.currentUserId}`;
    return JSON.parse(localStorage.getItem(key)) || {};
  } catch { return {}; }
}

function saveStreakHistory(history) {
  const key = `englift_streak_history_${window.currentUserId}`;
  localStorage.setItem(key, JSON.stringify(history));
}

function recordDailyActivity() {
  const today = window.getLocalDate();
  const history = getStreakHistory();
  if (!history[today]) {
    history[today] = true;
    saveStreakHistory(history);
  }
}

// Восстанавливает стрик на основе истории активности
function restoreStreakFromHistory() {
  const history = getStreakHistory();
  const today = window.getLocalDate();
  const dates = Object.keys(history).sort().reverse(); // от новых к старым
  
  let streakCount = 0;
  let lastActiveDate = null;
  let currentDate = new Date(today);
  let freePassAvailable = canUseFreePass();
  
  // Проходим по дням от сегодня назад
  for (let i = 0; i < 365; i++) { // проверяем максимум год назад
    const dateStr = window.getLocalDate(currentDate);
    
    if (history[dateStr]) {
      // День был активен
      streakCount++;
      lastActiveDate = dateStr;
      currentDate.setDate(currentDate.getDate() - 1);
    } else if (freePassAvailable && i > 0) {
      // Пропущенный день, но есть выходной
      freePassAvailable = false;
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      // Пропуск без выходного или сегодня еще не занимался
      if (i === 0 && streakCount > 0) {
        // Сегодня еще не занимались, но стрик сохраняем
        break;
      }
      // Прерываем серию
      break;
    }
  }
  
  if (streakCount > 0) {
    streak.count = streakCount;
    streak.lastDate = lastActiveDate;
    markProfileDirty('streak', streak.count);
    markProfileDirty('laststreakdate', streak.lastDate);
    
    // Обновляем рекорд если нужно
    if (streak.count > (streak.bestStreak || 0)) {
      streak.bestStreak = streak.count;
      markProfileDirty('best_streak', streak.bestStreak);
    }
    
    renderStreak();
    renderStats();
    console.log(`[STREAK] Восстановлен стрик: ${streakCount} дней, последний день: ${lastActiveDate}`);
    return { count: streakCount, lastDate: lastActiveDate };
  }
  
  console.log('[STREAK] Нет данных для восстановления стрика');
  return null;
}

// Делаем функцию доступной глобально для вызова из консоли
window.restoreStreakFromHistory = restoreStreakFromHistory;

// Восстанавливает стрик на основе переданных данных (даты с активностью)
function restoreStreakFromDates(activeDates) {
  const today = window.getLocalDate();
  let streakCount = 0;
  let lastActiveDate = null;
  let currentDate = new Date(today);
  let freePassAvailable = canUseFreePass();
  
  // Проходим по дням от сегодня назад
  for (let i = 0; i < 365; i++) {
    const dateStr = window.getLocalDate(currentDate);
    
    if (activeDates.includes(dateStr)) {
      // День был активен
      streakCount++;
      lastActiveDate = dateStr;
      currentDate.setDate(currentDate.getDate() - 1);
    } else if (freePassAvailable && i > 0) {
      // Пропущенный день, но есть выходной
      freePassAvailable = false;
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      // Пропуск без выходного или сегодня еще не занимался
      if (i === 0 && streakCount > 0) {
        // Сегодня еще не занимались, но стрик сохраняем
        break;
      }
      // Прерываем серию
      break;
    }
  }
  
  if (streakCount > 0) {
    streak.count = streakCount;
    streak.lastDate = lastActiveDate;
    markProfileDirty('streak', streak.count);
    markProfileDirty('laststreakdate', streak.lastDate);
    
    // Обновляем рекорд если нужно
    if (streak.count > (streak.bestStreak || 0)) {
      streak.bestStreak = streak.count;
      markProfileDirty('best_streak', streak.bestStreak);
    }
    
    // Заполняем историю активности
    const history = getStreakHistory();
    activeDates.forEach(date => {
      history[date] = true;
    });
    saveStreakHistory(history);
    
    renderStreak();
    renderStats();
    console.log(`[STREAK] Восстановлен стрик: ${streakCount} дней, последний день: ${lastActiveDate}`);
    return { count: streakCount, lastDate: lastActiveDate };
  }
  
  console.log('[STREAK] Нет данных для восстановления стрика');
  return null;
}

// Делаем функцию доступной глобально
window.restoreStreakFromDates = restoreStreakFromDates;

// Устанавливает стрик на указанное количество дней и дату, отправляет на сервер
function setStreakCount(days, lastDate = null) {
  if (typeof days !== 'number' || days < 0) {
    console.error('[STREAK] Неверное значение дней');
    return null;
  }
  
  streak.count = days;
  
  // Если lastDate не передан и дней > 0, устанавливаем на сегодня
  if (days > 0 && !lastDate) {
    streak.lastDate = window.getLocalDate();
  } else if (days === 0) {
    streak.lastDate = null;
  } else {
    streak.lastDate = lastDate;
  }
  
  // Обновляем рекорд если нужно
  if (streak.count > (streak.bestStreak || 0)) {
    streak.bestStreak = streak.count;
    markProfileDirty('best_streak', streak.bestStreak);
  }
  
  // Отправляем на сервер
  markProfileDirty('streak', streak.count);
  markProfileDirty('laststreakdate', streak.lastDate);
  
  renderStreak();
  renderStats();
  console.log(`[STREAK] Установлен стрик: ${days} дней, lastDate: ${streak.lastDate}`);
  return { count: days, lastDate: streak.lastDate };
}

// Делаем функцию доступной глобально
window.setStreakCount = setStreakCount;

// Сбрасывает состояние выходного для тестирования
function resetFreePass() {
  streak.freePassUsedThisWeek = false;
  streak.freezeNotificationShown = false;
  const weekStart = getWeekStart();
  streak.freePassWeekStart = weekStart;
  markProfileDirty('free_pass_used', false);
  markProfileDirty('freeze_notification_shown', false);
  markProfileDirty('free_pass_week_start', weekStart);
  console.log('[FREE PASS] Выходной сброшен для тестирования');
  renderStreak();
  return { used: false, shown: false, weekStart };
}

// Делаем функцию доступной глобально
window.resetFreePass = resetFreePass;

// === Free pass ===
function getWeekStart() {
  const now = new Date();
  const day = now.getDay(); // 0 воскресенье, 1 понедельник
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // понедельник
  const monday = new Date(now.setDate(diff));
  return window.getLocalDate(monday);
}

function canUseFreePass() {
  const weekStart = getWeekStart();
  if (streak.freePassWeekStart !== weekStart) {
    streak.freePassUsedThisWeek = false;
    streak.freezeNotificationShown = false;
    streak.freePassWeekStart = weekStart;
    markProfileDirty('free_pass_week_start', weekStart);
    markProfileDirty('free_pass_used', false);
    markProfileDirty('freeze_notification_shown', false);
  }
  return !streak.freePassUsedThisWeek;
}

function getDaysUntilNextFreePass() {
  const today = window.getLocalDate(new Date());
  const weekStart = getWeekStart();

  // Если начало недели уже было в будущем (понедельник этой недели), то считаем до следующего понедельника
  const weekStartDate = new Date(weekStart);
  const todayDate = new Date(today);

  // Если сегодня до понедельника текущей недели (теоретически невозможно, но на всякий случай)
  if (todayDate < weekStartDate) {
    const diffTime = weekStartDate - todayDate;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  // Иначе считаем до следующего понедельника
  const nextMonday = new Date(weekStartDate);
  nextMonday.setDate(nextMonday.getDate() + 7);

  const diffTime = nextMonday - todayDate;
  const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return daysUntil;
}

function getDayWordForCount(count) {
  const lastTwo = count % 100;
  const lastOne = count % 10;
  if (lastTwo >= 11 && lastTwo <= 19) return 'дней';
  if (lastOne === 1) return 'день';
  if (lastOne >= 2 && lastOne <= 4) return 'дня';
  return 'дней';
}

function useFreePass() {
  streak.freePassUsedThisWeek = true;
  markProfileDirty('free_pass_used', true);

  // Обновляем lastDate на вчерашний день (пропущенный день)
  // Это нужно чтобы при перезагрузке страницы стрик не сбросился
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  streak.lastDate = window.getLocalDate(yesterdayDate);
  markProfileDirty('laststreakdate', streak.lastDate);

  toast('Выходной использован, серия сохранена!', 'info', 'shield');
}

// Обработчик закрытия модалки уведомления о выходном
document.getElementById('freeze-notification-modal-close').addEventListener('click', () => {
  document.getElementById('freeze-notification-modal').classList.remove('open');
  document.body.classList.remove('modal-open');
});

// === Получение XP и упражнений за сегодня ===
function getXpToday() {
  if (!window.dailyXp) window.dailyXp = 0;
  return window.dailyXp || 0;
}

function getExercisesToday() {
  return window.dailyReviewCount || 0;
}

function getPracticeTimeToday() {
  return window.dailyProgress?.practice_time || 0;
}

function updStreak() {
  if (!window.profileFullyLoaded) return; // не трогаем стрик, пока профиль точно не загружен

  const today = window.getLocalDate();
  console.log('[STREAK DEBUG] updStreak start:', { today, lastDate: streak.lastDate, count: streak.count, profileFullyLoaded: window.profileFullyLoaded });
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = window.getLocalDate(yesterdayDate);

  // Если уже обновлено сегодня – выходим
  if (streak.lastDate === today) {
    console.log('[STREAK DEBUG] Already updated today, skipping');
    renderStreak();
    return;
  }

  // Проверяем, выполнены ли условия для засчитывания дня
  // Используем максимум из текущего practice_time, сохранённого в истории и серверных данных
  const practiceTimeToday = getPracticeTimeToday();
  const streakHistory = getStreakHistory();
  const historyToday = streakHistory[today];

  // Также проверяем, был ли practice_time накоплен до сброса (сохранён в _preservedPracticeTime)
  const preservedTime = window.dailyProgress._preservedPracticeTime || 0;

  // Если в истории есть запись за сегодня но времени практики недостаточно,
  // удаляем эту запись (она могла остаться от старой логики)
  if (historyToday === true && practiceTimeToday < STREAK_CRITERIA.minPracticeTime && preservedTime < STREAK_CRITERIA.minPracticeTime) {
    const history = getStreakHistory();
    delete history[today];
    saveStreakHistory(history);
  }

  // Проверяем условия для засчитывания дня
  const isEligible = practiceTimeToday >= STREAK_CRITERIA.minPracticeTime ||
                     preservedTime >= STREAK_CRITERIA.minPracticeTime;
  console.log('[STREAK DEBUG] Eligibility check:', { practiceTimeToday, preservedTime, minRequired: STREAK_CRITERIA.minPracticeTime, isEligible });

  if (!streak.lastDate) {
    // Первая активность вообще
    if (isEligible) {
      streak.count = 1;
      streak.lastDate = today;
      markProfileDirty('streak', streak.count);
      markProfileDirty('laststreakdate', streak.lastDate);
    }
    renderStreak();
    return;
  }

  const daysSinceLastActive = Math.round(
    (new Date(today) - new Date(streak.lastDate)) / 86400000
  );

  if (isEligible) {
    // Сегодня есть активность
    if (daysSinceLastActive === 1) {
      streak.count++;
    } else if (daysSinceLastActive === 2 && canUseFreePass()) {
      // Ровно 1 пропущенный день – используем выходной
      useFreePass();
      streak.count++;
    } else {
      // Дырка больше 1 дня или выходного нет – новая серия
      streak.count = 1;
    }
    streak.lastDate = today;
    // Сохраняем стрик на сервер
    markProfileDirty('streak', streak.count);
    markProfileDirty('laststreakdate', streak.lastDate);
    // Обновляем рекорд
    if (streak.count > (streak.bestStreak || 0)) {
      streak.bestStreak = streak.count;
      markProfileDirty('best_streak', streak.bestStreak);
    }
    // Сохраняем активность в историю
    recordDailyActivity();
    console.log('[STREAK DEBUG] Streak updated:', { count: streak.count, lastDate: streak.lastDate });
  } else {
    // Сегодня нет активности
    if (daysSinceLastActive >= 2) {
      // Проверяем, можно ли использовать выходной
      if (daysSinceLastActive === 2 && canUseFreePass()) {
        // Ровно 1 пропущенный день и есть выходной - используем его для защиты стрика
        useFreePass();
        // Ждём сегодняшней активности
      } else {
        // Серия сгорает
        streak.count = 0;
        streak.lastDate = null;
        markProfileDirty('streak', streak.count);
        markProfileDirty('laststreakdate', streak.lastDate);
      }
    }
    // Если daysSinceLastActive === 1 — ничего не делаем (ждём завтра)
  }

  // Сохраняем изменения в профиль
  markProfileDirty('free_pass_used', streak.freePassUsedThisWeek);
  markProfileDirty('free_pass_week_start', streak.freePassWeekStart);

  // Перерисовываем UI
  renderStreak();
  renderStats(); // обновляем статистику
}

// ============================================================

// SPEECH ENGINE

// ============================================================

// Функция getAudioContext перенесена в js/utils.js

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

  modal.className = 'modal-backdrop open';

  modal.innerHTML = `

    <div class="modal-box" style="max-width: 420px; text-align: center;">

      <h3 style="margin: 0 0 0.5rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">

        <span class="material-symbols-outlined" style="font-size: 1.5rem; color: var(--warning);">timer_off</span>

        Дневной лимит достигнут!

      </h3>

      <p style="color: var(--muted); margin-bottom: 1rem;">

        Ты отлично поработал сегодня!<br>

        Выполнил все ${pluralize(limit, 'повторение', 'повторения', 'повторений')}.

      </p>

      <p style="margin: 0.5rem 0; font-weight: 600;">

        Отдохни, закрепи материал и возвращайся завтра для новых достижений!

      </p>

      <p style="font-size: 0.85rem; color: var(--muted); margin-top: 1rem;">

        Лимит сбросится через <strong>${timeUntilReset}</strong>

      </p>

      <div class="modal-actions" style="flex-direction: column; gap: 0.5rem; margin-top: 1.5rem;">

        <button class="btn-pill btn-pill--secondary" id="limit-modal-ok">

          <span class="material-symbols-outlined">check</span> Понятно, отдохну!

        </button>

        <button class="btn-link" id="limit-modal-settings" style="font-size: 0.8rem; text-decoration: none;">

          <span class="material-symbols-outlined" style="font-size: 0.9rem;">settings</span>

          Изменить лимит в настройках

        </button>

      </div>

    </div>

  `;

  document.body.appendChild(modal);

  document.body.classList.add('modal-open');

  const closeModal = () => {

    modal.remove();

    document.body.classList.remove('modal-open');

    document.getElementById('practice-setup').style.display = 'block';

  };

  modal.querySelector('#limit-modal-ok').addEventListener('click', closeModal);

  modal.querySelector('#limit-modal-settings').addEventListener('click', () => {

    closeModal();

    // Открываем модалку настроек (если она существует)

    const settingsModal = document.getElementById('speech-modal');

    if (settingsModal) {

      settingsModal.classList.add('open');

      document.body.classList.add('modal-open');

    }

  });

  // Закрытие по клику на фон

  modal.addEventListener('click', e => {

    if (e.target === modal) closeModal();

  });

}

// Функция toast перенесена в js/utils.js

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

  // Считаем learning слова (не выученные)

  const wordsLearning = window.words.filter(w => !w.stats?.learned).length;

  // Считаем learning идиомы (не выученные)

  const idiomsLearning = window.idioms.filter(i => !i.stats?.learned).length;

  // Считаем due идиомы

  const idiomsDue = window.idioms.filter(

    i => new Date(i.stats?.nextReview || 0) <= now,

  ).length;

  const totalDue = wordsDue + idiomsDue; // фразы не включаем

  // Бейдж над "Практикой" в навигации — просто точка

  const desktopBadge = document.getElementById('due-count');

  const mobileBadge = document.getElementById('mobile-due-count');

  const displayDue = totalDue.toString();

  if (desktopBadge) {

    desktopBadge.textContent = displayDue;

    desktopBadge.style.display = totalDue > 0 ? 'flex' : 'none';

    desktopBadge.title = `Слов: ${wordsDue}, идиом: ${idiomsDue} (фразы не входят в этот счётчик)`;

  }

  if (mobileBadge) {

    mobileBadge.textContent = displayDue;

    mobileBadge.style.display = totalDue > 0 ? 'flex' : 'none';

    mobileBadge.title = `Слов: ${wordsDue}, идиом: ${idiomsDue} (фразы не входят в этот счётчик)`;

  }

  // Счётчики на чипах внутри Практики

  const setChipBadge = (id, value) => {

    const el = document.getElementById(id);

    if (!el) return;

    el.textContent = value > 0 ? String(value) : '';

    el.style.display = value > 0 ? 'inline-flex' : 'none';

  };

  setChipBadge('practice-words-due', wordsDue);

  setChipBadge('practice-idioms-due', idiomsDue);

  // Обновляем due-pill в фильтрах практики в зависимости от режима

  const duePill = document.getElementById('due-pill');

  if (duePill) {

    const currentMode =

      document.querySelector('#practice-mode .chip.on')?.dataset.mode ||

      'normal';

    const pillCount =

      currentMode === 'idioms'

        ? idiomsDue

        : wordsDue;

    duePill.textContent = pillCount;

    duePill.style.display = pillCount > 0 ? 'inline' : 'none';

  }

  // Обновляем learning-pill в фильтрах практики в зависимости от режима

  const learningPill = document.getElementById('learning-pill');

  if (learningPill) {

    const currentMode =

      document.querySelector('#practice-mode .chip.on')?.dataset.mode ||

      'normal';

    const learningCount =

      currentMode === 'idioms'

        ? idiomsLearning

        : wordsLearning;

    learningPill.textContent = learningCount;

    learningPill.style.display = learningCount > 0 ? 'inline' : 'none';

  }

  // Обновляем learning-pill-mobile в мобильном меню

  const learningPillMobile = document.getElementById('learning-pill-mobile');

  if (learningPillMobile) {

    const currentMode =

      document.querySelector('#practice-mode .chip.on')?.dataset.mode ||

      'normal';

    const learningCount =

      currentMode === 'idioms'

        ? idiomsLearning

        : wordsLearning;

    learningPillMobile.textContent = learningCount;

    learningPillMobile.style.display = learningCount > 0 ? 'inline-flex' : 'none';

  }

}

// NEW renderStats function with idioms support

function renderStreak() {
  if (!window.profileFullyLoaded) return; // не рисуем до готовности данных
  const count = streak.count || 0;
  const today = window.getLocalDate();
  const lastDate = streak.lastDate;
  const best = streak.bestStreak || 0;
  const isTodayActive = lastDate === today;

  // Проверяем, достигнуто ли время для серии сегодня
  const practiceTimeToday = getPracticeTimeToday();
  const isTimeReached = practiceTimeToday >= STREAK_CRITERIA.minPracticeTime;

  // Если время достигнуто, но день еще не засчитан в streak, считаем как активный для подсветки
  const shouldHighlightStreak = isTodayActive || (isTimeReached && lastDate !== today);

  // Функция для правильного склонения слова "день"
  function getDayWord(c) {
    const lastTwo = c % 100;
    const lastOne = c % 10;
    if (lastTwo >= 11 && lastTwo <= 19) return 'дней';
    if (lastOne === 1) return 'день';
    if (lastOne >= 2 && lastOne <= 4) return 'дня';
    return 'дней';
  }

  // Унифицированное обновление состояния активности (хедер + карточка)
  const updateActivityState = (element) => {
    if (!element) return;
    element.classList.remove('streak-active', 'streak-inactive');
    element.classList.add(shouldHighlightStreak ? 'streak-active' : 'streak-inactive');
  };

  // Хедер: счётчик
  const headerCount = document.getElementById('streak-header-count');
  if (headerCount) {
    const newVal = count;
    if (parseInt(headerCount.textContent) !== newVal) {
      headerCount.textContent = newVal;
      headerCount.classList.remove('bump');
      void headerCount.offsetWidth;
      headerCount.classList.add('bump');
    }
    updateActivityState(headerCount);
  }

  // Хедер: иконка огня
  const fireIcon = document.querySelector('.streak-fire-icon');
  if (fireIcon) {
    updateActivityState(fireIcon);
  }

  // Карточка: иконка огня
  const cardFireIcon = document.querySelector('#streak-card .streak-fire-icon');
  if (cardFireIcon) {
    updateActivityState(cardFireIcon);
  }

  // Карточка: цифра серии
  const stStreak = document.getElementById('st-streak');
  const stStreakLabel = document.getElementById('st-streak-label');
  if (stStreak) {
    stStreak.textContent = count;
    updateActivityState(stStreak);
    stStreak.title = isTodayActive ? '🔥 Сегодня серия активна!' : '⏳ Занимайся сегодня, чтобы сохранить серию!';
  }
  if (stStreakLabel) {
    stStreakLabel.textContent = `${getDayWord(count)} подряд`;
  }

  // --- 1. Прогресс до следующей вехи ---
  let currentMilestone = MILESTONES[0];
  let nextMilestone = MILESTONES[0];
  for (let i = 0; i < MILESTONES.length; i++) {
    if (MILESTONES[i].days <= count) currentMilestone = MILESTONES[i];
    if (MILESTONES[i].days > count) { nextMilestone = MILESTONES[i]; break; }
  }
  const isLegendary = count >= 500;
  const target = isLegendary ? count + 10 : nextMilestone.days;
  const prevDays = currentMilestone.days;
  const nextDays = isLegendary ? target : nextMilestone.days;

  let progress = 100;
  let progressText = '';
  if (isLegendary) {
    progress = Math.min(100, Math.round(((count - 500) / 10) * 100));
    progressText = `${count} дней. Следующая цель: ${target}`;
  } else if (nextMilestone) {
    // Считаем прогресс от предыдущей вехи к следующей
    const range = nextDays - prevDays;
    let currentProgress = count - prevDays;
    // Если мы только достигли текущей вехи, показываем минимальный прогресс
    if (currentProgress === 0 && count > 0) {
      currentProgress = 0.5;
    }
    progress = range > 0 ? Math.min(100, Math.round((currentProgress / range) * 100)) : 100;
    progressText = `${count} из ${nextDays} дней (${nextMilestone.label})`;
  } else {
    // Все вехи пройдены
    progress = 100;
    progressText = `${count} дней. Все вехи пройдены!`;
  }

  // Обновляем прогресс-бар и текст
  const fill = document.getElementById('streak-progress-fill');
  const textEl = document.getElementById('streak-progress-text');
  if (fill) fill.style.width = progress + '%';
  if (textEl) textEl.textContent = progressText;

  // --- 2. Прогресс по сегодняшним критериям ---
  const dailyProgressEl = document.getElementById('streak-daily-progress');
  const dailyProgressText = document.getElementById('streak-daily-progress-text');
  
  if (dailyProgressEl && dailyProgressText) {
    // Показываем только если сегодня еще не засчитано и время еще не достигнуто
    if (!isTodayActive) {
      const practiceTimeToday = getPracticeTimeToday();
      
      // Если время достигнуто - скрываем таймер
      if (practiceTimeToday >= STREAK_CRITERIA.minPracticeTime) {
        dailyProgressEl.style.display = 'none';
      } else {
        dailyProgressEl.style.display = 'block';
        const timeRemaining = Math.max(0, STREAK_CRITERIA.minPracticeTime - practiceTimeToday);
        
        // Форматируем оставшееся время как MM:SS
        const minutes = Math.floor(timeRemaining / 60);
        const seconds = timeRemaining % 60;
        const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        dailyProgressText.textContent = `Осталось: ${timeString}`;
      }
    } else {
      dailyProgressEl.style.display = 'none';
    }
  }

  // --- 3. Мотивационное сообщение ---
  const msgEl = document.getElementById('streak-message');
  if (msgEl) {
    const milestoneMsgs = {
      1: (c) => `${c} ${getDayWord(c)} серии. Ты начал(а) — главное вернуться завтра.`,
      2: (c) => `${c} ${getDayWord(c)} подряд — уже не случайность. Дожмём до трёх?`,
      3: (c) => `${c} ${getDayWord(c)} подряд — ты выбрался(лась) из болота «начал и бросил».`,
      5: (c) => `${c} ${getDayWord(c)} подряд. Ещё пара — и неделя!`,
      7: (c) => `${c} ${getDayWord(c)} подряд. Целая неделя без пропусков – уважение!`,
      10: (c) => `${c} ${getDayWord(c)} серии. Добро пожаловать в клуб не сдающихся!`,
      14: (c) => `${c} ${getDayWord(c)}, две недели без слива. Мозг привык к регулярности.`,
      21: (c) => `${c} ${getDayWord(c)} – классика! Привычка сформирована.`,
      30: (c) => `${c} ${getDayWord(c)} — полный месяц без пропусков. Это стиль жизни!`,
      50: (c) => `${c} ${getDayWord(c)} подряд. Ты в зоне «упоротый и продуктивный».`,
      75: (c) => `${c} ${getDayWord(c)} — почти три месяца. Такая серия видна из космоса.`,
      100: (c) => `${c} ${getDayWord(c)} подряд. Это уже суперсила!`,
      150: (c) => `${c} ${getDayWord(c)} — ты в редком клубе долгожителей.`,
      200: (c) => `${c} ${getDayWord(c)}. Большинство приложений столько не живут!`,
      250: (c) => `${c} ${getDayWord(c)} — четверть пути до тысячи. Сюжет!`,
      300: (c) => `${c} ${getDayWord(c)} — ты почти год с языком на «ты».`,
      365: (c) => `${c} ${getDayWord(c)}. Целый год без сливов. Ты — легенда!`,
      500: (c) => `${c} ${getDayWord(c)}. Это уже не серия, это образ жизни.`
    };

    const rangeMsgs = [
      {
        min: 4, max: 6,
        texts: [
          'Уже начинает складываться серия. Не отпускай темп.',
          'Несколько дней подряд — и это уже похоже на систему.',
          'Хороший разгон. Главное теперь не оборвать цепочку.'
        ]
      },
      {
        min: 8, max: 13,
        texts: [
          'Серия крепнет. Ты уже не на старте, а в движении.',
          'Пошла серия, которую жалко терять. И это отлично.',
          'Несколько уверенных дней подряд — форма набирается.'
        ]
      },
      {
        min: 15, max: 20,
        texts: [
          'Режим уже чувствуется. Осталось дожать до 21 дня.',
          'Хорошая стабильность. Такие серии делают результат.',
          'Ты уже втянулся(ась). Теперь важно удержать ритм.'
        ]
      },
      {
        min: 22, max: 29,
        texts: [
          'Привычка уже рядом. Серия выглядит серьёзно.',
          'Очень крепкий темп. Месяц уже на горизонте.',
          'Это уже не случайный всплеск, а настоящая регулярность.'
        ]
      },
      {
        min: 31, max: 49,
        texts: [
          'Месяц пройден. Теперь серия начинает работать на тебя.',
          'Отличная серия. Ты уже заметно дальше большинства.',
          'Ритм закрепился — осталось просто не выпадать.'
        ]
      },
      {
        min: 51, max: 74,
        texts: [
          'Сильная серия. Тут уже чувствуется характер.',
          'Такой темп не собирается сам — ты реально держишь систему.',
          'Серия уже солидная. С каждым днём бросить всё труднее.'
        ]
      },
      {
        min: 76, max: 99,
        texts: [
          'Почти сотка. Это уже очень серьёзный уровень дисциплины.',
          'Большая серия. До трёх цифр осталось совсем немного.',
          'Тут уже начинается настоящая гордость за стабильность.'
        ]
      },
      {
        min: 101, max: 149,
        texts: [
          'Трёхзначная серия — звучит уже мощно.',
          'После сотни серия ощущается совсем по-другому.',
          'Это уже дистанция человека, который умеет не сдаваться.'
        ]
      },
      {
        min: 151, max: 199,
        texts: [
          'Очень редкий уровень стабильности. Так держать уже умеют не все.',
          'Серия стала по-настоящему большой. Видно серьёзный настрой.',
          'Такая серия уже вызывает уважение сама по себе.'
        ]
      },
      {
        min: 201, max: 249,
        texts: [
          'За двести дней — это уже внушительная история.',
          'Большая дистанция. Тут работает не мотивация, а характер.',
          'Очень мощный темп. Серия выглядит почти монументально.'
        ]
      },
      {
        min: 251, max: 299,
        texts: [
          'Ты уверенно идёшь к 300. Это уже уровень ветерана.',
          'Такая серия собирается только из очень сильной регулярности.',
          'Почти триста дней — звучит уже как отдельное достижение.'
        ]
      },
      {
        min: 301, max: 364,
        texts: [
          'Ты в коридоре к году. Это уже почти легендарная серия.',
          'До полного года рукой подать. Серия выглядит мощно.',
          'Почти год без развала ритма — это очень серьёзно.',
          'Эта серия уже не просто длинная. Она статусная.',
          'Финишная прямая к году. Очень красиво идёшь.'
        ]
      },
      {
        min: 366, max: 499,
        texts: [
          'Год уже позади. Теперь ты играешь в совсем другой лиге.',
          'После года это уже не челлендж, а часть личности.',
          'Серия после 365 дней ощущается как отдельный ранг.',
          'Ты уже перешёл(шла) в территорию настоящих легенд.',
          'Тут уже не "продолжать", а просто жить в этом ритме.'
        ]
      },
      {
        min: 501, max: Infinity,
        texts: [
          'Больше 500 дней — это уже уровень мифа.',
          'Такую серию не удерживают случайно. Это система, вросшая в жизнь.',
          'Ты за пределами обычной мотивации. Здесь уже чистая идентичность.',
          'Очень немногие дожимают до таких чисел. Это элитный уровень.'
        ]
      }
    ];

    function getRangeMessage(count) {
      const bucket = rangeMsgs.find(r => count >= r.min && count <= r.max);
      if (!bucket) return `${count} ${getDayWord(count)} подряд. Отличная серия!`;
      return bucket.texts[count % bucket.texts.length];
    }

    if (count === 0) {
      msgEl.textContent = 'Начни свою первую серию!';
    } else if (milestoneMsgs[count]) {
      msgEl.textContent = milestoneMsgs[count](count);
    } else {
      msgEl.textContent = getRangeMessage(count);
    }
  }

  // --- 6. Лучшая серия ---
  const bestEl = document.getElementById('st-best');
  if (bestEl) {
    bestEl.textContent = best > 0 ? best : 0;
  }

  // --- Иконка выходного в карточке ---
  const cardFreeze = document.getElementById('streak-card-freeze');
  const canUse = canUseFreePass();

  const updateFreezeIcon = (element, isCard = false) => {
    if (!element) return;

    const tooltipText = canUse
      ? 'Выходной доступен: Можно пропустить 1 день на этой неделе — серия не сгорит.'
      : `Выходной на этой неделе уже использован. Будет доступен через ${getDaysUntilNextFreePass()} ${getDayWordForCount(getDaysUntilNextFreePass())}.`;

    element.style.display = 'inline-flex';
    element.classList.toggle('used', !canUse);
    element.removeAttribute('title');
    element.setAttribute('data-tooltip', tooltipText);
    element.setAttribute('tabindex', '0');
    element.setAttribute('aria-label', tooltipText);

    if (isCard) {
      element.innerHTML = canUse
        ? `<span class="material-symbols-outlined">beach_access</span><span class="freeze-text">Выходной доступен</span>`
        : `<span class="material-symbols-outlined">beach_access</span><span class="freeze-text">Выходной использован</span>`;
    }

    bindTooltip(element);
  };

  updateFreezeIcon(cardFreeze, true);
}

function renderStats() {

  // Защита от отсутствия данных

  if (

    !window.words ||

    !Array.isArray(window.words) ||

    !window.idioms ||

    !Array.isArray(window.idioms)

  ) {

    console.warn('renderStats: данные не готовы, пропускаем');

    return;

  }

  const now = new Date();

  const weekAgo = new Date(Date.now() - 7 * 86400000);

  // ── СЛОВА ──────────────────────────────────────

  let wordsDue = 0,

    wordsLearned = 0,

    wordsThisWeek = 0;

  const wordsWithStats = [];

  for (const wordItem of window.words) {

    if (new Date(wordItem.stats.nextReview) <= now) wordsDue++;

    if (wordItem.stats.learned) wordsLearned++;

    if (new Date(wordItem.created_at || wordItem.createdAt) >= weekAgo)

      wordsThisWeek++;

    if (wordItem.stats?.shown > 0) wordsWithStats.push(wordItem);

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

  for (const idiomItem of window.idioms) {

    if (new Date(idiomItem.stats?.nextReview || 0) <= now) idiomsDue++;

    if (idiomItem.stats?.learned) idiomsLearned++;

    if (new Date(idiomItem.created_at || idiomItem.createdAt) >= weekAgo)

      idiomsThisWeek++;

    if (idiomItem.stats?.shown > 0) idiomsWithStats.push(idiomItem);

  }

  const idiomsTotal = window.idioms.length;

  const idiomsPct = idiomsTotal

    ? Math.round((idiomsLearned / idiomsTotal) * 100)

    : 0;

  // ── ОБЩЕЕ ─────────────────────────────────────

  const totalAll = wordsTotal + idiomsTotal; // REMOVED: + phrasesTotal

  const totalLearned = wordsLearned + idiomsLearned; // REMOVED: + phrasesLearned

  const totalDue = wordsDue + idiomsDue; // REMOVED: + phrasesDue

  const totalPct = totalAll ? Math.round((totalLearned / totalAll) * 100) : 0;

  const thisWeek = wordsThisWeek + idiomsThisWeek; // REMOVED: + phrasesThisWeek

  // ── Совместимость со старыми ID ─────────────────

  document.getElementById('st-total') &&

    (document.getElementById('st-total').textContent = totalAll);

  document.getElementById('st-learned') &&

    (document.getElementById('st-learned').textContent = totalLearned);

  if (document.getElementById('st-learned-bar'))

    document.getElementById('st-learned-bar').style.width = totalPct + '%';

  if (document.getElementById('st-streak'))
    document.getElementById('st-streak').textContent = streak.count;

  // Вызываем renderStreak для обновления карточки серии
  renderStreak();

  if (document.getElementById('st-week'))

    document.getElementById('st-week').textContent = window.learningStreak || 0;

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

    const isSmallScreen = window.innerWidth < 900;

    const isTinyScreen = window.innerWidth < 620;

    const learnedIcon = 'psychology';

    const wordsLearnedText = isTinyScreen

      ? `${wordsLearned} выучено`

      : isSmallScreen

        ? `${wordsLearned}`

        : `${wordsLearned} выучено`;

    const wordsTotalText = isTinyScreen

      ? `${wordsTotal} всего`

      : isSmallScreen

        ? `${wordsTotal}`

        : `${wordsTotal} всего`;

    const idiomsLearnedText = isTinyScreen

      ? `${idiomsLearned} выучено`

      : isSmallScreen

        ? `${idiomsLearned}`

        : `${idiomsLearned} выучено`;

    const idiomsTotalText = isTinyScreen

      ? `${idiomsTotal} всего`

      : isSmallScreen

        ? `${idiomsTotal}`

        : `${idiomsTotal} всего`;

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

          <span><span class="material-symbols-outlined stat-icon-small learned-icon">${learnedIcon}</span> ${wordsLearnedText}</span>

          <span><span class="material-symbols-outlined stat-icon-small">menu_book</span> ${wordsTotalText}</span>

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

          <span><span class="material-symbols-outlined stat-icon-small learned-icon">${learnedIcon}</span> ${idiomsLearnedText}</span>

          <span><span class="material-symbols-outlined stat-icon-small">theater_comedy</span> ${idiomsTotalText}</span>

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

  let html = '';

  DAILY_GOALS.forEach(goal => {

    const current = window.dailyProgress[goal.id] || 0;

    const remaining = Math.max(0, goal.target - current);

    const percent = Math.min(100, Math.round((current / goal.target) * 100));

    const done = current >= goal.target;

    // Форматирование времени для practice_time (секунды -> ММ:СС)

    let displayRemaining = remaining;

    let displayCurrent = current;

    if (goal.id === 'practice_time') {

      if (current === 0) {

        // Если практика ещё не начиналась - показываем "15 минут"

        displayRemaining = '15 минут';

      } else {

        // Если уже занимался - показываем только обратный отсчёт в формате ММ:СС

        const formatTime = (seconds) => {

          const mins = Math.floor(seconds / 60);

          const secs = seconds % 60;

          return `${mins}:${secs.toString().padStart(2, '0')}`;

        };

        displayRemaining = formatTime(remaining);

      }

    }

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

          ${!done ? `<div class="goal-progress-text">Осталось: ${displayRemaining}</div>` : ''}

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

    let level = w.cefr;

    if (!level && w.tags) {

      level = w.tags.find(t => /^[A-C][1-2]$/i.test(t));

    }

    if (level && levels[level.toUpperCase()] !== undefined) {

      levels[level.toUpperCase()]++;

    }

  });

  window.cefrLevels = levels;

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

function switchTab(name, skipScroll = false) {

  const currentActivePane = document.querySelector('.tab-pane.active');

  const currentActiveTab = currentActivePane

    ? currentActivePane.id.replace('tab-', '')

    : null;

  // Закрываем чат при уходе с вкладки друзья

  if (currentActiveTab === 'friends' && name !== 'friends') {

    const chatContainer = document.getElementById('chat-messages');

    const friendsList = document.getElementById('chat-friends-list');

    if (chatContainer && friendsList) {

      chatContainer.style.display = 'none';

      friendsList.style.display = 'block';

      window.currentChatFriend = null;

      // Удаляем классы полноэкранного режима

      const fpanelChat = document.getElementById('fpanel-chat');

      fpanelChat.classList.remove('chat-fullscreen');

      document.body.classList.remove('chat-open');

    }

  }

  // Если уходим с вкладки практика во время активной сессии - завершаем сессию

  if (currentActiveTab === 'practice' && name !== 'practice' && window.isSessionActive) {

    resetPracticeToStart();

    window.isSessionActive = false;

    document.body.classList.remove('exercise-active');

  }

  // Если возвращаемся на вкладку практика во время активной сессии - показываем экран упражнения

  if (name === 'practice' && window.isSessionActive) {

    const exerciseScreen = document.getElementById('practice-ex');

    const startScreen = document.getElementById('practice-setup');

    if (exerciseScreen) {

      exerciseScreen.style.display = 'block';

    }

    if (startScreen) {

      startScreen.style.display = 'none';

    }

    // Не сбрасываем состояние, продолжаем сессию

  } else if (currentActiveTab === 'practice' && name !== 'practice') {

    // Закрываем карточку результатов при уходе с вкладки практика (если сессия не активна)

    resetPracticeToStart();

  }

  // Сбрасываем выбранные упражнения при переключении между словами и идиомами

  if (

    (currentActiveTab === 'words' && name === 'idioms') ||

    (currentActiveTab === 'idioms' && name === 'words')

  ) {

    // Сбрасываем выбор упражнений

    document.querySelectorAll('.exercise-card.selected').forEach(card => {

      card.classList.remove('selected');

    });

    // Выбираем первое упражнение по умолчанию

    const firstExercise = document.querySelector('.exercise-card');

    if (firstExercise) {

      firstExercise.classList.add('selected');

    }

  }

  if (name === 'words') {

    visibleLimit = 30; // <-- сброс при переключении на слова

    renderRandomBankWord(); // Вызываем без await, т.к. в синхронной функции

    refreshUI();

  }

  if (name === 'practice') {

    refreshUI();

  }

  if (name === 'friends') {

    refreshUI();

    // Обновляем сообщения при входе на вкладку друзья

    if (window.currentUserId) {

      updateUnreadCounts();

    }

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

  if (name === 'stories') {
    renderStories();
  }

  if (name === 'friends') {

    loadFriendsDataNew();

  }

  // Управление видимостью плавающих кнопок при переключении вкладок

  updateFloatingButtonsForTab(name);

  if (name === 'words') refreshUI(); // уже обновлено выше, но оставим для надежности

  // Скроллим наверх при переключении вкладок (особенно для мобильных)

  if (window.innerWidth <= 768 && !skipScroll) {

    window.scrollTo({ top: 0, behavior: 'smooth' });

  }

}

// Переключение на вкладку друзей без прокрутки и без автоматической загрузки данных

function switchToFriendsWithoutScroll() {

  switchTab('friends', true);

}

// Экспортируем функции глобально

window.switchTab = switchTab;

window.switchToFriendsWithoutScroll = switchToFriendsWithoutScroll;

window.renderWeekChart = renderWeekChart;
window.renderMonthHeatmap = renderMonthHeatmap;

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

    window.applyTheme(baseTheme, on);

    // после изменения чекбокса

    window.user_settings.dark =

      document.documentElement.classList.contains('dark');

    if (window.currentUserId) {

      markProfileDirty('usersettings', window.user_settings);

    }

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

  const merged = new Map();

  // Сначала все серверные слова

  for (const w of remoteWords) {

    merged.set(w.id, w);

  }

  // Локальные перетирают серверные ТОЛЬКО если новее

  for (const w of localWords) {

    const remote = merged.get(w.id);

    if (!remote) {

      // Слово только локальное (добавлено оффлайн) — берём его

      merged.set(w.id, w);

    } else {

      // Оба есть — берём более новое по updated_at

      const localTime = new Date(w.updated_at || w.created_at || 0).getTime();

      const remoteTime = new Date(

        remote.updated_at || remote.created_at || 0,

      ).getTime();

      if (localTime > remoteTime) {

        // Локальные явно новее — берём их
        merged.set(w.id, w);

      } else {

        // Сервер новее или равен — берём серверные данные
        // Это гарантирует что актуальные данные с сервера не перезаписываются локальным кешем

        // Сервер новее по updated_at, но stats могут быть богаче локально

        // Берём максимум по каждому полю:

        merged.set(w.id, {

          ...remote,

          stats: mergeStats(w.stats, remote.stats),

        });

      }

    }

  }

  return Array.from(merged.values());

};

// Мёрж статистики - lastPracticed как истина в последней инстанции

function mergeStats(local, remote) {

  if (!local) return remote;

  if (!remote) return local;

  const localTime = new Date(local.lastPracticed || 0).getTime();

  const remoteTime = new Date(remote.lastPracticed || 0).getTime();

  // Объединяем массивы выполненных упражнений из обоих источников

  const localTypes =

    local.correct_exercise_types ?? local.correctExerciseTypes ?? [];

  const remoteTypes =

    remote.correct_exercise_types ?? remote.correctExerciseTypes ?? [];

  const mergedTypes = [...new Set([...localTypes, ...remoteTypes])];

  // Если практиковали локально позже — берём всю локальную статистику

  if (localTime > remoteTime) {

    return { ...local, correct_exercise_types: mergedTypes };

  }

  // Иначе берём серверную, но суммируем shown/correct и объединяем exercise types

  // (на случай если оба варианта содержат уникальные сессии)

  return {

    ...remote,

    shown: Math.max(local.shown ?? 0, remote.shown ?? 0),

    correct: Math.max(local.correct ?? 0, remote.correct ?? 0),

    correct_exercise_types: mergedTypes,

    streak: localTime > remoteTime ? local.streak : remote.streak,

  };

}

// Объединение идиом с обнаружением конфликтов

window.mergeIdioms = function (localIdioms, remoteIdioms) {

  const merged = new Map();

  // Сначала все серверные идиомы

  for (const i of remoteIdioms) {

    merged.set(i.id, i);

  }

  // Локальные перетирают серверные ТОЛЬКО если новее

  for (const i of localIdioms) {

    const remote = merged.get(i.id);

    if (!remote) {

      // Идиома только локальная (добавлена оффлайн) — берём её

      merged.set(i.id, i);

    } else {

      // Оба есть — берём более новую по updated_at

      const localTime = new Date(i.updated_at || i.created_at || 0).getTime();

      const remoteTime = new Date(

        remote.updated_at || remote.created_at || 0,

      ).getTime();

      if (localTime >= remoteTime) {

        merged.set(i.id, i);

      } else {

        // Сервер новее по updated_at, но stats могут быть богаче локально

        // Берём максимум по каждому полю:

        merged.set(i.id, {

          ...remote,

          stats: mergeStats(i.stats, remote.stats),

        });

      }

    }

  }

  return Array.from(merged.values());

};

// Показ уведомления о конфликтах

function showConflictNotification(conflicts) {

  const message = `Обнаружено ${conflicts.length} конфликт(ов) при синхронизации. Использована версия из облака.`;

  toast('' + message, 'warning', 'warning', 5000);

  // Логируем конфликты для отладки

  // Конфликты обработаны

}

// Отслеживание состояния сети

async function syncAfterReconnect() {

  if (!navigator.onLine || !window.currentUserId) return;

  console.log('[SYNC RECONNECT] Starting sync after reconnect');

  console.log('[SYNC RECONNECT] Local words:', window.words?.length);

  console.log('[SYNC RECONNECT] Local idioms:', window.idioms?.length);

  console.log(

    '[SYNC RECONNECT] Pending word updates:',

    pendingWordUpdates.size,

  );

  console.log(

    '[SYNC RECONNECT] Pending idiom updates:',

    pendingIdiomUpdates.size,

  );

  // Снимок локального состояния до синка - защита от потери данных

  const localSnapshot = [...(window.words || [])];

  const idiomSnapshot = [...(window.idioms || [])];

  try {

    // ШАГ 1: СНАЧАЛА заливаем всё что накопилось оффлайн

    if (pendingWordUpdates.size > 0) {

      console.log('[SYNC RECONNECT] Flushing pending word updates...');

      await syncPendingWords();

    }

    if (pendingIdiomUpdates.size > 0) {

      console.log('[SYNC RECONNECT] Flushing pending idiom updates...');

      await syncPendingIdioms();

    }

    // ⏳ Даём серверу время обработать запросы (1500ms)

    console.log('[SYNC RECONNECT] Waiting 1500ms for server to process...');

    await new Promise(resolve => setTimeout(resolve, 1500));

    // ШАГ 2: ТОЛЬКО ПОТОМ грузим с сервера

    console.log('[SYNC RECONNECT] Loading words from server...');

    await window.authExports.loadWordsOnce(async remoteWords => {

      console.log('[SYNC RECONNECT] Remote words loaded:', remoteWords?.length);

      console.log(

        '[SYNC RECONNECT] Local snapshot words:',

        localSnapshot?.length,

      );

      // ШАГ 3: Мёрж с учётом таймстампов - локальные приоритетнее если новее

      const merged = window.mergeWords

        ? window.mergeWords(localSnapshot, remoteWords)

        : remoteWords;

      // ✅ Страховка — локальные слова которых нет на сервере никогда не теряем

      const remoteIds = new Set((remoteWords || []).map(r => r.id));

      const mergedIds = new Set((merged || []).map(w => w.id));

      const orphans = localSnapshot.filter(

        w => !remoteIds.has(w.id) && !mergedIds.has(w.id),

      );

      if (orphans.length > 0) {

        console.warn(

          '[SYNC RECONNECT] Rescued local-only words:',

          orphans.map(w => w.en),

        );

        merged.push(...orphans);

      }

      console.log('[SYNC RECONNECT] Merged words:', merged?.length);

      window.words = merged;

      refreshUI();

    });

    // Синхронизируем идиомы

    console.log('[SYNC RECONNECT] Loading idioms from server...');

    await window.authExports.loadIdiomsOnce(async remoteIdioms => {

      console.log(

        '[SYNC RECONNECT] Remote idioms loaded:',

        remoteIdioms?.length,

      );

      console.log(

        '[SYNC RECONNECT] Local snapshot idioms:',

        idiomSnapshot?.length,

      );

      const mergedIdioms = window.mergeIdioms

        ? window.mergeIdioms(idiomSnapshot, remoteIdioms)

        : remoteIdioms;

      console.log('[SYNC RECONNECT] Merged idioms:', mergedIdioms?.length);

      window.idioms = mergedIdioms;

      renderIdioms();

    });

    console.log('[SYNC RECONNECT] Sync completed successfully');

  } catch (e) {

    // Если синк упал — восстанавливаем снимок

    window.words = localSnapshot;

    window.idioms = idiomSnapshot;

    console.warn('[SYNC RECONNECT] Sync failed, restored local state:', e);

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

      toast('Нет интернета. Данные сохранены локально', 'warning', 'wifi_off');

    }

  };

  window.addEventListener('online', updateNetworkStatus);

  window.addEventListener('offline', updateNetworkStatus);

  // Начальный статус

  // updateNetworkStatus();

}

function renderWords(appendOnly = false) {

  const grid = document.getElementById('words-grid');

  const empty = document.getElementById('empty-words');

  const trigger = document.getElementById('load-more-trigger');

  // 1. Вычисляем отфильтрованный и отсортированный список

  let list = window.words;

  // Защита от отсутствия слов

  if (!window.words || !Array.isArray(window.words)) {

    console.warn('[RENDER] window.words is not array or empty:', window.words);
    return;

  }

  if (activeFilter === 'learning') list = list.filter(w => !w.stats.learned);

  if (activeFilter === 'learned') list = list.filter(w => w.stats.learned);

  if (searchQ) {

    const q = searchQ.toLowerCase().trim();

    list = list

      .filter(

        w =>

          w.en.toLowerCase().startsWith(q) || w.ru.toLowerCase().startsWith(q),

      )

      .sort((a, b) => {

        // точное совпадение — всегда первым

        const aExact = a.en.toLowerCase() === q;

        const bExact = b.en.toLowerCase() === q;

        if (aExact && !bExact) return -1;

        if (!aExact && bExact) return 1;

        return 0;

      });

  } else {

    list = sortWords(list, sortBy);

  }

  if (tagFilter) {

    list = list.filter(w =>

      w.tags.map(t => t.toLowerCase()).includes(tagFilter),

    );

  }

  list = sortWords(list, sortBy);

  currentFilteredWords = list;

  // 2. Обновляем подзаголовок

  const subtitleEl = document.getElementById('words-subtitle');

  if (subtitleEl) {

    subtitleEl.textContent =

      list.length !== window.words.length

        ? `(${list.length} из ${window.words.length})`

        : `— ${pluralize(window.words.length, 'слово', 'слова', 'слов')}`;

  }

  // 3. Если список пуст

  if (!list.length) {

    grid.innerHTML = '';

    empty.style.display = 'block';

    if (trigger) trigger.style.display = 'none';

    renderedWordsCount = 0;

    return;

  }

  empty.style.display = 'none';

  // 4. Полный рендер (appendOnly = false)

  if (!appendOnly) {

    visibleLimit = Math.min(visibleLimit, list.length);

    renderedWordsCount = 0;

    grid.innerHTML = '';

    const end = Math.min(visibleLimit, list.length);

    const fragment = document.createDocumentFragment();

    for (let i = 0; i < end; i++) {

      const card = getCachedCard(list[i]);

      fragment.appendChild(card);

    }

    grid.appendChild(fragment);

    renderedWordsCount = end;

    // Настраиваем триггер для бесконечной прокрутки

    if (renderedWordsCount >= list.length) {

      if (trigger) trigger.style.display = 'none';

    } else {

      if (trigger) trigger.style.display = 'block';

    }

    // Пересоздаём наблюдатель

    setupLoadMoreObserver(list.length);

  } else {

    // 5. Добавляем только новые карточки

    appendMoreWords();

  }

  updateTagFilterIndicator();

}

function appendMoreWords() {

  const grid = document.getElementById('words-grid');

  const trigger = document.getElementById('load-more-trigger');

  if (!currentFilteredWords.length) return;

  const start = renderedWordsCount;

  const end = Math.min(visibleLimit, currentFilteredWords.length);

  if (start >= end) return;

  const fragment = document.createDocumentFragment();

  for (let i = start; i < end; i++) {

    const word = currentFilteredWords[i];

    const card = getCachedCard(word);

    fragment.appendChild(card);

  }

  grid.appendChild(fragment);

  renderedWordsCount = end;

  // Скрываем триггер, если достигнут конец

  if (renderedWordsCount >= currentFilteredWords.length) {

    if (trigger) trigger.style.display = 'none';

  } else {

    if (trigger) trigger.style.display = 'block';

  }

}

function loadMoreWords() {

  if (isLoadingMore) return;

  if (renderedWordsCount >= currentFilteredWords.length) return;

  isLoadingMore = true;

  visibleLimit = Math.min(

    visibleLimit + PAGE_SIZE,

    currentFilteredWords.length,

  );

  appendMoreWords();

  setTimeout(() => {

    isLoadingMore = false;

  }, 100);

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

        : `— ${pluralize(window.words.length, 'слово', 'слова', 'слов')}`;

  }

}

function setupLoadMoreObserver(totalCount) {

  const trigger = document.getElementById('load-more-trigger');

  if (!trigger) return;

  if (intersectionObserver) intersectionObserver.disconnect();

  intersectionObserver = new IntersectionObserver(

    entries => {

      entries.forEach(entry => {

        if (

          entry.isIntersecting &&

          !isLoadingMore &&

          renderedWordsCount < currentFilteredWords.length

        ) {

          loadMoreWords();

        }

      });

    },

    { root: null, threshold: 0.1, rootMargin: '50px' },

  );

  intersectionObserver.observe(trigger);

}

function sortWords(list, sortBy) {

  // Защита от non-iterable

  if (!list || !Array.isArray(list)) {

    console.warn('sortWords получил не-массив:', list);

    return [];

  }

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

  card.dataset.learned = w.stats?.learned || false;

  card.dataset.collocations = JSON.stringify(

    w.grammar?.collocations || w.collocations || [],

  );

  // Базовая разметка (свёрнутое состояние)

  // Генерируем индикаторы прогресса

  let progressLevel = 0;

  if (w.stats) {

    if (w.stats.learned) {

      progressLevel = 3;

    } else {

      progressLevel = w.stats.correctExerciseTypes?.length || 0;

    }

  }

  const indicators = Array.from({ length: 3 }, (_, i) => {

    const dotClass = i < progressLevel ? 'filled' : '';

    return `<div class="progress-dot ${dotClass}"></div>`;

  }).join('');

  // Tooltip текст

  let tooltipText = 'Не изучено';

  if (w.stats.learned) {

    tooltipText = 'Выучено ✨';

  } else if (progressLevel > 0) {

    tooltipText = `Прогресс: ${progressLevel}/3 ${pluralize(3, 'упражнение', 'упражнения', 'упражнений')}`;

  }

  card.innerHTML = `

    <div class="word-card-header">

      <div class="word-main">

        <h3 class="word-title">${esc(w.en)}</h3>

        ${window.user_settings?.showPhonetic && w.phonetic ? `<div class="word-phonetic">${esc(w.phonetic)}</div>` : ''}

      </div>

      <div class="word-actions">

        <button class="audio-btn" data-word="${w.id}" title="Прослушать" aria-label="Прослушать произношение слова ${esc(w.en)}">

          <span class="material-symbols-outlined">volume_up</span>

        </button>

      </div>

    </div>

    <div class="word-translation">${parseAnswerVariants(w.ru).join(', ') || esc(w.ru)}</div>

    <div class="progress-indicators">${indicators}</div>

    <div class="word-card-footer">

      <span class="expand-hint">Нажмите, чтобы раскрыть</span>

      <span class="material-symbols-outlined expand-icon">expand_more</span>

    </div>

  `;

  // Обработчик клика для раскрытия/сворачивания

  card.addEventListener('click', async e => {

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

      if (expandHint) expandHint.textContent = 'Нажмите, чтобы свернуть';

      if (expandIcon) expandIcon.textContent = 'expand_less';

      await updateExpandedContent(card);

    } else {

      if (expandHint) expandHint.textContent = 'Нажмите, чтобы раскрыть';

      if (expandIcon) expandIcon.textContent = 'expand_more';

      const extra = card.querySelector('.word-card-extra');

      if (extra) extra.remove();

    }

  });

  return card;

}

async function updateExpandedContent(card) {

  if (!card.classList.contains('expanded')) {

    const extra = card.querySelector('.word-card-extra');

    if (extra) extra.remove();

    return;

  }

  // Remove old extra to redraw

  const existingExtra = card.querySelector('.word-card-extra');

  if (existingExtra) existingExtra.remove();

  function decodeHtmlEntities(str) {

    const div = document.createElement('div');

    div.innerHTML = str;

    return div.textContent || div.innerText || '';

  }

  let examples = [],

    tags = [];

  try {

    examples = JSON.parse(decodeHtmlEntities(card.dataset.examples || '[]'));

  } catch (e) {

    examples = [];

  }

  try {

    tags = JSON.parse(decodeHtmlEntities(card.dataset.tags || '[]'));

  } catch (e) {

    tags = [];

  }

  const extraDiv = document.createElement('div');

  extraDiv.className = 'word-card-extra';

  let tagsHtml = '';

  if (tags.length > 0) {

    tagsHtml = `<div class="word-tags">${tags

      .map(

        tag =>

          `<span class="tag" data-tag="${esc(tag)}">${esc(formatTag(tag))}</span>`,

      )

      .join('')}</div>`;

  }

  // Review info

  const wordId = card.dataset.id;

  let item = window.words.find(w => w.id === wordId);

  let reviewInfo;

  // Показываем "новое" для слов, которые еще ни разу не показывались

  if (item && item.stats && item.stats.shown === 0) {

    reviewInfo = `<span class="due-later"><span class="material-symbols-outlined">new_releases</span> новое</span>`;

  } else {

    reviewInfo =

      '<span class="due-later"><span class="material-symbols-outlined">refresh</span> —</span>';

    if (item && item.stats && item.stats.nextReview) {

      const nextReviewDate = new Date(item.stats.nextReview);

      const today = new Date();

      today.setHours(0, 0, 0, 0);

      const diffDays = Math.round(

        (nextReviewDate - today) / (1000 * 60 * 60 * 24),

      );

      if (diffDays <= 0)

        reviewInfo =

          '<span class="due-now"><span class="material-symbols-outlined">refresh</span> Сегодня</span>';

      else if (diffDays === 1)

        reviewInfo =

          '<span class="due-soon"><span class="material-symbols-outlined">refresh</span> Завтра</span>';

      else {

        const dayWord =

          diffDays === 1

            ? 'день'

            : diffDays >= 2 && diffDays <= 4

              ? 'дня'

              : 'дней';

        reviewInfo = `<span class="due-later"><span class="material-symbols-outlined">refresh</span> ${diffDays} ${dayWord}</span>`;

      }

    }

  }

  const editBtn = `<button class="edit-btn btn-icon" data-id="${card.dataset.id}" title="Редактировать">

       <span class="material-symbols-outlined">edit</span>

     </button>`;

  const actionsHtml = `

  <div class="word-actions-extra" style="display:flex;justify-content:space-between;align-items:center;margin:0.5rem 0;">

    <div class="word-review-info">${reviewInfo}</div>

    <div style="display:flex;gap:0.5rem;">

      ${editBtn}

      <button class="delete-btn btn-icon" data-id="${card.dataset.id}" title="Удалить">

        <span class="material-symbols-outlined">delete</span>

      </button>

    </div>

  </div>`;

  // Examples (always shown, no tabs)

  let examplesHtml = '';

  if (examples.length > 0) {

    examplesHtml = `<div class="word-examples">${examples

      .map(

        ex => ` 

        <div class="example-item">

          <div style="display:flex;align-items:center;gap:8px;">

            <div style="flex:1;">

              <div class="example-text">${esc(ex.text)}</div>

              ${ex.translation ? `<div class="example-translation">${esc(ex.translation)}</div>` : ''}

            </div>

            <button class="example-audio-btn" data-example-index="${examples.indexOf(ex)}"

              title="Listen" aria-label="${esc(ex.text)}">

              <span class="material-symbols-outlined" style="font-size:16px;">volume_up</span>

            </button>

          </div>

        </div>`,

        )

      .join('')}</div>`;

  } else {

    examplesHtml =

      '<div class="word-examples wc-empty-tab"><span class="material-symbols-outlined">format_quote</span><p>No examples</p></div>';

  }

  extraDiv.innerHTML = examplesHtml + tagsHtml + actionsHtml;

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

// Audio buttons on word cards

document.getElementById('words-grid')?.addEventListener('click', e => {

  // Обработка аудио-кнопок (оставляем как есть)

  if (e.target.closest('.audio-btn')) {

    const btn = e.target.closest('.audio-btn');

    const wordId = btn.dataset.word;

    const word = window.words.find(w => w.id === wordId);

    if (!word) return;

    stopAllAudioWaves();

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

    stopAllAudioWaves();

    // Show wave animation

    const existingWave = btn.querySelector('.audio-wave');

    const icon = btn.querySelector('.material-symbols-outlined');

    if (!existingWave) {

      const wave = document.createElement('div');

      wave.className = 'audio-wave';

      wave.innerHTML =

        '<span></span><span></span><span></span><span></span><span></span>';

      wave.style.display = 'flex';

      icon.style.display = 'none';

      btn.appendChild(wave);

    }

    const restoreButton = () => {

      const wave = btn.querySelector('.audio-wave');

      const icon = btn.querySelector('.material-symbols-outlined');

      if (wave) {

        wave.remove();

      }

      if (icon) {

        icon.style.display = 'block';

      }

    };

    if (word) {

      const examplesAudio =

        word.examples_audio || word.examplesAudio || word.examplesaudio;

      // If empty - look in bank

      const audioArr = examplesAudio?.length

        ? examplesAudio

        : window.wordBank?.find(

            b => b.en.toLowerCase() === word.en.toLowerCase(),

          )?.examplesAudio;

      const fallbackText = word.examples?.[exampleIndex]?.text || word.en;

      if (audioArr?.length > exampleIndex) {

        const voicePreference = window.user_settings?.voice || 'female';

        // Use same CEFR logic as speakWord

        if (!word.cefr && word.en && window.WordBankDB) {

          window.WordBankDB.searchWords(word.en, 5)

            .then(results => {

              const bankWord = results.find(

                r => r.en.toLowerCase() === word.en.toLowerCase(),

              );

              const foundCefr = bankWord?.cefr || 'A1';

              // Save CEFR back to word

              if (foundCefr && foundCefr !== 'A1') {

                word.cefr = foundCefr;

              }

              const audioFolder = `${foundCefr}/${voicePreference === 'male' ? 'man' : 'women'}`;

              const audio = new Audio(

                `${audioFolder}/${audioArr[exampleIndex]}`,

              );

              window.activeAudioElements.push(audio);

              audio.addEventListener('ended', () => {

                const idx = window.activeAudioElements.indexOf(audio);

                if (idx > -1) window.activeAudioElements.splice(idx, 1);

                restoreButton();

              });

              audio.play().catch(err => {

                const idx = window.activeAudioElements.indexOf(audio);

                if (idx > -1) window.activeAudioElements.splice(idx, 1);

                speakText(fallbackText);

                restoreButton();

              });

            })

            .catch(() => {

              const audioFolder = `A1/${voicePreference === 'male' ? 'man' : 'women'}`;

              const audio = new Audio(

                `${audioFolder}/${audioArr[exampleIndex]}`,

              );

              window.activeAudioElements.push(audio);

              audio.addEventListener('ended', () => {

                const idx = window.activeAudioElements.indexOf(audio);

                if (idx > -1) window.activeAudioElements.splice(idx, 1);

                restoreButton();

              });

              audio.play().catch(err => {

                const idx = window.activeAudioElements.indexOf(audio);

                if (idx > -1) window.activeAudioElements.splice(idx, 1);

                speakText(fallbackText);

                restoreButton();

              });

            });

          return;

        }

        const cefr = word.cefr || 'A1';

        const audioFolder = `${cefr}/${voicePreference === 'male' ? 'man' : 'women'}`;

        const audio = new Audio(`${audioFolder}/${audioArr[exampleIndex]}`);

        window.activeAudioElements.push(audio);

        audio.addEventListener('ended', () => {

          const idx = window.activeAudioElements.indexOf(audio);

          if (idx > -1) window.activeAudioElements.splice(idx, 1);

          restoreButton();

        });

        audio.play().catch(err => {

          const idx = window.activeAudioElements.indexOf(audio);

          if (idx > -1) window.activeAudioElements.splice(idx, 1);

          speakText(fallbackText);

          restoreButton();

        });

      } else {

        speakText(fallbackText);

        restoreButton();

      }

    } else {

      restoreButton();

    }

    return;

  }

  // Обработка клика по тегу (фильтрация)

  if (e.target.closest('.tag')) {

    const tag = e.target.closest('.tag').dataset.tag.toLowerCase();

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

  if (!card) return;

  card.classList.add('editing');

  const exText = w.examples?.[0]?.text || w.ex || '';

  const exTranslation = w.examples?.[0]?.translation || '';

  const phonetic = w.phonetic || '';

  card.innerHTML = `

    <div class="form-group">

      <label>English</label>

      <input type="text" class="e-en form-control" value="${safeAttr(w.en)}" name="edit-word-en" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" inputmode="text">

    </div>

    <div class="form-group">

      <label>Русский</label>

      <input type="text" class="e-ru form-control" value="${safeAttr(w.ru)}" name="edit-word-ru" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" inputmode="text">

    </div>

    <div class="form-group">

      <label>Транскрипция</label>

      <input type="text" class="e-phonetic form-control" value="${safeAttr(phonetic)}" name="edit-word-phonetic" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" inputmode="text">

    </div>

    <div class="form-group">

      <label>Пример</label>

      <input type="text" class="e-ex form-control" value="${safeAttr(exText)}" name="edit-word-ex" autocomplete="off" autocorrect="off" autocapitalize="sentences" spellcheck="false" inputmode="text">

    </div>

    <div class="form-group">

      <label>Перевод примера</label>

      <input type="text" class="e-ex-translation form-control" value="${safeAttr(exTranslation)}" name="edit-word-ex-ru" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" inputmode="text">

    </div>

    <div class="form-group">

      <label>Теги</label>

      <input type="text" class="e-tags form-control" value="${safeAttr((w.tags || []).join(', '))}" name="edit-word-tags" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" inputmode="text">

    </div>

    <div class="form-actions">

      <button class="save-edit-btn" data-id="${w.id}">

        <span class="material-symbols-outlined">save</span>

      </button>

      <button class="cancel-edit-btn">

        <span class="material-symbols-outlined">close</span>

      </button>

    </div>

  `;

  hardenStudyInputs(card);

  card

    .querySelector('.save-edit-btn')

    .addEventListener('click', async function (e) {

      e.stopPropagation();

      const currentWord = window.words.find(x => x.id === id);

      const card = this.closest('.word-card');

      const newExampleText = card.querySelector('.e-ex').value.trim();

      const newExampleTranslation = card

        .querySelector('.e-ex-translation')

        .value.trim();

      const preservedCollocations =

        currentWord?.grammar?.collocations ||

        JSON.parse(card.dataset.collocations || '[]') ||

        [];

      this.disabled = true;

      this.innerHTML =

        '<span class="material-symbols-outlined">hourglass_top</span>';

      await updWord(id, {

        en: card.querySelector('.e-en').value.trim(),

        ru: card.querySelector('.e-ru').value.trim(),

        phonetic: card.querySelector('.e-phonetic').value.trim(),

        ex: newExampleText,

        examples: newExampleText

          ? [{ text: newExampleText, translation: newExampleTranslation }]

          : [],

        tags: normalizeTags(card.querySelector('.e-tags').value),

        grammar: {

          ...(currentWord?.grammar || {}),

          collocations: preservedCollocations,

        },

      });

      toast('Сохранено', 'success', 'edit');

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

    window.sortBy = sortBy;

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

document.getElementById('idioms-grid')?.addEventListener('click', async e => {

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

    stopAllAudioWaves();

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

    stopAllAudioWaves();

    const examplesAudio =

      idiom.examples_audio || idiom.examplesAudio || idiom.examplesaudio;

    // Если пусто — смотрим в банке через IndexedDB

    let audioArr = examplesAudio?.length ? examplesAudio : null;

    if (!audioArr) {

      const allIdioms = await window.IdiomBankDB.getAllIdioms();

      audioArr = allIdioms.find(

        b => b.idiom.toLowerCase() === idiom.idiom.toLowerCase(),

      )?.examplesAudio;

    }

    // Текст для озвучки (пример или сама идиома)

    const fallbackText = idiom.example || idiom.ex || idiom.idiom;

    // Создаём волну

    const wave = document.createElement('div');

    wave.className = 'audio-wave';

    wave.innerHTML =

      '<span></span><span></span><span></span><span></span><span></span>';

    const icon = btn.querySelector('.material-symbols-outlined');

    icon.style.display = 'none';

    btn.appendChild(wave);

    const restoreButton = () => {

      const wave = btn.querySelector('.audio-wave');

      const icon = btn.querySelector('.material-symbols-outlined');

      if (wave) {

        wave.remove();

      }

      if (icon) {

        icon.style.display = '';

      }

    };

    if (audioArr?.length > exampleIndex) {

      // Определяем папку в зависимости от настроек голоса

      const voicePreference = window.user_settings?.voice || 'female';

      const audioFolder = `idioms/${voicePreference === 'male' ? 'man' : 'women'}`;

      const audio = new Audio(`${audioFolder}/${audioArr[exampleIndex]}`);

      window.activeAudioElements.push(audio);

      audio.addEventListener('ended', () => {

        const idx = window.activeAudioElements.indexOf(audio);

        if (idx > -1) window.activeAudioElements.splice(idx, 1);

        restoreButton();

      });

      audio.play().catch(err => {

        const idx = window.activeAudioElements.indexOf(audio);

        if (idx > -1) window.activeAudioElements.splice(idx, 1);

        restoreButton();

        speakText(fallbackText);

      });

    } else {

      restoreButton();

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

      <input type="text" class="e-idiom form-control" value="${safeAttr(i.idiom)}" name="edit-idiom" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" inputmode="text"></div>

    <div class="form-group"><label>Перевод</label>

      <input type="text" class="e-meaning form-control" value="${safeAttr(i.meaning)}" name="edit-idiom-meaning" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" inputmode="text"></div>

    <div class="form-group"><label>Определение</label>

      <input type="text" class="e-definition form-control" value="${safeAttr(i.definition)}" name="edit-idiom-definition" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" inputmode="text"></div>

    <div class="form-group"><label>Пример</label>

      <input type="text" class="e-example form-control" value="${safeAttr(i.example)}" name="edit-idiom-example" autocomplete="off" autocorrect="off" autocapitalize="sentences" spellcheck="false" inputmode="text"></div>

    <div class="form-group"><label>Перевод примера</label>

      <input type="text" class="e-exampletranslation form-control" value="${safeAttr(i.example_translation)}" name="edit-idiom-example-ru" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" inputmode="text"></div>

    <div class="form-group"><label>Теги</label>

      <input type="text" class="e-tags form-control" value="${safeAttr(i.tags.join(', '))}" name="edit-idiom-tags" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" inputmode="text"></div>

    <div class="form-actions">

      <button class="save-edit-idiom-btn" data-id="${i.id}">

        <span class="material-symbols-outlined">save</span>

      </button>

      <button class="cancel-edit-idiom-btn">

        <span class="material-symbols-outlined">close</span>

      </button>

    </div>

  `;

  hardenStudyInputs(card);

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

      toast('Сохранено', 'success', 'edit');

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

  const success = addWord(en, ru, ex, tags, examples, audio, examplesAudio);

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

    const { totalInBank, userWordsCount, remaining } =

      await window.WordBankDB.getRemainingWordsCount();

    const message =

      esc(en) +

      '<br><span style="opacity:0.8;font-size:0.85em">' +

      'Теперь у тебя ' +

      userWordsCount +

      ' слов из ' +

      totalInBank +

      '. В банке осталось ' +

      remaining +

      '.' +

      '</span>';

    toast(message, 'success', 'add_circle');

    playSound('sound/add.mp3');

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

      return;

    }

    isSubmittingWord = true;

    const submitBtn = document.getElementById('add-word-submit-btn');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loading-spinner" style="width:16px;height:16px;margin-right:8px"></span> Добавляем...';

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

        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
        isSubmittingWord = false;
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

        const { totalInBank, userWordsCount, remaining } =

          await window.WordBankDB.getRemainingWordsCount();

        const message =

          esc(en) +

          '<br><span style="opacity:0.8;font-size:0.85em">' +

          'Теперь у тебя ' +

          userWordsCount +

          ' слов из ' +

          totalInBank +

          '. В банке осталось ' +

          remaining +

          '.' +

          '</span>';

        toast(message, 'success', 'add_circle');

        playSound('sound/add.mp3');

        // Вместо закрытия просто сбрасываем форму для массового добавления
        resetAddForm();

        if (document.querySelector('.tab-pane.active')?.id !== 'tab-words')

          switchTab('words');

      } else {
        toast('Не удалось добавить слово. Попробуй ещё раз.', 'danger');
      }

    } catch (error) {

      console.error('Ошибка при добавлении слова:', error);

      toast('Ошибка добавления слова: ' + (error.message || 'Сервер не отвечает'), 'danger');

    } finally {

      isSubmittingWord = false;
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;

    }

  });

// Обработчик формы добавления идиомы в модальном окне

let isSubmittingIdiom = false;

document

  .getElementById('add-idiom-form')

  ?.addEventListener('submit', async e => {

    e.preventDefault();

    if (isSubmittingIdiom) {

      return;

    }

    isSubmittingIdiom = true;

    try {

      const idiom = document.getElementById('modal-idiom-en').value.trim();

      const meaning = document.getElementById('modal-idiom-ru').value.trim();

      const definition = document

        .getElementById('modal-idiom-definition')

        ?.value.trim();

      const example = document

        .getElementById('modal-idiom-example')

        ?.value.trim();

      const exampleTranslation = document

        .getElementById('modal-idiom-example-translation')

        ?.value.trim();

      const tags = document.getElementById('modal-idiom-tags').value.trim();

      // Используем данные автозаполнения, если они есть

      const audio = lastFetchedIdiomData?.audio || null;

      const examplesAudio = lastFetchedIdiomData?.examplesAudio || [];

      const phonetic = lastFetchedIdiomData?.phonetic || '';

      const success = await addIdiom(

        idiom,

        meaning,

        definition,

        example,

        phonetic,

        tags,

        audio,

        examplesAudio,

        exampleTranslation,

      );

      if (success) {

        const allIdioms = await window.IdiomBankDB.getAllIdioms();

        const remaining = allIdioms.length - window.idioms.length;

        toast(

          `"${esc(idiom)}" добавлено!<br><span style="opacity:0.8;font-size:0.85em">Ещё ${remaining} идиом в банке</span>`,

          'success',

          'add_circle',

        );

        playSound('sound/add.mp3');

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

// Обработчик формы добавления истории в модальном окне

let isSubmittingStory = false;

document
  .getElementById('add-story-form')
  ?.addEventListener('submit', async e => {
    e.preventDefault();
    if (isSubmittingStory) {
      return;
    }
    isSubmittingStory = true;
    try {
      const title = document.getElementById('modal-story-title').value.trim();
      const text = document.getElementById('modal-story-text').value.trim();
      const translation = document.getElementById('modal-story-translation').value.trim();
      const tags = document.getElementById('modal-story-tags').value.trim();
      const isScheduled = document.getElementById('modal-story-scheduled').checked;

      const storyId = Date.now().toString();

      // Вычисляем время публикации
      let publishTime;
      if (isScheduled) {
        // Следующее 0:00 UTC
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        tomorrow.setUTCHours(0, 0, 0, 0);
        publishTime = tomorrow.toISOString();
      } else {
        publishTime = new Date().toISOString();
      }

      const story = {
        id: storyId,
        title,
        text,
        translation,
        tags: tags ? tags.split(',').map(t => t.trim()) : [],
        createdAt: publishTime,
        scheduled: isScheduled,
        level: 'learning'
      };

      await window.StoryBankDB.saveStoriesBatch([story]);

      toast(
        `"${esc(title)}" добавлено!`,
        'success',
        'add_circle',
      );
      playSound('sound/add.mp3');
      closeAddStoryModal();

      // Рендерим добавленную историю
      renderStories();

      if (document.querySelector('.tab-pane.active')?.id !== 'tab-stories')
        switchTab('stories');

    } catch (error) {
      console.error('Ошибка при добавлении истории:', error);
      toast('Ошибка добавления истории', 'danger');
    } finally {
      isSubmittingStory = false;
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

const showSuggestions = debounce(async query => {

  const container = document.getElementById('autocomplete-suggestions');

  if (!query || query.length < 1) {

    container.style.display = 'none';

    return;

  }

  const results = await window.WordAPI.searchWords(query, 15);

  if (!results.length) {

    container.style.display = 'none';

    return;

  }

  // Формируем HTML

  container.innerHTML = results

    .map(

      (c, idx) => `

    <div class="suggestion-item" data-index="${idx}" data-word="${encodeURIComponent(JSON.stringify(c))}">

      <strong>${esc(c.en)}</strong> 

      <span style="color: var(--muted); font-size: 0.8rem;">${c.ru}</span>

      ${c.tags?.slice(0, 2).length ? `<span style="color: var(--primary); font-size: 0.7rem;"> (${c.tags.slice(0, 2).join(' · ')})</span>` : ''}

    </div>

  `,

    )

    .join('');

  container.style.display = 'block';

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

const showRussianSuggestions = debounce(async query => {

  const container = document.getElementById('ru-autocomplete-suggestions');

  if (!query || query.length < 1) {

    container.style.display = 'none';

    return;

  }

  const results = await window.WordAPI.searchRussian(query, 15);

  if (!results.length) {

    container.style.display = 'none';

    return;

  }

  container.innerHTML = results

    .map(

      (c, idx) => `

    <div class="suggestion-item" data-index="${idx}" data-word="${encodeURIComponent(JSON.stringify(c))}">

      <strong>${esc(c.en)}</strong> 

      <span style="color: var(--muted); font-size: 0.8rem;">${c.ru}</span>

      ${c.tags?.slice(0, 2).length ? `<span style="color: var(--primary); font-size: 0.7rem;"> (${c.tags.slice(0, 2).join(' · ')})</span>` : ''}

    </div>

  `,

    )

    .join('');

  container.style.display = 'block';

  selectedRuSuggestionIndex = -1;

}, 200);

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

const showIdiomSuggestions = debounce(async query => {

  if (!query || query.length < 2) {

    idiomSuggestionsContainer.style.display = 'none';

    return;

  }

  const lowerQuery = query.toLowerCase();

  // Ищем в банке идиом через IdiomAPI

  const bankIdioms = await window.IdiomAPI.searchIdioms(lowerQuery, 15);

  const candidates = bankIdioms.map(item => ({

    idiom: item.idiom,

    meaning: item.meaning,

    definition: item.definition,

    example: item.example || item.examples?.[0]?.text || '',

    exampleTranslation:

      item.exampleTranslation ||

      item.exampletranslation ||

      item.example_translation ||

      item.examples?.[0]?.translation ||

      '',

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

  // Заполнение полей формы ИДИОМ из объекта данных

  function fillIdiomFormWithData(data) {

    const ruInput = document.getElementById('modal-idiom-ru');

    const definitionInput = document.getElementById('modal-idiom-definition');

    const exampleInput = document.getElementById('modal-idiom-example');

    const exampleTransInput = document.getElementById(

      'modal-idiom-example-translation',

    );

    const tagsInput = document.getElementById('modal-idiom-tags');

    // Сбрасываем классы auto-filled у всех полей

    [

      ruInput,

      definitionInput,

      exampleInput,

      exampleTransInput,

      tagsInput,

    ].forEach(input => {

      if (input) input.classList.remove('auto-filled');

    });

    let filledFields = 0;

    if (data.meaning && data.meaning.trim()) {

      ruInput.value = data.meaning;

      ruInput.classList.add('auto-filled');

      filledFields++;

    }

    if (data.definition && data.definition.trim()) {

      definitionInput.value = data.definition;

      definitionInput.classList.add('auto-filled');

      filledFields++;

    }

    if (data.example && data.example.trim()) {

      exampleInput.value = data.example;

      exampleInput.classList.add('auto-filled');

      filledFields++;

    }

    if (data.example_translation && data.example_translation.trim()) {

      exampleTransInput.value = data.example_translation;

      exampleTransInput.classList.add('auto-filled');

      filledFields++;

    }

    if (data.tags && data.tags.length > 0) {

      tagsInput.value = data.tags.join(', ');

      tagsInput.classList.add('auto-filled');

      filledFields++;

    }

    return filledFields;

  }

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

function showPreview(fileParsed, importedWords, dupes) {

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

      // Отмечаем дубликаты

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

  if (btn) {

    const newCount = fileParsed.filter(

      w => !window.words.find(x => x.en.toLowerCase() === w.en.toLowerCase()),

    ).length;

    // Показываем детальную информацию о первых словах

    btn.textContent = `✓ Импортировать ${newCount} новых слов${fileParsed.length - newCount > 0 ? ' (' + (fileParsed.length - newCount) + ' дублей пропустим)' : ''}`;

    // Назначаем обработчик прямо здесь

    btn.onclick = function () {

      const checkboxes = document.querySelectorAll('.fchk:checked');

      const indices = Array.from(checkboxes).map(cb => parseInt(cb.dataset.i));

      let added = 0;

      indices.forEach(i => {

        const w = fileParsed[i];

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

        } else {

          // Пропускаем дубликат

        }

      });

      // Обновляем счетчики слов в профиле

      markProfileDirty('total_words', window.words.length);

      markProfileDirty(

        'learned_words',

        window.words.filter(w => w.stats?.learned).length,

      );

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

    };

  } else {

    console.error('❌ Import button not found!');

  }

}

// Функции getVoice и speakText перенесены в js/utils.js

// Инициализация голосов при загрузке

if (

  'speechSynthesis' in window &&

  window.speechSynthesis.onvoiceschanged !== undefined

) {

  window.speechSynthesis.onvoiceschanged = () => {

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
    document.body.classList.add('settings-modal-active'); // Скрываем хедер и меню

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

    // Load bank word level setting

    document.getElementById('bank-word-level-select').value =

      window.user_settings?.bankWordLevel || 'all';

  });

// Обработчик кнопки тура

document

  .getElementById('dropdown-start-tour')

  ?.addEventListener('click', () => {

    document.getElementById('user-dropdown').style.display = 'none';

    window.startTour();

  });

// Обработчик переключения темы
document
  .getElementById('dropdown-theme-toggle')
  ?.addEventListener('click', () => {
    const isDark = document.documentElement.classList.contains('dark');
    const baseTheme = window.user_settings?.baseTheme || 'lavender';
    const newDark = !isDark;
    window.applyTheme(baseTheme, newDark);
    window.user_settings.dark = newDark;
    window.user_settings._themeManuallySet = true;
    if (window.currentUserId) {
      markProfileDirty('usersettings', window.user_settings);
    }
    document.getElementById('user-dropdown').style.display = 'none';
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

        // Удалено: сохраняем в IndexedDB через кеш

        window.words = serverWords;

        renderStats();

        // Синхронизация завершена

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

// ===== СМЕНА ПАРОЛЯ =====

// Используем делегирование событий, так как кнопка может быть в скрытом контейнере

document.addEventListener('click', e => {

  const changePasswordBtn = e.target.closest('#change-password-btn, #change-password-btn-settings');

  if (changePasswordBtn) {

    const changePasswordModal = document.getElementById(

      'change-password-modal',

    );

    if (changePasswordModal) {

      changePasswordModal.classList.add('open');

      document.body.classList.add('modal-open');

    } else {

      // Модалка смены пароля не найдена

    }

  }

  // Обработчики закрытия модалки

  const closeBtn = e.target.closest(

    '#change-password-modal-close, #change-password-cancel',

  );

  if (closeBtn) {

    const modal = document.getElementById('change-password-modal');

    modal?.classList.remove('open');

    document.body.classList.remove('modal-open');

  }

  // Закрытие по клику на фон

  if (e.target.id === 'change-password-modal') {

    e.target.classList.remove('open');

    document.body.classList.remove('modal-open');

  }

  // Глазики для паролей

  const passwordToggle = e.target.closest('.password-toggle');

  if (passwordToggle) {

    const inputId = passwordToggle.id.replace('-toggle', '');

    const passwordInput = document.getElementById(inputId);

    if (passwordInput) {

      const type =

        passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';

      passwordInput.setAttribute('type', type);

      // Меняем иконку

      const icon = passwordToggle.querySelector('.material-symbols-outlined');

      icon.textContent = type === 'password' ? 'visibility' : 'visibility_off';

    }

  }

});

// Обработчик кнопки "Сменить"

document.addEventListener('click', e => {

  const submitBtn = e.target.closest('#change-password-submit');

  if (submitBtn) {

    e.preventDefault();

    const currentPassword = document.getElementById('current-password').value;

    const newPassword = document.getElementById('new-password').value;

    const confirmPassword = document.getElementById(

      'confirm-new-password',

    ).value;

    if (!currentPassword || !newPassword || !confirmPassword) {

      toast('Заполните все поля', 'warning');

      return;

    }

    if (newPassword.length < 8) {

      toast('Пароль должен быть не менее 8 символов', 'warning');

      return;

    }

    if (newPassword !== confirmPassword) {

      toast('Пароли не совпадают', 'warning');

      return;

    }

    // Вызываем функцию смены пароля

    changePassword(currentPassword, newPassword);

  }

});

// Функция смены пароля

async function changePassword(currentPassword, newPassword) {

  try {

    const { error } = await supabase.auth.updateUser({

      password: newPassword,

    });

    if (error) throw error;

    toast('Пароль успешно изменён!', 'success');

    document.getElementById('change-password-modal').classList.remove('open');

    document.getElementById('change-password-form').reset();

    // Опционально: выйти из всех устройств

    // await supabase.auth.signOut();

  } catch (err) {

    console.error(err);

    toast(

      'Ошибка смены пароля: ' +

        (err.message || err.toString() || 'неизвестная'),

      'danger',

    );

  }

}

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

    const bankWordLevel = document.getElementById(

      'bank-word-level-select',

    ).value;

    const currentDark = document.documentElement.classList.contains('dark');
    window.user_settings.dark = currentDark;

    // 2. Обновляем глобальный объект настроек

    window.user_settings = window.user_settings || {};

    window.user_settings.voice = newVoice;

    window.user_settings.reviewLimit =

      newLimit === '9999' ? 9999 : parseInt(newLimit, 10);

    window.user_settings.baseTheme = newTheme;

    window.user_settings.showPhonetic = showPhonetic;

    window.user_settings.bankWordLevel = bankWordLevel;

    // Ставим флаг, что пользователь явно выбрал уровень

    window.user_settings.bankWordLevelExplicit = true;

    // dark не трогаем — он остаётся как был

    // 3. Применяем тему

    window.applyTheme(newTheme, currentDark);

    // 4. Сохраняем настройки через markProfileDirty

    if (window.currentUserId) {

      markProfileDirty('usersettings', window.user_settings);

    }

    // 5. Сохраняем все настройки в localStorage для быстрой загрузки

    const saved = JSON.parse(localStorage.getItem('englift_user_settings') || '{}');

    saved.voice = newVoice;

    saved.reviewLimit = newLimit === '9999' ? 9999 : parseInt(newLimit, 10);

    saved.baseTheme = newTheme;

    saved.showPhonetic = showPhonetic;

    saved.bankWordLevel = bankWordLevel;

    saved.dark = currentDark;

    saved._themeManuallySet = true;

    localStorage.setItem('englift_user_settings', JSON.stringify(saved));

    // 5. Обновляем интерфейс, чтобы отобразить новый лимит

    refreshUI();

    // Обновляем рекомендуемое слово после смены уровня

    currentBankWord = null; // сбрасываем текущее слово

    shownBankWordEn.clear(); // очищаем список показанных слов

    renderRandomBankWord();

    // 6. Закрываем модалку и показываем тост

    document.getElementById('speech-modal').classList.remove('open');
    document.body.classList.remove('modal-open');
    document.body.classList.remove('settings-modal-active'); // Показываем хедер и меню

    window.toast?.('Настройки сохранены!', 'success');

  });

}

// Кнопка закрытия удалена из HTML

document.getElementById('speech-modal-close').addEventListener('click', () => {
  document.getElementById('speech-modal').classList.remove('open');
  document.body.classList.remove('modal-open'); // Возвращаем скролл
  document.body.classList.remove('settings-modal-active'); // Показываем хедер и меню
});

document.getElementById('speech-modal').addEventListener('click', e => {

  if (e.target === e.currentTarget) {

    document.getElementById('speech-modal').classList.remove('open');
    document.body.classList.remove('modal-open'); // Возвращаем скролл
    document.body.classList.remove('settings-modal-active'); // Показываем хедер и меню

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
  document.body.classList.add('modal-open');
  document.body.classList.add('settings-modal-active'); // Блокируем скролл

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

    'Вы уверены, что хотите удалить ВСЕ слова, идиомы и фразы? Это действие нельзя отменить. Ваш уровень, XP, серия и бейджи сохранятся.',

    'стереть',

    'стереть',

    async () => {

      try {

        // 1. Очищаем локальные слова и идиомы

        window.words = [];

        window.idioms = [];

        // Удалено: очистка localStorage - делается в clearUserData

        renderCache.clear();

        // 2. Удаляем слова с сервера

        if (window.currentUserId) {

          const { error, count } = await supabase

            .from('user_words')

            .delete({ count: 'exact' })

            .eq('user_id', window.currentUserId);

          if (error) console.error('❌ Ошибка удаления слов с сервера:', error);

        }

        // 3. Удаляем идиомы с сервера

        if (window.currentUserId) {

          const { error, count } = await supabase

            .from('user_idioms')

            .delete({ count: 'exact' })

            .eq('user_id', window.currentUserId);

          if (error)

            console.error('❌ Ошибка удаления идиом с сервера:', error);

        }

        // 4. Очищаем IndexedDB

        await clearLocalWordCache();

        // 5. Очищаем очереди синхронизации

        pendingWordUpdates.clear();

        pendingIdiomUpdates.clear();

        // 5. Обновляем интерфейс

        refreshUI();

        renderIdioms(); // обновляем список идиом

        updateIdiomsCount(); // обновляем счётчик

        // Обновляем счётчики в профиле

        markProfileDirty('total_words', 0);

        markProfileDirty('total_idioms', 0);

        markProfileDirty('learned_words', 0);

        toast('✅ Весь словарь (слова + идиомы + фразы) очищен!', 'success');

      } catch (error) {

        console.error('❌ Ошибка при стирании:', error);

        toast('Ошибка при очистке словаря', 'danger');

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

              Authorization: `Bearer ${session.access_token}`, // явно передаём токен

            },

          },

        );

        if (error) throw error;

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

        // 1. Удаляем все слова с сервера

        if (window.currentUserId) {

          const { error: wordsError, count } = await supabase

            .from('user_words')

            .delete({ count: 'exact' })

            .eq('user_id', window.currentUserId);

          if (wordsError) throw wordsError;

        }

        // 1.5. Удаляем все идиомы с сервера

        if (window.currentUserId) {

          const { error: idiomsError, count: idiomsCount } = await supabase

            .from('user_idioms')

            .delete({ count: 'exact' })

            .eq('user_id', window.currentUserId);

          if (idiomsError) throw idiomsError;

        }

        // 2. Сбрасываем профиль на сервере (сохраняем настройки)

        if (window.currentUserId) {

          const today = window.getLocalDate();

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

        }

        // 3. Очищаем локальные данные

        window.words = [];

        window.idioms = [];

        weeklyReviewHistory = []; // Очищаем историю повторений

        weeklyReviewDetail = []; // Очищаем детализацию повторений

        const historyKey = `englift_weekly_review_${window.currentUserId}`;
        const detailKey = `englift_weekly_review_detail_${window.currentUserId}`;
        localStorage.removeItem(historyKey); // Удаляем из localStorage

        localStorage.removeItem(detailKey); // Удаляем детализацию из localStorage

        // Удалено: очистка localStorage - делается в clearUserData

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

          lastReset: window.getLocalDate(),

        };

        // 4. Очищаем IndexedDB

        await clearLocalWordCache();

        // 5. Обновляем списки если они открыты

        loadLeaderboard?.('week');

        loadFriendActivity?.();

        // Сохраняем все поля профиля после сброса

        markProfileDirty('xp', 0);

        markProfileDirty('level', 1);

        markProfileDirty('badges', []);

        markProfileDirty('streak', 0);

        markProfileDirty('laststreakdate', null);

        markProfileDirty('dailyprogress', window.dailyProgress);

        markProfileDirty('dailyreviewcount', 0);

        markProfileDirty('lastreviewreset', window.lastReviewResetDate);

        markProfileDirty('total_words', 0);

        markProfileDirty('total_idioms', 0);

        markProfileDirty('learned_words', 0);

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

  window.isSessionActive = false;

  document.body.classList.remove('exercise-active'); // ← добавлено

  sResults = { correct: [], wrong: [] };

  sIdx = 0;

  window.session = null;

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

    // Если это глагольный режим, сохраняем фильтр

    if (practiceMode === 'verbs') {

      verbActiveFilter = c.dataset.filterW;

    }

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

  // Проверяем, нет ли уже активной сессии

  if (window.session) {

    return;

  }

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

    document

      .querySelectorAll('.chip[data-mode]')

      .forEach(x => x.classList.remove('on'));

    c.classList.add('on');

    practiceMode = c.dataset.mode;

    // Reset exercise selections for previous mode

    selectedWordExercises.length = 0;

    selectedIdiomExercises.length = 0;

    // Reset session when switching modes

    window.session = null;

    window.isSessionActive = false;

    document.body.classList.remove('exercise-active');

    const startBtn = document.getElementById('start-btn');

    if (startBtn) {

      startBtn.disabled = false;

      startBtn.innerHTML =

        '<span class="material-symbols-outlined">rocket_launch</span> Начать';

    }

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

        <div class="exercise-card" data-ex="flash">

          <div class="exercise-icon"><span class="material-symbols-outlined">style</span></div>

          <div class="exercise-name">Карточки</div>

          <div class="exercise-desc">Переворачивай и запоминай</div>

        </div>

        <div class="exercise-card" data-ex="multi" data-field="meaning">

          <div class="exercise-icon"><span class="material-symbols-outlined">translate</span></div>

          <div class="exercise-name">Выбор</div>

          <div class="exercise-desc">Найди правильный вариант</div>

        </div>

        <div class="exercise-card" data-ex="type">

          <div class="exercise-icon"><span class="material-symbols-outlined">keyboard</span></div>

          <div class="exercise-name">Напиши</div>

          <div class="exercise-desc">Введи перевод идиомы</div>

        </div>

        <div class="exercise-card" data-ex="idiom-builder">

          <div class="exercise-icon"><span class="material-symbols-outlined">construction</span></div>

          <div class="exercise-name">Собери</div>

          <div class="exercise-desc">Составь идиому из слов</div>

        </div>

        <div class="exercise-card" data-ex="context" data-field="example">

          <div class="exercise-icon"><span class="material-symbols-outlined">psychology</span></div>

          <div class="exercise-name">Контекст</div>

          <div class="exercise-desc">Пойми идиому по смыслу</div>

        </div>

        <div class="exercise-card" data-ex="multi" data-field="definition">

          <div class="exercise-icon"><span class="material-symbols-outlined">menu_book</span></div>

          <div class="exercise-name">Определение</div>

          <div class="exercise-desc">Выбери верное определение</div>

        </div>

        <div class="exercise-card" data-ex="match">

          <div class="exercise-icon"><span class="material-symbols-outlined">extension</span></div>

          <div class="exercise-name">Пары</div>

          <div class="exercise-desc">Соедини идиому и смысл</div>

        </div>

      `;

      // Меняем заголовок фильтра

      const filterLabel = filterRow?.querySelector('label');

      if (filterLabel)

        filterLabel.innerHTML =

          '<span class="material-symbols-outlined" style="vertical-align: middle; margin-right: 8px">filter_alt</span>Идиомы для практики';

      // Обновляем бейдж "К повторению" для идиом

      updateDueBadge();

      // Показываем чипы для слов/идиом

      document.getElementById('filter-chips-words').style.display = '';

      document.getElementById('filter-chips-verbs').style.display = 'none';

    } else if (practiceMode === 'verbs') {

      // Сетка упражнений для глаголов

      exerciseGrid.innerHTML = `

        <div class="exercise-card" data-ex="flash">

          <div class="exercise-icon"><span class="material-symbols-outlined">style</span></div>

          <div class="exercise-name">Карточки</div>

          <div class="exercise-desc">Переворачивай и запоминай</div>

        </div>

        <div class="exercise-card" data-ex="type">

          <div class="exercise-icon"><span class="material-symbols-outlined">keyboard</span></div>

          <div class="exercise-name">Напиши</div>

          <div class="exercise-desc">Введи три формы глагола</div>

        </div>

      `;

      // Очищаем selected и устанавливаем согласно selectedVerbExercises

      document.querySelectorAll('.exercise-card').forEach(c => c.classList.remove('selected'));

      selectedVerbExercises.forEach(ex => {

        document.querySelector(`.exercise-card[data-ex="${ex}"]`)?.classList.add('selected');

      });

      // Настройка строки фильтра

      const label = filterRow?.querySelector('label');

      if (label) label.innerHTML = '<span class="material-symbols-outlined" style="vertical-align: middle; margin-right: 8px">filter_alt</span>Глаголы для практики';

      // Показываем чипы для глаголов

      document.getElementById('filter-chips-words').style.display = 'none';

      document.getElementById('filter-chips-verbs').style.display = '';

      // Устанавливаем активный чип в соответствии с сохранённым фильтром

      const verbChips = document.querySelectorAll('#filter-chips-verbs .chip');

      verbChips.forEach(chip => {

        chip.classList.toggle('on', chip.dataset.filterW === verbActiveFilter);

      });

      // Скрываем строку направления (для глаголов не нужна)

      if (directionRow) directionRow.style.display = 'none';

      // Убираем классы других режимов

      document.body.classList.remove('practice-idioms');

      document.body.classList.add('practice-verbs');

    } else {

      // Восстанавливаем сетку для слов

      exerciseGrid.innerHTML = `

        <div class="exercise-card" data-ex="flash">

          <div class="exercise-icon"><span class="material-symbols-outlined">style</span></div>

          <div class="exercise-name">Карточки</div>

          <div class="exercise-desc">Переворачивай и запоминай</div>

        </div>

        <div class="exercise-card" data-ex="multi">

          <div class="exercise-icon"><span class="material-symbols-outlined">quiz</span></div>

          <div class="exercise-name">Выбор</div>

          <div class="exercise-desc">Найди правильный вариант</div>

        </div>

        <div class="exercise-card" data-ex="builder">

          <div class="exercise-icon"><span class="material-symbols-outlined">construction</span></div>

          <div class="exercise-name">Собери</div>

          <div class="exercise-desc">Составь слово из букв</div>

        </div>

        <div class="exercise-card" data-ex="match">

          <div class="exercise-icon"><span class="material-symbols-outlined">extension</span></div>

          <div class="exercise-name">Пары</div>

          <div class="exercise-desc">Соедини слово и перевод</div>

        </div>

        <div class="exercise-card" data-ex="type">

          <div class="exercise-icon"><span class="material-symbols-outlined">keyboard</span></div>

          <div class="exercise-name">Напиши</div>

          <div class="exercise-desc">Введи перевод слова</div>

        </div>

        <div class="exercise-card" data-ex="dictation">

          <div class="exercise-icon"><span class="material-symbols-outlined">headphones</span></div>

          <div class="exercise-name">Диктант</div>

          <div class="exercise-desc">Напиши, что слышишь</div>

        </div>

      `;

      const filterLabel = filterRow?.querySelector('label');

      if (filterLabel)

        filterLabel.innerHTML =

          '<span class="material-symbols-outlined" style="vertical-align: middle; margin-right: 8px">filter_alt</span>Слова для практики';

      // Показываем чипы для слов

      document.getElementById('filter-chips-words').style.display = '';

      document.getElementById('filter-chips-verbs').style.display = 'none';

      // Обновляем бейдж "К повторению" для слов

      updateDueBadge();

      // Восстанавливаем строку направления

      if (directionRow) directionRow.style.display = '';

      // Чипы фильтра управляются через отдельные контейнеры, не нужно восстанавливать inline

    }

    if (practiceMode !== 'idioms') {

      // Убираем класс practice-idioms

      document.body.classList.remove('practice-idioms');

    }

    if (practiceMode !== 'verbs') {

      // Убираем класс practice-verbs

      document.body.classList.remove('practice-verbs');

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

    // Обновляем summary в bottom sheet при переключении режима

    setTimeout(() => {

      const summary = document.getElementById('bs-trigger-summary');

      if (summary) {

        // Вызываем функцию обновления summary из bottom sheet

        if (typeof window.updateSummary === 'function') {

          window.updateSummary();

        }

      }

    }, 50);

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

    let message = `${pluralize(total, 'слово', 'слова', 'слов')} • `;

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

  const mode = practiceMode; // 'normal', 'idioms' или 'verbs'

  const selectedArray =

    mode === 'idioms'

      ? selectedIdiomExercises

      : mode === 'verbs'

          ? selectedVerbExercises

          : selectedWordExercises;

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

  // Добавляем звук клика

  playSound('sound/click.mp3', 0.3);

  const selectedArray =

    mode === 'idioms'

      ? selectedIdiomExercises

      : mode === 'verbs'

          ? selectedVerbExercises

          : selectedWordExercises;

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

  document.body.classList.remove('exercise-active'); // ← добавлено

  sResults = window.session.results;

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

  // Защита от повторного запуска сессии

  if (window.isSessionActive === true) {

    return;

  }

  // Проверяем, выбрано ли хотя бы одно упражнение

  const selectedArray =

    practiceMode === 'idioms'

      ? selectedIdiomExercises

      : practiceMode === 'verbs'

          ? selectedVerbExercises

          : selectedWordExercises;

  if (selectedArray.length === 0) {

    toast('Выберите хотя бы одно упражнение!', 'warning');

    // Разблокируем кнопку

    const startBtn = document.getElementById('start-btn');

    if (startBtn) {

      startBtn.disabled = false;

      startBtn.innerHTML =

        '<span class="material-symbols-outlined">rocket_launch</span> Начать';

    }

    return;

  }

  window.isSessionActive = true;

  document.body.classList.add('exercise-active'); // ← добавлено

  // Добавляем обработчик ошибок для всей функции

  try {

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

        document.querySelector('.chip[data-count].on')?.dataset.count || '10';

      // Определяем контейнер фильтров в зависимости от режима

      let filterContainer;

      if (practiceMode === 'verbs') {

        filterContainer = document.getElementById('filter-chips-verbs');

      } else {

        filterContainer = document.getElementById('filter-chips-words');

      }

      const activeFilterChip = filterContainer?.querySelector('.chip.on');

      filterVal = activeFilterChip?.dataset.filterW || 'all';

    }

    // 2. Формируем пул данных (слова, идиомы или фразы)

    // Определяем источник данных (слова, идиомы или фразы)

    let dataSource =

      practiceMode === 'idioms'

        ? window.idioms

        : practiceMode === 'verbs'

            ? window.verbs

            : window.words;

    let pool = [...dataSource];

    if (practiceMode === 'idioms') {

      // Для идиом используем упрощенную фильтрацию

      if (filterVal === 'learning')

        pool = pool.filter(item => !item.stats?.learned);

      if (filterVal === 'due') {

        pool = getCardsToReview(pool); // передаем массив

      }

    } else if (practiceMode === 'verbs') {

      // Фильтр по группе (all/often)

      if (filterVal === 'often') {

        pool = pool.filter(v => v.group === 'often');

      } else if (filterVal === 'all') {

        pool = pool.filter(v => v.group === 'all');

      }

    } else {

      // Для слов сохраняем текущую логику

      if (filterVal === 'learning') pool = pool.filter(w => !w.stats.learned);

      if (filterVal === 'due') {

        pool = getCardsToReview(); // Use capped function
      }

    }

    // Перемешиваем для всех фильтров, кроме 'due'

    if (filterVal !== 'due') {

        pool = shuffleArray(pool);

    }

    if (!pool.length) {

      const itemType =

        practiceMode === 'idioms'

          ? 'идиом'

          : practiceMode === 'verbs'

              ? 'глаголов'

              : 'слов';

      toast(`Нет ${itemType} для практики`, 'warning');

      // Сбрасываем флаг активной сессии

      window.isSessionActive = false;

      document.body.classList.remove('exercise-active'); // ← добавлено

      return false; // Возвращаем false для обработки в repeat-btn

    }

    // ── CUSTOM POOL (напр. повтор ошибок) ────────────────────────

    if (cfg && cfg.customPool && cfg.customPool.length > 0) {

      pool = [...cfg.customPool];

    }

    const totalCount =

      countVal === 'all'

        ? pool.length

        : Math.min(parseInt(countVal), pool.length);

    // ─────────────────────────────────────────────────────────────

    // === НОВЫЙ БЛОК: ПРОВЕРКА ЛИМИТА ===

    if (!canStartSession(totalCount)) {

      // Лимит исчерпан – выходим, не запуская сессию

      window.isSessionActive = false;

      document.body.classList.remove('exercise-active'); // ← добавлено

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

      // Экзамен - используем фиксированный набор типов

      const types = ['multi', 'type', 'builder', 'speech'];

      const dirVal =

        document.querySelector('.chip[data-dir].on')?.dataset.dir || 'both';

      // Создаем сессию для экзамена

      window.session = {

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

      const practiceEx = document.getElementById('practice-ex');

      practiceEx.style.display = 'block';

      // Прокручиваем наверх при старте упражнения

      window.scrollTo({ top: 0, behavior: 'smooth' });

      nextExercise();

      return;

    }

    // 4. Обычный режим

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

    // Если выбран фильтр "Все" — никаких умных исключений

    const isAllFilter = filterVal === 'all';

    // ========== УМНАЯ ФИЛЬТРАЦИЯ ДЛЯ МОНО-СЕССИЙ ==========

    // Если выбран только один тип упражнения, исключаем слова, у которых этот тип уже засчитан

    if (exTypes.length === 1 && !isAllFilter && filterVal !== 'due') {

      const currentEx = exTypes[0];

      const withoutCurrent = pool.filter(item => {

        const correct = item.stats?.correctExerciseTypes || [];

        return !correct.includes(currentEx);

      });

      if (withoutCurrent.length > 0) {

        pool = withoutCurrent;

      }

    }

    // ========== АДАПТИВНОЕ ИСКЛЮЧЕНИЕ (для всех, кроме due, stale) ==========

    let freshPool = pool;

    if (filterVal !== 'due') {

        freshPool = pool.filter(item => {

            // Для глаголов – исключаем только показанные в этой сессии

            if (practiceMode === 'verbs') {

                return !recentlyShownIds.includes(item.id);

            }

            // Для слов и идиом – исключаем, если уже засчитано 3+ типов упражнений

            const typesCount = item.stats?.correctExerciseTypes?.length || 0;

            if (typesCount < 3) return true;

            return !recentlyShownIds.includes(item.id);

        });



        // Если после фильтрации ничего не осталось – сбрасываем историю и пробуем снова

        if (freshPool.length === 0) {

            recentlyShownIds = [];

            freshPool = pool.filter(item => {

                if (practiceMode === 'verbs') {

                    return !recentlyShownIds.includes(item.id);

                }

                const typesCount = item.stats?.correctExerciseTypes?.length || 0;

                if (typesCount < 3) return true;

                return !recentlyShownIds.includes(item.id);

            });

        }



        // Используем freshPool, даже если его длина меньше totalCount

        pool = freshPool;

    }

    // ========== ПРИОРИТЕТ СЛОВАМ С 2 ТИПАМИ ==========

    if (!isAllFilter) {

      pool.sort((a, b) => {

        const aCount = a.stats?.correctExerciseTypes?.length || 0;

        const bCount = b.stats?.correctExerciseTypes?.length || 0;

        if (aCount === 2 && bCount !== 2) return -1;

        if (bCount === 2 && aCount !== 2) return 1;

        return 0;

      });

    }

    pool = shuffleArray(pool).slice(0, totalCount);

    // ========== ОБНОВЛЕНИЕ RECENTLY_SHOWN_IDS ==========

    pool.forEach(item => {

      recentlyShownIds = recentlyShownIds.filter(id => id !== item.id);

      recentlyShownIds.unshift(item.id);

    });

    const dirVal =

      document.querySelector('.chip[data-dir].on')?.dataset.dir || 'both';

    // Создаем сессию для обычного режима

    window.session = {

      items: pool, // вместо слов

      exTypes,

      dir: dirVal,

      mode: practiceMode, // 'normal' или 'idioms' или 'verbs'

      dataType:

        practiceMode === 'idioms'

          ? 'idioms'

          : practiceMode === 'verbs'

              ? 'verbs'

              : 'words',

    };

    // Сохраняем конфигурацию для повторной сессии

    lastSessionConfig = { countVal, filterVal, exTypes };

    // Показываем экран упражнения

    document.getElementById('practice-setup').style.display = 'none';

    const practiceEx = document.getElementById('practice-ex');

    practiceEx.style.display = 'block';

    // Прокручиваем наверх при старте упражнения

    window.scrollTo({ top: 0, behavior: 'smooth' });

    nextExercise();

    return true; // Возвращаем true при успешном запуске

  } catch (error) {

    console.error('Error in startSession:', error);

    // Сбрасываем флаг активной сессии при ошибке

    window.isSessionActive = false;

    document.body.classList.remove('exercise-active'); // ← добавлено

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

  // Сбрасываем ожидающие обновления челленджов в конце сессии

  flushChallengeUpdates();

  document.body.classList.remove('exercise-active'); // ← добавлено

  if (window.matchTimerCancel) {

    window.matchTimerCancel();

    window.matchTimerCancel = null;

  }

  window.isSessionActive = false;

  window.session = null;

  const startBtn = document.getElementById('start-btn');

  if (startBtn) {

    startBtn.disabled = false;

    startBtn.innerHTML =

      '<span class="material-symbols-outlined">rocket_launch</span> Начать';

  }

  const practiceEx = document.getElementById('practice-ex');

  practiceEx.style.display = 'none';

  practiceEx.classList.remove('keyboard-exercise'); // Очищаем класс

  const resultsContainer = document.getElementById('practice-results');

  if (resultsContainer) {

    resultsContainer.style.display = 'block';

  }

  // Очищаем содержимое упражнения

  const exContent = document.getElementById('ex-content');

  if (exContent) exContent.innerHTML = '';

  const exBtns = document.getElementById('ex-btns');

  if (exBtns) exBtns.innerHTML = '';

  // ── Подсчёт результатов ──────────────────────────────────────

  const resTotal = sResults.correct.length + sResults.wrong.length;

  const resCorrect = sResults.correct.length;

  const resPct = resTotal > 0 ? Math.round((resCorrect / resTotal) * 100) : 0;

  const isIdiom = practiceMode === 'idioms';

  // ── Время сессии ─────────────────────────────────────────────

  const practiceMs = practiceStartTime ? Date.now() - practiceStartTime : 0;

  const practiceSec = Math.round(practiceMs / 1000);

  const timeStr =

    practiceSec >= 60

      ? `${Math.floor(practiceSec / 60)} мин ${practiceSec % 60 > 0 ? (practiceSec % 60) + ' с' : ''}`

      : `${practiceSec} с`;

  // ── XP (считаем заранее для отображения) ─────────────────────

  const isPerfect = resTotal >= 5 && resCorrect === resTotal;

  const xpEarned = resCorrect * 3 + (isPerfect ? 10 : 0);

  // ── Мотивационное сообщение ───────────────────────────────────

  const motiv =

    resPct === 100

      ? {

          icon: 'emoji_events',

          color: '#16a34a',

          title: 'Легенда!',

          sub: 'Ты на пике формы!',

        }

      : resPct >= 80

        ? {

            icon: 'local_fire_department',

            color: '#fff',

            title: 'Супер результат!',

            sub: 'Ты на правильном пути!',

          }

        : resPct >= 60

          ? {

              icon: 'trending_up',

              color: '#fff',

              title: 'Солидно!',

              sub: 'Результат, которым можно гордиться!',

            }

          : resPct >= 40

            ? {

                icon: 'fitness_center',

                color: '#fff',

                title: 'Не сдавайся!',

                sub: 'Практика делает совершенным!',

              }

            : resPct > 0

              ? {

                  icon: 'spa',

                  color: '#fff',

                  title: 'Начало пути!',

                  sub: 'Все гении когда-то начинали!',

                }

              : {

                  icon: 'sentiment_very_dissatisfied',

                  color: '#fff',

                  title: 'Свежий старт!',

                  sub: 'Теперь ты знаешь, над чем работать!',

                };

  // ── Градиент героя по результату ─────────────────────────────

  const heroGrad =

    resPct === 100

      ? 'linear-gradient(135deg,#16a34a 0%,#22c55e 100%)'

      : resPct >= 80

        ? 'linear-gradient(135deg,#1d4ed8 0%,var(--primary) 100%)'

        : resPct >= 50

          ? 'linear-gradient(135deg,var(--primary) 0%,#6366f1 100%)'

          : resPct >= 25

            ? 'linear-gradient(135deg,#b45309 0%,#f59e0b 100%)'

            : 'linear-gradient(135deg,#b91c1c 0%,#ef4444 100%)';

  // ── Адаптивный размер шрифта для счета ─────────────────────

  const scoreFontSize =

    (String(resCorrect) + String(resTotal)).length > 4 ? '1.1rem' : '1.6rem';

  const scoreDisplay =

    resTotal > 20

      ? `${resPct}%` // много слов → только процент

      : `${resCorrect}/${resTotal}`; // мало → дробь как обычно

  // ── SVG кольцо ───────────────────────────────────────────────

  const r = 52,

    cx = 64,

    cy = 64;

  const circ = 2 * Math.PI * r;

  // ── Чипы ошибок ──────────────────────────────────────────────

  const wrongChips = sResults.wrong

    .map((item, i) => {

      let word, trans;

      if (isIdiom) {

        word = esc(item.idiom.toLowerCase());

        trans = esc(parseAnswerVariants(item.meaning).join(' / '));

      } else {

        word = esc(item.en);

        trans = esc(parseAnswerVariants(item.ru).join(' / '));

      }

      return `

      <div class="res-word-chip res-word-chip--wrong" style="animation-delay:${i * 0.045}s">

        <span class="res-chip-word">${word}</span>

        <span class="res-chip-arrow">→</span>

        <span class="res-chip-trans">${trans}</span>

      </div>`;

    })

    .join('');

  // ── Чипы правильных ──────────────────────────────────────────

  const correctChips = ''; // Убираем правильные ответы - они не нужны

  // ── Тип сессии ────────────────────────────────────────────────

  const sessionTypeLabel = isIdiom

    ? 'Идиомы'

    : window.session?.mode === 'exam'

        ? 'Экзамен'

        : 'Слова';

  // ── Блок ошибок / перфект ─────────────────────────────────────

  const wrongSection =

    sResults.wrong.length > 0

      ? `

    <div class="res-section">

      <div class="res-section-hdr">

        <span class="material-symbols-outlined" style="color:var(--danger)">cancel</span>

        <h4>Ошибки <span class="res-count-badge res-count-badge--wrong">${sResults.wrong.length}</span></h4>

      </div>

      <div class="res-chips-grid">${wrongChips}</div>

    </div>`

      : ''; // Убираем блок перфекта - заголовок уже говорит "Абсолютный перфект!"

  // ── Блок правильных (свёрнутый) ───────────────────────────────

  const correctSection = ''; // Убираем правильные ответы совсем

  // ── Кнопки действий ──────────────────────────────────────────

  const retryBtn = ''; // Убираем красную кнопку "Добить слабые"

  // ── Сборка HTML ───────────────────────────────────────

  const resultsCard = document.querySelector('.results-card');

  if (!resultsCard) {

    console.error('❌ resultsCard element not found!');

    return;

  }

  resultsCard.innerHTML = `

  <div class="res-content-wrapper ${resPct === 100 ? 'perfect-results' : ''}">

    <div class="res-hero">

      <div class="res-hero-inner">

        <div class="res-ring-wrap">

          <svg class="res-ring-svg" viewBox="0 0 128 128">

            <circle class="res-ring-bg" cx="64" cy="64" r="54" />

            <circle class="res-ring-fill" cx="64" cy="64" r="54" stroke-dasharray="0 339.29" id="ring-fill" />

          </svg>

          <div class="res-ring-inner">

            <div class="res-ring-score" style="font-size:${scoreFontSize}">${scoreDisplay}</div>

            ${resTotal <= 20 ? `<div class="res-ring-pct">${resPct}%</div>` : ''}

          </div>

        </div>

        <div class="res-hero-text">

          <div class="res-motiv-title">${motiv.title}</div>

          <div class="res-motiv-sub">${motiv.sub}</div>

        </div>

      </div>

    </div>

    <div class="res-stats-row">

      <div class="res-stat-chip res-stat-chip--time">

        <span class="material-symbols-outlined">schedule</span>

        ${timeStr}

      </div>

      <div class="res-stat-chip">

        <span class="material-symbols-outlined">${isIdiom ? 'theater_comedy' : 'menu_book'}</span>

        ${sessionTypeLabel} · ${resTotal}

      </div>

      ${

        xpEarned > 0

          ? `

        <div class="res-stat-chip res-stat-chip--xp">

          <span class="material-symbols-outlined">bolt</span>

          +${xpEarned} XP

        </div>

      `

          : ''

      }

      ${

        isPerfect

          ? `

        <div class="res-stat-chip res-stat-chip--perfect">

          <span class="material-symbols-outlined">emoji_events</span>

          Бонус +10 XP

        </div>

      `

          : ''

      }

    </div>

    ${wrongSection}

    <div class="res-actions">

      ${retryBtn}

      <button class="res-action-btn res-action-btn--repeat" id="repeat-btn">

        <span class="material-symbols-outlined" style="color: white !important;">refresh</span>

        Ещё раз

      </button>

      <button class="res-action-btn res-action-btn--setup" id="setup-btn">

        <span class="material-symbols-outlined">tune</span>

        Настройки

      </button>

    </div>

  </div>

`;

  // ── Анимируем кольцо после рендера ────────────────────────────

  const circumference = 2 * Math.PI * 58; // Увеличили радиус с 52 до 58

  const ringFill = document.getElementById('ring-fill');

  if (ringFill) {

    requestAnimationFrame(() => {

      const percent = resPct / 100;

      const dash = circumference * percent;

      ringFill.style.strokeDasharray = `${dash} ${circumference}`;

    });

  }

  // ── Свернуть/развернуть правильные ───────────────────────────

  // Удалено - правильные ответы больше не показываются

  // ── Кнопка «Добить слабые» ─────────────────────────────────

  // Удалено - красная кнопка больше не нужна

  // ── Кнопка «Ещё раз» ─────────────────────────────────────────

  document.getElementById('repeat-btn')?.addEventListener('click', () => {

    // Скрываем результаты всегда
    document.getElementById('practice-results').style.display = 'none';

    // Пробуем запустить сессию
    const sessionStarted = startSession(lastSessionConfig);
    
    // Если запуск не удался, показываем настройки
    if (!sessionStarted) {
      document.getElementById('practice-setup').style.display = 'block';
    }

  });

  // ── Кнопка «Настройки» ───────────────────────────────────────

  document.getElementById('setup-btn')?.addEventListener('click', () => {

    document.getElementById('practice-results').style.display = 'none';

    document.getElementById('practice-setup').style.display = 'block';

    // Скрываем результаты, если они были показаны
    const resultsContainer = document.getElementById('practice-results');
    if (resultsContainer) {
      resultsContainer.style.display = 'none';
    }

  });

  // ── Эффекты конфетти ────────────────────────────────────

  if (resPct >= 95) {

    triggerConfetti(); // ← звёздное шоу при 95%+

  } else if (resPct >= 81) {

    triggerGoodConfetti(); // ← хороший салют при 81-94%

  } else if (resPct >= 61) {

    triggerSmallConfetti(); // ← маленький салют при 61-80%

  } else if (resPct >= 41) {

    triggerLightRain(); // ← лёгкий дождик при 41-60%

  } else if (resPct >= 21) {

    triggerFewDrops(); // ← несколько капель при 21-40%

  } else {

    triggerSadRain(); // ← грустный дождь при 0-20%

  }

  // ── XP, серия, бейджи ─────────────────────────────────────────

  const xpCorrect = resCorrect;

  const xpTotal = resTotal;

  if (xpCorrect > 0)

    gainXP(

      xpCorrect * 1,

      `${pluralize(xpCorrect, 'слово', 'слова', 'слов')} <span class="material-symbols-outlined" style="vertical-align:middle;font-size:16px">check_circle</span>`,

    );

  if (isPerfect)

    gainXP(

      10,

      `<span class="material-symbols-outlined" style="vertical-align:middle;font-size:16px">target</span> Перфект!`,

    );

  // ── Время практики в dailyProgress ───────────────────────────

  if (practiceStartTime) {

    const practiceSeconds = Math.round(

      (Date.now() - practiceStartTime) / 1000,

    );

    window.dailyProgress.practice_time =

      (window.dailyProgress.practice_time || 0) + practiceSeconds;

    markProfileDirty('dailyprogress', window.dailyProgress);

    window.lastProfileUpdate = Date.now();

    checkDailyGoalsCompletion();

    // Обновляем челленджи practice_time так же как daily progress (в минутах с дробной частью) (ЗАКОММЕНТИРОВАНО)
    /*
    if (window.currentUserId && window.updateAllChallengesProgress) {
      const sessionMinutes = practiceSeconds / 60;
      if (sessionMinutes > 0) {
        window.updateAllChallengesProgress(
          window.currentUserId,
          'practice_time',
          sessionMinutes,
        );
      }
    }
    */

  }

  // ── XP, серия, бейджи ─────────────────────────────────────────

  updStreak();

  checkBadges(isPerfect);

  practiceStartTime = null;

  // ===== ОБНОВЛЕНИЕ СТАТИСТИКИ БЕЙДЖЕЙ =====

  // 1. Лучшая точность

  if (resPct > window.bestAccuracy) {

    window.bestAccuracy = resPct;

    markProfileDirty('best_accuracy', window.bestAccuracy);

  }

  // 2. Идеальные сессии (минимум 5 вопросов)

  if (resPct === 100 && resTotal >= 5) {

    window.perfectSessions = (window.perfectSessions || 0) + 1;

    markProfileDirty('perfect_sessions', window.perfectSessions);

  }

  // 3. Уникальные типы упражнений

  const exTypes = window.session?.exTypes || [];

  exTypes.forEach(type => {

    if (!window._exercisesTriedSet.has(type)) {

      window._exercisesTriedSet.add(type);

      window.exercisesTried = window._exercisesTriedSet.size;

      markProfileDirty('exercises_tried', window.exercisesTried);

    }

  });

  // 4. Лучшая скорость (секунд на вопрос)

  const avgSpeed = resTotal > 0 ? practiceMs / resTotal / 1000 : Infinity;

  if (avgSpeed < window.bestSpeed) {

    window.bestSpeed = avgSpeed;

    markProfileDirty('best_speed', window.bestSpeed);

  }

  // 5. Всего сессий

  window.totalSessions = (window.totalSessions || 0) + 1;

  markProfileDirty('total_sessions', window.totalSessions);

  refreshUI();

}

// Функция для сброса практики к начальному состоянию

function resetPracticeToStart() {

  const exerciseScreen = document.getElementById('practice-ex');

  const startScreen = document.getElementById('practice-setup');

  const resultsContainer = document.getElementById('practice-results');

  if (exerciseScreen) {

    exerciseScreen.style.display = 'none';

    exerciseScreen.classList.remove('keyboard-exercise');

  }

  if (startScreen) {

    startScreen.style.display = '';

  }

  if (resultsContainer) {

    resultsContainer.style.display = 'none';

  }

  cleanupExercise();

}

function cleanupExercise() {

  exerciseAudioToken++;

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

  if (window.speechSynthesis) {

    try {

      window.speechSynthesis.cancel();

    } catch (e) {}

  }

  stopCurrentMediaAudio();

  window._matchTimerCancel?.();

  window._matchTimerCancel = null;

  // Убираем DOM-таймер если остался

  document.getElementById('exercise-timer')?.remove();

}

function nextExercise() {

  hideFeedbackSheet(); // ← скрываем bottom sheet

  cleanupExercise(); // ← ДОБАВЬ В САМОЕ НАЧАЛО

  // Защита от многократного вызова

  if (window.nextExerciseRunning) {

    return;

  }

  window.nextExerciseRunning = true;

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

      const elapsed = (Date.now() - window.session.startTime) / 1000;

      if (elapsed >= window.session.timeLimit) {

        finishExam();

        return;

      }

    }

    if (sIdx >= window.session.items.length) {

      showResults();

      return;

    }

    const w = window.session.items[sIdx];

    const t =

      window.session.exTypes[

        Math.floor(Math.random() * window.session.exTypes.length)

      ];

    const isIdiom = window.session.dataType === 'idioms';

    // Добавляем класс для упражнений с клавиатурой

    const practiceEx = document.getElementById('practice-ex');

    if (t === 'type' || t === 'dictation') {

      practiceEx.classList.add('keyboard-exercise');

    } else {

      practiceEx.classList.remove('keyboard-exercise');

    }

    // Capture current token for safe audio

    const currentToken = ++exerciseAudioToken;

    function safeExerciseAudio(fn, delay = 300) {

      const tokenAtSchedule = currentToken;

      setTimeout(() => {

        if (!window.session || sIdx >= window.session.items.length) return;

        if (exerciseAudioToken !== tokenAtSchedule) return;

        try {

          fn();

        } catch (e) {

          console.warn('[AUDIO] safeExerciseAudio error:', e);

        }

      }, delay);

    }

    // Проверяем поддержку речи

    const speechSupported = 'speechSynthesis' in window;

    if (progFill) {

      progFill.style.width =

        Math.round((sIdx / window.session.items.length) * 100) + '%';

    }

    if (exCounter) {

      exCounter.textContent = `${sIdx + 1} / ${window.session.items.length}`;

    }

    if (currentExerciseTimer) {

      clearInterval(currentExerciseTimer);

      currentExerciseTimer = null;

    }

    if (t === 'flash') {

      if (exTypeLbl) {

        exTypeLbl.innerHTML =

          '<span class="material-symbols-outlined">style</span> Карточки';

      }

      if (exCounter) {

        exCounter.textContent = `${sIdx + 1} / ${window.session.items.length}`;

      }

      const isIdiom = window.session.dataType === 'idioms';

      const isVerb = window.session.dataType === 'verbs';

      let frontWord, backWord, showRU;

      if (isVerb) {

        // Глагол: лицевая сторона – перевод (русский), обратная – три формы с фонетикой

        const ruVariants = parseAnswerVariants(w.ru);

        frontWord = ruVariants.length ? ruVariants.join(', ') : w.ru;

        // Извлекаем три формы из w.en (теперь это массив)

        const forms = Array.isArray(w.en) ? w.en : w.en.split(' – ').map(s => s.trim());

        const phonetics = Array.isArray(w.phonetic) ? w.phonetic : [];

        // Формируем строку с фонетикой: каждая форма на новой строке

        backWord = forms.map((form, i) => {

          const phon = phonetics[i] ? ` - /${phonetics[i]}/` : '';

          return `${form}${phon}`;

        }).join('<br>');

      } else if (isIdiom) {

        frontWord = w.idiom.toLowerCase();

        backWord = w.meaning;

        showRU = false; // ← просто фиксируем значение чтобы шаблон не упал

      } else {

              const dir = window.session.dir || 'both';

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

                  ${frontWord === w.en ? `<button class="btn-audio" id="fc-audio-btn" title="Proounce"><span class="material-symbols-outlined">volume_up</span></button>` : ''}

                </div>

              </div>

              <div class="card-face back">

                <div style="display:flex;align-items:center;gap:${isVerb ? '1.5rem' : '.75rem'};justify-content:center">

                  <div class="card-trans" style="font-size:1.2rem;">

                    ${(() => {

                      if (isVerb) {

                        return backWord; // для глаголов backWord содержит HTML (<br>)

                      }

                      const variants = parseAnswerVariants(backWord);

                      return variants.join(', ') || esc(backWord);

                    })()}

                  </div>

                  ${backWord === w.en || (isIdiom && backWord === w.idiom) || isVerb ? `<button class="btn-audio" id="fc-audio-btn-back" title="Proounce"><span class="material-symbols-outlined">volume_up</span></button>` : ''}

                </div>

              </div>

            </div>

          </div>

        `;

      }

      const forms = isVerb ? (Array.isArray(w.en) ? w.en : w.en.split(' – ').map(s => s.trim())) : [];

      // Для глаголов убираем автоозвучку при старте - озвучка только при перевороте на английскую сторону

      if (isIdiom) {

        if (autoPron)

          setTimeout(() => {

            if (w.audio) playIdiomAudio(w.audio);

            else speakText(w.idiom);

          }, 300);

      } else {

        // Озвучиваем только когда на рубашке английское слово (frontWord === w.en)

        if (autoPron) {

              if (frontWord === w.en) {

            safeExerciseAudio(() => window.speakWord(w));

          }

        }

      }

      // Изначально скрываем кнопки ответа для карточек

      if (exBtns) {

        exBtns.innerHTML = `<div class="flash-hint">Переверни карточку для ответа</div>`;

      }

      // Добавляем обработку аудио кнопки

      if (isVerb) {

        // для глаголов вешаем аудио на кнопку на обратной стороне

        const fcAudioBtnBack = document.getElementById('fc-audio-btn-back');

        if (fcAudioBtnBack)

          fcAudioBtnBack.addEventListener('click', e => {

            e.stopPropagation();

            const infinitive = forms[0];

            window.speakVerb?.(w, infinitive);

          });

      } else if (isIdiom) {

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

              // }

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

            const wasFlipped = isFlipped;

            fcInner.classList.toggle('flipped');

            isFlipped = !isFlipped;

            // Автоозвучивание при перевороте на английскую сторону

            if (autoPron) {

              if (isVerb) {

                // Для глаголов: английский на лицевой (isFlipped=false), русский на обратной (isFlipped=true)

                // Озвучиваем когда переворачиваем с русского на английский (!wasFlipped && isFlipped)

                if (!wasFlipped && isFlipped) {

                  const infinitive = forms[0];

                  setTimeout(() => window.speakVerb?.(w, infinitive), 200);

                }

              } else if (!isIdiom) {

                // Для обычных слов озвучиваем когда на обороте английское слово

                if (isFlipped && backWord === w.en) {

                  safeExerciseAudio(() => window.speakWord(w));

                }

              }

            }

            // Показываем кнопки ответа только после переворота

            if (isFlipped && exBtns) {

              exBtns.innerHTML = `

  <div class="flash-answer-btns">

    <button class="btn-pill btn-pill--secondary" id="didnt-btn">

      <span class="material-symbols-outlined">close</span> Не знаю

    </button>

    <button class="btn-pill btn-pill--secondary" id="knew-btn">

      <span class="material-symbols-outlined">check</span> Знаю

    </button>

  </div>`;

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

          '<span class="material-symbols-outlined">target</span> Выбор';

      }

      if (exCounter) {

        exCounter.textContent = `${sIdx + 1} / ${window.session.items.length}`;

      }

      const dir = window.session.dir || 'both';

      const isIdiom = window.session.dataType === 'idioms';

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

      // --- Сбор дистракторов с умным подбором ---

      let dataSource = isIdiom

        ? window.idioms

        : window.words;

      // Для слов используем весь банк для лучшего подбора дистракторов
      let bankPool = (!isIdiom && window.wordBank && window.wordBank.length > 0)
        ? window.wordBank
        : [];

      // Если банк не загружен - используем личные слова как fallback
      if (!isIdiom && bankPool.length === 0) {
        console.warn('[MULTI] WordBank not loaded, using personal words as fallback');
        bankPool = dataSource;
      }

      const currentEn = w.en?.toLowerCase() || '';
      const targetLevel = w.cefr || null;

      // Извлекаем основной русский перевод (первый вариант без скобок)
      const currentRuVariants = parseAnswerVariants(w.ru);
      const currentRu = currentRuVariants.length ? currentRuVariants[0].toLowerCase() : w.ru?.toLowerCase() || '';

      // Фильтруем по уровню CEFR (если есть и это не идиома)
      let candidates = bankPool;
      if (!isIdiom && targetLevel) {
        candidates = candidates.filter(item => item.cefr === targetLevel);
      }

      // Убираем само слово
      candidates = candidates.filter(item => item.id !== w.id);

      // Если после фильтрации по уровню мало слов — расширяем на все уровни
      if (candidates.length < 3 && !isIdiom) {
        candidates = bankPool.filter(item => item.id !== w.id);
      }

      // Берём случайные кандидаты (без префиксного поиска)
      let finalCandidates = candidates.sort(() => Math.random() - 0.5);

      // Выбираем больше кандидатов чем нужно (10 вместо 5) чтобы после фильтрации осталось минимум 3-4
      const distractorItems = finalCandidates.slice(0, 10);

      let distractorCandidates = distractorItems

        .filter(x => {
          // Фильтруем ДО маппинга, чтобы иметь доступ к оригинальным полям
          // Убираем если en/ru совпадает с правильным ответом
          const enMatch = !isIdiom && x.en && x.en.toLowerCase() === currentEn;
          const ruMatch = !isIdiom && x.ru && x.ru.toLowerCase() === currentRu;
          if (enMatch || ruMatch) {
            return false;
          }
          // Исключаем аббревиатуры из дистракторов, если правильный ответ не аббревиатура
          if (!isIdiom && x.en && x.en.length <= 4 && x.en === x.en.toUpperCase() && x.en !== x.en.toLowerCase()) {
            // Исключаем только если текущее слово тоже не аббревиатура
            const currentIsAbbr = w.en && w.en.length <= 4 && w.en === w.en.toUpperCase() && w.en !== w.en.toLowerCase();
            if (!currentIsAbbr) {
              return false;
            }
          }
          return true;
        })

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

          const result = { id: x.id, text: variants.length > 0 ? variants[0] : trans };
          return result;

        })

        .filter(item => item.text && !correctVariants.includes(item.text)) // убираем пустые и все варианты правильного ответа

        .filter((item, index, self) => {
          // Убираем дубликаты по тексту (например, house и home оба маппятся в "дом")
          const firstIndex = self.findIndex(x => x.text === item.text);
          return firstIndex === index;
        });

      // Если после фильтрации меньше 3 дистракторов, добираем из оставшихся кандидатов
      if (distractorCandidates.length < 3) {
        const remainingCandidates = finalCandidates.slice(10); // Берём следующие кандидаты
        const currentIsAbbr = w.en && w.en.length <= 4 && w.en === w.en.toUpperCase() && w.en !== w.en.toLowerCase();
        for (const x of remainingCandidates) {
          if (distractorCandidates.length >= 3) break;
          // Проверяем что не дубликат
          const enMatch = !isIdiom && x.en && x.en.toLowerCase() === currentEn;
          const ruMatch = !isIdiom && x.ru && x.ru.toLowerCase() === currentRu;
          if (enMatch || ruMatch) continue;
          // Исключаем аббревиатуры из дистракторов, если правильный ответ не аббревиатура
          if (!isIdiom && x.en && x.en.length <= 4 && x.en === x.en.toUpperCase() && x.en !== x.en.toLowerCase() && !currentIsAbbr) {
            continue;
          }

          let trans = isIdiom ? (field === 'definition' ? x.idiom.toLowerCase() : x.meaning) : (isRUEN ? x.en : x.ru);
          const variants = parseAnswerVariants(trans);
          const text = variants.length > 0 ? variants[0] : trans;
          if (text && !correctVariants.includes(text) && !distractorCandidates.some(d => d.text === text)) {
            distractorCandidates.push({ id: x.id, text });
          }
        }

        // Если всё ещё мало - берём из всего банка (но без фильтрации по уровню)
        if (distractorCandidates.length < 3 && bankPool.length > finalCandidates.length) {
          const extraPool = bankPool.filter(item => !finalCandidates.includes(item));
          const currentIsAbbr = w.en && w.en.length <= 4 && w.en === w.en.toUpperCase() && w.en !== w.en.toLowerCase();
          for (const x of extraPool) {
            if (distractorCandidates.length >= 3) break;
            const enMatch = !isIdiom && x.en && x.en.toLowerCase() === currentEn;
            const ruMatch = !isIdiom && x.ru && x.ru.toLowerCase() === currentRu;
            if (enMatch || ruMatch) continue;
            // Исключаем аббревиатуры из дистракторов, если правильный ответ не аббревиатура
            if (!isIdiom && x.en && x.en.length <= 4 && x.en === x.en.toUpperCase() && x.en !== x.en.toLowerCase() && !currentIsAbbr) {
              continue;
            }

            let trans = isIdiom ? (field === 'definition' ? x.idiom.toLowerCase() : x.meaning) : (isRUEN ? x.en : x.ru);
            const variants = parseAnswerVariants(trans);
            const text = variants.length > 0 ? variants[0] : trans;
            if (text && !correctVariants.includes(text) && !distractorCandidates.some(d => d.text === text)) {
              distractorCandidates.push({ id: x.id, text });
            }
          }
        }
      }

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

      // В упражнении "multi" отключаем автоматическую озвучку

      // Озвучиваем только если вопрос на английском (EN→RU) и не для идиом с определением

      // if (autoPron && !isRUEN && !(isIdiom && field === 'definition')) {

      //   if (isIdiom) {

      //     setTimeout(() => {

      //       if (w.audio) playIdiomAudio(w.audio);

      //       else speakText(w.idiom);

      //     }, 300);

      //   } else {

      //     setTimeout(() => window.speakWord(w), 300);

      //   }

      // }

      if (exContent) {

        exContent.innerHTML = `

          <div class="mc-question">

            ${esc(question)}

            ${!isRUEN && !(isIdiom && field === 'definition') ? '' : ''}

          </div>

          <div class="mc-grid">

            ${options.map(o => `<button class="mc-btn" data-id="${o.id}">${esc(o.text)}</button>`).join('')}

          </div>

        `;

      }

      // Кнопка аудио убрана из упражнения "multi"

      // if (!isRUEN && !(isIdiom && field === 'definition')) {

      //   const mcAudioBtn = document.getElementById('mc-audio-btn');

      //   if (mcAudioBtn) {

      //     mcAudioBtn.addEventListener('click', e => {

      //       e.stopPropagation();

      //       if (isIdiom) {

      //         if (w.audio) playIdiomAudio(w.audio);

      //         else speakText(w.idiom);

      //       } else window.speakWord(w);

      //     });

      //   }

      // }

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

              // Озвучиваем правильный ответ и при неправильном выборе

              if (isIdiom) {

                if (w.audio) playIdiomAudio(w.audio);

                else speakText(w.idiom);

              } else {

                  window.speakWord(w);

              }

            }

            if (ok) {

              playSound('correct');

              if (isIdiom) {

                if (w.audio) playIdiomAudio(w.audio);

                else speakText(w.idiom);

              } else {

                          window.speakWord(w);

              }

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

          '<span class="material-symbols-outlined">keyboard</span> Напиши';

      }

      if (exCounter) {

        exCounter.textContent = `${sIdx + 1} / ${window.session.items.length}`;

      }

      const isIdiom = window.session.dataType === 'idioms';

      const isVerb = window.session.dataType === 'verbs';

      let question, answer;

      let isRUEN = false;

      if (isVerb) {

        // Для глаголов: вопрос – русский перевод, ответ – все три формы

        question = parseAnswerVariants(w.ru).join(', ') || w.ru;

        // Извлекаем три формы из w.en (теперь это массив)

        const forms = Array.isArray(w.en) ? w.en : w.en.split(' – ').map(s => s.trim());

        answer = forms.join(' – '); // например "sing – sang – sung"

      } else if (isIdiom) {

        question = w.meaning; // показываем перевод

        answer = w.idiom.toLowerCase(); // нужно написать идиому

      } else {

        const dir = window.session.dir || 'both';

        isRUEN = dir === 'ru-en' || (dir === 'both' && Math.random() > 0.5);

        question = isRUEN ? parseAnswerVariants(w.ru).join(', ') || w.ru : w.en;

        answer = stripParens(isRUEN ? w.en : w.ru);

      }

      // Автоозвучка для EN→RU (не для глаголов и идиом)

      if (autoPron && !isRUEN && speechSupported && !isVerb && !isIdiom) {

        safeExerciseAudio(() => window.speakWord(w));

      }

      if (exContent) {

        exContent.innerHTML = `

  <div class="ta-card">

    <div class="ta-prompt">

      <div class="ta-word">${esc(question)}${

        !isRUEN && speechSupported && !isVerb && !isIdiom

          ? `<button class="btn-audio ta-audio-btn" id="ta-audio-btn" title="">

             <span class="material-symbols-outlined">volume_up</span>

           </button>`

          : ''

      }</div>

    </div>

    <div class="ta-input-row" id="ta-input-row">

      <input type="text" class="form-control" id="ta-input"

        placeholder="${isVerb ? 'Введите три формы через пробел...' : isRUEN ? 'English...' : 'Перевод...'}"

        autocomplete="off" autocorrect="off" spellcheck="false">

    </div>

    <div class="ta-submit-row">

      <button class="btn-pill btn-pill--secondary" id="ta-submit">

        <span class="material-symbols-outlined">check</span> Проверить

      </button>

    </div>

  </div>

        `;

      }

      // Обработчик аудио кнопки (только для обычных слов EN→RU)

      if (!isRUEN && speechSupported && !isVerb && !isIdiom) {

        const taAudioBtn = document.getElementById('ta-audio-btn');

        if (taAudioBtn) {

          taAudioBtn.addEventListener('click', e => {

            e.stopPropagation();

            window.speakWord(w);

          });

        }

      }

      const input = document.getElementById('ta-input');

      const submit = document.getElementById('ta-submit');

      if (input) {

        input.focus();

        if (submit) {

          const checkAnswer = () => {

            const userAnswer = input.value.trim().toLowerCase();

            let normalizedAnswer;

            if (isVerb) {

              // Нормализуем эталон для глаголов: "sing – sang – sung" → "sing sang sung"

              normalizedAnswer = answer

                .split('–')

                .map(s => s.trim())

                .join(' ')

                .toLowerCase()

                .replace(/\s+/g, ' ');

            } else {

              normalizedAnswer = answer.toLowerCase();

            }

            const normalizedUser = userAnswer.replace(/\s+/g, ' ');

            const isCorrect = isVerb

              ? normalizedUser === normalizedAnswer

              : isIdiom

                ? checkAnswerWithNormalization(

                    normalizedUser,

                    normalizedAnswer,

                  ) ||

                  levenshteinDistance(

                    normalizedUser,

                    normalizedAnswer,

                  ) <= 1

                : parseAnswerVariants(answer).some(v =>

                    checkAnswerWithNormalization(

                      normalizedUser,

                      v.toLowerCase(),

                    ),

                  );

            if (input) input.disabled = true;

            if (submit) submit.disabled = true;

            if (isCorrect) {

              if (isVerb) {

                // Озвучиваем инфинитив при правильном ответе

                const infinitive = Array.isArray(w.en) ? w.en[0] : answer.split('–')[0].trim();

                window.speakVerb?.(w, infinitive);

              } else if (isIdiom) {

                if (w.audio) playIdiomAudio(w.audio);

                else speakText(w.idiom);

              } else {

                window.speakWord(w);

              }

              playSound('correct');

              recordAnswer(true, t);

              getFeedbackHTML(

                w,

                true,

                null,

                () => {

                  hideFeedbackSheet();

                  sIdx++;

                  nextExercise();

                },

                null,

              );

            } else {

              playSound('wrong');

              recordAnswer(false, t);

              getFeedbackHTML(w, false, null, null, () => {

                hideFeedbackSheet();

                sIdx++;

                nextExercise();

              });

            }

          };

          submit.addEventListener('click', () => {

            checkAnswer();

          });

          input.addEventListener('keydown', e => {

            if (e.key === 'Enter') {

              e.stopPropagation();

              checkAnswer();

            }

          });

        }

      }

    } else if (t === 'dictation') {

      if (exTypeLbl) {

        exTypeLbl.innerHTML =

          '<span class="material-symbols-outlined">hearing</span> Диктант';

      }

      if (exCounter) {

        exCounter.textContent = `${sIdx + 1} / ${window.session.items.length}`;

      }

      if (exContent) {

        exContent.innerHTML = `

  <div class="ta-card">

    <div class="ta-prompt dict-prompt">

      <button class="btn-icon btn-secondary" id="dict-replay">

        <span class="material-symbols-outlined">volume_up</span>

      </button>

    </div>

    <div class="ta-input-row" id="ta-input-row">

      <input type="text" id="dict-input"

        placeholder="Введите услышанное слово..."

        autocomplete="off" autocorrect="off" spellcheck="false">

    </div>

    <div class="ta-submit-row">

      <button class="btn-pill btn-pill--secondary" id="dict-submit">

        <span class="material-symbols-outlined">check</span> Проверить

      </button>

    </div>

  </div>

        `;

      }

      safeExerciseAudio(() => window.speakWord(w), 200);

      const answerVariants = parseAnswerVariants(w.en).map(v =>

        v.replace(/["'`]/g, '').toLowerCase(),

      );

      // }

      const dictInput = document.getElementById('dict-input');

      const dictSubmit = document.getElementById('dict-submit');

      const dictReplay = document.getElementById('dict-replay');

      if (dictReplay) {

        dictReplay.onclick = () =>

          window.speakWord(w);

      }

      if (dictInput) {

        dictInput.focus();

        if (dictSubmit) {

          const check = () => {

            const val = dictInput.value

              .trim()

              .toLowerCase()

              .replace(/["'`]/g, '');

            const normalizedVal = normalizeRussian(val);

            const answerVariants = parseAnswerVariants(w.en).map(v =>

              v.replace(/["'`]/g, '').toLowerCase(),

            );

            const ok = answerVariants.some(v =>

              checkAnswerWithNormalization(normalizedVal, v),

            );

            if (ok) {

              recordAnswer(true, t);

              getFeedbackHTML(

                w,

                true,

                null,

                () => {

                  hideFeedbackSheet();

                  sIdx++;

                  nextExercise();

                },

                null,

              );

              playSound('correct');

            } else {

              recordAnswer(false, t);

              getFeedbackHTML(w, false, null, null, () => {

                hideFeedbackSheet();

                sIdx++;

                nextExercise();

              });

              playSound('wrong');

            }

            if (dictInput) dictInput.disabled = true;

            if (dictSubmit) dictSubmit.disabled = true;

          };

          dictSubmit.addEventListener('click', () => {

            check();

          });

          dictInput.addEventListener('keydown', e => {

            if (e.key === 'Enter') {

              e.stopPropagation();

              check();

            }

          });

        }

      }

    } else if (t === 'builder') {

      if (exBtns) exBtns.innerHTML = ''; // Clear buttons from previous exercises

      if (exTypeLbl) {

        exTypeLbl.innerHTML =

          '<span class="material-symbols-outlined">construction</span> Собери';

      }

      if (exCounter) {

        exCounter.textContent = `${sIdx + 1} / ${window.session.items.length}`;

      }

      // Разбиваем слово на буквы и перемешиваем

      const wordText = (w.en || '').toLowerCase();

      const letters = wordText.split('').filter(c => c !== ' ');

      const shuffled = [...letters].sort(() => Math.random() - 0.5);

      const word = wordText;

      if (exContent) {

        exContent.innerHTML = `

          <div class="builder-card">

            <div class="builder-question">${parseAnswerVariants(w.ru).join(', ') || esc(w.ru)}</div>

            <div class="builder-answer" id="builder-answer"></div>

            <div class="builder-letters-container">

              <div class="builder-letters" id="builder-letters"></div>

            </div>

          </div>

        `;

      }

      // Создаем кнопки для букв

      let builderProcessing = false;

      const lettersContainer = document.getElementById('builder-letters');

      const answerContainer = document.getElementById('builder-answer');

      // Создаем пустые ячейки-заглушки по количеству букв

      answerContainer.innerHTML = '';

      letters.forEach((letter, index) => {

        const placeholder = document.createElement('span');

        placeholder.className = 'builder-answer-letter placeholder';

        placeholder.textContent = '';

        placeholder.dataset.index = index;

        answerContainer.appendChild(placeholder);

      });

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

          // Находим первую пустую заглушку (пропуская пробельные ячейки)

          const firstPlaceholder = answerContainer.querySelector(

            '.builder-answer-letter.placeholder:not(.space-placeholder)',

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

      function checkBuilderAnswer() {

        const currentAnswer = answerContainer.textContent.toLowerCase();

        const lettersContainer = document.getElementById('builder-letters');

        // Нормализуем для сравнения: удаляем знаки препинания и лишние пробелы
        const normalizedAnswer = currentAnswer.replace(/[.,!?;:"'`]/g, '').replace(/\s+/g, ' ').trim();
        const normalizedWord = word.replace(/[.,!?;:"'`]/g, '').replace(/\s+/g, ' ').trim();

        if (normalizedAnswer === normalizedWord) {

          // Скрываем буквы и показываем фидбек

          lettersContainer.style.display = 'none';

          recordAnswer(true, t);

          getFeedbackHTML(

            w,

            true,

            null,

            () => {

              hideFeedbackSheet();

              sIdx++;

              nextExercise();

            },

            null,

          ); // показывает нижний лист

          // Озвучиваем слово после правильного ответа

          window.speakWord(w);

          playSound('correct');

          document.querySelectorAll('.builder-letter').forEach(btn => {

            btn.disabled = true;

          });

          // Убираем автоматический переход - теперь по кнопке "Дальше"

        } else if (normalizedAnswer.length >= normalizedWord.length) {

          // НЕПРАВИЛЬНЫЙ ОТВЕТ — используем общий фидбек

          lettersContainer.style.display = 'none';

          recordAnswer(false, t);

          getFeedbackHTML(

            w,

            false,

            null,

            () => {

              hideFeedbackSheet();

              sIdx++;

              nextExercise();

            },

            null,

          );

          playSound('wrong');

        } else {

          // Показываем буквы при неполном ответе

          lettersContainer.style.display = 'flex';

        }

      }

      // Старая кнопка сброса убрана - теперь сброс только в фидбеке при неправильном ответе

    } else if (t === 'speech') {

      if (exTypeLbl) {

        exTypeLbl.innerHTML =

          '<span class="material-symbols-outlined">record_voice_over</span> Скажи';

      }

      if (exCounter) {

        exCounter.textContent = `${sIdx + 1} / ${window.session.items.length}`;

      }

      let promptWord, expectedWord;

      promptWord = w.en

        .replace(/\([^)]*\)/g, '')

        .replace(/\s+/g, ' ')

        .trim();

      expectedWord = promptWord;

      // }

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

              <div class="mic-visualizer" id="mic-visualizer">

                <span></span><span></span><span></span><span></span><span></span>

              </div>

              <button class="btn-icon" id="speech-start-btn">

                <span class="material-symbols-outlined">mic</span>

              </button>

            </div>

          </div>

        `;

      }

      const replayBtn = document.getElementById('speech-replay-btn');

      const startBtn = document.getElementById('speech-start-btn');

      // Автоматическая озвучка

      setTimeout(() => {

        window.speakWord(w);

        // }

      }, 500);

      if (replayBtn) {

        replayBtn.addEventListener('click', () => {

               window.speakWord(w);

          // }

        });

      }

      if (!speechRecognitionSupported) {

        toast(

          'Распознавание речи не поддерживается вашим браузером.',

          'warning',

        );

        if (startBtn) startBtn.disabled = true;

      }

      startBtn?.addEventListener('click', () => {

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

        rec.lang = CONSTANTS.SPEECH.AUTO_LANG || 'en-US';

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

          startBtn.style.display = 'none';

          // Показываем визуализатор вместо кнопки

          const micVisualizer = document.getElementById('mic-visualizer');

          if (micVisualizer) {

            micVisualizer.classList.add('active');

          }

        };

        rec.onresult = event => {

          clearTimeout(timeoutId);

          recognitionActive = false;

          // Скрываем визуализатор и показываем кнопку

          const micVisualizer = document.getElementById('mic-visualizer');

          if (micVisualizer) {

            micVisualizer.classList.remove('active');

          }

          startBtn.style.display = 'flex';

          const correct = expectedWord.toLowerCase();

          let isCorrect = false;

          let bestConfidence = 0;

          for (let i = 0; i < event.results[0].length; i++) {

            const spoken = event.results[0][i].transcript.trim();

            const confidence = event.results[0][i].confidence;

            if (window.isSpeechCorrect(spoken, correct, confidence)) {

              isCorrect = true;

              bestConfidence = confidence;

              break;

            }

            if (confidence > bestConfidence) bestConfidence = confidence;

          }

          const feedbackWord = {

            en: w.en,

            ru: w.ru,

            idiom: w.idiom,

            meaning: w.meaning,

          };

          if (isCorrect) {

            recordAnswer(true, t);

            getFeedbackHTML(

              feedbackWord,

              true,

              bestConfidence * 100,

              () => {

                hideFeedbackSheet();

                sIdx++;

                nextExercise();

              },

              null,

              true, // isSpeechExercise

            );

            playSound('correct');

            startBtn.disabled = true;

            if (replayBtn) replayBtn.disabled = true;

          } else {

            getFeedbackHTML(

              feedbackWord,

              false,

              bestConfidence * 100,

              null,

              () => {

                hideFeedbackSheet();

                startBtn.click(); // автоматический запуск микрофона

              },

              true, // isSpeechExercise

            );

            playSound('wrong');

          }

          currentRecognition = null;

        };

        rec.onerror = e => {

          clearTimeout(timeoutId);

          recognitionActive = false;

          // Скрываем визуализатор и показываем кнопку

          const micVisualizer = document.getElementById('mic-visualizer');

          if (micVisualizer) {

            micVisualizer.classList.remove('active');

          }

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

          // Показываем ошибку через toast вместо feedback

          toast(errorMessage, 'warning');

          currentRecognition = null;

        };

        rec.onend = () => {

          clearTimeout(timeoutId);

          if (recognitionActive) {

            // Не было результата, но и не ошибка – возможно, тишина

            const micVisualizer = document.getElementById('mic-visualizer');

            if (micVisualizer) {

              micVisualizer.classList.remove('active');

            }

            startBtn.style.display = 'flex';

            toast('Не удалось распознать речь. Попробуйте ещё раз.', 'warning');

            recognitionActive = false;

          }

          currentRecognition = null;

        };

        try {

          rec.start();

        } catch (err) {

          console.error('SpeechRecognition start failed:', err);

          toast('Не удалось запустить распознавание.', 'warning');

          startBtn.style.display = 'flex';

          currentRecognition = null;

        }

      });

      // Кнопка пропуска

      if (exBtns) {

        exBtns.innerHTML = `<button class="btn-pill btn-pill--secondary" id="speech-skip">

  <span class="material-symbols-outlined">skip_next</span> Пропустить

</button>`;

        document

          .getElementById('speech-skip')

          ?.addEventListener('click', () => {

            if (currentRecognition) {

              try {

                currentRecognition.abort();

              } catch (e) {}

              currentRecognition = null;

            }

            const micVisualizer = document.getElementById('mic-visualizer');

            if (micVisualizer) {

              micVisualizer.classList.remove('active');

            }

            startBtn.style.display = 'flex';

            playSound('wrong');

            recordAnswer(false, t);

            sIdx++;

            nextExercise();

          });

      }

    } else if (t === 'match') {

      try {

        const matchCount = Math.min(6, window.session.items.length - sIdx);

        if (window.session.dataType === 'idioms') {

          runIdiomMatchExercise(

            window.session.items.slice(sIdx, sIdx + 6),

            elapsed => {

              sIdx += matchCount;

              nextExercise();

            },

            t,

          );

        } else {

          runMatchExercise(

            window.session.items.slice(sIdx, sIdx + 6),

            elapsed => {

              sIdx += matchCount;

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

    } else if (t === 'context' && isIdiom) {

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

    } else if (t === 'sentence-builder' && !isIdiom) {

      runSentenceBuilderExercise(

        w,

        () => {

          sIdx++;

          nextExercise();

        },

        t,

      );

    }

  } catch (error) {

    console.error('Error in nextExercise:', error);

    toast('Ошибка при загрузке упражнения', 'error');

    // НЕ увеличиваем sIdx здесь - это делает proceedToNext

  } finally {

    // Всегда сбрасываем флаг

    window.nextExerciseRunning = false;

  }

}

function updIdiomStats(idiomId, correct, exerciseType) {

  const i = window.idioms.find(i => i.id === idiomId);

  if (!i) return;

  if (!i.stats) {

    i.stats = {

      shown: 0,

      learned: false,

      correct: 0,

      wrong: 0,

      streak: 0,

      lastReview: null,

      nextReview: new Date().toISOString(),

      interval: 1,

      easeFactor: 2.5,

      correctExerciseTypes: [],

    };

  }

  const wasLearned = i.stats.learned;

  calcSrs(i.stats, correct, exerciseType);

  if (!wasLearned && i.stats.learned) {

    gainXP(10, 'идиома выучена', 'star');

    autoCheckBadges();

  }

  updateDueBadge();

  markIdiomDirty(idiomId);

  markIdiomDirtyForCache(idiomId);

}

function recordAnswer(correct, exerciseType) {

  const currentItem = window.session.items[sIdx];

  if (!currentItem) {

    console.error('recordAnswer: no element at index', sIdx);

    return;

  }

  // Increase daily counter

  incrementDailyCount();

  // ===== СЕРИЯ ПРАВИЛЬНЫХ ОТВЕТОВ (исключая карточки) =====

  if (exerciseType !== 'flash') {
    if (correct) {

      window.learningStreak = (window.learningStreak || 0) + 1;

      markProfileDirty('learning_streak', window.learningStreak);

    } else {

      window.learningStreak = 0;

      markProfileDirty('learning_streak', 0);

    }
  }

  // Записываем активность для серии только при достижении времени практики
  // updStreak() сам запишет активность когда время будет достигнуто
  updStreak();

  // Stop and remove timer if exists

  if (currentExerciseTimer) {

    clearInterval(currentExerciseTimer);

    currentExerciseTimer = null;

  }

  // Use saved timer from session for reliability

  const timerEl =

    window.session.currentTimerEl || document.getElementById('exercise-timer');

  if (timerEl) {

    timerEl.remove();

    window.session.currentTimerEl = null; // Clear reference

  }

  // Sound no longer needed in recordAnswer - all sounds play directly in exercises

  // Use appropriate stats function

  if (window.session.dataType === 'idioms') {

    updIdiomStats(currentItem.id, correct, exerciseType);

    if (correct) updateWeeklyReviewDetail('idioms');

  } else {

    updStats(currentItem.id, correct, exerciseType);

    if (correct) updateWeeklyReviewDetail('words');

  }

  // Мгновенная проверка серии при достижении времени внутри сессии
  if (practiceStartTime) {
    const currentSessionSeconds = Math.round((Date.now() - practiceStartTime) / 1000);
    const totalPracticeTime = (window.dailyProgress.practice_time || 0) + currentSessionSeconds;
    
    // Если достигнуто 5 минут, вызываем updStreak для мгновенной реакции
    if (totalPracticeTime >= STREAK_CRITERIA.minPracticeTime) {
      // Временно обновляем practice_time для проверки
      const originalPracticeTime = window.dailyProgress.practice_time;
      window.dailyProgress.practice_time = totalPracticeTime;
      updStreak();
      // Восстанавливаем оригинальное значение (время добавится в конце сессии)
      window.dailyProgress.practice_time = originalPracticeTime;
    }
  }

  // В режиме экзамена подсчитываем отвеченные вопросы

  if (practiceMode === 'exam') {

    window.session.questionsAnswered++;

    if (correct) {

      window.session.results.correct.push(window.session.items[sIdx]);

    } else {

      window.session.results.wrong.push(window.session.items[sIdx]);

    }

    // Проверяем, отвечены ли все вопросы

    if (window.session.questionsAnswered >= window.session.questionsTotal) {

      // Все вопросы отвечены — завершаем экзамен

      finishExam();

      return;

    }

  }

  // Обновляем историю повторений при правильном ответе

  if (correct) {

    updateWeeklyReviewHistory();

  }

  // Обычный режим - существующая логика

  if (correct) sResults.correct.push(window.session.items[sIdx]);

  else sResults.wrong.push(window.session.items[sIdx]);

  // Обновляем прогресс ежедневных целей для правильных ответов

  // Увеличиваем счётчик упражнений за день (для всех ответов, не только правильных)

  // incrementDailyCount() уже вызывается в начале функции

  if (correct) {

    resetDailyGoalsIfNeeded(); // Ensure proper daily reset

    window.dailyProgress.review = (window.dailyProgress.review || 0) + 1;

    // Mark profile as dirty to ensure progress is saved

    markProfileDirty('dailyprogress', window.dailyProgress);

    // Update UI to show progress immediately

    refreshUI();

    // Обновляем метку времени сразу (оптимистично)

    window.lastProfileUpdate = Date.now();

    checkDailyGoalsCompletion();

    // Бонусные XP за быстрые ответы в режиме на время (только для упражнений с таймером)

    if (window.session.timed && timerEl) {

      const timerText = timerEl.querySelector('.timer-text');

      const timeRemaining = parseInt(timerText?.textContent || '0');

      if (timeRemaining >= 7) {

        // Бонус за очень быстрый ответ (>=7 секунд осталось)

        gainXP(

          2,

          'быстрый ответ <span class="material-symbols-outlined" style="vertical-align: middle; font-size: 16px;">bolt</span>',

        );

      } else if (timeRemaining >= 4) {

        // Маленький бонус за быстрый ответ (>=4 секунды осталось)

        gainXP(

          1,

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

  sResults = window.session.results;

  // Показываем результаты

  showResults();

}

// ============================================================

// CONFETTI ANIMATIONS

// Функции перенесены в js/utils.js

// Старые функции для совместимости

function spawnVictoryConfetti() {

  spawnGoodConfetti();

}

function spawnConfetti() {

  spawnVictoryConfetti();

}

function spawnGoodConfetti() {

  // Добавляем конфетти

  setTimeout(() => {

    for (let i = 0; i < 5; i++) {

      setTimeout(() => {

        const p = document.createElement('div');

        p.className = 'confetti';

        const x = 20 + Math.random() * 60; // 20-80% ширины экрана

        p.style.cssText = `

          left:${x}vw;

          top:30vh;

          width:4px;

          height:4px;

          background:#FFD700;

          border-radius:50%;

          animation:confettiBurst 1s ease-out forwards;

        `;

        document.body.appendChild(p);

        setTimeout(() => p.remove(), 4000);

      }, i * 200);

    }

  }, 500);

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

  // Обновляем слова

  window.words = newWords;

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

  const level = window.user_settings?.bankWordLevel || 'all';

  return await window.WordAPI.getRandomNewWord(level);

}

/**

 * Отрисовать блок со случайным словом из банка

 */

async function renderRandomBankWord() {

  // Не рендерим, если профиль ещё не загружен

  if (!window.profileFullyLoaded) return;

  const wrap = document.getElementById('wotd-wrap');

  if (!wrap) return;

  // Если уже есть карточка, добавим класс для плавного исчезновения

  if (wrap.children.length > 0) {

    wrap.classList.add('fade-out');

    await new Promise(r => setTimeout(r, 50));

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

      stopAllAudioWaves();

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

  // Добавляем глобальный обработчик для активации AudioContext

  document.addEventListener(

    'click',

    function initAudioContext() {

      const ctx = getAudioContext();

      if (ctx.state === 'suspended') {

        ctx.resume().then(() => {

          // AudioContext возобновлен

        });

      }

      // Удаляем обработчик после первой активации

      document.removeEventListener('click', initAudioContext);

    },

    { once: true },

  );

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

        currentBankWord.grammar, // грамматика с коллокациями

      );

      window.words.unshift(newWord);

      // === ОБНОВЛЕНИЕ ЕЖЕДНЕВНЫХ ЦЕЛЕЙ ===

      resetDailyGoalsIfNeeded();

      // 🔥 ФИКС: НЕ увеличиваем серию за импорт слов!

      window.dailyProgress.add_new = (window.dailyProgress.add_new || 0) + 1;

      markProfileDirty('dailyprogress', window.dailyProgress);

      markProfileDirty('total_words', window.words.length);

      checkDailyGoalsCompletion();

      // ====================================

      gainXP(1, 'новое слово из банка');

      addedBankWordEn.add(enLower);

      // --- МГНОВЕННОЕ СОХРАНЕНИЕ НА СЕРВЕР ---

      if (navigator.onLine && window.currentUserId) {

        try {

          await saveWordToDb(newWord);

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

      const { totalInBank, userWordsCount, remaining } =

        await window.WordBankDB.getRemainingWordsCount();

      const message =

        esc(currentBankWord.en) +

        '<br><span style="opacity:0.8;font-size:0.85em">' +

        'Теперь у тебя ' +

        userWordsCount +

        ' слов из ' +

        totalInBank +

        '.<br>В банке осталось ' +

        remaining +

        '.' +

        '</span>';

      toast(message, 'success', 'add_circle');

      playSound('sound/add.mp3');

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

  // Идиомы пока не имеют поля level, поэтому всегда используем 'all'

  const idiom = await window.IdiomAPI.getRandomNewIdiom('all');

  if (!idiom) {

    wrap.innerHTML = `

      <div class="word-bank-card">

        <div class="word-bank-content">

          <div class="word-bank-label">🎉 Поздравляем!</div>

          <div class="word-bank-en">Все идиомы из банка уже в вашем словаре</div>

        </div>

      </div>`;

    wrap.classList.remove('fade-out');

    wrap.classList.add('fade-in');

    setTimeout(() => wrap.classList.remove('fade-in'), 300);

    return;

  }

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

    stopAllAudioWaves();

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

        const allIdioms = await window.IdiomBankDB.getAllIdioms();

        const remaining = allIdioms.length - window.idioms.length;

        toast(

          `"${esc(currentBankIdiom.idiom)}" добавлено!<br><span style="opacity:0.8;font-size:0.85em">Ещё ${remaining} идиом в банке</span>`,

          'success',

          'add_circle',

        );

        playSound('sound/add.mp3');

        renderRandomBankIdiom(); // показать следующую

      }

    });

}

// Убрали двойной вызов load() - он перетирает данные из Supabase

(async () => {

  // updStreak();

  // updateDueBadge();

  // Идиомы теперь загружаются через IdiomAPI.loadIdiomBank в onProfileFullyLoaded

  renderRandomBankWord(); // для слов

  renderRandomBankIdiom(); // для идиом

})();

renderWords();

renderXP();

renderBadges();

renderStats();

// === ЗВУКИ ===

// Функция playSound перенесена в js/utils.js

function runMatchExercise(initialWords, onComplete, exerciseType) {

  const content = document.getElementById('ex-content');

  const btns = document.getElementById('ex-btns');

  btns.innerHTML = '';

  document.getElementById('ex-type-lbl').innerHTML =

    '<span class="material-symbols-outlined">extension</span> Найди пары';

  content.innerHTML = `

    <div class="match-columns" style="display: flex; gap: 12px;">

      <div class="match-col" id="match-col-en" style="flex: 1; display: flex; flex-direction: column; gap: 8px;"></div>

      <div class="match-col" id="match-col-ru" style="flex: 1; display: flex; flex-direction: column; gap: 8px;"></div>

    </div>

  `;

  const colEn = document.getElementById('match-col-en');

  const colRu = document.getElementById('match-col-ru');

  let startTime = Date.now();

  const wordsCount = Math.min(initialWords.length, 6);

  const currentWords = initialWords.slice(0, wordsCount);

  const enWords = [...currentWords].sort(() => Math.random() - 0.5);

  const ruWords = [...currentWords].sort(() => Math.random() - 0.5);

  colEn.innerHTML = '';

  colRu.innerHTML = '';

  enWords.forEach(enW => {

    const enBtn = document.createElement('button');

    enBtn.className = 'match-btn';

    enBtn.dataset.id = enW.id;

    enBtn.dataset.side = 'en';

    enBtn.textContent = enW.en || '';

    colEn.appendChild(enBtn);

  });

  ruWords.forEach(ruW => {

    const ruBtn = document.createElement('button');

    ruBtn.className = 'match-btn';

    ruBtn.dataset.id = ruW.id;

    ruBtn.dataset.side = 'ru';

    ruBtn.textContent = ruW.ru || ruW.translation || '';

    colRu.appendChild(ruBtn);

  });

  let matchedInRound = 0;

  const totalInRound = currentWords.length;

  let selectedWord = null;

  function clickHandler(e) {

    const btn = e.target.closest('.match-btn');

    if (!btn || btn.disabled || btn.classList.contains('correct')) return;

    const side = btn.dataset.side;

    const id = btn.dataset.id;

    if (selectedWord && selectedWord.element === btn) {

      selectedWord.element.classList.remove('selected');

      selectedWord = null;

      return;

    }

    if (!selectedWord) {

      btn.classList.add('selected');

      selectedWord = { id, side, element: btn };

      return;

    }

    if (selectedWord.id === id && selectedWord.side !== side) {

      playSound('correct');

      matchedInRound++;

      const matchedBtn1 = btn;

      const matchedBtn2 = selectedWord.element;

      btn.classList.add('correct');

      btn.disabled = true;

      selectedWord.element.classList.add('correct');

      selectedWord.element.disabled = true;

      updStats(id, true, exerciseType);

      recordAnswer(true, exerciseType);

      sResults.correct.push(initialWords.find(w => w.id === id));

      selectedWord = null;

      setTimeout(() => {

        matchedBtn1.classList.add('match-fade-out');

        matchedBtn2.classList.add('match-fade-out');

      }, 280);

      setTimeout(() => {

        matchedBtn1.style.visibility = 'hidden';

        matchedBtn2.style.visibility = 'hidden';

      }, 600);

      if (matchedInRound === totalInRound) {

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        setTimeout(() => onComplete(elapsed), 600);

      }

    } else {

      playSound('wrong');

      btn.classList.add('wrong');

      selectedWord.element.classList.add('wrong');

      updStats(selectedWord.id, false, exerciseType);

      recordAnswer(false, exerciseType);

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

  colEn.addEventListener('click', clickHandler);

  colRu.addEventListener('click', clickHandler);

}

function runIdiomMatchExercise(items, onComplete, exerciseType) {

  const content = document.getElementById('ex-content');

  const btns = document.getElementById('ex-btns');

  btns.innerHTML = '';

  document.getElementById('ex-type-lbl').innerHTML =

    '<span class="material-symbols-outlined">extension</span> Сопоставь идиому и перевод';

  content.innerHTML = `

    <div class="match-columns" style="display: flex; gap: 12px;">

      <div class="match-col" id="match-col-left" style="flex: 1; display: flex; flex-direction: column; gap: 8px;"></div>

      <div class="match-col" id="match-col-right" style="flex: 1; display: flex; flex-direction: column; gap: 8px;"></div>

    </div>

  `;

  const colLeft = document.getElementById('match-col-left');

  const colRight = document.getElementById('match-col-right');

  let startTime = Date.now();

  const wordsCount = Math.min(items.length, 6);

  const currentItems = items.slice(0, wordsCount);

  const leftItems = [...currentItems].sort(() => Math.random() - 0.5);

  const rightItems = [...currentItems].sort(() => Math.random() - 0.5);

  colLeft.innerHTML = '';

  colRight.innerHTML = '';

  leftItems.forEach(left => {

    const leftBtn = document.createElement('button');

    leftBtn.className = 'match-btn';

    leftBtn.dataset.id = left.id;

    leftBtn.dataset.side = 'left';

    leftBtn.textContent = left.idiom.toLowerCase();

    colLeft.appendChild(leftBtn);

  });

  rightItems.forEach(right => {

    const rightBtn = document.createElement('button');

    rightBtn.className = 'match-btn';

    rightBtn.dataset.id = right.id;

    rightBtn.dataset.side = 'right';

    rightBtn.textContent = right.meaning;

    colRight.appendChild(rightBtn);

  });

  let matchedInRound = 0;

  const totalInRound = currentItems.length;

  let selected = null;

  function clickHandler(e) {

    const btn = e.target.closest('.match-btn');

    if (!btn || btn.disabled || btn.classList.contains('correct')) return;

    const side = btn.dataset.side;

    const id = btn.dataset.id;

    if (selected && selected.element === btn) {

      selected.element.classList.remove('selected');

      selected = null;

      return;

    }

    if (!selected) {

      btn.classList.add('selected');

      selected = { id, side, element: btn };

      return;

    }

    if (selected.id === id && selected.side !== side) {

      playSound('correct');

      matchedInRound++;

      const matchedBtn1 = btn;

      const matchedBtn2 = selected.element;

      btn.classList.add('correct');

      btn.disabled = true;

      selected.element.classList.add('correct');

      selected.element.disabled = true;

      updIdiomStats(id, true, exerciseType);

      recordAnswer(true, exerciseType);

      sResults.correct.push(currentItems.find(i => i.id === id));

      selected = null;

      setTimeout(() => {

        matchedBtn1.classList.add('match-fade-out');

        matchedBtn2.classList.add('match-fade-out');

      }, 280);

      setTimeout(() => {

        matchedBtn1.style.visibility = 'hidden';

        matchedBtn2.style.visibility = 'hidden';

      }, 600);

      if (matchedInRound === totalInRound) {

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        setTimeout(() => onComplete(elapsed), 600);

      }

    } else {

      playSound('wrong');

      btn.classList.add('wrong');

      selected.element.classList.add('wrong');

      updIdiomStats(selected.id, false, exerciseType);

      recordAnswer(false, exerciseType);

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

  colLeft.addEventListener('click', clickHandler);

  colRight.addEventListener('click', clickHandler);

}

// === NEW EXERCISES ===

function runContextExercise(item, onComplete, exerciseType) {

  const content = document.getElementById('ex-content');

  const btns = document.getElementById('ex-btns');

  const exTypeLbl = document.getElementById('ex-type-lbl');

  const exCounter = document.getElementById('ex-counter');

  const isIdiom = window.session.dataType === 'idioms';

  if (exTypeLbl) {

    exTypeLbl.innerHTML =

      '<span class="material-symbols-outlined">psychology</span> Контекст';

  }

  if (exCounter) {

    exCounter.textContent = `${sIdx + 1} / ${window.session.items.length}`;

  }

  // Варианты ответов

  const options = [item];

  const otherItems = window.session.items.filter(x => x.id !== item.id);

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

    exampleTranslation = item.example_translation || item.meaning || '';

    correctAnswer = item.idiom;

  } else {

    exampleText = item.ex || '';

    exampleTranslation = item.examples?.[0]?.translation || item.meaning || '';

    correctAnswer = item.en;

  }

  // Экранируем спецсимволы для регулярки

  const escapedWord = correctAnswer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  console.log('[CONTEXT] correctAnswer:', correctAnswer);
  console.log('[CONTEXT] escapedWord:', escapedWord);
  console.log('[CONTEXT] exampleText:', exampleText);

  const exampleWithBlank = exampleText.replace(

    new RegExp(escapedWord, 'gi'),

    '_____',

  );

  console.log('[CONTEXT] exampleWithBlank:', exampleWithBlank);

  // Если замена не сработала (слово не найдено), пробуем без учёта регистра и спецсимволов
  const finalExampleWithBlank =
    exampleWithBlank === exampleText
      ? exampleText.replace(new RegExp(correctAnswer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '_____')
      : exampleWithBlank;

  console.log('[CONTEXT] finalExampleWithBlank:', finalExampleWithBlank);

  // Перемешиваем варианты

  const shuffledOptions = options.sort(() => Math.random() - 0.5);

  content.innerHTML = `

    <div class="context-exercise">

      <div class="context-sentence">

        <div class="context-text" onclick="this.nextElementSibling.style.display='block'; this.style.background='transparent'; this.onmouseover=null; this.onmouseout=null;" style="cursor: pointer; padding: 0.5rem; border-radius: 8px; transition: background 0.2s;" title="Нажмите для перевода" onmouseover="this.style.background='var(--border)'" onmouseout="this.style.background='transparent'">

          ${esc(finalExampleWithBlank)}

        </div>

        <div class="context-translation" id="context-translation" style="display: none; margin-top: 0.5rem; color: var(--muted); padding: 0.5rem; background: var(--card); border-radius: 8px;">

          ${esc(exampleTranslation)}

        </div>

      </div>

      <div class="context-options" id="context-options"></div>

    </div>

  `;

  const optionsContainer = document.getElementById('context-options');

  shuffledOptions.forEach(option => {

    const btn = document.createElement('button');

    btn.className = 'context-option-btn';

    let displayText;

    if (isIdiom) displayText = option.idiom;

    else displayText = option.en;

    btn.textContent = displayText.toLowerCase();

    btn.dataset.id = option.id;

    btn.addEventListener('click', () => {

      const isCorrect = option.id === item.id;

      document

        .querySelectorAll('.context-option-btn')

        .forEach(b => (b.disabled = true));

      // Записываем ответ сразу
      if (isCorrect) {
        recordAnswer(true, exerciseType);
      } else {
        recordAnswer(false, exerciseType);
      }

      getFeedbackHTML(

        isIdiom ? { en: item.idiom, ru: item.meaning } : item,

        isCorrect,

        null,

        isCorrect

          ? () => {

              hideFeedbackSheet();

              onComplete();

            }

          : null,

        !isCorrect

          ? () => {

              hideFeedbackSheet();

              onComplete();

            }

          : null,

      );

      playSound(isCorrect ? 'correct' : 'wrong');

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

    });

    optionsContainer.appendChild(btn);

  });

  // Кнопка пропуска

  if (btns) {

    btns.innerHTML = `<button class="btn-pill btn-pill--secondary" id="context-skip">

  <span class="material-symbols-outlined">skip_next</span> Пропустить

</button>`;

    document.getElementById('context-skip')?.addEventListener('click', () => {

      playSound('wrong');

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

  const isIdiom = window.session.dataType === 'idioms';

  if (exTypeLbl)

    exTypeLbl.innerHTML =

      '<span class="material-symbols-outlined">record_voice_over</span> Dictation';

  if (exCounter)

    exCounter.textContent = `${sIdx + 1} / ${window.session.items.length}`;

  // Define text and audio based on type

  let promptText = '';

  let exampleTranslation = '';

  let audioFile = null;

  let hasExample = false;

  if (isIdiom) {

    promptText = word.idiom;

    if (word.example) {

      promptText = word.example;

      hasExample = true;

    }

    exampleTranslation = word.example_translation || '';

    audioFile = word.audio;

  } else {

    hasExample = word.ex && word.ex.trim().length > 0;

    promptText = hasExample ? word.ex : word.en;

    exampleTranslation =

      hasExample && word.examples && word.examples[0]

        ? word.examples[0].translation

        : null;

    audioFile = word.audio;

  }

  const expectedWord = promptText

    .replace(/\([^)]*\)/g, '')

    .replace(/\s+/g, ' ')

    .trim();

  content.innerHTML = `

    <div class="speech-exercise">

      <div class="speech-prompt">

        <div class="speech-word-container">

          <div class="speech-word speech-sentence">${esc(promptText)}</div>

          <button class="btn-icon btn-small" id="speech-sentence-replay-btn" title="Прослушать предложение">

            <span class="material-symbols-outlined">volume_up</span>

          </button>

        </div>

        <div class="speech-hint">${!isIdiom && !hasExample ? 'Прослушайте слово, затем повторите его' : ''}</div>

        <div class="speech-translation" id="speech-sentence-translation" style="margin-top: 0.5rem; opacity: 0.7;">

          ${!hasExample ? `${parseAnswerVariants(word.ru).join(', ') || esc(word.ru)}` : exampleTranslation ? `${esc(exampleTranslation)}` : ''}

        </div>

      </div>

      <div class="speech-controls">

        <div class="mic-visualizer" id="speech-sentence-visualizer">

          <span></span><span></span><span></span><span></span><span></span>

        </div>

        <button class="btn-icon" id="speech-sentence-start-btn">

          <span class="material-symbols-outlined">mic</span>

        </button>

      </div>

    </div>

  `;

  const replayBtn = document.getElementById('speech-sentence-replay-btn');

  const startBtn = document.getElementById('speech-sentence-start-btn');

  const translationEl = document.getElementById('speech-sentence-translation');

  // Автоматическая озвучка при запуске упражнения

  setTimeout(() => {

    if (

      hasExample &&

      !isIdiom &&

      word.examplesAudio &&

      word.examplesAudio.length > 0

    ) {

      // If there's an example with audio - use it

      window.playExampleAudio(word);

    } else {

      // Otherwise, voice as a normal word

      window.speakWord(word);

    }

  }, 1000);

  // Обработчик кнопки повторного прослушивания

  if (replayBtn) {

    replayBtn.addEventListener('click', () => {

      if (

        hasExample &&

        !isIdiom &&

        word.examplesAudio &&

        word.examplesAudio.length > 0

      ) {

        // Если есть пример с аудио - используем его

        window.playExampleAudio(word);

      } else {

        // Otherwise, voice as a normal word

        window.speakWord(word);

      }

    });

  }

  if (!speechRecognitionSupported) {

    toast('Распознавание речи не поддерживается вашим браузером.', 'warning');

    if (startBtn) startBtn.disabled = true;

  }

  startBtn?.addEventListener('click', () => {

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

      startBtn.style.display = 'none';

      // Показываем визуализатор вместо кнопки

      const visualizer = document.getElementById('speech-sentence-visualizer');

      if (visualizer) {

        visualizer.classList.add('active');

      }

    };

    rec.onresult = event => {

      clearTimeout(timeoutId);

      recognitionActive = false;

      startBtn.style.display = 'flex';

      // Скрываем визуализатор

      const visualizer = document.getElementById('speech-sentence-visualizer');

      if (visualizer) {

        visualizer.classList.remove('active');

      }

      const correct = expectedWord.toLowerCase();

      let isCorrect = false;

      let bestConfidence = 0;

      for (let i = 0; i < event.results[0].length; i++) {

        const spoken = event.results[0][i].transcript.trim();

        const confidence = event.results[0][i].confidence;

        // Логируем для отладки

        if (confidence > bestConfidence) bestConfidence = confidence;

        // Для фраз — посимвольное + пословное сравнение

        const stripP = s =>

          s

            .replace(/[.,!?;:'"()\-]/g, '')

            .replace(/\s+/g, ' ')

            .trim()

            .toLowerCase();

        const sp = stripP(spoken);

        const co = stripP(correct);

        if (sp === co) {

          isCorrect = true;

          break;

        }

        // Word overlap (75% слов совпадают → засчитываем)

        const spWords = sp.split(' ');

        const coWords = co.split(' ');

        const matched = spWords.filter(w => coWords.includes(w)).length;

        const wordScore = matched / coWords.length;

        if (wordScore >= 0.75) {

          isCorrect = true;

          break;

        }

      }

      // Создаём объект для фидбека (имитация слова)

      const feedbackWord = {

        en: word.en,

        ru: word.ru,

        idiom: word.idiom,

        meaning: word.meaning,

      };

      if (isCorrect) {

        recordAnswer(true, exerciseType);

        getFeedbackHTML(

          feedbackWord,

          true,

          bestConfidence * 100,

          () => {

            hideFeedbackSheet();

            onComplete();

          },

          null,

          true, // isSpeechExercise

        );

        playSound('correct');

        startBtn.disabled = true;

        if (replayBtn) replayBtn.disabled = true;

      } else {

        getFeedbackHTML(

          feedbackWord,

          false,

          bestConfidence * 100,

          null,

          () => {

            hideFeedbackSheet();

            startBtn.click(); // автоматический запуск микрофона

          },

          true,

        ); // isSpeechExercise

        playSound('wrong');

      }

      currentRecognition = null;

    };

    rec.onerror = e => {

      clearTimeout(timeoutId);

      recognitionActive = false;

      startBtn.style.display = 'flex';

      // Скрываем визуализатор

      const visualizer = document.getElementById('speech-sentence-visualizer');

      if (visualizer) {

        visualizer.classList.remove('active');

      }

      let errorMessage = 'Ошибка распознавания.';

      if (e.error === 'not-allowed')

        errorMessage = 'Доступ к микрофону заблокирован.';

      else if (e.error === 'no-speech')

        errorMessage = 'Речь не распознана. Попробуйте ещё раз.';

      else if (e.error === 'audio-capture') errorMessage = 'Ошибка микрофона.';

      else if (e.error === 'network') errorMessage = 'Ошибка сети.';

      else if (e.error === 'aborted')

        errorMessage = 'Превышено время ожидания. Попробуйте ещё раз.';

      toast(errorMessage, 'warning');

      currentRecognition = null;

    };

    rec.onend = () => {

      clearTimeout(timeoutId);

      if (recognitionActive) {

        startBtn.style.display = 'flex';

        // Скрываем визуализатор

        const visualizer = document.getElementById(

          'speech-sentence-visualizer',

        );

        if (visualizer) {

          visualizer.classList.remove('active');

        }

        toast('Не удалось распознать речь. Попробуйте ещё раз.', 'warning');

        recognitionActive = false;

      }

      currentRecognition = null;

    };

    try {

      rec.start();

    } catch (err) {

      console.error('SpeechRecognition start failed:', err);

      toast('Не удалось запустить распознавание.', 'warning');

      startBtn.style.display = 'flex';

      currentRecognition = null;

    }

  });

  // Кнопка пропуска

  if (btns) {

    btns.innerHTML = `<button class="btn-pill btn-pill--secondary" id="speech-sentence-skip">

  <span class="material-symbols-outlined">skip_next</span> Пропустить

</button>`;

    document

      .getElementById('speech-sentence-skip')

      ?.addEventListener('click', () => {

        if (currentRecognition) {

          try {

            currentRecognition.abort();

          } catch (e) {}

          currentRecognition = null;

        }

        startBtn.style.display = 'flex';

        // Скрываем визуализатор

        const visualizer = document.getElementById(

          'speech-sentence-visualizer',

        );

        if (visualizer) {

          visualizer.classList.remove('active');

        }

        playSound('wrong');

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

    '<span class="material-symbols-outlined">construction</span> Собери';

  exCounter.textContent = `${sIdx + 1} / ${window.session.items.length}`;

  const phrase = item.idiom.toLowerCase(); // "a busy bee"

  const words = phrase.split(' '); // ["a", "busy", "bee"]

  const shuffled = [...words].sort(() => Math.random() - 0.5);

  content.innerHTML = `

    <div class="builder-card">

      <div class="builder-question">${item.meaning}</div>

      <div class="builder-answer" id="idiom-builder-answer"></div>

      <div class="builder-letters-container">

        <div class="builder-letters" id="idiom-builder-words"></div>

      </div>

    </div>

  `;

  const answerContainer = document.getElementById('idiom-builder-answer');

  const wordsContainer = document.getElementById('idiom-builder-words');

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

    const normalizedCurrent = current.toLowerCase().trim();

    const normalizedPhrase = phrase.toLowerCase().trim();

    if (normalizedCurrent === normalizedPhrase) {

      wordsContainer.style.display = 'none';

      recordAnswer(true, exerciseType);

      getFeedbackHTML(

        { en: phrase, ru: item.meaning },

        true,

        null,

        () => {

          hideFeedbackSheet();

          onComplete();

        },

        null,

      );

      // Озвучиваем идиому

      if (item.audio) playIdiomAudio(item.audio);

      else speakText(phrase);

      playSound('correct');

    } else if (current.length >= phrase.length) {

      // НЕПРАВИЛЬНЫЙ ОТВЕТ — используем общий фидбек

      wordsContainer.style.display = 'none';

      recordAnswer(false, exerciseType);

      getFeedbackHTML(

        { en: phrase, ru: item.meaning },

        false,

        null,

        () => {

          hideFeedbackSheet();

          onComplete();

        },

        null,

      );

      playSound('wrong');

    }

  }

  // Старая кнопка сброса убрана - теперь сброс только в фидбеке при неправильном ответе

  // Hint button removed - no longer needed

}

function runSentenceBuilderExercise(word, onComplete, exerciseType) {

  const content = document.getElementById('ex-content');

  const btns = document.getElementById('ex-btns');

  const exTypeLbl = document.getElementById('ex-type-lbl');

  const exCounter = document.getElementById('ex-counter');

  exTypeLbl.innerHTML =

    '<span class="material-symbols-outlined">format_quote</span> Собери предложение';

  exCounter.textContent = `${sIdx + 1} / ${window.session.items.length}`;

  let sentence = word.examples?.[0]?.text || word.ex || '';

  let translation = word.examples?.[0]?.translation || '';

  if (!sentence.trim()) {

    toast('Для этого слова нет примера', 'warning');

    onComplete();

    return;

  }

  const words = sentence.trim().split(/\s+/);

  const shuffled = [...words].sort(() => Math.random() - 0.5);

  content.innerHTML = `

    <div class="builder-card">

      <div class="builder-question">${esc(translation || 'Составьте предложение')}</div>

      <div class="builder-answer" id="sentence-builder-answer"></div>

      <div class="builder-letters-container">

        <div class="builder-letters" id="sentence-builder-words"></div>

      </div>

    </div>

  `;

  const answerContainer = document.getElementById('sentence-builder-answer');

  const wordsContainer = document.getElementById('sentence-builder-words');

  for (let i = 0; i < words.length; i++) {

    const placeholder = document.createElement('span');

    placeholder.className = 'builder-answer-letter placeholder';

    placeholder.dataset.index = i;

    answerContainer.appendChild(placeholder);

  }

  shuffled.forEach((wordToken, index) => {

    const btn = document.createElement('button');

    btn.className = 'builder-letter';

    btn.textContent = wordToken;

    btn.dataset.word = wordToken;

    btn.dataset.index = index;

    btn.addEventListener('click', () => {

      if (btn.disabled) return;

      const firstPlaceholder = answerContainer.querySelector(

        '.builder-answer-letter.placeholder',

      );

      if (!firstPlaceholder) return;

      firstPlaceholder.classList.remove('placeholder');

      firstPlaceholder.textContent = wordToken;

      firstPlaceholder.style.cursor = 'pointer';

      firstPlaceholder.title = 'Нажмите, чтобы убрать';

      firstPlaceholder.dataset.word = wordToken;

      btn.disabled = true;

      btn.style.visibility = 'hidden';

      firstPlaceholder.addEventListener('click', function removeHandler() {

        if (!firstPlaceholder.classList.contains('placeholder')) {

          const targetBtn = Array.from(wordsContainer.children).find(

            b => b.dataset.word === wordToken && b.disabled,

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

  function playExampleAudio() {

    const audioArr =

      word.examples_audio || word.examplesAudio || word.examplesaudio;

    if (audioArr && audioArr.length > 0) {

      const voicePref =

        window.user_settings?.voice === 'male' ? 'man' : 'women';

      const cefr = word.cefr || 'A1';

      const audioPath = `${cefr}/${voicePref}/${audioArr[0]}`;

      const audio = new Audio(audioPath);

      audio.play().catch(err => {

        console.warn('Audio play failed, fallback to TTS', err);

        speakText(sentence);

      });

    } else {

      speakText(sentence);

    }

  }

  function checkAnswer() {

    const current = Array.from(answerContainer.children)

      .map(el => el.textContent)

      .join(' ')

      .trim();

    // Нормализуем для сравнения: удаляем знаки препинания
    const normalize = s => s.toLowerCase().replace(/[.,!?;:"'`]/g, '').replace(/\s+/g, ' ').trim();

    if (normalize(current) === normalize(sentence)) {

      wordsContainer.style.display = 'none';

      recordAnswer(true, exerciseType);

      getFeedbackHTML(

        { en: sentence, ru: translation || word.ru },

        true,

        null,

        () => {

          hideFeedbackSheet();

          onComplete();

        },

        null,

      );

      playExampleAudio();

      playSound('correct');

    } else if (current.length >= sentence.length) {

      // НЕПРАВИЛЬНЫЙ ОТВЕТ — используем общий фидбек

      wordsContainer.style.display = 'none';

      recordAnswer(false, exerciseType);

      getFeedbackHTML(

        { en: sentence, ru: translation || word.ru },

        false,

        null,

        () => {

          hideFeedbackSheet();

          onComplete();

        },

        null,

      );

      playSound('wrong');

    }

  }

  // Hint button removed - no longer needed

}

// === EXIT SESSION ===

document.getElementById('ex-exit-btn').addEventListener('click', () => {

  // Останавливаем таймер match-упражнения, если есть

  if (window._matchTimerCancel) {

    window._matchTimerCancel();

    window._matchTimerCancel = null;

  }

  // Останавливаем таймер экзамена, если есть
  if (examTimerInterval) {
    clearInterval(examTimerInterval);
    examTimerInterval = null;
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

  // Отмена — просто закрываем модалку

  document.getElementById('exit-cancel').addEventListener('click', () => {

    modal.remove();

  });

  // Confirm - end session and return interface

  document.getElementById('exit-confirm').addEventListener('click', () => {

    modal.remove();

    // === СОХРАНЯЕМ ВРЕМЯ ПРАКТИКИ ===

    if (practiceStartTime) {

      const practiceSeconds = Math.round((Date.now() - practiceStartTime) / 1000);

      if (practiceSeconds > 0) {

        window.dailyProgress.practice_time = (window.dailyProgress.practice_time || 0) + practiceSeconds;

        markProfileDirty('dailyprogress', window.dailyProgress);

        checkDailyGoalsCompletion();

        // Обновляем челленджи practice_time так же как daily progress (в минутах с дробной частью) (ЗАКОММЕНТИРОВАНО)
        /*
        if (window.currentUserId && window.updateAllChallengesProgress) {
          const sessionMinutes = practiceSeconds / 60;
          if (sessionMinutes > 0) {
            window.updateAllChallengesProgress(
              window.currentUserId,
              'practice_time',
              sessionMinutes,
            );
          }
        }
        */

      }

      practiceStartTime = null;

    }

    // Обновляем серию при досрочном выходе, если были ответы

    if (sResults.correct.length + sResults.wrong.length > 0) {

      updStreak();

    }

    window.session = null; // Add explicit session reset

    window.isSessionActive = false; // Add explicit session reset

    // Return header and navbar ONLY after confirmation

    document.body.classList.remove('exercise-active');

    // Clear all active processes

    window.words.forEach(w => delete w._matched);

    if (window._matchTimerCancel) {

      window._matchTimerCancel();

      window._matchTimerCancel = null;

    }

    if (currentExerciseTimer) {

      clearInterval(currentExerciseTimer);

      currentExerciseTimer = null;

    }

    const timerEl = document.getElementById('exercise-timer');

    if (timerEl) timerEl.remove();

    if (currentRecognition) {

      try {

        currentRecognition.abort();

      } catch (e) {}

      currentRecognition = null;

    }

    const practiceEx = document.getElementById('practice-ex');

    practiceEx.style.display = 'none';

    practiceEx.classList.remove('keyboard-exercise');

    document.getElementById('practice-setup').style.display = 'block';

    // Очищаем содержимое упражнения

    const exContent = document.getElementById('ex-content');

    if (exContent) exContent.innerHTML = '';

    const exBtns = document.getElementById('ex-btns');

    if (exBtns) exBtns.innerHTML = '';

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

    name: 'EngUply',

    short_name: 'EngUply',

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

window.clearUserData = async function (isExplicitLogout = false) {

  window.profileFullyLoaded = false;

  if (badgeCheckInterval) {

    clearInterval(badgeCheckInterval);

    badgeCheckInterval = null;

  }

  // Полный сброс глобального состояния для предотвращения утечки между аккаунтами
  window.words = [];

  window.idioms = [];

  Object.assign(window.xpData, { xp: 0, level: 1, badges: [] });

  Object.assign(window.streak, { count: 0, lastDate: null, bestStreak: 0, freePassUsedThisWeek: false, freePassWeekStart: null });

  window.dailyProgress = {

    add_new: 0,

    review: 0,

    practice_time: 0,

    completed: false,

    lastReset: null,

  };

  window.dailyReviewCount = 0;

  window.lastReviewResetDate = window.getLocalDate();

  window.user_settings = {};

  weeklyReviewHistory = [];

  weeklyReviewDetail = [];

  window.pendingWordUpdates?.clear();

  updateIdiomsCount(); // обновляем счётчик после очистки

  // Очистка IndexedDB

  try {

    await clearAllWords();

    await clearAllIdioms();

  } catch (error) {

    console.error('❌ Ошибка очистки IndexedDB в clearUserData:', error);

  }

  dirtyWordIds.clear();

  dirtyIdiomIds.clear();

  deletedWordIds.clear();

  deletedIdiomIds.clear();

  if (window.wordSyncTimer) clearTimeout(window.wordSyncTimer);

  // profileSaveTimer больше не используется - удален

  if (isExplicitLogout) {

    // Сброс данных в памяти

    xpData = { xp: 0, level: 1, badges: [] };

    streak = { count: 0, lastDate: null };

    window.dailyProgress = {

      add_new: 0,

      practice_time: 0,

      review: 0,

      completed: false,

      lastReset: window.getLocalDate(),

    };

    window.dailyReviewCount = 0;

    window.lastReviewResetDate = window.getLocalDate();

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

  if (exerciseScreen) {

    exerciseScreen.style.display = 'none';

    exerciseScreen.classList.remove('keyboard-exercise'); // Очищаем класс

  }

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

window.updateFriendsNavBadge = updateFriendsNavBadge;

window.subscribeToMessages = subscribeToMessages; // глобальная подписка на сообщения

window.subscribeToReactions = subscribeToReactions; // глобальная подписка на реакции

function renderIdioms(appendOnly = false) {

  // Защита от отсутствия идиом

  if (!window.idioms || !Array.isArray(window.idioms)) {

    console.warn('renderIdioms: window.idioms не готов, пропускаем');

    return;

  }

  const grid = document.getElementById('idioms-grid');

  const empty = document.getElementById('empty-idioms');

  const trigger = document.getElementById('idioms-load-more-trigger');

  if (!grid) return; // на случай если вкладка ещё не создана

  let list = window.idioms;

  if (idiomsActiveFilter === 'learning')

    list = list.filter(i => !i.stats?.learned);

  if (idiomsActiveFilter === 'learned')

    list = list.filter(i => i.stats?.learned);

  if (idiomsSearchQuery) {

    const q = idiomsSearchQuery.toLowerCase().trim();

    list = list

      .filter(

        i =>

          i.idiom.toLowerCase().startsWith(q) ||

          i.meaning.toLowerCase().startsWith(q),

      )

      .sort((a, b) => {

        // точное совпадение — всегда первым

        const aExact = a.idiom.toLowerCase() === q;

        const bExact = b.idiom.toLowerCase() === q;

        if (aExact && !bExact) return -1;

        if (!aExact && bExact) return 1;

        return 0;

      });

  }

  if (idiomsTagFilter) {

    list = list.filter(

      i => i.tags && i.tags.map(t => t.toLowerCase()).includes(idiomsTagFilter),

    );

  }

  list = sortIdioms(list, idiomsSortBy);

  currentFilteredIdioms = list;

  const subtitleEl = document.getElementById('idioms-subtitle');

  if (subtitleEl) {

    subtitleEl.textContent =

      list.length !== window.idioms.length

        ? `(${list.length} из ${window.idioms.length})`

        : `— ${window.idioms.length} идиом`;

  }

  if (!list.length) {

    grid.innerHTML = '';

    empty.style.display = 'block';

    if (trigger) trigger.style.display = 'none';

    renderedIdiomsCount = 0;

    return;

  }

  empty.style.display = 'none';

  if (!appendOnly) {

    idiomsVisibleLimit = Math.min(idiomsVisibleLimit, list.length);

    renderedIdiomsCount = 0;

    grid.innerHTML = '';

    const end = Math.min(idiomsVisibleLimit, list.length);

    const fragment = document.createDocumentFragment();

    for (let i = 0; i < end; i++) {

      const card = makeIdiomCard(list[i]);

      fragment.appendChild(card);

    }

    grid.appendChild(fragment);

    renderedIdiomsCount = end;

    if (renderedIdiomsCount >= list.length) {

      if (trigger) trigger.style.display = 'none';

    } else {

      if (trigger) trigger.style.display = 'block';

    }

    setupIdiomsLoadMoreObserver(list.length);

  } else {

    appendMoreIdioms();

  }

  // Update due badge

  updateDueBadge();

}

window.renderIdioms = renderIdioms;

// Инициализация массива историй
window.stories = [];
window.currentStory = null;
window.currentStoryLevel = 'easy'; // easy, intermediate, challenge

// Получение текущей даты в формате YYYY-MM-DD по локальному времени пользователя
function getCurrentLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Проверка, должна ли история быть видимой
function isStoryVisible(story) {
  const scheduledDate = story.scheduledDate || story.date;
  if (!scheduledDate) return true; // Если даты нет - показываем

  const today = getCurrentLocalDate();
  return scheduledDate <= today;
}

// Проверка и обновление видимых историй каждую минуту
setInterval(() => {
  // Проверяем, изменилась ли дата
  const currentDate = getCurrentLocalDate();
  const lastDate = window.lastStoryCheckDate;

  if (lastDate !== currentDate) {
    console.log('[STORIES] Дата изменилась, обновляем истории:', lastDate, '->', currentDate);
    window.lastStoryCheckDate = currentDate;

    // Проверяем, появилась ли новая история
    loadAvailableStories().then(stories => {
      const newVisibleStories = stories.filter(story => isStoryVisible(story));
      const oldVisibleCount = window.stories.filter(s => isStoryVisible(s)).length;

      if (newVisibleStories.length > oldVisibleCount) {
        // Появилась новая история
        const newStory = newVisibleStories[newVisibleStories.length - 1];
        toast(`Новая история: ${newStory.title.en}`, 'success', 'auto_stories');
        playSound('sound/add.mp3');
      }

      renderStories(); // Перерендерим истории
    });
  }
}, 60000); // Каждую минуту

// Сохраняем дату последней проверки
window.lastStoryCheckDate = getCurrentLocalDate();

// Получение текущей даты в формате YYYY-MM-DD по локальному времени пользователя
function getCurrentLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Проверка, должна ли история быть видимой
function isStoryVisible(story) {
  const scheduledDate = story.scheduledDate || story.date;
  if (!scheduledDate) return true; // Если даты нет - показываем

  const today = getCurrentLocalDate();
  return scheduledDate <= today;
}

// Загрузка истории из JSON
async function loadStoryFromJSON(storyPath) {
  try {
    const response = await fetch(storyPath);
    const story = await response.json();
    console.log('[STORIES] Загружена история:', story.title?.en);
    return story;
  } catch (error) {
    console.error('[STORIES] Ошибка загрузки истории:', error, storyPath);
    return null;
  }
}

// Загрузка списка историй из папки story
async function getAvailableStories() {
  const CACHE_KEY = 'englift_stories';
  const CACHE_TIMESTAMP_KEY = 'englift_stories_timestamp';
  const CACHE_DATE_KEY = 'englift_stories_date';
  const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 часов

  const today = getCurrentLocalDate();

  // Проверяем кеш
  const cachedStories = localStorage.getItem(CACHE_KEY);
  const cachedTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
  const cachedDate = localStorage.getItem(CACHE_DATE_KEY);
  const now = Date.now();

  // Если дата изменилась - инвалидировать кеш
  if (cachedDate && cachedDate !== today) {
    console.log('[STORIES] Дата изменилась, инвалидация кеша:', cachedDate, '->', today);
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TIMESTAMP_KEY);
    localStorage.removeItem(CACHE_DATE_KEY);
  }

  if (cachedStories && cachedTimestamp && cachedDate === today) {
    const timestamp = parseInt(cachedTimestamp, 10);
    const age = now - timestamp;

    // Если кеш свежий (менее 6 часов) - возвращаем из кеша
    if (age < CACHE_DURATION) {
      console.log('[STORIES] Истории загружены из кеша, возраст:', Math.floor(age / 1000 / 60), 'минут');
      return JSON.parse(cachedStories);
    }
  }

  // Загружаем с сервера
  const stories = [];
  try {
    // Загружаем все истории из папки story
    const response = await fetch('story/stories.json');
    const data = await response.json();
    console.log('[STORIES] Загружен список историй:', data);

    // Загружаем каждую историю параллельно
    const storyPromises = data.stories.map(storyPath => loadStoryFromJSON(storyPath));
    const loadedStories = await Promise.all(storyPromises);

    // Фильтруем null значения (ошибки загрузки)
    loadedStories.forEach(story => {
      if (story) {
        stories.push(story);
      }
    });

    // Сохраняем в кеш
    localStorage.setItem(CACHE_KEY, JSON.stringify(stories));
    localStorage.setItem(CACHE_TIMESTAMP_KEY, now.toString());
    localStorage.setItem(CACHE_DATE_KEY, today);
    console.log('[STORIES] Истории сохранены в кеш');

    return stories;
  } catch (error) {
    console.error('[STORIES] Ошибка загрузки списка историй:', error);

    // Если есть кеш (даже старый) - возвращаем его при ошибке
    if (cachedStories) {
      console.log('[STORIES] Ошибка загрузки, используем старый кеш');
      return JSON.parse(cachedStories);
    }

    return [];
  }
}

// Получение текста для текущего уровня
function getStoryLevelText(story, levelId) {
  if (!story || !story.levels) {
    console.error('[STORIES] История не имеет поле levels:', story);
    return null;
  }

  let level;

  // Проверяем структуру - массив или объект
  if (Array.isArray(story.levels)) {
    // Структура как в The Red Umbrella: levels: [{id: 'easy', ...}, ...]
    level = story.levels.find(l => l.id === levelId);
  } else {
    // Структура как в The Wrong Suitcase и The Library Note: levels: {easy: {...}, intermediate: {...}, ...}
    level = story.levels[levelId];
  }

  if (!level) {
    console.error('[STORIES] Уровень не найден:', levelId, 'Доступные уровни:', Array.isArray(story.levels) ? story.levels.map(l => l.id) : Object.keys(story.levels));
    return null;
  }

  // Проверяем структуру текста
  let text, translation, vocabulary, questions, paragraphs;

  if (level.text && level.text.en) {
    // Структура как в The Red Umbrella: text.en: [{text, translationRu}, ...]
    text = level.text.en.map(p => p.text).join('\n\n');
    translation = level.text.en.map(p => p.translationRu).join('\n\n');
    vocabulary = level.vocabulary || [];
    questions = level.questions || [];
  } else if (level.paragraphs) {
    // Структура как в The Wrong Suitcase и The Library Note: paragraphs: [{en, ru}, ...]
    // Сохраняем параграфы как массив для отображения
    paragraphs = level.paragraphs;
    text = level.paragraphs.map(p => p.en).join('\n\n');
    translation = level.paragraphs.map(p => p.ru).join('\n\n');
    vocabulary = level.vocabulary || [];
    // Преобразуем quiz в questions
    questions = (level.quiz || []).map(q => ({
      id: q.id,
      type: q.type === 'choice' ? 'multiple_choice' : q.type,
      question: q.question,
      options: q.options,
      correctAnswer: q.type === 'choice' ? q.options[q.answer] : q.answer,
      explanationRu: q.explanationRu
    }));
  } else {
    console.error('[STORIES] Неизвестная структура текста:', level);
    return null;
  }

  return {
    text,
    translation,
    vocabulary,
    questions,
    paragraphs, // Добавляем массив параграфов
    wordCount: level.wordCount || 0,
    estimatedMinutes: level.estimatedReadingMinutes || level.readingMinutes || 0
  };
}

function renderStories() {
  const grid = document.getElementById('stories-grid');
  const empty = document.getElementById('empty-stories');
  const bankWrap = document.getElementById('story-bank-wrap');

  if (!grid) return;

  // Показываем индикатор загрузки
  grid.innerHTML = '<div class="loading-spinner">Загрузка историй...</div>';
  if (bankWrap) bankWrap.innerHTML = '<div class="loading-spinner">Загрузка истории дня...</div>';

  // Загружаем истории из JSON
  getAvailableStories().then(stories => {
    window.stories = stories;

    if (!stories.length) {
      grid.innerHTML = '';
      empty.style.display = 'block';
      if (bankWrap) bankWrap.innerHTML = '';
      return;
    }

    empty.style.display = 'none';

    // Сортируем по дате публикации, если даты одинаковые - по порядку в stories.json
    const sortedStories = stories.slice().sort((a, b) => {
      const dateA = a.publishedAt ? new Date(a.publishedAt) : new Date(a.scheduledDate || a.date);
      const dateB = b.publishedAt ? new Date(b.publishedAt) : new Date(b.scheduledDate || b.date);
      const dateDiff = dateB - dateA;

      // Если даты разные - сортируем по дате
      if (dateDiff !== 0) return dateDiff;

      // Если даты одинаковые - сохраняем порядок из stories.json
      const indexA = stories.indexOf(a);
      const indexB = stories.indexOf(b);
      return indexA - indexB;
    });

    // Фильтруем только видимые истории (по расписанию)
    const visibleStories = sortedStories.filter(story => isStoryVisible(story));

    if (!visibleStories.length) {
      grid.innerHTML = '';
      empty.style.display = 'block';
      if (bankWrap) bankWrap.innerHTML = '<div class="word-bank-card">Истории скоро появятся</div>';
      return;
    }

    // Последняя история - главная
    const mainStory = visibleStories[0];
    const otherStories = visibleStories.slice(1);

    // Рендерим историю дня
    if (mainStory && bankWrap) {
      renderStoryBankOnly(mainStory);
    }

    let html = '';

    // Остальные истории
    otherStories.forEach(story => {
      const summary = story.summary || story.description;
      const storyDate = story.publishedAt ? new Date(story.publishedAt).toLocaleDateString('ru-RU') :
                         story.date ? new Date(story.date).toLocaleDateString('ru-RU') : 'Без даты';

      html += `
        <div class="word-card" data-id="${story.id}">
          <div class="word-card-header">
            <div class="word-main">
              <h3 class="word-title">${esc(story.title.en)}</h3>
              <div class="story-date">${storyDate}</div>
            </div>
            <div class="word-actions">
              <button class="audio-btn story-read-btn" data-story-id="${story.id}" title="Читать полностью">
                <span class="material-symbols-outlined">menu_book</span>
              </button>
            </div>
          </div>
          <div class="word-translation">${esc(summary?.en || '')}</div>
          <div class="word-card-footer">
            <span class="expand-hint">Нажмите, чтобы прочитать</span>
            <span class="material-symbols-outlined expand-icon">expand_more</span>
          </div>
        </div>
      `;
    });

    grid.innerHTML = html;

    // Добавляем обработчики для раскрытия
    grid.querySelectorAll('.word-card').forEach(card => {
      // Обработчик клика для раскрытия
      card.addEventListener('click', (e) => {
        if (e.target.closest('.story-read-btn')) return;

        card.classList.toggle('expanded');
        const expandHint = card.querySelector('.expand-hint');
        const expandIcon = card.querySelector('.expand-icon');

        if (card.classList.contains('expanded')) {
          if (expandHint) expandHint.textContent = 'Нажмите, чтобы скрыть перевод';
          if (expandIcon) expandIcon.textContent = 'expand_less';
          showFullStoryContent(card);
        } else {
          if (expandHint) expandHint.textContent = 'Нажмите, чтобы увидеть перевод';
          if (expandIcon) expandIcon.textContent = 'expand_more';
          const extra = card.querySelector('.word-card-extra');
          if (extra) extra.remove();
        }
      });

      // Обработчик кнопки чтения
      const readBtn = card.querySelector('.story-read-btn');
      if (readBtn) {
        readBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const storyId = readBtn.dataset.storyId;
          const story = window.stories.find(s => s.id === storyId);
          if (story) {
            openStoryModal(story);
          }
        });
      }
    });
  });
}

function renderStoryBankOnly(story) {
  const bankWrap = document.getElementById('story-bank-wrap');
  if (!bankWrap) return;

  window.currentStory = story;
  const levelData = getStoryLevelText(story, window.currentStoryLevel);

  if (!levelData) {
    console.error('[STORIES] Не удалось получить данные уровня:', window.currentStoryLevel);
    bankWrap.innerHTML = '<div class="word-bank-card">Ошибка загрузки истории</div>';
    return;
  }

  const summary = story.summary || story.description;

  bankWrap.innerHTML = `
    <div class="word-bank-card" id="story-bank-card">
      <div class="word-bank-content">
        <div class="word-bank-label">
          <span class="material-symbols-outlined">auto_stories</span>
          История дня
        </div>
        <div class="word-bank-en-wrapper">
          <div class="word-bank-en">${esc(story.title.en)}</div>
          <button class="word-bank-nav-btn" id="story-read-btn" title="Читать полностью">
            <span class="material-symbols-outlined">menu_book</span>
          </button>
        </div>
        <div class="word-bank-ru">${esc(summary?.en || '')}</div>
        <div class="word-bank-footer">
          <span class="expand-hint">Нажмите, чтобы увидеть перевод</span>
          <span class="material-symbols-outlined expand-icon">expand_more</span>
        </div>
      </div>
    </div>
  `;

  // Обработчики переключения уровней
  bankWrap.querySelectorAll('.level-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      window.currentStoryLevel = btn.dataset.level;
      console.log('[STORIES] Переключение уровня на:', window.currentStoryLevel);
      renderStoryBankOnly(story);
    });
  });

  // Обработчик кнопки "Читать полностью"
  bankWrap.querySelector('#story-read-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    openStoryModal(story);
  });

  // Обработчик клика для раскрытия перевода сюжета
  const bankCard = bankWrap.querySelector('#story-bank-card');
  if (bankCard) {
    bankCard.addEventListener('click', (e) => {
      if (e.target.closest('#story-read-btn')) return;

      bankCard.classList.toggle('expanded');
      const expandHint = bankCard.querySelector('.expand-hint');
      const expandIcon = bankCard.querySelector('.expand-icon');

      if (bankCard.classList.contains('expanded')) {
        if (expandHint) expandHint.textContent = 'Нажмите, чтобы скрыть перевод';
        if (expandIcon) expandIcon.textContent = 'expand_less';

        // Удаляем старый контент если есть
        const existingExtra = bankCard.querySelector('.word-card-extra');
        if (existingExtra) existingExtra.remove();

        const extraDiv = document.createElement('div');
        extraDiv.className = 'word-card-extra';
        extraDiv.innerHTML = `
          <p>${esc(summary?.ru || '')}</p>
        `;
        bankCard.appendChild(extraDiv);
      } else {
        if (expandHint) expandHint.textContent = 'Нажмите, чтобы увидеть перевод';
        if (expandIcon) expandIcon.textContent = 'expand_more';
        const extra = bankCard.querySelector('.word-card-extra');
        if (extra) extra.remove();
      }
    });
  }
}

function generateStoryContent(story, levelData) {
  // Используем параграфы если есть, иначе старый формат
  const paragraphs = levelData.paragraphs || [{ en: levelData.text, ru: levelData.translation }];

  let html = `
    <div class="story-level-info">
      <span class="level-badge ${window.currentStoryLevel}">${window.currentStoryLevel.toUpperCase()}</span>
      <span class="word-count">${levelData.wordCount} слов</span>
    </div>
    <div class="story-text-container">
      <div class="story-text-en">
        ${paragraphs.map(p => `<p>${esc(p.en)}</p>`).join('')}
        <div class="story-audio-player">
          <div class="story-audio-controls">
            <button class="story-audio-play-btn" id="story-audio-play" title="Воспроизвести">
              <span class="material-symbols-outlined">play_arrow</span>
            </button>
            <div class="story-audio-progress" id="story-audio-progress">
              <div class="story-audio-progress-bar" id="story-audio-progress-bar"></div>
              <div class="story-audio-speed-controls">
                <button class="speed-btn speed-down" title="Уменьшить скорость">
                  <span class="material-symbols-outlined">remove</span>
                </button>
                <button class="speed-btn speed-display" data-speed="1.0" title="1.0x">1.0x</button>
                <button class="speed-btn speed-up" title="Увеличить скорость">
                  <span class="material-symbols-outlined">add</span>
                </button>
              </div>
            </div>
            <span class="story-audio-time" id="story-audio-time">0:00</span>
          </div>
          <audio id="story-audio" preload="metadata">
            <source src="" type="audio/mpeg">
          </audio>
        </div>
      </div>
      <div class="story-text-ru" id="story-translation" style="display:none;">
        ${paragraphs.map(p => `<p>${esc(p.ru)}</p>`).join('')}
      </div>
    </div>
    <div class="story-actions">
      <button class="btn btn-primary story-translation-btn" id="toggle-translation-btn">
        <span class="material-symbols-outlined story-translation-icon">translate</span>
        Показать перевод
      </button>
    </div>
  `;

  // Если есть словарь
  if (levelData.vocabulary && levelData.vocabulary.length > 0) {
    html += `
      <div class="story-vocabulary">
        <h4>Словарь</h4>
        <div class="vocab-list">
          ${levelData.vocabulary.map(v => {
            // Поддержка разных форматов JSON
            const word = v.word;
            const translation = v.translationRu || v.translation || '';
            const definition = v.definitionEn || v.definition || '';
            return `
              <div class="vocab-item">
                <strong>${esc(word)}</strong> - ${esc(translation)}
                ${definition ? `<div class="vocab-definition">${esc(definition)}</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // Если есть задания
  if (levelData.questions && levelData.questions.length > 0) {
    html += `
      <div class="story-questions">
        <h4>Задания</h4>
        <div class="questions-list">
          ${levelData.questions.map((q, index) => `
            <div class="question-item">
              <div class="question-text">${index + 1}. ${esc(q.question)}</div>
              ${q.type === 'multiple_choice' ? `
                <div class="question-options">
                  ${q.options.map(opt => `
                    <label class="question-option">
                      <input type="radio" name="question-${q.id}" value="${esc(opt)}">
                      ${esc(opt)}
                    </label>
                  `).join('')}
                </div>
              ` : ''}
              ${q.type === 'true_false' ? `
                <div class="question-options">
                  <label class="question-option">
                    <input type="radio" name="question-${q.id}" value="true">
                    Верно
                  </label>
                  <label class="question-option">
                    <input type="radio" name="question-${q.id}" value="false">
                    Неверно
                  </label>
                </div>
              ` : ''}
              ${q.type === 'short_answer' ? `
                <input type="text" class="form-control" placeholder="Ваш ответ">
              ` : ''}
              ${q.type === 'discussion' ? `
                <textarea class="form-control" rows="3" placeholder="Ваш ответ"></textarea>
              ` : ''}
              <button class="btn btn-sm btn-secondary check-answer-btn" data-question-id="${q.id}" style="margin-top: 0.5rem;">
                Проверить
              </button>
              <div class="question-explanation" id="explanation-${q.id}" style="display:none; margin-top: 0.5rem; color: var(--muted); font-size: 0.85rem;">
                ${esc(q.explanationRu || '')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  return html;

  // Если есть словарь
  if (levelData.vocabulary && levelData.vocabulary.length > 0) {
    html += `
      <div class="story-vocabulary">
        <h4>Словарь</h4>
        <div class="vocab-list">
          ${levelData.vocabulary.map(v => {
            // Поддержка разных форматов JSON
            const word = v.word;
            const translation = v.translationRu || v.translation || '';
            const definition = v.definitionEn || v.definition || '';
            return `
              <div class="vocab-item">
                <strong>${esc(word)}</strong> - ${esc(translation)}
                ${definition ? `<div class="vocab-definition">${esc(definition)}</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // Если есть задания
  if (levelData.questions && levelData.questions.length > 0) {
    html += `
      <div class="story-questions">
        <h4>Задания</h4>
        <div class="questions-list">
          ${levelData.questions.map((q, index) => `
            <div class="question-item">
              <div class="question-text">${index + 1}. ${esc(q.question)}</div>
              ${q.type === 'multiple_choice' ? `
                <div class="question-options">
                  ${q.options.map(opt => `
                    <label class="question-option">
                      <input type="radio" name="question-${q.id}" value="${esc(opt)}">
                      ${esc(opt)}
                    </label>
                  `).join('')}
                </div>
              ` : ''}
              ${q.type === 'true_false' ? `
                <div class="question-options">
                  <label class="question-option">
                    <input type="radio" name="question-${q.id}" value="true">
                    Верно
                  </label>
                  <label class="question-option">
                    <input type="radio" name="question-${q.id}" value="false">
                    Неверно
                  </label>
                </div>
              ` : ''}
              ${q.type === 'short_answer' ? `
                <input type="text" class="form-control" placeholder="Ваш ответ">
              ` : ''}
              ${q.type === 'discussion' ? `
                <textarea class="form-control" rows="3" placeholder="Ваш ответ"></textarea>
              ` : ''}
              <button class="btn btn-sm btn-secondary check-answer-btn" data-question-id="${q.id}" style="margin-top: 0.5rem;">
                Проверить
              </button>
              <div class="question-explanation" id="explanation-${q.id}" style="display:none; margin-top: 0.5rem; color: var(--muted); font-size: 0.85rem;">
                ${esc(q.explanationRu || '')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  return html;
}

function attachStoryContentHandlers(content, levelData) {
  // Обработчик кнопки показа перевода
  const toggleBtn = document.getElementById('toggle-translation-btn');
  const translationDiv = document.getElementById('story-translation');

  if (toggleBtn && translationDiv) {
    toggleBtn.addEventListener('click', () => {
      if (translationDiv.style.display === 'none') {
        translationDiv.style.display = 'block';
        toggleBtn.innerHTML = '<span class="material-symbols-outlined story-translation-icon">translate</span> Скрыть перевод';
      } else {
        translationDiv.style.display = 'none';
        toggleBtn.innerHTML = '<span class="material-symbols-outlined story-translation-icon">translate</span> Показать перевод';
      }
    });
  }

  // Настройка аудио плеера
  const audioElement = document.getElementById('story-audio');
  if (audioElement) {
    setupStoryAudioPlayer(audioElement);
  }

  // Обработчики кнопок проверки ответов
  content.querySelectorAll('.check-answer-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const questionId = btn.dataset.questionId;
      const question = levelData.questions.find(q => q.id === questionId);
      const explanationDiv = document.getElementById(`explanation-${questionId}`);

      if (!question || !explanationDiv) return;

      let isCorrect = false;

      if (question.type === 'multiple_choice' || question.type === 'true_false') {
        const selected = content.querySelector(`input[name="question-${questionId}"]:checked`);
        if (selected) {
          if (question.type === 'true_false') {
            isCorrect = (selected.value === 'true' && question.correctAnswer === true) ||
                         (selected.value === 'false' && question.correctAnswer === false);
          } else {
            isCorrect = selected.value === question.correctAnswer;
          }
        }
      }

      // Показываем объяснение
      explanationDiv.style.display = 'block';

      // Меняем кнопку
      if (isCorrect) {
        btn.textContent = 'Правильно!';
        btn.classList.remove('btn-secondary');
        btn.classList.add('btn-success');
      } else {
        btn.textContent = 'Попробуйте ещё раз';
        btn.classList.remove('btn-success');
        btn.classList.add('btn-danger');
      }
    });
  });
}

// Загрузка аудио для истории
function loadStoryAudio(story, levelId) {
  const audioElement = document.getElementById('story-audio');
  if (!audioElement) return;

  // Определяем голос пользователя
  const voice = window.user_settings?.voice || 'female';
  const voiceFolder = voice === 'male' ? 'man' : 'woman';

  // Формируем путь к аудио
  // Используем поле folder из JSON для точного соответствия имени папки
  const storyFolder = story.folder || story.slug || story.id;
  const audioPath = `story/${storyFolder}/${voiceFolder}/${levelId}.mp3`;

  console.log('[STORIES] Загрузка аудио:', audioPath);

  audioElement.src = audioPath;
  audioElement.load();

  // Настраиваем кастомный плеер
  setupStoryAudioPlayer(audioElement);
}

// Настройка кастомного аудио плеера
function setupStoryAudioPlayer(audioElement) {
  const playBtn = document.getElementById('story-audio-play');
  const progressBar = document.getElementById('story-audio-progress');
  const progressBarFill = document.getElementById('story-audio-progress-bar');
  const timeDisplay = document.getElementById('story-audio-time');

  if (!playBtn || !progressBar || !progressBarFill || !timeDisplay) return;

  let isPlaying = false;

  // Кнопка play/pause
  playBtn.addEventListener('click', () => {
    if (isPlaying) {
      audioElement.pause();
      playBtn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
      isPlaying = false;
    } else {
      audioElement.play();
      playBtn.innerHTML = '<span class="material-symbols-outlined">pause</span>';
      isPlaying = true;
    }
  });

  // Кнопки скорости
  const speedDownBtn = document.querySelector('.speed-down');
  const speedUpBtn = document.querySelector('.speed-up');
  const speedDisplay = document.querySelector('.speed-display');

  if (speedDownBtn && speedUpBtn && speedDisplay) {
    let currentSpeed = 1.0;

    speedDownBtn.addEventListener('click', () => {
      currentSpeed = Math.max(0.5, currentSpeed - 0.05);
      currentSpeed = Math.round(currentSpeed * 100) / 100;
      audioElement.playbackRate = currentSpeed;
      speedDisplay.textContent = currentSpeed.toFixed(2) + 'x';
      speedDisplay.dataset.speed = currentSpeed.toFixed(2);
    });

    speedUpBtn.addEventListener('click', () => {
      currentSpeed = Math.min(2.0, currentSpeed + 0.05);
      currentSpeed = Math.round(currentSpeed * 100) / 100;
      audioElement.playbackRate = currentSpeed;
      speedDisplay.textContent = currentSpeed.toFixed(2) + 'x';
      speedDisplay.dataset.speed = currentSpeed.toFixed(2);
    });
  }

  // Обновление прогресса
  audioElement.addEventListener('timeupdate', () => {
    const progress = (audioElement.currentTime / audioElement.duration) * 100;
    progressBarFill.style.width = `${progress}%`;
    timeDisplay.textContent = formatTime(audioElement.currentTime);
  });

  // Обновление времени при загрузке метаданных
  audioElement.addEventListener('loadedmetadata', () => {
    timeDisplay.textContent = formatTime(audioElement.duration);
  });

  // Событие окончания воспроизведения
  audioElement.addEventListener('ended', () => {
    playBtn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
    isPlaying = false;
    progressBarFill.style.width = '0%';
    timeDisplay.textContent = '0:00';
  });

  // Перемотка по клику на прогресс бар
  progressBar.addEventListener('click', (e) => {
    // Не перематываем если кликнули на кнопку скорости
    if (e.target.closest('.speed-btn')) return;

    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    audioElement.currentTime = percentage * audioElement.duration;
  });
}

// Форматирование времени в ММ:СС
function formatTime(seconds) {
  if (isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function openStoryModal(story) {
  const modal = document.getElementById('read-story-modal');
  const title = document.getElementById('read-story-title');
  const content = document.getElementById('read-story-content');
  const closeBtn = document.getElementById('read-story-modal-close');

  if (!modal || !title || !content) {
    console.error('[STORIES] Модальное окно не найдено');
    return;
  }

  // Получаем данные для текущего уровня
  const levelData = getStoryLevelText(story, window.currentStoryLevel);

  if (!levelData) {
    console.error('[STORIES] Не удалось получить данные уровня:', window.currentStoryLevel);
    return;
  }

  // Устанавливаем заголовок
  title.textContent = story.title.en;

  // Создаем табы для уровней
  const levels = ['easy', 'intermediate', 'challenge'];
  const levelLabels = { easy: 'Easy (A2)', intermediate: 'Intermediate (B1)', challenge: 'Challenge (B2)' };

  // Формируем контент с табами
  let html = `
    <div class="story-tabs">
      ${levels.map(level => `
        <button class="story-tab ${window.currentStoryLevel === level ? 'active' : ''}" data-level="${level}">
          ${levelLabels[level]}
        </button>
      `).join('')}
    </div>
    <div class="story-tab-content">
      ${generateStoryContent(story, levelData)}
    </div>
  `;

  content.innerHTML = html;

  // Загружаем аудио для текущего уровня
  loadStoryAudio(story, window.currentStoryLevel);

  // Обработчики переключения табов уровней
  content.querySelectorAll('.story-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const newLevel = tab.dataset.level;
      window.currentStoryLevel = newLevel;

      // Обновляем активный таб
      content.querySelectorAll('.story-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Получаем новые данные уровня
      const newLevelData = getStoryLevelText(story, newLevel);
      if (newLevelData) {
        // Останавливаем старое аудио
        const oldAudio = document.getElementById('story-audio');
        if (oldAudio) {
          oldAudio.pause();
          oldAudio.currentTime = 0;
        }

        // Обновляем только контент таба
        const tabContent = content.querySelector('.story-tab-content');
        if (tabContent) {
          tabContent.innerHTML = generateStoryContent(story, newLevelData);
          // Добавляем обработчики для нового контента
          attachStoryContentHandlers(tabContent, newLevelData);
          // Загружаем аудио для нового уровня
          loadStoryAudio(story, newLevel);
        }
      }
    });
  });

  // Показываем модальное окно
  modal.style.display = 'flex';

  // Скрываем хедер и меню как в практике
  document.body.classList.add('story-modal-active');

  // Обработчик кнопки показа перевода
  const toggleBtn = document.getElementById('toggle-translation-btn');
  const translationDiv = document.getElementById('story-translation');

  if (toggleBtn && translationDiv) {
    toggleBtn.addEventListener('click', () => {
      if (translationDiv.style.display === 'none') {
        translationDiv.style.display = 'block';
        toggleBtn.innerHTML = '<span class="material-symbols-outlined story-translation-icon">translate</span> Скрыть перевод';
      } else {
        translationDiv.style.display = 'none';
        toggleBtn.innerHTML = '<span class="material-symbols-outlined story-translation-icon">translate</span> Показать перевод';
      }
    });
  }

  // Обработчики кнопок проверки ответов
  content.querySelectorAll('.check-answer-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const questionId = btn.dataset.questionId;
      const question = levelData.questions.find(q => q.id === questionId);
      const explanationDiv = document.getElementById(`explanation-${questionId}`);

      if (!question || !explanationDiv) return;

      let isCorrect = false;

      if (question.type === 'multiple_choice' || question.type === 'true_false') {
        const selected = content.querySelector(`input[name="question-${questionId}"]:checked`);
        if (selected) {
          if (question.type === 'true_false') {
            isCorrect = (selected.value === 'true' && question.correctAnswer === true) ||
                         (selected.value === 'false' && question.correctAnswer === false);
          } else {
            isCorrect = selected.value === question.correctAnswer;
          }
        }
      }

      // Показываем объяснение
      explanationDiv.style.display = 'block';

      // Меняем кнопку
      if (isCorrect) {
        btn.textContent = 'Правильно!';
        btn.classList.remove('btn-secondary');
        btn.classList.add('btn-success');
      } else {
        btn.textContent = 'Попробуйте ещё раз';
        btn.classList.remove('btn-success');
        btn.classList.add('btn-danger');
      }
    });
  });

  // Обработчик закрытия
  closeBtn.onclick = () => {
    const audioElement = document.getElementById('story-audio');
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
    }
    modal.style.display = 'none';
    document.body.classList.remove('story-modal-active');
  };

  // Закрытие по клику на backdrop
  modal.onclick = (e) => {
    if (e.target === modal) {
      const audioElement = document.getElementById('story-audio');
      if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
      }
      modal.style.display = 'none';
      document.body.classList.remove('story-modal-active');
    }
  };
}

function showFullStoryContent(card) {
  const storyId = card.dataset.id;
  const story = window.stories.find(s => s.id === storyId);
  if (!story) return;

  // Удаляем старый контент если есть
  const existingExtra = card.querySelector('.word-card-extra');
  if (existingExtra) existingExtra.remove();

  const extraDiv = document.createElement('div');
  extraDiv.className = 'word-card-extra';

  const summary = story.summary || story.description;

  extraDiv.innerHTML = `
    <p>${esc(summary?.ru || '')}</p>
  `;

  card.appendChild(extraDiv);
}

window.renderStories = renderStories;

function appendMoreIdioms() {

  const grid = document.getElementById('idioms-grid');

  const trigger = document.getElementById('idioms-load-more-trigger');

  if (!currentFilteredIdioms.length) return;

  const start = renderedIdiomsCount;

  const end = Math.min(idiomsVisibleLimit, currentFilteredIdioms.length);

  if (start >= end) return;

  const fragment = document.createDocumentFragment();

  for (let i = start; i < end; i++) {

    const card = makeIdiomCard(currentFilteredIdioms[i]);

    fragment.appendChild(card);

  }

  grid.appendChild(fragment);

  renderedIdiomsCount = end;

  if (renderedIdiomsCount >= currentFilteredIdioms.length) {

    if (trigger) trigger.style.display = 'none';

  } else {

    if (trigger) trigger.style.display = 'block';

  }

}

function loadMoreIdioms() {

  if (isLoadingMore) return;

  if (renderedIdiomsCount >= currentFilteredIdioms.length) return;

  isLoadingMore = true;

  idiomsVisibleLimit = Math.min(

    idiomsVisibleLimit + PAGE_SIZE,

    currentFilteredIdioms.length,

  );

  appendMoreIdioms();

  setTimeout(() => {

    isLoadingMore = false;

  }, 100);

}

function makeIdiomCard(i) {

  const card = document.createElement('div');

  card.className = 'word-card word-card--idiom';

  card.dataset.id = i.id;

  // Сохраняем все данные в data-атрибутах для раскрытия

  card.dataset.idiom = i.idiom;

  card.dataset.meaning = i.meaning;

  card.dataset.definition = i.definition || '';

  card.dataset.example =

    i.example ||

    i.ex ||

    (Array.isArray(i.examples) && i.examples[0]?.text) ||

    '';

  card.dataset.exampleTranslation =

    i.exampleTranslation || // из Supabase (toCamelCase)

    i.exampletranslation || // локально созданные (старые)

    i.example_translation || // из JSON файла

    (Array.isArray(i.examples) && i.examples[0]?.translation) ||

    '';

  card.dataset.tags = JSON.stringify(i.tags || []);

  card.dataset.examplesAudio = JSON.stringify(i.examplesAudio || []);

  // Базовая разметка (свёрнутое состояние)

  // Генерируем индикаторы прогресса

  let progressLevel = 0;

  if (i.stats) {

    if (i.stats.learned) {

      progressLevel = 3;

    } else {

      progressLevel = i.stats.correctExerciseTypes?.length || 0;

    }

  }

  const indicators = Array.from({ length: 3 }, (_, index) => {

    const dotClass = index < progressLevel ? 'filled' : '';

    return `<div class="progress-dot ${dotClass}"></div>`;

  }).join('');

  // Tooltip текст

  let tooltipText = 'Не изучено';

  if (i.stats?.learned) {

    tooltipText = 'Выучено ✨';

  } else if (progressLevel > 0) {

    tooltipText = `Прогресс: ${progressLevel}/3 ${pluralize(3, 'упражнение', 'упражнения', 'упражнений')}`;

  }

  card.innerHTML = `

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

    <div class="progress-indicators">${indicators}</div>

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

      if (expandHint) expandHint.textContent = 'Нажмите, чтобы свернуть';

      if (expandIcon) expandIcon.textContent = 'expand_less';

    } else {

      if (expandHint) expandHint.textContent = 'Нажмите, чтобы раскрыть';

      if (expandIcon) expandIcon.textContent = 'expand_more';

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

  let example = card.dataset.example;

  let exampleTranslation = card.dataset.exampleTranslation;

  // Фолбэк на examples массив если строковые поля пустые

  if (!example) {

    try {

      const idiomId = card.dataset.id;

      const idiom = window.idioms.find(i => i.id === idiomId);

      if (idiom?.examples?.length) {

        example = idiom.examples[0].text || '';

        exampleTranslation =

          exampleTranslation || idiom.examples[0].translation || '';

      }

    } catch (e) {}

  }

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

      <div class="example-item">

        <div style="display:flex;align-items:center;gap:8px;">

          <div style="flex:1;">

            <div class="example-text">${esc(example)}</div>

            ${exampleTranslation ? `<div class="example-translation">${esc(exampleTranslation)}</div>` : ''}

          </div>

          <button class="example-audio-btn" data-example-index="0" title="Listen" aria-label="${esc(example)}">

            <span class="material-symbols-outlined" style="font-size:16px;">volume_up</span>

          </button>

        </div>

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

  // Review info для идиом

  const idiomId = card.dataset.id;

  let item = window.idioms.find(i => i.id === idiomId);

  let reviewInfo;

  // Показываем "новое" для идиом, которые еще ни разу не показывались

  if (item && item.stats && item.stats.shown === 0) {

    reviewInfo = `<span class="due-later"><span class="material-symbols-outlined">new_releases</span> новое</span>`;

  } else {

    reviewInfo =

      '<span class="due-later"><span class="material-symbols-outlined">refresh</span> —</span>';

    if (item && item.stats && item.stats.nextReview) {

      const nextReviewDate = new Date(item.stats.nextReview);

      const today = new Date();

      today.setHours(0, 0, 0, 0);

      const diffDays = Math.round(

        (nextReviewDate - today) / (1000 * 60 * 60 * 24),

      );

      if (diffDays <= 0)

        reviewInfo =

          '<span class="due-now"><span class="material-symbols-outlined">refresh</span> Сегодня</span>';

      else if (diffDays === 1)

        reviewInfo =

          '<span class="due-soon"><span class="material-symbols-outlined">refresh</span> Завтра</span>';

      else {

        const dayWord =

          diffDays === 1

            ? 'день'

            : diffDays >= 2 && diffDays <= 4

              ? 'дня'

              : 'дней';

        reviewInfo = `<span class="due-later"><span class="material-symbols-outlined">refresh</span> ${diffDays} ${dayWord}</span>`;

      }

    }

  }

  html += `

    <div class="word-actions-extra" style="display:flex;justify-content:space-between;align-items:center;margin:0.5rem 0;">

      <div class="word-review-info">${reviewInfo}</div>

      <div style="display:flex;gap:0.5rem;">

        <button class="edit-btn" data-id="${card.dataset.id}" title="Редактировать">

          <span class="material-symbols-outlined">edit</span>

        </button>

        <button class="delete-btn" data-id="${card.dataset.id}" title="Удалить">

          <span class="material-symbols-outlined">delete</span>

        </button>

      </div>

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

        if (

          entry.isIntersecting &&

          !isLoadingMore &&

          renderedIdiomsCount < currentFilteredIdioms.length

        ) {

          loadMoreIdioms();

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

// Обработчики для модального окна добавления историй

const addStoryModal = document.getElementById('add-story-modal');

const addStoryModalClose = document.getElementById('add-story-modal-close');

const addStoryBtn = document.getElementById('floating-add-story-btn');

function openAddStoryModal() {
  addStoryModal.classList.add('open');
  document.body.classList.add('modal-open');
}

function closeAddStoryModal() {
  addStoryModal.classList.remove('open');
  document.body.classList.remove('modal-open');
  document.getElementById('add-story-form').reset();
}

addIdiomBtn?.addEventListener('click', openAddIdiomModal);

emptyAddBtn?.addEventListener('click', openAddIdiomModal);

addIdiomModalClose?.addEventListener('click', closeAddIdiomModal);

addIdiomModal?.addEventListener('click', e => {

  if (e.target === addIdiomModal) closeAddIdiomModal();

});

addStoryBtn?.addEventListener('click', openAddStoryModal);

addStoryModalClose?.addEventListener('click', closeAddStoryModal);

addStoryModal?.addEventListener('click', e => {
  if (e.target === addStoryModal) closeAddStoryModal();
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

// ====================== MODAL: ADD FRIEND ======================

const addFriendModal = document.getElementById('add-friend-modal');

const addFriendModalClose = document.getElementById('add-friend-modal-close');

const addFriendBtn = document.getElementById('floating-add-friend-btn');

const addFriendSearchInput = document.getElementById('add-friend-search-input');

const addFriendSearchResults = document.getElementById(

  'add-friend-search-results',

);

function openAddFriendModal() {

  addFriendModal?.classList.add('open');

  document.body.classList.add('modal-open');

  // Фокус на поле ввода

  setTimeout(() => addFriendSearchInput?.focus(), 100);

}

function closeAddFriendModal() {

  addFriendModal?.classList.remove('open');

  document.body.classList.remove('modal-open');

  // Очищаем поле и результаты

  if (addFriendSearchInput) addFriendSearchInput.value = '';

  if (addFriendSearchResults) addFriendSearchResults.innerHTML = '';

}

addFriendBtn?.addEventListener('click', () => {

  openAddFriendModal();

});

addFriendModalClose?.addEventListener('click', () => {

  closeAddFriendModal();

});

addFriendModal?.addEventListener('click', e => {

  if (e.target === addFriendModal) {

    closeAddFriendModal();

  }

});

// Обработчик для кнопки "Пригласить по ссылке"

document

  .getElementById('invite-friend-link-btn')

  ?.addEventListener('click', async () => {

    // Используем существующую глобальную функцию

    if (typeof window.generateInviteLink === 'function') {

      await window.generateInviteLink();

    } else {

      window.toast?.('Функция генерации ссылки недоступна', 'danger');

    }

  });

// --- ПИЛЮЛИ ---

document.getElementById('floating-chat-btn')?.addEventListener('click', () => {

  // Переключаемся на вкладку друзей

  switchTab('friends');

  // Скроллим к списку друзей

  setTimeout(() => {

    const friendsList = document.getElementById('friends-list-content');

    if (friendsList) {

      friendsList.scrollIntoView({ behavior: 'smooth', block: 'start' });

    }

  }, 300);

});

// ============================================================

// ============================================================

// INITIALIZATION

// ============================================================

// Тема теперь применяется через немедленную инициализацию в начале файла

// Унифицированный обработчик visibilitychange

document.addEventListener('visibilitychange', () => {

  if (document.visibilityState === 'hidden') {

    // Сохраняем кеш и профиль перед закрытием

    flushCache();

    // ← ДОБАВЬ ЭТО: флашим незаконченные слова и профиль при сворачивании

    if (

      pendingWordUpdates.size > 0 &&

      navigator.onLine &&

      window.currentUserId

    ) {

      syncPendingWords();

    }

    if (window.currentUserId) {

      // Проверяем, есть ли грязные поля в профиле

      if (pendingProfileUpdates.size > 0) {

        syncProfileNow(); // Синхронизируем только если есть изменения

      }

    }

    // Дополнительно сохраняем в localStorage как страховку

    // ЗАКОММЕНТИРОВАНО - теперь используем Supabase

    /*

    const profileData = JSON.stringify({

      dailyprogress: window.dailyProgress,

      xp: window.xpData?.xp || 0,

      level: window.xpData?.level || 1,

      streak: window.streak?.count || 0,

      last_streak_date: window.streak?.lastDate,

    });

    localStorage.setItem('englift_lastknown_progress', profileData);

    */

  } else {

    // ✅ Сверка с БД один раз при возврате в таб

    if (window.currentUserId && navigator.onLine) {

      updateUnreadCounts();

    }

  }

});

// Инициализация

(async () => {

  console.log('[INIT] Инициализация');

  await load();

  // Выполняем миграцию переводов после загрузки

  if (window.words && window.words.length > 0) {

    await migrateExampleTranslations();

  }

  // НЕ рендерим сразу! Ждём профиль

})();

// Глобальный хук — вызывается из auth.js когда ВСЁ готово

window.onProfileFullyLoaded = async function () {

  console.log('[PROFILE] onProfileFullyLoaded called');

  try {

    window.profileFullyLoaded = true;

    console.log('[PROFILE] Removing loading class from body');
    // Убираем класс loading с body

    document.body.classList.remove('loading');

    console.log('[PROFILE] Starting migrateFromLocalStorage');
    // 1. Миграция из localStorage (один раз)

    await migrateFromLocalStorage();
    console.log('[PROFILE] migrateFromLocalStorage completed');

    console.log('[PROFILE] Starting loadFromCache');
    // 2. Быстрая загрузка из кеша (без рендера)

    await loadFromCache();
    console.log('[PROFILE] loadFromCache completed');

    // Если кеш пуст, сразу загружаем с сервера
    if (window.words.length === 0 && window.idioms.length === 0) {
      console.warn('[PROFILE] Кеш пуст, загружаем с сервера');
      await syncFromSupabase();
    }

    // Сохраняем количество слов из кеша для сравнения
    const cachedWordsCount = window.words.length;

    console.log('[PROFILE] Starting updateWordsFromBank');
    // 2.5. Обновляем существующие слова данными из WordBankDB (включая grammar)

    await updateWordsFromBank();
    console.log('[PROFILE] updateWordsFromBank completed');

    console.log('[PROFILE] Starting enrichWordsWithBankData');
    // 2.55. Обогащаем старые слова аудио примеров и CEFR из банка

    await enrichWordsWithBankData();
    console.log('[PROFILE] enrichWordsWithBankData completed');

    console.log('[PROFILE] Starting loadIdiomBank');
    // 2.56. Запускаем загрузку банка идиом (как и слов)

    if (window.IdiomAPI) {

      window.IdiomAPI.loadIdiomBank().catch(console.warn);
      console.log('[PROFILE] loadIdiomBank initiated');

    }

    console.log('[PROFILE] Starting loadWordsOnce');
    // 2.6. Загружаем слова из Supabase

    await new Promise(resolve => {

      window.authExports?.loadWordsOnce(remoteWords => {
        console.log('[PROFILE] loadWordsOnce callback received, remoteWords count:', remoteWords?.length);

        const localWords = window.words || [];

        const merged = window.mergeWords

          ? window.mergeWords(localWords, remoteWords)

          : remoteWords;

        window.words = merged.map(word =>

          typeof word === 'object'

            ? window.normalizeWord?.(word) || word

            : word

        );

        console.log('[PROFILE] window.words после merge:', window.words.length);

        // Если сервер вернул больше слов чем было в кеше, обновляем кеш
        if (merged.length > cachedWordsCount) {
          console.warn('[PROFILE] Сервер вернул больше слов чем в кеше (' + merged.length + ' vs ' + cachedWordsCount + '), обновляем кеш');
          window.UserDataCache.clearAllWords().then(() => {
            window.UserDataCache.saveWords(merged);
          });
        }

        const wordsKey = `englift_words_${window.currentUserId}`;
        localStorage.setItem(wordsKey, JSON.stringify(window.words));

        console.log('[PROFILE] Words saved to localStorage, count:', window.words?.length);

        // Принудительная перерисовка после обновления слов

        if (window.renderWords) window.renderWords();

        if (window.renderIdioms) window.renderIdioms();

        if (window.renderStats) window.renderStats();

        if (window.updateDueBadge) window.updateDueBadge();

        if (window.refreshUI) window.refreshUI();

        console.log('[PROFILE] UI refresh completed');
        resolve();

      });

    });

    console.log('[PROFILE] loadWordsOnce completed');
    // 3. Применяем данные профиля (они уже должны быть загружены из Supabase)

    if (window.profileData) {

      console.log('[PROFILE] Applying profile data');
      window.applyProfileData(window.profileData);

    }

    console.log('[PROFILE] Checking streak');
    // Проверяем и обновляем серию при загрузке
    updStreak();

    console.log('[PROFILE] Rendering streak');
    // Отображаем текущее состояние серии (без изменения логики)
    renderStreak();

    console.log('[PROFILE] Checking badges');
    // Проверяем бейджи только после полной загрузки слов
    checkBadges();

    // Проверяем, только что сгорел ли выходной (переход от доступен к использован)
    const weekStart = getWeekStart();
    if (streak.freePassUsedThisWeek && streak.freePassWeekStart === weekStart && !streak.freezeNotificationShown) {
      document.getElementById('freeze-notification-modal').classList.add('open');
      document.body.classList.add('modal-open');
      streak.freezeNotificationShown = true;
      markProfileDirty('freeze_notification_shown', true);
    }

    // 4. Переключаемся на вкладку слов после полной загрузки

    switchTab('words');

    // 5.1. Инициализируем чат

    if (window.currentUserId) {

      initChat(window.currentUserId);

    }

    // 5. Фоновая синхронизация с Supabase

    if (navigator.onLine) {

      syncFromSupabase();

    }

    // Запуск тура, если ещё не был показан

    if (window.currentUserId && !window.user_settings?.has_seen_tour) {

      setTimeout(() => {

        window.startTour?.();

      }, 800);

    } else {

      // Тур не запускаем, т.к. уже был показан

    }

    // После загрузки рендерим (если активна вкладка идиом)

    if (document.getElementById('tab-idioms')?.classList.contains('active')) {

      renderIdioms();

    }

    subscribeToFriendRequests();

    // Делаем функции доступными глобально
    // ========== ЧЕЛЛЕНДЖИ (ЗАКОММЕНТИРОВАНО) ==========
    /*
    window.getAllActiveChallenges = getAllActiveChallenges;

    window.updateAllChallengesProgress = updateAllChallengesProgress;

    window.createChallenge = createChallenge;

    window.joinChallenge = joinChallenge;

    window.leaveChallenge = leaveChallenge;
    */

    window.getFriends = getFriends;

    // Приглашения в челленджи (ЗАКОММЕНТИРОВАНО)
    /*
    window.sendChallengeInvite = sendChallengeInvite;

    window.getChallengeInvites = getChallengeInvites;

    window.acceptChallengeInvite = acceptChallengeInvite;

    window.declineChallengeInvite = declineChallengeInvite;

    window.deleteChallenge = deleteChallenge;
    */

    window.getFriendRequests = getFriendRequests;

    window.getOutgoingRequests = getOutgoingRequests;

    window.getLeaderboard = getLeaderboard;

    // Инициализируем бейджи друзей (заявки + сообщения)

    initFriendsBadges();

    renderWeekChart();

    // Миграция локальной недельной статистики в профиль (один раз)

    const weeklyReviewMigratedKey = `englift_weekly_review_migrated_${window.currentUserId}`;
    const weeklyReviewMigrated = localStorage.getItem(
      weeklyReviewMigratedKey,
    );

    if (!weeklyReviewMigrated && window.currentUserId) {

      const historyKey = `englift_weekly_review_${window.currentUserId}`;
      const detailKey = `englift_weekly_review_detail_${window.currentUserId}`;
      const localHistory = localStorage.getItem(historyKey);
      const localDetail = localStorage.getItem(detailKey);

      if (localHistory) {

        try {

          const history = JSON.parse(localHistory);

          window.markProfileDirty('weekly_review_history', history);

        } catch (e) {}

      }

      if (localDetail) {

        try {

          const detail = JSON.parse(localDetail);

          window.markProfileDirty('weekly_review_detail', detail);

        } catch (e) {}

      }

      localStorage.setItem(weeklyReviewMigratedKey, 'true');

    }

    // УБРАЛИ неправильную синхронизацию XP - она перетирала локальные данные!

    // Теперь всё работает через applyProfileData и markProfileDirty правильно

  } catch (err) {

    console.error('❌ Ошибка в onProfileFullyLoaded:', err);

  } finally {

    window.forceHideLoader();

  }

};

// Если был пропущенный вызов – выполняем сейчас

if (window._pendingProfileLoaded) {

  window.onProfileFullyLoaded();

  window._pendingProfileLoaded = false;

}

// Если через 2 секунды Supabase не загрузил тему

setTimeout(() => {

  if (!window.user_settings.baseTheme) {

    const key = `englift_user_settings_${window.currentUserId}`;
    const saved = JSON.parse(
      localStorage.getItem(key) || '{}',
    );

    const baseTheme = saved.baseTheme || 'lavender';

    const isDark = saved.dark ?? false;

    window.applyTheme(baseTheme, isDark);

  }

}, 800);

// Таймаут для скрытия индикатора загрузки (на случай проблем)

setTimeout(() => {

  const indicator = document.getElementById('loading-indicator');

  if (indicator && indicator.style.display !== 'none') {

    window.forceHideLoader();

  }

}, 5000); // Уменьшил до 5 секунд

// Проверяем соединение с Supabase

window.addEventListener('online', () => {

  console.log('[ONLINE] Соединение восстановлено');

  toast('Соединение восстановлено', 'success', 'wifi');

  if (window.authExports?.supabase) {

    // Проверяем текущую сессию один раз, без подписки на события (избегаем утечки слушателей)
    window.authExports.supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        console.log('[ONLINE] Пользователь авторизован');
      }
    });

  }

  // При восстановлении сети - синхронизируем профиль

  if (window.currentUserId && pendingProfileUpdates.size > 0) {

    setTimeout(() => syncProfileNow(), 1000);

  }

  // Синхронизируем XP логи из очереди

  flushXpQueue();

});

window.addEventListener('offline', () => {

  console.log('[OFFLINE] Оффлайн режим');

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

        <p style="color: var(--muted); margin-top: 1rem;">Готово! EngUply появится на главном экране как отдельное приложение.</p>

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

        <p style="color: var(--muted); margin-top: 1rem;">После этого EngUply будет доступен как приложение.</p>

      </div>

    `;

  } else {

    instructions = `

      <p>На вашем устройстве можно установить EngUply как приложение через меню браузера (обычно «Установить приложение» или «Добавить на главный экран»).</p>

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

    console.log('[SYNC] Тихая синхронизация');

    if (navigator.onLine && window.currentUserId && window.authExports) {

      try {

        // Тихо обновляем данные без показа тоста

        await window.authExports.loadWordsOnce(() => {});

      } catch (e) {

        // Ошибка тихой синхронизации

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

    // Синхронизируем идиомы, если есть изменения

    if (window.pendingIdiomUpdates?.size > 0 && navigator.onLine) {

      window.syncPendingIdioms?.();

    }

  }

}, 60 * 1000); // каждую минуту

// ============================================================

// ЗАЩИТА ОТ ПОТЕРИ ДАННЫХ ПРИ ЗАКРЫТИИ СТРАНИЦЫ

// ============================================================

// Сохраняем профиль при уходе со страницы

window.addEventListener('beforeunload', () => {

  if (practiceStartTime) {

    const practiceSeconds = Math.round((Date.now() - practiceStartTime) / 1000);

    if (practiceSeconds > 0) {

      window.dailyProgress.practice_time = (window.dailyProgress.practice_time || 0) + practiceSeconds;

      if (window.currentUserId) {

        markProfileDirty('dailyprogress', window.dailyProgress);

        // Обновляем челленджи practice_time так же как daily progress (в минутах с дробной частью) (ЗАКОММЕНТИРОВАНО)
        /*
        const sessionMinutes = practiceSeconds / 60;
        if (sessionMinutes > 0 && window.updateAllChallengesProgress) {
          window.updateAllChallengesProgress(
            window.currentUserId,
            'practice_time',
            sessionMinutes,
          );
        }
        */

      }

    }

  }

  syncProfileNow();

  flushCache(); // сохраняем кеш IndexedDB

});

// Сохраняем профиль при смене видимости (например, переключение вкладок)

// Второй обработчик visibilitychange удален - используется унифицированный выше

// ====================== FLOATING BUTTON SCROLL BEHAVIOR ======================

let lastScrollY = window.scrollY;

const SCROLL_THRESHOLD = 20; // минимальное расстояние для скрытия

// Переменные будут инициализированы после загрузки DOM

let floatingWordBtn = null;

let floatingIdiomBtn = null;

let floatingChatBtn = null;

let floatingFriendBtn = null;

function updateFloatingButtonsVisibility() {

  // Получаем кнопки для надежности

  const floatingWordBtn = document.getElementById('floating-add-word-btn');

  const floatingIdiomBtn = document.getElementById('floating-add-idiom-btn');

  const floatingChatBtn = document.getElementById('floating-chat-btn');

  const floatingFriendBtn = document.getElementById('floating-add-friend-btn');

  const currentScrollY = window.scrollY;

  const delta = currentScrollY - lastScrollY;

  // Определяем, какая кнопка сейчас активна (по активной вкладке)

  const activeTab = document.querySelector('.tab-pane.active')?.id;

  let activeBtn = null;

  if (activeTab === 'tab-words') activeBtn = floatingWordBtn;

  else if (activeTab === 'tab-idioms') activeBtn = floatingIdiomBtn;

  else if (activeTab === 'tab-friends') activeBtn = floatingFriendBtn;

  if (!activeBtn) return;

  if (Math.abs(delta) > SCROLL_THRESHOLD) {

    if (delta > 0) {

      // Скроллим вниз – скрываем

      activeBtn.classList.add('fab-hidden');

      // Кнопку чата тоже скрываем при скролле вниз, если она видима

      if (floatingChatBtn && floatingChatBtn.style.display !== 'none') {

        floatingChatBtn.classList.add('fab-hidden');

      }

    } else {

      // Скроллим вверх – показываем

      activeBtn.classList.remove('fab-hidden');

      // Кнопку чата тоже показываем при скролле вверх, если она должна быть видима

      if (floatingChatBtn && floatingChatBtn.style.display !== 'none') {

        floatingChatBtn.classList.remove('fab-hidden');

      }

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

  // Получаем кнопки каждый раз для надежности

  const floatingWordBtn = document.getElementById('floating-add-word-btn');

  const floatingIdiomBtn = document.getElementById('floating-add-idiom-btn');

  const floatingChatBtn = document.getElementById('floating-chat-btn');

  const floatingFriendBtn = document.getElementById('floating-add-friend-btn');

  const floatingStoryBtn = document.getElementById('floating-add-story-btn');

  if (!floatingWordBtn || !floatingIdiomBtn) {

    console.warn('Floating buttons not ready yet');

    return;

  }

  // Сбрасываем lastScrollY, чтобы скролл не мешал

  lastScrollY = window.scrollY;

  if (tabName === 'words') {

    floatingWordBtn.classList.remove('fab-hidden');

    floatingIdiomBtn.classList.add('fab-hidden');

    if (floatingFriendBtn) {

      floatingFriendBtn.classList.add('fab-hidden');

      floatingFriendBtn.style.display = 'none';

    }

  } else if (tabName === 'idioms') {

    floatingIdiomBtn.classList.remove('fab-hidden');

    floatingWordBtn.classList.add('fab-hidden');

    if (floatingFriendBtn) {

      floatingFriendBtn.classList.add('fab-hidden');

      floatingFriendBtn.style.display = 'none';

    }
    if (floatingStoryBtn) {
      floatingStoryBtn.classList.add('fab-hidden');
      floatingStoryBtn.style.display = 'none';
    }

  } else if (tabName === 'stories') {
    floatingWordBtn.classList.add('fab-hidden');
    floatingIdiomBtn.classList.add('fab-hidden');
    if (floatingFriendBtn) {
      floatingFriendBtn.classList.add('fab-hidden');
      floatingFriendBtn.style.display = 'none';
    }
    // Показываем кнопку историй только для администраторов
    if (floatingStoryBtn && window.userRole === 'admin') {
      floatingStoryBtn.style.display = 'flex';
      floatingStoryBtn.classList.remove('fab-hidden');
    } else if (floatingStoryBtn) {
      floatingStoryBtn.style.display = 'none';
      floatingStoryBtn.classList.add('fab-hidden');
    }

  } else if (tabName === 'friends') {

    // Скрываем кнопки слов и идиом

    floatingWordBtn.classList.add('fab-hidden');

    floatingIdiomBtn.classList.add('fab-hidden');

    // Показываем кнопку добавления друга

    if (floatingFriendBtn) {

      floatingFriendBtn.style.display = 'flex';

      floatingFriendBtn.classList.remove('fab-hidden');

    }

  } else {

    // Скрываем все кнопки для других вкладок

    floatingWordBtn.classList.add('fab-hidden');

    floatingIdiomBtn.classList.add('fab-hidden');
    if (floatingStoryBtn) {
      floatingStoryBtn.classList.add('fab-hidden');
      floatingStoryBtn.style.display = 'none';
    }

    if (floatingFriendBtn) {

      floatingFriendBtn.classList.add('fab-hidden');

      floatingFriendBtn.style.display = 'none';

    }

  }

}

// Переключение темы через кнопку в хедере - перенесено в js/theme.js

// При загрузке страницы устанавливаем lastScrollY

lastScrollY = window.scrollY;

// Инициализация видимости кнопок для начальной вкладки

setTimeout(() => {

  updateFloatingButtonsForTab('words');

}, 100);

// PWA мгновенное обновление при активации нового сервис-воркера

if ('serviceWorker' in navigator) {

  let refreshing = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {

    if (!refreshing) {

      refreshing = true;

      window.location.reload();

    }

  });

}

// ============================================

// FRIENDS MODULE

// ============================================

let activeFriendsPanel = 'list';

async function loadFriendsDataNew() {

  if (!window.currentUserId) {

    return;

  }

  try {

    // Прямой запрос к friendships вместо getFriends() (который имеет баг)

    const { data: allFriendships } = await supabase

      .from('friendships')

      .select('user_id, friend_id, status')

      .or(

        `user_id.eq.${window.currentUserId},friend_id.eq.${window.currentUserId}`,

      );

    // Извлекаем уникальные ID друзей со статусом accepted

    const acceptedFriendIds = [

      ...new Set(

        allFriendships

          .filter(f => f.status === 'accepted')

          .map(f =>

            f.user_id === window.currentUserId ? f.friend_id : f.user_id,

          ),

      ),

    ];

    // Получаем профили напрямую

    const { data: friendProfiles } = await supabase

      .from('profiles')

      .select(

        'id, username, xp, level, streak, laststreakdate, total_words, total_idioms, learned_words',

      )

      .in('id', acceptedFriendIds);

    const [requests, outgoing, leaderboard] = await Promise.all([

      getFriendRequests(window.currentUserId),

      getOutgoingRequests(window.currentUserId),

      getLeaderboard('week'),

    ]);

    friendsData = {

      friends: friendProfiles || [],

      requests: requests || [],

      outgoing: outgoing || [],

      leaderboard: leaderboard || [],

    };

    // Обновляем бейджи внутри раздела

    await updateUnreadCounts(); // получим количество непрочитанных

    updateFriendsSubBadges(); // обновим бейджи заявок и чата

    updateFriendsBadges(); // обновим бейдж количества друзей

    // Обновляем бейджи чата из нового модуля

    if (typeof refreshChatBadges === 'function') refreshChatBadges();

    renderFriendsTab();

  } catch (e) {

    console.error('loadFriendsDataNew error', e);

    friendsData = { friends: [], requests: [], outgoing: [], leaderboard: [] };

  }

}

async function initFriendsBadges() {

  if (!window.currentUserId) return;

  try {

    // Получаем входящие заявки (только количество, не рендерим)

    const { data: requests, error } = await supabase

      .from('friendships')

      .select('user_id')

      .eq('friend_id', window.currentUserId)

      .eq('status', 'pending');

    if (!error) {

      friendsData.requests = requests || [];

    } else {

      friendsData.requests = [];

    }

    // Обновляем непрочитанные сообщения (вызовет updateFriendsNavBadge внутри)

    await updateUnreadCounts();

  } catch (err) {

    console.error('initFriendsBadges error:', err);

  }

}

function renderFriendsTab() {

  loadLeaderboard('week'); // Загружаем недельный лидерборд по умолчанию

  loadFriendActivity(); // Загружаем ленту активности друзей

  renderFriendsList();

  updateChatBadges(); // Обновляем бейджи чата на карточках друзей

  renderFriendsRequests();

  updateFriendsNavBadge(); // Обновляем бейдж на кнопке Друзья (заявки + сообщения)

}

// --- ЛЕНТА АКТИВНОСТИ ДРУЗЕЙ ---

async function loadFriendActivity() {

  const container = document.getElementById('friend-activity-feed');

  if (!container) return;

  // Получаем друзей

  const { data: friendships } = await supabase

    .from('friendships')

    .select('friend_id')

    .eq('user_id', window.currentUserId)

    .eq('status', 'accepted');

  const friendIds = (friendships || []).map(f => f.friend_id);

  if (!friendIds.length) {

    container.innerHTML = `<p style="color:var(--muted);font-size:0.9rem"><span class="material-symbols-outlined" style="vertical-align: middle; font-size: 1.2rem; margin-right: 0.3rem;">person_off</span>Пока нет друзей</p>`;

    return;

  }

  // Получаем профили друзей

  const { data: profiles } = await supabase

    .from('profiles')

    .select('username, level, streak, badges, total_words')

    .in('id', friendIds);

  const events = [];

  profiles?.forEach(p => {

    if (p.streak >= 3) {

      events.push({

        icon: 'local_fire_department',

        text: `<b>${p.username}</b> поддерживает серию уже <b>${p.streak} дней</b>`,

      });

    }

    if (p.level >= 5 && p.level % 5 === 0) {

      events.push({

        icon: 'emoji_events',

        text: `<b>${p.username}</b> достиг уровня <b>${p.level}</b>`,

      });

    }

    if (p.badges?.length) {

      const last = p.badges[p.badges.length - 1];

      const badgeDef = BADGES_DEF.find(b => b.id === last);

      if (badgeDef) {

        events.push({

          icon: 'stars',

          text: `<b>${p.username}</b> получил бейдж «${badgeDef.name}»`,

          badgeId: last,

          badgeName: badgeDef.name,

          badgeIcon: badgeDef.icon,

          badgeDescription: badgeDef.description,

        });

      }

    }

    if (p.total_words > 0) {

      events.push({

        icon: 'menu_book',

        text: `<b>${p.username}</b> изучает <b>${p.total_words}</b> слов`,

      });

    }

  });

  if (!events.length) {

    container.innerHTML = `<p style="color:var(--muted);font-size:0.9rem"><span class="material-symbols-outlined" style="vertical-align: middle; font-size: 1.2rem; margin-right: 0.3rem;">bedtime</span>Друзья пока молчат</p>`;

    return;

  }

  container.innerHTML = events

    .slice(0, 8)

    .map(e => {

      if (e.badgeId) {

        // Особое отображение для бейджей с иконкой в тексте

        return `

    <div class="activity-item">

      <span class="activity-icon">

        <span class="material-symbols-outlined">${e.icon}</span>

      </span>

      <span class="activity-text">

        <b>${e.text.split('<b>')[1].split('</b>')[0]}</b> получил бейдж 

        <span class="material-symbols-outlined" style="font-size: 1.1rem; color: var(--primary); vertical-align: middle; margin: 0 0.2rem;">${e.badgeIcon}</span>

        <b>«${e.badgeName}»</b>

      </span>

    </div>

  `;

      } else {

        // Стандартное отображение для других событий

        return `

    <div class="activity-item">

      <span class="activity-icon">

        <span class="material-symbols-outlined">${e.icon}</span>

      </span>

      <span class="activity-text">${e.text}</span>

    </div>

  `;

      }

    })

    .join('');

  // Удалена строка container.innerHTML = eventHTML;

}

// --- ЛИДЕРБОРД С ПЕРИОДАМИ ---

async function loadLeaderboard(period = 'week') {

  const container = document.getElementById('friends-leaderboard-list');

  if (!container) return;

  container.innerHTML = '<div class="loading-spinner"></div>';

  try {

    // Получаем друзей

    const { data: friendships } = await supabase

      .from('friendships')

      .select('friend_id')

      .eq('user_id', window.currentUserId)

      .eq('status', 'accepted');

    const friendIds = (friendships || []).map(f => f.friend_id);

    const allIds = [window.currentUserId, ...friendIds];

    let scores = [];

    if (period === 'all') {

      // Считаем XP за всё время из xp_log
      const { data: logs } = await supabase

        .from('xp_log')

        .select('user_id, amount')

        .in('user_id', allIds);

      const { data: profiles } = await supabase

        .from('profiles')

        .select('id, username, xp, level')

        .in('id', allIds);

      const xpMap = {};

      (logs || []).forEach(l => {

        xpMap[l.user_id] = (xpMap[l.user_id] || 0) + l.amount;

      });

      scores = (profiles || []).map(p => ({

        ...p,

        periodXp: xpMap[p.id] || 0,

      }));

    } else {

      // Считаем XP за период из xp_log

      const since =

        period === 'week'

          ? new Date(Date.now() - 7 * 86400000).toISOString()

          : new Date(Date.now() - 30 * 86400000).toISOString();

      const { data: logs } = await supabase

        .from('xp_log')

        .select('user_id, amount')

        .in('user_id', allIds)

        .gte('created_at', since);

      const { data: profiles } = await supabase

        .from('profiles')

        .select('id, username, xp, level')

        .in('id', allIds);

      // Суммируем XP по юзерам

      const xpMap = {};

      (logs || []).forEach(l => {

        xpMap[l.user_id] = (xpMap[l.user_id] || 0) + l.amount;

      });

      scores = (profiles || []).map(p => ({

        ...p,

        periodXp: xpMap[p.id] || 0,

      }));

    }

    // Сортируем

    scores.sort((a, b) => b.periodXp - a.periodXp);

    renderLeaderboard(scores, period);

  } catch (err) {

    console.error('loadLeaderboard error:', err);

    container.innerHTML =

      '<p style="color:var(--muted);text-align:center">Ошибка загрузки</p>';

  }

}

function renderLeaderboard(scores, period) {

  const container = document.getElementById('friends-leaderboard-list');

  if (!container) return;

  if (!scores.length) {

    container.innerHTML = `

      <div style="text-align:center;padding:2rem;color:var(--muted)">

        <span class="material-symbols-outlined" style="font-size: 3rem;">group_off</span>

        <p style="margin-top:0.5rem">Добавь друзей чтобы соревноваться!</p>

      </div>

    `;

    return;

  }

  const medals = ['looks_one', 'looks_two', 'looks_3'];

  container.innerHTML = scores

    .map((user, i) => {

      const isMe = user.id === window.currentUserId;

      const medal = medals[i] || `${i + 1}`;

      const label =

        period === 'all'

          ? 'XP всего'

          : period === 'week'

            ? 'XP за неделю'

            : 'XP за месяц';

      return `

      <div class="lb-row ${isMe ? 'lb-row--me' : ''}" data-userid="${user.id}">

        <div class="lb-rank">

          ${i < 3 ? `<span class="material-symbols-outlined" style="font-size: 1.2rem; color: ${i === 0 ? 'var(--primary)' : i === 1 ? 'var(--muted)' : 'var(--warning)'};">${medal}</span>` : medal}

        </div>

        <div class="lb-avatar">${user.username?.[0]?.toUpperCase() || '?'}</div>

        <div class="lb-info">

          <div class="lb-name">${user.username || 'Аноним'} ${isMe ? '<span class="lb-you-badge">Ты</span>' : ''}</div>

          <div class="lb-level">Уровень ${user.level || 1}</div>

        </div>

        <div class="lb-xp">

          <div class="lb-xp-num">${user.periodXp.toLocaleString()}</div>

          <div class="lb-xp-label">${label}</div>

        </div>

      </div>

    `;

    })

    .join('');

}

function switchLbPeriod(btn) {

  document

    .querySelectorAll('.lb-tab')

    .forEach(t => t.classList.remove('active'));

  btn.classList.add('active');

  loadLeaderboard(btn.dataset.period);

}

// ===== ГЕНЕРАЦИЯ ИНВАЙТ-ССЫЛОК =====

async function generateInviteLink() {

  // Ищем кнопку в модалке, а не в основной вкладке

  const btn = document.getElementById('invite-friend-link-btn');

  if (!btn) {

    console.error('[INVITE] Кнопка invite-friend-link-btn не найдена!');

    return;

  }

  btn.disabled = true;

  btn.textContent = 'Генерируем...';

  try {

    // Проверяем, есть ли уже инвайт

    let { data: existing } = await supabase

      .from('invites')

      .select('id')

      .eq('inviter_id', window.currentUserId)

      .maybeSingle();

    let inviteId = existing?.id;

    if (!inviteId) {

      const { data, error } = await supabase

        .from('invites')

        .insert({ inviter_id: window.currentUserId })

        .select('id')

        .single();

      if (error) throw error;

      inviteId = data.id;

    }

    const link = `${location.origin}/?invite=${inviteId}`;

    await navigator.clipboard.writeText(link);

    window.toast?.('Ссылка скопирована!', 'success', 'link');

  } catch (err) {

    console.error('[INVITE] Ошибка генерации ссылки:', err);

    window.toast?.('Ошибка: ' + err.message, 'danger');

  } finally {

    btn.disabled = false;

    btn.innerHTML =

      '<span class="material-symbols-outlined">share</span> Пригласить по ссылке';

  }

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

      </div>

    `;

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

          <div class="lb-podium-item ${isMe ? 'me' : ''} rank-${podiumRanks[i]}" data-id="${user.id}">

            <div class="lb-podium-medal">${podiumMedals[i]}</div>

            <div class="lb-podium-name">${esc(user.username)}${isMe ? ' (ты)' : ''}</div>

            <div class="lb-podium-xp">${user.xp || 0} XP</div>

            <div class="lb-podium-level">lv.${user.level || 1}</div>

          </div>`;

        })

        .join('')}

    </div>

  `;

  const restHTML = rest

    .map((user, i) => {

      const isMe = user.id === myId;

      return `

      <div class="lb-row ${isMe ? 'me' : ''}" data-id="${user.id}">

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

  // Кликабельные строки лидерборда

  container.querySelectorAll('.lb-row, .lb-podium-item').forEach(row => {

    const userId = row.dataset.id;

    if (userId && userId !== window.currentUserId) {

      row.style.cursor = 'pointer';

      row.addEventListener('click', () => openFriendModal(userId));

    }

  });

}

// --- СПИСОК ДРУЗЕЙ ---

function renderFriendsList() {

  const container = document.getElementById('friends-list-content');

  if (!container) return;

  // Собираем все элементы: заявки первыми, потом друзья

  const allItems = [];

  // Добавляем заявки если есть

  if (friendsData.requests.length > 0) {

    friendsData.requests.forEach(req => {

      allItems.push(`

        <div class="friend-card-modern horizontal request-card" data-id="${req.id}" data-type="request" style="animation-delay: 0ms">

          <div class="friend-card-left">

            <div class="friend-avatar-modern request-avatar">

              ${req.username?.[0]?.toUpperCase() || '?'}

            </div>

            <div class="friend-header-info">

              <div class="friend-name-modern">${esc(req.username)}</div>

              <div class="request-meta">lv.${req.level || 1} · ${req.xp || 0} XP</div>

            </div>

          </div>

          <div class="friend-card-actions">

            <button class="friend-action-btn accept-req-btn" data-id="${req.id}" title="Принять">

              <span class="material-symbols-outlined">check</span>

            </button>

            <button class="friend-action-btn reject-req-btn" data-id="${req.id}" title="Отклонить">

              <span class="material-symbols-outlined">close</span>

            </button>

          </div>

        </div>

      `);

    });

  }

  // Добавляем друзей

  if (friendsData.friends.length > 0) {

    friendsData.friends.forEach((friend, index) => {

      allItems.push(`

        <div class="friend-card-modern horizontal" data-id="${friend.id}" data-type="friend" style="animation-delay: ${index * 50}ms">

          <div class="friend-card-left">

            <div class="friend-avatar-modern theme-avatar">

              ${friend.username?.[0]?.toUpperCase() || '?'}

            </div>

            <div class="friend-status ${friend.last_activity ? 'online' : 'offline'}"></div>

            <div class="friend-header-info">

              <div class="friend-name-modern">${esc(friend.username)}</div>

            </div>

          </div>

          <div class="friend-card-actions">

            <button class="friend-action-btn info-btn" title="Подробная информация">

              <span class="material-symbols-outlined">info</span>

            </button>

            <button class="friend-action-btn message-btn" title="Написать" data-friend-id="${friend.id}">

              <span class="material-symbols-outlined">chat</span>

              <span class="friend-chat-badge" id="friend-chat-badge-${friend.id}" style="display: none"></span>

            </button>

          </div>

        </div>

      `);

    });

  }

  if (!allItems.length) {

    container.innerHTML = `

      <div class="friends-empty">

        <span class="material-symbols-outlined">people</span>

        <p>Пока нет друзей — найди их через поиск или пригласи по ссылке!</p>

      </div>

    `;

    return;

  }

  container.innerHTML = allItems.join('');

  // Обработчики для заявок

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

        toast('Заявка принята!', 'success');

      } catch (error) {

        console.error('Error accepting friend request:', error);

        toast('Ошибка при принятии заявки', 'danger');

      }

    });

  });

  // Обработчики для отклонения заявок

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

      } catch (error) {

        console.error('Error rejecting friend request:', error);

        toast('Ошибка при отклонении заявки', 'danger');

      }

    });

  });

  // Обработчик кнопки info (только для друзей)

  container.querySelectorAll('.info-btn').forEach(btn => {

    btn.addEventListener('click', e => {

      e.stopPropagation();

      const card = btn.closest('.friend-card-modern');

      const friendId = card.dataset.id;

      const type = card.dataset.type;

      if (type === 'friend') {

        openFriendModal(friendId);

      }

    });

  });

  // Обработчики кнопок с hover-эффектом для иконок

  container.querySelectorAll('.friend-action-btn').forEach(btn => {

    btn.addEventListener('mouseenter', () => {

      const icon = btn.querySelector('.material-symbols-outlined');

      if (icon) {

        icon.style.setProperty('color', '#ffffff', 'important');

      }

    });

    btn.addEventListener('mouseleave', () => {

      const icon = btn.querySelector('.material-symbols-outlined');

      if (icon) {

        icon.style.removeProperty('color');

      }

    });

  });

  // Обработчик кнопки сообщения

  container.querySelectorAll('.message-btn').forEach(btn => {

    btn.addEventListener('click', e => {

      e.stopPropagation();

      const friendId = btn.closest('.friend-card-modern').dataset.id;

      const friend = friendsData.friends.find(f => f.id === friendId);

      if (friend) {

        openChatWithFriend(friendId, friend.username);

      }

    });

  });

}

let currentModal = null;

async function openFriendModal(friendId) {

  // Если модалка уже открыта, закрываем

  if (currentModal) {

    currentModal.remove();

    currentModal = null;

  }

  // Получаем данные о друге

  const friend = friendsData.friends.find(f => f.id === friendId);

  if (!friend) {

    console.error('Friend not found');

    return;

  }

  // Загружаем бейджи друга (если есть)

  let friendBadges = [];

  try {

    const { data } = await supabase

      .from('profiles')

      .select('badges')

      .eq('id', friendId)

      .single();

    if (data && data.badges) friendBadges = data.badges;

  } catch (e) {

    console.warn('Не удалось загрузить бейджи друга');

  }

  // Создаём модалку

  const modal = document.createElement('div');

  modal.className = 'friend-modal';

  modal.innerHTML = `

    <div class="friend-modal-content">

      <button class="friend-modal-close">

        <span class="material-symbols-outlined">close</span>

      </button>

      <div class="friend-modal-header">

        <div class="friend-modal-avatar">${friend.username?.[0]?.toUpperCase() || '?'}</div>

        <div class="friend-modal-name">${esc(friend.username)}</div>

        <div class="friend-modal-bio">${friend.bio || 'Изучает английский с EngUply'}</div>

      </div>

      <div class="friend-modal-stats">

        <div class="friend-stat-item">

          <div class="friend-stat-value">${friend.xp || 0}</div>

          <div class="friend-stat-label">XP</div>

        </div>

        <div class="friend-stat-item">

          <div class="friend-stat-value">${friend.streak || 0}</div>

          <div class="friend-stat-label">Дней</div>

        </div>

        <div class="friend-stat-item">

          <div class="friend-stat-value">${friend.level || 1}</div>

          <div class="friend-stat-label">Уровень</div>

        </div>

        <div class="friend-stat-item">

          <div class="friend-stat-value">${friend.total_words || friend.totalWords || 0}</div>

          <div class="friend-stat-label">Слова</div>

        </div>

        <div class="friend-stat-item">

          <div class="friend-stat-value">${friend.total_idioms || friend.totalIdioms || 0}</div>

          <div class="friend-stat-label">Идиомы</div>

        </div>

        <div class="friend-stat-item">

          <div class="friend-stat-value">${friend.learned_words || friend.learnedWords || 0}</div>

          <div class="friend-stat-label">Выучено</div>

        </div>

      </div>

      <div class="friend-badges">

        <h4><span class="material-symbols-outlined">emoji_events</span> Достижения</h4>

        <div class="badges-grid-mini">

          ${

            friendBadges.length

              ? friendBadges

                  .slice(0, 6)

                  .map(b => {

                    const badgeDef = BADGES_DEF.find(def => def.id === b);

                    const name = badgeDef ? badgeDef.name : b;

                    return `<span class="badge-mini"><span class="material-symbols-outlined">stars</span> ${name}</span>`;

                  })

                  .join('')

              : '<span class="badge-mini">Пока нет бейджей</span>'

          }

        </div>

      </div>

      <div class="friend-modal-actions">

        <!-- ЗАКОММЕНТИРОВАНО: Кнопка бросить вызов -->
        <!--
        <button class="modal-action-btn primary" id="challenge-friend">

          <span class="material-symbols-outlined">sports_score</span>

          Бросить вызов

        </button>
        -->

        <button class="modal-action-btn" id="compare-words">

          <span class="material-symbols-outlined">compare</span>

          Сравнить словари

        </button>

        <button class="modal-action-btn danger" id="remove-friend">

          <span class="material-symbols-outlined">person_remove</span>

          Удалить из друзей

        </button>

      </div>

    </div>

  `;

  // Закрытие

  const closeBtn = modal.querySelector('.friend-modal-close');

  closeBtn.onclick = () => {

    modal.classList.remove('open');

    setTimeout(() => modal.remove(), 300);

    currentModal = null;

  };

  modal.addEventListener('click', e => {

    if (e.target === modal) {

      modal.classList.remove('open');

      setTimeout(() => modal.remove(), 300);

      currentModal = null;

    }

  });

  // Кнопки действий

  modal.querySelector('#remove-friend').onclick = async () => {

    const userId = window.currentUserId;

    if (!userId) {

      toast('Ошибка: не удалось определить пользователя', 'danger');

      return;

    }

    try {

      await rejectFriendRequest(userId, friendId);

      await loadFriendsDataNew();

      toast('Друг удалён!', 'warning');

      modal.classList.remove('open');

      setTimeout(() => modal.remove(), 300);

      currentModal = null;

    } catch (e) {

      toast('Ошибка', 'danger');

    }

  };

  // ЗАКОММЕНТИРОВАНО: Обработчик кнопки бросить вызов
  /*
  modal.querySelector('#challenge-friend').onclick = () => {

    toast(`🚀 Вызов ${friend.username} на недельный челлендж!`, 'info');

    // TODO: реализовать челлендж

  };
  */

  modal.querySelector('#compare-words').onclick = async () => {

    const result = await compareDictionaries(window.currentUserId, friendId);

    showComparisonModal(result, friend.username);

  };

  document.body.appendChild(modal);

  currentModal = modal;

  // Показываем модалку с анимацией

  requestAnimationFrame(() => {

    modal.classList.add('open');

  });

}

// ===== НОВЫЙ ЛИДЕРБОРД С ПЕРИОДАМИ =====

async function loadLeaderboard(period = 'week') {

  const container = document.getElementById('friends-leaderboard-list');

  if (!container) return;

  container.innerHTML = '<div class="loading-spinner"></div>';

  try {

    // Получаем друзей через db.js функцию

    const friends = await getFriends(window.currentUserId);

    const friendIds = friends.map(f => f.id);

    const allIds = [window.currentUserId, ...friendIds];

    let scores = [];

    if (period === 'all') {

      // Считаем XP за всё время из xp_log
      const { data: logs } = await supabase

        .from('xp_log')

        .select('user_id, amount')

        .in('user_id', allIds);

      const { data: profiles } = await supabase

        .from('profiles')

        .select('id, username, xp, level')

        .in('id', allIds);

      const xpMap = {};

      (logs || []).forEach(l => {

        xpMap[l.user_id] = (xpMap[l.user_id] || 0) + l.amount;

      });

      scores = (profiles || []).map(p => ({

        ...p,

        periodXp: xpMap[p.id] || 0,

      }));

    } else {

      // Считаем XP за период из xp_log

      const since =

        period === 'week'

          ? new Date(Date.now() - 7 * 86400000).toISOString()

          : new Date(Date.now() - 30 * 86400000).toISOString();

      const { data: logs } = await supabase

        .from('xp_log')

        .select('user_id, amount')

        .in('user_id', allIds)

        .gte('created_at', since);

      const { data: profiles } = await supabase

        .from('profiles')

        .select('id, username, xp, level')

        .in('id', allIds);

      const xpMap = {};

      (logs || []).forEach(l => {

        xpMap[l.user_id] = (xpMap[l.user_id] || 0) + l.amount;

      });

      scores = (profiles || []).map(p => ({

        ...p,

        periodXp: xpMap[p.id] || 0,

      }));

    }

    scores.sort((a, b) => b.periodXp - a.periodXp);

    renderLeaderboard(scores, period);

  } catch (err) {

    console.error('loadLeaderboard error:', err);

    container.innerHTML =

      '<p style="color:var(--muted);text-align:center">Ошибка загрузки</p>';

  }

}

function renderLeaderboard(scores, period) {

  const container = document.getElementById('friends-leaderboard-list');

  if (!container) return;

  if (!scores.length) {

    container.innerHTML = `

      <div style="text-align:center;padding:2rem;color:var(--muted)">

        <span class="material-symbols-outlined" style="font-size: 3rem;">group_off</span>

        <p style="margin-top:0.5rem">Добавь друзей чтобы соревноваться!</p>

      </div>

    `;

    return;

  }

  // Ограничиваем до топ-5

  const topScores = scores.slice(0, 5);

  const medals = ['looks_one', 'looks_two', 'looks_3'];

  container.innerHTML = topScores

    .map((user, i) => {

      const isMe = user.id === window.currentUserId;

      const medal = medals[i] || `${i + 1}`;

      const label =

        period === 'all'

          ? 'XP всего'

          : period === 'week'

            ? 'XP за неделю'

            : 'XP за месяц';

      return `

      <div class="lb-row ${isMe ? 'lb-row--me' : ''}" data-userid="${user.id}">

        <div class="lb-rank">

          ${i < 3 ? `<span class="material-symbols-outlined" style="font-size: 1.2rem; color: ${i === 0 ? 'var(--primary)' : i === 1 ? 'var(--muted)' : 'var(--warning)'};">${medal}</span>` : medal}

        </div>

        <div class="lb-avatar">${user.username?.[0]?.toUpperCase() || '?'}</div>

        <div class="lb-info">

          <div class="lb-name">${user.username || 'Аноним'} ${isMe ? '<span class="lb-you-badge">Ты</span>' : ''}</div>

          <div class="lb-level">Уровень ${user.level || 1}</div>

        </div>

        <div class="lb-xp">

          <div class="lb-xp-num">${user.periodXp.toLocaleString()}</div>

          <div class="lb-xp-label">${label}</div>

        </div>

      </div>

    `;

    })

    .join('');

}

function switchLbPeriod(btn) {

  document

    .querySelectorAll('.lb-tab')

    .forEach(t => t.classList.remove('active'));

  btn.classList.add('active');

  loadLeaderboard(btn.dataset.period);

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

        <button class="btn-icon accept-req-btn" data-id="${req.id}" title="Принять">

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

// --- ПОИСК В МОДАЛКЕ ДРУЗЕЙ ---

let addFriendSearchTimer = null;

addFriendSearchInput?.addEventListener('input', function (e) {

  clearTimeout(addFriendSearchTimer);

  const q = e.target.value.trim();

  if (!q || q.length < 2) {

    if (addFriendSearchResults) addFriendSearchResults.innerHTML = '';

    return;

  }

  addFriendSearchTimer = setTimeout(() => {

    doAddFriendSearch(q);

  }, 400);

});

async function doAddFriendSearch(q) {

  if (!addFriendSearchResults) return;

  addFriendSearchResults.innerHTML = '<div class="loading-spinner"></div>';

  try {

    const users = await searchUsers(q, window.currentUserId);

    if (!users || !users.length) {

      addFriendSearchResults.innerHTML = `

        <div class="friends-empty">

          <span class="material-symbols-outlined">search_off</span>

          <p>Пользователи не найдены</p>

        </div>

      `;

      return;

    }

    addFriendSearchResults.innerHTML = users

      .map(user => {

        const statusText = user.friendshipStatus === 'pending' ? '' : '';

        const btn =

          user.friendshipStatus === 'pending'

            ? `<button class="btn-pill btn-pill--secondary" disabled style="pointer-events: none;">Ожидание</button>`

            : user.friendshipStatus === 'accepted'

              ? `<button class="btn-pill btn-pill--secondary" disabled style="pointer-events: none;">В друзьях</button>`

              : `<button class="btn-pill btn-pill--secondary add-friend-btn" data-user-id="${user.id}">

                   <span class="material-symbols-outlined">person_add</span>

                   Добавить

                 </button>`;

        return `

          <div class="friend-card-new no-arrow">

            <div class="friend-info">

              <div class="friend-username">${user.username}</div>

              <div class="friend-stats">

                <span>Уровень ${user.level || 1}</span>

                <span>${user.xp || 0} XP</span>

              </div>

              ${statusText}

            </div>

            ${btn}

          </div>

        `;

      })

      .join('');

    // Обработчики для кнопок добавления

    addFriendSearchResults.querySelectorAll('.add-friend-btn').forEach(btn => {

      btn.addEventListener('click', async () => {

        const userId = btn.dataset.userId;

        try {

          await sendFriendRequest(window.currentUserId, userId);

          btn.disabled = true;

          btn.innerHTML =

            '<span class="material-symbols-outlined">check</span> Отправлено';

          window.toast?.('Заявка в друзья отправлена', 'success');

        } catch (err) {

          console.error('[SEARCH] Ошибка отправки:', err);

          window.toast?.('Ошибка: ' + err.message, 'danger');

        }

      });

    });

  } catch (err) {

    console.error('[SEARCH] Ошибка поиска:', err);

    addFriendSearchResults.innerHTML = `

      <div class="friends-empty">

        <span class="material-symbols-outlined">error</span>

        <p>Ошибка поиска</p>

      </div>

    `;

  }

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

        </div>

      `;

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

      btn.addEventListener('click', async () => {

        const userId = btn.dataset.id;

        try {

          await sendFriendRequest(window.currentUserId, userId);

          btn.disabled = true;

          btn.innerHTML =

            '<span class="material-symbols-outlined">check</span> Отправлено';

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

  // Если переключаемся с чата на другую пилюлю, закрываем чат и убираем классы

  if (window.currentChatFriend && activeFriendsPanel !== 'chat') {

    const chatContainer = document.getElementById('chat-messages');

    const friendsList = document.getElementById('chat-friends-list');

    if (chatContainer && friendsList) {

      chatContainer.style.display = 'none';

      friendsList.style.display = 'block';

      window.currentChatFriend = null;

      // Удаляем классы полноэкранного режима

      const fpanelChat = document.getElementById('fpanel-chat');

      fpanelChat.classList.remove('chat-fullscreen');

      document.body.classList.remove('chat-open');

    }

  }

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

// --- ИНВАЙТ ФУНКЦИИ ---

window.generateInviteLink = async function () {

  // Вызываем обновленную функцию

  await generateInviteLink();

};

// --- ЗАЩИТА ОТ АВТОЗАПОЛНЕНИЯ НА МОБИЛКАХ ---

function hardenStudyInputs(root = document) {

  const selectors = [

    '#add-word-form input',

    '#add-idiom-form input',

    '#add-story-form input, #add-story-form textarea',

    '#single-form input',

    '#confirm-input',

    '.word-card.editing input',

    '.word-card.editing textarea',

    '#ta-input',

    '#dict-input',

    '.e-en',

    '.e-ru',

    '.e-phonetic',

    '.e-ex',

    '.e-ex-translation',

    '.e-tags',

    '.e-idiom',

    '.e-meaning',

    '.e-definition',

    '.e-example',

    '.e-exampletranslation',

    '#friends-search-input-new',

    '#add-friend-search-input',

  ];

  root.querySelectorAll(selectors.join(',')).forEach(input => {

    input.setAttribute('autocomplete', 'off');

    input.setAttribute('autocorrect', 'off');

    input.setAttribute('autocapitalize', 'off');

    input.setAttribute('spellcheck', 'false');

    if (!input.getAttribute('inputmode')) {

      input.setAttribute('inputmode', 'text');

    }

    if (!input.getAttribute('name')) {

      input.setAttribute(

        'name',

        'study-' +

          (input.id || input.className || Math.random().toString(36).slice(2)),

      );

    }

  });

}

// --- INIT TAB ---

document.addEventListener('DOMContentLoaded', () => {

  // Защищаем все учебные поля от автозаполнения

  hardenStudyInputs();

  // Предварительная загрузка историй (для быстрого отображения)
  getAvailableStories().then(stories => {
    window.stories = stories;
    console.log('[STORIES] Истории предварительно загружены:', stories.length);
  });

  // Инициализация floating кнопок

  floatingWordBtn = document.getElementById('floating-add-word-btn');

  floatingIdiomBtn = document.getElementById('floating-add-idiom-btn');

  floatingChatBtn = document.getElementById('floating-chat-btn');

  floatingFriendBtn = document.getElementById('floating-add-friend-btn');

  if (document.getElementById('tab-friends')) {

    loadFriendsDataNew();

  }

});

// ============================================================

//  BOTTOM SHEET — Настройки практики

// ============================================================

(function initPracticeBottomSheet() {

  const sheet = document.getElementById('practice-bottom-sheet');

  const backdrop = document.getElementById('practice-bs-backdrop');

  const trigger = document.getElementById('practice-bs-trigger');

  const summary = document.getElementById('bs-trigger-summary');

  if (!sheet || !backdrop || !trigger) return;

  // --- Метки для summary ---

  const filterLabels = {

    all: 'Все слова',

    learning: 'Учу',

    random: 'Случайные',

    due: 'К повторению',

  };

  const idiomFilterLabels = {

    all: 'Все идиомы',

    learning: 'Учу',

    random: 'Случайные',

    due: 'К повторению',

  };

  const verbFilterLabels = {

    all: 'Редкие',

    often: 'Частые',

  };

  const dirLabels = {

    both: 'EN+RU',

    'en-ru': 'EN→RU',

    'ru-en': 'RU→EN',

  };

  const countLabels = {

    5: '5 слов',

    10: '10 слов',

    20: '20 слов',

    50: '50 слов',

    all: 'Все',

  };

  // --- Обновить summary в триггере ---

  window.updateSummary = function updateSummary() {

    // Определяем контейнер фильтров в зависимости от режима

    let filterContainer;

    if (practiceMode === 'verbs') {

      filterContainer = document.getElementById('filter-chips-verbs');

    } else {

      // Для слов проверяем оба контейнера
      const primaryContainer = document.getElementById('filter-chips-words');
      const secondaryContainer = document.getElementById('filter-chips-words-secondary');
      const activeInPrimary = primaryContainer?.querySelector('.chip.on');
      const activeInSecondary = secondaryContainer?.querySelector('.chip.on');
      filterContainer = activeInPrimary ? primaryContainer : secondaryContainer;

    }

    const filterVal =

      filterContainer?.querySelector('.chip.on')?.dataset.filterW || 'all';

    const dirVal =

      document.querySelector('.chip[data-dir].on')?.dataset.dir || 'both';

    const pronOn =

      document.querySelector('.chip[data-autopron].on')?.dataset.autopron !==

      'off';

    const duePill = document.getElementById('due-pill')?.textContent || '0';

    // Используем разные лейблы для глаголов, идиом и слов

    let labels;

    if (practiceMode === 'verbs') {

      labels = verbFilterLabels;

    } else if (practiceMode === 'idioms') {

      labels = idiomFilterLabels;

    } else {

      labels = filterLabels;

    }

    let filterText = labels[filterVal] || 'Все';

    if (filterVal === 'due' && parseInt(duePill) > 0)

      filterText += ` (${duePill})`;

    const soundIcon = pronOn

      ? '<span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle;">volume_up</span>'

      : '<span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle;">volume_off</span>';

    // Для глаголов не показываем направление

    if (practiceMode === 'verbs') {

      summary.innerHTML = `${filterText} · ${soundIcon}`;

    } else {

      summary.innerHTML = `${filterText} · ${dirLabels[dirVal]} · ${soundIcon}`;

    }

    // Синхронизируем состояние bs-опций с реальными чипами

    syncSheetState();

  }

  // --- Синхронизировать визуальное состояние шторки ---

  function syncSheetState() {

    // Определяем контейнер фильтров в зависимости от режима

    let filterContainer;

    if (practiceMode === 'verbs') {

      filterContainer = document.getElementById('filter-chips-verbs');

    } else {

      // Для слов проверяем оба контейнера
      const primaryContainer = document.getElementById('filter-chips-words');
      const secondaryContainer = document.getElementById('filter-chips-words-secondary');
      const activeInPrimary = primaryContainer?.querySelector('.chip.on');
      const activeInSecondary = secondaryContainer?.querySelector('.chip.on');
      filterContainer = activeInPrimary ? primaryContainer : secondaryContainer;

    }

    const filterVal =

      filterContainer?.querySelector('.chip.on')?.dataset.filterW || 'all';

    const dirVal =

      document.querySelector('.chip[data-dir].on')?.dataset.dir || 'both';

    const pronVal =

      document.querySelector('.chip[data-autopron].on')?.dataset.autopron ||

      'on';

    const countVal =

      document.querySelector('.chip[data-count].on')?.dataset.count || '10';

    // Обновляем заголовок секции фильтра в зависимости от режима

    const filterSectionLabel = document.getElementById('bs-filter-section-label');

    if (filterSectionLabel) {

      let labelText = 'Слова для практики';

      if (practiceMode === 'verbs') {

        labelText = 'Глаголы для практики';

      } else if (practiceMode === 'idioms') {

        labelText = 'Идиомы для практики';

      }

      filterSectionLabel.innerHTML = `<span class="material-symbols-outlined">filter_list</span> ${labelText}`;

    }

    // Скрываем секцию направления для глаголов

    const dirSection = document.getElementById('bs-dir-section');

    if (dirSection) {

      dirSection.style.display = practiceMode === 'verbs' ? 'none' : '';

    }

    // Обновляем список фильтров в зависимости от режима

    const filterList = document.getElementById('bs-filter-list');

    if (filterList) {

      let optionsHtml = '';

      if (practiceMode === 'verbs') {

        optionsHtml = `

          <button class="bs-option active" data-bs-filter-w="often">

            <span class="material-symbols-outlined bs-opt-icon">star</span>

            <span class="bs-opt-text">Частые</span>

            <span class="material-symbols-outlined bs-opt-check">check_circle</span>

          </button>

          <button class="bs-option" data-bs-filter-w="all">

            <span class="material-symbols-outlined bs-opt-icon">list</span>

            <span class="bs-opt-text">Редкие</span>

            <span class="material-symbols-outlined bs-opt-check">check_circle</span>

          </button>

        `;

      } else if (practiceMode === 'idioms') {

        optionsHtml = `

          <button class="bs-option active" data-bs-filter-w="all">

            <span class="material-symbols-outlined bs-opt-icon">list</span>

            <span class="bs-opt-text">Все идиомы</span>

            <span class="material-symbols-outlined bs-opt-check">check_circle</span>

          </button>

          <button class="bs-option" data-bs-filter-w="learning">

            <span class="material-symbols-outlined bs-opt-icon">cognition_2</span>

            <span class="bs-opt-text">
              Учу
              <span class="bs-learning-badge" id="bs-learning-badge" style="margin-left: auto; background: var(--primary); color: white; padding: 1px 6px; border-radius: 10px; font-size: 0.72rem; font-weight: 700; display: inline-flex; align-items: center;">0</span>
            </span>

            <span class="material-symbols-outlined bs-opt-check">check_circle</span>

          </button>

          <button class="bs-option" data-bs-filter-w="due">

            <span class="material-symbols-outlined bs-opt-icon">schedule</span>

            <span class="bs-opt-text">
              К повторению
              <span class="bs-due-badge" id="bs-due-badge" style="margin-left: auto; background: var(--primary); color: white; padding: 1px 6px; border-radius: 10px; font-size: 0.72rem; font-weight: 700; display: inline-flex; align-items: center;">0</span>
            </span>

            <span class="material-symbols-outlined bs-opt-check">check_circle</span>

          </button>

        `;

      } else {

        // Опции для слов

        optionsHtml = `

          <button class="bs-option active" data-bs-filter-w="all">

            <span class="material-symbols-outlined bs-opt-icon">list</span>

            <span class="bs-opt-text">Все слова</span>

            <span class="material-symbols-outlined bs-opt-check">check_circle</span>

          </button>

          <button class="bs-option" data-bs-filter-w="learning">

            <span class="material-symbols-outlined bs-opt-icon">cognition_2</span>

            <span class="bs-opt-text">
              Учу
              <span class="bs-learning-badge" id="bs-learning-badge" style="margin-left: auto; background: var(--primary); color: white; padding: 1px 6px; border-radius: 10px; font-size: 0.72rem; font-weight: 700; display: inline-flex; align-items: center;">0</span>
            </span>

            <span class="material-symbols-outlined bs-opt-check">check_circle</span>

          </button>

          <button class="bs-option" data-bs-filter-w="due">

            <span class="material-symbols-outlined bs-opt-icon">schedule</span>

            <span class="bs-opt-text">
              К повторению
              <span class="bs-due-badge" id="bs-due-badge" style="margin-left: auto; background: var(--primary); color: white; padding: 1px 6px; border-radius: 10px; font-size: 0.72rem; font-weight: 700; display: inline-flex; align-items: center;">0</span>
            </span>

            <span class="material-symbols-outlined bs-opt-check">check_circle</span>

          </button>

        `;

      }

      filterList.innerHTML = optionsHtml;

      // Переназначаем обработчики кликов

      filterList.querySelectorAll('.bs-option').forEach(opt => {

        opt.addEventListener('click', () => {

          const filter = opt.dataset.bsFilterW;

          // Определяем контейнер фильтров в зависимости от режима

          let filterContainer;

          if (practiceMode === 'verbs') {

            filterContainer = document.getElementById('filter-chips-verbs');

          } else {

            filterContainer = document.getElementById('filter-chips-words');

          }

          // Находим соответствующий чип в правильном контейнере и кликаем на него

          const chip = filterContainer?.querySelector(`.chip[data-filter-w="${filter}"]`);

          if (chip) chip.click();

        });

      });

    }

    // Фильтр

    document.querySelectorAll('#bs-filter-list .bs-option').forEach(opt => {

      opt.classList.toggle('active', opt.dataset.bsFilterW === filterVal);

    });

    // Количество слов

    document.querySelectorAll('#bs-count-seg .bs-seg-btn').forEach(btn => {

      btn.classList.toggle('active', btn.dataset.bsCount === countVal);

    });

    // Автопрон

    document.querySelectorAll('#bs-autopron-seg .bs-seg-btn').forEach(btn => {

      btn.classList.toggle('active', btn.dataset.bsAutopron === pronVal);

    });

    // Направление

    document.querySelectorAll('#bs-dir-seg .bs-seg-btn').forEach(btn => {

      btn.classList.toggle('active', btn.dataset.bsDir === dirVal);

    });

    // due badge

    const duePill = document.getElementById('due-pill')?.textContent || '0';

    const bsBadge = document.getElementById('bs-due-badge');

    if (bsBadge) {
      bsBadge.textContent = duePill;
      bsBadge.style.display = parseInt(duePill) > 0 ? 'inline-flex' : 'none';
    }

    // learning badge

    const learningPill = document.getElementById('learning-pill')?.textContent || '0';

    const bsLearningBadge = document.getElementById('bs-learning-badge');

    if (bsLearningBadge) {
      bsLearningBadge.textContent = learningPill;
      bsLearningBadge.style.display = parseInt(learningPill) > 0 ? 'inline-flex' : 'none';
    }

  }

  // --- Открыть ---

  function openSheet() {

    syncSheetState();

    sheet.classList.add('open');

    backdrop.classList.add('visible');

    document.body.classList.add('bs-open');

    document.body.style.overflow = 'hidden';

  }

  // --- Закрыть ---

  function closeSheet() {

    sheet.classList.remove('open', 'dragging');

    sheet.style.transform = '';

    backdrop.classList.remove('visible');

    document.body.classList.remove('bs-open');

    document.body.style.overflow = '';

  }

  // --- Клик триггера ---

  trigger.addEventListener('click', openSheet);

  // --- Клик backdrop ---

  backdrop.addEventListener('click', closeSheet);

  // --- Клики по опциям фильтра ---

  document.querySelectorAll('#bs-filter-list .bs-option').forEach(opt => {

    opt.addEventListener('click', () => {

      const val = opt.dataset.bsFilterW;

      // Кликаем соответствующий скрытый чип

      const realChip = document.querySelector(`.chip[data-filter-w="${val}"]`);

      if (realChip) realChip.click();

      syncSheetState();

      updateSummary();

      // Небольшая задержка для анимации check, потом закрываем

      setTimeout(closeSheet, 180);

    });

  });

  // --- Клики по сегментам Количество слов ---

  document.querySelectorAll('#bs-count-seg .bs-seg-btn').forEach(btn => {

    btn.addEventListener('click', () => {

      const val = btn.dataset.bsCount;

      const realChip = document.querySelector(`.chip[data-count="${val}"]`);

      if (realChip) realChip.click();

      document

        .querySelectorAll('#bs-count-seg .bs-seg-btn')

        .forEach(b => b.classList.toggle('active', b === btn));

      updateSummary();

    });

  });

  // --- Клики по сегментам Автопрон ---

  document.querySelectorAll('#bs-autopron-seg .bs-seg-btn').forEach(btn => {

    btn.addEventListener('click', () => {

      const val = btn.dataset.bsAutopron;

      const realChip = document.querySelector(`.chip[data-autopron="${val}"]`);

      if (realChip) realChip.click();

      document

        .querySelectorAll('#bs-autopron-seg .bs-seg-btn')

        .forEach(b => b.classList.toggle('active', b === btn));

      updateSummary();

    });

  });

  // --- Клики по сегментам Направления ---

  document.querySelectorAll('#bs-dir-seg .bs-seg-btn').forEach(btn => {

    btn.addEventListener('click', () => {

      const val = btn.dataset.bsDir;

      const realChip = document.querySelector(`.chip[data-dir="${val}"]`);

      if (realChip) realChip.click();

      document

        .querySelectorAll('#bs-dir-seg .bs-seg-btn')

        .forEach(b => b.classList.toggle('active', b === btn));

      updateSummary();

    });

  });

  // --- Свайп вниз для закрытия ---

  const dragArea = document.getElementById('bs-drag-area');

  let startY = 0,

    currentY = 0,

    isDragging = false;

  dragArea.addEventListener(

    'touchstart',

    e => {

      startY = e.touches[0].clientY;

      isDragging = true;

      sheet.classList.add('dragging');

    },

    { passive: true },

  );

  document.addEventListener(

    'touchmove',

    e => {

      if (!isDragging) return;

      currentY = e.touches[0].clientY;

      const delta = Math.max(0, currentY - startY); // только вниз

      sheet.style.transform = `translateY(${delta}px)`;

      // Затемнение backdrop пропорционально свайпу

      const progress = Math.min(delta / 300, 1);

      backdrop.style.background = `rgba(0,0,0,${0.45 * (1 - progress)})`;

    },

    { passive: true },

  );

  document.addEventListener('touchend', () => {

    if (!isDragging) return;

    isDragging = false;

    const delta = currentY - startY;

    sheet.classList.remove('dragging');

    sheet.style.transform = '';

    backdrop.style.background = '';

    if (delta > 90) {

      closeSheet();

    }

    // Иначе snap back (transition сам анимирует)

  });

  // --- Клавиша Escape ---

  document.addEventListener('keydown', e => {

    if (e.key === 'Escape' && sheet.classList.contains('open')) closeSheet();

  });

  // --- Инициализация summary при загрузке ---

  // Ждём пока чипы проинициализируются

  setTimeout(updateSummary, 500);

  // Обновляем summary когда меняются чипы (на десктопе)

  document

    .querySelectorAll(

      '.chip[data-filter-w], .chip[data-dir], .chip[data-autopron], .chip[data-count]',

    )

    .forEach(c =>

      c.addEventListener('click', () => setTimeout(updateSummary, 50)),

    );

  window._updateBsSummary = updateSummary; // для внешнего вызова если нужно

  // === УЛУЧШЕННАЯ ПРОВЕРКА РЕЧИ (объединяет всё лучшее) ===

  window.isSpeechCorrect = function (spoken, correct, confidence = null) {

    if (!spoken || !correct) {

      return false;

    }

    let s = spoken.toLowerCase().trim();

    const c = correct.toLowerCase().trim();

    // Очищаем от скобок и знаков препинания для корректного сравнения

    const cleanText = text =>

      text

        .replace(/\([^)]*\)/g, '') // Убираем всё в скобках вместе со скобками

        .replace(/[.,!?;:'"()\-]/g, '') // Убираем знаки препинания

        .replace(/\s+/g, ' ') // Убираем лишние пробелы

        .trim();

    s = cleanText(s);

    const cleanedCorrect = cleanText(c);

    // Определяем, это фраза (несколько слов) или одно слово

    const isMultiWord = cleanedCorrect.includes(' ');

    // Для фраз используем пословное сравнение

    if (isMultiWord) {

      const wordsSpoken = s.split(/\s+/);

      const wordsCorrect = cleanedCorrect.split(/\s+/);

      // Точное совпадение фразы

      if (s === cleanedCorrect) {

        return true;

      }

      // Пословное сравнение - считаем сколько слов совпало

      const commonWords = wordsSpoken.filter(w => wordsCorrect.includes(w));

      const wordSimilarity = commonWords.length / wordsCorrect.length;

      // Порог для фраз - 70% слов должно совпасть

      if (wordSimilarity >= 0.7) {

        return true;

      }

      // Дополнительная проверка через Левенштейн для полной фразы

      const distance = levenshteinDistance(s, cleanedCorrect);

      const maxLen = Math.max(s.length, cleanedCorrect.length);

      const similarity = 1 - distance / maxLen;

      // Для фраз более мягкий порог - 65%

      if (similarity >= 0.65) {

        return true;

      }

      return false;

    }

    // Для одного слова - старая логика (берём первое слово, если в транскрипте нескольких)

    if (s.includes(' ')) {

      s = s.split(/\s+/)[0];

    }

    // 1. Точное совпадение

    if (s === cleanedCorrect) {

      return true;

    }

    // 2. Омофоны

    if (window.isHomophone && window.isHomophone(s, cleanedCorrect)) {

      return true;

    }

    // 3. Расстояние Левенштейна (уже есть в коде)

    const distance = levenshteinDistance(s, cleanedCorrect);

    const maxLen = Math.max(s.length, cleanedCorrect.length);

    const similarity = 1 - distance / maxLen;

    // 4. Определяем порог в зависимости от длины слова

    let threshold;

    if (cleanedCorrect.length <= 3) {

      threshold = 0.85; // очень короткие (cat, dog) – строго

    } else if (cleanedCorrect.length <= 5) {

      threshold = 0.78; // короткие (seize, table) – умеренно

    } else {

      threshold = 0.72; // длинные (language, through) – мягче

    }

    // 5. Если уверенность низкая, ужесточаем порог

    if (confidence !== null && confidence < 0.6) {

      threshold += 0.1;

    }

    // 6. Если совпадение слишком низкое – сразу отказ (защита от мямли)

    if (similarity < 0.5) {

      return false;

    }

    const result = similarity >= threshold;

    return result;

  };

})();

// ========== Инициализация социальных вкладок ==========

// Отображение входящих приглашений в челленджи (ЗАКОММЕНТИРОВАНО)
/*
async function renderChallengeInvites() {

  const section = document.getElementById('challenge-invites-list');

  const container = document.getElementById('challenge-invites-container');

  if (!container || !section) return;

  try {

    const invites = await window.getChallengeInvites(window.currentUserId);

    if (invites.length === 0) {

      section.style.display = 'none';

      return;

    }

    section.style.display = 'block';

    const typeIcons = {

      xp: 'bolt',

      words: 'menu_book',

      streak: 'local_fire_department',

      practice_time: 'timer',

    };

    container.innerHTML = invites

      .map(invite => {

        const ch = invite.challenge;

        const icon = typeIcons[ch.type] || 'bolt';

        const deadline = ch.end_date

          ? new Date(ch.end_date).toLocaleDateString('ru-RU', {

              day: '2-digit',

              month: '2-digit',

            })

          : 'Без срока';

        return `

        <div class="challenge-invite-card" data-invite-id="${invite.id}">

          <div class="challenge-invite-icon">

            <span class="material-symbols-outlined">${icon}</span>

          </div>

          <div class="challenge-invite-info">

            <div class="challenge-invite-title">${esc(ch.title)}</div>

            <div class="challenge-invite-meta">от ${esc(invite.sender.username)} • До ${deadline}</div>

          </div>

          <div class="challenge-invite-actions">

            <button class="challenge-invite-btn accept" data-invite-id="${invite.id}" title="Принять">

              <span class="material-symbols-outlined">check</span>

            </button>

            <button class="challenge-invite-btn decline" data-invite-id="${invite.id}" title="Отклонить">

              <span class="material-symbols-outlined">close</span>

            </button>

          </div>

        </div>

      `;

      })

      .join('');

    // Обработчики кнопок

    container.querySelectorAll('.challenge-invite-btn.accept').forEach(btn => {

      btn.addEventListener('click', async () => {

        const inviteId = btn.dataset.inviteId;

        try {

          await window.acceptChallengeInvite(inviteId, window.currentUserId);

          toast(

            'Приглашение принято! Вы присоединились к челленджу',

            'success',

          );

          renderChallengeInvites(); // Обновляем список

          renderChallenges(); // Обновляем челленджи

        } catch (e) {

          toast('Ошибка принятия приглашения', 'danger');

        }

      });

    });

    container.querySelectorAll('.challenge-invite-btn.decline').forEach(btn => {

      btn.addEventListener('click', async () => {

        const inviteId = btn.dataset.inviteId;

        try {

          await window.declineChallengeInvite(inviteId, window.currentUserId);

          toast('Приглашение отклонено', 'info');

          renderChallengeInvites(); // Обновляем список

        } catch (e) {

          toast('Ошибка отклонения приглашения', 'danger');

        }

      });

    });

  } catch (e) {

    console.error('Error loading challenge invites:', e);

    section.style.display = 'none';

  }

}
*/

// Отображение челленджей (ЗАКОММЕНТИРОВАНО)
/*
async function renderChallenges() {

  const container = document.getElementById('challenges-list');

  if (!container) return;

  try {

    const challenges = await window.getAllActiveChallenges(

      window.currentUserId,

    );

    if (!challenges.length) {

      container.innerHTML =

        '<div class="friends-empty"><span class="material-symbols-outlined">sports_score</span><p>Нет активных челленджей. Создай свой!</p></div>';

      return;

    }

    container.innerHTML = challenges

      .map(ch => {

        // Получаем прогресс текущего пользователя из participants

        const myParticipant = ch.participants?.find(

          p => p.user_id === window.currentUserId,

        );

        const progress = myParticipant?.progress || 0;

        const target = ch.target || 100;

        const participants = ch.participants || [];

        const participantsCount = participants.length;

        // Имена участников (максимум 3, потом "+N")

        const participantNames = participants

          .slice(0, 3)

          .map(p => {

            if (p.user_id === window.currentUserId) return 'Вы';

            // username теперь в p.user.username из-за join с profiles

            return p.user?.username || p.username || 'Друг';

          })

          .join(', ');

        const moreCount =

          participantsCount > 3 ? ` +${participantsCount - 3}` : '';

        const progressPercent = Math.min(

          Math.round((progress / target) * 100),

          100,

        );

        const progressDegrees = (progressPercent / 100) * 360;

        const deadline = ch.end_date

          ? new Date(ch.end_date).toLocaleDateString('ru-RU', {

              day: '2-digit',

              month: '2-digit',

            })

          : 'Без срока';

        const typeLabels = {

          xp: 'XP',

          words: 'Слова',

          streak: 'Серия',

          practice_time: 'Время',

        };

        const typeIcons = {

          xp: 'bolt',

          words: 'menu_book',

          streak: 'local_fire_department',

          practice_time: 'timer',

        };

        const typeLabel = typeLabels[ch.type] || ch.type || 'XP';

        const typeIcon = typeIcons[ch.type] || 'bolt';

        const progressLabel =

          ch.type === 'xp'

            ? 'XP'

            : ch.type === 'words'

              ? 'слов'

              : ch.type === 'practice_time'

                ? 'минут'

                : 'дней';

        const isOwner = ch.creator_id === window.currentUserId;

        return `

      <div class="challenge-card" data-challenge="${ch.id}">

        <div class="challenge-header">

          <div class="challenge-icon">

            <span class="material-symbols-outlined">${typeIcon}</span>

          </div>

          <div class="challenge-info">

            <h4 class="challenge-title">${esc(ch.title || 'Челлендж')}</h4>

            <div class="challenge-meta">

              <span class="challenge-type">

                <span class="material-symbols-outlined">${typeIcon}</span> ${typeLabel}

              </span>

              <span class="challenge-target">${target}</span>

              <span class="challenge-deadline">До ${deadline}</span>

            </div>

          </div>

          <div class="challenge-progress">

            <div class="progress-ring" style="background: conic-gradient(var(--primary) 0deg, var(--primary) ${progressDegrees}deg, var(--surface) ${progressDegrees}deg)">

              <span class="progress-text">${progressPercent}%</span>

            </div>

          </div>

        </div>

        <div class="challenge-body">

          <div class="progress-bar">

            <div class="progress-fill" style="width: ${progressPercent}%"></div>

          </div>

          <div class="challenge-stats">

            <span>Прогресс: ${progress} / ${target} ${progressLabel}</span>

          </div>

          <div class="challenge-participants">

            <span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 4px;">group</span>

            ${participantsCount} участник${participantsCount > 1 ? 'ов' : ''}: ${participantNames}${moreCount}

          </div>

        </div>

        <div class="challenge-actions">

          ${

            isOwner

              ? `

            <button class="modal-action-btn invite-challenge-btn" data-id="${ch.id}">

              <span class="material-symbols-outlined">person_add</span>

              Пригласить друга

            </button>

            <button class="btn-icon btn-icon--danger delete-challenge-btn" data-id="${ch.id}" title="Удалить челлендж">

              <span class="material-symbols-outlined">delete</span>

            </button>

          `

              : `

            <button class="modal-action-btn leave-challenge-btn" data-id="${ch.id}">

              <span class="material-symbols-outlined">logout</span>

              Выйти из челленджа

            </button>

          `

          }

        </div>

      </div>

    `;

      })

      .join('');

    // Обработчики для кнопок удаления

    container.querySelectorAll('.delete-challenge-btn').forEach(btn => {

      btn.addEventListener('click', () => {

        const challengeId = btn.dataset.id;

        document.getElementById('delete-challenge-modal').classList.add('open');

        document.body.classList.add('modal-open');

        const confirmBtn = document.getElementById('confirm-delete-challenge');

        const cancelBtn = document.getElementById('cancel-delete-challenge');

        const modal = document.getElementById('delete-challenge-modal');

        const cleanup = () => {

          confirmBtn.removeEventListener('click', handleConfirm);

          cancelBtn.removeEventListener('click', handleCancel);

        };

        const handleConfirm = async () => {

          try {

            await deleteChallenge(challengeId, window.currentUserId);

            modal.classList.remove('open');

            document.body.classList.remove('modal-open');

            toast('Челлендж удалён', 'success');

            renderChallenges();

            cleanup();

          } catch (e) {

            console.error('Error deleting challenge:', e);

            toast('Ошибка удаления: ' + (e.message || ''), 'danger');

            cleanup();

          }

        };

        const handleCancel = () => {

          modal.classList.remove('open');

          document.body.classList.remove('modal-open');

          cleanup();

        };

        confirmBtn.addEventListener('click', handleConfirm);

        cancelBtn.addEventListener('click', handleCancel);

      });

    });

    // Обработчики для кнопок приглашения

    container.querySelectorAll('.invite-challenge-btn').forEach(btn => {

      btn.addEventListener('click', () => {

        const challengeId = btn.dataset.id;

        openInviteChallengeModal(challengeId);

      });

    });

    // Обработчики для кнопок выхода из челленджа

    container.querySelectorAll('.leave-challenge-btn').forEach(btn => {

      btn.addEventListener('click', async () => {

        const challengeId = btn.dataset.id;

        if (confirm('Выйти из челленджа? Прогресс будет потерян.')) {

          try {

            await leaveChallenge(challengeId, window.currentUserId);

            toast('Вы вышли из челленджа', 'info');

            renderChallenges();

          } catch (e) {

            toast('Ошибка: ' + (e.message || ''), 'danger');

          }

        }

      });

    });

  } catch (e) {

    console.error('renderChallenges error', e);

    container.innerHTML =

      '<div class="friends-empty"><span class="material-symbols-outlined">error</span><p>Ошибка загрузки челленджей</p></div>';

  }

}
*/

// ========== МОДАЛКА ПРИГЛАШЕНИЯ В ЧЕЛЛЕНДЖ (ЗАКОММЕНТИРОВАНО) ==========
/*
let currentChallengeId = null;

async function openInviteChallengeModal(challengeId) {

  currentChallengeId = challengeId;

  try {

    // Получаем информацию о челлендже

    const challenges = await window.getAllActiveChallenges(

      window.currentUserId,

    );

    const challenge = challenges.find(ch => ch.id === challengeId);

    if (challenge) {

      // Обновляем информацию о челлендже в модалке

      const typeIcons = {

        xp: 'bolt',

        words: 'menu_book',

        streak: 'local_fire_department',

        practice_time: 'timer',

      };

      const typeLabels = {

        xp: 'XP',

        words: 'Слова',

        streak: 'Серия',

        practice_time: 'Время',

      };

      document.getElementById('invite-challenge-title').textContent =

        challenge.title || 'Челлендж';

      document.getElementById('invite-challenge-type').innerHTML =

        `<span class="material-symbols-outlined" style="font-size: 0.9rem;">${typeIcons[challenge.type] || 'bolt'}</span> ${typeLabels[challenge.type] || 'XP'}`;

      document.getElementById('invite-challenge-deadline').textContent =

        challenge.end_date

          ? `До ${new Date(challenge.end_date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}`

          : 'Без срока';

      // Обновляем иконку

      const iconEl = document.querySelector(

        '.invite-challenge-icon .material-symbols-outlined',

      );

      if (iconEl) iconEl.textContent = typeIcons[challenge.type] || 'bolt';

    }

    const friends = await window.getFriends(window.currentUserId);

    const container = document.getElementById('invite-friends-list');

    if (!friends.length) {

      container.innerHTML = `

        <div class="friends-empty">

          <span class="material-symbols-outlined">sentiment_dissatisfied</span>

          <p>У вас пока нет друзей для приглашения</p>

        </div>`;

    } else {

      container.innerHTML = friends

        .map(

          friend => `

        <div class="invite-friend-card" data-friend-id="${friend.id}">

          <div>

            <div class="invite-friend-main">

              <div class="invite-friend-avatar">

                <span class="material-symbols-outlined">person</span>

              </div>

              <div class="invite-friend-info">

                <div class="invite-friend-name">${esc(friend.username)}</div>

                <div class="invite-friend-level">${friend.level || 1} уровень</div>

              </div>

            </div>

            <button class="invite-friend-btn" data-friend-id="${friend.id}" title="Пригласить">

              <span class="material-symbols-outlined">person_add</span>

            </button>

          </div>

        </div>

      `,

        )

        .join('');

      // Обработчики для кнопок приглашения

      container.querySelectorAll('.invite-friend-btn').forEach(btn => {

        btn.addEventListener('click', async () => {

          const friendId = btn.dataset.friendId;

          await inviteFriendToChallenge(friendId, challengeId);

        });

      });

    }

    // Показываем модалку

    document.getElementById('invite-challenge-modal').classList.add('open');

    document.body.classList.add('modal-open');

  } catch (e) {

    console.error('Error loading friends for invite:', e);

    toast('Ошибка загрузки друзей', 'danger');

  }

}

async function inviteFriendToChallenge(friendId, challengeId) {

  try {

    // Отправляем приглашение (а не сразу добавляем)

    await window.sendChallengeInvite(

      challengeId,

      window.currentUserId,

      friendId,

    );

    toast('Приглашение отправлено!', 'success');

    // Закрываем модалку

    document.getElementById('invite-challenge-modal').classList.remove('open');

    document.body.classList.remove('modal-open');

    // Обновляем список челленджей

    renderChallenges();

  } catch (e) {

    console.error('Error inviting friend:', e);

    toast('Ошибка отправки приглашения', 'danger');

  }

}

// Закрытие модалки приглашения

document

  .getElementById('invite-challenge-modal-close')

  ?.addEventListener('click', () => {

    document.getElementById('invite-challenge-modal').classList.remove('open');

    document.body.classList.remove('modal-open');

  });

document

  .getElementById('cancel-invite-challenge')

  ?.addEventListener('click', () => {

    document.getElementById('invite-challenge-modal').classList.remove('open');

    document.body.classList.remove('modal-open');

  });
*/

// Чат

window.currentChatFriend = null;

// Стикеры

const STICKERS = [

  '😀',

  '😃',

  '😄',

  '😁',

  '😆',

  '😅',

  '🤣',

  '😂',

  '🙂',

  '🙃',

  '😉',

  '😊',

  '😇',

  '🥰',

  '😍',

  '🤩',

  '😘',

  '😗',

  '😚',

  '😙',

  '😋',

  '😛',

  '😜',

  '🤪',

  '😝',

  '🤗',

  '🤭',

  '🤫',

  '🤔',

  '🤐',

  '🤨',

  '😐',

  '😑',

  '😶',

  '😏',

  '😒',

  '🙄',

  '😬',

  '🤥',

  '😌',

  '😔',

  '😪',

  '🤤',

  '😴',

  '😷',

  '🤒',

  '🤕',

  '🤢',

  '👍',

  '👎',

  '👌',

  '✌️',

  '🤞',

  '🤟',

  '🤘',

  '🤙',

  '👈',

  '👉',

  '👆',

  '👇',

  '☝️',

  '✋',

  '🤚',

  '🖐️',

  '🖖',

  '👋',

  '🤙',

  '💪',

  '🙏',

  '🎉',

  '🎊',

  '🎈',

  '🔥',

  '💯',

  '⭐',

  '🌟',

  '✨',

  '💥',

  '💫',

  '🎯',

];

// Старые функции реакций удалены, теперь используется новый подход с мгновенным обновлением

// через reactionsMap в замыкании openChatWithFriend и updateReactionLocally

function animateReaction(messageId, emoji) {

  const messageElement = document.querySelector(

    `[data-message-id="${messageId}"]`,

  );

  if (!messageElement) return;

  // Создаем анимированную реакцию

  const animatedEmoji = document.createElement('div');

  animatedEmoji.className = 'animated-reaction';

  animatedEmoji.textContent = emoji;

  animatedEmoji.style.cssText = `

    position: absolute;

    font-size: 24px;

    animation: reactionFloat 1s ease-out forwards;

    pointer-events: none;

    z-index: 1000;

  `;

  const rect = messageElement.getBoundingClientRect();

  animatedEmoji.style.left = `${rect.left + Math.random() * rect.width}px`;

  animatedEmoji.style.top = `${rect.top}px`;

  document.body.appendChild(animatedEmoji);

  setTimeout(() => animatedEmoji.remove(), 1000);

}

// Звуковые эффекты для чата - удалены, используем playSound из utils.js

// Анимация отправки стикера - отключена

function animateStickerSend() {

  // Ничего не делаем, просто заглушка

}

window.toggleStickerPicker = function (friendId) {

  const existing = document.querySelector('.sticker-picker');

  if (existing) {

    existing.remove();

    return;

  }

  const picker = document.createElement('div');

  picker.className = 'sticker-picker';

  picker.innerHTML = `

    <div class="sticker-picker-header">Стикеры</div>

    <div class="sticker-grid">

      ${STICKERS.map(sticker => `<div class="sticker-item" data-sticker="${sticker}">${sticker}</div>`).join('')}

    </div>

  `;

  const triggerBtn = document.getElementById('chat-sticker-btn');

  if (!triggerBtn) return;

  document.body.appendChild(picker);

  requestAnimationFrame(() => {

    const rect = triggerBtn.getBoundingClientRect();

    const pickerRect = picker.getBoundingClientRect();

    const viewportWidth = window.innerWidth;

    const viewportHeight = window.innerHeight;

    let top = rect.bottom + 8;

    let left = rect.left;

    if (top + pickerRect.height > viewportHeight - 8) {

      top = rect.top - pickerRect.height - 8;

    }

    if (top < 8) top = 8;

    if (left + pickerRect.width > viewportWidth - 8) {

      left = viewportWidth - pickerRect.width - 8;

    }

    if (left < 8) left = 8;

    picker.style.position = 'fixed';

    picker.style.top = `${top}px`;

    picker.style.left = `${left}px`;

    picker.style.transform = 'none';

    picker.style.zIndex = '10060';

  });

  picker.querySelectorAll('.sticker-item').forEach(item => {

    item.addEventListener('click', async () => {

      const sticker = item.dataset.sticker;

      await sendSticker(friendId, sticker);

      picker.remove();

      document.removeEventListener('click', closeHandler);

    });

  });

  const closeHandler = e => {

    if (!picker.contains(e.target)) {

      picker.remove();

      document.removeEventListener('click', closeHandler);

    }

  };

  setTimeout(() => document.addEventListener('click', closeHandler), 0);

};

window.sendSticker = async function (friendId, sticker) {

  // Проверяем, открыт ли чат с этим другом

  if (window.currentChatFriend !== friendId) {

    // Если чат не открыт, используем старый подход

    try {

      await sendMessage(window.currentUserId, friendId, sticker);

      toast('Стикер отправлен!', 'success');

      playSound('sound/send.mp3');

    } catch (e) {

      console.error('sendSticker error:', e);

      toast(

        'Ошибка отправки стикера: ' +

          (e.message || e.toString() || 'неизвестная'),

        'danger',

      );

    }

    return;

  }

  // Если чат открыт, используем мгновенное добавление

  const messagesList = document.getElementById('chat-messages-list');

  if (!messagesList || !messagesList._updateReactionLocally) {

    // Если нет доступа к функциям чата, используем старый подход

    try {

      await sendMessage(window.currentUserId, friendId, sticker);

      await openChatWithFriend(friendId);

    } catch (e) {

      console.error('🔥 sendSticker error:', e);

      toast(

        'Ошибка отправки стикера: ' +

          (e.message || e.toString() || 'неизвестная'),

        'danger',

      );

    }

    return;

  }

  // Мгновенное добавление стикера

  const tempId = `temp-${Date.now()}`;

  const now = new Date();

  const messageHtml = `

    <div class="chat-message chat-message--outgoing" data-message-id="${tempId}">

      <div class="chat-bubble">

        <div class="sticker-message">${sticker}</div>

        <div class="chat-reactions" id="reactions-${tempId}"></div>

      </div>

    </div>

  `;

  messagesList.insertAdjacentHTML('beforeend', messageHtml);

  messagesList.scrollTo({ top: messagesList.scrollHeight, behavior: 'smooth' });

  // Добавляем обработчик клика на новый стикер

  const newMessageEl = messagesList.lastElementChild;

  newMessageEl.addEventListener('click', e => {

    if (e.target.closest('.reaction')) return;

    showReactionPicker(tempId, messagesList._updateReactionLocally);

  });

  try {

    const sentMessage = await sendMessage(

      window.currentUserId,

      friendId,

      sticker,

    );

    // Заменяем временный ID на реальный

    const tempMessageEl = document.querySelector(

      `[data-message-id="${tempId}"]`,

    );

    if (tempMessageEl) {

      tempMessageEl.dataset.messageId = sentMessage.id;

      tempMessageEl.querySelector('.chat-reactions').id =

        `reactions-${sentMessage.id}`;

      // Обновляем обработчик клика

      tempMessageEl.addEventListener('click', e => {

        if (e.target.closest('.reaction')) return;

        showReactionPicker(sentMessage.id, messagesList._updateReactionLocally);

      });

    }

    // Анимация отправки стикера

    animateStickerSend();

  } catch (e) {

    console.error('🔥 sendSticker error:', e);

    toast('Ошибка отправки стикера: ' + e.message, 'danger');

    // Удаляем временное сообщение при ошибке

    const tempMessageEl = document.querySelector(

      `[data-message-id="${tempId}"]`,

    );

    if (tempMessageEl) {

      tempMessageEl.remove();

    }

  }

};

async function updateUnreadCounts() {

  const userId = window.currentUserId;

  if (!userId) return;

  // Получаем количество и последнее сообщение

  const {

    count,

    data: messages,

    error,

  } = await supabase

    .from('messages')

    .select('*, sender:profiles!messages_sender_id_fkey(username)', {

      count: 'exact',

    })

    .eq('receiver_id', userId)

    .eq('read', false)

    .order('created_at', { ascending: false })

    .limit(1);

  if (error) {

    console.error('updateUnreadCounts error:', error);

    return;

  }

  const previousCount = window.unreadMessagesCount || 0;

  const newCount = count || 0;

  const lastMessage = messages?.[0];

  const senderName = lastMessage?.sender?.username || 'пользователя';

  // Показываем тост если пришли новые сообщения

  if (newCount > previousCount && previousCount > 0) {

    const messageCount = newCount - previousCount;

    toast(

      `${messageCount} новое${messageCount === 1 ? '' : 'сообщений'} от ${senderName}`,

      'info',

      'chat',

    );

    playSound('sound/message.mp3');

    // Если чат открыт с этим отправителем, обновляем его

    if (

      window.currentChatFriend &&

      lastMessage?.sender_id === window.currentChatFriend

    ) {

      setTimeout(() => {

        openChatWithFriend(window.currentChatFriend);

      }, 500);

    }

  } else if (newCount > 0 && previousCount === 0) {

    toast(`Новое сообщение от ${senderName}`, 'info', 'chat');

    playSound('sound/message.mp3');

    // Если чат открыт с этим отправителем, обновляем его

    if (

      window.currentChatFriend &&

      lastMessage?.sender_id === window.currentChatFriend

    ) {

      setTimeout(() => {

        openChatWithFriend(window.currentChatFriend);

      }, 500);

    }

  }

  window.unreadMessagesCount = newCount;

  // Всегда обновляем плавающую кнопку чата

  updateFloatingChatButton();

  // Обновляем бейджи для конкретных чатов

  await updateChatBadges();

  // Обновляем бейдж на пилюле «Чаты»

  const chatBadge = document.getElementById('chat-unread-badge');

  if (chatBadge) {

    chatBadge.textContent =

      window.unreadMessagesCount > 0 ? window.unreadMessagesCount : '';

    chatBadge.style.display =

      window.unreadMessagesCount > 0 ? 'inline-flex' : 'none';

  }

  // Обновляем общий бейдж на кнопке «Друзья»

  updateFriendsNavBadge();

}

// Обновляем бейджи для каждого чата

async function updateChatBadges() {

  const userId = window.currentUserId;

  if (!userId) return;

  try {

    // Получаем непрочитанные сообщения сгруппированные по отправителям

    const { data, error } = await supabase

      .from('messages')

      .select('sender_id')

      .eq('receiver_id', userId)

      .eq('read', false);

    if (error) {

      console.error('updateChatBadges error:', error);

      return;

    }

    // Считаем сообщения от каждого отправителя

    const unreadBySender = {};

    data.forEach(msg => {

      unreadBySender[msg.sender_id] = (unreadBySender[msg.sender_id] || 0) + 1;

    });

    // Обновляем бейджи в карточках друзей

    document.querySelectorAll('.friend-card-modern').forEach(card => {

      const friendId = card.dataset.id;

      const badge = card.querySelector('.friend-chat-badge');

      if (!badge) return;

      const count = unreadBySender[friendId] || 0;

      if (count > 0) {

        badge.textContent = count > 9 ? '9+' : count;

        badge.style.display = 'inline-flex';

      } else {

        badge.style.display = 'none';

      }

    });

    // Обновляем бейдж на плавающей кнопке

    const total = Object.values(unreadBySender).reduce((a, b) => a + b, 0);

    const floatingBadge = document.getElementById('floating-chat-badge');

    if (floatingBadge) {

      if (total > 0) {

        floatingBadge.textContent = total > 9 ? '9+' : total;

        floatingBadge.style.display = 'flex';

        document.getElementById('floating-chat-btn').style.display = 'flex';

      } else {

        floatingBadge.style.display = 'none';

      }

    }

  } catch (e) {

    console.error('updateChatBadges error:', e);

  }

}

function updateFriendsSubBadges() {

  // 1. Бейдж заявок (входящие)

  const requestsBadge = document.getElementById('requests-badge');

  const requestsCount = friendsData.requests?.length || 0;

  if (requestsBadge) {

    requestsBadge.textContent = requestsCount > 0 ? requestsCount : '';

    requestsBadge.style.display = requestsCount > 0 ? 'inline-flex' : 'none';

  }

  // 2. Бейдж чата (непрочитанные) – используем глобальную переменную

  const chatBadge = document.getElementById('chat-unread-badge');

  if (chatBadge) {

    const unread = window.unreadMessagesCount || 0;

    chatBadge.textContent = unread > 0 ? unread : '';

    chatBadge.style.display = unread > 0 ? 'inline-flex' : 'none';

  }

  // 3. Обновляем общий бейдж на кнопке «Друзья» в навигации

  updateFriendsNavBadge();

}

async function updateTotalUnreadBadge() {

  const userId = window.currentUserId;

  if (!userId) return;

  const { count, error } = await supabase

    .from('messages')

    .select('*', { count: 'exact', head: true })

    .eq('receiver_id', userId)

    .eq('read', false);

  if (error) {

    console.error('updateTotalUnreadBadge error:', error);

    return;

  }

  const badge = document.getElementById('chat-unread-badge');

  if (badge) {

    badge.textContent = count > 0 ? count : '';

    badge.style.display = count > 0 ? 'inline-flex' : 'none';

  }

}

// Обновление бейджа на кнопке "Друзья" (сообщения + заявки)

async function updateFriendsNavBadge() {

  const userId = window.currentUserId;

  if (!userId) return;

  try {

    const requestsCount = friendsData.requests?.length || 0;

    const unreadCount = window.unreadMessagesCount || 0;

    const total = requestsCount + unreadCount;

    const display = total > 0 ? (total > 9 ? '9+' : total) : '';

    const desktopBadge = document.getElementById('friends-req-badge');

    const mobileBadge = document.getElementById('mobile-friends-req-badge');

    if (desktopBadge) {

      desktopBadge.textContent = display;

      desktopBadge.style.display = total > 0 ? 'flex' : 'none';

    }

    if (mobileBadge) {

      mobileBadge.textContent = display;

      mobileBadge.style.display = total > 0 ? 'flex' : 'none';

    }

  } catch (e) {

    console.error('updateFriendsNavBadge error:', e);

  }

}

// Функция показа модального окна сравнения словарей

function showComparisonModal(data, friendName) {

  const modal = document.createElement('div');

  modal.className = 'modal-backdrop open';

  modal.style.zIndex = '10002';

  modal.innerHTML = `

    <div class="modal-box modal-box--large" style="max-width: 700px; width: 90%;">

      <div class="modal-header">

        <h3>

          <span class="material-symbols-outlined">compare</span>

          Сравнение словарей с ${esc(friendName)}

        </h3>

        <button class="modal-close"><span class="material-symbols-outlined">close</span></button>

      </div>

      <div class="comparison-body" style="max-height: 65vh; overflow-y: auto; padding-right: 4px;">

        ${renderComparisonSection('words', 'Слова', data.words)}

        ${renderComparisonSection('idioms', 'Идиомы', data.idioms)}

      </div>

      <div class="modal-actions">

        <button class="btn btn-primary" id="add-missing-words">

          <span class="material-symbols-outlined">add</span>

          Добавить всё недостающее

        </button>

      </div>

    </div>

  `;

  document.body.appendChild(modal);

  // Функция рендеринга секции (слова или идиомы)

  function renderComparisonSection(type, label, sectionData) {

    const common = sectionData.common || [];

    const missing = sectionData.missing || [];

    const unique = sectionData.unique || [];

    return `

      <div class="comparison-section" data-type="${type}">

        <div class="comparison-section-header">

          <div class="comparison-section-title">

            <span class="material-symbols-outlined">${type === 'words' ? 'menu_book' : 'theater_comedy'}</span>

            ${label}

          </div>

          <button class="comparison-section-toggle">

            <span class="material-symbols-outlined">expand_more</span>

          </button>

        </div>

        <div class="comparison-section-content" style="display: none;">

          <div class="comparison-search">

            <div class="search-container">

              <span class="material-symbols-outlined search-icon">search</span>

              <input type="text" class="form-control" placeholder="Поиск..." data-search="${type}">

            </div>

          </div>

          ${renderSubsection('common', 'Общие', common, type)}

          ${renderSubsection('missing', 'Недостающие', missing, type)}

          ${renderSubsection('unique', 'Ваши уникальные', unique, type)}

        </div>

      </div>

    `;

  }

  function renderSubsection(key, title, items, type) {

    if (!items.length) {

      return `

        <div class="comparison-subsection" data-subsection="${key}">

          <div class="subsection-header">

            <strong>${title}</strong> <span class="subsection-count">0</span>

            <span class="material-symbols-outlined subsection-toggle">expand_more</span>

          </div>

          <div class="subsection-content" style="display: none;">

            <div class="empty-message">—</div>

          </div>

        </div>

      `;

    }

    const itemsHtml = items

      .map(item => {

        const name = type === 'words' ? item.en : item.idiom;

        const dataAttr =

          type === 'words'

            ? `data-en="${esc(name)}"`

            : `data-idiom="${esc(name)}"`;

        return `<span class="badge-mini" ${dataAttr} style="cursor: pointer;" title="Добавить">${esc(name)}</span>`;

      })

      .join('');

    return `

      <div class="comparison-subsection" data-subsection="${key}">

        <div class="subsection-header">

          <strong>${title}</strong> <span class="subsection-count">${items.length}</span>

          <span class="material-symbols-outlined subsection-toggle">expand_more</span>

        </div>

        <div class="subsection-content" style="display: none;">

          <div class="badges-grid-mini" data-list="${key}">${itemsHtml}</div>

        </div>

      </div>

    `;

  }

  // Навешиваем обработчики

  const modalBox = modal.querySelector('.modal-box');

  // Закрытие

  modal.querySelector('.modal-close').onclick = () => modal.remove();

  modal.addEventListener('click', e => {

    if (e.target === modal) modal.remove();

  });

  // Переключение секций (Слова/Идиомы)

  modal.querySelectorAll('.comparison-section-header').forEach(header => {

    header.addEventListener('click', () => {

      const content = header.parentElement.querySelector(

        '.comparison-section-content',

      );

      const toggleIcon = header.querySelector(

        '.comparison-section-toggle .material-symbols-outlined',

      );

      const isVisible = content.style.display !== 'none';

      content.style.display = isVisible ? 'none' : 'block';

      toggleIcon.textContent = isVisible ? 'expand_more' : 'expand_less';

    });

  });

  // Переключение подсекций (Общие/Недостающие/Уникальные)

  modal

    .querySelectorAll('.comparison-subsection .subsection-header')

    .forEach(header => {

      header.addEventListener('click', e => {

        e.stopPropagation();

        const subsection = header.closest('.comparison-subsection');

        const content = subsection.querySelector('.subsection-content');

        const toggleIcon = header.querySelector('.subsection-toggle');

        const isVisible = content.style.display !== 'none';

        content.style.display = isVisible ? 'none' : 'block';

        toggleIcon.textContent = isVisible ? 'expand_more' : 'expand_less';

      });

    });

  // Поиск внутри секции

  modal.querySelectorAll('[data-search]').forEach(input => {

    const type = input.dataset.search;

    input.addEventListener('input', e => {

      const term = e.target.value.toLowerCase();

      const section = modal.querySelector(

        `.comparison-section[data-type="${type}"]`,

      );

      const subsections = section.querySelectorAll('.comparison-subsection');

      subsections.forEach(sub => {

        const items = sub.querySelectorAll('.badge-mini');

        let anyVisible = false;

        items.forEach(item => {

          const text = item.textContent.toLowerCase();

          const match = text.includes(term);

          item.style.display = match ? 'inline-flex' : 'none';

          if (match) anyVisible = true;

        });

        // Показываем подсекцию, если есть видимые элементы

        const subsectionContent = sub.querySelector('.subsection-content');

        if (subsectionContent) {

          subsectionContent.style.display = anyVisible ? 'block' : 'none';

          // Скрываем заголовок, если нет результатов? По желанию

        }

      });

    });

  });

  // Добавление слов по клику на отдельные слова

  modal

    .querySelectorAll('.badge-mini[data-en], .badge-mini[data-idiom]')

    .forEach(badge => {

      badge.addEventListener('click', async e => {

        e.stopPropagation();

        const en = badge.dataset.en;

        const idiom = badge.dataset.idiom;

        let item;

        if (en) {

          // Находим слово в data.words.missing (или в других списках)

          item =

            data.words.missing.find(w => w.en === en) ||

            data.words.common.find(w => w.en === en);

          if (item) {

            const success = await window.addWord?.(

              item.en,

              item.ru,

              item.ex || '',

              item.tags || [],

              item.phonetic || null,

              item.examples || null,

              item.audio || null,

              item.examplesAudio || null,

            );

            if (success) {

              badge.remove();

              toast(`Слово "${en}" добавлено!`, 'success');

              playSound('sound/add.mp3');

            } else {

              toast(`Не удалось добавить "${en}"`, 'warning');

            }

          }

        } else if (idiom) {

          item =

            data.idioms.missing.find(i => i.idiom === idiom) ||

            data.idioms.common.find(i => i.idiom === idiom);

          if (item) {

            const success = await window.addIdiom?.(

              item.idiom,

              item.meaning,

              item.definition,

              item.example,

              item.phonetic,

              item.tags?.join(', ') || '',

              item.audio,

              item.examplesAudio,

              item.example_translation,

            );

            if (success) {

              badge.remove();

              toast(`Идиома "${idiom}" добавлена!`, 'success');

              playSound('sound/add.mp3');

            } else {

              toast(`Не удалось добавить "${idiom}"`, 'warning');

            }

          }

        }

      });

    });

  // Кнопка "Добавить всё недостающее"

  modal.querySelector('#add-missing-words').onclick = async () => {

    let added = 0;

    for (const w of data.words.missing) {

      const success = await window.addWord?.(

        w.en,

        w.ru,

        w.ex || '',

        w.tags || [],

        w.phonetic || null,

        w.examples || null,

        w.audio || null,

        w.examplesAudio || null,

      );

      if (success) added++;

    }

    for (const i of data.idioms.missing) {

      const success = await window.addIdiom?.(

        i.idiom,

        i.meaning,

        i.definition,

        i.example || '',

        i.phonetic || '',

        i.tags?.join(', ') || '',

        i.audio,

        i.examplesAudio,

        i.example_translation,

      );

      if (success) added++;

    }

    toast(`Добавлено ${added} новых единиц!`, 'success');

    modal.remove();

  };

}

// Добавляем вызов рендера вкладок при загрузке (ЗАКОММЕНТИРОВАНО)
/*
window.renderChallenges = renderChallenges;
*/

window.updateUnreadCounts = updateUnreadCounts;

window.updateFloatingChatButton = updateFloatingChatButton;

// ========== Кнопка создания челленджа (ЗАКОММЕНТИРОВАНО) ==========
/*
document

  .getElementById('create-challenge-btn')

  ?.addEventListener('click', () => {

    document.getElementById('create-challenge-modal').classList.add('open');

    document.body.classList.add('modal-open');

  });
*/

// Подключаем рендер к переключению вкладок

document.querySelectorAll('[data-fpill]').forEach(pill => {

  pill.addEventListener('click', () => {

    const target = pill.dataset.fpill;

    // Закрываем чат при переключении на challenges (ЗАКОММЕНТИРОВАНО)
    /*
    if (target === 'challenges') {

      const chatContainer = document.getElementById('chat-messages');

      const friendsList = document.getElementById('chat-friends-list');

      if (chatContainer && friendsList) {

        chatContainer.style.display = 'none';

        friendsList.style.display = 'block';

        window.currentChatFriend = null;

      }

    }

    if (target === 'challenges') {
      // renderChallenges(); // ЗАКОММЕНТИРОВАНО
      // renderChallengeInvites(); // ЗАКОММЕНТИРОВАНО
    }
    */

  });

});

// ============================================================

// OFFLINE CHAT FUNCTIONALITY

// ============================================================

// Хранилище для отложенных сообщений

const pendingMessagesKey = `englift_pending_messages_${window.currentUserId}`;
let pendingMessages = JSON.parse(
  localStorage.getItem(pendingMessagesKey) || '[]',
);

// Функция для сохранения сообщения в офлайн

function savePendingMessage(message) {

  pendingMessages.push({

    id: `pending-${Date.now()}`,

    text: message.text,

    receiver_id: message.receiver_id,

    sender_id: message.sender_id,

    created_at: new Date().toISOString(),

    status: 'pending',

  });

  localStorage.setItem(
    pendingMessagesKey,
    JSON.stringify(pendingMessages),
  );

}

// Функция для отправки накопленных сообщений

async function syncPendingMessages() {

  if (!navigator.onLine || pendingMessages.length === 0) return;

  const toSync = [...pendingMessages];

  pendingMessages = [];

  localStorage.setItem(
    pendingMessagesKey,
    JSON.stringify(pendingMessages),
  );

  for (const msg of toSync) {

    try {

      await sendMessage(msg.sender_id, msg.receiver_id, msg.text);

    } catch (error) {

      // Возвращаем сообщение в очередь при ошибке

      pendingMessages.push(msg);

      localStorage.setItem(
        pendingMessagesKey,
        JSON.stringify(pendingMessages),

      );

    }

  }

  if (toSync.length > 0) {

    toast(`Отправлено ${toSync.length} сообщений`, 'success');

  }

}

// Функция для показа индикатора офлайн

function updateOfflineIndicator() {

  const chatContainer = document.getElementById('chat-messages');

  const existingIndicator = document.getElementById('offline-indicator');

  if (!navigator.onLine) {

    if (!existingIndicator && chatContainer) {

      const indicator = document.createElement('div');

      indicator.id = 'offline-indicator';

      indicator.className = 'offline-indicator';

      indicator.innerHTML = `

        <span class="material-symbols-outlined">wifi_off</span>

        Офлайн. Сообщения будут отправлены позже

      `;

      chatContainer.insertBefore(indicator, chatContainer.firstChild);

    }

  } else {

    if (existingIndicator) {

      existingIndicator.remove();

    }

  }

}

// Глобальные обработчики online/offline

window.addEventListener('online', () => {

  updateOfflineIndicator();

  syncPendingMessages();

  syncFromSupabase(); // синхронизация слов и идиом

});

window.addEventListener('offline', () => {

  toast('Офлайн режим', 'info', 'wifi_off');

  updateOfflineIndicator();

});

// ============================================================

// REALTIME ПОДПИСКИ

// ============================================================

let messagesChannel = null;

let friendshipsChannel = null;

let reactionsChannel = null;

let isSubscribing = false; // Защита от повторных подписок

// Глобальная функция для пикера реакций (используется для входящих сообщений)

window.showReactionPickerGlobal = function (messageId) {

  // Проверяем, есть ли активный чат с доступным updateReactionLocally

  const messagesList = document.getElementById('chat-messages-list');

  if (messagesList && messagesList._updateReactionLocally) {

    showReactionPicker(messageId, messagesList._updateReactionLocally);

  } else {

    // Если нет, используем базовую версию без мгновенного обновления

    showReactionPicker(messageId);

  }

};

// Функция для добавления входящего сообщения локально (для real-time)

const addIncomingMessageLocally = (message, senderUsername) => {

  const messagesList = document.getElementById('chat-messages-list');

  if (!messagesList) return;

  const isSticker =

    /^\p{Emoji}$/u.test(message.text.trim()) && message.text.length === 2;

  const messageHtml = `

    <div class="chat-message chat-message--incoming" data-message-id="${message.id}">

      <div class="chat-bubble">

        ${isSticker ? `<div class="sticker-message">${message.text}</div>` : esc(message.text)}

        ${!isSticker ? `<div class="chat-time">${new Date(message.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</div>` : ''}

        <div class="chat-reactions" id="reactions-${message.id}"></div>

      </div>

    </div>

  `;

  messagesList.insertAdjacentHTML('beforeend', messageHtml);

  // Прокручиваем вниз

  messagesList.scrollTo({ top: messagesList.scrollHeight, behavior: 'smooth' });

  // Добавляем обработчик клика на новое сообщение

  const newMessageEl = messagesList.lastElementChild;

  newMessageEl.addEventListener('click', e => {

    if (e.target.closest('.reaction')) return;

    showReactionPickerGlobal(message.id);

  });

};

function subscribeToMessages() {

  console.log(

    '[GLOBAL MSG] subscribeToMessages called, userId:',

    window.currentUserId,

  );

  // Защита от повторных подписок
  if (isSubscribing) {
    console.log('[GLOBAL MSG] Already subscribing, skipping duplicate call');
    return;
  }

  // Если канал уже подписан успешно, не пересоздаём
  if (messagesChannel && messagesChannel.state === 'joined') {
    console.log('[GLOBAL MSG] Already subscribed, skipping');
    return;
  }

  isSubscribing = true;

  if (messagesChannel) {

    console.log('[GLOBAL MSG] Unsubscribing existing channel');

    messagesChannel.unsubscribe();

  }

  const userId = window.currentUserId;

  if (!userId) {

    console.warn('[GLOBAL MSG] No userId, skipping subscription');

    isSubscribing = false;

    return;

  }

  console.log(

    '[GLOBAL MSG] Creating channel with filter: receiver_id=eq.' + userId,

  );

  try {

    messagesChannel = supabase

      .channel('messages-realtime')

      .on(

        'postgres_changes',

        {

          event: 'INSERT',

          schema: 'public',

          table: 'messages',

          filter: `receiver_id=eq.${userId}`,

        },

        async payload => {

          console.log('[GLOBAL MSG] Received message:', payload.new);

          const message = payload.new;

          const senderId = message.sender_id;

          // Имя отправителя — один лёгкий запрос только для тоста

          const { data: profile } = await supabase

            .from('profiles')

            .select('username')

            .eq('id', senderId)

            .single();

          const senderName = profile?.username || '?';

          console.log(

            '[GLOBAL MSG] Sender:',

            senderName,

            'currentChatFriend:',

            window.currentChatFriend,

          );

          // Если сообщение от текущего друга — добавляем в DOM

          if (window.currentChatFriend === senderId) {

            addIncomingMessageLocally(message, senderName);

          }

          // Обновляем бейджи непрочитанных (тост и звук там)

          await updateUnreadCounts();

        },

      )

      .on(

        'postgres_changes',

        {

          event: 'UPDATE',

          schema: 'public',

          table: 'messages',

          filter: `sender_id=eq.${userId}`,

        },

        payload => {

          console.log(

            '[GLOBAL MSG] Sent message updated (read status):',

            payload.new,

          );

          const msg = payload.new;

          // Обновляем статус прочтения в UI

          const msgEl = document.querySelector(

            `[data-id="${msg.id}"], [data-message-id="${msg.id}"]`,

          );

          if (msgEl) {

            const readEl = msgEl.querySelector(

              '.tgl-read-status, .chat-read-status',

            );

            if (readEl) {

              if (msg.read) {

                readEl.textContent = 'done_all';

                readEl.classList.remove('tgl-read--sent', 'chat-read--sent');

                readEl.classList.add('tgl-read--read', 'chat-read--read');

              } else {

                readEl.textContent = 'done';

                readEl.classList.remove('tgl-read--read', 'chat-read--read');

                readEl.classList.add('tgl-read--sent', 'chat-read--sent');

              }

            }

          }

        },

      )

      .subscribe(

        status => {

          console.log('[GLOBAL MSG] Subscription status:', status);

          if (status === 'SUBSCRIBED') {

            console.log('[GLOBAL MSG] ✅ Successfully subscribed to messages');

            isSubscribing = false; // Сбрасываем флаг после успешной подписки

          } else if (status === 'CHANNEL_ERROR') {

            console.error('[GLOBAL MSG] ❌ Subscription error');

            isSubscribing = false; // Сбрасываем флаг при ошибке

          } else if (status === 'TIMED_OUT') {

            console.warn('[GLOBAL MSG] ⏱️ Subscription timed out');

            isSubscribing = false; // Сбрасываем флаг при таймауте

          }

        },

        err => {

          console.error('[GLOBAL MSG] Subscription error:', err);

          isSubscribing = false; // Сбрасываем флаг при ошибке

        },

      );

  } catch (err) {

    console.error('[GLOBAL MSG] Error creating subscription:', err);

    isSubscribing = false; // Сбрасываем флаг при ошибке

  }

}

function subscribeToReactions() {

  if (reactionsChannel) reactionsChannel.unsubscribe();

  if (!window.currentUserId) return;

  console.log('[GLOBAL MSG] Creating channel for reactions');

  try {

    reactionsChannel = supabase

      .channel('reactions-changes')

      .on(

        'postgres_changes',

        { event: '*', schema: 'public', table: 'reactions' },

        payload => {

          const { eventType, new: r, old: o } = payload;

          const msgId = eventType === 'DELETE' ? o.message_id : r.message_id;

          const userId = eventType === 'DELETE' ? o.user_id : r.user_id;

          const emoji = eventType === 'DELETE' ? o.emoji : r.emoji;

          // Своя реакция — уже обновлена оптимистично, пропускаем

          if (userId === window.currentUserId) return;

          // Ищем элемент реакции через ГЛОБАЛЬНЫЙ showReactionPickerGlobal

          // который уже умеет updateReactionLocally

          const delta = eventType === 'DELETE' ? -1 : 1;

          // Обновляем реакцию в чат-оверлее если он открыт

          const msgEl = document.querySelector(

            `[data-id="${msgId}"], [data-message-id="${msgId}"]`,

          );

          if (!msgEl) return;

          let container = msgEl.querySelector(

            '.tgl-reactions, .chat-reactions',

          );

          if (!container) {

            container = document.createElement('div');

            container.className = 'tgl-reactions';

            msgEl

              .querySelector('.tgl-msg-bubble, .chat-bubble')

              ?.appendChild(container);

          }

          let reaction = container.querySelector(`[data-emoji="${emoji}"]`);

          if (delta === 1 && !reaction) {

            // Добавляем новую реакцию

            reaction = document.createElement('span');

            reaction.className = 'tgl-reaction';

            reaction.dataset.emoji = emoji;

            reaction.textContent = emoji;

            container.appendChild(reaction);

          } else if (delta === -1 && reaction) {

            // Удаляем реакцию

            reaction.remove();

          }

        },

      )

      .subscribe();

  } catch (err) {

    console.error('[GLOBAL MSG] Error creating reactions subscription:', err);

  }

}

function subscribeToFriendRequests() {

  if (friendshipsChannel) {

    friendshipsChannel.unsubscribe();

  }

  const userId = window.currentUserId;

  if (!userId) return;

  friendshipsChannel = supabase

    .channel('friendships-realtime')

    .on(

      'postgres_changes',

      {

        event: 'INSERT',

        schema: 'public',

        table: 'friendships',

        filter: `friend_id=eq.${userId}`,

      },

      payload => {

        toast('Новая заявка в друзья!', 'info', 'group_add');

        loadFriendsDataNew(); // перезагружаем данные

        updateFriendsNavBadge(); // обновляем бейдж

      },

    )

    .subscribe();

}

// Модальное окно создания челленджа (ЗАКОММЕНТИРОВАНО)
/*
const createChallengeModal = document.getElementById('create-challenge-modal');

const createChallengeBtn = document.getElementById('create-challenge-btn');

const closeChallengeModal = document.getElementById('close-challenge-modal');

const cancelChallengeBtn = document.getElementById('cancel-challenge-button');

createChallengeBtn?.addEventListener('click', () => {

  createChallengeModal.classList.add('open');

  document.body.classList.add('modal-open');

  // Инициализация шаблонов и превью

  initChallengeTemplates();

});

// ========== НОВАЯ ЛОГИКА ДЛЯ МОДАЛКИ ЧЕЛЛЕНДКА ==========

let currentChallengeType = 'xp';

function initChallengeTemplates() {

  const templateBtns = document.querySelectorAll('.template-btn');

  const targetInput = document.getElementById('challenge-target');

  const daysInput = document.getElementById('challenge-days');

  const targetIcon = document.getElementById('target-icon');

  // Обработчики шаблонов

  templateBtns.forEach(btn => {

    btn.addEventListener('click', () => {

      // Убираем active у всех

      templateBtns.forEach(b => b.classList.remove('active'));

      btn.classList.add('active');

      // Обновляем значения

      currentChallengeType = btn.dataset.template;

      targetInput.value = btn.dataset.target;

      daysInput.value = btn.dataset.days;

      // Обновляем иконку

      updateTargetIcon(currentChallengeType);

      // Обновляем награду

      updateRewardDisplay();

      // Обновляем превью

      updateChallengePreview();

    });

  });

  // Обработчики изменения полей

  targetInput?.addEventListener('input', () => {

    updateRewardDisplay();

    updateChallengePreview();

  });

  daysInput?.addEventListener('input', updateChallengePreview);

  // Начальное обновление

  updateRewardDisplay();

  updateChallengePreview();

}

function updateTargetIcon(type) {

  const targetIcon = document.getElementById('target-icon');

  if (!targetIcon) return;

  const icons = {

    xp: 'bolt',

    words: 'menu_book',

    streak: 'local_fire_department',

    practice_time: 'timer',

  };

  targetIcon.textContent = icons[type] || 'bolt';

}

// Обновить отображение награды

function updateRewardDisplay() {

  const target =

    parseInt(document.getElementById('challenge-target')?.value, 10) || 500;

  // Награда = 30% от цели, минимум 50 XP

  const rewardXp = Math.max(Math.round(target * 0.3), 50);

  const rewardElement = document.getElementById('reward-xp');

  if (rewardElement) {

    rewardElement.textContent = `+${rewardXp} XP`;

  }

}

function updateChallengePreview() {

  const target = document.getElementById('challenge-target')?.value || 100;

  const days = document.getElementById('challenge-days')?.value || 7;

  // Обновляем иконку в превью (Material Symbols)

  const previewIcon = document.getElementById('preview-icon');

  const icons = {

    xp: 'bolt',

    words: 'menu_book',

    streak: 'local_fire_department',

    practice_time: 'timer',

  };

  if (previewIcon)

    previewIcon.textContent = icons[currentChallengeType] || 'bolt';

  // Обновляем заголовок

  const previewTitle = document.getElementById('preview-title');

  const titles = {

    xp: `${target} XP за ${days} дней`,

    words: `${target} слов за ${days} дней`,

    streak: `Серия ${target} дней`,

    practice_time: `${target} минут практики`,

  };

  if (previewTitle)

    previewTitle.textContent = titles[currentChallengeType] || `${target} XP`;

  // Обновляем тип (с иконкой)

  const previewType = document.getElementById('preview-type');

  const typeLabels = {

    xp: '<span class="material-symbols-outlined" style="font-size: 0.8rem;">bolt</span> XP',

    words:

      '<span class="material-symbols-outlined" style="font-size: 0.8rem;">menu_book</span> Слова',

    streak:

      '<span class="material-symbols-outlined" style="font-size: 0.8rem;">local_fire_department</span> Серия',

    practice_time:

      '<span class="material-symbols-outlined" style="font-size: 0.8rem;">timer</span> Время',

  };

  if (previewType)

    previewType.innerHTML =

      typeLabels[currentChallengeType] ||

      '<span class="material-symbols-outlined" style="font-size: 0.8rem;">bolt</span> XP';

  // Обновляем цель

  const previewTarget = document.getElementById('preview-target');

  if (previewTarget) previewTarget.textContent = target;

  // Обновляем дедлайн

  const previewDeadline = document.getElementById('preview-deadline');

  if (previewDeadline) {

    const deadline = new Date();

    deadline.setDate(deadline.getDate() + parseInt(days));

    const dateStr = deadline.toLocaleDateString('ru-RU', {

      day: '2-digit',

      month: '2-digit',

    });

    previewDeadline.textContent = `До ${dateStr}`;

  }

  // Анимация обновления

  const preview = document.getElementById('challenge-preview');

  if (preview) {

    preview.classList.add('updating');

    setTimeout(() => preview.classList.remove('updating'), 300);

  }

}

function closeChallengeModalFunc() {

  createChallengeModal.classList.remove('open');

  document.body.classList.remove('modal-open');

}

closeChallengeModal?.addEventListener('click', closeChallengeModalFunc);

cancelChallengeBtn?.addEventListener('click', closeChallengeModalFunc);

// Обработчик кнопки отмены в модалке создания

const createChallengeCancelBtn = document.getElementById(

  'create-challenge-cancel',

);

createChallengeCancelBtn?.addEventListener('click', closeChallengeModalFunc);

// Обработчик создания челленджа

const submitChallengeBtn = document.getElementById('create-challenge-submit');

submitChallengeBtn?.addEventListener('click', async () => {

  const target =

    parseInt(document.getElementById('challenge-target').value, 10) || 100;

  const days =

    parseInt(document.getElementById('challenge-days').value, 10) || 7;

  // Генерируем название на основе типа

  const typeNames = {

    xp: `${target} XP за ${days} дней`,

    words: `${target} слов за ${days} дней`,

    streak: `Серия ${target} дней`,

    practice_time: `${target} минут практики за ${days} дней`,

  };

  const title = typeNames[currentChallengeType] || `${target} XP`;

  const endDate = new Date();

  endDate.setDate(endDate.getDate() + days);

  try {

    // Показываем загрузку

    submitChallengeBtn.disabled = true;

    submitChallengeBtn.innerHTML =

      '<span class="material-symbols-outlined">hourglass_empty</span> Создание...';

    const newChallenge = await window.createChallenge(

      window.currentUserId,

      title,

      currentChallengeType,

      target,

      endDate.toISOString(),

    );

    toast('🏆 Челлендж создан! Брось вызов друзьям!', 'success');

    // Закрываем модалку

    createChallengeModal.classList.remove('open');

    document.body.classList.remove('modal-open');

    // Обновляем список

    renderChallenges();

    // Сброс кнопки

    submitChallengeBtn.disabled = false;

    submitChallengeBtn.innerHTML =

      '<span class="material-symbols-outlined">sports_score</span> Бросить вызов!';

  } catch (e) {

    toast('Ошибка создания челленджа', 'danger');

    console.error(e);

    submitChallengeBtn.disabled = false;

    submitChallengeBtn.innerHTML =

      '<span class="material-symbols-outlined">sports_score</span> Бросить вызов!';

  }

});
*/

// ===== ГЛОБАЛЬНЫЕ ЭКСПОРТЫ ДЛЯ HTML =====

window.switchLbPeriod = switchLbPeriod;

window.loadLeaderboard = loadLeaderboard;

window.loadFriendActivity = loadFriendActivity;

window.loadFriendsDataNew = loadFriendsDataNew;

// Глобальные экспорты для тур-системы

window.markProfileDirty = markProfileDirty;

window.syncProfileNow = syncProfileNow;

window.generateInviteLink = generateInviteLink;

// Глобальные экспорты для добавления слов и идиом

window.addWord = addWord;

window.addIdiom = addIdiom;

// Инициализация настроек из localStorage (до загрузки профиля с сервера)
// Используется только как fallback если сервер недоступен

function initUserSettings() {
  // Если настройки уже загружены с сервера, не трогаем localStorage
  if (window.user_settings && Object.keys(window.user_settings).length > 0) {
    return;
  }

  const saved = JSON.parse(localStorage.getItem('englift_user_settings') || '{}');

  window.user_settings = window.user_settings || {};

  // Загружаем только если нет серверных настроек
  if (saved.voice) window.user_settings.voice = saved.voice;
  if (saved.reviewLimit) window.user_settings.reviewLimit = saved.reviewLimit;
  if (saved.baseTheme) window.user_settings.baseTheme = saved.baseTheme;
  if (saved.showPhonetic !== undefined) window.user_settings.showPhonetic = saved.showPhonetic;
  if (saved.bankWordLevel) window.user_settings.bankWordLevel = saved.bankWordLevel;
  if (saved.dark !== undefined) window.user_settings.dark = saved.dark;
  if (saved._themeManuallySet !== undefined) window.user_settings._themeManuallySet = saved._themeManuallySet;
}

initUserSettings();

// Инициализация темы

initTheme();

setupThemeToggle();

// switchTab('words') - перенесен в onProfileFullyLoaded после загрузки данных

// Fallback: если через 6 секунд индикатор всё ещё виден – скрываем принудительно

setTimeout(() => {

  const loader = document.getElementById('loading-indicator');

  if (loader && loader.style.display !== 'none') {

    window.forceHideLoader();

  }

}, 6000);

console.log('[SCRIPT] ✅ script.js полностью загружен');

// Обработчик нажатия Enter в фидбеке (bottom sheet)

document.addEventListener('keydown', e => {

  if (e.key === 'Enter') {

    const activeEl = document.activeElement;

    // Если активный элемент — поле ввода (input, textarea), не перехватываем Enter

    if (

      activeEl &&

      (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')

    ) {

      return;

    }

    const sheet = document.getElementById('fb-sheet');

    if (sheet && sheet.classList.contains('show')) {

      const nextBtn = sheet.querySelector('.fb-next-btn');

      if (nextBtn) {

        nextBtn.click();

      } else {

        const resetBtn = sheet.querySelector('.fb-reset-btn');

        if (resetBtn) {

          resetBtn.click();

        }

      }

    }

  }

});

// ============================================================

// TESTING: Infinite Scroll Debug Functions

// ============================================================

// Глобальная функция для тестирования бесконечной прокрутки слов

window.testInfiniteScrollWords = function () {

  // Принудительно вызываем загрузку следующей порции

  if (renderedWordsCount < currentFilteredWords.length) {

    loadMoreWords();

  }

};

// Глобальная функция для тестирования бесконечной прокрутки идиом

window.testInfiniteScrollIdioms = function () {

  // Принудительно вызываем загрузку следующей порции

  if (renderedIdiomsCount < currentFilteredIdioms.length) {

    loadMoreIdioms();

  }

};

// Глобальная функция для сброса и проверки полного рендера

window.testFullRenderWords = function () {

  renderWords(false); // Полный рендер

};

window.testFullRenderIdioms = function () {

  renderIdioms(false); // Полный рендер

};

// Глобальная функция для тестирования улучшений мобильного чата

window.testMobileChatImprovements = function () {

  // Проверка 1: Мерцание скролла

  const chatList = document.getElementById('chat-messages-list');

  if (chatList) {

    const hasScrollbarGutter =

      getComputedStyle(chatList).scrollbarGutter === 'stable';

  }

  // Проверка 2: Fullscreen класс применяется сразу

  const fpanelChat = document.getElementById('fpanel-chat');

  if (fpanelChat) {

    const hasWillChange =

      getComputedStyle(fpanelChat).willChange === 'transform';

  }

  // Проверка 3: Safe area padding

  const inputRow = document.querySelector('.chat-input-row');

  if (inputRow) {

    const paddingBottom = getComputedStyle(inputRow).paddingBottom;

  }

};

// ========== REACTIONS FUNCTIONS ==========

const EMOJI_REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🔥', '👏', '🎉'];

async function showReactionPicker(messageId, updateReactionLocally) {

  // Закрываем предыдущий пикер

  const existing = document.querySelector('.emoji-picker');

  if (existing) existing.remove();

  const picker = document.createElement('div');

  picker.className = 'emoji-picker';

  picker.innerHTML = `

    <div class="emoji-picker-header">Реакции</div>

    <div class="emoji-grid">

      ${EMOJI_REACTIONS.map(emoji => `<div class="emoji-item" data-emoji="${emoji}">${emoji}</div>`).join('')}

    </div>

  `;

  const messageEl = document.querySelector(

    `.chat-message[data-message-id="${messageId}"]`,

  );

  if (!messageEl) {

    // Если сообщение не найдено, центрируем

    picker.style.position = 'fixed';

    picker.style.top = '50%';

    picker.style.left = '50%';

    picker.style.transform = 'translate(-50%, -50%)';

    document.body.appendChild(picker);

    return;

  }

  document.body.appendChild(picker);

  // Ждём рендеринга, чтобы получить размеры

  await new Promise(r => requestAnimationFrame(r));

  const rect = messageEl.getBoundingClientRect();

  const pickerRect = picker.getBoundingClientRect();

  const viewportWidth = window.innerWidth;

  const viewportHeight = window.innerHeight;

  let top = rect.bottom + 8;

  let left = rect.left;

  // Корректировка по вертикали

  if (top + pickerRect.height > viewportHeight - 8) {

    top = rect.top - pickerRect.height - 8;

  }

  if (top < 8) top = 8;

  // Корректировка по горизонтали

  if (left + pickerRect.width > viewportWidth - 8) {

    left = viewportWidth - pickerRect.width - 8;

  }

  if (left < 8) left = 8;

  picker.style.position = 'fixed';

  picker.style.top = `${top}px`;

  picker.style.left = `${left}px`;

  picker.style.transform = 'none';

  picker.style.zIndex = '10060';

  // Обработчики выбора

  picker.querySelectorAll('.emoji-item').forEach(item => {

    item.addEventListener('click', async () => {

      const emoji = item.dataset.emoji;

      await handleReactionToggle(messageId, emoji, updateReactionLocally);

      picker.remove();

      document.removeEventListener('click', closeHandler);

    });

  });

  const closeHandler = e => {

    if (!picker.contains(e.target)) {

      picker.remove();

      document.removeEventListener('click', closeHandler);

    }

  };

  setTimeout(() => document.addEventListener('click', closeHandler), 0);

}

async function handleReactionToggle(messageId, emoji, updateReactionLocally) {

  // Определяем, есть ли уже реакция от текущего пользователя

  const messageEl = document.querySelector(

    `.chat-message[data-message-id="${messageId}"]`,

  );

  const reactionEl = messageEl?.querySelector(

    `.reaction[data-emoji="${emoji}"]`,

  );

  const isPresent = !!reactionEl;

  const change = isPresent ? -1 : 1;

  // Оптимистично обновляем DOM

  if (updateReactionLocally) {

    updateReactionLocally(messageId, emoji, change);

  }

  try {

    await toggleReaction(messageId, window.currentUserId, emoji);

    // Звук только для добавления реакции (change === 1)

    if (change === 1) {

      playSound('sound/send.mp3');

    }

  } catch (err) {

    console.error('Ошибка при изменении реакции:', err);

    // Откатываем локальное изменение

    if (updateReactionLocally) {

      updateReactionLocally(messageId, emoji, -change);

    }

    toast('Ошибка: не удалось изменить реакцию', 'danger');

  }

}

// Экспортируем функции для использования в других модулях

window.openChatWithFriend = openChatWithFriend;

window.updateChatBadges = updateChatBadges;

window.updateUnreadCounts = updateUnreadCounts;

// Экспортируем функции для чата

window.sendMessage = sendMessage;

window.getMessages = getMessages;

window.markMessagesRead = markMessagesRead;

window.getReactionsForMessages = getReactionsForMessages;

window.toggleReaction = toggleReaction;

// Download words function

window.downloadWords = function() {

  if (!window.words || window.words.length === 0) {

    toast('Нет слов для скачивания', 'warning');

    return;

  }

  const wordsList = window.words.map(w => w.en).join('\n');

  const blob = new Blob([wordsList], { type: 'text/plain' });

  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');

  a.href = url;

  a.download = 'my-words.txt';

  document.body.appendChild(a);

  a.click();

  document.body.removeChild(a);

  URL.revokeObjectURL(url);

  toast('Слова скачаны!', 'success');

};

