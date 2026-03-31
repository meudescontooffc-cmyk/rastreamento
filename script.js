import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* 🔥 CONFIG FIREBASE */
const firebaseConfig = {
  apiKey: "AIzaSyAdDrbZHf93zdvY3TqdUYkqTcFOJmJhLw4",
  authDomain: "rastreamento-ad456.firebaseapp.com",
  projectId: "rastreamento-ad456",
  appId: "1:212558087501:web:a00e808856f7e80ae62304"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

/* 🔐 PROTEÇÃO (SÓ UMA VEZ) */
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "index.html";
  }
});

/* ================= SISTEMA ================= */

let clienteAtual = null;

/* ===== ELEMENTOS ===== */
const estadoInput = document.getElementById("estado");
const estadoSelect = document.getElementById("listaEstados");

const numeros = [
  document.getElementById("c1"),
  document.getElementById("c2"),
  document.getElementById("c3"),
  document.getElementById("c4"),
  document.getElementById("c5"),
  document.getElementById("c6")
];

/* ===== ESTADO ===== */
estadoSelect.addEventListener("change", () => {
  estadoInput.value = estadoSelect.value;
  numeros[0].focus();
});

estadoInput.addEventListener("input", () => {
  estadoInput.value = estadoInput.value.toUpperCase().replace(/[^A-Z]/g, "");

  if (estadoInput.value.length === 2) {
    numeros[0].focus();
  }
});

/* ===== NUMEROS ===== */
numeros.forEach((input, index) => {

  input.addEventListener("input", () => {
    input.value = input.value.replace(/[^0-9]/g, "");

    if (input.value && index < numeros.length - 1) {
      numeros[index + 1].focus();
    }
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" && !input.value && index > 0) {
      numeros[index - 1].focus();
    }
  });

});

/* ===== GERAR CODIGO ===== */
function pegarCodigo() {
  return estadoInput.value + "-" + numeros.map(n => n.value).join("");
}

/* ===== BUSCAR CLIENTE ===== */
window.buscar = async function () {

  const codigo = pegarCodigo();
  const msg = document.getElementById("msg");
  const card = document.getElementById("card");

  if (!estadoInput.value || codigo.length < 9) {
    msg.innerText = "Digite o código completo ❗";
    card.style.display = "none";
    return;
  }

  msg.innerText = "Buscando...";
  card.style.display = "none";

  try {
    const snapshot = await getDocs(collection(db, "clientes"));

    clienteAtual = null;

    snapshot.forEach(doc => {
      const dados = doc.data();

      if (dados.id === codigo) {
        clienteAtual = dados;
      }
    });

    if (!clienteAtual) {
      msg.innerText = "Usuário não encontrado ❌";
      return;
    }

    msg.innerText = "";

    document.getElementById("nome").innerText = clienteAtual.nome || "Sem nome";
    document.getElementById("id").innerText = clienteAtual.id || "Sem ID";

    const statusEl = document.getElementById("status");

    if (clienteAtual.status === "ativo") {
      statusEl.innerText = "Ativo";
      statusEl.className = "status ativo";
    } else {
      statusEl.innerText = "Inativo";
      statusEl.className = "status inativo";
    }

    document.getElementById("foto").src = clienteAtual.foto || "https://via.placeholder.com/90";

    card.style.display = "block";
    card.style.opacity = "0";

    setTimeout(() => {
      card.style.opacity = "1";
    }, 100);

  } catch (erro) {
    console.error(erro);
    msg.innerText = "Erro ao buscar ❌";
  }
};

/* ===== VALIDAR ===== */
window.validar = async function () {

  if (!clienteAtual) return;

  if (clienteAtual.status !== "ativo") {
    alert("Cliente inativo ❌");
    return;
  }

  const user = auth.currentUser;

  if (!user) {
    alert("Sessão expirada ❌");
    return;
  }

  const agora = new Date();

  try {
    await addDoc(collection(db, "registros"), {
      clienteId: clienteAtual.id,
      empresa: user.email,
      data: agora.toLocaleDateString(),
      hora: agora.toLocaleTimeString(),
      timestamp: Date.now()
    });

    document.getElementById("sucesso").style.display = "block";

    document.querySelector(".codigo").style.display = "none";
    document.querySelector(".btn").style.display = "none";
    document.getElementById("card").style.display = "none";
    estadoInput.focus();

  } catch (erro) {
    console.error(erro);
    alert("Erro ao validar ❌");
  }
};

