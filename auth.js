import { supabase } from './supabase.js';
import { saveUserData } from './db.js';

// Флаг, что профиль загружен, но колбэк ещё не вызван
window._pendingProfileLoaded = false;

// Универсальная функция для вызова колбэка
function callOnProfileFullyLoaded() {
  console.log(
    '🔄 callOnProfileFullyLoaded вызван, onProfileFullyLoaded существует:',
    !!window.onProfileFullyLoaded,
  );
  if (window.onProfileFullyLoaded) {
    console.log('✅ Вызываем onProfileFullyLoaded немедленно');
    window.onProfileFullyLoaded();
  } else {
    console.log('⏳ Устанавливаем флаг _pendingProfileLoaded = true');
    window._pendingProfileLoaded = true;
  }
}

// Флаг для отслеживания явного выхода
let isExplicitLogoutPending = false;

// DOM элементы (оставляем те же)
const authGate = document.getElementById('auth-gate');
const gateEmail = document.getElementById('gate-email');
const gatePassword = document.getElementById('gate-password');
const gateConfirm = document.getElementById('gate-confirm-password');
const gateConfirmGroup = document.getElementById('gate-confirm-group');
const gateSubmit = document.getElementById('gate-submit-btn');
const gateError = document.getElementById('gate-error');
const forgotPasswordBtn = document.getElementById('forgot-password-btn');
const resetModal = document.getElementById('reset-password-modal');
const resetEmail = document.getElementById('reset-email');
const sendResetBtn = document.getElementById('send-reset-btn');
const cancelResetBtn = document.getElementById('cancel-reset-btn');
const emailNotVerifiedBlock = document.getElementById('email-not-verified');
const unverifiedEmailSpan = document.getElementById('unverified-email');
const resendEmailBtn = document.getElementById('resend-email-btn');
const logoutFromUnverifiedBtn = document.getElementById(
  'logout-from-unverified',
);
const userMenu = document.getElementById('user-menu');
const userAvatar = document.getElementById('user-avatar');
const userDropdown = document.getElementById('user-dropdown');
const dropdownEmail = document.getElementById('dropdown-email');
const dropdownLogout = document.getElementById('dropdown-logout');

// Добавляем элементы для username
const gateUsername = document.getElementById('gate-username');
const gateUsernameGroup = document.getElementById('gate-username-group');
const gateUsernameHint = document.getElementById('gate-username-hint');

// Real-time проверка username пока пишет
gateUsername.addEventListener('input', () => {
  const val = gateUsername.value.trim();
  const valid = /^[a-zA-Z0-9_-]{3,20}$/.test(val);
  if (!val) {
    gateUsernameHint.style.color = 'var(--muted)';
    gateUsernameHint.textContent = '3–20 символов: буквы, цифры, _ и -';
  } else if (!valid) {
    gateUsernameHint.style.color = 'var(--danger)';
    gateUsernameHint.textContent = 'Только буквы, цифры, _ и - (3–20 символов)';
  } else {
    gateUsernameHint.style.color = 'var(--success)';
    gateUsernameHint.textContent = '✓ Выглядит хорошо';
  }
});

// Добавляем элементы табов
const authTabs = document.querySelectorAll('.auth-tab');

let isRegisterMode = false;
let hideTimeout;

// Вспомогательные функции (те же)
function showAuthGate() {
  console.log('showAuthGate called');
  authGate.classList.remove('hidden');
  authGate.style.display = 'flex'; // принудительно
  document.body.classList.remove('authenticated');
  console.log(
    'authGate display after:',
    window.getComputedStyle(authGate)?.display,
  );
  console.log(
    'body has authenticated:',
    document.body.classList.contains('authenticated'),
  );
  if (gateEmail) {
    gateEmail.focus();
  }
}

function hideAuthGate() {
  authGate.classList.add('hidden');
  authGate.style.display = ''; // сбрасываем инлайн-стиль
  document.body.classList.add('authenticated');
}

