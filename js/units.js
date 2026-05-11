// js/units.js — ПОЛНЫЙ МОДУЛЬ ЮНИТОВ A1
// В стиле EngLift, отдельный от основной практики

let unitsData = [];

// Загрузка юнитов
async function loadUnits() {
  if (unitsData.length) return unitsData;
  try {
    const res = await fetch('/unitsA1.json');
    unitsData = await res.json();
    return unitsData;
  } catch (e) {
    console.error('Ошибка загрузки unitsA1.json', e);
    return [];
  }
}

// ====================== РЕНДЕР КАРТОЧЕК ======================
async function renderUnits() {
  const grid = document.getElementById('units-grid');
  if (!grid) return;

  grid.innerHTML = `<div class="loading-spinner" style="margin:4rem auto"></div>`;

  const units = await loadUnits();

  let html = '';
  for (const unit of units) {
    html += `
      <div class="unit-card" data-unit-id="${unit.id}">
        <div class="unit-header">
          <div class="unit-order">#${unit.order}</div>
          <div class="unit-time">
            <span class="material-symbols-outlined">timer</span>
            ${unit.estimated_time_min} мин
          </div>
        </div>
        
        <h3 class="unit-title">${unit.title}</h3>

        <div class="unit-progress">
          <div class="unit-progress-fill" style="width: 65%"></div>
        </div>

        <div class="unit-footer">
          <button class="unit-btn unit-btn-theory" data-action="theory">
            <span class="material-symbols-outlined">school</span>
            Теория
          </button>
          <button class="unit-btn unit-btn-practice" data-action="practice">
            <span class="material-symbols-outlined">exercise</span>
            Практика
          </button>
        </div>
      </div>`;
  }

  grid.innerHTML = html;

  grid.querySelectorAll('.unit-card').forEach(card => {
    card.addEventListener('click', e => {
      const unitId = card.dataset.unitId;
      const unit = units.find(u => u.id === unitId);
      if (!unit) return;

      const action = e.target.closest('button')?.dataset.action;
      if (action === 'theory') openUnitTheory(unit);
      if (action === 'practice') startUnitPractice(unit);
    });
  });
}

