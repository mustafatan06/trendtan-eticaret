import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAcpnR75lrd5j2CP9Vf5Fr6u60uhGfcNWs",
  authDomain: "trendtan.firebaseapp.com",
  projectId: "trendtan",
  storageBucket: "trendtan.firebasestorage.app",
  messagingSenderId: "125062583570",
  appId: "1:125062583570:web:7ad48314a7f6864fbecfcb",
  measurementId: "G-QP720WXC7P"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);