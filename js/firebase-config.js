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
  apiKey: "AIzaSyAiykf5IqYbnHglovdxyRzXXmrk-GtHlzQ",
  authDomain: "thiaguinho-40a14.firebaseapp.com",
  databaseURL: "https://thiaguinho-40a14-default-rtdb.firebaseio.com",
  projectId: "thiaguinho-40a14",
  storageBucket: "thiaguinho-40a14.firebasestorage.app",
  messagingSenderId: "953851363533",
  appId: "1:953851363533:web:a912b840e5d268c5d16984"
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