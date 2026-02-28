import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  writeBatch,
} from 'firebase/firestore';
import { db, auth } from './firebase.js';
import { onAuthStateChanged } from 'firebase/auth';

let unsubscribe = null;

// Ждёт авторизацию и выполняет fn(user)
function whenAuthed(fn) {
  if (auth.currentUser) {
    fn(auth.currentUser);
  } else {
    const unsub = onAuthStateChanged(auth, user => {
      if (user) {
        unsub();
        fn(user);
      }
    });
  }
}

function wordsRef(uid) {
  return collection(db, 'users', uid, 'words');
}

export function saveWordToDb(word) {
  whenAuthed(user => {
    setDoc(doc(wordsRef(user.uid), word.id), word)
      .then(() => {
        console.log('Word saved successfully:', word.en);
      })
      .catch(e => {
        console.error('saveWordToDb error:', e);
        // Показываем уведомление об ошибке пользователю
        if (window.toast) {
          window.toast(
            '❌ Ошибка сохранения слова: ' + getErrorMessage(e),
            'danger',
          );
        }
        if (window.showSyncStatus) {
          window.showSyncStatus('error', 'Ошибка сохранения');
        }
      });
  });
}

export function deleteWordFromDb(wordId) {
  whenAuthed(user => {
    deleteDoc(doc(wordsRef(user.uid), wordId))
      .then(() => {
        console.log('Word deleted successfully:', wordId);
      })
      .catch(e => {
        console.error('deleteWordFromDb error:', e);
        // Показываем уведомление об ошибке пользователю
        if (window.toast) {
          window.toast(
            '❌ Ошибка удаления слова: ' + getErrorMessage(e),
            'danger',
          );
        }
        if (window.showSyncStatus) {
          window.showSyncStatus('error', 'Ошибка удаления');
        }
      });
  });
}

export async function saveAllWordsToDb(wordsArr) {
  if (!auth.currentUser || !wordsArr.length) return;

  try {
    showLoading('Сохранение слов в облаке...');
    const batch = writeBatch(db);
    wordsArr.forEach(w => {
      batch.set(doc(wordsRef(auth.currentUser.uid), w.id), w);
    });
    await batch.commit();
    console.log(`Successfully saved ${wordsArr.length} words to Firestore`);
    return true;
  } catch (e) {
    console.error('saveAllWordsToDb error:', e);
    if (window.toast) {
      window.toast('❌ Ошибка синхронизации: ' + getErrorMessage(e), 'danger');
    }
    return false;
  } finally {
    hideLoading();
  }
}

export function subscribeToWords(callback) {
  if (unsubscribe) unsubscribe();
  if (!auth.currentUser) return;

  try {
    const q = query(
      wordsRef(auth.currentUser.uid),
      orderBy('createdAt', 'desc'),
    );
    unsubscribe = onSnapshot(
      q,
      snapshot => {
        callback(snapshot.docs.map(d => d.data()));
      },
      error => {
        console.error('subscribeToWords error:', error);
        if (window.toast) {
          window.toast(
            '❌ Ошибка загрузки данных: ' + getErrorMessage(error),
            'danger',
          );
        }
        if (window.showSyncStatus) {
          window.showSyncStatus('error', 'Ошибка загрузки');
        }
      },
    );
  } catch (e) {
    console.error('subscribeToBytes setup error:', e);
    if (window.toast) {
      window.toast('❌ Не удалось подключиться к облаку', 'danger');
    }
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
    unauthenticated: 'Требуется авторизация',
    'network-request-failed': 'Ошибка сети',
  };

  return errorMessages[error.code] || error.message || 'Неизвестная ошибка';
}

export function unsubscribeWords() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}
