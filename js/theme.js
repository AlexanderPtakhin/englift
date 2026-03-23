// =============================================
// THEME MANAGEMENT MODULE
// =============================================

// Применяет тему к странице
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

  // Помечаем профиль грязный для синхронизации с сервером
  if (window.currentUserId && window.markProfileDirty) {
    window.markProfileDirty('darktheme', dark);
    console.log(
      '💾 Сохраняем usersettings (включая reviewLimit):',
      window.user_settings,
    );
    window.markProfileDirty('usersettings', window.user_settings);
  }

  console.log(
    `🎨 Тема применена: ${baseTheme} ${dark ? '(тёмная)' : '(светлая)'}`,
  );
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
