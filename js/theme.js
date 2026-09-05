// =============================================
// THEME MANAGEMENT MODULE
// =============================================

// Применяет тему к страницу
export function applyTheme(baseTheme = 'lavender', dark = false) {
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
    'theme-cream',
    'dark',
  );

  // Добавляем новую тему (если не lavender, потому что lavender — класс по умолчанию (янтарь))
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

  // Сохраняем в localStorage (все настройки, не только тему)
  const saved = JSON.parse(
    localStorage.getItem('englift_user_settings') || '{}',
  );
  saved.baseTheme = baseTheme;
  saved.dark = dark;
  saved._themeManuallySet = true; // Помечаем что пользователь выбрал тему вручную

  // Сохраняем и другие настройки, если они есть
  if (window.user_settings) {
    if (window.user_settings.voice) saved.voice = window.user_settings.voice;
    if (window.user_settings.reviewLimit) saved.reviewLimit = window.user_settings.reviewLimit;
    if (window.user_settings.showPhonetic !== undefined) saved.showPhonetic = window.user_settings.showPhonetic;
    if (window.user_settings.bankWordLevel) saved.bankWordLevel = window.user_settings.bankWordLevel;
  }

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
    themeIcon.textContent = dark ? 'light_mode' : 'dark_mode';
  }

  // Обновляем текст в дропдауне
  const themeText = document.getElementById('theme-toggle-text');
  if (themeText) {
    themeText.textContent = dark ? 'Дневной режим' : 'Ночной режим';
  }

  // Помечаем профиль грязный для синхронизации с сервером
  // Фикс 1: Не дёргаем профиль при инициализации
  if (
    window.currentUserId &&
    window.markProfileDirty &&
    !window._applyingProfile
  ) {
    window.markProfileDirty('darktheme', dark);
    window.markProfileDirty('usersettings', window.user_settings);
  }
}

// Обновляет иконку темы в хедере
export function updateThemeIcon() {
  const isDark = document.documentElement.classList.contains('dark');
  const themeIcon = document.getElementById('theme-icon');
  if (themeIcon) themeIcon.textContent = isDark ? 'light_mode' : 'dark_mode';
}

// Инициализация темы из localStorage при загрузке страницы
export function initTheme() {
  const saved = JSON.parse(
    localStorage.getItem('englift_user_settings') || '{}',
  );
  const baseTheme = saved.baseTheme || 'lavender';
  // Всегда используем сохраненную тему, игнорируем системные настройки
  const dark = saved.dark !== undefined ? saved.dark : false;

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
    'theme-cream',
    'dark',
  );
  if (baseTheme !== 'lavender') html.classList.add(`theme-${baseTheme}`);
  if (dark) html.classList.add('dark');

  // Записываем в глобальные настройки, чтобы потом использовать
  window.user_settings = window.user_settings || {};
  window.user_settings.baseTheme = baseTheme;
  window.user_settings.dark = dark;
  window.user_settings._themeManuallySet = saved._themeManuallySet || false;

  // Загружаем и другие настройки из localStorage
  if (saved.voice) window.user_settings.voice = saved.voice;
  if (saved.reviewLimit) window.user_settings.reviewLimit = saved.reviewLimit;
  if (saved.showPhonetic !== undefined) window.user_settings.showPhonetic = saved.showPhonetic;
  if (saved.bankWordLevel) window.user_settings.bankWordLevel = saved.bankWordLevel;

  // Инициализируем иконку темы
  updateThemeIcon();
}

// Настройка обработчика кнопки переключения темы
export function setupThemeToggle() {
  const themeToggleBtn = document.getElementById('theme-toggle-header');

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const isDark = document.documentElement.classList.contains('dark');
      const baseTheme = window.user_settings?.baseTheme || 'lavender';
      applyTheme(baseTheme, !isDark);

      // Немедленно сохраняем на сервер
      if (window.currentUserId && window.syncProfileToServer) {
        window.syncProfileToServer();
      }
    });
  }
}