function showEmailNotVerified(email) {
  if (emailNotVerifiedBlock && unverifiedEmailSpan) {
    unverifiedEmailSpan.textContent = email;
    emailNotVerifiedBlock.style.display = 'flex';
  }
  if (authGate) authGate.classList.add('hidden');
  document.body.classList.remove('authenticated');
}

function hideEmailNotVerified() {
  if (emailNotVerifiedBlock) emailNotVerifiedBlock.style.display = 'none';
}

function toggleRegisterFields(show) {
  if (show) {
    gateConfirmGroup.style.display = 'block';
    gateUsernameGroup.style.display = 'block';
  } else {
    gateConfirmGroup.style.display = 'none';
    gateConfirm.value = '';
    gateUsernameGroup.style.display = 'none';
    gateUsername.value = '';
    gateUsernameHint.style.color = 'var(--muted)';
    gateUsernameHint.textContent = '3–20 символов: буквы, цифры, _ и -';
  }
}

function clearGateForm() {
  gateEmail.value = '';
  gatePassword.value = '';
  gateConfirm.value = '';
  gateUsername.value = '';
  gateError.textContent = '';
  // на случай если юзер передумал регистрироваться
  localStorage.removeItem('englift_pending_username');
}

// Функция обновления табов
function updateAuthTabs(mode) {
  authTabs.forEach(tab => {
    tab.classList.remove('active');
    if (tab.dataset.mode === mode) {
      tab.classList.add('active');
    }
  });
}

// Обработчики кликов по табам
authTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const mode = tab.dataset.mode;
    isRegisterMode = mode === 'register';
    updateAuthTabs(mode);

    // Обновляем UI в зависимости от режима
    gateSubmit.textContent = isRegisterMode ? 'Создать аккаунт' : 'Войти';
    toggleRegisterFields(isRegisterMode);
    gateError.textContent = '';
    clearGateForm();
  });
});

// Переключение видимости пароля для основного поля
document
  .getElementById('gate-password-toggle')
  ?.addEventListener('click', function () {
    const passwordInput = document.getElementById('gate-password');
    const type =
      passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);

    // Меняем иконку
    const icon = this.querySelector('.material-symbols-outlined');
    icon.textContent = type === 'password' ? 'visibility' : 'visibility_off';
  });

// Переключение видимости для поля подтверждения (если оно существует)
document
  .getElementById('gate-confirm-toggle')
  ?.addEventListener('click', function () {
    const confirmInput = document.getElementById('gate-confirm-password');
    const type =
      confirmInput.getAttribute('type') === 'password' ? 'text' : 'password';
    confirmInput.setAttribute('type', type);

    const icon = this.querySelector('.material-symbols-outlined');
    icon.textContent = type === 'password' ? 'visibility' : 'visibility_off';
  });

