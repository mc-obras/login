// ============================================================
// firebase-config.js — Configure suas credenciais aqui
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyArH4B84JxGLVoVqIzHSMqdmakbLIlaWTA",
  authDomain: "marques-caetano-obras.firebaseapp.com",
  projectId: "marques-caetano-obras",
  storageBucket: "marques-caetano-obras.firebasestorage.app",
  messagingSenderId: "953286188179",
  appId: "1:953286188179:web:397348af439807970a8166"
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
