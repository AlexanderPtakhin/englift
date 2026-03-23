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

// ===== ПРОВЕРКА EMAIL НА ЛЕТУ (через Edge Function) =====
let emailCheckDebounceTimer = null;
let isEmailTaken = false;
let lastCheckedEmail = '';

// Функция проверки email
async function checkEmailAvailability(email) {
  if (!email) return false;

  // Показываем спиннер
  const spinner = document.getElementById('email-check-spinner');
  if (spinner) spinner.style.display = 'block';

  try {
    const { data, error } = await supabase.functions.invoke('check-email', {
      body: { email },
    });
    if (error) throw error;
    return data.exists; // true если занят
  } catch (err) {
    console.warn('Ошибка проверки email:', err);
    // При ошибке не блокируем регистрацию, считаем что email свободен
    return false;
  } finally {
    // Скрываем спиннер
    if (spinner) spinner.style.display = 'none';
  }
}

// Обновление UI сообщения о занятости email
function updateEmailAvailabilityStatus(taken) {
  if (!isRegisterMode) {
    // В режиме входа не блокируем кнопку, даже если email занят
    return;
  }
  isEmailTaken = taken;
  const errorEl = document.getElementById('gate-error');
  if (taken) {
    errorEl.textContent =
      'Этот email уже зарегистрирован. Войдите или используйте другой.';
  } else if (errorEl.textContent.includes('уже зарегистрирован')) {
    errorEl.textContent = '';
  }
  const submitBtn = document.getElementById('gate-submit-btn');
  if (submitBtn) {
    submitBtn.disabled = taken;
    submitBtn.style.opacity = taken ? '0.5' : '1';
  }
}
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

  // Сбрасываем состояние проверки email (только если не в обработчике табов)
  const spinner = document.getElementById('email-check-spinner');
  if (spinner) spinner.style.display = 'none';

  // НЕ удаляем pending_username - он нужен для loadUserProfile
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

    // ===== НОВЫЙ КОД: сброс проверки email =====
    isEmailTaken = false;
    lastCheckedEmail = '';
    // Разблокируем кнопку (на случай если она была заблокирована из-за занятого email)
    gateSubmit.disabled = false;
    gateSubmit.style.opacity = '1';
    // Убираем сообщение об ошибке, если оно было от проверки email
    if (gateError.textContent.includes('уже зарегистрирован')) {
      gateError.textContent = '';
    }
    // Скрываем спиннер
    const spinner = document.getElementById('email-check-spinner');
    if (spinner) spinner.style.display = 'none';
    // ============================================
  });
});

