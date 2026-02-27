import { 
  collection, doc, setDoc, deleteDoc, 
  onSnapshot, query, orderBy,
  writeBatch
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
      if (user) { unsub(); fn(user); }
    });
  }
}

function wordsRef(uid) {
  return collection(db, 'users', uid, 'words');
}

export function saveWordToDb(word) {
  whenAuthed(user => {
    setDoc(doc(wordsRef(user.uid), word.id), word)
      .catch(e => console.error('saveWordToDb error:', e));
  });
}

export function deleteWordFromDb(wordId) {
  whenAuthed(user => {
    deleteDoc(doc(wordsRef(user.uid), wordId))
      .catch(e => console.error('deleteWordFromDb error:', e));
  });
}

export async function saveAllWordsToDb(wordsArr) {
  if (!auth.currentUser || !wordsArr.length) return;
  const batch = writeBatch(db);
  wordsArr.forEach(w => {
    batch.set(doc(wordsRef(auth.currentUser.uid), w.id), w);
  });
  await batch.commit();
}

export function subscribeToWords(callback) {
  if (unsubscribe) unsubscribe();
  if (!auth.currentUser) return;
  const q = query(wordsRef(auth.currentUser.uid), orderBy('createdAt', 'desc'));
  unsubscribe = onSnapshot(q, snapshot => {
    callback(snapshot.docs.map(d => d.data()));
  });
}

export function unsubscribeWords() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
}