// Обработка входа/регистрации
async function handleAuth(email, password, confirm, isRegister) {
  console.log('🚀 handleAuth called with:', {
    email,
    hasPassword: !!password,
    isRegister,
  });

  if (!email || !password) {
    console.log('❌ Missing email or password');
    return;
  }
  if (isRegister && password !== confirm) {
    console.log('❌ Passwords do not match');
    gateError.textContent = 'Пароли не совпадают';
    return;
  }

  // ── Валидация username при регистрации ──
  let chosenUsername = '';
  if (isRegister) {
    chosenUsername = gateUsername.value.trim();
    if (!chosenUsername) {
      gateError.textContent = 'Введи имя пользователя';
      gateUsername.focus();
      return;
    }
    if (!/^[a-zA-Z0-9_-]{3,20}$/.test(chosenUsername)) {
      gateError.textContent = 'Имя: 3–20 символов, только буквы, цифры, _ и -';
      gateUsername.focus();
      return;
    }
  }

  gateError.textContent = '';
  gateSubmit.disabled = true;
  gateSubmit.textContent = '...';

  try {
    if (isRegister) {
      console.log('📝 Registering new user...');

      // ── Проверяем уникальность username ──
      const { data: taken } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', chosenUsername)
        .maybeSingle();

      if (taken) {
        gateError.textContent = `Никнейм «${chosenUsername}» уже занят`;
        gateUsername.focus();
        return;
      }

      // ── Сохраняем выбранный username чтобы loadUserProfile его подхватил ──
      localStorage.setItem('englift_pending_username', chosenUsername);

      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      if (data.user) {
        // Показываем блок неподтверждённого email
        showEmailNotVerified(data.user.email);
        // Можно также показать toast для дополнительного внимания
        window.toast?.(
          '📧 Письмо для подтверждения отправлено. Проверьте почту (и папку "Спам").',
          'success',
        );
      }
      clearGateForm();
    } else {
      console.log('🔐 Signing in user...');
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      console.log('✅ Sign in successful');
      clearGateForm();
      hideAuthGate(); // ← только при логине
    }
  } catch (err) {
    console.log('❌ Auth error:', err);
    const msgs = {
      email_already_exists: 'Этот email уже занят',
      invalid_email: 'Неверный формат email',
      weak_password: 'Пароль слишком короткий (мин. 6 символов)',
      invalid_credentials: 'Неверный email или пароль',
    };
    gateError.textContent = msgs[err.message] || err.message;
    localStorage.removeItem('englift_pending_username'); // сбрасываем если ошибка
  } finally {
    gateSubmit.disabled = false;
    gateSubmit.textContent = isRegister ? 'Создать аккаунт' : 'Войти';
  }
}

// Обработчик кнопки отправки
gateSubmit.addEventListener('click', () => {
  console.log('🔑 Login button clicked');
  // console.log('📧 Email:', gateEmail.value.trim());
  // console.log('🔑 Password:', gatePassword.value.trim() ? '***' : 'empty');
  console.log('📝 Mode:', isRegisterMode ? 'register' : 'login');

  handleAuth(
    gateEmail.value.trim(),
    gatePassword.value.trim(),
    gateConfirm.value.trim(),
    isRegisterMode,
  );
});

// Забыли пароль
forgotPasswordBtn.addEventListener('click', () => {
  resetModal.classList.add('open');
  resetEmail.focus();
});

sendResetBtn.addEventListener('click', async () => {
  const email = resetEmail.value.trim();
  if (!email) {
    window.toast?.('Введите email', 'warning');
    return;
  }
  sendResetBtn.disabled = true;
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
    window.toast?.(
      'Письмо для сброса пароля отправлено! Проверьте почту.',
      'success',
    );
    resetModal.classList.remove('open');
  } catch (err) {
    window.toast?.(err.message, 'danger');
  } finally {
    sendResetBtn.disabled = false;
  }
});

cancelResetBtn.addEventListener('click', () =>
  resetModal.classList.remove('open'),
);

// Выход
dropdownLogout.addEventListener('click', async () => {
  isExplicitLogoutPending = true;

  console.log('🚪 Начинаем выход...');

  // 1. Синхронизируем слова
  if (window.currentUserId && navigator.onLine) {
    try {
      await window.syncPendingWords?.();
    } catch (e) {}
  }

  // 2. Синхронизируем профиль ПРЯМО СЕЙЧАС
  if (window.currentUserId && navigator.onLine) {
    console.log('💾 Принудительно сохраняем профиль перед выходом...');
    await window.syncProfileToServer?.();
  }

  window.currentUserId = null;
  profileLoaded = false;
  // isProfileLoading = false; // удалено - переменная не определена
  // lastLoadedUserId = null; // удалено - переменная не определена

  await supabase.auth.signOut();
});

// Меню пользователя
userMenu.addEventListener('mouseenter', () => {
  clearTimeout(hideTimeout);
  userDropdown.style.display = 'block';
});
userMenu.addEventListener('mouseleave', () => {
  hideTimeout = setTimeout(() => {
    userDropdown.style.display = 'none';
  }, 200);
});
userDropdown.addEventListener('mouseenter', () => clearTimeout(hideTimeout));
userDropdown.addEventListener(
  'mouseleave',
  () => (userDropdown.style.display = 'none'),
);