// Проверка email при вводе (только в режиме регистрации)
gateEmail.addEventListener('input', () => {
  if (!isRegisterMode) return; // только при регистрации
  const email = gateEmail.value.trim();

  // Базовая валидация формата
  const isValidEmail = /^[^\s@]+@([^\s@]+\.)+[^\s@]+$/.test(email);
  if (!isValidEmail && email) {
    gateError.textContent = 'Введите корректный email';
    isEmailTaken = false;
    // разблокируем кнопку, если она была заблокирована
    const submitBtn = document.getElementById('gate-submit-btn');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.style.opacity = '1';
    }
    return;
  } else if (
    isValidEmail &&
    gateError.textContent === 'Введите корректный email'
  ) {
    gateError.textContent = '';
  }

  // Отменяем предыдущий таймер
  if (emailCheckDebounceTimer) clearTimeout(emailCheckDebounceTimer);
  if (!email) {
    updateEmailAvailabilityStatus(false);
    lastCheckedEmail = '';
    return;
  }

  // Если email не изменился с последней проверки, не проверяем повторно
  if (email === lastCheckedEmail) return;
  lastCheckedEmail = email;

  // Показываем индикатор загрузки (можно добавить спиннер)
  // (опционально) добавить элемент рядом с полем

  emailCheckDebounceTimer = setTimeout(async () => {
    const taken = await checkEmailAvailability(email);
    updateEmailAvailabilityStatus(taken);
  }, 500); // задержка 500 мс
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
async function handleAuth(email, password, confirm, isRegister, username) {
  console.log('🚀 handleAuth called with:', {
    email,
    hasPassword: !!password,
    isRegister,
    username,
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
  if (isRegister) {
    if (!username) {
      gateError.textContent = 'Введи имя пользователя';
      gateUsername.focus();
      return;
    }
    if (!/^[a-zA-Z0-9_-]{3,20}$/.test(username)) {
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

      // Проверка занятости email перед регистрацией
      if (isEmailTaken) {
        gateError.textContent =
          'Этот email уже зарегистрирован. Войдите или используйте другой.';
        return;
      }

      // ── Проверяем уникальность username ──
      const { data: taken } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .maybeSingle();

      if (taken) {
        gateError.textContent = `Никнейм «${username}» уже занят`;
        gateUsername.focus();
        return;
      }

      // ── Сохраняем выбранный username чтобы loadUserProfile его подхватил ──
      console.log('💾 Сохраняем pending_username:', username);
      localStorage.setItem('englift_pending_username', username);
      console.log(
        '✅ pending_username сохранён, проверка:',
        localStorage.getItem('englift_pending_username'),
      );

      // Сохраняем invite, если есть
      captureInviteFromUrl();

      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      if (data.user) {
        showEmailNotVerified(data.user.email);
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
    console.log(
      '❌ До удаления pending_username:',
      localStorage.getItem('englift_pending_username'),
    );
    const msgs = {
      email_already_exists: 'Этот email уже занят',
      invalid_email: 'Неверный формат email',
      weak_password: 'Пароль слишком короткий (мин. 6 символов)',
      invalid_credentials: 'Неверный email или пароль',
      'Invalid login credentials': 'Неверный email или пароль',
      'Invalid email credentials': 'Неверный email или пароль',
      'User already registered': 'Пользователь уже зарегистрирован',
      'Password should be at least 6 characters':
        'Пароль должен быть минимум 6 символов',
      'Unable to validate email address: invalid format':
        'Неверный формат email',
      'Email not confirmed': 'Email не подтверждён',
      'Invalid password': 'Неверный пароль',
      'User not found': 'Пользователь не найден',
    };

    // Если есть прямой перевод - используем его, иначе пробуем универсальный перевод
    let errorMessage = msgs[err.message];
    if (!errorMessage) {
      // Универсальный перевод для английских сообщений
      errorMessage = err.message
        .replace(/Invalid login credentials/g, 'Неверный email или пароль')
        .replace(/Invalid email credentials/g, 'Неверный email или пароль')
        .replace(/User already registered/g, 'Пользователь уже зарегистрирован')
        .replace(
          /Password should be at least \d+ characters/g,
          'Пароль должен быть минимум 6 символов',
        )
        .replace(
          /Unable to validate email address: invalid format/g,
          'Неверный формат email',
        )
        .replace(/Email not confirmed/g, 'Email не подтверждён')
        .replace(/Invalid password/g, 'Неверный пароль')
        .replace(/User not found/g, 'Пользователь не найден')
        .replace(/email_already_exists/g, 'Этот email уже занят')
        .replace(/invalid_email/g, 'Неверный формат email')
        .replace(/weak_password/g, 'Пароль слишком короткий (мин. 6 символов)');
    }

    gateError.textContent = errorMessage || err.message;
    localStorage.removeItem('englift_pending_username'); // сбрасываем если ошибка
    console.log(
      '❌ После удаления pending_username:',
      localStorage.getItem('englift_pending_username'),
    );
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
    gateUsername.value.trim(),
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
      'Если такой email зарегистрирован, мы отправили ссылку для сброса пароля.',
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

  // Синхронизируем слова и профиль, но не блокируем выход, если ошибка
  try {
    if (window.currentUserId && navigator.onLine) {
      await Promise.allSettled([
        window.syncPendingWords?.() || Promise.resolve(),
        window.syncProfileToServer?.() || Promise.resolve(),
      ]);
      console.log('✅ Данные синхронизированы перед выходом');
    }
  } catch (e) {
    console.warn('⚠️ Ошибка при синхронизации, но выход продолжается', e);
  } finally {
    window.currentUserId = null;
    profileLoaded = false;
    // isProfileLoading = false; // удалено - переменная не определена
    // lastLoadedUserId = null; // удалено - переменная не определена

    await supabase.auth.signOut();
  }
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
  const shouldLoadProfile =
    user && user.email_confirmed_at && !profileLoaded && !profileLoadPromise;

  if (shouldLoadProfile) {
    // Если уже есть активный promise – не создаём новый
    if (!profileLoadPromise) {
      console.log('🔄 Загружаем профиль...');
      profileLoadPromise = loadUserProfile(user).finally(() => {
        profileLoaded = true;
        profileLoadPromise = null;
        lastProfileLoadTime = Date.now();
      });
    }
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

    // Проверяем инвайты для залогиненных пользователей
    setTimeout(() => checkPendingInviteFromUrl(), 1000);

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

  // Читаем pending_username
  const savedUsername = localStorage.getItem('englift_pending_username');
  console.log('🔍 loadUserProfile: savedUsername =', savedUsername);

  // Защита от рекурсии
  if (window._profileLoadInProgress) {
    console.warn('⚠️ Загрузка профиля уже выполняется, пропускаем');
    return;
  }
  window._profileLoadInProgress = true;

  window.currentUserId = user.id;

  try {
    const { data: serverProfile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;

    console.log('📥 Server profile from DB:', serverProfile);
    if (serverProfile) console.table(serverProfile);

    if (!serverProfile) {
      // Создаём новый профиль
      const today = new Date().toISOString().split('T')[0];

      // Используем уже существующую переменную savedUsername (из начала функции)
      const username =
        savedUsername ||
        user.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '') +
          Math.floor(Math.random() * 1000);
      console.log('🔍 Итоговый username для нового профиля:', username);
      localStorage.removeItem('englift_pending_username'); // чистим сразу после использования
      console.log('✅ pending_username удалён после использования');

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

      // Применяем инвайт, если есть
      const pendingInvite = localStorage.getItem('englift_pending_invite');
      if (pendingInvite) {
        await applyInvite(pendingInvite, user.id);
        localStorage.removeItem('englift_pending_invite');
      }
    } else {
      // Профиль уже существует – проверим, нужно ли обновить username
      if (savedUsername && savedUsername !== serverProfile.username) {
        console.log(
          `🔄 Обновляем username с "${serverProfile.username}" на "${savedUsername}"`,
        );
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ username: savedUsername })
          .eq('id', user.id);
        if (updateError) {
          console.error('Ошибка обновления username:', updateError);
        } else {
          // Успешно обновили, обновляем объект профиля
          serverProfile.username = savedUsername;
          console.log('✅ Username успешно обновлён на:', savedUsername);
        }
        // Удаляем pending_username после использования
        localStorage.removeItem('englift_pending_username');
      }
      window.applyProfileData?.(serverProfile);
    }
  } catch (err) {
    console.error('Ошибка загрузки профиля:', err);
    window.toast?.('Не удалось загрузить профиль', 'danger');
  } finally {
    // Всегда очищаем флаг загрузки
    window._profileLoadInProgress = false;
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

// ===== INVITE HANDLING =====

// Сохраняем invite ID при регистрации
function captureInviteFromUrl() {
  const inviteId = new URLSearchParams(location.search).get('invite');
  if (inviteId) {
    localStorage.setItem('englift_pending_invite', inviteId);
  }
}

// Применяем инвайт после создания профиля
async function applyInvite(inviteId, newUserId) {
  try {
    // Получаем данные инвайта
    const { data: invite, error } = await supabase
      .from('invites')
      .select('inviter_id, uses')
      .eq('id', inviteId)
      .maybeSingle();

    if (error || !invite) return;
    if (invite.inviter_id === newUserId) return; // сам себя не добавляем

    // Проверяем, не друзья ли уже
    const { data: existing } = await supabase
      .from('friendships')
      .select('id')
      .or(
        `user_id.eq.${invite.inviter_id},friend_id.eq.${invite.inviter_id},user_id.eq.${newUserId},friend_id.eq.${newUserId}`,
      )
      .maybeSingle();

    if (existing) return;

    // Создаём дружбу в обе стороны
    await supabase.from('friendships').insert([
      { user_id: invite.inviter_id, friend_id: newUserId, status: 'accepted' },
      { user_id: newUserId, friend_id: invite.inviter_id, status: 'accepted' },
    ]);

    // Увеличиваем счётчик использований
    await supabase
      .from('invites')
      .update({ uses: (invite.uses || 0) + 1 })
      .eq('id', inviteId);

    console.log(`✅ Invite applied: ${inviteId}`);

    // Обновляем UI друзей если пользователь уже залогинен
    if (window.currentUserId) {
      if (typeof loadLeaderboard === 'function') loadLeaderboard('week');
      if (typeof loadFriendActivity === 'function') loadFriendActivity();
      if (typeof loadFriendsDataNew === 'function') loadFriendsDataNew();
    }
  } catch (e) {
    console.warn('applyInvite error:', e);
  }
}

// ===== ОБРАБОТКА ИНВАЙТОВ ДЛЯ ЗАЛОГИНЕННЫХ ПОЛЬЗОВАТЕЛЕЙ =====

async function checkPendingInviteFromUrl() {
  const inviteId = new URLSearchParams(location.search).get('invite');
  if (!inviteId || !window.currentUserId) return;

  // Убираем параметр из URL без перезагрузки
  const cleanUrl = location.origin + location.pathname;
  window.history.replaceState({}, '', cleanUrl);

  try {
    // Получаем данные инвайта
    const { data: invite, error } = await supabase
      .from('invites')
      .select('inviter_id, profiles(username)')
      .eq('id', inviteId)
      .maybeSingle();

    if (error || !invite) return;

    // Сам себе не шлём
    if (invite.inviter_id === window.currentUserId) return;

    // Проверяем, не друзья ли уже
    const { data: existing } = await supabase
      .from('friendships')
      .select('id')
      .or(
        `user_id.eq.${window.currentUserId},friend_id.eq.${window.currentUserId},user_id.eq.${invite.inviter_id},friend_id.eq.${invite.inviter_id}`,
      )
      .maybeSingle();

    if (existing) {
      window.toast?.('Вы уже друзья с этим пользователем 😄', 'warning');
      return;
    }

    // Показываем модалку подтверждения
    const inviterName = invite.profiles?.username || 'Пользователь';
    showInviteConfirmModal(inviterName, invite.inviter_id, inviteId);
  } catch (e) {
    console.warn('checkPendingInviteFromUrl error:', e);
  }
}

function showInviteConfirmModal(inviterName, inviterId, inviteId) {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop open';
  modal.innerHTML = `
    <div class="modal-box" style="max-width:380px;text-align:center">
      <div style="font-size:3rem;margin-bottom:0.75rem">👋</div>
      <h3 style="margin-bottom:0.5rem">Заявка в друзья</h3>
      <p style="color:var(--muted);margin-bottom:1.5rem">
        <b style="color:var(--text)">${inviterName}</b> хочет добавить тебя в друзья!
      </p>
      <div style="display:flex;gap:0.75rem">
        <button class="btn btn-primary" style="flex:1" id="invite-accept-btn">
          <span class="material-symbols-outlined">check</span>
          Принять
        </button>
        <button class="btn btn-secondary" style="flex:1" id="invite-decline-btn">
          <span class="material-symbols-outlined">close</span>
          Отклонить
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('invite-accept-btn').onclick = async () => {
    await acceptInviteFriendship(inviterId, inviteId);
    modal.remove();
  };

  document.getElementById('invite-decline-btn').onclick = () => {
    modal.remove();
    window.toast?.('Заявка отклонена', 'warning');
  };
}

async function acceptInviteFriendship(inviterId, inviteId) {
  try {
    // Создаём дружбу в обе стороны
    await supabase.from('friendships').insert([
      {
        user_id: inviterId,
        friend_id: window.currentUserId,
        status: 'accepted',
      },
      {
        user_id: window.currentUserId,
        friend_id: inviterId,
        status: 'accepted',
      },
    ]);

    // Обновляем счётчик использований инвайта
    const { data: inv } = await supabase
      .from('invites')
      .select('uses')
      .eq('id', inviteId)
      .maybeSingle();

    window.toast?.('Вы теперь друзья! 🎉', 'success');

    // Обновляем UI друзей
    await loadFriendsDataNew();
  } catch (e) {
    window.toast?.('Ошибка: ' + e.message, 'danger');
  }
}

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

// Делаем loadUserProfile глобальной для доступа из script.js
window.loadUserProfile = loadUserProfile;
