// js/utils.js - Утилиты EngLift

// =============================================
// Базовые утилиты
// =============================================

// Функция нормализации русского текста (е/ё)
function normalizeRussian(text) {
  return text.replace(/ё/g, 'е').replace(/Ё/g, 'Е').toLowerCase().trim();
}

// Функция проверки ответа с учетом е/ё
function checkAnswerWithNormalization(userAnswer, correctAnswer) {
  const normalizedUser = normalizeRussian(userAnswer);
  const normalizedCorrect = normalizeRussian(correctAnswer);
  return normalizedUser === normalizedCorrect;
}

// Debounce функция для оптимизации
function debounce(fn, delay) {
  let timer;

  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// Разбирает строку с несколькими вариантами перевода (разделители / , ;)
function parseAnswerVariants(str) {
  if (!str) return [];

  return str
    .split(/[\/,;]/)
    .map(v => v.trim())
    .filter(v => v.length > 0);
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

// Улучшенная функция экранирования HTML (полная защита от XSS)
function esc(str) {
  if (!str) return '';

  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
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
    .replace(/'/g, '&#039;');
}

/**
 * Склоняет существительные по числам
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

// Fallback для генерации UUID в старых браузерах
function generateId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback для старых браузеров
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// =============================================
// Тосты и загрузка
// =============================================

function showLoading(message = 'Загрузка...') {
  const overlay = document.createElement('div');

  overlay.className = 'loading-overlay';
  overlay.id = 'loading-overlay';
  overlay.innerHTML = `
    <div class="loading-spinner"></div>
    <div class="loading-text">${message}</div>
  `;

  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    flex-direction: column;
    gap: 1rem;
  `;

  document.body.appendChild(overlay);
}

function hideLoading() {
  const overlay = document.getElementById('loading-overlay');

  if (overlay) overlay.remove();
}

window.hideLoading = hideLoading;

// Экспорт toast для использования в других модулях
window.toast = toast;

function setButtonLoading(button, loading = true) {
  if (loading) {
    button.classList.add('loading');
    button.disabled = true;
    button.dataset.originalText = button.textContent;
    button.innerHTML = '<span class="loading-spinner"></span> Загрузка...';
  } else {
    button.classList.remove('loading');
    button.disabled = false;
    button.textContent = button.dataset.originalText || button.textContent;
    delete button.dataset.originalText;
  }
}

function toast(msg, type = '', icon = '', duration = 4000) {
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
    console.warn('toast-box не найден');
    return;
  }
  toastBox.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity .3s';
    setTimeout(() => el.remove(), 320);
  }, duration);
}

// =============================================
// Аудио и звук
// =============================================

let audioContext;

function playAudio(filename, onEnd) {
  if (!filename) {
    if (onEnd) onEnd();
    return console.warn('Нет файла аудио');
  }
  const voice = window.user_settings?.voice || 'female';
  const folder = voice === 'male' ? 'audio-male/' : 'audio/';
  const audio = new Audio(`${folder}${filename}`);

  audio.addEventListener('ended', () => {
    if (onEnd) onEnd();
  });

  audio.addEventListener('error', e => {
    console.error('Ошибка загрузки аудио:', e);
    if (onEnd) onEnd();
  });

  audio.play().catch(err => {
    console.error('Ошибка воспроизведения аудио:', err);
    if (onEnd) onEnd();
  });
}

function playIdiomAudio(filename, onEnd) {
  console.log('🎵 playIdiomAudio called with:', filename);
  if (!filename) {
    if (onEnd) onEnd();
    return console.warn('Нет файла аудио для идиомы');
  }
  const voice = window.user_settings?.voice || 'female';
  const folder = voice === 'male' ? 'audio-idioms/' : 'female-idioms/';
  const audio = new Audio(`${folder}${filename}`);

  audio.addEventListener('ended', () => {
    if (onEnd) onEnd();
  });

  audio.addEventListener('error', e => {
    console.error('Ошибка загрузки аудио идиомы:', e);
    if (onEnd) onEnd();
  });

  audio.play().catch(err => {
    console.error('Ошибка воспроизведения аудио идиомы:', err);
    if (onEnd) onEnd();
  });
}

// === ЗВУКИ ===

function playSound(type) {
  try {
    const ctx = getAudioContext();

    // Возобновляем аудиоконтекст если он приостановлен
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    let audioPath;
    if (type === 'correct') {
      audioPath = 'sound/sucsess.mp3';
    } else if (type === 'wrong') {
      audioPath = 'sound/wrong.mp3';
    } else {
      // Произвольный путь к файлу
      audioPath = type;
    }

    console.log('🔊 Playing sound:', audioPath);
    const audio = new Audio(audioPath);
    // Устанавливаем громкость в зависимости от файла
    audio.volume = audioPath.includes('winner.mp3')
      ? 0.4
      : audioPath.includes('victory.mp3')
        ? 0.3
        : audioPath.includes('lite.mp3') || audioPath.includes('fail.mp3')
          ? 0.3
          : 0.1;
    audio.play().catch(e => console.error('Error playing sound:', e));
  } catch (e) {
    console.error('Error playing sound:', e);
  }
}

// Оптимизированный AudioContext для звуков
function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

// Функция для получения голоса в зависимости от настроек
function getVoice() {
  if (!('speechSynthesis' in window)) {
    console.warn('speechSynthesis не поддерживается');
    return null;
  }

  const voicePreference = window.user_settings?.voice || 'female';

  // Получаем доступные голоса
  const voices = speechSynthesis.getVoices();

  // Ищем подходящий голос
  let selectedVoice = voices.find(voice => {
    const voiceName = voice.name.toLowerCase();
    const voiceLang = voice.lang.toLowerCase();

    if (voicePreference === 'female') {
      return (
        voiceName.includes('female') ||
        voiceName.includes('woman') ||
        (voiceLang.includes('ru') &&
          (voiceName.includes('irina') || voiceName.includes('tatyana')))
      );
    } else {
      return (
        voiceName.includes('male') ||
        voiceName.includes('man') ||
        (voiceLang.includes('ru') &&
          (voiceName.includes('yuri') || voiceName.includes('dmitry')))
      );
    }
  });

  // Если не нашли подходящий, используем первый русский голос
  if (!selectedVoice) {
    selectedVoice = voices.find(voice => voice.lang.includes('ru'));
  }

  // Если и русского нет, используем первый доступный
  if (!selectedVoice) {
    selectedVoice = voices[0];
  }

  return selectedVoice;
}

// Функция для озвучки текста с учетом настроек голоса
function speakText(text) {
  console.log('🗣️ speakText called with:', text);
  if (!('speechSynthesis' in window)) {
    console.warn('speechSynthesis не поддерживается');
    return;
  }

  // Отменяем предыдущую озвучку
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);

  // Устанавливаем голос из настроек
  const voice = getVoice();
  if (voice) {
    utterance.voice = voice;
  }

  // Настройки речи
  utterance.lang = 'ru-RU';
  utterance.rate = 0.9;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  window.speechSynthesis.speak(utterance);
}

// =============================================
// Конфетти и эффекты
// =============================================

// Конфетти при перфекте
function triggerConfetti() {
  if (typeof confetti === 'function') {
    // Первый выстрел - звёзды
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#6C63FF'],
    });

    // Второй выстрел - больше звёзд
    setTimeout(() => {
      confetti({
        particleCount: 80,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#FFD700', '#FF6B6B', '#4ECDC4'],
      });
    }, 250);

    // Третий выстрел - ещё больше звёзд
    setTimeout(() => {
      confetti({
        particleCount: 80,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#45B7D1', '#6C63FF', '#FFD700'],
      });
    }, 400);
  }

  // Звук победы
  playSound('sound/winner.mp3');
}

// Грустный дождь при 0-20%
function triggerSadRain() {
  if (typeof confetti === 'function') {
    for (let i = 0; i < 15; i++) {
      setTimeout(() => {
        confetti({
          particleCount: 1,
          startVelocity: 10,
          gravity: 2,
          colors: ['#94a3b8'],
          origin: { x: Math.random(), y: 0 },
          shapes: ['circle'],
        });
      }, i * 80);
    }
  }

  // Звук неудачи
  playSound('sound/fail.mp3');
}

// Несколько капель при 21-40%
function triggerFewDrops() {
  if (typeof confetti === 'function') {
    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        confetti({
          particleCount: 1,
          startVelocity: 5,
          gravity: 1.5,
          colors: ['#94a3b8'],
          origin: { x: Math.random(), y: 0 },
          shapes: ['circle'],
        });
      }, i * 100);
    }
  }

  // Звук неудачи
  playSound('sound/lite.mp3');
}

// Лёгкий дождик при 41-60%
function triggerLightRain() {
  if (typeof confetti === 'function') {
    for (let i = 0; i < 12; i++) {
      setTimeout(() => {
        confetti({
          particleCount: 1,
          startVelocity: 3,
          gravity: 1,
          colors: ['#94a3b8'],
          origin: { x: Math.random(), y: 0 },
          shapes: ['circle'],
        });
      }, i * 120);
    }
  }

  // Звук неудачи
  playSound('sound/lite.mp3');
}

// Маленький салют при 61-80%
function triggerSmallConfetti() {
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 60,
      spread: 60,
      origin: { y: 0.6 },
      colors: ['#6C63FF', '#22C55E', '#F59E0B'],
    });
  }

  // Звук победы
  playSound('sound/victory.mp3');
}

// Хороший салют при 81-94%
function triggerGoodConfetti() {
  if (typeof confetti === 'function') {
    // Первый выстрел
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1'],
    });

    // Второй выстрел через 200ms
    setTimeout(() => {
      confetti({
        particleCount: 80,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#FFD700', '#FF6B6B'],
      });
    }, 200);

    // Третий выстрел через 400ms
    setTimeout(() => {
      confetti({
        particleCount: 80,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#4ECDC4', '#45B7D1'],
      });
    }, 400);
  }

  // Звук победы
  playSound('sound/victory.mp3');
}

// Confetti animation for completed daily goals
function spawnConfetti() {
  const colors = ['#2563eb', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];

  const confettiCount = 50;
  const angleIncrement = (Math.PI * 2) / confettiCount;

  for (let i = 0; i < confettiCount; i++) {
    const angle = angleIncrement * i;
    const velocity = 15 + Math.random() * 10;

    confetti({
      particleCount: 1,
      angle: (angle * 180) / Math.PI,
      startVelocity: velocity,
      gravity: 1,
      colors: [colors[Math.floor(Math.random() * colors.length)]],
      origin: { x: 0.5, y: 0.5 },
      shapes: ['circle'],
    });
  }
}

// 0% - Грустный дождь (полный провал)
function spawnSadRain() {
  document.querySelectorAll('.sad-drop').forEach(p => p.remove());

  for (let i = 0; i < 30; i++) {
    setTimeout(() => {
      const drop = document.createElement('div');
      drop.className = 'sad-drop';
      drop.style.cssText = `
        position: fixed;
        top: -10px;
        left: ${Math.random() * 100}%;
        width: 4px;
        height: 15px;
        background: #94a3b8;
        border-radius: 50% 50% 50% 50% / 40% 40%;
        z-index: 9999;
        opacity: 0.7;
        animation: fall 2s linear;
      `;
      document.body.appendChild(drop);

      setTimeout(() => drop.remove(), 2000);
    }, i * 100);
  }
}

// 1-20% - Несколько капель (почти провал)
function spawnFewDrops() {
  document.querySelectorAll('.sad-drop').forEach(p => p.remove());

  for (let i = 0; i < 10; i++) {
    setTimeout(() => {
      const drop = document.createElement('div');
      drop.className = 'sad-drop';
      drop.style.cssText = `
        position: fixed;
        top: -10px;
        left: ${Math.random() * 100}%;
        width: 4px;
        height: 15px;
        background: #94a3b8;
        border-radius: 50% 50% 50% 50% / 40% 40%;
        z-index: 9999;
        opacity: 0.7;
        animation: fall 2s linear;
      `;
      document.body.appendChild(drop);

      setTimeout(() => drop.remove(), 2000);
    }, i * 150);
  }
}

// 21-50% - Легкий дождик (посредственно)
function spawnLightRain() {
  document.querySelectorAll('.sad-drop').forEach(p => p.remove());

  for (let i = 0; i < 20; i++) {
    setTimeout(() => {
      const drop = document.createElement('div');
      drop.className = 'sad-drop';
      drop.style.cssText = `
        position: fixed;
        top: -10px;
        left: ${Math.random() * 100}%;
        width: 4px;
        height: 15px;
        background: #94a3b8;
        border-radius: 50% 50% 50% 50% / 40% 40%;
        z-index: 9999;
        opacity: 0.7;
        animation: fall 2s linear;
      `;
      document.body.appendChild(drop);

      setTimeout(() => drop.remove(), 2000);
    }, i * 100);
  }
}

// 51-80% - Маленький салют (неплохо)
function spawnSmallConfetti() {
  document.querySelectorAll('.confetti-piece').forEach(p => p.remove());

  const colors = ['#6C63FF', '#22C55E', '#F59E0B'];

  for (let i = 0; i < 30; i++) {
    setTimeout(() => {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        width: 8px;
        height: 8px;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        transform: translate(-50%, -50%);
        animation: explode 1s ease-out forwards;
      `;
      document.body.appendChild(piece);

      setTimeout(() => piece.remove(), 1000);
    }, i * 50);
  }
}

// 81-99% - Хороший салют (отлично)
function spawnGoodConfetti() {
  document.querySelectorAll('.confetti-piece').forEach(p => p.remove());

  const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1'];

  for (let i = 0; i < 50; i++) {
    setTimeout(() => {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        width: 10px;
        height: 10px;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        transform: translate(-50%, -50%);
        animation: explode 1.2s ease-out forwards;
      `;
      document.body.appendChild(piece);

      setTimeout(() => piece.remove(), 1200);
    }, i * 30);
  }
}

// 100% - Эпичный салют + фейерверк (идеально)
function spawnEpicConfetti() {
  document.querySelectorAll('.confetti-piece').forEach(p => p.remove());
  document.querySelectorAll('.firework').forEach(p => p.remove());

  // Множественные взрывы
  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      const x = 20 + Math.random() * 60; // 20% - 80% по ширине

      confetti({
        particleCount: 100,
        spread: 120,
        origin: { x: x / 100, y: 0.5 },
        colors: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#6C63FF'],
        scalar: 1.2,
      });
    }, i * 300);
  }

  // Дополнительные частицы
  setTimeout(() => {
    confetti({
      particleCount: 200,
      spread: 90,
      origin: { x: 0.5, y: 0.3 },
      colors: ['#FFD700', '#FF6B6B'],
      scalar: 0.8,
    });
  }, 1000);
}

// =============================================
// Экспорт всех функций
// =============================================

export {
  // Базовые утилиты
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

  // Тосты и загрузка
  toast,
  showLoading,
  hideLoading,
  setButtonLoading,

  // Аудио и звук
  getAudioContext,
  playSound,
  playAudio,
  playIdiomAudio,
  speakText,
  getVoice,

  // Конфетти и эффекты
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
};
