import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { auth } from './firebase.js';
import { saveAllWordsToDb, subscribeToWords, unsubscribeWords } from './db.js';

let isRegisterMode = false;

const modal = document.getElementById('auth-modal');
const authBtn = document.getElementById('auth-btn');
const submitBtn = document.getElementById('auth-submit-btn');
const toggleBtn = document.getElementById('auth-toggle-btn');
const closeBtn = document.getElementById('auth-close-btn');
const emailInput = document.getElementById('auth-email');
const passwordInput = document.getElementById('auth-password');
const errorEl = document.getElementById('auth-error');
const titleEl = document.getElementById('auth-modal-title');

function openModal() {
  modal.classList.add('open');
  emailInput.focus();
}

function closeModal() {
  modal.classList.remove('open');
  errorEl.textContent = '';
  emailInput.value = '';
  passwordInput.value = '';
}

authBtn.addEventListener('click', () => {
  if (auth.currentUser) {
    signOut(auth);
  } else {
    openModal();
  }
});

closeBtn.addEventListener('click', closeModal);
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

toggleBtn.addEventListener('click', () => {
  isRegisterMode = !isRegisterMode;
  titleEl.textContent = isRegisterMode ? 'Регистрация' : 'Войти';
  submitBtn.textContent = isRegisterMode ? 'Создать аккаунт' : 'Войти';
  toggleBtn.textContent = isRegisterMode 
    ? 'Уже есть аккаунт? Войти' 
    : 'Нет аккаунта? Зарегистрироваться';
  errorEl.textContent = '';
});

submitBtn.addEventListener('click', async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  if (!email || !password) return;

  errorEl.textContent = '';
  submitBtn.disabled = true;
  submitBtn.textContent = '...';

  try {
    if (isRegisterMode) {
      await createUserWithEmailAndPassword(auth, email, password);
    } else {
      await signInWithEmailAndPassword(auth, email, password);
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

// Слушаем состояние авторизации
onAuthStateChanged(auth, async user => {
  if (user) {
    authBtn.textContent = '👤 Выйти';
    authBtn.title = user.email;

    // Если в localStorage были слова — переносим их в Firestore
    const localWords = window._getLocalWords?.();
    if (localWords && localWords.length > 0) {
      try {
        await saveAllWordsToDb(localWords);
        console.log(`✅ Перенесено ${localWords.length} слов в Firestore`);
      } catch (e) {
        console.error('Ошибка переноса слов:', e);
      }
    }

    // Подписываемся на Firestore — данные придут в реальном времени
    subscribeToWords(firestoreWords => {
      if (window._setWords) {
        window._setWords(firestoreWords);
      }
    });

  } else {
    authBtn.textContent = 'Войти';
    authBtn.title = '';
    unsubscribeWords();
  }
});
