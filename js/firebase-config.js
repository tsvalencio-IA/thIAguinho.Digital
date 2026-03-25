// NOME DO FICHEIRO: firebase-config.js
// LOCALIZAÇÃO: Dentro da pasta 'js'

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getDatabase, ref, set, push, onValue, get } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-database.js";

// =======================================================================================
// ATENÇÃO MÁXIMA: SE ESTAS CHAVES ESTIVEREM VAZIAS, O BOTÃO DE LOGIN NÃO FUNCIONA.
// Vá a console.firebase.google.com > Definições do Projeto > Geral > Os seus ecrãs Web.
// =======================================================================================
const firebaseConfig = {
    apiKey: "COLE_A_SUA_API_KEY_AQUI",
    authDomain: "COLE_O_SEU_AUTH_DOMAIN_AQUI",
    databaseURL: "COLE_A_SUA_DATABASE_URL_AQUI", 
    projectId: "COLE_O_SEU_PROJECT_ID_AQUI",
    storageBucket: "COLE_O_SEU_STORAGE_BUCKET_AQUI",
    messagingSenderId: "COLE_O_SEU_MESSAGING_SENDER_ID_AQUI",
    appId: "COLE_O_SEU_APP_ID_AQUI"
};

let app, auth, database;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    database = getDatabase(app);
    console.log("Firebase ligado com sucesso!");
} catch (error) {
    console.error("ERRO FATAL NO FIREBASE (Verifique as suas chaves):", error);
    alert("Falha ao ligar ao Firebase. Verifique o ficheiro firebase-config.js");
}

export { auth, database, signInWithEmailAndPassword, signOut, onAuthStateChanged, ref, set, push, onValue, get };