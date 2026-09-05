import { supabase } from './supabase.js';
import { saveUserData } from './db.js'; // для сохранения профиля при регистрации
import { createClient } from '@supabase/supabase-js';

// Прямой клиент Supabase для сброса пароля (чтобы ссылка генерировалась с правильным доменом)
const directSupabase = createClient(
  'https://mlkrswxakzpbbzwtvzeh.supabase.co',
  'sb_publishable_sX7-Yj4LLnQweRdf3txECA_7GUrRsNu'
);

// Список разрешённых доменов
const allowedDomains = [
  '.ru', '.рф',           // национальные домены
  'yandex.', 'ya.ru',     // Яндекс
  'mail.ru', 'bk.ru', 'inbox.ru', 'list.ru',  // Mail.ru Group
  'rambler.ru', 'lenta.ru', 'ro.ru', 'etel.ru', // Rambler и др.
  'internet.ru', 'com.ru', 'net.ru', 'org.ru', // бесплатные зоны
  'km.ru', 'ng.ru', 'iz.ru', 'rg.ru', 'gazeta.ru', // СМИ
  'peterhost.ru', 'spaceweb.ru', 'nic.ru', // хостинги
  'moskva.ru', 'spb.ru', 'nov.ru', 'sochi.ru' // региональные
];

// Функция проверки российского email
function isRussianEmail(email) {
  const lower = email.toLowerCase();
  return allowedDomains.some(domain => lower.includes(domain));
}

// DOM элементы
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
const resendEmailRegisterBtn = document.getElementById('resend-email-register-btn');

// Поле username
const gateUsername = document.getElementById('gate-username');
const gateUsernameGroup = document.getElementById('gate-username-group');
const gateUsernameHint = document.getElementById('gate-username-hint');
const gatePasswordHint = document.getElementById('gate-password-hint');

// Табы
const authTabs = document.querySelectorAll('.auth-tab');

// Переменные
let isRegisterMode = false;
let emailCheckDebounceTimer = null;
let isEmailTaken = false;
let lastCheckedEmail = '';
let usernameCheckDebounceTimer = null;
let isUsernameTaken = false;
let lastCheckedUsername = '';

// --- Вспомогательные функции ---

function toggleRegisterFields(show) {
  const forgotLink = document.querySelector('.forgot-link');
  if (show) {
    gateConfirmGroup.style.display = 'block';
    gateUsernameGroup.style.display = 'block';
    gatePasswordHint.style.display = 'block';
    // Скрываем "Забыли пароль?" на регистрации
    if (forgotLink) forgotLink.style.display = 'none';
    // Меняем autocomplete для регистрации
    gatePassword.setAttribute('autocomplete', 'new-password');
    // Скрываем индикатор силы пароля при переключении
    const strengthContainer = document.getElementById('password-strength');
    if (strengthContainer) strengthContainer.style.display = 'none';
  } else {
    gateConfirmGroup.style.display = 'none';
    gateConfirm.value = '';
    gateUsernameGroup.style.display = 'none';
    gateUsername.value = '';
    gateUsernameHint.style.color = 'var(--muted)';
    gateUsernameHint.textContent = '3–20 символов: буквы, цифры, _ и -';
    gatePasswordHint.style.display = 'none';
    isUsernameTaken = false;
    lastCheckedUsername = '';
    // Показываем "Забыли пароль?" на входе
    if (forgotLink) forgotLink.style.display = 'block';
    // Меняем autocomplete для входа
    gatePassword.setAttribute('autocomplete', 'current-password');
    // Скрываем индикатор силы пароля
    const strengthContainer = document.getElementById('password-strength');
    if (strengthContainer) strengthContainer.style.display = 'none';
  }
}

function clearGateForm() {
  gateEmail.value = '';
  gatePassword.value = '';
  gateConfirm.value = '';
  gateUsername.value = '';
  gateError.textContent = '';
  const spinner = document.getElementById('email-check-spinner');
  if (spinner) spinner.style.display = 'none';
}

function updateAuthTabs(mode) {
  authTabs.forEach(tab => {
    tab.classList.remove('active');
    if (tab.dataset.mode === mode) {
      tab.classList.add('active');
    }
  });
}

function showEmailNotVerified(email) {
  if (emailNotVerifiedBlock && unverifiedEmailSpan) {
    unverifiedEmailSpan.textContent = email;
    emailNotVerifiedBlock.style.display = 'flex';
    // Добавляем класс .ready для анимации
    setTimeout(() => {
      emailNotVerifiedBlock.classList.add('ready');
    }, 10);
  }
  document.getElementById('auth-gate-container').style.display = 'none';
}