// Глобальный флаг
let profileLoaded = false;
let wordsLoaded = false; // Добавляем флаг для однократной загрузки слов
let profileLoadPromise = null; // Добавляем промис-флаг
let lastProfileLoadTime = 0; // Добавляем время последней загрузки

// Следим за состоянием аутентификации
supabase.auth.onAuthStateChange(async (event, session) => {
  console.log(
    '🔐 Auth state changed:',
    event,
    session?.user?.id || 'no user',
    'at',
    new Date().toISOString(),
  );
  console.log('🔐 Session details:', {
    hasSession: !!session,
    userId: session?.user?.id,
    emailConfirmed: !!session?.user?.email_confirmed_at,
    expiresAt: session?.expires_at,
    device: navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop',
  });

  // Сохраняем токен доступа для использования в syncSaveProfile
  window.currentAccessToken = session?.access_token || null;

  const user = session?.user;

  // === ЗАПУСК ПРОФИЛЯ ===
  if (
    event === 'INITIAL_SESSION' &&
    user &&
    user.email_confirmed_at &&
    !profileLoaded &&
    !profileLoadPromise
  ) {
    profileLoadPromise = loadUserProfile(user).finally(() => {
      profileLoaded = true;
      profileLoadPromise = null;
      lastProfileLoadTime = Date.now(); // Update load time
    });
  } else if (
    event === 'SIGNED_IN' &&
    user &&
    user.email_confirmed_at &&
    !profileLoaded &&
    !profileLoadPromise
  ) {
    console.log('⚠️ INITIAL_SESSION был пустым → загружаем по SIGNED_IN');
    profileLoadPromise = loadUserProfile(user).finally(() => {
      profileLoaded = true;
      profileLoadPromise = null;
      lastProfileLoadTime = Date.now(); // Update load time
    });
  } else if (event === 'TOKEN_REFRESHED' && user) {
    console.log(
      '✅ TOKEN_REFRESHED — профиль не перезагружаем (избегаем бага #4)',
    );
    // Ничего не делаем - профиль уже загружен
  } else if (event === 'SIGNED_IN') {
    console.log('SIGNED_IN пришёл — профиль уже загружен или загружается');

    // Add frequency check to prevent excessive reloads
    if (profileLoaded && Date.now() - lastProfileLoadTime < 5000) {
      console.log('⏳ Пропускаем частую загрузку профиля');
      return;
    }
  }

  // === ОБНОВЛЕНИЕ UI ===
  if (user && user.email_confirmed_at) {
    hideEmailNotVerified();
    hideAuthGate();
    document.body.classList.add('authenticated');
    dropdownEmail.textContent = user.email;
    userAvatar.innerHTML =
      '<span class="material-symbols-outlined">person</span>';

    window.renderBadges?.();

    // Загружаем слова ТОЛЬКО если профиль уже загружен и слова еще не загружены
    if (profileLoaded && !wordsLoaded) {
      wordsLoaded = true;
      window.authExports?.loadWordsOnce(remoteWords => {
        console.log(
          `🔄 Автосинхронизация: локально ${window.words?.length || 0} → сервер ${remoteWords?.length || 0}`,
        );

        // Умный мерж: сохраняем офлайн слова, но удаляем те что нет на сервере
        const localWords = window.words || [];
        const merged = window.mergeWords
          ? window.mergeWords(localWords, remoteWords)
          : remoteWords;
        window.words = merged.map(word =>
          typeof word === 'object'
            ? window.normalizeWord?.(word) || word
            : word,
        );
        localStorage.setItem('englift_words', JSON.stringify(window.words));
        if (window.refreshUI) window.refreshUI();

        console.log(`✅ Синхронизация завершена: ${merged.length} слов`);
      });
    }
  } else if (user && !user.email_confirmed_at) {
    hideAuthGate();
    document.body.classList.remove('authenticated');
    showEmailNotVerified(user.email);
  } else if (event === 'SIGNED_OUT') {
    console.log('🚪 SIGNED_OUT event received', 'at', new Date().toISOString());
    console.log('🚪 SIGNED_OUT details:', {
      device: navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop',
      timestamp: new Date().toISOString(),
      reason: 'User clicked logout or session expired',
      wasExplicit: isExplicitLogoutPending,
    });

    const wasExplicit = isExplicitLogoutPending;
    isExplicitLogoutPending = false; // Сбрасываем флаг

    // Сбрасываем флаги загрузки
    profileLoaded = false;
    wordsLoaded = false; // Сбрасываем флаг слов

    hideEmailNotVerified();
    showAuthGate();
    document.body.classList.remove('authenticated');

    // Скрыть индикатор загрузки, если он висит
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) loadingIndicator.style.display = 'none';

    // Закрыть все открытые модалки
    document
      .querySelectorAll('.modal-backdrop.open')
      .forEach(m => m.classList.remove('open'));

    window.clearUserData?.(wasExplicit); // Очищаем localStorage только при явном выходе
    dropdownEmail.textContent = '';
    userAvatar.innerHTML =
      '<span class="material-symbols-outlined">person</span>';
    console.log('🚪 SIGNED_OUT processing completed');
  } else {
    hideEmailNotVerified();
    showAuthGate();
    document.body.classList.remove('authenticated');
    dropdownEmail.textContent = '';
    userAvatar.innerHTML =
      '<span class="material-symbols-outlined">person</span>';
    window.clearUserData?.();
  }
});

