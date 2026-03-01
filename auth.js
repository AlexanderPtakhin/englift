// Ждем загрузки authExports
function waitForAuthExports() {
  return new Promise(resolve => {
    if (window.authExports) {
      resolve(window.authExports);
    } else {
      setTimeout(() => waitForAuthExports().then(resolve), 50);
    }
  });
}

// Инициализация после загрузки всех зависимостей
waitForAuthExports().then(({ auth }) => {
  import('firebase/auth').then(
    ({
      createUserWithEmailAndPassword,
      signInWithEmailAndPassword,
      signOut,
      onAuthStateChanged,
      sendEmailVerification,
    }) => {
      initializeAuth(auth, {
        createUserWithEmailAndPassword,
        signInWithEmailAndPassword,
        signOut,
        onAuthStateChanged,
        sendEmailVerification,
      });
    },
  );
});

function initializeAuth(auth, firebaseAuth) {
  let isRegisterMode = false;

  // Элементы для обязательной авторизации
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

  // Элементы для обычного модального окна
  const modal = document.getElementById('auth-modal');
  const authBtn = document.getElementById('auth-btn');
  const emailInput = document.getElementById('auth-email');
  const passwordInput = document.getElementById('auth-password');
  const confirmPasswordInput = document.getElementById('auth-confirm-password');
  const confirmGroup = document.getElementById('auth-confirm-group');
  const passwordToggle = document.getElementById('auth-password-toggle');
  const confirmToggle = document.getElementById('auth-confirm-toggle');
  const submitBtn = document.getElementById('auth-submit-btn');
  const toggleBtn = document.getElementById('auth-toggle-btn');
  const closeBtn = document.getElementById('auth-close-btn');
  const errorEl = document.getElementById('auth-error');
  const titleEl = document.getElementById('auth-modal-title');

  // Блок для неподтверждённого email
  const emailNotVerifiedBlock = document.getElementById('email-not-verified');
  const unverifiedEmailSpan = document.getElementById('unverified-email');
  const resendEmailBtn = document.getElementById('resend-email-btn');
  const logoutFromUnverifiedBtn = document.getElementById(
    'logout-from-unverified',
  );

  // Элементы информации о пользователе
  const userInfo = document.getElementById('user-info');
  const userEmail = document.getElementById('user-email');
  const userStatus = document.getElementById('user-status');

  // Переменная для хранения интервала проверки email
  let emailCheckInterval = null;

  // Функция для остановки проверки email
  function stopEmailCheck() {
    if (emailCheckInterval) {
      clearInterval(emailCheckInterval);
      emailCheckInterval = null;
    }
  }

  // Общая функция для обработки авторизации
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
        const userCredential =
          await firebaseAuth.createUserWithEmailAndPassword(
            auth,
            email,
            password,
          );
        try {
          await firebaseAuth.sendEmailVerification(userCredential.user);
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
        await firebaseAuth.signInWithEmailAndPassword(auth, email, password);
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
    } else {
      titleEl.textContent = isRegisterMode ? 'Регистрация' : 'Войти';
      submitBtn.textContent = isRegisterMode ? 'Создать аккаунт' : 'Войти';
      toggleBtn.textContent = isRegisterMode
        ? 'Уже есть аккаунт? Войти'
        : 'Нет аккаунта? Зарегистрироваться';
      errorEl.textContent = '';
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
      confirmGroup.style.display = 'block';
    } else {
      gateConfirmGroup.style.display = 'none';
      confirmGroup.style.display = 'none';
      gateConfirmPasswordInput.value = '';
      confirmPasswordInput.value = '';
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

  function openModal() {
    modal.classList.add('open');
    emailInput.focus();
  }

  function closeModal() {
    modal.classList.remove('open');
    errorEl.textContent = '';
    emailInput.value = '';
    passwordInput.value = '';
    confirmPasswordInput.value = '';
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
        await firebaseAuth.sendEmailVerification(user);
        window.toast?.(
          '✉️ Письмо отправлено повторно. Проверьте почту.',
          'success',
        );
      } catch (error) {
        window.toast?.('❌ Ошибка отправки письма: ' + error.message, 'danger');
      }
    }
  }

  // Обработчики
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
  passwordToggle.addEventListener('click', () =>
    togglePasswordVisibility(passwordInput, passwordToggle),
  );
  confirmToggle.addEventListener('click', () =>
    togglePasswordVisibility(confirmPasswordInput, confirmToggle),
  );

  authBtn.addEventListener('click', () => {
    if (auth.currentUser) {
      stopEmailCheck();
      firebaseAuth.signOut(auth);
    } else {
      openModal();
    }
  });

  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', e => {
    if (e.target === modal) closeModal();
  });

  toggleBtn.addEventListener('click', () => toggleAuthMode(false));
  submitBtn.addEventListener('click', () => {
    handleAuth(
      emailInput.value.trim(),
      passwordInput.value.trim(),
      confirmPasswordInput.value.trim(),
      errorEl,
      submitBtn,
      false,
    );
  });

  if (resendEmailBtn) {
    resendEmailBtn.addEventListener('click', resendVerificationEmail);
  }
  if (logoutFromUnverifiedBtn) {
    logoutFromUnverifiedBtn.addEventListener('click', () => {
      stopEmailCheck();
      firebaseAuth.signOut(auth);
    });
  }

  // Слушаем состояние авторизации
  firebaseAuth.onAuthStateChanged(auth, async user => {
    if (user) {
      if (user.emailVerified) {
        hideEmailNotVerified();
        hideAuthGate();
        document.body.classList.add('authenticated');

        authBtn.textContent = '👤 Выйти';
        authBtn.title = user.email;

        if (userInfo && userEmail && userStatus) {
          userInfo.style.display = 'block';
          userEmail.textContent = user.email;
          userStatus.textContent = '✅ Подтвержден';
          userStatus.style.color = 'var(--success)';
        }

        if (window.clearUserData) window.clearUserData();

        const localWords = window._getLocalWords?.();
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
        }

        window.authExports.subscribeToWords(firestoreWords => {
          if (window._setWords) window._setWords(firestoreWords);
        });

        stopEmailCheck();
      } else {
        hideAuthGate();
        document.body.classList.remove('authenticated');
        showEmailNotVerified(user.email);

        authBtn.textContent = '👤 Выйти';
        authBtn.title = user.email;

        if (userInfo && userEmail && userStatus) {
          userInfo.style.display = 'block';
          userEmail.textContent = user.email;
          userStatus.textContent = '📧 Не подтвержден';
          userStatus.style.color = 'var(--warning)';
        }

        if (window.clearUserData) window.clearUserData();
        window.authExports.unsubscribeWords();

        // Временно отключаем проверку email из-за проблем с токенами
        // stopEmailCheck();
        // emailCheckInterval = setInterval(async () => {
        //   if (user) {
        //     try {
        //       await user.reload();
        //       if (user.emailVerified) {
        //         stopEmailCheck();
        //         window.location.reload(); // Просто перезагружаем страницу
        //       }
        //     } catch (error) {
        //       console.error('Error checking email verification:', error);
        //       if (error.code === 'auth/user-token-expired') {
        //         stopEmailCheck();
        //         firebaseAuth.signOut(auth);
        //       }
        //     }
        //   }
        // }, 3000);
      }
    } else {
      hideEmailNotVerified();
      showAuthGate();
      document.body.classList.remove('authenticated');

      authBtn.textContent = 'Войти';
      authBtn.title = '';

      if (userInfo) {
        userInfo.style.display = 'none';
      }

      if (window.clearUserData) window.clearUserData();
      window.authExports.unsubscribeWords();
      stopEmailCheck();
    }
  });
}
