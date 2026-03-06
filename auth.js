import { supabase } from './supabase.js';
import { saveUserData } from './db.js';

// Флаг для защиты от ранних сохранений
let profileFullyLoaded = false;
window.profileFullyLoaded = false; // Делаем доступным глобально

// DOM элементы (оставляем те же)
const authGate = document.getElementById('auth-gate');
const gateEmail = document.getElementById('gate-email');
const gatePassword = document.getElementById('gate-password');
const gateConfirm = document.getElementById('gate-confirm-password');
const gateConfirmGroup = document.getElementById('gate-confirm-group');
const gateSubmit = document.getElementById('gate-submit-btn');
const gateToggle = document.getElementById('gate-toggle-btn');
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

function toggleConfirmPassword(show) {
  if (show) {
    gateConfirmGroup.style.display = 'block';
  } else {
    gateConfirmGroup.style.display = 'none';
    gateConfirm.value = '';
  }
}

function clearGateForm() {
  gateEmail.value = '';
  gatePassword.value = '';
  gateConfirm.value = '';
  gateError.textContent = '';
}

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
  gateError.textContent = '';
  gateSubmit.disabled = true;
  gateSubmit.textContent = '...';

  try {
    if (isRegister) {
      console.log('📝 Registering new user...');
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      if (data.user) {
        // Создаём профиль в таблице profiles
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({ id: data.user.id });
        if (profileError)
          console.error('Error creating profile:', profileError);
        window.toast?.(
          '📧 Письмо для подтверждения отправлено на ваш email. Проверьте почту (и папку "Спам").',
          'success',
        );
      }
    } else {
      console.log('🔐 Signing in user...');
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      console.log('✅ Sign in successful');
    }
    clearGateForm();
    hideAuthGate(); // Теперь правильно скроет с сбросом инлайн-стиля
  } catch (err) {
    console.log('❌ Auth error:', err);
    const msgs = {
      email_already_exists: 'Этот email уже занят',
      invalid_email: 'Неверный формат email',
      weak_password: 'Пароль слишком короткий (мин. 6 символов)',
      invalid_credentials: 'Неверный email или пароль',
    };
    gateError.textContent = msgs[err.message] || err.message;
  } finally {
    gateSubmit.disabled = false;
    gateSubmit.textContent = isRegister ? 'Создать аккаунт' : 'Войти';
  }
}

// Переключение режима (вход/регистрация)
gateToggle.addEventListener('click', () => {
  isRegisterMode = !isRegisterMode;
  gateSubmit.textContent = isRegisterMode ? 'Создать аккаунт' : 'Войти';
  gateToggle.textContent = isRegisterMode
    ? 'Уже есть аккаунт? Войти'
    : 'Нет аккаунта? Зарегистрироваться';
  toggleConfirmPassword(isRegisterMode);
  gateError.textContent = '';
});

