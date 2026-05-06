// 🔽 IMPORTS
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  doc,
  updateDoc,
  increment
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";


// 🔥 FIREBASE
const firebaseConfig = {
  apiKey:  "AIzaSyAdDrbZHf93zdvY3TqdUYkqTcFOJmJhLw4",
  authDomain:  "rastreamento-ad456.firebaseapp.com",
  projectId: "rastreamento-ad456",
  appId: "1:212558087501:web:a00e808856f7e80ae62304"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);


// 🔐 LOGIN / SESSÃO SEGURA
let empresaLogada = null;
let clienteAtual = null;
let dadosEmpresaCliente = null;
let buscandoAgora = false;
let tokenBusca = 0;


// 🔥 PROTEÇÃO REAL PELO FIREBASE AUTH
onAuthStateChanged(auth, async (user) => {

  if (!user) {
    window.location.href = "index.html";
    return;
  }

  // 🔥 AGORA USA UID (mais seguro)
  empresaLogada = user.uid;

  await carregarUltimasValidacoes();

});


// 🚪 SAIR
window.sair = async () => {

  try {
    await signOut(auth);
  } catch (erro) {
    console.error("Erro ao sair:", erro);
  }

  window.location.href = "index.html";
};


// 🔹 ELEMENTOS
const estadoSelect = document.getElementById("listaEstados");

const numeros = ["c1","c2","c3","c4","c5","c6"].map(id =>
  document.getElementById(id)
);

const valorInput = document.getElementById("valor");
const tipoDesconto = document.getElementById("tipoDesconto");
const descontoInput = document.getElementById("desconto");
const totalInput = document.getElementById("total");
const infoDesconto = document.getElementById("infoDesconto");

const card = document.getElementById("card");
const sucesso = document.getElementById("sucesso");
const msg = document.getElementById("msg");


// 🔢 CAMPOS CÓDIGO
numeros.forEach((input, i) => {

  input.addEventListener("input", () => {

    input.value = input.value.replace(/\D/g, "");

    if (input.value && i < numeros.length - 1) {
      numeros[i + 1].focus();
    }

  });

  input.addEventListener("keydown", (e) => {

    if (e.key === "Backspace" && !input.value && i > 0) {
      numeros[i - 1].focus();
    }

  });

});


// 💰 FORMATA MOEDA
function moeda(valor) {

  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

}


// 🔥 ANIMAR NÚMEROS
function animarNumero(el, valorFinal, dinheiro = false) {

  let atual = 0;
  const passos = 30;
  const soma = valorFinal / passos;

  const timer = setInterval(() => {

    atual += soma;

    if (atual >= valorFinal) {
      atual = valorFinal;
      clearInterval(timer);
    }

    el.innerText = dinheiro
      ? moeda(atual)
      : Math.floor(atual);

  }, 20);

}


// 🔢 PEGAR CÓDIGO
function pegarCodigo() {

  const uf = estadoSelect.value.trim().toUpperCase();
  const nums = numeros.map(n => n.value.trim()).join("");

  return `${uf}-${nums}`;

}


// 🧹 LIMPAR CÓDIGO
function limparCodigo() {

  estadoSelect.value = "";

  numeros.forEach(n => n.value = "");

  numeros[0].focus();

}


// 🔥 BUSCAR DADOS CLIENTE X EMPRESA
async function buscarDadosEmpresaCliente(clienteId) {

  dadosEmpresaCliente = null;

  try {

    const q = query(
      collection(db, "clientesEmpresa"),
      where("clienteId", "==", clienteId),
      where("empresa", "==", empresaLogada),
      limit(1)
    );

    const snap = await getDocs(q);

    if (!snap.empty) {
      dadosEmpresaCliente = {
        docId: snap.docs[0].id,
        ...snap.docs[0].data()
      };
    }

  } catch (erro) {
    console.error("Erro clientesEmpresa:", erro);
  }

}


