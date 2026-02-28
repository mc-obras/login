// ============================================================
// firebase-config.js — Configure suas credenciais aqui
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyDxIWtcWhyXcelszSwkGw623jmMU6UoNiY",
    authDomain: "marques-caetano-obras-bcef6.firebaseapp.com",
    projectId: "marques-caetano-obras-bcef6",
    storageBucket: "marques-caetano-obras-bcef6.firebasestorage.app",
    messagingSenderId: "542851788810",
    appId: "1:542851788810:web:98271256d48147d0ff2ff3"
};

firebase.initializeApp(firebaseConfig);

const db      = firebase.firestore();
const auth    = firebase.auth();
const storage = firebase.storage();

const EMPRESA_ID = "marques-caetano";

// ============================================================
// CHAVE OCR.space — Leitura automática de OC (GRATUITO)
// 1. A chave "helloworld" já está configurada para testes
// 2. Para produção: cadastre em https://ocr.space/ocrapi (gratuito)
//    e substitua "helloworld" pela sua chave pessoal
// Limite gratuito: 500 req/dia, 25.000/mês — mais que suficiente
// ============================================================
window.OCRSPACE_API_KEY = "K86359532788957";  // substitua pela sua chave pessoal se necessário
