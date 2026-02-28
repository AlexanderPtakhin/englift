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
  // Импортируем функции Firebase после полной загрузки
  import('firebase/auth').then(
    ({
      createUserWithEmailAndPassword,
      signInWithEmailAndPassword,
      signOut,
      onAuthStateChanged,
    }) => {
      initializeAuth(auth, {
        createUserWithEmailAndPassword,
        signInWithEmailAndPassword,
        signOut,
        onAuthStateChanged,
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

  // Функция переключения видимости пароля
  function togglePasswordVisibility(input, toggleBtn) {
    if (input.type === 'password') {
      input.type = 'text';
      toggleBtn.textContent = '�';
    } else {
      input.type = 'password';
      toggleBtn.textContent = '👁️';
    }
  }

  // Функция показа/скрытия поля подтверждения пароля
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

  // Обработчики для показа/скрытия паролей (обязательная авторизация)
  gatePasswordToggle.addEventListener('click', () => {
    togglePasswordVisibility(gatePasswordInput, gatePasswordToggle);
  });

  gateConfirmToggle.addEventListener('click', () => {
    togglePasswordVisibility(gateConfirmPasswordInput, gateConfirmToggle);
  });

  // Обработчики для показа/скрытия паролей (обычное модальное окно)
  passwordToggle.addEventListener('click', () => {
    togglePasswordVisibility(passwordInput, passwordToggle);
  });

  confirmToggle.addEventListener('click', () => {
    togglePasswordVisibility(confirmPasswordInput, confirmToggle);
  });

  // Функции для обязательной авторизации
  function showAuthGate() {
    authGate.classList.remove('hidden');
    document.body.classList.remove('authenticated');
    gateEmailInput.focus();
  }

  function hideAuthGate() {
    authGate.classList.add('hidden');
    document.body.classList.add('authenticated');
  }

  function clearGateForm() {
    gateEmailInput.value = '';
    gatePasswordInput.value = '';
    gateConfirmPasswordInput.value = '';
    gateErrorEl.textContent = '';
  }

  // Функции для обычного модального окна
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

  // Обработчики для обязательной авторизации
  gateToggleBtn.addEventListener('click', () => {
    isRegisterMode = !isRegisterMode;
    gateSubmitBtn.textContent = isRegisterMode ? 'Создать аккаунт' : 'Войти';
    gateToggleBtn.textContent = isRegisterMode
      ? 'Уже есть аккаунт? Войти'
      : 'Нет аккаунта? Зарегистрироваться';
    gateErrorEl.textContent = '';
    toggleConfirmPassword(isRegisterMode);
  });

  gateSubmitBtn.addEventListener('click', async () => {
    const email = gateEmailInput.value.trim();
    const password = gatePasswordInput.value.trim();
    const confirmPassword = gateConfirmPasswordInput.value.trim();

    if (!email || !password) return;

    // Проверка подтверждения пароля при регистрации
    if (isRegisterMode && password !== confirmPassword) {
      gateErrorEl.textContent = 'Пароли не совпадают';
      return;
    }

    gateErrorEl.textContent = '';
    gateSubmitBtn.disabled = true;
    gateSubmitBtn.textContent = '...';

    try {
      if (isRegisterMode) {
        await firebaseAuth.createUserWithEmailAndPassword(
          auth,
          email,
          password,
        );
      } else {
        await firebaseAuth.signInWithEmailAndPassword(auth, email, password);
      }
      clearGateForm();
      hideAuthGate();
    } catch (err) {
      const msgs = {
        'auth/email-already-in-use': 'Этот email уже занят',
        'auth/invalid-email': 'Неверный формат email',
        'auth/weak-password': 'Пароль слишком короткий (мин. 6 символов)',
        'auth/invalid-credential': 'Неверный email или пароль',
        'auth/user-not-found': 'Пользователь не найден',
        'auth/wrong-password': 'Неверный пароль',
      };
      gateErrorEl.textContent = msgs[err.code] || err.message;
    } finally {
      gateSubmitBtn.disabled = false;
      gateSubmitBtn.textContent = isRegisterMode ? 'Создать аккаунт' : 'Войти';
    }
  });

  // Поддержка клавиши Enter для формы авторизации
  gateEmailInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      gatePasswordInput.focus();
    }
  });

  gatePasswordInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isRegisterMode) {
        gateConfirmPasswordInput.focus();
      } else {
        gateSubmitBtn.click();
      }
    }
  });

  gateConfirmPasswordInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      gateSubmitBtn.click();
    }
  });

  // Обработчики для обычного модального окна
  authBtn.addEventListener('click', () => {
    if (auth.currentUser) {
      firebaseAuth.signOut(auth);
    } else {
      openModal();
    }
  });

  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', e => {
    if (e.target === modal) closeModal();
  });

  toggleBtn.addEventListener('click', () => {
    isRegisterMode = !isRegisterMode;
    titleEl.textContent = isRegisterMode ? 'Регистрация' : 'Войти';
    submitBtn.textContent = isRegisterMode ? 'Создать аккаунт' : 'Войти';
    toggleBtn.textContent = isRegisterMode
      ? 'Уже есть аккаунта? Войти'
      : 'Нет аккаунта? Зарегистрироваться';
    errorEl.textContent = '';
    toggleConfirmPassword(isRegisterMode);
  });

  submitBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    const confirmPassword = confirmPasswordInput.value.trim();

    if (!email || !password) return;

    // Проверка подтверждения пароля при регистрации
    if (isRegisterMode && password !== confirmPassword) {
      errorEl.textContent = 'Пароли не совпадают';
      return;
    }

    errorEl.textContent = '';
    submitBtn.disabled = true;
    submitBtn.textContent = '...';

    try {
      if (isRegisterMode) {
        await firebaseAuth.createUserWithEmailAndPassword(
          auth,
          email,
          password,
        );
      } else {
        await firebaseAuth.signInWithEmailAndPassword(auth, email, password);
      }
      closeModal();
    } catch (err) {
      const msgs = {
        'auth/email-already-in-use': 'Этот email уже занят',
        'auth/invalid-email': 'Неверный формат email',
        'auth/weak-password': 'Пароль слишком короткий (мин. 6 символов)',
        'auth/invalid-credential': 'Неверный email или пароль',
        'auth/user-not-found': 'Пользователь не найден',
        'auth/wrong-password': 'Неверный пароль',
      };
      errorEl.textContent = msgs[err.code] || err.message;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = isRegisterMode ? 'Создать аккаунт' : 'Войти';
    }
  });

  // Поддержка клавиши Enter для обычного модального окна
  emailInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      passwordInput.focus();
    }
  });

  passwordInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isRegisterMode) {
        confirmPasswordInput.focus();
      } else {
        submitBtn.click();
      }
    }
  });

  confirmPasswordInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitBtn.click();
    }
  });

  // Слушаем состояние авторизации
  firebaseAuth.onAuthStateChanged(auth, async user => {
    if (user) {
      authBtn.textContent = '👤 Выйти';
      authBtn.title = user.email;

      // Если в localStorage были слова — переносим их в Firestore
      const localWords = window._getLocalWords?.();
      if (localWords && localWords.length > 0) {
        try {
          await window.authExports.saveAllWordsToDb(localWords);
          console.log(`Перенесено ${localWords.length} слов в Firestore`);
        } catch (e) {
          console.error('Ошибка переноса слов:', e);
        }
      }

      // Подписываемся на Firestore — данные придут в реальном времени
      window.authExports.subscribeToWords(firestoreWords => {
        if (window._setWords) {
          window._setWords(firestoreWords);
        }
      });

      // Скрываем окно обязательной авторизации если пользователь авторизован
      hideAuthGate();
    } else {
      authBtn.textContent = 'Войти';
      authBtn.title = '';
      window.authExports.unsubscribeWords();

      // Показываем окно обязательной авторизации
      showAuthGate();
    }
  });
}
