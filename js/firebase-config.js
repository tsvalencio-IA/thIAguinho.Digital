// CRIE ESTE ARQUIVO DENTRO DA PASTA js COM O NOME firebase-config.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getDatabase, ref, set, push, onValue, get } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-database.js";

// =========================================================================
// COLE AQUI AS SUAS CHAVES DO FIREBASE
// Vá em Configurações do Projeto no console do Firebase e copie os dados
// =========================================================================
const firebaseConfig = {
    apiKey: "COLE_SUA_API_KEY_DO_FIREBASE_AQUI",
    authDomain: "COLE_SEU_AUTH_DOMAIN_AQUI",
    databaseURL: "COLE_SUA_DATABASE_URL_AQUI", 
    projectId: "COLE_SEU_PROJECT_ID_AQUI",
    storageBucket: "COLE_SEU_STORAGE_BUCKET_AQUI",
    messagingSenderId: "COLE_SEU_MESSAGING_SENDER_ID_AQUI",
    appId: "COLE_SEU_APP_ID_AQUI"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

export { auth, database, signInWithEmailAndPassword, signOut, onAuthStateChanged, ref, set, push, onValue, get };