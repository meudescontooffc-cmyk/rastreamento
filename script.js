import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey:  "AIzaSyAdDrbZHf93zdvY3TqdUYkqTcFOJmJhLw4",
  authDomain:  "rastreamento-ad456.firebaseapp.com",
  projectId: "rastreamento-ad456",
  appId: "1:212558087501:web:a00e808856f7e80ae62304"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let clienteAtual = null;

/* 🔐 BLOQUEIO SEM LOGIN */
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "index.html";
  }
});

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
function pegarCodigo(){
  const estado = estadoInput.value;

  const nums = numeros.map(n => n.value).join("");

  return estado + "-" + nums;
}

/* ===== BUSCAR CLIENTE ===== */
window.buscar = async function(){

  const codigo = pegarCodigo();
  const msg = document.getElementById("msg");
  const card = document.getElementById("card");

  // validação mais forte
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

    // ===== MOSTRAR DADOS =====
    const nome = document.getElementById("nome");
    const statusEl = document.getElementById("status");
    const id = document.getElementById("id");
    const foto = document.getElementById("foto");

    nome.innerText = clienteAtual.nome || "Sem nome";
    id.innerText = clienteAtual.id || "Sem ID";

    // STATUS COLORIDO
    if (clienteAtual.status === "ativo") {
      statusEl.innerText = "Ativo";
      statusEl.className = "status ativo";
    } else {
      statusEl.innerText = "Inativo";
      statusEl.className = "status inativo";
    }

    foto.src = clienteAtual.foto || "https://via.placeholder.com/90";

    // ANIMAÇÃO
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
window.validar = async function(){

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
  timestamp: Date.now() // 🔥 AQUI
});

    document.getElementById("sucesso").style.display = "block";
document.querySelector(".codigo").style.display = "none";
document.querySelector(".btn").style.display = "none";
document.getElementById("card").style.display = "none";
document.getElementById("estado").focus();

  } catch (erro) {
    console.error(erro);
    alert("Erro ao validar ❌");
  }
};

/* ===== VOLTAR ===== */
window.voltar = function(){

  // 🔄 LIMPAR INPUTS
  document.getElementById("estado").value = "";

  document.getElementById("c1").value = "";
  document.getElementById("c2").value = "";
  document.getElementById("c3").value = "";
  document.getElementById("c4").value = "";
  document.getElementById("c5").value = "";
  document.getElementById("c6").value = "";

  // 🔄 LIMPAR RESULTADO
  document.getElementById("msg").innerText = "";

  // 🔄 ESCONDER CARD
  document.getElementById("card").style.display = "none";

  // 🔄 ESCONDER TELA DE SUCESSO
  document.getElementById("sucesso").style.display = "none";

  // 🔄 MOSTRAR ÁREA NORMAL
  document.querySelector(".codigo").style.display = "flex";
  document.querySelector(".btn").style.display = "inline-block";

  // 🔥 RESETAR CLIENTE
  clienteAtual = null;

  // 🔥 FOCO NO PRIMEIRO CAMPO
  document.getElementById("estado").focus();
};