import { auth } from './firebase.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendEmailVerification,
} from 'firebase/auth';

// Функция для загрузки данных пользователя из Firebase
async function loadUserDataFromFirebase() {
  if (!window.authExports?.auth?.currentUser) return;

  try {
    const db = window.authExports?.db;
    if (!db) return;

    const userRef = window.authExports?.userRef(
      window.authExports.auth.currentUser.uid,
    );
    if (!userRef) return;

    const dbModule = await import('./db.js');
    const userDoc = await dbModule.getDoc(userRef);
    const userData = userDoc.data();

    if (userData) {
      // Загружаем XP данные
      if (userData.xpData && window.updateXpData) {
        console.log('Loading XP data from Firebase:', userData.xpData);
        window.updateXpData(userData.xpData);
      }

      // Загружаем streak данные
      if (userData.streak && window.updateStreak) {
        console.log('Loading streak data from Firebase:', userData.streak);
        window.updateStreak(userData.streak);
      }

      // Загружаем настройки речи
      if (userData.speechCfg) {
        console.log('Loading speech config from Firebase:', userData.speechCfg);
        window.speechCfg = userData.speechCfg;
        // Сохраняем только локально, без вызова saveSpeech
        localStorage.setItem(
          'englift_speech',
          JSON.stringify(userData.speechCfg),
        );
      }

      // Загружаем тему
      if (userData.darkTheme !== undefined) {
        console.log('Loading theme from Firebase:', userData.darkTheme);
        localStorage.setItem('engliftDark', userData.darkTheme.toString());

        // Вызываем applyDark для применения темы
        if (typeof window.applyDark === 'function') {
          console.log(
            'Calling applyDark from Firebase with:',
            userData.darkTheme,
          );
          window.applyDark(userData.darkTheme);
        } else {
          console.log('applyDark function not available - applying directly');
          // Применяем тему напрямую через DOM
          if (window.applyDark) {
            window.applyDark(userData.darkTheme);
          } else {
            document.body.classList.toggle('dark', userData.darkTheme);
          }
          console.log(
            'Dark class applied directly. Body classes:',
            document.body.className,
          );
          console.log(
            'Has dark class:',
            document.body.classList.contains('dark'),
          );

          // Обновляем UI элементы
          setTimeout(() => {
            const darkToggle = document.getElementById('dark-toggle');
            if (darkToggle) {
              const icon = userData.darkTheme ? 'sunny' : 'dark_mode';
              darkToggle.innerHTML = `<span class="material-symbols-outlined">${icon}</span>`;
            }

            const themeCheckbox = document.getElementById('theme-checkbox');
            if (themeCheckbox) {
              themeCheckbox.checked = userData.darkTheme;
            }

            const themeIcon = document.querySelector(
              '#dropdown-theme-toggle .material-symbols-outlined',
            );
            if (themeIcon) {
              const icon = userData.darkTheme ? 'sunny' : 'dark_mode';
              themeIcon.textContent = icon;
            }

            console.log('Theme applied directly via DOM');
          }, 100);
        }
      }
    } else {
      // Документа пользователя нет – создаём с текущими данными
      const newUserData = {
        xpData: window.xpData || { xp: 0, level: 1, badges: [] },
        streak: window.streak || { count: 0, lastDate: null },
        speechCfg: window.speechCfg || {
          voiceURI: '',
          rate: 0.9,
          pitch: 1.0,
          accent: 'US',
        },
        darkTheme: localStorage.getItem('engliftDark') === 'true',
      };
      await dbModule.setDoc(userRef, newUserData);
      console.log('Created user document with current data');
    }
  } catch (error) {
    console.error('Error loading/saving user data from Firebase:', error);
  }
}

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
      // closeModal(); // Removed - function doesn't exist
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
    toggleBtn.innerHTML =
      '<span class="material-symbols-outlined">visibility_off</span>';
  } else {
    input.type = 'password';
    toggleBtn.innerHTML =
      '<span class="material-symbols-outlined">visibility</span>';
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
      // Сначала загружаем данные (тему, XP, streak и т.д.)
      await loadUserDataFromFirebase();

      // Теперь скрываем модалку и показываем приложение
      hideEmailNotVerified();
      hideAuthGate();
      document.body.classList.add('authenticated');

      // Обновляем меню
      dropdownEmail.textContent = user.email;

      // Простая и надёжная иконка
      userAvatar.innerHTML =
        '<span class="material-symbols-outlined">person</span>';
      userAvatar.style.display = 'flex';
      userAvatar.style.alignItems = 'center';
      userAvatar.style.justifyContent = 'center';

      const localWords =
        typeof window._getLocalWords === 'function'
          ? window._getLocalWords()
          : [];

      console.log('Local words before sync:', localWords?.length || 0);

      if (localWords && Array.isArray(localWords) && localWords.length > 0) {
        try {
          console.log('Starting sync with', localWords.length, 'words');
          const syncResult =
            await window.authExports.syncLocalWordsWithFirestore(localWords);
          console.log('Sync result:', syncResult);

          if (syncResult?.success && syncResult.mergedWords) {
            console.log(
              'Sync successful, merged',
              syncResult.mergedWords.length,
              'words',
            );
            window._setWords(syncResult.mergedWords);
          } else {
            console.log('Sync failed or no merged words, using local words');
            window._setWords(localWords);
          }
        } catch (e) {
          console.error('Ошибка синхронизации слов:', e);
          // Не показываем toast при ошибке синхронизации при входе
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
      userAvatar.innerHTML =
        '<span class="material-symbols-outlined">person</span>';

      if (window.clearUserData) window.clearUserData();
      window.authExports.unsubscribeWords();
    }
  } else {
    hideEmailNotVerified();
    showAuthGate(); // убрать setTimeout
    document.body.classList.remove('authenticated');

    dropdownEmail.textContent = '';
    userAvatar.innerHTML =
      '<span class="material-symbols-outlined">person</span>';

    if (window.clearUserData) window.clearUserData();
    window.authExports.unsubscribeWords();
    stopEmailCheck();
  }
});
