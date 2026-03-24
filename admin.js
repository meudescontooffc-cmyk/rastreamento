import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* CONFIG FIREBASE */
const firebaseConfig = {
  apiKey:  "AIzaSyAdDrbZHf93zdvY3TqdUYkqTcFOJmJhLw4",
  authDomain:  "rastreamento-ad456.firebaseapp.com",
  projectId: "rastreamento-ad456",
  appId: "1:212558087501:web:a00e808856f7e80ae62304"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

/* 🔐 BLOQUEIO */
onAuthStateChanged(auth, (user)=>{
  if(!user){
    window.location.href = "index.html";
  }
});

/* ===== ELEMENTOS ===== */
const estadoInput = document.getElementById("estado");
const estadoSelect = document.getElementById("listaEstados");
const lista = document.getElementById("lista");

const numeros = [
  document.getElementById("c1"),
  document.getElementById("c2"),
  document.getElementById("c3"),
  document.getElementById("c4"),
  document.getElementById("c5"),
  document.getElementById("c6")
];

/* ===== ESTADO ===== */
estadoSelect.addEventListener("change", ()=>{
  estadoInput.value = estadoSelect.value;
  numeros[0].focus();
});

estadoInput.addEventListener("input", ()=>{
  estadoInput.value = estadoInput.value.toUpperCase().replace(/[^A-Z]/g,"");
  if(estadoInput.value.length === 2){
    numeros[0].focus();
  }
});

/* ===== NUMEROS ===== */
numeros.forEach((input, index)=>{
  input.addEventListener("input", ()=>{
    input.value = input.value.replace(/[^0-9]/g,"");
    if(input.value && index < numeros.length-1){
      numeros[index+1].focus();
    }
  });

  input.addEventListener("keydown",(e)=>{
    if(e.key==="Backspace" && !input.value && index>0){
      numeros[index-1].focus();
    }
  });
});

/* ===== GERAR CODIGO UNICO ===== */
async function gerarCodigoUnico(){

  while(true){

    const estado = estadoInput.value || "MA";
    const numero = Math.floor(100000 + Math.random() * 900000);
    const codigo = estado + "-" + numero;

    const snapshot = await getDocs(collection(db,"clientes"));

    let existe = false;

    snapshot.forEach(doc=>{
      if(doc.data().id === codigo){
        existe = true;
      }
    });

    if(!existe){
      return codigo;
    }
  }
}

/* ===== GERAR CLIENTE ===== */
window.gerarCodigo = async function(){

  const nome = prompt("Digite o nome do cliente:");

  if(!nome){
    alert("Nome obrigatório ❗");
    return;
  }

  const codigo = await gerarCodigoUnico();

  await addDoc(collection(db,"clientes"),{
    nome: nome,
    id: codigo,
    status: "ativo",
    foto: ""
  });

  alert("Cliente criado ✅\nCódigo: " + codigo);

  listarClientes();
};

/* ===== CRIAR CARD ===== */
function criarCard(c, docId){

  const card = document.createElement("div");
  card.className = "card";


  card.innerHTML = `
  <img src="${c.foto || 'https://via.placeholder.com/80'}">

  <div class="info">
    <h3>${c.nome}</h3>
    <p class="status ${c.status}">${c.status}</p>
    <p>${c.id}</p>
  </div>
<div class="acao">
  ${
    c.status === "ativo"
    ? `<button class="btn-acao btn-inativar" onclick="inativar('${docId}')">Inativar</button>`
    : `<button class="btn-acao btn-ativar" onclick="ativar('${docId}')">Ativar</button>`
  }
</div>
`;

  lista.appendChild(card);
}

/* ===== LISTAR TODOS ===== */
window.listarClientes = async function(){

  lista.innerHTML = "Carregando...";

  const snapshot = await getDocs(collection(db,"clientes"));

  lista.innerHTML = "";

  snapshot.forEach(docSnap=>{
    criarCard(docSnap.data(), docSnap.id);
  });
};

/* ===== FILTRO ATIVOS ===== */
window.verAtivos = async function(){

  lista.innerHTML = "Carregando...";

  const snapshot = await getDocs(collection(db,"clientes"));

  lista.innerHTML = "";

  snapshot.forEach(docSnap=>{
    const c = docSnap.data();
    if(c.status === "ativo"){
      criarCard(c, docSnap.id);
    }
  });
};

/* ===== FILTRO INATIVOS ===== */
window.verInativos = async function(){

  lista.innerHTML = "Carregando...";

  const snapshot = await getDocs(collection(db,"clientes"));

  lista.innerHTML = "";

  snapshot.forEach(docSnap=>{
    const c = docSnap.data();
    if(c.status === "inativo"){
      criarCard(c, docSnap.id);
    }
  });
};

/* ===== TODAS VALIDAÇÕES ===== */
window.verValidacoes = async function(){

  lista.innerHTML = "Carregando...";

  // 🔥 pega registros
  const q = query(
  collection(db,"registros"),
  orderBy("timestamp","desc")
);

const registrosSnap = await getDocs(q);

  // 🔥 pega clientes
  const clientesSnap = await getDocs(collection(db,"clientes"));

  lista.innerHTML = "";

  if(registrosSnap.empty){
    lista.innerHTML = "Sem validações ❗";
    return;
  }

  // 🔥 cria mapa de clientes (id → nome)
  const mapaClientes = {};

  clientesSnap.forEach(doc=>{
    const c = doc.data();
    mapaClientes[c.id] = c.nome;
  });

  // 🔥 monta a lista
  registrosSnap.forEach(doc=>{
    const r = doc.data();

    const nomeCliente = mapaClientes[r.clienteId] || "Desconhecido";

    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <div class="info">
        <h3>${nomeCliente}</h3>
        <p><strong>ID:</strong> ${r.clienteId}</p>
        <p><strong>Empresa:</strong> ${r.empresa}</p>
        <p><strong>Data:</strong> ${r.data} - ${r.hora}</p>
      </div>
    `;

    lista.appendChild(div);
  });

};

/* ===== BUSCAR ===== */
function pegarCodigo(){
  return estadoInput.value + "-" + numeros.map(n=>n.value).join("");
}

window.buscar = async function(){

  const codigo = pegarCodigo();

  const snapshot = await getDocs(collection(db,"clientes"));

  lista.innerHTML = "";

  let achou = false;

  snapshot.forEach(docSnap=>{
    const c = docSnap.data();

    if(c.id === codigo){
      achou = true;
      criarCard(c, docSnap.id);
    }
  });

  if(!achou){
    lista.innerHTML = "Usuário não encontrado ❌";
  }
};

/* ===== ATIVAR ===== */
window.ativar = async function(docId){

  await updateDoc(doc(db,"clientes",docId),{
    status:"ativo"
  });

  listarClientes();
};

/* ===== INATIVAR ===== */
window.inativar = async function(docId){

  await updateDoc(doc(db,"clientes",docId),{
    status:"inativo"
  });

  listarClientes();
};

