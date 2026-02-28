import { saveWordToDb, deleteWordFromDb } from './db.js';
import './auth.js';

// ============================================================
// DATA
// ============================================================
const SK = 'vocabmaster_v1';
const XP_K = 'vocabmaster_xp';
const STREAK_K = 'vocabmaster_streak';
const SPEECH_K = 'vocabmaster_speech';
let words = [];
let streak = { count: 0, lastDate: null };
let speechCfg = { voiceURI: '', rate: 0.9, pitch: 1.0 };
let xpData = { xp: 0, level: 1, badges: [] };

function load() {
  try {
    words = JSON.parse(localStorage.getItem(SK)) || [];
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
  localStorage.setItem(SK, JSON.stringify(words));
}
function saveXP() {
  localStorage.setItem(XP_K, JSON.stringify(xpData));
}
function saveStreak() {
  localStorage.setItem(STREAK_K, JSON.stringify(streak));
}
function saveSpeech() {
  localStorage.setItem(SPEECH_K, JSON.stringify(speechCfg));
}

function mkWord(en, ru, ex, tags) {
  return {
    id: crypto.randomUUID(),
    en: en.trim(),
    ru: ru.trim(),
    ex: (ex || '').trim(),
    tags: tags || [],
    createdAt: new Date().toISOString(),
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
function addWord(en, ru, ex, tags) {
  if (words.some(w => w.en.toLowerCase() === en.trim().toLowerCase())) {
    toast('⚠️ Слово «' + en.trim() + '» уже есть в словаре', 'warning');
    return false;
  }
  words.push(mkWord(en, ru, ex, tags));
  save();
  saveWordToDb(words[words.length - 1]);
  gainXP(15, 'новое слово');
  checkBadges();
  return true;
}
function delWord(id) {
  words = words.filter(w => w.id !== id);
  save();
  deleteWordFromDb(id);
}
function updWord(id, data) {
  const w = words.find(w => w.id === id);
  if (w) {
    Object.assign(w, data);
    save();
    saveWordToDb(w);
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
    gainXP(50, 'слово выучено 🌟');
    checkBadges();
  }
  save();
}

// ============================================================
// XP + BADGES
// ============================================================
const XP_PER_LEVEL = 100;

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

function loadVoices() {
  voices = synth ? synth.getVoices() : [];
  const englishVoices = voices.filter(v => v.lang.startsWith('en'));
  const sel = document.getElementById('voice-select');
  sel.innerHTML = '';
  (englishVoices.length ? englishVoices : voices).forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.voiceURI;
    opt.textContent = `${v.name} (${v.lang})`;
    if (v.voiceURI === speechCfg.voiceURI) opt.selected = true;
    sel.appendChild(opt);
  });
  if (!sel.value && sel.options.length) {
    speechCfg.voiceURI = sel.options[0].value;
  }
}

if (synth) {
  synth.onvoiceschanged = loadVoices;
  loadVoices();
} else {
  document.getElementById('no-speech-banner').style.display = 'block';
  document.getElementById('no-speech-stats').style.display = 'block';
  document.getElementById('speech-controls').style.display = 'none';
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
    btn.textContent = '🔊';
    return;
  }
  btn.classList.add('speaking');
  btn.innerHTML =
    '<div class="audio-wave"><span></span><span></span><span></span><span></span><span></span></div>';
  speak(text, () => {
    btn.classList.remove('speaking');
    btn.textContent = '🔊';
  });
}