// ====================== ТЕОРИЯ ======================
function openUnitTheory(unit) {
  const html = `
    <div style="padding:1.5rem 1rem; max-height:85vh; overflow-y:auto;">
      <h2>${unit.title}</h2>
      
      <div style="background:var(--card);padding:1.5rem;border-radius:16px;border:1px solid var(--border);margin:1.5rem 0;">
        <h3>${unit.story.title}</h3>
        <p style="white-space:pre-line;line-height:1.6;">${unit.story.clean}</p>
      </div>

      <h3>${unit.grammar.topic}</h3>
      <pre style="background:var(--bg);padding:1rem;border-radius:12px;white-space:pre-wrap;">${unit.grammar.explanation}</pre>

      <h4 style="margin:1.5rem 0 0.75rem;">Примеры</h4>
      <ul style="padding-left:1.5rem;line-height:1.7;">
        ${unit.grammar.examples.map(ex => `<li><strong>${ex.en}</strong><br><span style="color:var(--muted);">${ex.ru}</span></li>`).join('')}
      </ul>
    </div>`;

  // Создаём и показываем модалку
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop open';
  modal.innerHTML = `
    <div class="modal-box" style="max-width: 720px; max-height: 92vh; overflow-y: auto;">
      <div class="modal-header">
        <h3>${unit.title}</h3>
        <button class="modal-close" id="close-theory-modal">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <div class="modal-body">
        ${html}
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  modal.querySelector('#close-theory-modal').addEventListener('click', () => {
    modal.remove();
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

// ====================== ПРАКТИКА (отдельная, простая) ======================
let currentUnitSession = null;

window.startUnitPractice = function (unit) {
  const exercises = collectExercises(unit);

  if (exercises.length === 0) {
    toast('Нет упражнений для практики', 'warning');
    return;
  }

  currentUnitSession = {
    unitId: unit.id,
    title: unit.title,
    exercises: exercises,
    index: 0,
    score: 0
  };

  showUnitPracticeUI();
  renderUnitExercise();
};

function collectExercises(unit) {
  let list = [];

  // Обычные упражнения
  if (unit.exercises) list = list.concat(unit.exercises);

  // Упражнения из истории
  if (unit.story?.exercises) list = list.concat(unit.story.exercises);

  return list.sort(() => Math.random() - 0.5);
}

function showUnitPracticeUI() {
  // Скрываем сетку юнитов, показываем контейнер практики
  document.getElementById('units-grid').style.display = 'none';
  document.getElementById('unit-practice-container').style.display = 'block';
  document.getElementById('unit-practice-title').textContent = currentUnitSession.title;
}

function renderUnitExercise() {
  const s = currentUnitSession;
  const ex = s.exercises[s.index];

  const container = document.getElementById('unit-practice-ex');
  const counter = document.getElementById('unit-practice-counter');
  const progFill = document.getElementById('unit-practice-prog');

  if (counter) counter.textContent = `${s.index + 1} / ${s.exercises.length}`;
  if (progFill) progFill.style.width = `${((s.index / s.exercises.length) * 100)}%`;

  let html = '';
  
  if (ex.type === 'fill_select') {
    html = renderFillSelectHTML(ex);
  } else if (ex.type === 'build_sentence') {
    html = renderBuildSentenceHTML(ex);
  } else if (ex.type === 'match') {
    html = renderMatchHTML(ex);
  } else if (ex.type === 'truefalse') {
    html = renderTrueFalseHTML(ex);
  } else {
    html = `<div style="padding:2rem;text-align:center;">
      <p>Упражнение типа «${ex.type}» пока не поддерживается.</p>
      <button onclick="window.skipUnitExercise()" class="btn-pill" style="margin-top:1rem;">Пропустить →</button>
    </div>`;
  }

  container.innerHTML = html;
}

function renderFillSelectHTML(ex) {
  let html = `<div style="padding:1.5rem;">`;
  html += `<p style="font-size:1.1rem;margin-bottom:1.5rem;color:var(--text);">${ex.instruction}</p>`;
  
  ex.items.forEach((item, i) => {
    html += `
      <div style="margin:1rem 0;padding:1rem;background:var(--card);border-radius:12px;border:1px solid var(--border);">
        <div style="font-weight:600;margin-bottom:0.75rem;font-size:1.05rem;">${item.sentence}</div>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
          ${item.options.map(opt => `
            <button onclick="window.checkUnitAnswer('${opt}', '${item.correct}')" 
                    class="pill" style="padding:0.6rem 1.2rem;cursor:pointer;">${opt}</button>`).join('')}
        </div>
      </div>`;
  });
  
  html += `</div>`;
  return html;
}

function renderBuildSentenceHTML(ex) {
  let html = `<div style="padding:1.5rem;">`;
  html += `<p style="font-size:1.1rem;margin-bottom:1rem;">${ex.instruction}</p>`;
  
  ex.items.forEach((item, i) => {
    html += `
      <div style="margin:1.5rem 0;padding:1.5rem;background:var(--card);border-radius:12px;border:1px solid var(--border);">
        <p style="color:var(--muted);margin-bottom:0.75rem;">${item.ru}</p>
        <p style="font-weight:600;font-size:1.1rem;margin-bottom:1rem;">${item.target}</p>
        <button onclick="window.checkUnitAnswer('true', 'true')" class="btn-pill btn-primary">✓ Знаю</button>
      </div>`;
  });
  
  html += `</div>`;
  return html;
}

function renderMatchHTML(ex) {
  let html = `<div style="padding:1.5rem;">`;
  html += `<p style="font-size:1.1rem;margin-bottom:1.5rem;">${ex.instruction || 'Соедини пары:'}</p>`;
  
  html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">`;
  ex.pairs.forEach((pair, i) => {
    html += `
      <div style="padding:1rem;background:var(--card);border-radius:8px;border:1px solid var(--border);text-align:center;">
        <strong>${pair.left}</strong>
      </div>
      <div style="padding:1rem;background:var(--card);border-radius:8px;border:1px solid var(--border);text-align:center;">
        ${pair.right}
      </div>`;
  });
  html += `</div>`;
  
  html += `<div style="text-align:center;margin-top:1.5rem;">
    <button onclick="window.checkUnitAnswer('true', 'true')" class="btn-pill btn-primary">Продолжить →</button>
  </div>`;
  
  html += `</div>`;
  return html;
}

