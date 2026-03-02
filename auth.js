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

  // Блок для неподтверждённого email
  const emailNotVerifiedBlock = document.getElementById('email-not-verified');
  const unverifiedEmailSpan = document.getElementById('unverified-email');
  const resendEmailBtn = document.getElementById('resend-email-btn');
  const logoutFromUnverifiedBtn = document.getElementById(
    'logout-from-unverified',
  );

  // Элементы нового меню пользователя
  const userMenu = document.getElementById('user-menu');
  const userAvatar = document.getElementById('user-avatar');
  const userDropdown = document.getElementById('user-dropdown');
  const dropdownEmail = document.getElementById('dropdown-email');
  const dropdownLogout = document.getElementById('dropdown-logout');

  // Переменная для хранения интервала проверки email (пока закомментирована)
  let emailCheckInterval = null;

  function stopEmailCheck() {
    if (emailCheckInterval) {
      clearInterval(emailCheckInterval);
      emailCheckInterval = null;
    }
  }

  // Общая функция для обработки авторизации (без изменений)
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

  // ----- Обработчики для меню пользователя -----
  let hideTimeout;

  userMenu.addEventListener('mouseenter', () => {
    clearTimeout(hideTimeout);
    userDropdown.style.display = 'block';
  });

  userMenu.addEventListener('mouseleave', () => {
    hideTimeout = setTimeout(() => {
      userDropdown.style.display = 'none';
    }, 200); // задержка 200мс
  });

  // Чтобы меню не исчезало, когда мышь на нём
  userDropdown.addEventListener('mouseenter', () => {
    clearTimeout(hideTimeout);
  });

  userDropdown.addEventListener('mouseleave', () => {
    userDropdown.style.display = 'none';
  });

  // Выход
  dropdownLogout.addEventListener('click', () => {
    stopEmailCheck();
    firebaseAuth.signOut(auth);
    userDropdown.style.display = 'none';
  });

  // ----- Обработчики для форм (без изменений) -----
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
      firebaseAuth.signOut(auth);
    });
  }

  // ----- Слушаем состояние авторизации -----
  firebaseAuth.onAuthStateChanged(auth, async user => {
    if (user) {
      if (user.emailVerified) {
        // Email подтверждён – пускаем в приложение
        hideEmailNotVerified();
        hideAuthGate();
        document.body.classList.add('authenticated');

        // Обновляем меню
        dropdownEmail.textContent = user.email;
        // Используем Gravatar аватар
        const avatarUrl = getGravatarUrl(user.email, 40);
        userAvatar.innerHTML = `<img src="${avatarUrl}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;

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
        // Email не подтверждён – блокируем доступ
        hideAuthGate();
        document.body.classList.remove('authenticated');
        showEmailNotVerified(user.email);

        // Меню всё равно не будет видно, но на всякий случай обновим
        dropdownEmail.textContent = user.email;
        userAvatar.textContent = user.email.charAt(0).toUpperCase();

        if (window.clearUserData) window.clearUserData();
        window.authExports.unsubscribeWords();

        // Проверка email отключена, как в вашем коде
      }
    } else {
      // Пользователь не авторизован
      hideEmailNotVerified();
      showAuthGate();
      document.body.classList.remove('authenticated');

      // Сбрасываем меню
      dropdownEmail.textContent = '';
      userAvatar.textContent = '👤';

      if (window.clearUserData) window.clearUserData();
      window.authExports.unsubscribeWords();
      stopEmailCheck();
    }
  });
}