function hideEmailNotVerified() {
  if (emailNotVerifiedBlock) emailNotVerifiedBlock.style.display = 'none';
  document.getElementById('auth-gate-container').style.display = 'block';
}

// Проверка email на занятость (возвращает объект с exists и confirmed)
async function checkEmailAvailability(email) {
  if (!email) return { exists: false, confirmed: false };
  const spinner = document.getElementById('email-check-spinner');
  if (spinner) spinner.style.display = 'block';
  try {
    const { data, error } = await supabase.functions.invoke('check-email', {
      body: { email },
    });
    if (error) throw error;
    return { exists: data.exists, confirmed: data.confirmed || false };
  } catch (err) {
    console.warn('Ошибка проверки email:', err);
    return { exists: false, confirmed: false };
  } finally {
    if (spinner) spinner.style.display = 'none';
  }
}

// Отправка повторного письма подтверждения
async function resendConfirmationEmail(email) {
  try {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
    });
    if (error) throw error;
    toast('Письмо отправлено на ' + email, 'success', 'mail');
  } catch (err) {
    toast('Ошибка отправки: ' + err.message, 'danger', 'error');
  }
}

// Проверка силы пароля
function checkPasswordStrength(password) {
  let strength = 0;
  let requirements = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%]/.test(password)
  };
  
  // Считаем выполненные требования
  const metRequirements = Object.values(requirements).filter(Boolean).length;
  
  // Определяем уровень на основе выполненных требований
  if (metRequirements === 0) return 0;
  if (metRequirements === 1) return 1;
  if (metRequirements === 2) return 1;
  if (metRequirements === 3) return 2;
  if (metRequirements === 4) return 3;
  if (metRequirements === 5) return 4;
  
  return Math.min(strength, 4);
}

// Обновление индикатора силы пароля
function updatePasswordStrengthIndicator(password) {
  const strengthContainer = document.getElementById('password-strength');
  const strengthBar = document.getElementById('password-strength-bar');
  const strengthText = document.getElementById('password-strength-text');
  
  if (!isRegisterMode || !password) {
    if (strengthContainer) strengthContainer.style.display = 'none';
    return;
  }
  
  if (strengthContainer) strengthContainer.style.display = 'block';
  
  const strength = checkPasswordStrength(password);
  const levels = [
    { text: 'Очень слабый', color: 'var(--danger)', width: '25%' },
    { text: 'Слабый', color: 'var(--warning)', width: '50%' },
    { text: 'Средний', color: '#f59e0b', width: '75%' },
    { text: 'Сильный', color: 'var(--success)', width: '100%' }
  ];
  
  const level = levels[Math.min(strength, 3)];
  
  if (strengthBar) {
    strengthBar.style.width = level.width;
    strengthBar.style.background = level.color;
  }
  
  if (strengthText) {
    strengthText.textContent = level.text;
    strengthText.style.color = level.color;
  }
}

// Проверка username на занятость (возвращает объект с exists и confirmed)
async function checkUsernameAvailability(username) {
  if (!username) return { exists: false, confirmed: false };
  const spinner = document.getElementById('username-check-spinner');
  if (spinner) spinner.style.display = 'block';
  console.log('[AUTH] Проверка username:', username);
  try {
    const { data, error } = await supabase.functions.invoke('check-username', {
      body: { username },
    });
    console.log('[AUTH] Результат Edge Function:', data, error);
    if (error) throw error;
    return { exists: data.exists, confirmed: data.confirmed || false };
  } catch (err) {
    console.warn('Ошибка проверки username:', err);
    return { exists: false, confirmed: false };
  } finally {
    if (spinner) spinner.style.display = 'none';
  }
}

function updateEmailAvailabilityStatus(result) {
  if (!isRegisterMode) return;
  const { exists, confirmed } = result;
  isEmailTaken = exists && confirmed; // Блокируем только если email подтверждён
  const errorEl = document.getElementById('gate-error');
  const resendBtn = document.getElementById('resend-email-register-btn');
  
  if (exists && !confirmed) {
    // Email занят но не подтверждён - показываем кнопку повторной отправки
    errorEl.textContent = 'Этот email уже зарегистрирован но не подтверждён.';
    errorEl.style.color = 'var(--warning)';
    if (resendBtn) resendBtn.style.display = 'block';
  } else if (exists && confirmed) {
    // Email подтверждён - блокируем регистрацию
    errorEl.textContent = 'Этот email уже зарегистрирован. Войдите или используйте другой.';
    errorEl.style.color = 'var(--danger)';
    if (resendBtn) resendBtn.style.display = 'none';
  } else {
    // Email свободен
    if (errorEl.textContent.includes('уже зарегистрирован')) {
      errorEl.textContent = '';
    }
    if (resendBtn) resendBtn.style.display = 'none';
  }
  
  const submitBtn = document.getElementById('gate-submit-btn');
  if (submitBtn) {
    submitBtn.disabled = exists && confirmed; // Блокируем только если подтверждён
    submitBtn.style.opacity = exists && confirmed ? '0.5' : '1';
  }
}