function renderTrueFalseHTML(ex) {
  let html = `<div style="padding:1.5rem;">`;
  html += `<p style="font-size:1.1rem;margin-bottom:1.5rem;">${ex.instruction}</p>`;
  
  ex.items.forEach((item, i) => {
    html += `
      <div style="margin:1rem 0;padding:1.5rem;background:var(--card);border-radius:12px;border:1px solid var(--border);">
        <p style="font-weight:600;margin-bottom:1rem;">${item.statement}</p>
        <div style="display:flex;gap:0.75rem;justify-content:center;">
          <button onclick="window.checkUnitAnswer('${item.correct}', 'true')" class="btn-pill" style="background:var(--primary);color:white;">True</button>
          <button onclick="window.checkUnitAnswer('${!item.correct}', 'false')" class="btn-pill" style="background:var(--danger);color:white;">False</button>
        </div>
      </div>`;
  });
  
  html += `</div>`;
  return html;
}

window.checkUnitAnswer = function (chosen, correct) {
  const isCorrect = String(chosen) === String(correct);
  if (isCorrect) {
    currentUnitSession.score++;
    toast('Правильно!', 'success');
  } else {
    toast('Неправильно', 'warning');
  }
  
  setTimeout(() => {
    nextUnitExercise();
  }, 500);
};

window.skipUnitExercise = function () {
  nextUnitExercise();
};

function nextUnitExercise() {
  const s = currentUnitSession;
  s.index++;
  
  if (s.index >= s.exercises.length) {
    finishUnitPractice();
  } else {
    renderUnitExercise();
  }
}

function finishUnitPractice() {
  const s = currentUnitSession;
  const percent = Math.round((s.score / s.exercises.length) * 100);
  
  const container = document.getElementById('unit-practice-ex');
  container.innerHTML = `
    <div style="padding:3rem 1.5rem;text-align:center;">
      <div style="font-size:4rem;margin-bottom:1rem;">🎉</div>
      <h2 style="margin-bottom:1rem;">Юнит пройден!</h2>
      <p style="font-size:1.25rem;color:var(--primary);font-weight:700;margin-bottom:2rem;">
        ${s.score} / ${s.exercises.length} — ${percent}%
      </p>
      <button onclick="window.closeUnitPractice()" class="btn-pill btn-primary" style="padding:1rem 2rem;">
        Завершить
      </button>
    </div>
  `;
  
  // Не скрываем сразу, даём пользователю нажать кнопку
}

window.closeUnitPractice = function () {
  document.getElementById('unit-practice-container').style.display = 'none';
  document.getElementById('units-grid').style.display = 'grid';
  currentUnitSession = null;
};

// ====================== ИНИЦИАЛИЗАЦИЯ ======================
export function initUnits() {
  const grid = document.getElementById('units-grid');
  if (grid) renderUnits();
  
  // Обработчик кнопки "Назад"
  const backBtn = document.getElementById('back-to-units');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      document.getElementById('unit-practice-container').style.display = 'none';
      document.getElementById('units-grid').style.display = 'grid';
      currentUnitSession = null;
    });
  }
  
  console.log('✅ Модуль Юниты полностью загружен');
}

export { renderUnits, startUnitPractice };
