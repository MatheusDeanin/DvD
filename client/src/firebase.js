import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCw36V92G_XuKeI3dYA0uq0LwWObNfAEeA",
  authDomain: "dvd-app-45586.firebaseapp.com",
  projectId: "dvd-app-45586",
  storageBucket: "dvd-app-45586.firebasestorage.app",
  messagingSenderId: "336130949746",
  appId: "1:336130949746:web:32072d6e3b5bd71387b8eb",
  measurementId: "G-DJ1H3CHWHX"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