function updateUsernameAvailabilityStatus(result) {
  if (!isRegisterMode) return;
  const { exists, confirmed } = result;
  isUsernameTaken = exists && confirmed; // Блокируем только если email пользователя подтверждён
  const errorEl = document.getElementById('gate-error');
  
  if (exists && !confirmed) {
    // Username занят но email не подтверждён - не блокируем, но показываем предупреждение
    if (!errorEl.textContent.includes('уже зарегистрирован')) {
      errorEl.textContent = 'Этот никнейм уже зарегистрирован но не подтверждён. Можно использовать.';
      errorEl.style.color = 'var(--warning)';
    }
  } else if (exists && confirmed) {
    // Username подтверждён - блокируем регистрацию
    errorEl.textContent = 'Этот никнейм уже занят. Используйте другой.';
    errorEl.style.color = 'var(--danger)';
  } else if (errorEl.textContent.includes('уже занят') && !errorEl.textContent.includes('уже зарегистрирован')) {
    errorEl.textContent = '';
  }
  
  const submitBtn = document.getElementById('gate-submit-btn');
  if (submitBtn) {
    submitBtn.disabled = (exists && confirmed) || isEmailTaken;
    submitBtn.style.opacity = (exists && confirmed) || isEmailTaken ? '0.5' : '1';
  }
}

// Обработка входа/регистрации
async function handleAuth(email, password, confirm, isRegister, username) {
  if (!email || !password) return;
  if (isRegister && password !== confirm) {
    gateError.textContent = 'Пароли не совпадают';
    return;
  }

  if (isRegister) {
    // Фильтр email-домена
    if (!isRussianEmail(email)) {
      gateError.textContent = 'Регистрация только с российским email (@yandex.ru, @mail.ru и т.д.)';
      return;
    }

    if (!username) {
      gateError.textContent = 'Введите имя пользователя';
      gateUsername.focus();
      return;
    }
    if (isUsernameTaken) {
      gateError.textContent = 'Этот никнейм уже занят. Используйте другой.';
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
      if (isEmailTaken) {
        gateError.textContent =
          'Этот email уже зарегистрирован. Войдите или используйте другой.';
        return;
      }

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

      // Сохраняем username для последующего использовании в профиле
      console.log('[AUTH] Сохраняем username в localStorage:', username);
      localStorage.setItem('englift_pending_username', username);

      // Сохраняем invite из URL
      captureInviteFromUrl();

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username,
          },
        },
      });
      if (error) throw error;
      if (data.user) {
        showEmailNotVerified(data.user.email);
      }
      clearGateForm();
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      clearGateForm();
      // После успешного входа редиректим на главную
      window.location.href = '/';
    }
  } catch (err) {
    const msgs = {
      email_already_exists: 'Этот email уже занят',
      invalid_email: 'Неверный формат email',
      weak_password: 'Пароль слишком короткий (мин. 8 символов)',
      invalid_credentials: 'Неверный email или пароль',
      'Invalid login credentials': 'Неверный email или пароль',
      'Invalid email credentials': 'Неверный email или пароль',
      'User already registered': 'Пользователь уже зарегистрирован',
      'Password should be at least 6 characters':
        'Пароль должен быть минимум 8 символов',
      'Password should be at least 8 characters':
        'Пароль должен быть минимум 8 символов',
      'Password should contain at least one character of each':
        'Пароль должен содержать хотя бы один символ каждого типа: строчные, заглавные, цифры и символы',
      'Unable to validate email address: invalid format':
        'Неверный формат email',
      'Email not confirmed': 'Email не подтверждён',
      'Invalid password': 'Неверный пароль',
      'User not found': 'Пользователь не найден',
    };
    let errorMessage = msgs[err.message];
    if (!errorMessage) {
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
        .replace(/weak_password/g, 'Пароль слишком короткий (мин. 8 символов)')
        .replace(
          /Password should contain at least one character of each.*$/g,
          'Пароль должен содержать хотя бы один символ каждого типа: строчные, заглавные, цифры и символы',
        );
    }
    gateError.textContent = errorMessage || err.message;
    localStorage.removeItem('englift_pending_username');
  } finally {
    gateSubmit.disabled = false;
    
    if (isRegister) {
      gateSubmit.innerHTML = '<span class="material-symbols-outlined" style="margin-right: 8px">person_add</span>Создать аккаунт';
    } else {
      gateSubmit.innerHTML = '<span class="material-symbols-outlined" style="margin-right: 8px">login</span>Войти';
    }
  }
}

