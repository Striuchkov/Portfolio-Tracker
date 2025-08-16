
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import { getAuth, GoogleAuthProvider, FacebookAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAhtOISp-677mDxbK0l2hNwgBpsb1iXH5M",
  authDomain: "portfolio-tracker-e757a.firebaseapp.com",
  projectId: "portfolio-tracker-e757a",
  storageBucket: "portfolio-tracker-e757a.appspot.com",
  messagingSenderId: "577317535032",
  appId: "1:577317535032:web:382a023b6b1b65e9f4a5c5"
};

const app = firebase.apps.length === 0 ? firebase.initializeApp(firebaseConfig) : firebase.app();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
export const facebookProvider = new FacebookAuthProvider();