// 🔍 BUSCAR CLIENTE
window.buscar = async () => {

  if (buscandoAgora) return;

  buscandoAgora = true;
  tokenBusca++;

  const buscaAtual = tokenBusca;

  const ultimos = document.getElementById("ultimasValidacoes");

  if (ultimos) ultimos.style.display = "none";

  if (!empresaLogada) {
    msg.innerText = "Carregando sessão...";
    buscandoAgora = false;
    return;
  }

  const codigo = pegarCodigo();

  if (!estadoSelect.value || codigo.length < 9) {
    mostrarMensagem("Digite o código completo ❗");
    buscandoAgora = false;
    return;
  }

  msg.innerText = "Buscando...";

  try {

    const q = query(
      collection(db, "clientes"),
      where("id", "==", codigo),
      limit(1)
    );

    const snap = await getDocs(q);

    if (snap.empty) {

      msg.innerText = "Usuário não encontrado ❌";

      if (ultimos) ultimos.style.display = "block";

      buscandoAgora = false;
      return;
    }

    document.getElementById("foto").src = "";

    clienteAtual = snap.docs[0].data();

    if (buscaAtual !== tokenBusca) {
      buscandoAgora = false;
      return;
    }

    await buscarDadosEmpresaCliente(clienteAtual.id);

    document.getElementById("nome").innerText =
      clienteAtual.nome || "Sem nome";

    document.getElementById("id").innerText =
      clienteAtual.id || "---";

    const fotoEl = document.getElementById("foto");

    fotoEl.src = "https://via.placeholder.com/100";

    setTimeout(() => {

      if (buscaAtual !== tokenBusca) return;

      fotoEl.src =
        clienteAtual.foto || "https://via.placeholder.com/100";

    }, 80);

    const status = document.getElementById("status");

    if (clienteAtual.status === "ativo") {
      status.innerText = "● Ativo";
      status.className = "status ativo";
    } else {
      status.innerText = "● Inativo";
      status.className = "status inativo";
    }
// 🔥 TOTAL COM DESCONTO (valor realmente pago)
    animarNumero(
      document.getElementById("totalCompras"),
      Number(dadosEmpresaCliente?.totalGasto || 0),
      true
    );

    animarNumero(
      document.getElementById("usos"),
      Number(dadosEmpresaCliente?.usos || 0),
      false
    );

    msg.innerText = "";

    card.classList.remove("hidden");
    card.classList.add("show");

    sucesso.classList.remove("show");
    sucesso.classList.add("hidden");

    limparCampos();

    await carregarHistorico();

    // 🔥 sobe tela
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

  } catch (erro) {

    console.error("Erro ao buscar cliente:", erro);

    msg.innerText = "Erro ao buscar ❌";

    if (ultimos) ultimos.style.display = "block";

  } finally {

    buscandoAgora = false;

  }

};


// 💰 CAMPO VALOR
valorInput.addEventListener("input", () => {

  let valor = valorInput.value.replace(/\D/g, "");

  valor = (Number(valor) / 100).toFixed(2);

  valorInput.value =
    "R$ " + valor.replace(".", ",");

  calcular();

});


// 🔻 SELECT DESCONTO
tipoDesconto.addEventListener("change", () => {

  if (tipoDesconto.value === "manual") {

    descontoInput.style.display = "block";
    descontoInput.focus();

  } else {

    descontoInput.style.display = "none";
    descontoInput.value = "";

  }

  calcular();

});


// 🔴 INPUT %
descontoInput.addEventListener("input", () => {

  let valor = descontoInput.value.replace(/\D/g, "");

  if (Number(valor) > 100) valor = "100";

  descontoInput.value = valor + "%";

  calcular();

});


// 🔢 DESCONTO ATUAL
function descontoAtual() {

  if (tipoDesconto.value === "manual") {

    return parseFloat(
      descontoInput.value.replace("%", "")
    ) || 0;

  }

  return parseFloat(tipoDesconto.value || 0);

}


// 💰 CALCULAR
function calcular() {

  let valor = valorInput.value
    .replace("R$", "")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();

  valor = parseFloat(valor || 0);

  const desconto = descontoAtual();

  const valorDesconto =
    (valor * desconto) / 100;

  const total =
    Math.max(valor - valorDesconto, 0);

  totalInput.value =
    valor > 0 ? moeda(total) : "";

  infoDesconto.innerText =
    `Desconto aplicado: ${moeda(valorDesconto)} (${desconto}%)`;

}


