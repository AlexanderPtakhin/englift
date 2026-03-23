import { supabase } from './supabase.js';
import { saveUserData } from './db.js'; // для сохранения профиля при регистрации

// DOM элементы
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

// Поле username
const gateUsername = document.getElementById('gate-username');
const gateUsernameGroup = document.getElementById('gate-username-group');
const gateUsernameHint = document.getElementById('gate-username-hint');

// Табы
const authTabs = document.querySelectorAll('.auth-tab');

// Переменные
let isRegisterMode = false;
let emailCheckDebounceTimer = null;
let isEmailTaken = false;
let lastCheckedEmail = '';

// --- Вспомогательные функции ---

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
  }
  if (authGate) authGate.style.display = 'none';
}

function hideEmailNotVerified() {
  if (emailNotVerifiedBlock) emailNotVerifiedBlock.style.display = 'none';
  if (authGate) authGate.style.display = 'block';
}

// Проверка email на занятость
async function checkEmailAvailability(email) {
  if (!email) return false;
  const spinner = document.getElementById('email-check-spinner');
  if (spinner) spinner.style.display = 'block';
  try {
    const { data, error } = await supabase.functions.invoke('check-email', {
      body: { email },
    });
    if (error) throw error;
    return data.exists;
  } catch (err) {
    console.warn('Ошибка проверки email:', err);
    return false;
  } finally {
    if (spinner) spinner.style.display = 'none';
  }
}

function updateEmailAvailabilityStatus(taken) {
  if (!isRegisterMode) return;
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

// Обработка входа/регистрации
async function handleAuth(email, password, confirm, isRegister, username) {
  if (!email || !password) return;
  if (isRegister && password !== confirm) {
    gateError.textContent = 'Пароли не совпадают';
    return;
  }

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

      // Сохраняем username для последующего использования в профиле
      localStorage.setItem('englift_pending_username', username);

      // Сохраняем invite из URL
      captureInviteFromUrl();

      const { data, error } = await supabase.auth.signUp({ email, password });
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
        .replace(/weak_password/g, 'Пароль слишком короткий (мин. 6 символов)');
    }
    gateError.textContent = errorMessage || err.message;
    localStorage.removeItem('englift_pending_username');
  } finally {
    gateSubmit.disabled = false;
    gateSubmit.textContent = isRegister ? 'Создать аккаунт' : 'Войти';
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
    gateSubmit.textContent = isRegisterMode ? 'Создать аккаунт' : 'Войти';
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
    updateEmailAvailabilityStatus(false);
    lastCheckedEmail = '';
    return;
  }
  if (email === lastCheckedEmail) return;
  lastCheckedEmail = email;

  emailCheckDebounceTimer = setTimeout(async () => {
    const taken = await checkEmailAvailability(email);
    updateEmailAvailabilityStatus(taken);
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
    const { error } = await supabase.auth.resetPasswordForEmail(email);
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

// Если уже есть сессия при загрузке страницы
(async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.user && session.user.email_confirmed_at) {
    window.location.href = '/';
  } else if (session?.user && !session.user.email_confirmed_at) {
    showEmailNotVerified(session.user.email);
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
