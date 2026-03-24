import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, onSnapshot, addDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// SUBSTITUA AQUI PELAS SUAS CREDENCIAIS DO FIREBASE
const firebaseConfig = {
    apiKey: "SUA_API_KEY_AQUI",
    authDomain: "seu-projeto.firebaseapp.com",
    projectId: "seu-projeto",
    storageBucket: "seu-projeto.appspot.com",
    messagingSenderId: "12345",
    appId: "SUA_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "thiaguinho-saas";

export const initAuth = async () => {
    try {
        await signInAnonymously(auth);
    } catch (error) {
        console.error("Erro de Autenticação Firebase:", error);
    }
};

export { auth, db, appId, onAuthStateChanged, collection, doc, setDoc, onSnapshot, addDoc, getDoc };
