import * as firebaseApp from 'firebase/app';
import * as firebaseAuth from 'firebase/auth';
import * as firestore from 'firebase/firestore';
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
const app = !firebaseApp.getApps().length ? firebaseApp.initializeApp(firebaseConfig) : firebaseApp.getApp();


// Export Firebase services
export const auth = firebaseAuth.getAuth(app);
export const db = firestore.getFirestore(app);
export const googleProvider = new firebaseAuth.GoogleAuthProvider();
export const facebookProvider = new firebaseAuth.FacebookAuthProvider();