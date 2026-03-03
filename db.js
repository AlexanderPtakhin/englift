import { db } from './firebase.js';
import { auth } from './firebase.js';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  limit,
  onSnapshot,
  writeBatch,
  where,
  serverTimestamp,
  enableIndexedDbPersistence,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

// Включаем оффлайн-персистентность для Firestore
enableIndexedDbPersistence(db).catch(err => {
  if (err.code === 'failed-precondition') {
    console.log('Multiple tabs open, persistence disabled');
  } else if (err.code === 'unimplemented') {
    console.log('Browser does not support persistence');
  }
});

// Функция для сохранения пользовательских данных (XP, streak, настройки)
export async function saveUserData(uid, data) {
  if (!uid) return;
  const userRef = doc(db, 'users', uid);
  await setDoc(userRef, data, { merge: true });
}

// Полная заглушка для document на случай выполнения в окружении без DOM (например, в тестах)
if (typeof document === 'undefined') {
  globalThis.document = {
    addEventListener: function () {},
    removeEventListener: function () {},
    createElement: function () {
      return {};
    },
    getElementById: function () {
      return null;
    },
    querySelector: function () {
      return null;
    },
    querySelectorAll: function () {
      return [];
    },
    body: {},
    documentElement: {},
    createTextNode: function () {
      return {};
    },
  };
} else {
  // Если document существует, но некоторые методы отсутствуют, подменяем их
  const requiredMethods = [
    'addEventListener',
    'removeEventListener',
    'createElement',
    'getElementById',
    'querySelector',
    'querySelectorAll',
  ];
  requiredMethods.forEach(method => {
    if (typeof document[method] !== 'function') {
      document[method] = function () {};
    }
  });
  if (!document.body) document.body = {};
  if (!document.documentElement) document.documentElement = {};
}

let unsubscribe = null;
let reconnectAttempts = 0;
let maxReconnectAttempts = 5;
let reconnectDelay = 1000;
let reconnectTimer = null;

// Централизованное ожидание авторизации
let authPromise = null;

function getAuthPromise() {
  if (!authPromise) {
    authPromise = new Promise(resolve => {
      if (auth.currentUser) {
        resolve(auth.currentUser);
      } else {
        const unsub = onAuthStateChanged(auth, user => {
          if (user) {
            unsub();
            resolve(user);
          }
        });
      }
    });
  }
  return authPromise;
}

function wordsRef(uid) {
  return collection(db, 'users', uid, 'words');
}

export function userRef(uid) {
  return doc(db, 'users', uid);
}

// Экспортируем Firestore функции для использования в других модулях
export { getDoc, updateDoc, setDoc };

// ============================================================
// ЭКСПОРТИРУЕМЫЕ ФУНКЦИИ
// ============================================================

export function saveWordToDb(word) {
  if (!navigator.onLine) {
    if (window.toast) window.toast('⚠️ Нет подключения к интернету', 'warning');
    return Promise.reject('offline');
  }

  return getAuthPromise().then(user => {
    return setDoc(doc(wordsRef(user.uid), word.id), word)
      .then(() => {
        if (window.toast) window.toast('✅ Слово сохранено', 'success');
        return true;
      })
      .catch(e => {
        console.error('Save word error:', e);
        if (window.toast) window.toast('❌ Ошибка сохранения', 'danger');
        throw e;
      });
  });
}

export function deleteWordFromDb(wordId) {
  return getAuthPromise().then(user => {
    return deleteDoc(doc(wordsRef(user.uid), wordId))
      .then(() => {
        if (window.toast) window.toast('🗑️ Слово удалено', 'success');
        return true;
      })
      .catch(e => {
        if (window.toast) window.toast('❌ Ошибка удаления', 'danger');
        throw e;
      });
  });
}

export async function saveAllWordsToDb(wordsArr, silent = false) {
  if (!auth.currentUser || !wordsArr.length) return;

  try {
    const batch = writeBatch(db);
    wordsArr.forEach(word => {
      batch.set(doc(wordsRef(auth.currentUser.uid), word.id), word);
    });
    await batch.commit();
    if (!silent && window.toast) {
      window.toast('✅ Все слова сохранены', 'success');
    }
    return true;
  } catch (e) {
    console.error('Batch save error:', e);
    if (!silent && window.toast) {
      window.toast('❌ Ошибка сохранения', 'danger');
    }
    return false;
  }
}