// Обработчик кнопки отправки
gateSubmit.addEventListener('click', () => {
  console.log('🔑 Login button clicked');
  console.log('📧 Email:', gateEmail.value.trim());
  console.log('🔑 Password:', gatePassword.value.trim() ? '***' : 'empty');
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
  window.currentUserId = null; // Очищаем ID пользователя
  profileLoaded = false; // Сбрасываем флаг загрузки профиля
  isProfileLoading = false; // Сбрасываем флаг загрузки
  lastLoadedUserId = null; // Сбрасываем ID последнего загруженного пользователя
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
let profileLoadPromise = null; // Добавляем промис-флаг

// Следим за состоянием аутентификации
supabase.auth.onAuthStateChange(async (event, session) => {
  console.log('🔐 Auth state changed:', event, session?.user?.id || 'no user');

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
    });
  } else if (event === 'TOKEN_REFRESHED' && user) {
    console.log('✅ TOKEN_REFRESHED — обновляем профиль');
    await loadUserProfile(user);
  } else if (event === 'SIGNED_IN') {
    console.log('SIGNED_IN пришёл — профиль уже загружен или загружается');
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

    // Загружаем слова ТОЛЬКО если профиль уже загружен
    if (profileLoaded) {
      window.authExports?.loadWordsOnce(remoteWords => {
        const localWords = window.words || [];
        const merged = window.mergeWords
          ? window.mergeWords(localWords, remoteWords)
          : remoteWords;
        window.words = merged;
        localStorage.setItem('englift_words', JSON.stringify(window.words));

        // НЕ вызываем рендер здесь - loadUserProfile сделает это через onProfileFullyLoaded
        console.log(
          '📚 Слова загружены, рендер будет через onProfileFullyLoaded',
        );
      });
    }
  } else if (user && !user.email_confirmed_at) {
    hideAuthGate();
    document.body.classList.remove('authenticated');
    showEmailNotVerified(user.email);
  } else if (event === 'SIGNED_OUT') {
    console.log('🚪 SIGNED_OUT event received');
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

    // window.clearUserData?.();  // ← закомментировано - не нужно при выходе
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
    // window.clearUserData?.();  // ← закомментировано - не нужно при выходе
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

logoutFromUnverifiedBtn.addEventListener('click', () => {
  window.currentUserId = null; // Очищаем ID пользователя
  profileLoaded = false; // Сбрасываем флаг загрузки профиля
  isProfileLoading = false; // Сбрасываем флаг загрузки
  lastLoadedUserId = null; // Сбрасываем ID последнего загруженного пользователя
  supabase.auth.signOut();
});

// Защита от повторных вызовов загрузки профиля
let isProfileLoading = false;
let lastLoadedUserId = null;

// Функция загрузки профиля (будет использоваться внутри)
async function loadUserProfile(user) {
  if (!user || !user.id) {
    console.warn('loadUserProfile: нет пользователя');
    return;
  }

  if (isProfileLoading || lastLoadedUserId === user.id) {
    console.log(
      ' Профиль уже загружается / загружен для этого пользователя - ПРОПУСКАЕМ',
    );
    return;
  }

  isProfileLoading = true;
  lastLoadedUserId = user.id;
  window.currentUserId = user.id; // Устанавливаем глобальный ID пользователя

  try {
    console.log(' loadUserProfile для', user.id);

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    // Профиль не найден – создаём и сразу сохраняем локальные данные
    if (error && error.code === 'PGRST116') {
      console.log(' Профиль не найден, создаём новый');
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({ id: user.id });
      if (insertError) {
        console.error('Error creating profile:', insertError);
        return;
      }

      // Сохраняем текущие локальные данные (если есть)
      const initialData = {
        xp: window.xpData?.xp || 0,
        level: window.xpData?.level || 1,
        badges: window.xpData?.badges || [],
        streak: window.streak?.count || 0,
        last_streak_date: window.streak?.lastDate || null,
        daily_progress: window.dailyProgress || {
          add_new: 0,
          review: 0,
          practice_time: 0,
          completed: false,
          lastReset: new Date().toISOString().split('T')[0],
        },
        today_reviewed_count: window.todayReviewedCount || 0,
        last_reviewed_reset: window.lastReviewedReset || null,
        speech_cfg: window.speech_cfg || {},
        user_settings: window.user_settings || {},
        dark_theme:
          document.documentElement.classList.contains('dark') || false,
      };
      await saveUserData(user.id, initialData);
      console.log(' Профиль создан и заполнен локальными данными');

      // Загружаем слова (если ещё не загружены)
      window.authExports.loadWordsOnce(remoteWords => {
        const localWords = window.words || [];
        const merged = window.mergeWords
          ? window.mergeWords(localWords, remoteWords)
          : remoteWords;
        window.words = merged;
        localStorage.setItem('englift_words', JSON.stringify(window.words));

        if (window.refreshUI) {
          window.refreshUI();
        } else {
          window.renderWords?.();
          window.renderStats?.();
          window.updateDueBadge?.();
        }
      });

      return;
    }

    if (error) {
      console.error('Error loading profile:', error);
      return;
    }

    if (data) {
      console.log(' Данные профиля загружены:', data);

      // Умное слияние по updated_at
      const serverUpdated = data.updated_at
        ? new Date(data.updated_at).getTime()
        : 0;
      const localUpdated = window.lastProfileUpdate || 0;

      console.log('🔄 Сравнение времени обновления профиля:');
      console.log('  Сервер:', new Date(serverUpdated).toISOString());
      console.log('  Локально:', new Date(localUpdated).toISOString());

      if (serverUpdated > localUpdated) {
        // Серверные данные новее – применяем их
        console.log('🔄 Профиль на сервере новее, обновляем локальные данные');

        window.updateXpData?.({
          xp: data.xp || 0,
          level: data.level || 1,
          badges: data.badges || [],
        });

        window.updateStreak?.({
          count: data.streak || 0,
          lastDate: data.last_streak_date || null,
        });

        if (data.daily_progress) {
          window.updateDailyProgress?.(data.daily_progress);
        }

        window.todayReviewedCount = data.today_reviewed_count ?? 0;
        window.lastReviewedReset = data.last_reviewed_reset;

        // Объединение настроек речи
        if (data.speech_cfg) {
          window.speech_cfg = { ...window.speech_cfg, ...data.speech_cfg };
          console.log(' Настройки речи объединены:', window.speech_cfg);
        }

        // Объединение пользовательских настроек
        if (data.user_settings) {
          window.user_settings = {
            ...window.user_settings,
            ...data.user_settings,
          };
          console.log(
            ' Пользовательские настройки объединены:',
            window.user_settings,
          );
        }

        // НЕ применяем тему здесь - она применится в onProfileFullyLoaded
        localStorage.setItem('engliftDark', data.dark_theme ?? false);

        // Обновляем время последнего обновления
        window.lastProfileUpdate = serverUpdated;
      } else {
        // Локальные данные новее – отправляем их на сервер
        console.log('🔄 Локальные данные новее, сохраняем профиль');
        if (window.immediateSaveAllUserData) {
          await window.immediateSaveAllUserData();
        }
      }

      // Загрузка слов из Supabase
      window.authExports.loadWordsOnce(remoteWords => {
        const localWords = window.words || [];
        const merged = window.mergeWords
          ? window.mergeWords(localWords, remoteWords)
          : remoteWords;
        window.words = merged;
        localStorage.setItem('englift_words', JSON.stringify(window.words));

        if (window.refreshUI) {
          window.refreshUI();
        } else {
          window.renderWords?.();
          window.renderStats?.();
          window.updateDueBadge?.();
        }
      });
    }
  } catch (err) {
    console.error('Ошибка в loadUserProfile:', err);
  } finally {
    isProfileLoading = false;
  }

  window.onProfileFullyLoaded?.();
  profileFullyLoaded = true;
  window.profileFullyLoaded = true;
}

// Инициализация при загрузке страницы
(async () => {
  console.log(' Начинаем инициализацию auth...');

  const {
    data: { session },
  } = await supabase.auth.getSession();
  console.log(' getSession вернул:', session ? session.user.id : 'null');

  if (session?.user && session.user.email_confirmed_at) {
    console.log(' Есть активная сессия при старте - ждем onAuthStateChange');
    // Не загружаем профиль здесь - onAuthStateChange сделает это
  } else {
    console.log(' Нет активной сессии при старте');
  }
})();