// Инвайты (только сохранение из URL)
function captureInviteFromUrl() {
  const inviteId = new URLSearchParams(location.search).get('invite');
  if (inviteId) {
    localStorage.setItem('englift_pending_invite', inviteId);
  }
}

// Функция тоста (упрощённая)
function toast(msg, type = '', icon = '') {
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  if (icon) {
    el.innerHTML = `<span class="material-symbols-outlined" style="font-size: 1.2em; vertical-align: middle; margin-right: 8px;">${icon}</span>${msg}`;
  } else {
    el.textContent = msg;
  }
  const toastBox = document.getElementById('toast-box');
  if (!toastBox) return;
  toastBox.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity .3s';
    setTimeout(() => el.remove(), 320);
  }, 4000);
}
window.toast = toast;

// --- Обработчики событий ---

// Табы
authTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const mode = tab.dataset.mode;
    isRegisterMode = mode === 'register';
    updateAuthTabs(mode);
    
    if (isRegisterMode) {
      gateSubmit.innerHTML = '<span class="material-symbols-outlined" style="margin-right: 8px">person_add</span>Создать аккаунт';
    } else {
      gateSubmit.innerHTML = '<span class="material-symbols-outlined" style="margin-right: 8px">login</span>Войти';
    }
    
    toggleRegisterFields(isRegisterMode);
    gateError.textContent = '';
    clearGateForm();

    isEmailTaken = false;
    lastCheckedEmail = '';
    gateSubmit.disabled = false;
    gateSubmit.style.opacity = '1';
    if (gateError.textContent.includes('уже зарегистрирован')) {
      gateError.textContent = '';
    }
    const spinner = document.getElementById('email-check-spinner');
    if (spinner) spinner.style.display = 'none';
    
    // Скрываем кнопку повторной отправки при переключении вкладок
    if (resendEmailRegisterBtn) resendEmailRegisterBtn.style.display = 'none';
  });
});

// Проверка email при вводе
gateEmail.addEventListener('input', () => {
  if (!isRegisterMode) return;
  const email = gateEmail.value.trim();
  const isValidEmail = /^[^\s@]+@([^\s@]+\.)+[^\s@]+$/.test(email);
  if (!isValidEmail && email) {
    gateError.textContent = 'Введите корректный email';
    isEmailTaken = false;
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

  if (emailCheckDebounceTimer) clearTimeout(emailCheckDebounceTimer);
  if (!email) {
    updateEmailAvailabilityStatus({ exists: false, confirmed: false });
    lastCheckedEmail = '';
    return;
  }
  if (email === lastCheckedEmail) return;
  lastCheckedEmail = email;

  emailCheckDebounceTimer = setTimeout(async () => {
    const result = await checkEmailAvailability(email);
    updateEmailAvailabilityStatus(result);
  }, 500);
});

// Обновление индикатора силы пароля при вводе
gatePassword.addEventListener('input', () => {
  updatePasswordStrengthIndicator(gatePassword.value);
});

// Проверка username при вводе
gateUsername.addEventListener('input', () => {
  if (!isRegisterMode) return;
  const username = gateUsername.value.trim();

  if (usernameCheckDebounceTimer) clearTimeout(usernameCheckDebounceTimer);
  if (!username) {
    updateUsernameAvailabilityStatus({ exists: false, confirmed: false });
    lastCheckedUsername = '';
    return;
  }
  if (username === lastCheckedUsername) return;
  lastCheckedUsername = username;

  usernameCheckDebounceTimer = setTimeout(async () => {
    const result = await checkUsernameAvailability(username);
    updateUsernameAvailabilityStatus(result);
  }, 500);
});

// Кнопка отправки формы
gateSubmit.addEventListener('click', () => {
  handleAuth(
    gateEmail.value.trim(),
    gatePassword.value.trim(),
    gateConfirm.value.trim(),
    isRegisterMode,
    gateUsername.value.trim(),
  );
});

// Обработка Enter в полях ввода
function handleEnterKey(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    handleAuth(
      gateEmail.value.trim(),
      gatePassword.value.trim(),
      gateConfirm.value.trim(),
      isRegisterMode,
      gateUsername.value.trim(),
    );
  }
}

