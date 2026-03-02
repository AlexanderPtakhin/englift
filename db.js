import { db } from './firebase.js';
import { auth } from './firebase.js';
import {
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  limit,
  onSnapshot,
  writeBatch,
  where,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

// Защита от отсутствия document
if (typeof document === 'undefined' || !document.addEventListener) {
  console.log(
    'db.js: Document not available, running in worker/non-DOM context',
  );
}

let unsubscribe = null;
let reconnectAttempts = 0;
let maxReconnectAttempts = 5;
let reconnectDelay = 1000; // Начальная задержка 1 секунда
let reconnectTimer = null;

// Централизованное ожидание авторизации
let authPromise = null;
let authResolve = null;

function getAuthPromise() {
  if (!authPromise) {
    authPromise = new Promise(resolve => {
      authResolve = resolve;
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

function whenAuthed(callback) {
  return getAuthPromise().then(callback);
}

function wordsRef(uid) {
  return collection(db, 'users', uid, 'words');
}

export function saveWordToDb(word) {
  // Проверяем наличие интернета
  if (!navigator.onLine) {
    if (window.toast) {
      window.toast('⚠️ Нет подключения к интернету', 'warning');
    }
    return;
  }

  whenAuthed(user => {
    setDoc(doc(wordsRef(user.uid), word.id), word)
      .then(() => {
        if (window.toast) window.toast('✅ Слово сохранено', 'success');
      })
      .catch(e => {
        if (window.toast) window.toast('❌ Ошибка сохранения', 'danger');
        console.error('Save word error:', e);
      });
  });
}

export function deleteWordFromDb(wordId) {
  return new Promise((resolve, reject) => {
    whenAuthed(user => {
      deleteDoc(doc(wordsRef(user.uid), wordId))
        .then(() => {
          if (window.toast) window.toast('🗑️ Слово удалено', 'success');
          resolve();
        })
        .catch(e => {
          if (window.toast) window.toast('❌ Ошибка удаления', 'danger');
          reject(e);
        });
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
    // Убираем тост при успешном сохранении
    // if (!silent && window.toast) {
    //   window.toast('✅ Все слова сохранены', 'success');
    // }
  } catch (e) {
    console.error('Batch save error:', e);
    // Показываем ошибку только если это не тихий режим
    if (!silent && window.toast) {
      window.toast('❌ Ошибка сохранения', 'danger');
    }
  }
}

export async function syncLocalWordsWithFirestore(localWords) {
  if (
    !auth.currentUser ||
    !localWords ||
    !Array.isArray(localWords) ||
    localWords.length === 0
  )
    return { success: false, reason: 'no_auth_or_no_words' };

  try {
    const firestoreWords = await getDocs(wordsRef(auth.currentUser.uid));
    const firestoreMap = new Map();
    const merged = [];
    const batch = writeBatch(db);

    // Собираем слова из Firestore
    firestoreWords.forEach(doc => {
      const word = { id: doc.id, ...doc.data() };
      firestoreMap.set(word.id, word);
      merged.push(word);
    });

    // Обрабатываем локальные слова
    localWords.forEach(local => {
      const remote = firestoreMap.get(local.id);
      if (!remote) {
        // Новое слово – сохраняем в Firestore и добавляем в merged
        batch.set(doc(wordsRef(auth.currentUser.uid), local.id), local);
        merged.push(local);
      } else if (new Date(local.updatedAt) > new Date(remote.updatedAt)) {
        // Локальная версия новее – обновляем в Firestore
        batch.set(doc(wordsRef(auth.currentUser.uid), local.id), local);
        const index = merged.findIndex(w => w.id === local.id);
        merged[index] = local;
      }
      // если remote новее – ничего не делаем, merged уже содержит remote
    });

    if (batch._ops.length > 0) {
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
  if (!auth.currentUser) return;

  const q = query(wordsRef(auth.currentUser.uid), orderBy('updatedAt', 'desc'));

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
      // Попытка переподключения
      handleReconnect();
    },
  );
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
    const wordsCollection = collection(
      db,
      'users',
      auth.currentUser.uid,
      'words',
    );
    const querySnapshot = await getDocs(wordsCollection);
    const words = [];

    querySnapshot.forEach(doc => {
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
