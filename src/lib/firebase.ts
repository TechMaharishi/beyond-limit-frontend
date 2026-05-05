import { initializeApp } from "firebase/app";
import { getMessaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyCWIxS6qJpoRN108iCrpUoUG2KvdMZ17sc",
  authDomain: "blpt-be0f8.firebaseapp.com",
  projectId: "blpt-be0f8",
  storageBucket: "blpt-be0f8.firebasestorage.app",
  messagingSenderId: "620378812855",
  appId: "1:620378812855:web:3a86598c52242206f8b832",
  measurementId: "G-TC9CFYL1DR",
};

export const firebaseApp = initializeApp(firebaseConfig);
export const messaging = getMessaging(firebaseApp);