export async function syncLocalWordsWithFirestore(localWords) {
  // Проверяем входные данные
  if (!auth.currentUser) {
    console.log('No authenticated user');
    return { success: false, reason: 'no_auth' };
  }

  // Проверяем, что localWords - это массив
  if (!Array.isArray(localWords)) {
    console.warn(
      'syncLocalWordsWithFirestore: localWords is not an array',
      localWords,
    );
    return { success: false, reason: 'invalid_words' };
  }

  try {
    const firestoreSnapshot = await getDocs(wordsRef(auth.currentUser.uid));
    const firestoreMap = new Map();
    const merged = [];
    const batch = writeBatch(db);
    let hasOperations = false;

    // Собираем слова из Firestore
    firestoreSnapshot.forEach(doc => {
      const word = { id: doc.id, ...doc.data() };
      firestoreMap.set(word.id, word);
      merged.push(word);
    });

    // Обрабатываем локальные слова
    localWords.forEach(local => {
      const remote = firestoreMap.get(local.id);
      if (!remote) {
        batch.set(doc(wordsRef(auth.currentUser.uid), local.id), local);
        merged.push(local);
        hasOperations = true;
      } else if (new Date(local.updatedAt) > new Date(remote.updatedAt)) {
        batch.set(doc(wordsRef(auth.currentUser.uid), local.id), local);
        const index = merged.findIndex(w => w.id === local.id);
        merged[index] = local;
        hasOperations = true;
      }
    });

    if (hasOperations) {
      await batch.commit();
    }

    return { success: true, mergedWords: merged };
  } catch (e) {
    console.error('Sync error:', e);
    return { success: false, error: e.message };
  }
}

export function subscribeToWords(callback) {
  if (unsubscribe) unsubscribe();
  if (!auth.currentUser) {
    console.log('No user for subscription');
    return;
  }

  try {
    const q = query(
      wordsRef(auth.currentUser.uid),
      orderBy('updatedAt', 'desc'),
    );

    unsubscribe = onSnapshot(
      q,
      snapshot => {
        const words = [];
        snapshot.forEach(doc => {
          words.push({ id: doc.id, ...doc.data() });
        });
        callback(words);
      },
      error => {
        console.error('Firestore subscription error:', error);
        // Пытаемся переподключиться
        if (window.toast) {
          window.toast('⚠️ Потеря соединения, переподключаюсь...', 'warning');
        }
      },
    );
  } catch (e) {
    console.error('Subscription setup error:', e);
  }
}

export function unsubscribeWords() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}

export async function loadAllWordsFromDb() {
  if (!auth.currentUser) {
    throw new Error('No authenticated user');
  }

  try {
    const snapshot = await getDocs(wordsRef(auth.currentUser.uid));
    const words = [];
    snapshot.forEach(doc => {
      words.push({ id: doc.id, ...doc.data() });
    });
    return words;
  } catch (error) {
    console.error('Error loading words from Firestore:', error);
    throw error;
  }
}

// Функция для получения понятного сообщения об ошибке
function getErrorMessage(error) {
  const errorMessages = {
    'permission-denied': 'Нет доступа к базе данных',
    unavailable: 'Сервис временно недоступен',
    'deadline-exceeded': 'Превышено время ожидания',
    'not-found': 'Данные не найдены',
    'already-exists': 'Данные уже существуют',
    'resource-exhausted': 'Превышен лимит запросов',
    'failed-precondition': 'Операция невозможна в текущем состоянии',
    aborted: 'Операция отменена',
    'out-of-range': 'Выход за пределы допустимого диапазона',
    unimplemented: 'Операция не поддерживается',
    internal: 'Внутренняя ошибка сервера',
    'data-loss': 'Потеря данных',
    cancelled: 'Операция отменена',
    unknown: 'Неизвестная ошибка',
    'invalid-argument': 'Неверный аргумент',
    unauthenticated: 'Требуется авторизация',
    'network-request-failed': 'Ошибка сети',
  };

  return errorMessages[error.code] || error.message || 'Неизвестная ошибка';
}

function handleReconnect() {
  if (reconnectAttempts >= maxReconnectAttempts) {
    console.error('Max reconnect attempts reached');
    if (window.toast) {
      window.toast('❌ Потеряно соединение с базой данных', 'danger');
    }
    return;
  }

  reconnectAttempts++;
  console.log(
    `Attempting to reconnect (${reconnectAttempts}/${maxReconnectAttempts})...`,
  );

  reconnectTimer = setTimeout(() => {
    subscribeToWords(window.wordsCallback);
  }, reconnectDelay);

  // Увеличиваем задержку для следующей попытки
  reconnectDelay = Math.min(reconnectDelay * 2, 30000);
}