// Speech settings UI
document.getElementById('voice-select').addEventListener('change', e => {
  speechCfg.voiceURI = e.target.value;
  saveSpeech();
});
document.getElementById('speed-range').addEventListener('input', e => {
  speechCfg.rate = +e.target.value;
  document.getElementById('speed-val').textContent = e.target.value + 'x';
  saveSpeech();
});
document.getElementById('pitch-range').addEventListener('input', e => {
  speechCfg.pitch = +e.target.value;
  document.getElementById('pitch-val').textContent = (+e.target.value).toFixed(
    1,
  );
  saveSpeech();
});
document
  .getElementById('test-voice-btn')
  .addEventListener('click', function () {
    const btn = this;
    const orig = btn.innerHTML;
    btn.innerHTML =
      '<div class="audio-wave"><span></span><span></span><span></span><span></span><span></span></div>';
    btn.disabled = true;
    speak('Hello! This is a voice test. How are you doing today?', () => {
      btn.innerHTML = orig;
      btn.disabled = false;
    });
  });
document.getElementById('speed-range').value = speechCfg.rate;
document.getElementById('speed-val').textContent = speechCfg.rate + 'x';
document.getElementById('pitch-range').value = speechCfg.pitch;
document.getElementById('pitch-val').textContent = speechCfg.pitch.toFixed(1);

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
    setTimeout(renderWotd, 0);
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
document
  .querySelectorAll('.nav-btn[data-tab]')
  .forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));

// ============================================================
// DARK MODE
// ============================================================
function applyDark(on) {
  document.body.classList.toggle('dark', on);
  document.getElementById('dark-toggle').textContent = on ? '☀️' : '🌙';
}
document.getElementById('dark-toggle').addEventListener('click', () => {
  const on = !document.body.classList.contains('dark');
  localStorage.setItem('vmDark', on);
  applyDark(on);
});
if (localStorage.getItem('vmDark') === 'true') applyDark(true);

// ============================================================
// RENDER WORDS
// ============================================================
let activeFilter = 'all',
  searchQ = '',
  sortBy = 'date-desc',
  tagFilter = '';

