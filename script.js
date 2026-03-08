import { supabase } from './supabase.js';

import {
  saveWordToDb,
  deleteWordFromDb,
  saveUserData,
  batchSaveWords,
} from './db.js';

import { getCompleteWordData } from './api.js';

import './auth.js';

// File import variables

let fileParsed = [];

// Инициализация глобальных переменных

window.words = [];

// Intersection Observer для бесконечной прокрутки

let intersectionObserver = null;

// Пакетное сохранение слов

let pendingWordUpdates = new Map(); // id -> слово

window.pendingWordUpdates = pendingWordUpdates; // делаем доступной глобально

let wordSyncTimer;

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
      // Сохраняем или обновляем (существующая логика)

      try {
        console.log(
          `💾 Пакетная синхронизация слова "${item.en}" с ID: ${item.id}`,
        );

        // Проверяем существует ли слово уже в базе

        const { data: existingWord, error: checkError } = await supabase

          .from('user_words')

          .select('id')

          .eq('id', item.id)

          .single();

        if (checkError) {
          console.log(
            `🆕 Слово новое (ошибка проверки: ${checkError.message}), сохраняем через INSERT`,
          );

          // Если ошибка при проверке, считаем слово новым и сохраняем

          const { error } = await saveWordToDb(item);

          if (error) {
            console.error(`❌ Ошибка сохранения слова "${item.en}":`, error);
          } else {
            console.log(`✅ Слово "${item.en}" сохранено через INSERT`);
          }
        } else if (existingWord) {
          console.log('🔄 Слово уже существует, обновляем только статистику');

          // Обновляем только статистику и updatedAt

          const { error } = await supabase

            .from('user_words')

            .update({
              stats: item.stats,

              updatedAt: new Date().toISOString(),
            })

            .eq('id', item.id);

          if (error) {
            console.error(
              `❌ Ошибка обновления статистики слова "${item.en}":`,

              error,
            );
          } else {
            console.log(`✅ Статистика слова "${item.en}" обновлена`);
          }
        } else {
          console.log('🆕 Слово новое, сохраняем через INSERT');

          // Если слова нет, используем INSERT

          const { error } = await saveWordToDb(item);

          if (error) {
            console.error(`❌ Ошибка сохранения слова "${item.en}":`, error);
          } else {
            console.log(`✅ Слово "${item.en}" сохранено через INSERT`);
          }
        }

        // Если успешно, убираем из очереди

        if (!checkError || !error) {
          pendingWordUpdates.delete(item.id);
        }
      } catch (e) {
        console.error(`❌ Ошибка синхронизации слова "${item.en}":`, e);
      }
    }
  }

  console.log(`✅ Синхронизировано ${wordsToSync.length} операций`);
}

// Загрузка только измененных слов

async function syncWordsFromServer() {
  const lastSync = window.lastWordsSync || '1970-01-01T00:00:00Z';

  console.log(`🔄 Загружаем слова, измененные после ${lastSync}`);

  try {
    console.log('🔍 Начинаем запрос к Supabase...');

    const { data, error } = await supabase

      .from('user_words')

      .select('*')

      .gt('updatedAt', lastSync)

      .order('updatedAt', { ascending: false });

    console.log('📊 Получен ответ от Supabase:', { data, error });

    if (error) throw error;

    if (data && data.length > 0) {
      console.log(`📥 Получено ${data.length} измененных слов`);

      mergeWordsWithServer(data);

      window.lastWordsSync = new Date().toISOString();
    } else {
      console.log('📥 Нет измененных слов для загрузки');
    }
  } catch (e) {
    console.error('❌ Ошибка загрузки измененных слов', e);
  }

  console.log('✅ syncWordsFromServer завершена');
}

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

// Debounce функция для сохранения профиля при частых изменениях

let profileSaveTimeout = null;

function debouncedSaveProfile() {
  return new Promise((resolve, reject) => {
    if (profileSaveTimeout) {
      clearTimeout(profileSaveTimeout);
    }

    profileSaveTimeout = setTimeout(async () => {
      try {
        await window.saveProfileData();

        resolve();
      } catch (error) {
        reject(error);
      }
    }, 5000); // 5 секунд задержки
  });
}

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

let streak = { count: 0, lastDate: null };

let speech_cfg = { voiceURI: '', rate: 0.9, pitch: 1.0, accent: 'US' };

window.speech_cfg = speech_cfg; // делаем видимым снаружи

// Загружаем настройки голосов из localStorage

const savedSpeechCfg = localStorage.getItem('englift_speech');

if (savedSpeechCfg) {
  try {
    window.speech_cfg = { ...speech_cfg, ...JSON.parse(savedSpeechCfg) };

    speech_cfg = window.speech_cfg;
  } catch (error) {
    console.error('Error loading speech config from localStorage:', error);
  }
}

let xpData = { xp: 0, level: 1, badges: [] };

let isSaving = false; // Защита от параллельного сохранения

let badgeCheckInterval = null; // Идентификатор интервала проверки бейджей

// Daily Goals configuration - должно быть объявлено ДО использования

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

// Daily progress tracking - должно быть объявлено ДО использования

window.dailyProgress = {
  add_new: 0,

  review: 0,

  practice_time: 0,

  completed: false,

  lastReset: new Date().toISOString().split('T')[0], // "2026-03-05"
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
  }
}

// Получить текущий лимит из настроек (или значение по умолчанию)

function getReviewLimit() {
  return window.user_settings?.reviewLimit &&
    window.user_settings.reviewLimit !== 9999
    ? window.user_settings.reviewLimit
    : 100; // значение по умолчанию
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
  window.dailyReviewCount++;

  console.log(`📈 Счетчик упражнений увеличен до ${window.dailyReviewCount}`);

  console.log(`🔄 Дата сброса: ${window.lastReviewResetDate}`);

  console.log(`💾 Вызываем сохранение профиля...`);

  // Сохраняем сразу после увеличения счетчика

  if (window.currentUserId) {
    debouncedSaveProfile(window.currentUserId);
  }
}

// Универсальная функция для обновления всего интерфейса

let refreshScheduled = false;

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

window.markDirty = markDirty;

window.markWordDirty = markWordDirty;

window.backupProfileToLocalStorage = backupProfileToLocalStorage;

window.restoreProfileFromLocalStorage = restoreProfileFromLocalStorage;

window.mergeProfileData = mergeProfileData;

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

window.isProfileEmpty = isProfileEmpty;

// Загрузка слов из localStorage при старте

function loadWordsFromLocalStorage() {
  const saved = localStorage.getItem('englift_words');

  if (saved) {
    try {
      window.words = JSON.parse(saved);
    } catch (e) {
      console.error('Ошибка парсинга localStorage:', e);

      window.words = [];
    }
  } else {
    window.words = [];
  }
}

// Вызываем сразу после объявления window.words

loadWordsFromLocalStorage();

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

    last_streak_date: streak.lastDate,

    daily_progress: window.dailyProgress,

    last_review_reset: window.lastReviewResetDate,

    daily_review_count: window.dailyReviewCount,

    speech_cfg: speech_cfg,

    user_settings: window.user_settings,

    dark_theme: document.documentElement.classList.contains('dark'),
  });
}

// Простая функция сохранения всего профиля

async function saveProfileData() {
  if (!window.currentUserId) {
    console.log('❌ Нет currentUserId, не сохраняем профиль');

    return;
  }

  // 1. Сначала сохраняем в localStorage

  backupProfileToLocalStorage();

  try {
    const user = await getCurrentUser();

    if (!user) {
      console.log('❌ Нет пользователя, не сохраняем профиль');

      return;
    }

    const profileData = {
      xp: xpData.xp,

      level: xpData.level,

      badges: xpData.badges,

      streak: streak.count,

      last_streak_date: streak.lastDate,

      daily_progress: window.dailyProgress,

      last_review_reset: window.lastReviewResetDate,

      daily_review_count: window.dailyReviewCount,

      speech_cfg: speech_cfg,

      user_settings: window.user_settings,

      dark_theme: document.documentElement.classList.contains('dark'),

      updated_at: new Date().toISOString(),
    };

    console.log('💾 Сохраняем профиль на сервер:', profileData);

    await saveUserData(user.id, profileData);

    console.log('✅ Профиль сохранён успешно');

    // Сбрасываем счетчик попыток при успехе

    retryAttempts = 0;
  } catch (error) {
    console.error('❌ Ошибка сохранения профиля:', error);

    // Планируем повторную попытку

    scheduleRetrySave();
  }
}

// Retry механизм

let retryAttempts = 0;

const MAX_RETRY_ATTEMPTS = 3;

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

window.debouncedSaveProfile = debouncedSaveProfile;

// Сохранение через Beacon при закрытии - удалено, используется unified обработчик в конце файла

// Синхронное сохранение профиля при закрытии страницы

function syncSaveProfile() {
  if (!window.currentUserId) return;

  try {
    const profileData = {
      xp: xpData.xp,

      level: xpData.level,

      badges: xpData.badges,

      streak: streak.count,

      last_streak_date: streak.lastDate,

      daily_progress: window.dailyProgress,

      last_review_reset: window.lastReviewResetDate,

      daily_review_count: window.dailyReviewCount,

      speech_cfg: speech_cfg,

      user_settings: window.user_settings,

      dark_theme: document.documentElement.classList.contains('dark'),

      updated_at: new Date().toISOString(),
    };

    // Используем fetch с keepalive для надежной отправки

    const url = `${supabase.supabaseUrl}/rest/v1/profiles?id=eq.${window.currentUserId}`;

    fetch(url, {
      method: 'PATCH',

      headers: {
        'Content-Type': 'application/json',

        apikey: supabase.supabaseKey,

        Authorization: `Bearer ${window.currentAccessToken || supabase.supabaseKey}`,
      },

      body: JSON.stringify(profileData),

      keepalive: true, // Аналог sendBeacon но с поддержкой CORS
    }).catch(error => {
      console.error('Ошибка сохранения профиля при закрытии:', error);
    });

    console.log('📡 Профиль сохранен через fetch с keepalive');
  } catch (error) {
    console.error('Ошибка сохранения через beacon:', error);
  }
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
  // Защита от вызова до загрузки слов

  if (!window.words || !Array.isArray(window.words)) {
    debugLog('Words not loaded yet, skipping renderWeekChart');

    return;
  }

  // Ищем контейнер, а не canvas (т.к. canvas заменен на HTML)

  const container = document.querySelector('.week-chart-container');

  if (!container) return;

  const existingContent =
    container.querySelector('[data-week-chart]') ||
    container.querySelector('#weekChart');

  if (
    !window.words ||
    !Array.isArray(window.words) ||
    window.words.length === 0
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
      // Вставляем после заголовка, а не в начало контейнера
      const header = container.querySelector('.daily-cap-header');
      if (header) {
        header.insertAdjacentHTML('afterend', placeholderHtml);
      } else {
        container.insertAdjacentHTML('beforeend', placeholderHtml);
      }
    }

    return;
  }

  const stats = [];

  const today = new Date();

  today.setHours(0, 0, 0, 0);

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);

    d.setDate(today.getDate() - i);

    const count = window.words.filter(w => {
      const dateField = w.stats?.lastPracticed || w.updatedAt || w.createdAt;

      if (!dateField) return false;

      try {
        const wordDate = new Date(dateField);

        wordDate.setHours(0, 0, 0, 0);

        const targetDate = new Date(d);

        targetDate.setHours(0, 0, 0, 0);

        return wordDate.getTime() === targetDate.getTime();
      } catch {
        return false;
      }
    }).length;

    stats.push({
      day: d.toLocaleDateString('ru-RU', { weekday: 'short' }),

      date: d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'numeric' }),

      count: count,
    });
  }

  const total = stats.reduce((a, b) => a + b.count, 0);

  // Создаем красивый HTML вместо графика

  const html = `

    <div data-week-chart>

      <div class="week-stats">

        ${stats

          .map(
            stat => `

              <div class="week-stat-item">

                <div class="week-day">${stat.day}</div>

                <div class="week-date">${stat.date}</div>

                <div class="week-count">${stat.count}</div>

              </div>

            `,
          )

          .join('')}

      </div>

      <div class="week-total">

        Всего за 7 дней: <span>${total}</span> слов

      </div>

    </div>

  `;

  if (existingContent) {
    existingContent.outerHTML = html;
  } else {
    // Вставляем после заголовка, а не в начало контейнера
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

    AUTO_LANG: 'ru-RU',
  },
};

// ============================================================

// ПРОФИЛЬ: БЭКАП И МЕРЖ

// ============================================================

const PROFILE_BACKUP_KEY = 'englift_profile_backup';

