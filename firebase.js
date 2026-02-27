import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCyY05ii-ZZfcjD_FqqQtBNdfnVt-3JfyQ",
  authDomain: "englift-3e824.firebaseapp.com",
  projectId: "englift-3e824",
  storageBucket: "englift-3e824.firebasestorage.app",
  messagingSenderId: "724563667322",
  appId: "1:724563667322:web:c762ae65dd7cfc12424ec3"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
console.log('Firebase initialized ✅');