function renderWords() {
  const grid = document.getElementById('words-grid');
  const empty = document.getElementById('empty-words');
  let list = words;
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
  // Сортировка
  if (sortBy === 'date-asc')
    list = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  else if (sortBy === 'date-desc')
    list = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  else if (sortBy === 'alpha-asc')
    list = [...list].sort((a, b) => a.en.localeCompare(b.en));
  else if (sortBy === 'alpha-desc')
    list = [...list].sort((a, b) => b.en.localeCompare(a.en));
  else if (sortBy === 'progress-asc')
    list = [...list].sort(
      (a, b) =>
        (a.stats.shown ? a.stats.correct / a.stats.shown : 1) -
        (b.stats.shown ? b.stats.correct / b.stats.shown : 1),
    );
  else if (sortBy === 'progress-desc')
    list = [...list].sort(
      (a, b) =>
        (b.stats.shown ? b.stats.correct / b.stats.shown : 1) -
        (a.stats.shown ? a.stats.correct / a.stats.shown : 1),
    );

  document.getElementById('words-count').textContent = words.length;
  updateDueBadge();
  document.getElementById('words-subtitle').textContent =
    list.length !== words.length
      ? `(${list.length} из ${words.length})`
      : `— ${words.length} слов`;
  if (!list.length) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  grid.innerHTML = '';
  let tagInd = document.getElementById('tag-filter-indicator');
  if (tagFilter) {
    if (!tagInd) {
      tagInd = document.createElement('div');
      tagInd.id = 'tag-filter-indicator';
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
  list.forEach(w => grid.appendChild(makeCard(w)));
}

function makeCard(w) {
  const card = document.createElement('div');
  card.className = 'word-card';
  card.dataset.id = w.id;
  card.innerHTML = `
    <div class="wc-top">
      <div class="wc-english">${esc(w.en)}</div>
      ${speechSupported ? `<button class="btn-audio audio-card-btn" data-word="${esc(w.en)}" title="Произнести">🔊</button>` : ''}
    </div>
    <div class="wc-russian">${esc(w.ru)}</div>
    ${w.ex ? `<div class="wc-example">${esc(w.ex)}</div>` : ''}
    <div class="wc-footer">
      <div class="wc-streak">${[0, 1, 2].map(i => `<div class="dot${w.stats.streak > i ? ' on' : ''}"></div>`).join('')}</div>
      <div class="wc-badges">
        ${
          w.stats.learned
            ? '<span class="badge-learned">✅ Выучено</span>'
            : (() => {
                const now = new Date();
                const next = new Date(w.stats.nextReview || now);
                const diff = Math.round((next - now) / 86400000);
                if (diff <= 0)
                  return '<span class="due-now">⏰ Повторить!</span>';
                if (diff === 1)
                  return '<span class="due-soon">📅 Завтра</span>';
                return `<span class="due-later">📅 через ${diff}д</span>`;
              })()
        }
        ${w.tags.map(t => `<span class="badge-tag tag-filter-btn" data-tag="${esc(t)}">${esc(t)}</span>`).join('')}
      </div>
    </div>
    <div class="srs-meta">Интервал: ${w.stats.interval || 1}д &middot; Лёгкость: ${(w.stats.easeFactor || 2.5).toFixed(1)}</div>
    <div class="wc-actions">
      <button class="btn btn-secondary btn-sm edit-btn" data-id="${w.id}">✏️ Ред.</button>
      <button class="btn btn-danger btn-sm del-btn" data-id="${w.id}">🗑</button>
    </div>
  `;
  return card;
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
  const id = e.target.dataset.id;
  if (!id) return;
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
      <div class="form-group"><label>English</label><input type="text" class="e-en" value="${esc(w.en)}"></div>
      <div class="form-group"><label>Русский</label><input type="text" class="e-ru" value="${esc(w.ru)}"></div>
      <div class="form-group"><label>Пример</label><input type="text" class="e-ex" value="${esc(w.ex)}"></div>
      <div class="form-group"><label>Теги</label><input type="text" class="e-tags" value="${esc(w.tags.join(', '))}"></div>
      <div style="display:flex;gap:.5rem">
        <button class="btn btn-primary save-edit" data-id="${id}">💾 Сохранить</button>
        <button class="btn btn-secondary cancel-edit">Отмена</button>
      </div>
    `;
    card.querySelector('.save-edit').addEventListener('click', () => {
      updWord(id, {
        en: card.querySelector('.e-en').value.trim(),
        ru: card.querySelector('.e-ru').value.trim(),
        ex: card.querySelector('.e-ex').value.trim(),
        tags: card
          .querySelector('.e-tags')
          .value.split(',')
          .map(t => t.trim())
          .filter(Boolean),
      });
      toast('✅ Слово обновлено!');
      renderWords();
    });
    card
      .querySelector('.cancel-edit')
      .addEventListener('click', () => renderWords());
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
    renderWords();
  }),
);
document.getElementById('sort-select').addEventListener('change', e => {
  sortBy = e.target.value;
  renderWords();
});
document.getElementById('words-grid').addEventListener('click', e => {
  const tb = e.target.closest('.tag-filter-btn');
  if (!tb) return;
  e.stopPropagation();
  const tag = tb.dataset.tag.toLowerCase();
  tagFilter = tagFilter === tag ? '' : tag;
  renderWords();
});
let searchTimer;
document.getElementById('search-input').addEventListener('input', e => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchQ = e.target.value;
    renderWords();
  }, 280);
});

// Delete modal
let pendingDelId = null;
document.getElementById('del-confirm').addEventListener('click', () => {
  if (pendingDelId) {
    const wSnap = words.find(w => w.id === pendingDelId);
    delWord(pendingDelId);
    pendingDelId = null;
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
document.getElementById('single-form').addEventListener('submit', e => {
  e.preventDefault();
  const en = document.getElementById('f-en').value.trim();
  const ru = document.getElementById('f-ru').value.trim();
  if (!en || !ru) return;
  addWord(
    en,
    ru,
    document.getElementById('f-ex').value.trim(),
    document
      .getElementById('f-tags')
      .value.split(',')
      .map(t => t.trim())
      .filter(Boolean),
  );
  e.target.reset();
  document.getElementById('f-en').focus();
  toast(`✅ «${en}» добавлено!`, 'success');
  // Переключаемся на словарь чтобы показать анимацию
  switchTab('words');
  setTimeout(() => {
    // Сортировка — новое слово первым
    const sel = document.getElementById('sort-select');
    if (sel && sel.value !== 'date-desc') {
      sel.value = 'date-desc';
      sortBy = 'date-desc';
    }
    renderWords();
    setTimeout(() => {
      const newCard = document.querySelector('#words-grid .word-card');
      if (newCard) {
        newCard.classList.add('word-card--new');
        newCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => newCard.classList.remove('word-card--new'), 700);
      }
    }, 60);
  }, 50);
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
  checked.forEach(i => addWord(bulkParsed[i].en, bulkParsed[i].ru, '', []));
  document.getElementById('bulk-preview-wrap').style.display = 'none';
  document.getElementById('import-bulk-btn').style.display = 'none';
  document.getElementById('bulk-text').value = '';
  bulkParsed = [];
  toast(`✅ Импортировано ${checked.length} слов!`);
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
      addWord(w.en, w.ru, w.ex, []);
      added++;
    }
  });
  document.getElementById('file-preview-wrap').style.display = 'none';
  document.getElementById('import-file-btn').style.display = 'none';
  fileParsed = [];
  toast(`✅ Импортировано ${added} слов из файла!`);
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
  .getElementById('export-btn')
  .addEventListener('click', () => openIOModal('export'));
document
  .getElementById('import-btn')
  .addEventListener('click', () => openIOModal('import'));
document
  .getElementById('io-close-export')
  .addEventListener('click', closeIOModal);
document.getElementById('io-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeIOModal();
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
    'vocabmaster-backup-' + new Date().toISOString().slice(0, 10) + '.json';
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
    'vocabmaster-words-' + new Date().toISOString().slice(0, 10) + '.csv';
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
  const blob = new Blob([rows.join('\r\n')], {
    type: 'text/plain;charset=utf-8',
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `vocabmaster_anki_${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  toast('🃏 Anki файл скачан!', 'success');
});

// File input handling
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
        infoEl.innerHTML = `✅ Найдено слов: <b>${data.words.length}</b>${data.xpData ? ' · XP и бейджи будут восстановлены' : ''}<br><span style="color:var(--danger);font-size:.75rem">⚠️ Текущие слова будут заменены!</span>`;
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
              tags: cols[3] ? cols[3].split(';').filter(Boolean) : [],
            };
          })
          .filter(w => w.en && w.ru);
        if (!parsed.length) throw new Error('Не найдено слов в CSV');
        pendingImport = { type: 'csv', data: parsed };
        infoEl.innerHTML = `✅ Найдено слов: <b>${parsed.length}</b><br><span style="color:var(--warning);font-size:.75rem">ℹ️ Слова будут добавлены к существующим</span>`;
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

