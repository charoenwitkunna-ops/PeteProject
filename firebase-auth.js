import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth,
  browserLocalPersistence,
  setPersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBkS8R5qb5ZlJOUOajhw-MeKtMZ1X8wPyc",
  authDomain: "peteproject-efc23.firebaseapp.com",
  projectId: "peteproject-efc23",
  storageBucket: "peteproject-efc23.firebasestorage.app",
  messagingSenderId: "941453009390",
  appId: "1:941453009390:web:490389ab5ab7b14b4d6eff"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Avoid blocking top-level module resolution if browser persistence errors out in strict privacy contexts
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn("Could not enable local persistence, defaulting to session:", err);
});

export {

  app,
  auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
};
