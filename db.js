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

// Ждёт авторизацию и выполняет fn(user)
function whenAuthed(fn) {
  if (auth.currentUser) {
    fn(auth.currentUser);
  } else {
    getAuthPromise().then(user => {
      fn(user);
    });
  }
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
  return new Promise((resolve, reject) => {
    whenAuthed(user => {
      deleteDoc(doc(wordsRef(user.uid), wordId))
        .then(resolve)
        .catch(reject);
    });
  });
}

export async function saveAllWordsToDb(wordsArr) {
  if (!auth.currentUser || !wordsArr.length) return;

  try {
    window.showLoading?.('Сохранение слов в облаке...');
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
    window.hideLoading?.();
  }
}

export async function syncLocalWordsWithFirestore(localWords) {
  if (!auth.currentUser || !localWords.length)
    return { success: false, reason: 'no_auth_or_no_words' };

  try {
    window.showLoading?.('Синхронизация данных...');

    // Получаем все слова из Firestore
    const snapshot = await getDocs(wordsRef(auth.currentUser.uid));
    const firestoreWords = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    const firestoreMap = new Map(firestoreWords.map(w => [w.id, w]));

    const batch = writeBatch(db);
    const merged = [];

    // Сначала добавляем все слова из Firestore
    firestoreWords.forEach(w => merged.push(w));

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
        // заменяем в merged на локальную версию
        const index = merged.findIndex(w => w.id === local.id);
        merged[index] = local;
      }
      // если remote новее – ничего не делаем, merged уже содержит remote
    });

    if (batch._ops.length > 0) {
      await batch.commit();
    }

    window.hideLoading?.();
    return { success: true, mergedWords: merged };
  } catch (e) {
    console.error('syncLocalWordsWithFirestore error:', e);
    if (window.toast) {
      window.toast('❌ Ошибка синхронизации: ' + getErrorMessage(e), 'danger');
    }
    window.hideLoading?.();
    return { success: false, error: e };
  }
}

// Автоматическое переподключение при ошибках сети
function scheduleReconnect(callback) {
  if (reconnectAttempts >= maxReconnectAttempts) {
    console.error('Превышено максимальное количество попыток переподключения');
    if (window.updateSyncIndicator) {
      window.updateSyncIndicator('error', 'Ошибка сети');
    }
    if (window.toast) {
      window.toast(
        '❌ Не удалось восстановить соединение. Проверьте интернет-соединение.',
        'danger',
        10000,
      );
    }
    return;
  }

  reconnectAttempts++;
  const delay = reconnectDelay * Math.pow(2, reconnectAttempts - 1); // Экспоненциальная задержка

  console.log(
    `Попытка переподключения ${reconnectAttempts}/${maxReconnectAttempts} через ${delay}мс`,
  );

  if (window.updateSyncIndicator) {
    window.updateSyncIndicator(
      'syncing',
      `Переподключение... (${reconnectAttempts}/${maxReconnectAttempts})`,
    );
  }

  reconnectTimer = setTimeout(() => {
    if (navigator.onLine) {
      callback();
    } else {
      scheduleReconnect(callback);
    }
  }, delay);
}

// Сброс счетчика переподключений
function resetReconnectAttempts() {
  reconnectAttempts = 0;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

export function subscribeToWords(callback) {
  if (unsubscribe) unsubscribe();
  if (!auth.currentUser) return;

  const attemptSubscription = () => {
    if (unsubscribe) unsubscribe();

    try {
      // Обновляем индикатор синхронизации
      if (window.updateSyncIndicator) {
        window.updateSyncIndicator('syncing', 'Подключение к облаку...');
      }

      const q = query(
        wordsRef(auth.currentUser.uid),
        orderBy('createdAt', 'desc'),
      );
      unsubscribe = onSnapshot(
        q,
        snapshot => {
          const firestoreWords = snapshot.docs.map(d => d.data());
          callback(firestoreWords);

          // Сохраняем данные в localStorage для офлайн-доступа
          if (window.save) {
            window.save();
          }

          // Обновляем индикатор синхронизации
          if (window.updateSyncIndicator) {
            window.updateSyncIndicator('synced', 'Синхронизировано');
          }

          // Сбрасываем счетчик переподключений при успешном подключении
          resetReconnectAttempts();
        },
        error => {
          console.error('subscribeToWords error:', error);

          // Обновляем индикатор при ошибке
          if (window.updateSyncIndicator) {
            window.updateSyncIndicator('error', 'Ошибка синхронизации');
          }

          // Проверяем, это сетевая ошибка или другая проблема
          const isNetworkError =
            error.code === 'unavailable' ||
            error.code === 'deadline-exceeded' ||
            error.message.includes('network') ||
            !navigator.onLine;

          if (isNetworkError) {
            // Планируем переподключение для сетевых ошибок
            scheduleReconnect(attemptSubscription);
          } else {
            // Для других ошибок не пытаемся переподключиться
            if (window.toast) {
              window.toast(
                '❌ Ошибка загрузки данных: ' + getErrorMessage(error),
                'danger',
              );
            }
            if (window.showSyncStatus) {
              window.showSyncStatus('error', 'Ошибка загрузки');
            }
          }

          // Проверяем, отсутствует ли индекс
          if (
            error.code === 'failed-precondition' &&
            error.message.includes('index')
          ) {
            if (window.toast) {
              window.toast(
                '⚠️ Требуется индекс в Firestore. Пожалуйста, создайте индекс для коллекции words по полю createdAt (descending).',
                'warning',
                10000,
              );
            }
            // Пробуем fallback без сортировки
            try {
              const fallbackQuery = query(wordsRef(auth.currentUser.uid));
              unsubscribe = onSnapshot(
                fallbackQuery,
                snapshot => {
                  const firestoreWords = snapshot.docs.map(d => d.data());
                  callback(firestoreWords);

                  if (window.save) {
                    window.save();
                  }

                  if (window.updateSyncIndicator) {
                    window.updateSyncIndicator('synced', 'Синхронизировано');
                  }

                  resetReconnectAttempts();
                },
                fallbackError => {
                  console.error('Fallback query also failed:', fallbackError);
                  if (window.toast) {
                    window.toast('❌ Не удалось загрузить данные', 'danger');
                  }
                  if (window.updateSyncIndicator) {
                    window.updateSyncIndicator('error', 'Ошибка загрузки');
                  }
                  // Планируем переподключение и для fallback
                  scheduleReconnect(attemptSubscription);
                },
              );
            } catch (fallbackErr) {
              console.error('Fallback setup failed:', fallbackErr);
              scheduleReconnect(attemptSubscription);
            }
          }
        },
      );
    } catch (e) {
      console.error('subscribeToBytes setup error:', e);
      if (window.toast) {
        window.toast('❌ Не удалось подключиться к облаку', 'danger');
      }
      if (window.updateSyncIndicator) {
        window.updateSyncIndicator('error', 'Ошибка подключения');
      }
      // Планируем переподключение при ошибке установки
      scheduleReconnect(attemptSubscription);
    }
  };

  // Начинаем первую попытку подписки
  attemptSubscription();
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