// Confirm import
document.getElementById('io-confirm-import').addEventListener('click', () => {
  if (!pendingImport) return;
  if (pendingImport.type === 'json') {
    const d = pendingImport.data;
    words = d.words;
    if (d.xpData) {
      xpData = d.xpData;
      saveXP();
    }
    if (d.streak) {
      streak = d.streak;
      saveStreak();
    }
    save();
    renderWords();
    renderStats();
    renderXP();
    renderBadges();
    toast(
      '✅ Бэкап восстановлен! ' + words.length + ' слов загружено',
      'success',
    );
  } else if (pendingImport.type === 'csv') {
    let added = 0;
    pendingImport.data.forEach(w => {
      if (!words.find(x => x.en.toLowerCase() === w.en.toLowerCase())) {
        words.push(mkWord(w.en, w.ru, w.ex, w.tags));
        added++;
      }
    });
    save();
    renderWords();
    renderStats();
    toast('✅ Добавлено ' + added + ' новых слов!', 'success');
  }
  closeIOModal();
  pendingImport = null;
  fileInput.value = '';
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
        <input type="text" id="ta-input" placeholder="${isRUEN ? 'Напиши по-английски...' : 'Введи перевод...'}" autocomplete="off" autocorrect="off" spellcheck="false">
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
  if (xpCorrect > 0) gainXP(xpCorrect * 10, xpCorrect + ' правильных');
  const isPerfect = xpTotal >= 5 && xpCorrect === xpTotal;
  if (isPerfect) gainXP(30, 'идеальная сессия 🎯');
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
  document.getElementById('speed-range').value = speechCfg.rate;
  document.getElementById('speed-val').textContent = speechCfg.rate + 'x';
  document.getElementById('pitch-range').value = speechCfg.pitch;
  document.getElementById('pitch-val').textContent = speechCfg.pitch.toFixed(1);
  setTimeout(loadVoices, 100);
}

// ============================================================
// INIT
// ============================================================
// Мост для Firebase
window._getLocalWords = () => words;
window._setWords = newWords => {
  words = newWords;
  renderWords();
  renderStats();
  renderXP();
  updateDueBadge();
  renderWotd();
};

load();
updStreak();
updateDueBadge();
renderWotd();
renderWords();
renderXP();
renderBadges();
renderStats();

// === ЗВУКИ ===
function playSound(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
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
      oscs[oscs.length - 1].onended = () => ctx.close();
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
      osc.onended = () => ctx.close();
    }
  } catch (e) {}
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
function renderWotd() {
  const wrap = document.getElementById('wotd-wrap');
  if (!wrap || !words.length) {
    if (wrap) wrap.innerHTML = '';
    return;
  }
  const today = new Date().toDateString();
  let seed = 0;
  for (let i = 0; i < today.length; i++)
    seed = (seed * 31 + today.charCodeAt(i)) & 0xffff;
  const w = words[seed % words.length];
  wrap.innerHTML = `<div class="wotd-card">
    <div>
      <div class="wotd-label">☀️ Слово дня</div>
      <div class="wotd-en">${esc(w.en)}</div>
      <div class="wotd-ru">${esc(w.ru)}</div>
      ${w.ex ? `<div class="wotd-ex">${esc(w.ex)}</div>` : ''}
    </div>
    ${speechSupported ? `<button class="wotd-audio" id="wotd-audio-btn">🔊</button>` : ''}
  </div>`;
  if (speechSupported) {
    document
      .getElementById('wotd-audio-btn')
      .addEventListener('click', function () {
        speakBtn(w.en, this);
      });
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
  words.forEach(w => delete w._matched);
  clearInterval(window._matchTimerInterval);
  document.getElementById('practice-ex').style.display = 'none';
  document.getElementById('practice-setup').style.display = 'block';
  const hkHint = document.getElementById('hotkeys-hint');
  if (hkHint) hkHint.style.display = 'none';
});
// === PWA ===
(function initPWA() {
  const manifest = {
    name: 'VocabMaster',
    short_name: 'VocabMaster',
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
  document.getElementById('pwa-manifest').href = URL.createObjectURL(blob);

  if ('serviceWorker' in navigator) {
    const swCode = `
      const CACHE = 'vocabmaster-v1';
      const ASSETS = [self.location.href];
      self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))));
      self.addEventListener('fetch', e => e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))));
    `;
    const swBlob = new Blob([swCode], { type: 'application/javascript' });
    navigator.serviceWorker
      .register(URL.createObjectURL(swBlob))
      .catch(() => {});
  }

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    let deferredPrompt = e;
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary btn-sm';
    btn.innerHTML = '📱 Установить приложение';
    btn.style.cssText =
      'position:fixed;bottom:1.5rem;left:1.5rem;z-index:9999;box-shadow:0 4px 20px rgba(108,99,255,0.4)';
    document.body.appendChild(btn);
    btn.addEventListener('click', () => {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(() => btn.remove());
    });
  });
})();
window.switchTab = switchTab;