// 🧾 HISTÓRICO CLIENTE (últimas 5)
async function carregarHistorico() {

  const tbody =
    document.getElementById("listaHistorico");

  if (!clienteAtual?.id) {
    tbody.innerHTML = `
      <tr class="empty">
        <td colspan="5">Cliente inválido</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = `
    <tr class="empty">
      <td colspan="5">Carregando...</td>
    </tr>
  `;

  try {

    const q = query(
      collection(db, "validacoes"),
      where("clienteId", "==", clienteAtual.id),
      where("empresa", "==", empresaLogada),
      orderBy("timestamp", "desc"),
      limit(5)
    );

    const snap = await getDocs(q);

    if (snap.empty) {

      tbody.innerHTML = `
        <tr class="empty">
          <td colspan="5">Nenhum registro encontrado</td>
        </tr>
      `;

      return;
    }

    tbody.innerHTML = "";

    snap.forEach((docu) => {

      const d = docu.data();

      tbody.innerHTML += `
        <tr>
          <td>${d.data || "--/--/----"}</td>
          <td>${d.hora || "--:--"}</td>
          <td>${moeda(d.valor || 0)}</td>
          <td>${Number(d.desconto || 0)}%</td>
          <td>${moeda(d.total || 0)}</td>
        </tr>
      `;

    });

  } catch (erro) {

    console.error("Erro histórico:", erro);

    tbody.innerHTML = `
      <tr class="empty">
        <td colspan="5">Erro ao carregar</td>
      </tr>
    `;

  }

}// 🔥 ÚLTIMAS VALIDAÇÕES
async function carregarUltimasValidacoes() {

  const box = document.getElementById("listaUltimos");

  if (!box || !empresaLogada) return;

  box.innerHTML = "Carregando...";

  try {

    const q = query(
      collection(db, "clientesEmpresa"),
      where("empresa", "==", empresaLogada),
      orderBy("ultimaValidacao", "desc"),
      limit(5)
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      box.innerHTML = "Nenhuma validação encontrada";
      return;
    }

    box.innerHTML = "";

    snap.forEach((docu) => {

      const d = docu.data();

      const dataFormatada =
        d.ultimaData || "--/--/----";

      const horaFormatada =
        d.ultimaHora || "--:--";

      box.innerHTML += `
        <div class="item-historico">

          <div class="dados-historico">

            <div class="topo-historico">

              <strong>${d.nome || d.clienteId}</strong>

              <button
                class="btn-detalhes"
                onclick="verDetalhes('${d.clienteId}')">
                Ver detalhes
              </button>

            </div>

            <span>ID: ${d.clienteId || "---"}</span>
            <span>Total: ${moeda(d.totalGasto || 0)}</span>
            <span>Usos: ${Number(d.usos || 0)}</span>
            <span>${dataFormatada} ${horaFormatada}</span>

          </div>

        </div>
      `;

    });

  } catch (erro) {

    console.error("Erro últimas validações:", erro);

    box.innerHTML = "Erro ao carregar";

  }

}


// 🔍 VER DETALHES
window.verDetalhes = async (id) => {

  const modal =
    document.getElementById("modalDetalhes");

  const box =
    document.getElementById("conteudoDetalhes");

  modal.classList.remove("hidden");
  modal.classList.add("show");

  box.innerHTML = "Carregando...";

  try {

    const q = query(
      collection(db, "validacoes"),
      where("empresa", "==", empresaLogada),
      where("clienteId", "==", id),
      orderBy("timestamp", "desc"),
      limit(50)
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      box.innerHTML = "Nenhum detalhe encontrado";
      return;
    }

    box.innerHTML = "";

    const docs = snap.docs;
    const primeiro = docs[0].data();

    // 🔥 última validação destaque
    box.innerHTML += `
      <div style="
        background:#111111;
        color:#fff;
        padding:16px;
        border-radius:16px;
        margin-bottom:14px;
        border:1px solid rgba(255,215,0,.14);
      ">

        <strong style="
          color:#ffd700;
          font-size:16px;
        ">
          Última validação
        </strong>

        <br><br>

        ${primeiro.data || "--"} ${primeiro.hora || "--"}<br>
        Valor: ${moeda(primeiro.valor || 0)}<br>
        Desconto: ${Number(primeiro.desconto || 0)}%<br>
        Total pago: ${moeda(primeiro.total || 0)}

      </div>
    `;

    // 🔥 mostra só 5
    docs.slice(0, 5).forEach((docu) => {

      const d = docu.data();

      box.innerHTML += `
        <div class="linha-detalhe">

          <span>
            ${d.data || "--"} ${d.hora || "--"}
          </span>

          <span>${moeda(d.valor || 0)}</span>

          <span>
            ${Number(d.desconto || 0)}%
          </span>

          <span>${moeda(d.total || 0)}</span>

        </div>
      `;

    });

    // 🔥 botão ver mais
    if (docs.length > 5) {

      box.innerHTML += `
        <div class="mais-box">

          <button
            class="btn btn-primary"
            onclick="mostrarMaisDetalhes('${id}')">

            Ver mais

          </button>

        </div>
      `;

    }

  } catch (erro) {

    console.error("Erro detalhes:", erro);

    box.innerHTML = "Erro ao carregar";

  }

};


// 🔥 VER MAIS NO MODAL
window.mostrarMaisDetalhes = async (id) => {

  const box =
    document.getElementById("conteudoDetalhes");

  box.innerHTML = "Carregando...";

  try {

    const q = query(
      collection(db, "validacoes"),
      where("empresa", "==", empresaLogada),
      where("clienteId", "==", id),
      orderBy("timestamp", "desc"),
      limit(50)
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      box.innerHTML = "Nenhum detalhe encontrado";
      return;
    }

    box.innerHTML = "";

    snap.forEach((docu) => {

      const d = docu.data();

      box.innerHTML += `
        <div class="linha-detalhe">

          <span>
            ${d.data || "--"} ${d.hora || "--"}
          </span>

          <span>${moeda(d.valor || 0)}</span>

          <span>
            ${Number(d.desconto || 0)}%
          </span>

          <span>${moeda(d.total || 0)}</span>

        </div>
      `;

    });

  } catch (erro) {

    console.error("Erro ver mais:", erro);

    box.innerHTML = "Erro ao carregar";

  }

};

// ❌ FECHAR MODAL
window.fecharDetalhes = () => {

  const modal =
    document.getElementById("modalDetalhes");

  if (!modal) return;

  modal.classList.remove("show");
  modal.classList.add("hidden");

};


// 🔔 MENSAGENS
let timerMsg = null;

function mostrarMensagem(texto) {

  msg.innerText = texto;
  msg.style.display = "block";

  clearTimeout(timerMsg);

  timerMsg = setTimeout(() => {
    msg.innerText = "";
  }, 4000);

}


// ✅ VALIDAR
window.validar = async () => {

  if (!clienteAtual?.id) {
    mostrarMensagem("Busque um cliente primeiro ❗");
    return;
  }

  let valor = valorInput.value
    .replace("R$", "")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();

  valor = parseFloat(valor || 0);

  const desconto = descontoAtual();

  if (!valor || valor <= 0) {
    mostrarMensagem("Digite o valor da venda ❗");
    return;
  }

  const valorDesconto =
    (valor * desconto) / 100;

  const total =
    Math.max(valor - valorDesconto, 0);

  const btn =
    document.querySelector(".btn-success");

  btn.disabled = true;
  btn.innerText = "Validando...";

  const agora = new Date();
  const agoraMs = Date.now();

  try {

    // 🔥 SALVA VALIDAÇÃO
    await addDoc(
      collection(db, "validacoes"),
      {
        clienteId: clienteAtual.id,
        clienteNome: clienteAtual.nome || "",
        empresa: empresaLogada, // UID
        valor,
        desconto,
        total,
        data: agora.toLocaleDateString("pt-BR"),
        hora: agora.toLocaleTimeString("pt-BR"),
        timestamp: agoraMs
      }
    );

    // 🔥 CLIENTE X EMPRESA
    if (dadosEmpresaCliente?.docId) {

      await updateDoc(
        doc(
          db,
          "clientesEmpresa",
          dadosEmpresaCliente.docId
        ),
        {
          totalGasto: increment(total),
          usos: increment(1),
          ultimaValidacao: agoraMs,
          ultimaData:
            agora.toLocaleDateString("pt-BR"),
          ultimaHora:
            agora.toLocaleTimeString("pt-BR"),
          nome: clienteAtual.nome || "",
          foto: clienteAtual.foto || ""
        }
      );

    } else {

      await addDoc(
        collection(db, "clientesEmpresa"),
        {
          clienteId: clienteAtual.id,
          empresa: empresaLogada, // UID
          nome: clienteAtual.nome || "",
          foto: clienteAtual.foto || "",
          totalGasto: total,
          usos: 1,
          ultimaValidacao: agoraMs,
          ultimaData:
            agora.toLocaleDateString("pt-BR"),
          ultimaHora:
            agora.toLocaleTimeString("pt-BR")
        }
      );

    }

    await carregarUltimasValidacoes();

    card.classList.remove("show");
    card.classList.add("hidden");

    // 🔥 ESCONDE TELA PRINCIPAL
    document.getElementById("resultado").style.display = "none";
    document.getElementById("ultimasValidacoes").style.display = "none";

    const codigo = document.querySelector(".codigo");
    if (codigo) codigo.style.display = "none";

    const titulo = document.querySelector("h2");
    if (titulo) titulo.style.display = "none";

    const linha = document.querySelector(".linha");
    if (linha) linha.style.display = "none";

    msg.style.display = "none";

    const botoesPrimarios =
      document.querySelectorAll(".btn-primary");

    if (botoesPrimarios[0]) {
      botoesPrimarios[0].style.display = "none";
    }

    // 🔥 MOSTRA SUCESSO
    setTimeout(() => {

      sucesso.classList.remove("hidden");
      sucesso.classList.add("show");
      sucesso.style.display = "flex";

      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });

    }, 250);

  } catch (erro) {

    console.error("Erro validar:", erro);

    mostrarMensagem("Erro ao validar ❌");

  } finally {

    btn.disabled = false;
    btn.innerText = "Validar";

  }

};


// 🔄 VOLTAR
window.voltar = async () => {

  sucesso.classList.remove("show");
  sucesso.classList.add("hidden");
  sucesso.style.display = "none";

  // 🔥 VOLTA TELA PRINCIPAL
  document.getElementById("resultado").style.display = "block";
  document.getElementById("ultimasValidacoes").style.display = "block";

  const codigo = document.querySelector(".codigo");
  if (codigo) codigo.style.display = "flex";

  const titulo = document.querySelector("h2");
  if (titulo) titulo.style.display = "block";

  const linha = document.querySelector(".linha");
  if (linha) linha.style.display = "block";

  msg.style.display = "block";

  const botoesPrimarios =
    document.querySelectorAll(".btn-primary");

  if (botoesPrimarios[0]) {
    botoesPrimarios[0].style.display = "block";
  }

  // 🔥 ESCONDE CARD
  card.classList.add("hidden");
  card.classList.remove("show");

  clienteAtual = null;
  dadosEmpresaCliente = null;

  limparCodigo();

  document.getElementById("nome").innerText =
    "Nome do Cliente";

  document.getElementById("id").innerText =
    "ID: ---";

  document.getElementById("status").innerText =
    "Ativo";

  document.getElementById("status").className =
    "status ativo";

  document.getElementById("foto").src = "";

  limparCampos();

  await carregarUltimasValidacoes();

  numeros[0].focus();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

};


// 🔥 VOLTAR CARD
window.voltarCard = () => {

  card.classList.remove("show");
  card.classList.add("hidden");

  clienteAtual = null;
  dadosEmpresaCliente = null;

  limparCodigo();

  document.getElementById("nome").innerText =
    "Nome do Cliente";

  document.getElementById("id").innerText =
    "ID: ---";

  document.getElementById("status").innerText =
    "Ativo";

  document.getElementById("status").className =
    "status ativo";

  document.getElementById("foto").src = "";

  limparCampos();

  const ultimos =
    document.getElementById("ultimasValidacoes");

  if (ultimos) {
    ultimos.style.display = "block";
  }

  msg.innerText = "";

  numeros[0].focus();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

};


// 🧹 LIMPAR CAMPOS
function limparCampos() {

  valorInput.value = "";
  totalInput.value = "";
  tipoDesconto.value = "";
  descontoInput.value = "";
  descontoInput.style.display = "none";

  infoDesconto.innerText =
    "Desconto aplicado: R$ 0,00 (0%)";

}