function backupProfileToLocalStorage() {
  if (!window.currentUserId) return;

  const profileData = {
    xp: xpData.xp,

    level: xpData.level,

    badges: xpData.badges,

    streak: streak.count,

    last_streak_date: streak.lastDate,

    daily_progress: window.dailyProgress,

    last_review_reset: window.lastReviewResetDate,

    daily_review_count: window.dailyReviewCount,

    speech_cfg: speech_cfg,

    user_settings: window.user_settings,

    dark_theme: document.documentElement.classList.contains('dark'),

    lastProfileUpdate: window.lastProfileUpdate || Date.now(),

    updated_at: new Date().toISOString(), // для сравнения
  };

  localStorage.setItem(PROFILE_BACKUP_KEY, JSON.stringify(profileData));
}

function restoreProfileFromLocalStorage() {
  const backup = localStorage.getItem(PROFILE_BACKUP_KEY);

  if (!backup) return null;

  try {
    return JSON.parse(backup);
  } catch (e) {
    console.error('Ошибка парсинга бэкапа профиля:', e);

    localStorage.removeItem(PROFILE_BACKUP_KEY);

    return null;
  }
}

function isProfileEmpty(profile) {
  if (!profile) return true;

  // Проверяем, что у пользователя действительно нет данных
  // Учитываем, что xp может быть 0, а level может быть 1 (начальные значения)
  return (
    (profile.xp === 0 || profile.xp === undefined) &&
    (profile.level === 1 || profile.level === undefined) &&
    (!profile.badges || profile.badges.length === 0) &&
    (!profile.streak || profile.streak.count === 0)
  );
}

// Мерж двух профилей: первый считается основным (более свежим), второй – дополнительным.

// Возвращает новый объект, где для каждого поля выбирается значение из основного, если оно не undefined,

// иначе из дополнительного. Для вложенных объектов (daily_progress, user_settings) делается поверхностное слияние.

function mergeProfileData(primary, secondary) {
  if (!secondary) return { ...primary };

  const merged = { ...primary };

  // Список полей, которые нужно мержить беря максимум

  const maxFields = ['xp', 'level', 'streak', 'daily_review_count'];

  maxFields.forEach(field => {
    const primaryValue = merged[field] || 0;

    const secondaryValue = secondary[field] || 0;

    merged[field] = Math.max(primaryValue, secondaryValue);
  });

  // Список полей, которые не нужно глубоко мержить

  const simpleFields = ['last_streak_date', 'last_review_reset', 'dark_theme'];

  simpleFields.forEach(field => {
    if (merged[field] === undefined && secondary[field] !== undefined) {
      merged[field] = secondary[field];
    }
  });

  // daily_progress – берём максимум по каждому счётчику (кроме lastReset)

  if (merged.daily_progress && secondary.daily_progress) {
    merged.daily_progress = {
      add_new: Math.max(
        merged.daily_progress.add_new || 0,

        secondary.daily_progress.add_new || 0,
      ),

      review: Math.max(
        merged.daily_progress.review || 0,

        secondary.daily_progress.review || 0,
      ),

      practice_time: Math.max(
        merged.daily_progress.practice_time || 0,

        secondary.daily_progress.practice_time || 0,
      ),

      completed:
        merged.daily_progress.completed || secondary.daily_progress.completed,

      lastReset:
        merged.daily_progress.lastReset ||
        secondary.daily_progress.lastReset ||
        new Date().toISOString().split('T')[0],
    };
  } else if (!merged.daily_progress && secondary.daily_progress) {
    merged.daily_progress = secondary.daily_progress;
  }

  // speech_cfg и user_settings – поверхностное слияние (приоритет у primary)

  merged.speech_cfg = {
    ...(secondary.speech_cfg || {}),

    ...(merged.speech_cfg || {}),
  };

  merged.user_settings = {
    ...(secondary.user_settings || {}),

    ...(merged.user_settings || {}),
  };

  // badges - объединяем уникальные бейджи из обоих источников
  if (merged.badges && secondary.badges) {
    const badgeSet = new Set();

    // Добавляем все бейджи из primary
    merged.badges.forEach(badge => badgeSet.add(badge));

    // Добавляем уникальные бейджи из secondary
    secondary.badges.forEach(badge => badgeSet.add(badge));

    merged.badges = Array.from(badgeSet);
  } else if (!merged.badges && secondary.badges) {
    merged.badges = secondary.badges;
  }

  // Обновляем время обновления на самое свежее

  const primaryTime = primary.updated_at
    ? new Date(primary.updated_at).getTime()
    : 0;

  const secondaryTime = secondary.updated_at
    ? new Date(secondary.updated_at).getTime()
    : 0;

  merged.updated_at =
    primaryTime > secondaryTime ? primary.updated_at : secondary.updated_at;

  return merged;
}

// Экспортируем функции глобально для использования в auth.js

function applyProfileData(data) {
  window.updateXpData?.({
    xp: data.xp || 0,

    level: data.level || 1,

    badges: data.badges || [],
  });

  window.updateStreak?.({
    count: data.streak || 0,

    lastDate: data.last_streak_date || null,
  });

  if (data.daily_progress) window.updateDailyProgress?.(data.daily_progress);

  // Добавить:

  console.log('📥 Загружаем профиль:', {
    daily_review_count: data.daily_review_count,

    last_review_reset: data.last_review_reset,
  });

  if (data.daily_review_count !== undefined)
    window.dailyReviewCount = data.daily_review_count;

  if (data.last_review_reset)
    window.lastReviewResetDate = data.last_review_reset;

  console.log('📊 После загрузки:', {
    dailyReviewCount: window.dailyReviewCount,

    lastReviewResetDate: window.lastReviewResetDate,
  });

  // Проверяем, не наступил ли новый день (сбрасываем счётчик при необходимости)

  checkAndResetDailyCount();

  console.log('🔄 После проверки сброса:', {
    dailyReviewCount: window.dailyReviewCount,

    lastReviewResetDate: window.lastReviewResetDate,
  });

  window.speech_cfg = data.speech_cfg || {};

  window.user_settings = data.user_settings || {};

  window.lastProfileUpdate = data.updated_at
    ? new Date(data.updated_at).getTime()
    : Date.now();
}

// ============================================================

// SPEECH RECOGNITION SUPPORT

// ============================================================

const speechRecognitionSupported = !!(
  window.SpeechRecognition || window.webkitSpeechRecognition
);

let currentRecognition = null; // будет создаваться при каждом запуске
// Всё остальное удаляем – глобальный экземпляр больше не нужен

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
  // Полностью заменяем dailyProgress данными из Supabase

  window.dailyProgress = { ...newDailyProgress };

  renderStats();
};

// Clear all user data on logout

window.clearUserData = function () {
  window.words = [];

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

  window.lastReviewResetDate = new Date().toISOString().split('T')[0]; // сегодняшняя дата

  window.currentUserId = null;

  localStorage.removeItem(CONSTANTS.STORAGE_KEYS.WORDS);

  localStorage.removeItem(PROFILE_BACKUP_KEY); // Удаляем бэкап профиля

  renderCache.clear();

  refreshUI();
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

    toast(
      '🎉 Все ежедневные цели выполнены! +' + totalReward + ' XP',

      'success',
    );

    // Trigger confetti animation

    spawnConfetti();

    refreshUI(); // Update display
  }
}

// Загрузка банка слов для автодополнения

window.wordBank = [];

async function loadWordBank() {
  try {
    if (window.wordBank && window.wordBank.length > 0) {
      return;
    }

    const response = await fetch('dictionary.json');

    if (response.ok) {
      window.wordBank = await response.json();
    }
  } catch (e) {
    console.error('Ошибка загрузки словаря для подсказок:', e);
  }
}

loadWordBank();

