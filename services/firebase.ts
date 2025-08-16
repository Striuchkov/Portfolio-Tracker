import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, FacebookAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
//conf
const firebaseConfig = {
  apiKey: "AIzaSyAhtOISp-677mDxbK0l2hNwgBpsb1iXH5M",
  authDomain: "portfolio-tracker-e757a.firebaseapp.com",
  projectId: "portfolio-tracker-e757a",
  storageBucket: "portfolio-tracker-e757a.firebasestorage.app",
  messagingSenderId: "386776023111",
  appId: "1:386776023111:web:6aeb1f63812bef5090f162"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();


// Export Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
export const facebookProvider = new FacebookAuthProvider();