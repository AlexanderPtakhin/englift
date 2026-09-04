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

  // Сохраняем в localStorage
  const saved = JSON.parse(
    localStorage.getItem('englift_user_settings') || '{}',
  );
  saved.baseTheme = baseTheme;
  saved.dark = dark;
  saved._themeManuallySet = true; // Помечаем что пользователь выбрал тему вручную
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

  // Обновляем theme-color (цвет брови в PWA)
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    // В светлой теме везде белый
    const lightColor = '#fff';
    
    // В тёмной теме используем цвет --card из CSS
    const darkColors = {
      lavender: '#23252b',  // Янтарь
      sunset: '#2D2625',   // Закат
      forest: '#242D28',   // Лес
      ocean: '#222A33',    // Океан
      purple: '#2A2633',   // Лаванда
      sky: '#242C34',      // Небесная
      sand: '#2E2925',     // Песок
      graphite: '#232830', // Графит
    };
    
    let color = dark ? (darkColors[baseTheme] || darkColors.lavender) : lightColor;
    metaTheme.content = color;
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
  // Если пользователь не выбирал тему вручную, используем системные настройки
  const dark = saved._themeManuallySet ? saved.dark : window.matchMedia('(prefers-color-scheme: dark)').matches;

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
  window.user_settings._themeManuallySet = saved._themeManuallySet || false;

  // Создаём или обновляем theme-color мета-тег
  let metaTheme = document.querySelector('meta[name="theme-color"]');
  if (!metaTheme) {
    metaTheme = document.createElement('meta');
    metaTheme.name = 'theme-color';
    document.head.appendChild(metaTheme);
  }
  
  // Устанавливаем цвет брови
  const lightColor = '#fff';
  const darkColors = {
    lavender: '#23252b',
    sunset: '#2D2625',
    forest: '#242D28',
    ocean: '#222A33',
    purple: '#2A2633',
    sky: '#242C34',
    sand: '#2E2925',
    graphite: '#232830',
  };
  let color = dark ? (darkColors[baseTheme] || darkColors.lavender) : lightColor;
  metaTheme.content = color;

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