async function load() {
  try {
    // Сначала пробуем загрузить из localStorage

    const local = localStorage.getItem('englift_words');

    if (local) {
      window.words = JSON.parse(local);

      debugLog('Loaded', window.words.length, 'words from localStorage');
    }

    // Восстанавливаем статистику из страховки если нужно

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

let saveTimeout;

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

// Делаем speak глобальным для доступа из HTML

window.speak = speak;

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

async function saveSpeech() {
  const key = await getSpeechKey();

  localStorage.setItem(key, JSON.stringify(speech_cfg));

  window.saveProfileData?.();
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

  try {
    const newWord = mkWord(
      normalizedEn,

      normalizedRu,

      normalizedEx,

      normalizedTags,

      normalizedPhonetic,

      examples,
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

  // Очищаем от других очередей

  dirtyWords.delete(id);

  // Сохраняем в localStorage

  debouncedSave();

  // Обновляем интерфейс

  renderCache.clear();

  visibleLimit = 30;

  recalculateCefrLevels();

  refreshUI();

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

    markDirty(id);

    // Отмечаем слово для пакетной синхронизации вместо немедленного сохранения

    markWordDirty(id);

    renderCache.clear(); // <-- добавляем очистку кеша рендеринга

    // Устанавливаем флаг локальных изменений

    window.hasLocalChanges = true;

    // Пересчитываем уровни CEFR после обновления

    recalculateCefrLevels();

    // Обновляем интерфейс

    refreshUI();
  }
}

function updStats(id, correct) {
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
    gainXP(
      20,

      'слово выучено <span class="material-symbols-outlined" style="vertical-align: middle; font-size: 16px;">star</span>',
    );

    autoCheckBadges(); // Автоматическая проверка бейджей
  }

  markDirty(id);

  // Отмечаем слово для пакетной синхронизации

  markWordDirty(id);
}

const XP_PER_LEVEL = CONSTANTS.XP_PER_LEVEL;

const BADGES_DEF = [
  // ===== Слова в словаре =====

  {
    id: 'first_word',

    icon: 'emoji_nature',

    name: 'Первое слово',

    desc: 'Добавь 1 слово в словарь',

    check: () => window.words.length >= 1,
  },

  {
    id: 'words_10',

    icon: 'menu_book',

    name: 'Начинающий коллекционер',

    desc: '10 слов в словаре',

    check: () => window.words.length >= 10,
  },

  {
    id: 'words_50',

    icon: 'auto_stories',

    name: 'Книжный червь',

    desc: '50 слов в словаре',

    check: () => window.words.length >= 50,
  },

  {
    id: 'words_100',

    icon: 'workspace_premium',

    name: 'Словарный запас',

    desc: '100 слов в словаре',

    check: () => window.words.length >= 100,
  },

  {
    id: 'words_250',

    icon: 'psychology',

    name: 'Эрудит',

    desc: '250 слов в словаре',

    check: () => window.words.length >= 250,
  },

  {
    id: 'words_500',

    icon: 'library_books',

    name: 'Лексикон',

    desc: '500 слов в словаре',

    check: () => window.words.length >= 500,
  },

  {
    id: 'words_1000',

    icon: 'language',

    name: 'Полиглот',

    desc: '1000 слов в словаре',

    check: () => window.words.length >= 1000,
  },

  // ===== Выученные слова =====

  {
    id: 'learned_1',

    icon: 'star',

    name: 'Первый успех',

    desc: 'Выучи 1 слово',

    check: () => window.words.filter(w => w.stats?.learned).length >= 1,
  },

  {
    id: 'learned_10',

    icon: 'stars',

    name: 'Звезда',

    desc: 'Выучи 10 слов',

    check: () => window.words.filter(w => w.stats?.learned).length >= 10,
  },

  {
    id: 'learned_25',

    icon: 'auto_awesome',

    name: 'Блестящий',

    desc: 'Выучи 25 слов',

    check: () => window.words.filter(w => w.stats?.learned).length >= 25,
  },

  {
    id: 'learned_50',

    icon: 'workspace_premium',

    name: 'Мастер слов',

    desc: 'Выучи 50 слов',

    check: () => window.words.filter(w => w.stats?.learned).length >= 50,
  },

  {
    id: 'learned_100',

    icon: 'emoji_events',

    name: 'Знаток',

    desc: 'Выучи 100 слов',

    check: () => window.words.filter(w => w.stats?.learned).length >= 100,
  },

  {
    id: 'learned_250',

    icon: 'school',

    name: 'Профессор',

    desc: 'Выучи 250 слов',

    check: () => window.words.filter(w => w.stats?.learned).length >= 250,
  },

  // ===== Серии (streak) =====

  {
    id: 'streak_3',

    icon: 'local_fire_department',

    name: 'Искра',

    desc: '3 дня подряд',

    check: () => streak.count >= 3,
  },

  {
    id: 'streak_7',

    icon: 'rocket_launch',

    name: 'Пламя',

    desc: '7 дней подряд',

    check: () => streak.count >= 7,
  },

  {
    id: 'streak_30',

    icon: 'whatshot',

    name: 'Огонь',

    desc: '30 дней подряд',

    check: () => streak.count >= 30,
  },

  {
    id: 'streak_100',

    icon: 'local_fire_department',

    name: 'Неугасимый',

    desc: '100 дней подряд',

    check: () => streak.count >= 100,
  },

  {
    id: 'streak_365',

    icon: 'emoji_events',

    name: 'Вечный',

    desc: '365 дней подряд (целый год!)',

    check: () => streak.count >= 365,
  },

  // ===== Опыт (XP) =====

  {
    id: 'xp_250',

    icon: 'emoji_objects',

    name: 'Любознательный',

    desc: 'Набери 250 XP',

    check: () => xpData.xp + (xpData.level - 1) * XP_PER_LEVEL >= 250,
  },

  {
    id: 'xp_500',

    icon: 'diamond',

    name: 'Прилежный',

    desc: 'Набери 500 XP',

    check: () => xpData.xp + (xpData.level - 1) * XP_PER_LEVEL >= 500,
  },

  {
    id: 'xp_1000',

    icon: 'military_tech',

    name: 'Эксперт',

    desc: 'Набери 1000 XP',

    check: () => xpData.xp + (xpData.level - 1) * XP_PER_LEVEL >= 1000,
  },

  {
    id: 'xp_2000',

    icon: 'workspace_premium',

    name: 'Профессионал',

    desc: 'Набери 2000 XP',

    check: () => xpData.xp + (xpData.level - 1) * XP_PER_LEVEL >= 2000,
  },

  {
    id: 'xp_3500',

    icon: 'star',

    name: 'Мастер',

    desc: 'Набери 3500 XP',

    check: () => xpData.xp + (xpData.level - 1) * XP_PER_LEVEL >= 3500,
  },

  {
    id: 'xp_5000',

    icon: 'emoji_events',

    name: 'Легенда',

    desc: 'Набери 5000 XP',

    check: () => xpData.xp + (xpData.level - 1) * XP_PER_LEVEL >= 5000,
  },

  {
    id: 'xp_7500',

    icon: 'military_tech',

    name: 'Герой',

    desc: 'Набери 7500 XP',

    check: () => xpData.xp + (xpData.level - 1) * XP_PER_LEVEL >= 7500,
  },

  {
    id: 'xp_10000',

    icon: 'workspace_premium',

    name: 'Бессмертный',

    desc: 'Набери 10000 XP',

    check: () => xpData.xp + (xpData.level - 1) * XP_PER_LEVEL >= 10000,
  },

  // ===== Особые =====

  {
    id: 'perfect',

    icon: 'target',

    name: 'Снайпер',

    desc: 'Сессия без ошибок (минимум 5 слов)',

    check: () => false, // будет проверяться через perfectSession параметр
  },

  {
    id: 'level_5',

    icon: 'bolt',

    name: 'Прокачанный',

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
    id: 'level_20',

    icon: 'rocket_launch',

    name: 'Ас',

    desc: 'Достигни 20 уровня',

    check: () => xpData.level >= 20,
  },

  {
    id: 'level_50',

    icon: 'workspace_premium',

    name: 'Бог',

    desc: 'Достигни 50 уровня',

    check: () => xpData.level >= 50,
  },
];

function xpNeeded(lvl) {
  return lvl * XP_PER_LEVEL;
}

function gainXP(amount, reason = '') {
  console.log('🎯 gainXP вызван:', {
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

  showXPToast('+' + amount + ' XP' + (reason ? ' · ' + reason : ''));

  // Сохраняем профиль через debounce

  console.log('💾 Вызываем debouncedSaveProfile из gainXP');

  window.debouncedSaveProfile?.();

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

  BADGES_DEF.forEach(def => {
    if (xpData.badges.includes(def.id)) return;

    const earned = def.id === 'perfect' ? !!perfectSession : def.check();

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
    const target = parseInt(def.id.split('_')[1]);

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
      (def.icon.includes('🔥')
        ? def.icon
        : `<span class="material-symbols-outlined">${def.icon}</span>`) +
      '</div>' +
      '<div class="badge-name">' +
      def.name +
      '</div>' +
      '<div class="badge-desc">' +
      def.desc +
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

  saveStreak();

  window.debouncedSaveProfile?.();

  console.log('✅ updStreak завершен');
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

    if (v.voiceURI === speech_cfg.voiceURI) opt.selected = true;

    sel.appendChild(opt);
  });

  if (!sel.value && sel.options.length) {
    speech_cfg.voiceURI = sel.options[0].value;

    window.lastProfileUpdate = Date.now(); // Оптимистичное обновление

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

  const voice = voices.find(v => v.voiceURI === speech_cfg.voiceURI);

  if (voice) utt.voice = voice;

  utt.rate = speech_cfg.rate;

  utt.pitch = speech_cfg.pitch;

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
      speech_cfg.accent = e.target.value;

      window.lastProfileUpdate = Date.now(); // Оптимистичное обновление

      saveSpeech();

      loadVoices(); // Перезагружаем голоса для нового акцента
    });
  }

  if (voiceSelect) {
    voiceSelect.addEventListener('change', e => {
      speech_cfg.voiceURI = e.target.value;

      window.lastProfileUpdate = Date.now(); // Оптимистичное обновление

      saveSpeech();
    });
  }

  if (speedRange) {
    speedRange.addEventListener('input', e => {
      speech_cfg.rate = +e.target.value;

      if (speedVal) speedVal.textContent = e.target.value + 'x';

      window.lastProfileUpdate = Date.now(); // Оптимистичное обновление

      saveSpeech();
    });
  }

  if (pitchRange) {
    pitchRange.addEventListener('input', e => {
      speech_cfg.pitch = +e.target.value;

      if (pitchVal) pitchVal.textContent = (+e.target.value).toFixed(1);

      window.lastProfileUpdate = Date.now(); // Оптимистичное обновление

      saveSpeech();
    });
  }

  if (testBtn) {
    testBtn.addEventListener('click', function () {
      const btn = this;

      const orig = btn.innerHTML;

      btn.disabled = true;

      btn.innerHTML =
        '<span class="material-symbols-outlined">graphic_eq</span> Играет...';

      speak('Test pronunciation. This is how your voice sounds.', () => {
        btn.innerHTML = orig;

        btn.disabled = false;
      });
    });
  }

  // Set initial values

  if (speedRange) speedRange.value = speech_cfg.rate;

  if (speedVal) speedVal.textContent = speech_cfg.rate + 'x';

  if (pitchRange) pitchRange.value = speech_cfg.pitch;

  if (pitchVal) pitchVal.textContent = speech_cfg.pitch.toFixed(1);
}

// Initialize listeners when DOM is ready

setupSpeechListeners();

// ============================================================

// TOAST

// ============================================================

function showLimitModal(limit) {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const msUntilMidnight = midnight - now;
  const hours = Math.floor(msUntilMidnight / 3600000);
  const minutes = Math.floor((msUntilMidnight % 3600000) / 60000);
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

        Дневной лимит достигнут! 🎯

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

  // Автоматически закрываем через 10 секунд и возвращаем к практике

  setTimeout(() => {
    if (modal.parentNode) {
      modal.remove();

      document.getElementById('practice-setup').style.display = 'block';
    }
  }, 10000);
}

function toast(msg, type = '', icon = '') {
  const el = document.createElement('div');

  el.className = 'toast' + (type ? ' ' + type : '');

  if (icon) {
    el.innerHTML = `<span class="material-symbols-outlined" style="font-size: 1.2em; vertical-align: middle; margin-right: 8px;">${icon}</span>${msg}`;
  } else {
    el.textContent = msg;
  }

  document.getElementById('toast-box').appendChild(el);

  // Увеличиваем время для важных сообщений

  const isImportant =
    msg.includes('лимит') || msg.includes('Лимит') || type === 'danger';

  const duration = isImportant ? 6000 : 2600; // 6 секунд для лимитов

  setTimeout(() => {
    el.style.opacity = '0';

    el.style.transition = 'opacity .3s';

    setTimeout(() => el.remove(), 320);
  }, duration);
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
    if (due > 0) {
      desktopBadge.textContent = count;
      desktopBadge.style.display = 'inline-block';
    } else {
      desktopBadge.textContent = '';
      desktopBadge.style.display = 'none';
    }
  }

  if (mobileBadge) {
    if (due > 0) {
      mobileBadge.textContent = count;
      mobileBadge.style.display = 'inline-block';
    } else {
      mobileBadge.textContent = '';
      mobileBadge.style.display = 'none';
    }
  }
}

// Render stats function

function renderStats() {
  const now = new Date();
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  let dueCount = 0;
  let learnedCount = 0;
  let thisWeekCount = 0;
  const wordsWithStats = [];

  // Sparkline данные по дням (собираем на случай если понадобятся в будущем)
  const dayCounts = new Map();

  // Один проход по всем словам для сбора всех статистик
  for (const w of window.words) {
    // Due count
    if (new Date(w.stats.nextReview || now) <= now) dueCount++;

    // Learned count
    if (w.stats.learned) learnedCount++;

    // This week count
    if (new Date(w.createdAt) > weekAgo) thisWeekCount++;

    // Words with stats for hard/easy analysis
    if (w.stats && w.stats.shown > 0) wordsWithStats.push(w);

    // Sparkline данные по дням
    const createdDate = new Date(w.createdAt).toDateString();
    dayCounts.set(createdDate, (dayCounts.get(createdDate) || 0) + 1);
  }

  const total = window.words.length;
  const learned = learnedCount;
  const pct = total ? Math.round((learned / total) * 100) : 0;
  const thisWeek = thisWeekCount;

  const stats = {
    total,
    learned,
    pct,
    dueCount,
    thisWeek,
  };

  const stDueEl = document.getElementById('st-due');

  if (stDueEl) stDueEl.textContent = dueCount;

  const pillEl = document.getElementById('due-pill');

  if (pillEl) pillEl.textContent = dueCount;

  const stTotalEl = document.getElementById('st-total');

  if (stTotalEl) stTotalEl.textContent = total;

  const stLearnedEl = document.getElementById('st-learned');

  if (stLearnedEl) stLearnedEl.textContent = learned;

  const stLearnedBarEl = document.getElementById('st-learned-bar');

  if (stLearnedBarEl) {
    const pct = Math.min(100, Math.round((learned / total) * 100));

    stLearnedBarEl.style.width = pct + '%';
  }

  const stStreakEl = document.getElementById('st-streak');

  if (stStreakEl) stStreakEl.textContent = streak.count;

  const stWeekEl = document.getElementById('st-week');

  if (stWeekEl) stWeekEl.textContent = thisWeek;

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

  // Daily review count display

  const reviewedCountEl = document.getElementById('today-reviewed-count');

  if (reviewedCountEl) {
    reviewedCountEl.textContent = window.dailyReviewCount;
  }

  // Update cap progress bar

  const capProgress = document.getElementById('daily-cap-progress');

  if (capProgress) {
    const limit = getReviewLimit();

    const pct = Math.min(
      100,

      Math.round((window.dailyReviewCount / limit) * 100),
    );

    capProgress.innerHTML = `

      <div class="daily-cap-info">

        <div class="daily-cap-count">

          Сегодня повторено: <strong>${window.dailyReviewCount}</strong> / ${limit === 9999 ? '∞' : limit}

        </div>

        <div class="daily-cap-status ${window.dailyReviewCount >= limit ? 'completed' : ''}">

          ${window.dailyReviewCount >= limit ? '✓ Лимит достигнут!' : `${Math.round(pct)}%`}

        </div>

      </div>

      <div class="daily-cap-bar">

        <div class="daily-cap-fill ${window.dailyReviewCount >= limit ? 'completed' : ''}" style="width: ${pct}%;"></div>

      </div>

    `;

    // Временная отладка видимости
    if (DEBUG) {
      const styles = window.getComputedStyle(capProgress);

      const parent = capProgress.parentElement;

      const tabPane = capProgress.closest('.tab-pane');

      const tabPaneStyles = tabPane ? window.getComputedStyle(tabPane) : null;

      console.log('🔍 Видимость бара:', {
        display: styles.display,

        visibility: styles.visibility,

        opacity: styles.opacity,

        offsetHeight: capProgress.offsetHeight,

        offsetWidth: capProgress.offsetWidth,

        parentDisplay: parent
          ? window.getComputedStyle(parent).display
          : 'no parent',

        parentVisible: parent ? parent.offsetParent !== null : 'no parent',

        tabPaneId: tabPane ? tabPane.id : 'no tab-pane',

        tabPaneDisplay: tabPaneStyles ? tabPaneStyles.display : 'no tab-pane',

        tabPaneActive: tabPane
          ? tabPane.classList.contains('active')
          : 'no tab-pane',
      });
    }
  } else {
    console.log('❌ Элемент daily-cap-progress не найден');
  }
}

// Render daily goals separately

function renderDailyGoals() {
  const container = document.getElementById('daily-goals-list');

  if (!container) return;

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

// ============================================================

// THEME MANAGEMENT

// ============================================================

window.applyTheme = function (themeName) {
  console.log('applyTheme called with:', themeName);

  // Поддержка обратной совместимости: если themeName это boolean

  if (typeof themeName === 'boolean') {
    themeName = themeName ? 'dark' : 'lavender';
  }

  // Убираем все классы тем

  document.documentElement.classList.remove('dark', 'lavender', 'figma');

  switch (themeName) {
    case 'dark':
      document.documentElement.classList.add('dark');

      window.applyDark(true);

      break;

    case 'lavender':
      // Светлая тема (уже по умолчанию)

      window.applyDark(false);

      break;

    case 'figma':
      // Можно добавить специальную тему Figma если нужно

      window.applyDark(false);

      break;

    default:
      // Fallback на светлую

      window.applyDark(false);
  }

  // Обновляем user_settings

  if (!window.user_settings) {
    window.user_settings = {};
  }

  window.user_settings.theme = themeName;

  // Сохраняем в localStorage для немедленного сохранения

  localStorage.setItem(
    'englift_user_settings',

    JSON.stringify(window.user_settings),
  );

  // Сохраняем в профиль с дебаунсом

  debouncedSaveProfile();
};

window.applyDark = function (on) {
  console.log('applyDark called with:', on);

  console.log('HTML classes before:', document.documentElement.className);

  // Предотвращаем мерцание путем временного скрытия документа

  const originalVisibility = document.documentElement.style.visibility;

  document.documentElement.style.visibility = 'hidden';

  document.documentElement.classList.toggle('dark', on);

  setTimeout(() => {
    document.documentElement.style.visibility = originalVisibility || '';
  }, 10);

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
};

// New theme toggle checkbox handler

const themeCheckbox = document.getElementById('theme-checkbox');

if (themeCheckbox) {
  themeCheckbox.addEventListener('change', async e => {
    const on = e.target.checked;

    const themeName = on ? 'dark' : 'lavender';

    console.log('Theme checkbox changed, new theme:', themeName);

    // Применяем тему через новую функцию

    window.applyTheme(themeName);

    // Сохраняем в localStorage для быстрого доступа

    localStorage.setItem(CONSTANTS.STORAGE_KEYS.DARK_MODE, on);
  });
}

// Убираем немедленное применение темы из localStorage

// Теперь тема применяется только из профиля после загрузки

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

    if (dirtyWords.size > 0) {
      await performSync();
    }
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
  document.getElementById('words-count').textContent = window.words.length;

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

  document.getElementById('words-subtitle').textContent =
    list.length !== window.words.length
      ? `(${list.length} из ${window.words.length})`
      : `— ${window.words.length} слов`;
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

  card.dataset.phonetic = w.phonetic || '';

  card.dataset.examples = JSON.stringify(w.examples || []);

  card.dataset.tags = JSON.stringify(w.tags || []);

  card.dataset.learned = w.stats.learned;

  // Базовая разметка (свёрнутое состояние)

  card.innerHTML = `

    <div class="word-card-header">

      <div class="word-main">

        <h3 class="word-title">${esc(w.en)}</h3>

        ${w.phonetic ? `<span class="word-phonetic">${esc(w.phonetic)}</span>` : ''}

      </div>

      <div class="word-actions">

        ${
          speechSupported
            ? `

          <button class="audio-btn" data-word="${safeAttr(w.en)}" title="Прослушать">

            <span class="material-symbols-outlined">volume_up</span>

          </button>

        `
            : ''
        }

        ${w.stats.learned ? '<span class="learned-badge" title="Выучено"><span class="material-symbols-outlined">check_circle</span></span>' : ''}

      </div>

    </div>

    <div class="word-translation">${parseAnswerVariants(w.ru).join(', ') || esc(w.ru)}</div>

    <div class="word-card-footer">

      <span class="expand-hint">Нажмите, чтобы раскрыть</span>

      <span class="material-symbols-outlined expand-icon">expand_more</span>

    </div>

  `;

  // Добавляем обработчик клика для раскрытия

  card.addEventListener('click', e => {
    // Игнорируем клики по кнопкам аудио, редактирования, удаления

    if (
      e.target.closest('.audio-btn') ||
      e.target.closest('.edit-btn') ||
      e.target.closest('.delete-btn')
    ) {
      return;
    }

    card.classList.toggle('expanded');

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

        <h4>Примеры</h4>

        ${examples

          .map(
            ex => `

          <div class="example-item">

            <p>${esc(ex.text)}</p>

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

        ${tags.map(tag => `<span class="tag" data-tag="${esc(tag)}">${esc(tag)}</span>`).join('')}

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
  // Обработка аудио-кнопок (оставляем как есть)

  if (e.target.closest('.audio-btn')) {
    const btn = e.target.closest('.audio-btn');

    speakBtn(btn.dataset.word, btn);

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

    document.getElementById('del-modal').classList.add('open');

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

    <div class="form-group"><label>Транскрипция</label><input type="text" class="e-phonetic form-control" value="${safeAttr(w.phonetic || '')}"></div>

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

      phonetic: card.querySelector('.e-phonetic').value.trim(),

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
      '<span><span class="material-symbols-outlined" style="vertical-align: middle; font-size: 16px; margin-right: 4px;">delete</span> «' +
      esc(wSnap ? wSnap.en : 'Слово') +
      '» удалено</span>' +
      '<button class="toast-undo-btn"><span class="material-symbols-outlined" style="vertical-align: middle; font-size: 14px;">undo</span> Отменить</button>';

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

      showXPToast(
        '<span class="material-symbols-outlined" style="vertical-align: middle; font-size: 16px;">restore</span> «' +
          wSnap.en +
          '» восстановлено!',
      );
    });

    setTimeout(() => {
      if (!undone) {
        undoEl.style.opacity = '0';

        undoEl.style.transition = 'opacity .3s';

        setTimeout(() => {
          undoEl.remove();

          // Показываем финальный тост что слово окончательно удалено

          toast('Слово удалено', 'success', 'delete');
        }, 320);
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
  const bank = window.wordBank;
  if (!bank || bank.length === 0) return null;
  return bank.find(w => w.en.toLowerCase() === word.toLowerCase()) || null;
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
        const newCard = document.querySelector('#words-grid .word-card');

        if (newCard) {
          newCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

          newCard.classList.add('new-word-highlight');
        }
      }, 100);
    }, 100);
  }
});

// File import variables

// Переменные для автодополнения

let suggestionsVisible = false;

let selectedSuggestionIndex = -1;

const enInput = document.getElementById('f-en');

const suggestionsContainer = document.getElementById(
  'autocomplete-suggestions',
);

// Debounce функция

function debounce(fn, delay) {
  let timer;

  return (...args) => {
    clearTimeout(timer);

    timer = setTimeout(() => fn(...args), delay);
  };
}

// Фильтрация и отображение подсказок

const showSuggestions = debounce(query => {
  if (!query || query.length < 2) {
    suggestionsContainer.style.display = 'none';

    return;
  }

  const lowerQuery = query.toLowerCase();

  // Собираем слова из банка и из уже добавленных пользователем

  const bankWords = (window.wordBank || []).map(w => w.en);

  const userWords = window.words.map(w => w.en);

  const allWords = [...new Set([...bankWords, ...userWords])]; // убираем дубликаты

  // Фильтруем по началу строки

  const matches = allWords

    .filter(word => word.toLowerCase().startsWith(lowerQuery))

    .slice(0, 10); // не больше 10

  if (matches.length === 0) {
    suggestionsContainer.style.display = 'none';

    return;
  }

  // Формируем HTML

  suggestionsContainer.innerHTML = matches

    .map(
      (word, index) =>
        `<div class="suggestion-item" data-index="${index}" data-word="${word}">${word}</div>`,
    )

    .join('');

  suggestionsContainer.style.display = 'block';

  selectedSuggestionIndex = -1; // сбрасываем выделение
}, 200);

// Обработчик ввода

enInput.addEventListener('input', e => {
  showSuggestions(e.target.value);
});

// Обработчик клика на подсказку (через делегирование)

suggestionsContainer.addEventListener('click', e => {
  const target = e.target.closest('.suggestion-item');

  if (!target) return;

  const selectedWord = target.dataset.word;

  enInput.value = selectedWord;

  suggestionsContainer.style.display = 'none';

  // Автоматически запускаем автозаполнение

  document.getElementById('auto-fill-btn').click();
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

    const selectedItem = items[selectedSuggestionIndex];

    const word = selectedItem.dataset.word;

    enInput.value = word;

    suggestionsContainer.style.display = 'none';

    document.getElementById('auto-fill-btn').click();
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

        if (
          !window.words.some(
            existing => existing.en.toLowerCase() === w.en.toLowerCase(),
          )
        ) {
          window.words.push(
            mkWord(w.en, w.ru, w.ex, w.tags || [], w.phonetic || null),
          );

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

  ?.addEventListener('click', () => {
    const modal = document.getElementById('speech-modal');

    modal.classList.add('open');

    // Load voices

    loadVoices();

    // Set current speech settings

    setTimeout(() => {
      document.getElementById('modal-voice-select').value =
        window.speech_cfg.voiceURI || '';

      document.getElementById('modal-accent-select').value =
        window.speech_cfg.accent || 'US';

      document.getElementById('modal-speed-range').value =
        window.speech_cfg.rate || 0.9;

      document.getElementById('modal-pitch-range').value =
        window.speech_cfg.pitch || 1.0;

      document.getElementById('modal-speed-val').textContent =
        (window.speech_cfg.rate || 0.9) + 'x';

      document.getElementById('modal-pitch-val').textContent = (
        window.speech_cfg.pitch || 1.0
      ).toFixed(1);
    }, 100);

    // Load practice settings

    const current = window.user_settings?.reviewLimit || 100;

    document.getElementById('review-limit-select').value =
      current === 9999 ? '9999' : current;

    document.getElementById('current-limit-info').innerHTML =
      `Текущий лимит: <strong>${current === 9999 ? 'Без лимита' : current}</strong>`;

    // Load timer settings

    const currentTimed = window.user_settings?.timedMode || 'off';

    const timedChip = document.querySelector(
      `.chip[data-timed="${currentTimed}"]`,
    );

    if (timedChip) {
      document

        .querySelectorAll('.chip[data-timed]')

        .forEach(chip => chip.classList.remove('on'));

      timedChip.classList.add('on');
    }
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

document.getElementById('speech-modal-cancel').addEventListener('click', () => {
  document.getElementById('speech-modal').classList.remove('open');
});

document.getElementById('speech-modal-close').addEventListener('click', () => {
  document.getElementById('speech-modal').classList.remove('open');
});

document

  .getElementById('speech-modal-save')

  ?.addEventListener('click', async () => {
    const voiceSelect = document.getElementById('modal-voice-select');

    const accentSelect = document.getElementById('modal-accent-select');

    const speedRange = document.getElementById('modal-speed-range');

    const pitchRange = document.getElementById('modal-pitch-range');

    const limitSelect = document.getElementById('review-limit-select');

    // Save speech settings

    const selectedVoice = voiceSelect.value;

    const selectedAccent = accentSelect.value;

    const selectedSpeed = parseFloat(speedRange.value);

    const selectedPitch = parseFloat(pitchRange.value);

    window.speech_cfg = {
      voiceURI: selectedVoice,

      accent: selectedAccent,

      rate: selectedSpeed,

      pitch: selectedPitch,
    };

    // Save practice settings

    const newLimit =
      limitSelect.value === '9999' ? 9999 : parseInt(limitSelect.value);

    window.user_settings = window.user_settings || {};

    window.user_settings.reviewLimit = newLimit;

    // Обновляем метку времени сразу (оптимистично)

    window.lastProfileUpdate = Date.now();

    // УДАЛЕНО: Обновление MAX_REVIEWS_PER_DAY - теперь используется getReviewLimit()

    // Save to Supabase

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        debouncedSaveUserData(user.id, {
          speech_cfg: window.speech_cfg,

          user_settings: window.user_settings,
        });
      }
    } catch (error) {
      console.error('Error saving speech settings:', error);
    }

    // Update UI

    localStorage.setItem('englift_speech', JSON.stringify(window.speech_cfg));

    document.getElementById('speech-modal').classList.remove('open');

    // Update statistics

    renderStats();

    // Show success toast

    const limitText = newLimit === 9999 ? 'Без лимита' : newLimit;

    toast(`Настройки сохранены! Лимит повторений: ${limitText}`, 'success');
  });

document.getElementById('speech-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) {
    document.getElementById('speech-modal').classList.remove('open');
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

  // Функция проверки

  const checkInput = () => {
    const isValid =
      inputEl.value.trim().toLowerCase() === expectedText.toLowerCase();

    confirmBtn.disabled = !isValid;

    confirmBtn.style.opacity = isValid ? '1' : '0.5';
  };

  // Обработчики

  inputEl.addEventListener('input', checkInput);

  inputEl.addEventListener('keyup', e => {
    if (e.key === 'Enter' && !confirmBtn.disabled) {
      onConfirm();

      modal.classList.remove('open');
    }
  });

  confirmBtn.onclick = () => {
    if (!confirmBtn.disabled) {
      onConfirm();

      modal.classList.remove('open');
    }
  };

  cancelBtn.onclick = () => {
    modal.classList.remove('open');
  };

  // Закрытие по клику на фон

  modal.addEventListener('click', e => {
    if (e.target === modal) {
      modal.classList.remove('open');
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

        // 2. Удаляем слова с сервера

        if (window.currentUserId) {
          console.log(
            '🗑️ Удаляем слова с сервера для user_id:',

            window.currentUserId,
          );

          try {
            // Сначала пробуем массовое удаление через Supabase client

            const { error, count } = await supabase

              .from('user_words')

              .delete({ count: 'exact' })

              .eq('user_id', window.currentUserId);

            console.log('🗑️ Результат массового удаления слов:', {
              error,

              count,
            });

            if (!error) {
              console.log(`✅ Удалено ${count} слов с сервера`);

              toast(`✅ Удалено ${count} слов с сервера`, 'success');
            } else {
              throw error;
            }
          } catch (supabaseError) {
            console.warn(
              '⚠️ Supabase client не смог удалить, пробуем REST API',
            );

            console.warn('Ошибка Supabase:', supabaseError.message);

            // Пробуем через REST API с правильными заголовками

            try {
              const response = await fetch(
                `${supabase.supabaseUrl}/rest/v1/user_words?user_id=eq.${window.currentUserId}`,

                {
                  method: 'DELETE',

                  headers: {
                    apikey: supabase.supabaseKey,

                    Authorization: `Bearer ${supabase.supabaseKey}`,

                    'Content-Type': 'application/json',

                    Prefer: 'return=minimal',
                  },
                },
              );

              if (response.ok) {
                console.log('✅ Удалено через REST API');

                toast('✅ Все слова удалены через REST API', 'success');
              } else {
                const errorText = await response.text();

                console.error(
                  '❌ REST API ошибка:',

                  response.status,

                  errorText,
                );

                throw new Error(`REST API: ${response.status} - ${errorText}`);
              }
            } catch (restError) {
              console.warn('⚠️ REST API тоже не смог, пробуем по одному');

              toast('Пробуем удалить по одному слову...', 'warning');

              // Удаляем по одному слову

              const wordsToDelete = [...window.words];

              let deletedCount = 0;

              for (const word of wordsToDelete) {
                try {
                  const { error: singleError } = await supabase

                    .from('user_words')

                    .delete()

                    .eq('id', word.id);

                  if (singleError) {
                    console.error(
                      `❌ Ошибка удаления слова "${word.en}":`,

                      singleError.message,
                    );
                  } else {
                    deletedCount++;

                    console.log(`✅ Слово "${word.en}" удалено`);
                  }
                } catch (e) {
                  console.error(
                    `❌ Исключение при удалении слова "${word.en}":`,

                    e,
                  );
                }
              }

              console.log(`✅ Удалено ${deletedCount} слов по одному`);

              toast(`✅ Удалено ${deletedCount} слов по одному`, 'success');
            }
          }
        } else {
          console.log('❌ Нет currentUserId для удаления слов с сервера');

          toast('Ошибка: нет ID пользователя', 'danger');

          return;
        }

        // 3. Очищаем очереди синхронизации

        pendingWordUpdates.clear();

        dirtyWords.clear();

        // 4. Обновляем интерфейс

        refreshUI();

        // 5. Показываем успех

        toast('✅ Все слова успешно стерты!', 'success');

        console.log('✅ Все слова стерты успешно');
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
      try {
        console.log('🔥 Начинаем удаление аккаунта...');

        // 1. Удаляем профиль с сервера

        if (window.currentUserId) {
          const { error: profileError } = await supabase

            .from('profiles')

            .delete()

            .eq('id', window.currentUserId);

          if (profileError) {
            console.error('❌ Ошибка удаления профиля:', profileError);

            toast('Ошибка при удалении профиля', 'danger');

            return;
          }

          // 2. Удаляем слова с сервера

          const { error: wordsError } = await supabase

            .from('user_words')

            .delete()

            .eq('user_id', window.currentUserId);

          if (wordsError) {
            console.error('❌ Ошибка удаления слов:', wordsError);

            toast('Ошибка при удалении слов', 'danger');

            return;
          }

          // 3. Выходим из аккаунта

          await supabase.auth.signOut();
        }

        // 4. Очищаем все локальные данные

        localStorage.clear();

        window.words = [];

        window.currentUserId = null;

        window.user_settings = {};

        window.speech_cfg = {};

        // 5. Перезагружаем страницу на вход

        toast('✅ Аккаунт успешно удален', 'success');

        console.log('✅ Аккаунт успешно удален');

        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } catch (error) {
        console.error('❌ Ошибка при удалении аккаунта:', error);

        toast('Ошибка при удалении аккаунта', 'danger');
      }
    },
  );
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
    // Проверяем наличие XLSX библиотеки

    if (typeof XLSX === 'undefined') {
      toast(
        '⚠️ Библиотека для импорта Excel не загружена. Попробуйте обновить страницу.',

        'danger',
      );

      return;
    }

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
  lastSessionConfig = null,
  currentExerciseTimer = null; // Сбрасываем флаг сессии при загрузке страницы

window.isSessionActive = false;

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

document.querySelectorAll('.chip[data-timed]').forEach(c =>
  c.addEventListener('click', async () => {
    document

      .querySelectorAll('.chip[data-timed]')

      .forEach(x => x.classList.remove('on'));

    c.classList.add('on');

    // Сохраняем настройку таймера

    window.user_settings = window.user_settings || {};

    window.user_settings.timedMode = c.dataset.timed;

    // Обновляем метку времени сразу (оптимистично)

    window.lastProfileUpdate = Date.now();

    // Сохраняем в Supabase если пользователь авторизован

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        debouncedSaveUserData(user.id, {
          speech_cfg: window.speech_cfg,

          user_settings: window.user_settings,
        });
      }
    } catch (error) {
      console.error('Error saving timed mode:', error);
    }
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

// Practice time tracking

let practiceStartTime = null;

// Exam mode variables

let practiceMode = 'normal'; // 'normal' или 'exam'

let examTime = 600; // секунд (по умолчанию 10 мин)

let examQuestions = 50;

let examTimerInterval = null;

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

function getCardsToReview() {
  // All cards that are due (nextReview <= now)

  let dueCards = window.words.filter(w => {
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

    // 2. Формируем пул слов (общий для обоих режимов)

    let pool = [...window.words];

    if (filterVal === 'learning') pool = pool.filter(w => !w.stats.learned);

    if (filterVal === 'due') {
      pool = getCardsToReview(); // Use capped function
    } else {
      // Для остальных фильтров просто формируем пул, лимит проверится ниже
    }

    if (filterVal === 'random') pool = pool.sort(() => Math.random() - 0.5);

    if (!pool.length) {
      toast('Нет слов для практики', 'warning');

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
      console.log('🎯 Starting EXAM mode');

      // Экзамен - используем фиксированный набор типов

      const types = ['multi', 'type', 'builder', 'speech'];

      const dirVal =
        document.querySelector('.chip[data-dir].on')?.dataset.dir || 'both';

      // Создаем сессию для экзамена

      session = {
        words: pool,

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

    // Фильтруем неподдерживаемые (например, диктант без речи)

    if (!speechSupported) {
      exTypes = exTypes.filter(t => t !== 'dictation');

      if (!exTypes.length) {
        toast('Диктант недоступен без синтеза речи', 'danger');

        // Сбрасываем флаг активной сессии

        window.isSessionActive = false;

        return;
      }
    }

    const dirVal =
      document.querySelector('.chip[data-dir].on')?.dataset.dir || 'both';

    const timedVal =
      document.querySelector('.chip[data-timed].on')?.dataset.timed || 'off';

    // Создаем сессию для обычного режима

    session = {
      words: pool,

      exTypes,

      dir: dirVal,

      timed: timedVal === 'on',

      mode: 'normal',
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

  document.getElementById('r-correct').innerHTML = sResults.correct

    .map(
      w =>
        `<li>${esc(w.en)} — ${parseAnswerVariants(w.ru).join(', ') || esc(w.ru)}</li>`,
    )

    .join('');

  document.getElementById('r-wrong').innerHTML = sResults.wrong

    .map(
      w =>
        `<li>${esc(w.en)} — ${parseAnswerVariants(w.ru).join(', ') || esc(w.ru)}</li>`,
    )

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

    // Обновляем метку времени сразу (оптимистично)

    window.lastProfileUpdate = Date.now();

    checkDailyGoalsCompletion();

    practiceStartTime = null; // Сбрасываем таймер
  }

  // Обновляем интерфейс после всех изменений

  refreshUI();

  // Немедленно сохраняем статистику после завершения практики

  console.log('💾 Вызываем debouncedSaveProfile из showResults');

  window.debouncedSaveProfile?.();

  console.log('✅ showResults завершен');
}

function nextExercise() {
  // Защита от многократного вызова

  if (window.nextExerciseRunning) {
    console.log('⚠️ nextExercise уже выполняется, пропускаем вызов');

    return;
  }

  window.nextExerciseRunning = true;

  console.log('🎯 nextExercise called, session:', session);

  console.log(
    '📊 sIdx:',

    sIdx,

    'session.words.length:',

    session?.words?.length,
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

    if (sIdx >= session.words.length) {
      showResults();

      return;
    }

    const w = session.words[sIdx];

    const t =
      session.exTypes[Math.floor(Math.random() * session.exTypes.length)];

    console.log('🎲 Selected exercise type:', t, 'for word:', w.en);

    if (progFill) {
      progFill.style.width =
        Math.round((sIdx / session.words.length) * 100) + '%';
    }

    if (exCounter) {
      exCounter.textContent = `${sIdx + 1} / ${session.words.length}`;
    }

    if (currentExerciseTimer) {
      clearInterval(currentExerciseTimer);

      currentExerciseTimer = null;
    }

    if (session.timed) {
      const oldTimer = headerContainer.querySelector('.exercise-timer');

      if (oldTimer) {
        oldTimer.remove();
      }

      const timerEl = document.createElement('div');

      timerEl.id = 'exercise-timer';

      timerEl.className = 'exercise-timer';

      timerEl.innerHTML = `



        <span class="material-symbols-outlined">timer</span>



        <span class="timer-text">0:10</span>



      `;

      headerContainer.insertBefore(timerEl, headerContainer.firstChild);

      let timeRemaining = 10;

      session.currentTimerEl = timerEl;

      currentExerciseTimer = setInterval(() => {
        timeRemaining--;

        const timerText = timerEl.querySelector('.timer-text');

        if (timerText) {
          timerText.textContent = `${timeRemaining}s`;
        }

        // Красный цвет на последних 3 секундах

        if (timeRemaining <= 3) {
          timerEl.classList.add('timer-urgent');
        } else {
          timerEl.classList.remove('timer-urgent');
        }

        if (timeRemaining <= 0) {
          clearInterval(currentExerciseTimer);

          currentExerciseTimer = null;

          timerEl.remove();

          session.currentTimerEl = null;

          recordAnswer(false);

          sIdx++;

          nextExercise();
        }
      }, 1000);
    }

    if (t === 'flash') {
      if (exTypeLbl) {
        exTypeLbl.innerHTML =
          '<span class="material-symbols-outlined">style</span> Карточка';
      }

      if (exCounter) {
        exCounter.textContent = `${sIdx + 1} / ${session.words.length}`;
      }

      const dir = session.dir || 'both';

      const showRU = dir === 'ru-en' || (dir === 'both' && Math.random() > 0.5);

      let frontWord, backWord;

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

      if (exContent) {
        exContent.innerHTML = `

          <div class="flashcard-scene" id="fc-scene">

            <div class="flashcard-inner" id="fc-inner">

              <div class="card-face front">

                <div style="display:flex;align-items:center;gap:.75rem">

                  <div class="card-word">${esc(frontWord)}</div>

                  ${!showRU && speechSupported ? `<button class="btn-audio" id="fc-audio-btn" title="Произнести"><span class="material-symbols-outlined">volume_up</span></button>` : ''}

                </div>

                <div class="card-hint" style="font-size:.7rem;opacity:.5">${showRU ? 'RU' : 'EN'} · нажми для перевода</div>

              </div>

              <div class="card-face back">

                <div class="card-trans">

                  ${(() => {
                    const variants = parseAnswerVariants(backWord);

                    return variants.join(', ') || esc(backWord);
                  })()}

                </div>

                ${!showRU && w.ex ? `<div class="card-ex">${esc(w.ex)}</div>` : ''}

              </div>

            </div>

          </div>

        `;
      }

      if (autoPron && !showRU && speechSupported)
        setTimeout(() => speak(w.en), 300);

      // Изначально скрываем кнопки ответа для карточек

      if (exBtns) {
        exBtns.innerHTML = `<div class="flash-hint">Переверни карточку для ответа</div>`;
      }

      // Добавляем обработку аудио кнопки

      if (!showRU && speechSupported) {
        const fcAudioBtn = document.getElementById('fc-audio-btn');

        if (fcAudioBtn) {
          fcAudioBtn.addEventListener('click', e => {
            e.stopPropagation();

            speakBtn(w.en, e.currentTarget);
          });
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

              const knewBtn = document.getElementById('knew-btn');

              const didntBtn = document.getElementById('didnt-btn');

              if (knewBtn)
                knewBtn.onclick = () => {
                  recordAnswer(true);

                  sIdx++;

                  nextExercise();
                };

              if (didntBtn)
                didntBtn.onclick = () => {
                  recordAnswer(false);

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
        exCounter.textContent = `${sIdx + 1} / ${session.words.length}`;
      }

      const dir = session.dir || 'both';

      const isRUEN = dir === 'ru-en' || (dir === 'both' && Math.random() > 0.5);

      // Вопрос (красиво форматируем варианты через запятую)

      const question = isRUEN
        ? parseAnswerVariants(w.ru).join(', ') || w.ru
        : w.en;

      // Правильный ответ — первый вариант из строки перевода

      const correctFull = isRUEN ? w.en : w.ru;

      const correctVariants = parseAnswerVariants(correctFull);

      const correct =
        correctVariants.length > 0 ? correctVariants[0] : correctFull;

      // Собираем дистракторы из других слов

      let otherWords = window.words.filter(x => x.id !== w.id);

      // Для каждого другого слова берём первый вариант его перевода в зависимости от направления

      let distractorCandidates = otherWords

        .map(x => {
          const trans = isRUEN ? x.en : x.ru;

          const variants = parseAnswerVariants(trans);

          return variants.length > 0 ? variants[0] : trans;
        })

        .filter(v => v !== correct); // исключаем совпадения с правильным ответом

      // Перемешиваем и берём до 3 дистракторов

      let distractors = distractorCandidates

        .sort(() => Math.random() - 0.5)

        .slice(0, 3);

      // Если дистракторов меньше 3 (например, мало слов), дополняем другими вариантами текущего слова (кроме первого)

      if (distractors.length < 3 && correctVariants.length > 1) {
        const otherVariants = correctVariants.slice(1); // все, кроме первого

        distractors = [...distractors, ...otherVariants].slice(0, 3);
      }

      // Формируем опции: правильный ответ + дистракторы

      let options = [correct, ...distractors];

      // Перемешиваем

      options = options.sort(() => Math.random() - 0.5);

      if (autoPron && !isRUEN && speechSupported)
        setTimeout(() => speak(w.en), 300);

      if (exContent) {
        exContent.innerHTML = `

          <div class="mc-question">

            ${esc(question)}

            ${!isRUEN && speechSupported ? `<button class="btn-audio" id="mc-audio-btn"><span class="material-symbols-outlined">volume_up</span></button>` : ''}

          </div>

          <div class="mc-grid">

            ${options.map(o => `<button class="mc-btn" data-ans="${safeAttr(o)}">${esc(o)}</button>`).join('')}

          </div>

        `;
      }

      if (!isRUEN && speechSupported) {
        const mcAudioBtn = document.getElementById('mc-audio-btn');

        if (mcAudioBtn) {
          mcAudioBtn.addEventListener('click', e => {
            e.stopPropagation();

            speakBtn(w.en, e.currentTarget);
          });
        }
      }

      if (exContent) {
        exContent.querySelectorAll('.mc-btn').forEach(b =>
          b.addEventListener('click', () => {
            const ok = b.dataset.ans === correct;

            exContent.querySelectorAll('.mc-btn').forEach(x => {
              x.disabled = true;

              if (x.dataset.ans === correct) x.classList.add('correct');
            });

            if (!ok) b.classList.add('wrong');

            if (ok && speechSupported) speak(w.en);

            setTimeout(
              () => {
                recordAnswer(ok);

                sIdx++;

                nextExercise();
              },

              ok ? 1500 : 2000,
            );
          }),
        );
      }
    } else if (t === 'type') {
      if (exBtns) exBtns.innerHTML = ''; // Clear buttons from previous exercises

      if (exTypeLbl) {
        exTypeLbl.innerHTML =
          '<span class="material-symbols-outlined">keyboard</span> Напиши перевод';
      }

      if (exCounter) {
        exCounter.textContent = `${sIdx + 1} / ${session.words.length}`;
      }

      const dir = session.dir || 'both';

      const isRUEN = dir === 'ru-en' || (dir === 'both' && Math.random() > 0.5);

      const question = isRUEN
        ? parseAnswerVariants(w.ru).join(', ') || w.ru
        : w.en;

      const answer = isRUEN ? w.en : w.ru;

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

          <div class="ta-feedback" id="ta-fb"></div>

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

            // Получаем массив вариантов правильного ответа

            const answerVariants = parseAnswerVariants(answer);

            const isCorrect = answerVariants.some(
              variant => variant === userAnswer,
            );

            if (input) input.disabled = true;

            if (submit) submit.disabled = true;

            if (fb) {
              if (isCorrect) {
                fb.className = 'feedback-panel correct';

                fb.innerHTML = `

                  <span class="material-symbols-outlined">check_circle</span>

                  <span>${esc(answer)}</span>

                `;

                if (speechSupported) speak(answer);

                setTimeout(() => {
                  recordAnswer(true);

                  sIdx++;

                  nextExercise();
                }, 1500);
              } else {
                fb.className = 'feedback-panel incorrect';

                fb.innerHTML = `

                  <span class="material-symbols-outlined">cancel</span>

                  <span>${esc(answer)}</span>

                `;

                setTimeout(() => {
                  recordAnswer(false);

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
        exCounter.textContent = `${sIdx + 1} / ${session.words.length}`;
      }

      if (exContent) {
        exContent.innerHTML = `

          <div style="display: flex; flex-direction: column; align-items: center; gap: 1.5rem; margin-top: 4rem;">

            <button class="btn-icon btn-secondary" id="dict-replay"><span class="material-symbols-outlined">volume_up</span></button>

            <input type="text" id="dict-input" placeholder="Напиши слово по-английски..." autocomplete="off" autocorrect="off" spellcheck="false">

            <button class="btn-icon" id="dict-submit"><span class="material-symbols-outlined">check</span></button>

          </div>

          <div class="ta-feedback" id="dict-fb"></div>

        `;
      }

      setTimeout(() => speak(w.en), 200);

      const dictInput = document.getElementById('dict-input');

      const dictSubmit = document.getElementById('dict-submit');

      const dictFb = document.getElementById('dict-fb');

      const dictReplay = document.getElementById('dict-replay');

      if (dictReplay) {
        dictReplay.onclick = () => speak(w.en);
      }

      if (dictInput) {
        dictInput.focus();

        if (dictSubmit && dictFb) {
          const check = () => {
            const val = dictInput.value.trim().toLowerCase();

            const answerVariants = parseAnswerVariants(w.en);

            const ok = answerVariants.some(v => v === val);

            dictFb.className =
              'feedback-panel ' + (ok ? 'correct' : 'incorrect');

            dictFb.innerHTML = ok
              ? '<span class="material-symbols-outlined">check_circle</span><span>Верно!</span>'
              : `<span class="material-symbols-outlined">cancel</span><span>Правильно: ${esc(w.en)}</span>`;

            if (dictInput) dictInput.disabled = true;

            if (dictSubmit) dictSubmit.disabled = true;

            setTimeout(() => {
              recordAnswer(ok);

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
        exCounter.textContent = `${sIdx + 1} / ${session.words.length}`;
      }

      const word = w.en.toLowerCase().replace(/[^a-z]/g, ''); // только буквы

      const letters = word.split('');

      const shuffled = [...letters].sort(() => Math.random() - 0.5);

      if (exContent) {
        exContent.innerHTML = `



          <div class="builder-card">



            <div class="builder-question">${parseAnswerVariants(w.ru).join(', ') || esc(w.ru)}</div>



            <div class="builder-answer" id="builder-answer"></div>



            <div class="builder-letters" id="builder-letters"></div>



            <div class="builder-hint"></div>



          </div>



          <div class="builder-controls">



            <button class="btn-icon" id="builder-hint-btn"><span class="material-symbols-outlined">lightbulb</span></button>



          </div>



          <div class="builder-feedback" id="builder-fb" style="display: none;"></div>



        `;
      }

      // Создаем кнопки для букв

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
          // Проверяем, что кнопка еще не нажата (видима)

          if (letterBtn.style.visibility === 'hidden') {
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
            // Находим соответствующую кнопку буквы и делаем её видимой
            const allLetterBtns = document.querySelectorAll('.builder-letter');
            const originalBtn = Array.from(allLetterBtns).find(
              btn =>
                btn.dataset.letter === letter.toLowerCase() &&
                btn.style.visibility === 'hidden',
            );
            if (originalBtn) {
              originalBtn.style.visibility = 'visible';
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
              fb.className = 'builder-feedback'; // Убираем классы correct/incorrect
            }

            // Проверяем ответ
            checkBuilderAnswer();
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

      function checkBuilderAnswer() {
        const currentAnswer = answerContainer.textContent.toLowerCase();

        const fb = document.getElementById('builder-fb');

        if (currentAnswer === word) {
          fb.style.display = 'block';
          fb.className = 'feedback-panel correct';

          fb.innerHTML = `<span class="material-symbols-outlined">check_circle</span><span>Отлично! ${w.en} — ${parseAnswerVariants(w.ru).join(', ') || w.ru}</span>`;

          // Озвучиваем слово после правильного ответа
          speak(w.en);

          document.querySelectorAll('.builder-letter').forEach(btn => {
            btn.disabled = true;
          });

          setTimeout(() => {
            recordAnswer(true);

            sIdx++;

            nextExercise();
          }, 2000);
        } else if (currentAnswer.length >= word.length) {
          fb.style.display = 'block';
          fb.className = 'feedback-panel incorrect';

          fb.innerHTML = `<span class="material-symbols-outlined">refresh</span><span>Попробуйте ещё раз!</span>`;
        } else {
          // Скрываем фидбек при неполном ответе
          fb.style.display = 'none';
          fb.textContent = '';
          fb.className = 'builder-feedback'; // Убираем классы correct/incorrect
        }
      }
    } else if (t === 'speech') {
      if (exTypeLbl) {
        exTypeLbl.innerHTML =
          '<span class="material-symbols-outlined">record_voice_over</span> Произнеси';
      }
      if (exCounter) {
        exCounter.textContent = `${sIdx + 1} / ${session.words.length}`;
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
              ${w.phonetic ? `<div class="speech-phonetic">/${esc(w.phonetic)}/</div>` : ''}
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
            <div class="speech-feedback" id="speech-feedback" style="display: none;"></div>
          </div>
        `;
      }

      const replayBtn = document.getElementById('speech-replay-btn');

      const startBtn = document.getElementById('speech-start-btn');

      const indicator = document.getElementById('recording-indicator');

      const feedback = document.getElementById('speech-feedback');

      // Автоматическая озвучка
      setTimeout(() => {
        if (speechSupported) speak(expectedWord);
      }, 500);

      if (replayBtn) {
        replayBtn.addEventListener('click', () => {
          if (speechSupported) speak(expectedWord);
        });
      }

      if (!speechRecognitionSupported) {
        feedback.style.display = 'block';
        feedback.className = 'feedback-panel warning';
        feedback.innerHTML =
          '<span class="material-symbols-outlined">warning</span><span>Распознавание речи не поддерживается вашим браузером.</span>';
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
          feedback.style.display = 'none';
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
            feedback.style.display = 'block';
            feedback.className = 'feedback-panel correct';
            feedback.innerHTML = `<span class="material-symbols-outlined">check_circle</span><span>Верно! (Совпадение: ${result.confidence}%)</span>`;
            playSound('correct');
            recordAnswer(true);
            sIdx++;
            nextExercise();
          } else {
            feedback.style.display = 'block';
            feedback.className = 'feedback-panel incorrect';
            feedback.innerHTML = `<span class="material-symbols-outlined">cancel</span><span>Неверно. Вы сказали: "${spoken}" (Совпадение: ${result.confidence}%)</span>`;
            playSound('wrong');
            // Даём ещё одну попытку – не увеличиваем sIdx
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

          feedback.style.display = 'block';
          feedback.className = 'feedback-panel warning';
          feedback.innerHTML = `<span class="material-symbols-outlined">warning</span><span>${errorMessage}</span>`;
          currentRecognition = null;
        };

        rec.onend = () => {
          clearTimeout(timeoutId);
          if (recognitionActive) {
            // Не было результата, но и не ошибка – возможно, тишина
            indicator.style.display = 'none';
            startBtn.style.display = 'flex';
            feedback.className = 'feedback-panel warning';
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
          feedback.className = 'feedback-panel warning';
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
            recordAnswer(false);
            sIdx++;
            nextExercise();
          });
      }
    } else if (t === 'match') {
      // Временно используем runMatchExercise пока не реализуем полноценно
      try {
        runMatchExercise(session.words.slice(sIdx, sIdx + 6), elapsed => {
          // Увеличиваем sIdx на 1, так как упражнение обработало все слова

          sIdx++;

          nextExercise();
        });
      } catch (error) {
        console.error('Error in match exercise:', error);
        sIdx++;
        nextExercise();
      }
    } else if (t === 'context') {
      try {
        runContextExercise(w, () => {
          sIdx++;

          nextExercise();
        });
      } catch (error) {
        console.error('Error in context exercise:', error);
        sIdx++;
        nextExercise();
      }
    } else if (t === 'speech-sentence') {
      try {
        runSpeechSentenceExercise(w, () => {
          sIdx++;

          nextExercise();
        });
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

function recordAnswer(correct) {
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

  playSound(correct ? 'correct' : 'wrong');

  updStats(session.words[sIdx].id, correct);

  updStreak();

  // В режиме экзамена подсчитываем отвеченные вопросы

  if (practiceMode === 'exam') {
    session.questionsAnswered++;

    if (correct) {
      session.results.correct.push(session.words[sIdx]);
    } else {
      session.results.wrong.push(session.words[sIdx]);
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

  if (correct) sResults.correct.push(session.words[sIdx]);
  else sResults.wrong.push(session.words[sIdx]);

  // Обновляем прогресс ежедневных целей для правильных ответов

  // Увеличиваем счётчик упражнений за день (для всех ответов, не только правильных)

  // incrementDailyCount() уже вызывается в начале функции

  if (correct) {
    resetDailyGoalsIfNeeded(); // Ensure proper daily reset

    window.dailyProgress.review = (window.dailyProgress.review || 0) + 1;

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

  // Планируем быструю синхронизацию после практики (10 секунд)

  scheduleDelayedSync(10000);
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

        <div class="word-bank-en">${esc(word.en)}</div>

        <div class="word-bank-ru">${parseAnswerVariants(word.ru).join(', ') || esc(word.ru)}</div>

        ${word.phonetic ? `<div class="word-bank-phonetic">${esc(word.phonetic)}</div>` : ''}

        ${example ? `<div class="word-bank-example">${esc(example)}</div>` : ''}

        ${exampleTranslation ? `<div class="word-bank-example-translation">${esc(exampleTranslation)}</div>` : ''}

        ${word.tags?.length ? `<div class="word-bank-tags">${word.tags.map(tag => `<span class="tag">${esc(tag)}</span>`).join('')}</div>` : ''}

      </div>

      <div class="word-bank-actions">

        <div class="word-bank-nav">

          <button class="word-bank-nav-btn" id="bank-word-prev" title="Предыдущее"><span class="material-symbols-outlined">chevron_left</span></button>

          <button class="word-bank-nav-btn" id="bank-word-next" title="Следующее"><span class="material-symbols-outlined">chevron_right</span></button>

        </div>

        <button class="word-bank-add-btn" id="bank-word-add"><span class="material-symbols-outlined">add</span> Добавить</button>

      </div>

    </div>

  `;

  wrap.classList.remove('fade-out');

  wrap.classList.add('fade-in');

  setTimeout(() => wrap.classList.remove('fade-in'), 300);

  // Обработчики для кнопок

  document.getElementById('bank-word-next')?.addEventListener('click', () => {
    renderRandomBankWord();
  });

  document.getElementById('bank-word-prev')?.addEventListener('click', () => {
    renderRandomBankWord(); // Можно реализовать историю, но пока просто новое случайное
  });

  document

    .getElementById('bank-word-add')

    ?.addEventListener('click', async () => {
      if (!currentBankWord) return;

      const enLower = currentBankWord.en.toLowerCase();

      // Проверяем, нет ли уже такого слова в словаре

      if (window.words.some(w => w.en.toLowerCase() === enLower)) {
        toast('Это слово уже есть в вашем словаре', 'warning');

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
      );

      window.words.unshift(newWord);

      // Сразу сохраняем в localStorage

      localStorage.setItem('englift_words', JSON.stringify(window.words));

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

      toast(`«${currentBankWord.en}» добавлено! +5 XP`, 'success');

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

// Убрали двойной вызов load() - он перетирает данные из Supabase

(async () => {
  // updStreak();

  // updateDueBadge();

  renderRandomBankWord(); // Это вызов в синхронном контексте, оставляем без await
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

function runMatchExercise(initialWords, onComplete) {
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

      updStats(id, true);

      updStats(selectedWord.id, true);

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

      updStats(selectedWord.id, false);

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

// === NEW EXERCISES ===

function runContextExercise(word, onComplete) {
  const content = document.getElementById('ex-content');
  const btns = document.getElementById('ex-btns');
  const exTypeLbl = document.getElementById('ex-type-lbl');
  const exCounter = document.getElementById('ex-counter');

  if (exTypeLbl) {
    exTypeLbl.innerHTML =
      '<span class="material-symbols-outlined">psychology</span> Контекстная догадка';
  }
  if (exCounter) {
    exCounter.textContent = `${sIdx + 1} / ${session.words.length}`;
  }

  // Варианты ответов
  const options = [word];
  const otherWords = session.words.filter(
    w => w.id !== word.id && w.en !== word.en,
  );
  for (let i = 0; i < 3 && i < otherWords.length; i++) {
    const randomIndex = Math.floor(Math.random() * otherWords.length);
    options.push(otherWords[randomIndex]);
    otherWords.splice(randomIndex, 1);
  }
  const shuffledOptions = options.sort(() => Math.random() - 0.5);

  const example = word.ex || `I want to _____ my goals.`;
  const exampleWithBlank = example.replace(word.en, '_____');
  const exampleTranslation = word.examples?.[0]?.translation || '';

  content.innerHTML = `
    <div class="context-exercise">
      <div class="context-sentence">
        <div class="context-text" onclick="this.nextElementSibling.style.display='block'; this.style.background='transparent'; this.onmouseover=null; this.onmouseout=null;" style="cursor: pointer; padding: 0.5rem; border-radius: 8px; transition: background 0.2s;" title="Нажмите для перевода" onmouseover="this.style.background='var(--border)'" onmouseout="this.style.background='transparent'">
          ${exampleWithBlank}
        </div>
        <div class="context-translation" id="context-translation" style="display: none; margin-top: 0.5rem; color: var(--muted); padding: 0.5rem; background: var(--card); border-radius: 8px;">
          ${esc(exampleTranslation)}
        </div>
      </div>
      <div class="context-options" id="context-options"></div>
      <div class="speech-feedback" id="context-feedback" style="display: none;"></div>
    </div>
  `;

  const optionsContainer = document.getElementById('context-options');
  const feedback = document.getElementById('context-feedback');

  shuffledOptions.forEach(option => {
    const btn = document.createElement('button');
    btn.className = 'context-option-btn';
    btn.textContent = option.en;
    btn.dataset.wordId = option.id;

    btn.addEventListener('click', () => {
      const isCorrect = option.id === word.id;

      // Блокируем все кнопки
      document
        .querySelectorAll('.context-option-btn')
        .forEach(b => (b.disabled = true));

      // Показываем фидбек
      feedback.style.display = 'block';
      feedback.className = `feedback-panel ${isCorrect ? 'correct' : 'incorrect'}`;
      feedback.innerHTML = `
        <span class="material-symbols-outlined">${isCorrect ? 'check_circle' : 'cancel'}</span>
        <div>
          <strong>${isCorrect ? 'Верно!' : 'Неверно.'}</strong><br>
          ${word.en} — ${parseAnswerVariants(word.ru).join(', ') || word.ru}
          ${word.phonetic ? `<br><small>/${word.phonetic}/</small>` : ''}
        </div>
      `;

      playSound(isCorrect ? 'correct' : 'wrong');
      recordAnswer(isCorrect);

      // Если правильно, показываем полный пример
      if (isCorrect) {
        const contextText = document.querySelector('.context-text');
        if (contextText) contextText.textContent = example;
      }

      // Убираем автоматический переход
      // Вместо этого показываем кнопку "Далее"
      if (btns) {
        btns.innerHTML = `<button class="btn-icon" id="context-next"><span class="material-symbols-outlined">arrow_forward</span></button>`;
        document
          .getElementById('context-next')
          .addEventListener('click', () => {
            onComplete();
          });
      } else {
        // Если нет контейнера для кнопок, создадим простую кнопку под фидбеком
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

  // Кнопка пропуска (только до ответа)
  if (btns) {
    btns.innerHTML = `<button class="btn-icon" id="context-skip"><span class="material-symbols-outlined">skip_next</span></button>`;
    document.getElementById('context-skip')?.addEventListener('click', () => {
      recordAnswer(false);
      onComplete();
    });
  }
}

function runSpeechSentenceExercise(word, onComplete) {
  const content = document.getElementById('ex-content');

  const btns = document.getElementById('ex-btns');

  const exTypeLbl = document.getElementById('ex-type-lbl');

  const exCounter = document.getElementById('ex-counter');

  if (exTypeLbl) {
    exTypeLbl.innerHTML =
      '<span class="material-symbols-outlined">record_voice_over</span> Слушай и говори';
  }

  if (exCounter) {
    exCounter.textContent = `${sIdx + 1} / ${session.words.length}`;
  }

  // Показываем предложение, если есть пример, иначе слово

  const hasExample = word.ex && word.ex.trim().length > 0;

  const promptText = hasExample ? word.ex : word.en;

  const expectedWord = promptText; // для проверки используем полный текст предложения

  const exampleTranslation =
    hasExample && word.examples && word.examples[0]
      ? word.examples[0].translation
      : null;

  if (content) {
    content.innerHTML = `



      <div class="speech-exercise">



        <div class="speech-prompt">



          <div class="speech-word-container">



            <div class="speech-word speech-sentence">${esc(promptText)}</div>



            <button class="btn-icon btn-small" id="speech-sentence-replay-btn" title="Прослушать предложение">



              <span class="material-symbols-outlined">volume_up</span>



            </button>



          </div>



          ${!hasExample ? `<div class="speech-phonetic">${parseAnswerVariants(word.ru).join(', ') || esc(word.ru)}</div>` : ''}



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



        <div class="speech-feedback" id="speech-sentence-feedback" style="display: none;"></div>



      </div>



    `;
  }

  const replayBtn = document.getElementById('speech-sentence-replay-btn');

  const startBtn = document.getElementById('speech-sentence-start-btn');

  const indicator = document.getElementById(
    'speech-sentence-recording-indicator',
  );

  const feedback = document.getElementById('speech-sentence-feedback');

  const translationEl = document.getElementById('speech-sentence-translation');

  // Автоматическая озвучка при запуске упражнения

  setTimeout(() => {
    if (speechSupported) {
      console.log('Автоматическая озвучка предложения:', promptText);

      speak(promptText);
    }
  }, 500);

  // Обработчик кнопки повторного прослушивания

  if (replayBtn) {
    replayBtn.addEventListener('click', () => {
      if (speechSupported) {
        console.log('Повторная озвучка предложения:', promptText);

        speak(promptText);
      }
    });
  }

  if (!speechRecognitionSupported) {
    feedback.textContent =
      'Распознавание речи не поддерживается вашим браузером.';

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
      indicator.style.display = 'flex';
      startBtn.style.display = 'none';
      feedback.style.display = 'none';
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
        feedback.style.display = 'block';
        feedback.className = 'feedback-panel correct';
        feedback.innerHTML = `<span class="material-symbols-outlined">check_circle</span><span>Верно! (Совпадение: ${result.confidence}%)</span>`;
        playSound('correct');
        recordAnswer(true);
        sIdx++;
        nextExercise();
      } else {
        feedback.style.display = 'block';
        feedback.className = 'feedback-panel incorrect';
        feedback.innerHTML = `<span class="material-symbols-outlined">cancel</span><span>Неверно. Вы сказали: "${spoken}" (Совпадение: ${result.confidence}%)</span>`;
        playSound('wrong');
        // ещё одна попытка
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

      feedback.style.display = 'block';
      feedback.className = 'feedback-panel warning';
      feedback.innerHTML = `<span class="material-symbols-outlined">warning</span><span>${errorMessage}</span>`;
      currentRecognition = null;
    };

    rec.onend = () => {
      clearTimeout(timeoutId);
      if (recognitionActive) {
        indicator.style.display = 'none';
        startBtn.style.display = 'flex';
        feedback.style.display = 'block';
        feedback.className = 'feedback-panel warning';
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
        recordAnswer(false);
        onComplete();
      });
  }
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

    // Останавливаем синтез речи если активен

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
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

// Очистка данных пользователя (при выходе или перед загрузкой нового пользователя)

window.clearUserData = function (isExplicitLogout = false) {
  // Очищаем интервал проверки бейджей

  if (badgeCheckInterval) {
    clearInterval(badgeCheckInterval);

    badgeCheckInterval = null;
  }

  // Сбрасываем все пользовательские данные КРОМЕ ТЕМЫ

  window.words = [];

  xpData = { xp: 0, level: 1, badges: [] };

  streak = { count: 0, lastDate: null };

  window.dailyProgress = {
    add_new: 0,

    review: 0,

    practice_time: 0,

    completed: false,

    lastReset: new Date().toISOString().split('T')[0], // "2026-03-05"
  };

  window.dailyReviewCount = 0;

  window.lastReviewResetDate = new Date().toISOString().split('T')[0];

  // НЕ очищаем user_settings чтобы сохранить тему

  window.user_settings = {};

  // НЕ обнуляем speech_cfg чтобы сохранить настройки голосов

  // window.speech_cfg = {};

  // Очищаем localStorage только при явном выходе
  if (isExplicitLogout) {
    localStorage.removeItem('englift_words');
    localStorage.removeItem('englift_profile_backup');
  }

  // Очищаем очереди синхронизации слов
  window.pendingWordUpdates?.clear();
  window.dirtyWords?.clear();

  // Сбрасываем таймеры синхронизации
  if (window.wordSyncTimer) {
    clearTimeout(window.wordSyncTimer);
    window.wordSyncTimer = null;
  }
  if (window.syncTimer) {
    clearTimeout(window.syncTimer);
    window.syncTimer = null;
  }

  renderXP();

  renderBadges();

  updateDueBadge();

  // НЕ сбрасываем тему - оставляем текущую

  switchTab('words');
};

// Глобальные функции для доступа из других модулей

window.showApiLoading = function (show) {
  const loadingEl = document.getElementById('api-loading');

  if (loadingEl) {
    loadingEl.style.display = show ? 'flex' : 'none';
  }
};

// Hide loading on page load

window.showApiLoading(false);

// ============================================================

// GLOBAL FUNCTIONS FOR AUTH.JS

// ============================================================

window.loadData = load; // перезагрузка всех данных из localStorage

window.renderXP = renderXP; // обновление XP

window.renderBadges = renderBadges;

window.renderStats = renderStats;

window.renderWords = renderWords;

window.updateDueBadge = updateDueBadge;

// Заглушка для loadUserSettings (используется в auth.js)

window.loadUserSettings = function (data) {
  // Пока ничего не делаем - функция-заглушка для совместимости
};

// ============================================================

// DIRTY WORDS TRACKING & DELAYED SYNC

// ============================================================

let dirtyWords = new Set(); // id изменённых слов

let syncTimer = null;

function markDirty(id) {
  dirtyWords.add(id);
}

function scheduleDelayedSync(delay = 300000) {
  // 5 минут по умолчанию

  if (syncTimer) clearTimeout(syncTimer);

  syncTimer = setTimeout(() => {
    performSync();
  }, delay);
}

async function performSync() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!navigator.onLine || !user || dirtyWords.size === 0) return;

  const wordsToSync = window.words.filter(w => dirtyWords.has(w.id));

  try {
    await batchSaveWords(wordsToSync);

    dirtyWords.clear();

    updateSyncIndicator('synced');
  } catch (e) {
    console.error('Ошибка синхронизации:', e);

    // повторим позже

    scheduleDelayedSync(60000);
  }
}

// ============================================================

// INITIALIZATION

// ============================================================

// СРАЗУ применяем тему из localStorage

if (localStorage.getItem('engliftDark') === 'true') {
  document.documentElement.classList.add('dark');
}

// Унифицированный обработчик visibilitychange

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    // Сохраняем слова в localStorage

    save(true);

    // Немедленно сохраняем слова

    if (dirtyWords.size > 0) {
      performSync();
    }

    // Немедленно сохраняем статистику

    if (window.currentUserId) {
      window.saveProfileData?.();

      console.log('💾 Немедленно сохраняем профиль при скрытии страницы');
    }

    // Дополнительно сохраняем в localStorage как страховку

    const profileData = JSON.stringify({
      daily_progress: window.dailyProgress,

      xp: window.xpData?.xp || 0,

      level: window.xpData?.level || 1,

      streak: window.streak?.count || 0,

      last_streak_date: window.streak?.lastDate,
    });

    localStorage.setItem('englift_lastknown_progress', profileData);
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
  console.log('🚀 onProfileFullyLoaded — убираем loading и применяем тему');

  console.log('🔍 user_settings:', window.user_settings);

  console.log('🔍 currentUserId:', window.currentUserId);

  // Сначала убираем loading класс - разрешаем показ контента

  document.body.classList.remove('loading');

  // Добавляем authenticated чтобы скрыть auth-gate

  document.body.classList.add('authenticated');

  // Применяем тему из профиля или fallback (только один раз!)

  let themeToApply = 'lavender'; // по умолчанию

  if (window.user_settings?.theme) {
    themeToApply = window.user_settings.theme;

    console.log('🎨 Применяем тему из user_settings.theme:', themeToApply);
  } else if (window.user_settings?.dark_theme !== undefined) {
    // Обратная совместимость со старым полем dark_theme

    themeToApply = window.user_settings.dark_theme ? 'dark' : 'lavender';

    console.log('🎨 Конвертируем старое поле dark_theme:', themeToApply);
  } else {
    console.log('🎨 Используем тему по умолчанию');
  }

  applyTheme(themeToApply);

  // Синхронизируем измененные слова с сервера

  console.log('🚀 Начинаем инициализацию приложения...');

  try {
    await syncWordsFromServer();

    console.log('🔄 Синхронизация слов завершена');
  } catch (e) {
    console.error('❌ Ошибка синхронизации слов:', e);
  }

  // Скрываем индикатор загрузки только после завершения синхронизации

  const loadingIndicator = document.getElementById('loading-indicator');

  if (loadingIndicator) {
    console.log('🎯 Скрываем индикатор загрузки');

    loadingIndicator.style.opacity = '0';

    setTimeout(() => {
      loadingIndicator.style.display = 'none';

      console.log('✅ Индикатор загрузки скрыт');
    }, 300);
  } else {
    console.warn('⚠️ Индикатор загрузки не найден');
  }

  // Загружаем слова перед рендерингом, только если пользователь авторизован

  if (window.authExports?.loadWordsOnce && window.currentUserId) {
    try {
      // Дополнительная проверка активной сессии

      const {
        data: { user },
      } = await window.authExports.auth.getUser();

      if (!user) {
        console.log('⚠️ Сессия недействительна, пропускаем загрузку слов');

        return;
      }

      await new Promise(resolve => {
        window.authExports.loadWordsOnce(remoteWords => {
          window.words = remoteWords || [];

          localStorage.setItem('englift_words', JSON.stringify(window.words));

          resolve();
        });
      });

      console.log('🔄 Слова загружены в onProfileFullyLoaded');
    } catch (e) {
      console.error('❌ Ошибка загрузки слов в onProfileFullyLoaded:', e);
    }
  } else if (!window.currentUserId) {
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

// Если через 2 секунды Supabase не загрузил тему, оставляем localStorage fallback

setTimeout(() => {
  if (document.body.classList.contains('loading')) {
    // Если все еще в загрузке, применяем тему из localStorage

    const userSettings = JSON.parse(
      localStorage.getItem('englift_user_settings') || '{}',
    );

    const theme = userSettings.theme || 'lavender';

    console.log('🔄 Fallback: применяем тему из localStorage:', theme);

    window.applyTheme(theme);
  }
}, 2000);

// Таймаут для скрытия индикатора загрузки (на случай проблем)

setTimeout(() => {
  const loadingIndicator = document.getElementById('loading-indicator');

  if (loadingIndicator && loadingIndicator.style.display !== 'none') {
    console.warn('⚠️ Индикатор загрузки все еще виден, скрываем принудительно');

    loadingIndicator.style.opacity = '0';

    setTimeout(() => {
      loadingIndicator.style.display = 'none';

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

// ====================== PWA INSTALL BUTTON (улучшенная версия) ======================
let deferredPrompt = null;
const installBtn = document.getElementById('install-btn');

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
        <p><strong>📱 Установка на iPhone/iPad</strong></p>
        <ol style="padding-left: 1.5rem;">
          <li>Нажмите кнопку <strong>«Поделиться»</strong> <span style="font-size:1.2rem;">📤</span> внизу экрана.</li>
          <li>Прокрутите вниз и выберите <strong>«На экран «Домой»»</strong>.</li>
          <li>Нажмите <strong>«Добавить»</strong> в правом верхнем углу.</li>
        </ol>
        <p style="color: var(--muted); margin-top: 1rem;">Готово! EngLift появится на главном экране как отдельное приложение.</p>
      </div>
    `;
  } else if (platform === 'android') {
    instructions = `
      <div style="text-align: left; line-height: 1.6;">
        <p><strong>🤖 Установка на Android</strong></p>
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
        <h3>📲 Установка приложения</h3>
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

// Обработка события установки
window.addEventListener('appinstalled', () => {
  console.log('PWA установлено!');
  if (installBtn) {
    installBtn.innerHTML =
      '<span class="material-symbols-outlined">check_circle</span>';
    installBtn.title = 'Приложение установлено';
    installBtn.style.opacity = '0.7';
    installBtn.style.cursor = 'default';
    installBtn.style.pointerEvents = 'none';
    installBtn.classList.add('installed');
  }
  deferredPrompt = null;
  toast('Приложение добавлено на главный экран!', 'success', 'celebration');
});

// Обработка beforeinstallprompt
window.addEventListener('beforeinstallprompt', e => {
  console.log('✅ beforeinstallprompt сработал — показываем кнопку PWA');
  e.preventDefault();
  deferredPrompt = e;
  if (installBtn) {
    installBtn.style.display = 'flex';
    installBtn.classList.add('visible');
    installBtn.classList.remove('installed'); // на случай, если была установка ранее
    installBtn.dataset.mode = 'prompt'; // отмечаем, что есть промпт
  }
});

// При загрузке страницы
(function initPWAButton() {
  // Если приложение уже запущено как standalone (установлено), скрываем кнопку навсегда
  if (window.matchMedia('(display-mode: standalone)').matches) {
    console.log(
      'Приложение запущено в режиме standalone - скрываем кнопку установки',
    );
    if (installBtn) {
      installBtn.style.display = 'none';
    }
    return;
  }

  // Если кнопка не появилась через beforeinstallprompt, через 1 секунду показываем её в режиме "ручной установки"
  setTimeout(() => {
    // Если кнопка ещё не видима и не скрыта принудительно, показываем с возможностью ручной установки
    if (
      installBtn &&
      installBtn.style.display !== 'flex' &&
      !installBtn.classList.contains('installed')
    ) {
      console.log(
        'beforeinstallprompt не сработал - показываем кнопку для ручной установки',
      );
      installBtn.style.display = 'flex';
      installBtn.classList.add('visible');
      installBtn.dataset.mode = 'manual'; // отмечаем, что нужно показывать инструкцию
    }
  }, 1000);

  // Обработчик клика на кнопку
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (installBtn.classList.contains('installed')) {
        // Уже установлено – ничего не делаем
        return;
      }

      // Если есть сохранённое событие промпта
      if (deferredPrompt) {
        console.log('Показываем нативный промпт установки');
        installBtn.style.display = 'none'; // скрываем на время
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log('PWA install outcome:', outcome);
        if (outcome === 'accepted') {
          toast('Приложение устанавливается...', 'success', 'downloading');
        } else {
          toast('Установка отменена', 'info');
          // Можно снова показать кнопку, если пользователь передумал
          setTimeout(() => {
            if (!window.matchMedia('(display-mode: standalone)').matches) {
              installBtn.style.display = 'flex';
            }
          }, 500);
        }
        deferredPrompt = null;
      } else {
        // Промпта нет – показываем инструкцию по ручной установке
        console.log(
          'Промпт отсутствует - показываем инструкцию по ручной установке',
        );
        showManualInstallInstructions();
      }
    });
  }
})();

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

switchTab('words');
