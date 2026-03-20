// tour.js — EngLift Onboarding Tour
(function () {
  const TOUR_KEY = 'englift_tour_v1_done';
  const MOBILE_BP = 830; // breakpoint из твоего CSS
  const MOBILE_NAV_H = 66; // высота .mobile-bottom-nav из CSS

  const isMobile = () => window.innerWidth <= MOBILE_BP;

  const STEPS = [
    {
      target: null,
      title:
        '<span class="material-symbols-outlined">waving_hand</span> Добро пожаловать в EngLift!',
      text: 'Быстрый тур по приложению — меньше минуты, и ты будешь знать всё.',
      position: 'center',
    },
    {
      target: () =>
        isMobile()
          ? document.querySelector('.mobile-nav-btn[data-tab="words"]')
          : document.querySelector('.nav-btn[data-tab="words"]'),
      title: '<span class="material-symbols-outlined">menu_book</span> Словарь',
      text: 'Здесь хранятся все твои слова. Фильтруй по тегам, CEFR-уровням, сортируй как удобно.',
      onBefore: () => {
        // Убеждаемся что на вкладке слов
        document.querySelector('.nav-btn[data-tab="words"]')?.click();
        document.querySelector('.mobile-nav-btn[data-tab="words"]')?.click();
      },
    },
    {
      target: () => document.querySelector('#wotd-wrap'),
      title:
        '<span class="material-symbols-outlined">auto_awesome</span> Банк слов',
      text: 'Каждый раз при открытии — новое слово из огромной базы. Можно сразу добавить к себе в словарь одной кнопкой.',
      onBefore: () => {
        // Остаемся на вкладке слов
        document.querySelector('.nav-btn[data-tab="words"]')?.click();
        document.querySelector('.mobile-nav-btn[data-tab="words"]')?.click();
      },
    },
    {
      target: () => document.querySelector('#floating-add-word-btn'),
      title:
        '<span class="material-symbols-outlined">add_circle</span> Добавить слово',
      text: 'Одна кнопка — и форма открыта. Перевод, транскрипция и пример подтянутся из словаря автоматически.',
      onBefore: () => {
        // Остаемся на вкладке слов
        document.querySelector('.nav-btn[data-tab="words"]')?.click();
        document.querySelector('.mobile-nav-btn[data-tab="words"]')?.click();
      },
    },
    // ШАГ 4 — кнопка аудио на карточке
    {
      target: () =>
        document.querySelector(
          '#words-grid .word-card[data-id="__demo__"] .audio-btn',
        ) || document.querySelector('#words-grid .word-card .audio-btn'),
      title:
        '<span class="material-symbols-outlined">volume_up</span> Произношение слова',
      text: 'На каждой карточке есть кнопка звука — нажми и услышишь произношение носителем языка.',
      onBefore() {
        document.querySelector('.nav-btn[data-tab="words"]')?.click();
        document.querySelector('.mobile-nav-btn[data-tab="words"]')?.click();
        const expanded = document.querySelector(
          '#words-grid .word-card.expanded',
        );
        if (expanded) expanded.click();
      },
    },
    // ШАГ 5 — раскрытие карточки, пример и аудио примера
    {
      target: () =>
        document.querySelector('#words-grid .word-card[data-id="__demo__"]') ||
        document.querySelector('#words-grid .word-card'),
      title:
        '<span class="material-symbols-outlined">menu_open</span> Пример и перевод',
      text: 'Нажми на карточку — она раскроется. Внутри увидишь пример использования, его перевод и кнопку прослушать пример.',
      delay: 420,
      onBefore() {
        document.querySelector('.nav-btn[data-tab="words"]')?.click();
        document.querySelector('.mobile-nav-btn[data-tab="words"]')?.click();
        // раскрываем с задержкой — после того как rAF пересоберёт DOM
        setTimeout(() => {
          const demoCard =
            document.querySelector(
              '#words-grid .word-card[data-id="__demo__"]',
            ) || document.querySelector('#words-grid .word-card');
          if (demoCard && !demoCard.classList.contains('expanded')) {
            demoCard.click();
          }
        }, 160);
      },
    },
    {
      target: () =>
        isMobile()
          ? document.querySelector('.mobile-nav-btn[data-tab="idioms"]')
          : document.querySelector('.nav-btn[data-tab="idioms"]'),
      title:
        '<span class="material-symbols-outlined">theater_comedy</span> Идиомы',
      text: 'Отдельный раздел для идиом и устойчивых выражений. Та же механика, отдельная база.',
      onBefore: () => {
        // Переключаемся на вкладку идиом
        document.querySelector('.nav-btn[data-tab="idioms"]')?.click();
        document.querySelector('.mobile-nav-btn[data-tab="idioms"]')?.click();
      },
    },
    {
      target: () => document.querySelector('#idiom-bank-wrap'),
      title: '<span class="material-symbols-outlined">casino</span> Банк идиом',
      text: 'То же самое для идиом — случайная подборка из большой базы. Листай, добавляй что понравилось.',
      delay: 500,
      onBefore: () => {
        // Убеждаемся что на вкладке идиом
        document.querySelector('.nav-btn[data-tab="idioms"]')?.click();
        document.querySelector('.mobile-nav-btn[data-tab="idioms"]')?.click();
      },
    },
    {
      target: () =>
        isMobile()
          ? document.querySelector('.mobile-nav-btn[data-tab="practice"]')
          : document.querySelector('.nav-btn[data-tab="practice"]'),
      title:
        '<span class="material-symbols-outlined">rocket_launch</span> Практика',
      text: '9 типов упражнений: флэш-карты, тест, диктовка, речь, конструктор и другие. Умный SM-2 алгоритм сам решает что показать.',
      onBefore: () => {
        // Переключаемся на вкладку практики
        document.querySelector('.nav-btn[data-tab="practice"]')?.click();
        document.querySelector('.mobile-nav-btn[data-tab="practice"]')?.click();
      },
    },
    {
      target: () =>
        isMobile()
          ? document.querySelector('.mobile-nav-btn[data-tab="stats"]')
          : document.querySelector('.nav-btn[data-tab="stats"]'),
      title:
        '<span class="material-symbols-outlined">monitoring</span> Прогресс',
      text: 'XP, уровень, стрик, недельный график, CEFR и бейджи. Всё чтобы не забросить.',
      onBefore: () => {
        // Переключаемся на вкладку статистики
        document.querySelector('.nav-btn[data-tab="stats"]')?.click();
        document.querySelector('.mobile-nav-btn[data-tab="stats"]')?.click();
      },
    },
    {
      target: () =>
        isMobile()
          ? document.querySelector('.mobile-nav-btn[data-tab="friends"]')
          : document.querySelector('.nav-btn[data-tab="friends"]'),
      title: '<span class="material-symbols-outlined">group</span> Друзья',
      text: 'Добавляй друзей и соревнуйся в лидерборде по XP. Конкуренция мотивирует!',
      onBefore: () => {
        // Переключаемся на вкладку друзей
        document.querySelector('.nav-btn[data-tab="friends"]')?.click();
        document.querySelector('.mobile-nav-btn[data-tab="friends"]')?.click();
      },
    },
    {
      target: () => document.querySelector('#user-avatar'),
      title:
        '<span class="material-symbols-outlined">settings</span> Настройки',
      text: 'Нажми на аватарку — там можно сменить голос озвучки, выбрать тему оформления и настроить лимит повторений в день.',
      onBefore() {
        // закрыть дропдаун если вдруг открыт
        const dropdown = document.getElementById('user-dropdown');
        if (dropdown) dropdown.style.display = 'none';
        STEPS[10].target = document.querySelector('#user-avatar');
      },
    },
    {
      target: null,
      title:
        '<span class="material-symbols-outlined">celebration</span> Готово!',
      text: 'Добавь первое слово прямо сейчас — и пусть стрик никогда не обнулится 🔥',
      position: 'center',
      isLast: true,
      onBefore: () => {
        // Возвращаемся на вкладку словаря для финального шага
        document.querySelector('.nav-btn[data-tab="words"]')?.click();
        document.querySelector('.mobile-nav-btn[data-tab="words"]')?.click();
      },
    },
  ];

  // ─── DEMO WORD FUNCTIONS ───────────────────────────────────
  function addDemoWord() {
    if (!window.words) return;
    if (window.words.find(w => w.id === '__demo__')) return;

    const demoWord = {
      id: '__demo__',
      en: 'Hello',
      ru: 'Привет',
      phonetic: '[həˈloʊ]',
      ex: 'Hello, how are you today?',
      examples: [
        {
          text: 'Hello, how are you today?',
          translation: 'Привет, как дела сегодня?',
        },
      ],
      examplesAudio: [],
      audio: null,
      tags: ['A1'],
      createdAt: new Date().toISOString(),
      stats: {
        shown: 3,
        correct: 2,
        streak: 1,
        learned: false,
        nextReview: new Date().toISOString(),
        interval: 3,
        easeFactor: 2.5,
        correctExerciseTypes: ['flash', 'multi'],
        lastPracticed: new Date(Date.now() - 86400000).toISOString(),
      },
      isDemo: true,
    };

    const injectDemo = () => {
      if (!window.words) return;
      if (!window.words.find(w => w.id === '__demo__')) {
        window.words.unshift(demoWord);
      }
    };

    // Патчим renderWords — перед каждым рендером проверяем что demo на месте
    if (!window._tourOriginalRenderWords) {
      window._tourOriginalRenderWords = window.renderWords;
      window.renderWords = function (...args) {
        injectDemo();
        return window._tourOriginalRenderWords?.(...args);
      };
    }

    injectDemo();
    setTimeout(() => window.renderWords?.(), 50);
  }

  function removeDemoWord() {
    // Снимаем патч
    if (window._tourOriginalRenderWords) {
      window.renderWords = window._tourOriginalRenderWords;
      window._tourOriginalRenderWords = null;
    }
    if (!window.words) return;
    window.words = window.words.filter(w => w.id !== '__demo__');
    window.renderWords?.();
  }

  // ─── BUILD DOM ────────────────────────────────────────────
  function buildTour() {
    addDemoWord(); // ← добавить сюда
    // ждем отрисовки демо-слова
    setTimeout(() => {
      injectStyles();

      const overlay = document.createElement('div');
      overlay.id = 'tour-overlay';
      overlay.innerHTML = `
      <svg id="tour-svg" aria-hidden="true">
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white"/>
            <rect id="tour-hole" rx="14" fill="black" x="0" y="0" width="0" height="0"/>
          </mask>
        </defs>
        <rect id="tour-bg-rect" width="100%" height="100%"
              fill="rgba(0,0,0,0.55)" mask="url(#tour-mask)"/>
      </svg>`;

      const ring = document.createElement('div');
      ring.id = 'tour-ring';

      const tooltip = document.createElement('div');
      tooltip.id = 'tour-tooltip';
      tooltip.innerHTML = `
      <div id="tour-arrow"></div>
      <div id="tour-header">
        <span id="tour-badge"></span>
      </div>
      <div id="tour-title"></div>
      <div id="tour-text"></div>
      <div id="tour-footer">
        <div id="tour-nav">
          <button id="tour-prev">←</button>
          <div id="tour-dots"></div>
          <button id="tour-next">→</button>
        </div>
      </div>
      <div id="tour-skip-container">
        <button id="tour-skip">Пропустить</button>
      </div>
    `;

      document.body.append(overlay, ring, tooltip);

      document.getElementById('tour-skip').onclick = () => endTour(false);
      document.getElementById('tour-prev').onclick = () => goTo(state.step - 1);
      document.getElementById('tour-next').onclick = () => {
        if (state.step === STEPS.length - 1) endTour(true);
        else goTo(state.step + 1);
      };
      overlay.addEventListener('click', e => {
        if (e.target === overlay || e.target.closest('#tour-svg')) {
          if (state.step < STEPS.length - 1) goTo(state.step + 1);
          else endTour(true);
        }
      });
      document.addEventListener('keydown', onKey);

      goTo(0);
    }, 300); // ждем отрисовки демо-слова
  }

  // ─── STATE & RENDER ───────────────────────────────────────
  const state = { step: 0 };

  function goTo(idx) {
    if (idx < 0 || idx >= STEPS.length) return;
    state.step = idx;
    const step = STEPS[idx];
    if (step.onBefore) {
      step.onBefore();
      // используем step.delay если есть, иначе дефолтные 120ms
      setTimeout(() => renderStep(step, idx), step.delay ?? 120);
      return;
    }
    renderStep(step, idx);
  }

  function renderStep(step, idx) {
    const pct = Math.round(((idx + 1) / STEPS.length) * 100);
    document.getElementById('tour-badge').textContent =
      `${idx + 1} / ${STEPS.length}`;
    document.getElementById('tour-title').innerHTML = step.title;
    document.getElementById('tour-text').textContent = step.text;

    document.getElementById('tour-dots').innerHTML = STEPS.map(
      (_, i) => `<span class="t-dot${i === idx ? ' on' : ''}"></span>`,
    ).join('');

    const prev = document.getElementById('tour-prev');
    const next = document.getElementById('tour-next');
    const skip = document.getElementById('tour-skip');
    const nav = document.getElementById('tour-nav');
    const skipContainer = document.getElementById('tour-skip-container');

    if (step.isLast) {
      // Финальный шаг: скрываем навигацию, показываем только "Начать"
      nav.style.display = 'none';
      skipContainer.style.display = 'none';

      // Создаем кнопку "Начать" по центру
      const finishBtn = document.createElement('button');
      finishBtn.id = 'tour-finish';
      finishBtn.innerHTML =
        '<span class="material-symbols-outlined">celebration</span> Начать!';
      finishBtn.className = 'finish';
      finishBtn.onclick = () => endTour(true);

      // Заменяем футер
      const footer = document.getElementById('tour-footer');
      footer.innerHTML = '';
      footer.appendChild(finishBtn);
    } else {
      // Обычный шаг: показываем навигацию
      nav.style.display = 'flex';
      skipContainer.style.display = 'flex';

      // Восстанавливаем стандартную структуру футера если была изменена
      const footer = document.getElementById('tour-footer');
      if (!footer.querySelector('#tour-nav')) {
        footer.innerHTML = `
          <div id="tour-nav">
            <button id="tour-prev">←</button>
            <div id="tour-dots"></div>
            <button id="tour-next">→</button>
          </div>
        `;

        // Перепривязываем события
        document.getElementById('tour-prev').onclick = () =>
          goTo(state.step - 1);
        document.getElementById('tour-next').onclick = () => {
          if (state.step === STEPS.length - 1) endTour(true);
          else goTo(state.step + 1);
        };
      }

      prev.disabled = idx === 0;
      next.textContent = '→';
      next.classList.remove('finish');
      skip.style.visibility = 'visible';
    }

    positionTooltip(step);
  }

  // ─── SMART POSITIONING ────────────────────────────────────
  function positionTooltip(step, silent = false) {
    const tooltip = document.getElementById('tour-tooltip');
    const ring = document.getElementById('tour-ring');
    const hole = document.getElementById('tour-hole');
    const arrow = document.getElementById('tour-arrow');
    const target = step.target ? step.target() : null;

    // fade only при смене шага, не при resize
    if (!silent) {
      tooltip.style.opacity = '0';
      tooltip.style.transform = 'translateY(8px) scale(0.97)';
      setTimeout(() => {
        tooltip.style.opacity = '1';
        tooltip.style.transform = 'translateY(0) scale(1)';
      }, 50);
    }

    // ── центральный шаг (без подсветки) ──
    if (!target || step.position === 'center') {
      tooltip.className = 'center';
      ring.style.opacity = '0';
      hole.setAttribute('width', '0');
      hole.setAttribute('height', '0');
      arrow.style.display = 'none';
      return;
    }

    tooltip.className = '';
    ring.style.opacity = '1';
    arrow.style.display = 'block';

    const r = target.getBoundingClientRect();

    // На мобиле скроллим таргет в видимую зону перед позиционированием
    if (isMobile()) {
      target.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    }

    // SVG hole + ring - чистый PAD или ноль для элементов у края
    const PAD_FULL = 10;
    const VW = window.visualViewport?.width ?? window.innerWidth;
    const VH = window.visualViewport?.height ?? window.innerHeight;

    // Если элемент у любого края — убираем отступ полностью
    const nearEdge =
      r.left < PAD_FULL ||
      r.top < PAD_FULL ||
      VW - r.right < PAD_FULL ||
      VH - r.bottom < PAD_FULL;

    const PAD = nearEdge ? 0 : PAD_FULL;

    hole.setAttribute('x', r.left - PAD);
    hole.setAttribute('y', r.top - PAD);
    hole.setAttribute('width', r.width + PAD * 2);
    hole.setAttribute('height', r.height + PAD * 2);

    Object.assign(ring.style, {
      top: r.top - PAD + 'px',
      left: r.left - PAD + 'px',
      width: r.width + PAD * 2 + 'px',
      height: r.height + PAD * 2 + 'px',
    });

    // Размеры и ограничения
    const TW = Math.min(320, window.innerWidth - 32);
    // Ставим ширину сразу — браузер посчитает реальную высоту
    tooltip.style.width = TW + 'px';
    const TH = tooltip.offsetHeight || 220; // ← реальная высота, не гадаем
    const GAP = 16;
    const M = 16;

    // Нижняя граница: на мобиле отнимаем высоту навбара
    const bottomLimit = isMobile() ? VH - MOBILE_NAV_H - M : VH - M;

    // Места выше и ниже элемента
    const spaceBelow = bottomLimit - (r.bottom + PAD + GAP);
    const spaceAbove = r.top - PAD - GAP - M;

    // Ставим снизу только если реально помещается
    const placeBelow = spaceBelow >= TH || spaceBelow > spaceAbove;

    let top, left, arrowClass;
    if (placeBelow) {
      top = r.bottom + PAD + GAP;
      arrowClass = 'up'; // стрелка сверху тултипа ↑ указывает на элемент выше
    } else {
      top = r.top - PAD - GAP - TH;
      arrowClass = 'down'; // стрелка снизу тултипа ↓ указывает на элемент ниже
    }

    // Центрируем по горизонтали относительно элемента
    left = r.left + r.width / 2 - TW / 2;

    // Умный клампинг с учетом размера тултипа
    left = Math.max(M, Math.min(left, VW - TW - M));
    top = Math.max(M, Math.min(top, bottomLimit - TH));

    // Если тултип все равно вылезает справа - прижимаем к краю
    if (left + TW > VW - M) {
      left = VW - TW - M;
    }
    // Если вылезает слева - прижимаем к левому краю
    if (left < M) {
      left = M;
    }

    // Убеждаемся что низ тултипа не залезает в зону мобильного меню
    const safeBottom = isMobile() ? VH - MOBILE_NAV_H - M : VH - M;
    if (top + TH > safeBottom) {
      top = safeBottom - TH - 4;
    }

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
    tooltip.style.width = `${TW}px`; // уже выставлен выше, но для ясности

    // Позиция стрелки: указываем на центр целевого элемента
    const targetCenter = r.left + r.width / 2;
    const tooltipLeft = left;
    const arrowX = targetCenter - tooltipLeft;

    // Ограничиваем стрелку в пределах тултипа
    const arrowPos = Math.max(16, Math.min(arrowX - 6, TW - 28));
    arrow.className = arrowClass;
    arrow.style.left = `${arrowPos}px`;

    // Следим за изменением размеров таргета
    if (window._tourResizeObserver) {
      window._tourResizeObserver.disconnect();
    }
    if (target) {
      let _rObsTimer = null;
      window._tourResizeObserver = new ResizeObserver(() => {
        clearTimeout(_rObsTimer);
        _rObsTimer = setTimeout(() => {
          const currentStep = STEPS[state.step];
          const currentTarget =
            typeof currentStep.target === 'function'
              ? currentStep.target()
              : currentStep.target;
          if (currentTarget === target) positionTooltip(currentStep, true); // ← silent=true
        }, 80);
      });
      window._tourResizeObserver.observe(target);
    }
  }

  // ─── END ──────────────────────────────────────────────────
  function endTour(completed) {
    document.removeEventListener('keydown', onKey);
    ['tour-overlay', 'tour-ring', 'tour-tooltip', 'tour-styles'].forEach(id =>
      document.getElementById(id)?.remove(),
    );
    window._tourResizeObserver?.disconnect();
    window._tourResizeObserver = null;
    removeDemoWord();

    // Всегда сохраняем — неважно, завершил или пропустил
    localStorage.setItem(TOUR_KEY, '1');

    if (completed) {
      window.spawnConfetti?.();
      setTimeout(() => {
        const btn = document.querySelector('#floating-add-word-btn');
        if (!btn) return;
        btn.classList.add('tour-pulse-hint');
        setTimeout(() => btn.classList.remove('tour-pulse-hint'), 2800);
      }, 400);
    }
  }

  function onKey(e) {
    if (e.key === 'ArrowRight' || e.key === 'Enter') {
      if (state.step < STEPS.length - 1) goTo(state.step + 1);
      else endTour(true);
    }
    if (e.key === 'ArrowLeft') goTo(state.step - 1);
    if (e.key === 'Escape') endTour(false);
  }

  // ─── STYLES ───────────────────────────────────────────────
  function injectStyles() {
    const s = document.createElement('style');
    s.id = 'tour-styles';
    s.textContent = `
      #tour-overlay {
        position: fixed; inset: 0; z-index: 99990;
      }
      #tour-svg {
        position: absolute; inset: 0; width: 100%; height: 100%;
        pointer-events: none;
      }
      #tour-ring {
        position: fixed; border-radius: 14px; z-index: 99991;
        border: 2px solid var(--primary);
        box-shadow:
          0 0 0 3px rgba(var(--primary-rgb), .12),
          0 0 20px rgba(var(--primary-rgb), .28);
        pointer-events: none;
        transition: top .3s ease, left .3s ease, width .3s ease, height .3s ease, opacity .2s;
        animation: tourGlow 2.2s ease-in-out infinite;
      }
      @keyframes tourGlow {
        0%, 100% { box-shadow: 0 0 0 3px rgba(var(--primary-rgb),.1), 0 0 18px rgba(var(--primary-rgb),.22); }
        50%       { box-shadow: 0 0 0 6px rgba(var(--primary-rgb),.06), 0 0 34px rgba(var(--primary-rgb),.4); }
      }
      #tour-tooltip {
        position: fixed; z-index: 99992;
        background: var(--card);
        border: 1.5px solid var(--border);
        border-radius: var(--radius, 16px);
        padding: 18px 18px 14px;
        box-shadow: 0 16px 48px rgba(0,0,0,.16), 0 2px 8px rgba(0,0,0,.06);
        transition:
          opacity .18s ease,
          transform .22s cubic-bezier(.4,0,.2,1),
          top .28s cubic-bezier(.4,0,.2,1),
          left .28s cubic-bezier(.4,0,.2,1);
        pointer-events: auto;
        font-family: 'Nunito', sans-serif;
      }
      #tour-tooltip.center {
        top: 50% !important; left: 50% !important;
        transform: translate(-50%, -50%) !important;
        width: min(340px, calc(100vw - 28px)) !important;
      }
      #tour-arrow {
        position: absolute; width: 12px; height: 12px;
        background: var(--card);
        border: 1.5px solid var(--border);
        transform: rotate(45deg);
        transition: none;
      }
      #tour-arrow.up   { top: -7px;    border-right: none; border-bottom: none; }
      #tour-arrow.down { bottom: -7px; border-left: none;  border-top: none;  }
      #tour-header {
        display: flex; align-items: center; gap: 8px;
        margin-bottom: 10px;
      }
      #tour-badge {
        background: var(--primary);
        color: #fff;
        font-size: .68rem; font-weight: 800;
        letter-spacing: .4px;
        padding: 2px 10px;
        border-radius: 99px;
      }
      #tour-title {
        font-size: 1rem; font-weight: 800; line-height: 1.3;
        color: var(--text); margin-bottom: 6px;
        display: flex; align-items: center; gap: 8px;
      }
      #tour-title .material-symbols-outlined {
        font-size: 1.2rem;
        color: var(--primary);
      }
      #tour-text {
        font-size: .855rem; line-height: 1.6;
        color: var(--muted); margin-bottom: 14px;
      }
      #tour-footer {
        display: flex; 
        align-items: center; 
        justify-content: center;
        margin-bottom: 8px;
      }
      #tour-skip-container {
        display: flex; 
        justify-content: center;
        margin-top: 4px;
      }
      #tour-skip {
        background: none; border: none; cursor: pointer;
        color: var(--muted); font-size: .78rem;
        font-family: inherit; padding: 4px 12px;
        transition: color .15s;
      }
      #tour-skip:hover { color: var(--danger); }
      #tour-nav { display: flex; align-items: center; gap: 6px; }
      #tour-prev, #tour-next {
        border: none; cursor: pointer;
        font-family: inherit; font-weight: 700;
        font-size: .8rem; border-radius: 10px;
        padding: 7px 14px;
        transition: opacity .15s, transform .15s;
        min-width: 44px; /* одинаковый размер кнопок */
        display: flex; 
        align-items: center; 
        justify-content: center;
      }
      #tour-prev {
        background: var(--bg);
        color: var(--text);
        border: 1.5px solid var(--border);
      }
      #tour-next {
        background: var(--primary);
        color: #fff;
      }
      #tour-next.finish {
        background: linear-gradient(135deg, var(--primary), var(--primary-light));
        padding: 7px 18px;
        min-width: auto;
      }
      #tour-finish {
        background: linear-gradient(135deg, var(--primary), var(--primary-light));
        color: #fff;
        border: none;
        border-radius: 12px;
        padding: 10px 24px;
        font-size: .9rem;
        font-weight: 700;
        cursor: pointer;
        transition: opacity .15s, transform .15s;
        font-family: inherit;
        box-shadow: 0 4px 16px rgba(var(--primary-rgb), .3);
        display: flex; align-items: center; gap: 8px;
      }
      #tour-finish .material-symbols-outlined {
        font-size: 1.1rem;
        color: #fff !important;
      }
      #tour-finish:hover {
        opacity: .9; 
        transform: scale(1.05);
      }
      #tour-finish:hover .material-symbols-outlined {
        color: #fff !important;
      }
      #tour-prev:disabled { opacity: .3; cursor: default; }
      #tour-prev:not(:disabled):hover,
      #tour-next:hover { opacity: .82; transform: scale(1.04); }
      #tour-dots { display: flex; gap: 5px; align-items: center; }
      .t-dot {
        width: 6px; height: 6px; border-radius: 50%;
        background: var(--border);
        transition: background .2s, transform .2s;
        flex-shrink: 0;
      }
      .t-dot.on {
        background: var(--primary);
        transform: scale(1.5);
      }
      .tour-pulse-hint {
        animation: tourBtnPulse .55s ease 4 !important;
      }
      @keyframes tourBtnPulse {
        0%, 100% { transform: scale(1); }
        50%       { transform: scale(1.2); }
      }
    `;
    document.head.appendChild(s);
  }

  // ─── INIT ─────────────────────────────────────────────────
  window.startTour = function () {
    localStorage.removeItem(TOUR_KEY);
    ['tour-overlay', 'tour-ring', 'tour-tooltip', 'tour-styles'].forEach(id =>
      document.getElementById(id)?.remove(),
    );
    buildTour();
  };

  function tryStart() {
    if (localStorage.getItem(TOUR_KEY)) return;
    if (document.body.classList.contains('authenticated')) {
      setTimeout(buildTour, 900);
    } else {
      const obs = new MutationObserver(() => {
        if (document.body.classList.contains('authenticated')) {
          obs.disconnect();
          setTimeout(buildTour, 900);
        }
      });
      obs.observe(document.body, {
        attributes: true,
        attributeFilter: ['class'],
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryStart);
  } else {
    tryStart();
  }
})();