/* ===== VOLTAR ===== */
window.voltar = function () {

  estadoInput.value = "";
  numeros.forEach(n => n.value = "");

  document.getElementById("msg").innerText = "";
  document.getElementById("card").style.display = "none";
  document.getElementById("sucesso").style.display = "none";

  document.querySelector(".codigo").style.display = "flex";
  document.querySelector(".btn").style.display = "inline-block";

  clienteAtual = null;

  estadoInput.focus();
};import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* 🔥 CONFIG FIREBASE */
const firebaseConfig = {
  apiKey: "AIzaSyAdDrbZHf93zdvY3TqdUYkqTcFOJmJhLw4",
  authDomain: "rastreamento-ad456.firebaseapp.com",
  projectId: "rastreamento-ad456",
  appId: "1:212558087501:web:a00e808856f7e80ae62304"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

/* 🔐 PROTEÇÃO (SÓ UMA VEZ) */
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "index.html";
  }
});

/* ================= SISTEMA ================= */

let clienteAtual = null;

/* ===== ELEMENTOS ===== */
const estadoInput = document.getElementById("estado");
const estadoSelect = document.getElementById("listaEstados");

const numeros = [
  document.getElementById("c1"),
  document.getElementById("c2"),
  document.getElementById("c3"),
  document.getElementById("c4"),
  document.getElementById("c5"),
  document.getElementById("c6")
];

/* ===== ESTADO ===== */
estadoSelect.addEventListener("change", () => {
  estadoInput.value = estadoSelect.value;
  numeros[0].focus();
});

estadoInput.addEventListener("input", () => {
  estadoInput.value = estadoInput.value.toUpperCase().replace(/[^A-Z]/g, "");

  if (estadoInput.value.length === 2) {
    numeros[0].focus();
  }
});

/* ===== NUMEROS ===== */
numeros.forEach((input, index) => {

  input.addEventListener("input", () => {
    input.value = input.value.replace(/[^0-9]/g, "");

    if (input.value && index < numeros.length - 1) {
      numeros[index + 1].focus();
    }
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" && !input.value && index > 0) {
      numeros[index - 1].focus();
    }
  });

});

/* ===== GERAR CODIGO ===== */
function pegarCodigo() {
  return estadoInput.value + "-" + numeros.map(n => n.value).join("");
}

/* ===== BUSCAR CLIENTE ===== */
window.buscar = async function () {

  const codigo = pegarCodigo();
  const msg = document.getElementById("msg");
  const card = document.getElementById("card");

  if (!estadoInput.value || codigo.length < 9) {
    msg.innerText = "Digite o código completo ❗";
    card.style.display = "none";
    return;
  }

  msg.innerText = "Buscando...";
  card.style.display = "none";

  try {
    const snapshot = await getDocs(collection(db, "clientes"));

    clienteAtual = null;

    snapshot.forEach(doc => {
      const dados = doc.data();

      if (dados.id === codigo) {
        clienteAtual = dados;
      }
    });

    if (!clienteAtual) {
      msg.innerText = "Usuário não encontrado ❌";
      return;
    }

    msg.innerText = "";

    document.getElementById("nome").innerText = clienteAtual.nome || "Sem nome";
    document.getElementById("id").innerText = clienteAtual.id || "Sem ID";

    const statusEl = document.getElementById("status");

    if (clienteAtual.status === "ativo") {
      statusEl.innerText = "Ativo";
      statusEl.className = "status ativo";
    } else {
      statusEl.innerText = "Inativo";
      statusEl.className = "status inativo";
    }

    document.getElementById("foto").src = clienteAtual.foto || "https://via.placeholder.com/90";

    card.style.display = "block";
    card.style.opacity = "0";

    setTimeout(() => {
      card.style.opacity = "1";
    }, 100);

  } catch (erro) {
    console.error(erro);
    msg.innerText = "Erro ao buscar ❌";
  }
};

/* ===== VALIDAR ===== */
window.validar = async function () {

  if (!clienteAtual) return;

  if (clienteAtual.status !== "ativo") {
    alert("Cliente inativo ❌");
    return;
  }

  const user = auth.currentUser;

  if (!user) {
    alert("Sessão expirada ❌");
    return;
  }

  const agora = new Date();

  try {
    await addDoc(collection(db, "registros"), {
      clienteId: clienteAtual.id,
      empresa: user.email,
      data: agora.toLocaleDateString(),
      hora: agora.toLocaleTimeString(),
      timestamp: Date.now()
    });

    document.getElementById("sucesso").style.display = "block";

    document.querySelector(".codigo").style.display = "none";
    document.querySelector(".btn").style.display = "none";
    document.getElementById("card").style.display = "none";
    estadoInput.focus();

  } catch (erro) {
    console.error(erro);
    alert("Erro ao validar ❌");
  }
};

/* ===== VOLTAR ===== */
window.voltar = function () {

  estadoInput.value = "";
  numeros.forEach(n => n.value = "");

  document.getElementById("msg").innerText = "";
  document.getElementById("card").style.display = "none";
  document.getElementById("sucesso").style.display = "none";

  document.querySelector(".codigo").style.display = "flex";
  document.querySelector(".btn").style.display = "inline-block";

  clienteAtual = null;

  estadoInput.focus();
};