gateEmail.addEventListener('keydown', handleEnterKey);
gatePassword.addEventListener('keydown', handleEnterKey);
gateConfirm.addEventListener('keydown', handleEnterKey);
gateUsername.addEventListener('keydown', handleEnterKey);

// Восстановление пароля
forgotPasswordBtn.addEventListener('click', () => {
  resetModal.classList.add('open');
  resetEmail.focus();
});

sendResetBtn.addEventListener('click', async () => {
  const email = resetEmail.value.trim();
  if (!email) {
    toast('Введите email', 'warning');
    return;
  }
  sendResetBtn.disabled = true;
  try {
    // Используем прямой клиент Supabase для сброса пароля, чтобы ссылка генерировалась с правильным доменом
    const { error } = await directSupabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://enguply.com/reset-password.html'
    });
    if (error) throw error;
    toast(
      'Если такой email зарегистрирован, мы отправили ссылку для сброса пароля.',
      'success',
    );
    resetModal.classList.remove('open');
  } catch (err) {
    toast(err.message, 'danger');
  } finally {
    sendResetBtn.disabled = false;
  }
});

// Enter в модалке сброса пароля
resetEmail.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    sendResetBtn.click();
  }
});

cancelResetBtn.addEventListener('click', () =>
  resetModal.classList.remove('open'),
);

// Повторная отправка подтверждения
resendEmailBtn.addEventListener('click', async () => {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    if (user) {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
      });
      if (error) toast('Ошибка: ' + error.message, 'danger');
      else toast('Письмо отправлено на ' + user.email, 'success');
    } else {
      toast('Пользователь не найден', 'warning');
    }
  } catch (error) {
    toast('Ошибка сети при отправке email', 'danger');
  }
});

// Выход из неподтверждённого
logoutFromUnverifiedBtn.addEventListener('click', () => {
  supabase.auth.signOut();
});

// Повторная отправка подтверждения с формы регистрации
resendEmailRegisterBtn.addEventListener('click', async () => {
  const email = gateEmail.value.trim();
  if (!email) {
    toast('Введите email', 'warning', 'error');
    return;
  }
  resendEmailRegisterBtn.disabled = true;
  resendEmailRegisterBtn.textContent = 'Отправка...';
  await resendConfirmationEmail(email);
  resendEmailRegisterBtn.disabled = false;
  resendEmailRegisterBtn.innerHTML = '<span class="material-symbols-outlined" style="margin-right: 8px">refresh</span>Отправить письмо повторно';
});

// Следим за состоянием аутентификации
supabase.auth.onAuthStateChange(async (event, session) => {
  const user = session?.user;

  if (user && user.email_confirmed_at) {
    // Подтверждённый пользователь — редирект на главную
    window.location.href = '/';
  } else if (user && !user.email_confirmed_at) {
    // Неподтверждённый email — показываем блок
    showEmailNotVerified(user.email);
  } else if (event === 'SIGNED_OUT') {
    // Выход — показываем форму
    hideEmailNotVerified();
  }
});

// Инициализация темы на основе сохраненных настроек
function initLoginTheme() {
  const saved = JSON.parse(localStorage.getItem('englift_user_settings') || '{}');
  // Используем только сохраненные настройки, игнорируем системные
  const dark = saved.dark !== undefined ? saved.dark : false;
  if (dark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

// Если уже есть сессия при загрузке страницы
(async () => {
  // Инициализируем тему перед всем остальным
  initLoginTheme();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.user && session.user.email_confirmed_at) {
    window.location.href = '/';
  } else if (session?.user && !session.user.email_confirmed_at) {
    showEmailNotVerified(session.user.email);
  } else {
    // Нет сессии - показываем форму входа с анимацией
    const container = document.getElementById('auth-gate-container');
    if (container) {
      container.classList.add('ready');
    }
  }
})();

// Показать/скрыть пароль
document
  .getElementById('gate-password-toggle')
  ?.addEventListener('click', function () {
    const passwordInput = document.getElementById('gate-password');
    const type =
      passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    const icon = this.querySelector('.material-symbols-outlined');
    icon.textContent = type === 'password' ? 'visibility' : 'visibility_off';
  });

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
