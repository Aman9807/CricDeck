import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAAOJ1YbjOch-FAo1RErijGLSUOqIkkogE",
  authDomain: "falix-cde0c.firebaseapp.com",
  projectId: "falix-cde0c",
  storageBucket: "falix-cde0c.firebasestorage.app",
  messagingSenderId: "1063248423040",
  appId: "1:1063248423040:web:80d426c16f6551e902de65",
  measurementId: "G-8945NCMBQB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
};