// Повторная отправка подтверждения
resendEmailBtn.addEventListener('click', async () => {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    if (user) {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
      });
      if (error) window.toast?.('Ошибка: ' + error.message, 'danger');
      else window.toast?.('Письмо отправлено на ' + user.email, 'success');
    } else {
      window.toast?.('Пользователь не найден', 'warning');
    }
  } catch (error) {
    console.warn('Ошибка при повторной отправке email:', error.message);
    window.toast?.('Ошибка сети при отправке email', 'danger');
  }
});

// Функция загрузки профиля (простая версия)
async function loadUserProfile(user) {
  if (!user) return;
  window.currentUserId = user.id;

  try {
    const { data: serverProfile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    console.log('📥 Server profile from DB:', serverProfile);
    if (serverProfile) console.table(serverProfile);

    if (!serverProfile) {
      // Создаём новый профиль
      const today = new Date().toISOString().split('T')[0];

      // Используем выбранный username или генерируем из email
      const savedUsername = localStorage.getItem('englift_pending_username');
      const username =
        savedUsername ||
        user.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '') +
          Math.floor(Math.random() * 1000);
      localStorage.removeItem('englift_pending_username'); // чистим сразу после использования

      const defaultProfile = {
        username: username,
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
        usersettings: {},
        darktheme: false,
      };
      await saveUserData(user.id, defaultProfile);
      window.applyProfileData?.(defaultProfile);
    } else {
      window.applyProfileData?.(serverProfile);
    }
  } catch (err) {
    console.error('Ошибка загрузки профиля:', err);
    window.toast?.('Не удалось загрузить профиль', 'danger');
  } finally {
    // Вызываем колбэк, что профиль загружен
    window.onProfileFullyLoaded?.();
  }
}

// Обработчики для кнопок
resendEmailBtn.addEventListener('click', async () => {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    if (user) {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
      });
      if (error) window.toast?.('Ошибка: ' + error.message, 'danger');
      else window.toast?.('Письмо отправлено на ' + user.email, 'success');
    } else {
      window.toast?.('Пользователь не найден', 'warning');
    }
  } catch (error) {
    console.warn('Ошибка при повторной отправке email:', error.message);
    window.toast?.('Ошибка сети при отправке email', 'danger');
  }
});

logoutFromUnverifiedBtn.addEventListener('click', () => {
  window.currentUserId = null;
  profileLoaded = false;
  supabase.auth.signOut();
});

// Немедленная проверка сессии при загрузке
(async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.user && session.user.email_confirmed_at) {
    document.body.classList.add('authenticated');
    hideAuthGate();
  }
})();
