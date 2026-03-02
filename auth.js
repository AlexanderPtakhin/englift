import { auth } from './firebase.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendEmailVerification,
} from 'firebase/auth';

// ============================================================
// GRAVATAR — ВСЕГДА ДОСТУПНА
// ============================================================
window.getGravatarUrl = function (email, size = 80) {
  if (!email || typeof md5 !== 'function') return '';
  const hash = md5(email.trim().toLowerCase());
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=mp`;
};

// ============================================================
// DOM ЭЛЕМЕНТЫ И ПЕРЕМЕННЫЕ (глобальные для модуля)
// ============================================================
let isRegisterMode = false;
let lastUserId = sessionStorage.getItem('englift_lastUserId') || null;

const authGate = document.getElementById('auth-gate');
const gateEmailInput = document.getElementById('gate-email');
const gatePasswordInput = document.getElementById('gate-password');
const gateConfirmPasswordInput = document.getElementById(
  'gate-confirm-password',
);
const gateConfirmGroup = document.getElementById('gate-confirm-group');
const gatePasswordToggle = document.getElementById('gate-password-toggle');
const gateConfirmToggle = document.getElementById('gate-confirm-toggle');
const gateSubmitBtn = document.getElementById('gate-submit-btn');
const gateToggleBtn = document.getElementById('gate-toggle-btn');
const gateErrorEl = document.getElementById('gate-error');

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

let emailCheckInterval = null;

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================
function stopEmailCheck() {
  if (emailCheckInterval) {
    clearInterval(emailCheckInterval);
    emailCheckInterval = null;
  }
}

async function handleAuth(
  email,
  password,
  confirmPassword,
  errorElement,
  submitButton,
  isGate = false,
) {
  if (!email || !password) return;
  if (isRegisterMode && password !== confirmPassword) {
    errorElement.textContent = 'Пароли не совпадают';
    return;
  }
  errorElement.textContent = '';
  submitButton.disabled = true;
  submitButton.textContent = '...';

  try {
    if (isRegisterMode) {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );
      try {
        await sendEmailVerification(userCredential.user);
        window.toast?.(
          '📧 Письмо для подтверждения отправлено на ваш email. Проверьте почту (и папку "Спам").',
          'success',
        );
      } catch (emailError) {
        console.error('Error sending verification email:', emailError);
        window.toast?.(
          '⚠️ Регистрация успешна, но не удалось отправить письмо подтверждения. Ошибка: ' +
            emailError.message,
          'warning',
        );
      }
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }

    if (isGate) {
      clearGateForm();
      hideAuthGate();
    } else {
      closeModal();
    }
  } catch (err) {
    const msgs = {
      'auth/email-already-in-use': 'Этот email уже занят',
      'auth/invalid-email': 'Неверный формат email',
      'auth/weak-password': 'Пароль слишком короткий (мин. 6 символов)',
      'auth/invalid-credential': 'Неверный email или пароль',
      'auth/user-not-found': 'Пользователь не найден',
      'auth/wrong-password': 'Неверный пароль',
    };
    errorElement.textContent = msgs[err.code] || err.message;
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = isRegisterMode ? 'Создать аккаунт' : 'Войти';
  }
}

function toggleAuthMode(isGate = false) {
  isRegisterMode = !isRegisterMode;
  if (isGate) {
    gateSubmitBtn.textContent = isRegisterMode ? 'Создать аккаунт' : 'Войти';
    gateToggleBtn.textContent = isRegisterMode
      ? 'Уже есть аккаунт? Войти'
      : 'Нет аккаунта? Зарегистрироваться';
    gateErrorEl.textContent = '';
  }
  toggleConfirmPassword(isRegisterMode);
}

function togglePasswordVisibility(input, toggleBtn) {
  if (input.type === 'password') {
    input.type = 'text';
    toggleBtn.textContent = '🙈';
  } else {
    input.type = 'password';
    toggleBtn.textContent = '👁️';
  }
}

function toggleConfirmPassword(show) {
  if (show) {
    gateConfirmGroup.style.display = 'block';
  } else {
    gateConfirmGroup.style.display = 'none';
    gateConfirmPasswordInput.value = '';
  }
}

function showAuthGate() {
  authGate.classList.remove('hidden');
  document.body.classList.remove('authenticated');
  gateEmailInput.focus();
}

function hideAuthGate() {
  authGate.classList.add('hidden');
}

function clearGateForm() {
  gateEmailInput.value = '';
  gatePasswordInput.value = '';
  gateConfirmPasswordInput.value = '';
  gateErrorEl.textContent = '';
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

async function resendVerificationEmail() {
  const user = auth.currentUser;
  if (user && !user.emailVerified) {
    try {
      await sendEmailVerification(user);
      window.toast?.(
        '✉️ Письмо отправлено повторно. Проверьте почту.',
        'success',
      );
    } catch (error) {
      window.toast?.('❌ Ошибка отправки письма: ' + error.message, 'danger');
    }
  }
}

// ============================================================
// ОБРАБОТЧИКИ МЕНЮ
// ============================================================
let hideTimeout;
userMenu.addEventListener('mouseenter', () => {
  clearTimeout(hideTimeout);
  userDropdown.style.display = 'block';
});
userMenu.addEventListener('mouseleave', () => {
  hideTimeout = setTimeout(() => {
    userDropdown.style.display = 'none';
  }, 200);
});
userDropdown.addEventListener('mouseenter', () => {
  clearTimeout(hideTimeout);
});
userDropdown.addEventListener('mouseleave', () => {
  userDropdown.style.display = 'none';
});

dropdownLogout.addEventListener('click', () => {
  stopEmailCheck();
  signOut(auth);
});

// ============================================================
// ОБРАБОТЧИКИ ФОРМ
// ============================================================
gateToggleBtn.addEventListener('click', () => toggleAuthMode(true));
gateSubmitBtn.addEventListener('click', () => {
  handleAuth(
    gateEmailInput.value.trim(),
    gatePasswordInput.value.trim(),
    gateConfirmPasswordInput.value.trim(),
    gateErrorEl,
    gateSubmitBtn,
    true,
  );
});
gateEmailInput.addEventListener('keypress', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    gatePasswordInput.focus();
  }
});
gatePasswordToggle.addEventListener('click', () =>
  togglePasswordVisibility(gatePasswordInput, gatePasswordToggle),
);
gateConfirmToggle.addEventListener('click', () =>
  togglePasswordVisibility(gateConfirmPasswordInput, gateConfirmToggle),
);

if (resendEmailBtn) {
  resendEmailBtn.addEventListener('click', resendVerificationEmail);
}
if (logoutFromUnverifiedBtn) {
  logoutFromUnverifiedBtn.addEventListener('click', () => {
    stopEmailCheck();
    signOut(auth);
  });
}

// ============================================================
// СЛУШАЕМ СОСТОЯНИЕ АВТОРИЗАЦИИ
// ============================================================
onAuthStateChanged(auth, async user => {
  const newUid = user?.uid || null;

  if (newUid !== lastUserId) {
    if (window.clearUserData) window.clearUserData();
    if (window.loadData) window.loadData();
    if (window.renderXP) window.renderXP();
    if (window.renderBadges) window.renderBadges();
    if (window.renderStats) window.renderStats();

    lastUserId = newUid;
    if (newUid) {
      sessionStorage.setItem('englift_lastUserId', newUid);
    } else {
      sessionStorage.removeItem('englift_lastUserId');
    }
  }

  if (user) {
    if (user.emailVerified) {
      hideEmailNotVerified();
      hideAuthGate();
      document.body.classList.add('authenticated');
      // Обновляем меню
      dropdownEmail.textContent = user.email;
      const firstLetter = user.email.charAt(0).toUpperCase();
      userAvatar.textContent = firstLetter;
      userAvatar.style.backgroundColor = 'var(--primary)';
      userAvatar.style.color = '#fff';
      userAvatar.style.display = 'flex';
      userAvatar.style.alignItems = 'center';
      userAvatar.style.justifyContent = 'center';

      const localWords =
        typeof window._getLocalWords === 'function'
          ? window._getLocalWords()
          : [];

      console.log('Local words before sync:', localWords?.length);

      if (localWords && localWords.length > 0) {
        try {
          const syncResult =
            await window.authExports.syncLocalWordsWithFirestore(localWords);
          if (syncResult.success && syncResult.mergedWords) {
            window._setWords(syncResult.mergedWords);
          }
        } catch (e) {
          console.error('Ошибка синхронизации слов:', e);
        }
      } else {
        console.log('No local words to sync');
      }

      window.authExports.subscribeToWords(firestoreWords => {
        if (window._setWords) window._setWords(firestoreWords);
      });

      stopEmailCheck();
    } else {
      hideAuthGate();
      document.body.classList.remove('authenticated');
      showEmailNotVerified(user.email);

      dropdownEmail.textContent = user.email;
      userAvatar.textContent = user.email.charAt(0).toUpperCase();

      if (window.clearUserData) window.clearUserData();
      window.authExports.unsubscribeWords();
    }
  } else {
    hideEmailNotVerified();
    showAuthGate();
    document.body.classList.remove('authenticated');

    dropdownEmail.textContent = '';
    userAvatar.textContent = '👤';

    if (window.clearUserData) window.clearUserData();
    window.authExports.unsubscribeWords();
    stopEmailCheck();
  }
});
