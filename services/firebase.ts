import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, FacebookAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAhtOISp-677mDxbK0l2hNwgBpsb1iXH5M",
  authDomain: "portfolio-tracker-e757a.firebaseapp.com",
  projectId: "portfolio-tracker-e757a",
  storageBucket: "portfolio-tracker-e75