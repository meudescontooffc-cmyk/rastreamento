import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  setDoc,
  doc,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";


/* =========================================
   🔥 FIREBASE
========================================= */

const firebaseConfig = {
  apiKey: "AIzaSyAdDrbZHf93zdvY3TqdUYkqTcFOJmJhLw4",
  authDomain: "rastreamento-ad456.firebaseapp.com",
  projectId: "rastreamento-ad456",
  appId: "1:212558087501:web:a00e808856f7e80ae62304"
};


/* =========================================
   🔒 HELPERS DE SEGURANÇA
========================================= */

// Escapa HTML para prevenir XSS ao inserir texto em innerHTML
function sanitize(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// Lê inteiro positivo de um input com segurança
function safeInt(val, fallback = 0) {
  const n = parseInt(val, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

// Garante que há usuário autenticado antes de operações críticas
async function assertAdmin() {
  const user = auth.currentUser;
  if (!user) { window.location.href = "index.html"; throw new Error("Não autenticado"); }
  return user;
}

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);


/* =========================================
   🔐 BLOQUEIO
========================================= */

onAuthStateChanged(auth, (user) => {
  if (!user) window.location.href = "index.html";
});


/* =========================================
   🔹 ELEMENTOS
========================================= */

const estadoInput  = document.getElementById("estado");
const estadoSelect = document.getElementById("listaEstados");
const lista        = document.getElementById("lista");

const numeros = [
  document.getElementById("c1"),
  document.getElementById("c2"),
  document.getElementById("c3"),
  document.getElementById("c4"),
  document.getElementById("c5"),
  document.getElementById("c6")
];

const PAGE = 15;


/* =========================================
   🔀 CONTROLE DE VIEW ATIVA
   Evita que respostas async de uma aba
   sobrescrevam o conteúdo de outra aba.
========================================= */

let _viewToken = 0; // incrementa a cada troca de view

function novaView() {
  _viewToken++;
  return _viewToken; // cada chamada guarda seu próprio token
}

// Retorna true se o token ainda é a view ativa
function viewAtiva(token) {
  return token === _viewToken;
}

// Marca o botão do menu como ativo (dourado) e persiste no sessionStorage
function setActiveBtn(btnId) {
  // Remove classe de todos os botões de nav
  document.querySelectorAll(".btn-menu, .btn").forEach(b => b.classList.remove("active"));
  // Adiciona no botão atual
  const btn = document.getElementById(btnId);
  if (btn) btn.classList.add("active");
  // Persiste para sobreviver a re-renders
  try { sessionStorage.setItem("adminActiveBtn", btnId); } catch (_) {}
}

// Restaura o botão ativo ao carregar / após qualquer re-render
function restaurarBtnAtivo() {
  try {
    const id = sessionStorage.getItem("adminActiveBtn");
    if (!id) return;
    document.querySelectorAll(".btn-menu, .btn").forEach(b => b.classList.remove("active"));
    const btn = document.getElementById(id);
    if (btn) btn.classList.add("active");
  } catch (_) {}
}


/* =========================================
   💾 CACHE (TTL 60s)
========================================= */

const cache = {
  _s: {},
  _ttl: 60_000,
  set(k, v)  { this._s[k] = { v, ts: Date.now() }; },
  get(k)     {
    const e = this._s[k];
    if (!e) return null;
    if (Date.now() - e.ts > this._ttl) { delete this._s[k]; return null; }
    return e.v;
  },
  del(k)     { delete this._s[k]; },
  clear()    { this._s = {}; }
};


/* =========================================
   💰 HELPERS
========================================= */

function moeda(v) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
    .format(Number(v || 0));
}

function agora() {
  const d = new Date();
  return {
    data: d.toLocaleDateString("pt-BR"),
    hora: d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  };
}


/* =========================================
   📄 PAGINAÇÃO "VER MAIS"
========================================= */

function renderPaginado(container, itens, renderFn, offset = 0) {
  // Remove botão ver mais anterior
  const old = container.querySelector(".btn-ver-mais-wrap");
  if (old) old.remove();

  const fatia = itens.slice(offset, offset + PAGE);
  fatia.forEach(renderFn);

  const prox = offset + PAGE;
  if (prox < itens.length) {
    const wrap = document.createElement("div");
    wrap.className = "btn-ver-mais-wrap";
    wrap.style.cssText = "width:100%;display:block;clear:both;margin:12px 0;text-align:center;";
    const btn = document.createElement("button");
    btn.className = "btn-ver-mais";
    btn.style.cssText = "display:inline-block;width:auto;min-width:160px;max-width:100%;";
    btn.textContent = `Ver mais (${itens.length - prox} restantes)`;
    btn.onclick = () => {
      wrap.remove();
      renderPaginado(container, itens, renderFn, prox);
    };
    wrap.appendChild(btn);
    container.appendChild(wrap);
  }
}

// Atalho para o #lista principal
function paginar(itens, renderFn) {
  renderPaginado(lista, itens, renderFn, 0);
}


/* =========================================
   🔥 ESTADO / INPUTS
========================================= */

estadoSelect.addEventListener("change", () => {
  numeros[0].focus();
});

numeros.forEach((input, i) => {
  input.addEventListener("input", () => {
    input.value = input.value.replace(/[^0-9]/g, "");
    if (input.value && i < numeros.length - 1) numeros[i + 1].focus();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" && !input.value && i > 0) numeros[i - 1].focus();
  });
});


/* =========================================
   🔥 GERAR ID ÚNICO
   UID do documento = código gerado
========================================= */

async function gerarCodigoUnico() {
  const estado = estadoSelect.value.trim().toUpperCase() || "MA";
  while (true) {
    const num    = Math.floor(100000 + Math.random() * 900000);
    const codigo = `${estado}-${num}`;
    const snap   = await getDoc(doc(db, "clientes", codigo));
    if (!snap.exists()) return codigo;
  }
}

window.gerarCodigo = async function() {
  await assertAdmin();
  const nomeRaw = prompt("Digite o nome do cliente:");
  if (!nomeRaw?.trim()) { alert("Nome obrigatório ❗"); return; }
  const nome = nomeRaw.trim().slice(0, 100); // 🔒 limita tamanho

  const codigo = await gerarCodigoUnico();

  // UID do documento = código; campo id = código também
  await setDoc(doc(db, "clientes", codigo), {
    nome,
    id: codigo,
    status: "ativo",
    foto: "",
    criadoEm: serverTimestamp()
  });

  cache.del("clientes");
  alert(`Cliente criado ✅\nCódigo: ${codigo}`);
  listarClientes();
};


/* =========================================
   🔥 CARD CLIENTE
========================================= */

function criarCard(c, docId) {
  const card = document.createElement("div");
  card.className = "card";
  card.style.cssText = "display:flex;align-items:center;gap:12px;flex-wrap:wrap;";
  // 🔒 sanitize evita XSS em dados do Firestore
  const sNome   = sanitize(c.nome);
  const sStatus = sanitize(c.status);
  // UID do documento = código (ex: MA-123456) — docId é sempre a fonte correta
  const sId     = sanitize(docId || c.id || "");
  const sDocId  = sanitize(docId);
  const sFoto   = sanitize(c.foto || "");
  card.innerHTML = `
    <img src="${sFoto || "https://via.placeholder.com/80"}" style="width:56px;height:56px;border-radius:8px;object-fit:cover;flex-shrink:0;">
    <div class="info" style="flex:1;min-width:0;">
      <h3 style="margin:0 0 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${sNome}</h3>
      <p class="status ${sStatus}" style="margin:2px 0;">${sStatus}</p>
      <p style="margin:2px 0;font-size:12px;color:#aaa;font-family:monospace;">${sId}</p>
    </div>
    <div class="acao" style="display:flex;align-items:center;justify-content:flex-end;flex-shrink:0;">
      ${c.status === "ativo"
        ? `<button class="btn-acao btn-inativar" onclick="inativar('${sDocId}')">Inativar</button>`
        : `<button class="btn-acao btn-ativar"   onclick="ativar('${sDocId}')">Ativar</button>`}
    </div>`;
  lista.appendChild(card);
}

async function carregarClientes() {
  let todos = cache.get("clientes");
  if (!todos) {
    const snap = await getDocs(collection(db, "clientes"));
    todos = snap.docs.map(d => ({ data: d.data(), id: d.id }));
    cache.set("clientes", todos);
  }
  return todos;
}


/* =========================================
   🔥 LISTAR / ATIVOS / INATIVOS / TODOS
========================================= */

window.listarClientes = async function(btnId) {
  if (btnId) setActiveBtn(btnId);
  const token = novaView();
  lista.innerHTML = "Carregando...";
  const todos = await carregarClientes();
  if (!viewAtiva(token)) return;
  lista.innerHTML = "";
  paginar(todos, ({ data, id }) => criarCard(data, id));
  restaurarBtnAtivo();
};

window.verAtivos = async function(btnId) {
  if (btnId) setActiveBtn(btnId);
  const token = novaView();
  lista.innerHTML = "Carregando...";
  const todos   = await carregarClientes();
  if (!viewAtiva(token)) return;
  const filtro  = todos.filter(c => c.data.status === "ativo");
  lista.innerHTML = "";
  paginar(filtro, ({ data, id }) => criarCard(data, id));
  restaurarBtnAtivo();
};

window.verInativos = async function(btnId) {
  if (btnId) setActiveBtn(btnId);
  const token = novaView();
  lista.innerHTML = "Carregando...";
  const todos   = await carregarClientes();
  if (!viewAtiva(token)) return;
  const filtro  = todos.filter(c => c.data.status === "inativo");
  lista.innerHTML = "";
  paginar(filtro, ({ data, id }) => criarCard(data, id));
  restaurarBtnAtivo();
};

window.ativar = async function(docId) {
  await assertAdmin();
  await updateDoc(doc(db, "clientes", docId), { status: "ativo" });
  cache.del("clientes");
  listarClientes();
};

window.inativar = async function(docId) {
  await assertAdmin();
  await updateDoc(doc(db, "clientes", docId), { status: "inativo" });
  cache.del("clientes");
  listarClientes();
};


/* =========================================
   🔍 BUSCAR — direto pelo UID do documento
========================================= */

function pegarCodigo() {
  // Usa o select de UF (não o input digitável)
  return estadoSelect.value.trim().toUpperCase() + "-" + numeros.map(n => n.value).join("");
}

window.buscar = async function(btnId) {
  if (btnId) setActiveBtn(btnId);
  const token = novaView();
  const codigo = pegarCodigo();
  lista.innerHTML = "Buscando...";

  // Busca direta pelo UID — sem varrer coleção inteira
  const snap = await getDoc(doc(db, "clientes", codigo));
  if (!viewAtiva(token)) return;
  lista.innerHTML = "";

  if (snap.exists()) {
    criarCard(snap.data(), snap.id);
  } else {
    lista.innerHTML = "Usuário não encontrado ❌";
  }
  restaurarBtnAtivo();
};


/* =========================================
   🏢 EMPRESAS
========================================= */

window.verEmpresas = async function(btnId) {
  if (btnId) setActiveBtn(btnId);
  const token = novaView();
  lista.innerHTML = "Carregando empresas...";
  fecharPainelConfig();

  try {
    let empresas = cache.get("empresas");
    if (!empresas) {
      const snap = await getDocs(collection(db, "empresas"));
      empresas = snap.docs.map(d => ({ data: d.data(), id: d.id }));
      cache.set("empresas", empresas);
    }
    if (!viewAtiva(token)) return;

    lista.innerHTML = "";

    if (!empresas.length) {
      lista.innerHTML = "Nenhuma empresa encontrada ❗";
      return;
    }

    paginar(empresas, ({ data: d, id: eId }) => {
      const tagB = d.ativarBrinde
        ? '<span class="tag-ativo">● Brinde ativo</span>'
        : '<span class="tag-inativo">● Brinde inativo</span>';
      const tagS = d.ativarSorteio
        ? '<span class="tag-ativo">● Sorteio ativo</span>'
        : '<span class="tag-inativo">● Sorteio inativo</span>';

      const card = document.createElement("div");
      card.className = "card";
      card.style.cssText = "display:flex;align-items:flex-start;gap:10px;flex-wrap:nowrap;";
      card.innerHTML = `
        <div class="info" style="flex:1;min-width:0;">
          <h3 style="margin:0 0 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${d.nome || "Empresa sem nome"}</h3>
          <p style="margin:2px 0 4px;color:#aaa;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${d.email || ""}</p>
          <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap;">${tagB} ${tagS}</div>
          ${d.metaBrinde  ? `<p style="margin:4px 0;font-size:13px"><strong>Meta brinde:</strong> ${d.metaBrinde} compras</p>` : ""}
          ${(d.metaUsosSorteio || d.metaComprasSorteio) ? `<p style="margin:4px 0;font-size:13px"><strong>Usos p/ participar:</strong> ${d.metaUsosSorteio || d.metaComprasSorteio} compras</p>` : ""}
          ${d.metaClientesSorteio ? `<p style="margin:4px 0;font-size:13px"><strong>Meta clientes elegíveis:</strong> ${d.metaClientesSorteio} — ${d.qtdSorteio || 1} ganhador(es)</p>` : ""}
        </div>
        <div class="acao" style="flex-shrink:0;display:flex;align-items:flex-start;padding-top:2px;">
          <button class="btn-acao btn-config" style="white-space:nowrap;" onclick="abrirConfigEmpresa('${eId}')">⚙ Config</button>
        </div>`;
      lista.appendChild(card);
    });

  } catch (e) { console.error(e); lista.innerHTML = "Erro ao carregar ❌"; }
  restaurarBtnAtivo();
};


/* =========================================
   ⚙ PAINEL LATERAL CONFIG
========================================= */

function fecharPainelConfig() {
  document.getElementById("painel-config-lateral")?.remove();
}
window.fecharPainelConfig = fecharPainelConfig;

window.abrirConfigEmpresa = async function(eId) {
  fecharPainelConfig();
  let d = {};
  try {
    const snap = await getDoc(doc(db, "empresas", eId));
    if (snap.exists()) d = snap.data();
  } catch (e) { console.warn(e); }

  const painel = document.createElement("div");
  painel.id = "painel-config-lateral";
  painel.innerHTML = `
    <div class="painel-config-overlay" onclick="fecharPainelConfig()"></div>
    <div class="painel-config-box">
      <div class="painel-config-header">
        <h3>⚙ Configuração</h3>
        <span class="painel-config-nome">${d.nome || eId}</span>
        <button class="painel-config-fechar" onclick="fecharPainelConfig()">✕</button>
      </div>
      <div class="painel-config-body">

        <div class="config-secao">
          <div class="config-secao-titulo"> Brinde</div>
          <div class="config-toggle-row">
            <label>Ativar brinde</label>
            <label class="toggle">
              <input type="checkbox" id="cfg-ativarBrinde" ${d.ativarBrinde ? "checked" : ""}>
              <span class="slider"></span>
            </label>
          </div>
          <label>Meta de compras para brinde</label>
          <input type="number" id="cfg-metaBrinde" placeholder="Ex: 10" value="${d.metaBrinde || ""}" min="1"/>
          <small>Quantas compras o cliente precisa para ganhar o brinde.</small>
        </div>

        <div class="config-secao">
          <div class="config-secao-titulo"> Sorteio</div>
          <div class="config-toggle-row">
            <label>Ativar sorteio</label>
            <label class="toggle">
              <input type="checkbox" id="cfg-ativarSorteio" ${d.ativarSorteio ? "checked" : ""}>
              <span class="slider"></span>
            </label>
          </div>

          <label>Meta de compras = usos para participar</label>
          <input type="number" id="cfg-metaUsosSorteio"
            placeholder="Ex: 5"
            value="${d.metaUsosSorteio || d.metaComprasSorteio || ""}" min="1"/>
          <small>Quantas compras o cliente precisa fazer para ser elegível ao sorteio.</small>

          <label>Meta de clientes que bateram a meta de usos</label>
          <input type="number" id="cfg-metaClientesSorteio"
            placeholder="Ex: 10"
            value="${d.metaClientesSorteio || d.metaSorteio || ""}" min="1"/>
          <small>Mínimo de clientes elegíveis para o sorteio ser liberado. O botão "Sortear" só aparece quando essa meta é atingida.</small>

          <label>Quantidade de ganhadores</label>
          <input type="number" id="cfg-qtdSorteio"
            placeholder="Ex: 1"
            value="${d.qtdSorteio || ""}" min="1"/>
          <small>Quantos clientes serão sorteados.</small>
        </div>

      </div>
      <div class="painel-config-footer">
        <button class="btn-acao btn-ativar" onclick="salvarConfigEmpresa('${eId}')"> Salvar configuração</button>
      </div>
    </div>`;

  document.body.appendChild(painel);
  requestAnimationFrame(() => painel.querySelector(".painel-config-box").classList.add("aberto"));
};

window.salvarConfigEmpresa = async function(eId) {
  await assertAdmin();

  const ativarBrinde        = document.getElementById("cfg-ativarBrinde").checked;
  const metaBrinde          = safeInt(document.getElementById("cfg-metaBrinde").value, 0);
  const ativarSorteio       = document.getElementById("cfg-ativarSorteio").checked;
  const metaUsosSorteio     = safeInt(document.getElementById("cfg-metaUsosSorteio").value, 0);
  const metaClientesSorteio = safeInt(document.getElementById("cfg-metaClientesSorteio").value, 0);
  const qtdSorteio          = safeInt(document.getElementById("cfg-qtdSorteio").value, 1) || 1;

  // 🔒 Validações
  if (ativarBrinde && !metaBrinde) {
    alert("Informe a meta de compras para o brinde ❗"); return;
  }
  if (ativarSorteio) {
    if (!metaUsosSorteio)     { alert("Informe os usos necessários para participar do sorteio ❗"); return; }
    if (!metaClientesSorteio) { alert("Informe a meta de clientes elegíveis ❗"); return; }
    if (qtdSorteio > metaClientesSorteio) {
      alert("Ganhadores não pode ser maior que a meta de clientes ❗"); return;
    }
  }

  try {
    // ✅ FIX 2 & 4: Ao salvar config, registrar usos atuais de cada cliente como
    // ponto de início — sorteio e premiação só contam usos A PARTIR daqui.
    // NÃO zera usos, apenas marca o baseline.
    const snapCli = await getDocs(query(
      collection(db, "clientesEmpresa"),
      where("empresa", "==", eId)
    ));

    const batchUpdates = snapCli.docs.map(cliDoc => {
      const usosAtuais = Number(cliDoc.data().usos || 0);
      const upd = {};
      // Sorteio: marca início se está ativando sorteio
      if (ativarSorteio) {
        upd.inicioSorteio = usosAtuais;
        // Reseta ciclosSorteio para alinhar com novo início
        upd.ciclosSorteio = 0;
      }
      // Brinde: marca início se está ativando brinde
      if (ativarBrinde) {
        upd.inicioPremiacao = usosAtuais;
        // Reseta ciclosBrinde para alinhar com novo início
        upd.ciclosBrinde = 0;
      }
      if (Object.keys(upd).length === 0) return Promise.resolve();
      return updateDoc(doc(db, "clientesEmpresa", cliDoc.id), upd);
    });
    await Promise.all(batchUpdates);

    await setDoc(doc(db, "empresas", eId), {
      ativarBrinde,
      metaBrinde,
      ativarSorteio,
      metaUsosSorteio,          // usos por cliente para ser elegível
      metaClientesSorteio,      // clientes que precisam bater a meta
      qtdSorteio,
      // mantém campos legados para retrocompatibilidade
      metaSorteio: metaClientesSorteio,
      metaComprasSorteio: metaUsosSorteio
    }, { merge: true });
    cache.del("empresas");
    alert("Configuração salva ✅");
    fecharPainelConfig();
    verEmpresas();
  } catch (e) { console.error(e); alert("Erro ao salvar ❌"); }
};


/* =========================================
   🏆 PREMIAÇÕES
   clientesEmpresa com premiacaoPendente=true
========================================= */


/* =========================================
   🏆 PREMIAÇÕES
========================================= */

window.verPremiacoes = async function(btnId) {
  if (btnId) setActiveBtn(btnId);
  const token = novaView();
  lista.innerHTML = "Carregando premiações...";
  fecharPainelConfig();

  try {
    if (!viewAtiva(token)) return;
    lista.innerHTML = "";

    // ── Botão histórico completo
    const btnHist = document.createElement("button");
    btnHist.className = "btn-historico-topo";
    btnHist.textContent = "Histórico de premiações";
    btnHist.onclick = () => verHistoricoPromocoes("premiacao");
    lista.appendChild(btnHist);

    // ── Busca clientes e empresas em paralelo (histórico não é mais necessário aqui)
    const [snapClientes, snapEmpresas] = await Promise.all([
      getDocs(collection(db, "clientesEmpresa")),
      getDocs(collection(db, "empresas"))
    ]);
    if (!viewAtiva(token)) return;

    // Mapa empresaId → metaBrinde
    const metaMap = {};
    snapEmpresas.docs.forEach(d => {
      metaMap[d.id] = Number(d.data().metaBrinde || 0);
    });

    // ════════════════════════════════════════
    //  CLIENTES COM BRINDES PENDENTES
    //  Lógica acumulativa: Math.floor(usos/meta) > ciclosBrinde
    //  Não zera usos — a cada +meta compras ganha mais um brinde
    // ════════════════════════════════════════
    const tPend = document.createElement("p");
    tPend.className = "secao-titulo";
    tPend.style.marginTop = "8px";
    lista.appendChild(tPend);

    // Filtra clientes com brindes pendentes usando ciclosBrinde
    // ✅ FIX 4: conta apenas usos APÓS inicioPremiacao (salvo ao configurar)
    const pendentes = snapClientes.docs
      .map(d => ({ docId: d.id, ...d.data() }))
      .filter(d => {
        const meta = metaMap[d.empresa];
        if (!meta || meta <= 0) return false;
        const usos           = Number(d.usos || 0);
        const inicioPremiacao = Number(d.inicioPremiacao ?? 0);
        const usosDesdeInicio = Math.max(0, usos - inicioPremiacao);
        const ciclosBrinde   = Number(d.ciclosBrinde || 0);
        return Math.floor(usosDesdeInicio / meta) > ciclosBrinde;
      });

    if (!pendentes.length) {
      tPend.textContent = " Clientes aguardando premiação";
      const pp = document.createElement("p");
      pp.style.cssText = "color:#666;font-size:13px;margin-top:8px";
      pp.textContent = "Nenhum cliente aguardando premiação.";
      lista.appendChild(pp);
      return;
    }

    tPend.textContent = ` Clientes com brinde pendente (${pendentes.length} cliente${pendentes.length > 1 ? "s" : ""})`;

    renderPaginado(lista, pendentes, d => {
      const meta            = metaMap[d.empresa] || 1;
      const usos            = Number(d.usos || 0);
      const inicioPremiacao = Number(d.inicioPremiacao ?? 0);
      const usosDesdeInicio = Math.max(0, usos - inicioPremiacao);
      const ciclosBrinde    = Number(d.ciclosBrinde || 0);
      const brindesPend     = Math.floor(usosDesdeInicio / meta) - ciclosBrinde;

      const card = document.createElement("div");
      card.className = "card card-premiacao";
      card.id = `pend-${d.docId}`;
      card.style.borderLeft = "3px solid #ff9800";

      const nEmp   = sanitize(d.empresaNome || d.empresa || "");
      const nCli   = sanitize(d.nome || d.clienteId);
      const sId    = sanitize(d.clienteId || "");
      const sDocId = sanitize(d.docId);
      const sEId   = sanitize(d.empresa || "");
      const horaAt = d.ultimaData && d.ultimaHora ? `${d.ultimaData} às ${d.ultimaHora}` : "--";

      card.innerHTML = `
        <div class="info" style="flex:1">
          <p style="font-size:11px;color:#ff9800;font-weight:600;margin-bottom:4px">⚠ Cliente atingiu os requisitos</p>
          <h3>${nCli}</h3>
          <p style="margin:3px 0"><strong>Empresa:</strong> ${nEmp}</p>
          <p style="margin:3px 0;font-size:12px;color:#aaa"><strong>ID:</strong> ${sId}</p>
          <p style="margin:3px 0;font-size:12px"><strong>Compras totais:</strong> ${usos} &nbsp;|&nbsp; <strong>Brindes pendentes:</strong> ${brindesPend}</p>
          <p style="color:rgba(255,152,0,0.6);font-size:11px;margin-top:6px"> Última compra: ${horaAt}</p>
        </div>
        <div class="acao">
          <button class="btn-acao btn-ativar"
            onclick="confirmarPremiacao('${sDocId}','${sEId}','${sId}','${nEmp}','${nCli}')">
             OK
          </button>
        </div>`;
      lista.appendChild(card);
    });

  } catch (e) { console.error(e); lista.innerHTML = "Erro ao carregar ❌"; }
  restaurarBtnAtivo();
};

window.verParticipantesPremiacao = async function(eId, nomeEmpresa) {
  lista.innerHTML = "Carregando...";
  try {
    const snap = await getDocs(query(
      collection(db, "clientesEmpresa"),
      where("empresa",           "==", eId),
      where("premiacaoPendente", "==", true)
    ));

    lista.innerHTML = "";

    const voltar = document.createElement("button");
    voltar.className = "btn-voltar-inline";
    voltar.textContent = "← Voltar";
    voltar.onclick = verPremiacoes;
    lista.appendChild(voltar);

    const t = document.createElement("p");
    t.className = "secao-titulo";
    t.textContent = ` ${nomeEmpresa} — participantes`;
    lista.appendChild(t);

    if (snap.empty) {
      const p = document.createElement("p");
      p.style.cssText = "color:#666;font-size:13px";
      p.textContent = "Nenhum participante.";
      lista.appendChild(p);
      return;
    }

    const clientes = snap.docs.map(d => ({ data: d.data(), id: d.id }));

    renderPaginado(lista, clientes, ({ data: d, id: docId }) => {
      const nEmp  = (d.empresaNome || d.empresa || "").replace(/'/g, "");
      const nCli  = (d.nome        || d.clienteId || "").replace(/'/g, "");
      const card  = document.createElement("div");
      card.className = "card card-premiacao";
      card.id = `pend-${docId}`;
      card.innerHTML = `
        <div class="info" style="flex:1">
          <h3>${d.nome || d.clienteId}</h3>
          <p><strong>ID:</strong> ${d.clienteId}</p>
          <p><strong>Compras:</strong> ${d.usos || 0}</p>
          <span class="badge-premiacao"> Premiação pendente</span>
        </div>
        <div class="acao">
          <button class="btn-acao btn-ativar"
            onclick="confirmarPremiacao('${docId}','${eId.replace(/'/g,"")}','${(d.clienteId||"").replace(/'/g,"")}','${nEmp}','${nCli}')">
             OK
          </button>
        </div>`;
      lista.appendChild(card);
    });
  } catch (e) { console.error(e); lista.innerHTML = "Erro ❌"; }
};

window.confirmarPremiacao = async function(docId, eId, clienteId, nomeEmpresa, nomeCliente) {
  await assertAdmin();
  if (!confirm(`Confirmar premiação para ${nomeCliente}?`)) return;
  const { data, hora } = agora();
  try {
    // ✅ FIX 4: Calcula novoCiclo com base nos usos APÓS inicioPremiacao
    const cliSnap  = await getDoc(doc(db, "clientesEmpresa", docId));
    const cliData  = cliSnap.exists() ? cliSnap.data() : {};
    const empSnap  = await getDoc(doc(db, "empresas", eId));
    const meta            = Number(empSnap.exists() ? empSnap.data().metaBrinde : 0) || 1;
    const usos            = Number(cliData.usos || 0);
    const inicioPremiacao = Number(cliData.inicioPremiacao ?? 0);
    const usosDesdeInicio = Math.max(0, usos - inicioPremiacao);
    // Avança ciclosBrinde contado desde inicioPremiacao
    const novoCiclo = Math.floor(usosDesdeInicio / meta);

    await updateDoc(doc(db, "clientesEmpresa", docId), {
      ciclosBrinde: novoCiclo,
      premiacaoPendente: false   // mantido por retrocompatibilidade
    });
    await addDoc(collection(db, "historicoPromocoes"), {
      tipo: "premiacao", empresa: eId, nomeEmpresa,
      clienteId, nomeCliente, data, hora, timestamp: Date.now()
    });
    document.getElementById(`pend-${docId}`)?.remove();
    alert("Premiação confirmada ✅");
  } catch (e) { console.error(e); alert("Erro ❌"); }
};


/* =========================================
   🎰 SORTEIOS
========================================= */

window.verSorteios = async function(btnId) {
  if (btnId) setActiveBtn(btnId);
  const token = novaView();
  lista.innerHTML = "Carregando sorteios...";
  fecharPainelConfig();

  try {
    if (!viewAtiva(token)) return;
    lista.innerHTML = "";

    // ── Botão histórico completo
    const btnHist = document.createElement("button");
    btnHist.className = "btn-historico-topo";
    btnHist.textContent = "Histórico de sorteios";
    btnHist.onclick = () => verHistoricoPromocoes("sorteio");
    lista.appendChild(btnHist);

    // ── Busca apenas empresas com sorteio ativo
    const snapEmpresas = await getDocs(query(collection(db, "empresas"), where("ativarSorteio", "==", true)));
    if (!viewAtiva(token)) return;

    if (snapEmpresas.empty) {
      const p = document.createElement("p");
      p.style.cssText = "color:#666;margin-top:24px;font-size:13px";
      p.textContent = "Nenhuma empresa com sorteio ativo.";
      lista.appendChild(p);
      return;
    }

    const titulo = document.createElement("p");
    titulo.className = "secao-titulo";
    titulo.style.marginTop = "24px";
    lista.appendChild(titulo);

    let algum = false;
    const cards = [];

    for (const eDoc of snapEmpresas.docs) {
      const emp          = eDoc.data();
      const eId          = eDoc.id;
      const metaCompras  = Number(emp.metaUsosSorteio || emp.metaComprasSorteio || emp.metaSorteio || 0);
      const metaClientes = Number(emp.metaClientesSorteio || emp.metaSorteio || 0);
      const qtd          = Number(emp.qtdSorteio || 1);
      if (!metaCompras) continue;

      const snapCli = await getDocs(query(
        collection(db, "clientesEmpresa"),
        where("empresa", "==", eId)
      ));
      if (!viewAtiva(token)) return;
      // ✅ FIX 2: conta usos APENAS após inicioSorteio (salvo ao configurar)
      const total  = snapCli.docs.filter(d => {
        const usos          = Number(d.data().usos || 0);
        const inicioSorteio = Number(d.data().inicioSorteio ?? 0);
        const usosDesde     = Math.max(0, usos - inicioSorteio);
        const ciclo         = Number(d.data().ciclosSorteio || 0);
        return Math.floor(usosDesde / metaCompras) > ciclo;
      }).length;
      const pronto = total >= metaClientes;

      algum = true;
      cards.push({ emp, eId, total, metaCompras, metaClientes, qtd, pronto });
    }

    titulo.textContent = algum
      ? ` Sorteios ativos (${cards.length} empresa${cards.length > 1 ? "s" : ""})`
      : "Nenhuma empresa configurada para sorteio.";

    paginar(cards, ({ emp, eId, total, metaCompras, metaClientes, qtd, pronto }) => {
      const pct     = metaClientes ? Math.min(100, Math.round((total / metaClientes) * 100)) : 0;
      const nomeEmp = sanitize(emp.nome || eId);

      const card = document.createElement("div");
      card.className = `card ${pronto ? "card-sorteio" : ""}`;
      card.innerHTML = `
        <div class="info" style="flex:1">
          <h3>${sanitize(emp.nome || eId)}</h3>
          <p style="margin:3px 0"><strong>Compras p/ participar:</strong> ${metaCompras}</p>
          <p style="margin:3px 0"><strong>Clientes elegíveis:</strong> ${total} de ${metaClientes}</p>
          <p style="margin:3px 0"><strong>Ganhadores:</strong> ${qtd}</p>
          <div class="progresso-wrap">
            <div class="progresso-label">${pronto ? "✦ Pronto para sortear" : `${pct}% — aguardando clientes`}</div>
            <div class="progresso-bar"><div class="progresso-fill" style="width:${pct}%"></div></div>
          </div>
        </div>
        <div class="acao" style="flex-direction:column;gap:8px;align-items:flex-end">
          <button class="btn-config"
            onclick="verParticipantesSorteio('${sanitize(eId)}','${nomeEmp}',${metaCompras})">
            Ver participantes
          </button>
          ${pronto
            ? `<button class="btn-acao btn-ativar"
                onclick="realizarSorteio('${sanitize(eId)}','${nomeEmp}',${qtd},${metaCompras})">
                 Sortear
              </button>`
            : ""}
        </div>`;
      lista.appendChild(card);
    });

  } catch (e) { console.error(e); lista.innerHTML = "Erro ao carregar ❌"; }
  restaurarBtnAtivo();
};

window.verParticipantesSorteio = async function(eId, nomeEmpresa, metaCompras) {
  lista.innerHTML = "Carregando...";
  try {
    const snap = await getDocs(query(
      collection(db, "clientesEmpresa"),
      where("empresa", "==", eId)
    ));
    // ✅ FIX 2: elegível apenas por usos após inicioSorteio
    const elegiveis = snap.docs
      .map(d => d.data())
      .filter(d => {
        const usos          = Number(d.usos || 0);
        const inicioSorteio = Number(d.inicioSorteio ?? 0);
        const usosDesde     = Math.max(0, usos - inicioSorteio);
        const ciclo         = Number(d.ciclosSorteio || 0);
        return Math.floor(usosDesde / metaCompras) > ciclo;
      });

    lista.innerHTML = "";
    const voltar = document.createElement("button");
    voltar.className = "btn-voltar-inline";
    voltar.textContent = "← Voltar";
    voltar.onclick = verSorteios;
    lista.appendChild(voltar);

    const t = document.createElement("p");
    t.className = "secao-titulo";
    t.textContent = ` ${nomeEmpresa} — participantes elegíveis`;
    lista.appendChild(t);

    if (!elegiveis.length) {
      const p = document.createElement("p");
      p.style.cssText = "color:#666;font-size:13px";
      p.textContent = "Nenhum participante atingiu a meta ainda.";
      lista.appendChild(p);
      return;
    }

    renderPaginado(lista, elegiveis, (d) => {
      const card = document.createElement("div");
      card.className = "card";
      const _usos         = Number(d.usos || 0);
      const _inicio       = Number(d.inicioSorteio ?? 0);
      const _usosDesde    = Math.max(0, _usos - _inicio);
      const _ciclo        = Number(d.ciclosSorteio || 0);
      const _participacoes = Math.floor(_usosDesde / metaCompras) - _ciclo;
      card.innerHTML = `
        <div class="info">
          <h3>${sanitize(d.nome || d.clienteId)}</h3>
          <p><strong>ID:</strong> ${sanitize(d.clienteId)}</p>
          <p><strong>Compras totais:</strong> ${_usos}</p>
          <p><strong>Compras desde configuração:</strong> ${_usosDesde}</p>
          <p><strong>Participações disponíveis:</strong> ${_participacoes}</p>
          <span class="tag-ativo">✦ Elegível</span>
        </div>`;
      lista.appendChild(card);
    });
  } catch (e) { console.error(e); lista.innerHTML = "Erro ❌"; }
};

window.realizarSorteio = async function(eId, nomeEmpresa, qtdGanhadores, metaCompras) {
  await assertAdmin();
  if (!confirm(`Realizar sorteio para ${nomeEmpresa}?\n${qtdGanhadores} ganhador(es).`)) return;
  try {
    const snap = await getDocs(query(
      collection(db, "clientesEmpresa"),
      where("empresa", "==", eId)
    ));
    // ✅ FIX 2: elegível apenas por usos APÓS inicioSorteio
    const elegiveis = snap.docs
      .map(d => ({ id: d.id, data: d.data() }))
      .filter(e => {
        const usos          = Number(e.data.usos || 0);
        const inicioSorteio = Number(e.data.inicioSorteio ?? 0);
        const usosDesde     = Math.max(0, usos - inicioSorteio);
        const ciclo         = Number(e.data.ciclosSorteio || 0);
        return Math.floor(usosDesde / metaCompras) > ciclo;
      });

    if (!elegiveis.length) { alert("Nenhum cliente elegível ❗"); return; }

    const ganhadores = elegiveis.sort(() => Math.random() - 0.5).slice(0, qtdGanhadores);
    const nomes      = ganhadores.map(g => g.data.nome || g.data.clienteId);
    const ids        = ganhadores.map(g => g.data.clienteId);

    if (!confirm(`Ganhadores:\n${nomes.join("\n")}\n\nConfirmar sorteio?`)) return;

    const { data, hora } = agora();

    // ✅ FIX 2: Não zera usos — avança ciclosSorteio com base nos usos desde inicioSorteio.
    // ✅ FIX 3: Atualiza TODOS os elegíveis (não só ganhadores) para remover o aviso
    //           "Realizar sorteio" de todos os painéis (ADM principal e ADM empresa).
    await Promise.all(
      elegiveis.map(e => {
        const usos          = Number(e.data.usos || 0);
        const inicioSorteio = Number(e.data.inicioSorteio ?? 0);
        const usosDesde     = Math.max(0, usos - inicioSorteio);
        return updateDoc(doc(db, "clientesEmpresa", e.id), {
          ciclosSorteio:     Math.floor(usosDesde / metaCompras),
          participouSorteio: true   // ✅ FIX 3: garante compatibilidade com script.js
        });
      })
    );
    await addDoc(collection(db, "historicoPromocoes"), {
      tipo: "sorteio", empresa: eId, nomeEmpresa,
      ganhadores: nomes, idsGanhadores: ids,
      data, hora, timestamp: Date.now()
    });

    alert(`Sorteio realizado ✅\n\nGanhadores:\n${nomes.join("\n")}`);
    verSorteios();
  } catch (e) { console.error(e); alert("Erro ao realizar sorteio ❌"); }
};


/* =========================================
   📋 HISTÓRICO — premiação ou sorteio
========================================= */

window.verHistoricoPromocoes = async function(tipo) {
  lista.innerHTML = "Carregando histórico...";
  const titulo = tipo === "sorteio" ? "Histórico de Sorteios" : "Histórico de Premiações";

  try {
    // ⚠️ orderBy+where composto exige índice no Firestore — buscamos tudo e filtramos no cliente
    const snapAll = await getDocs(collection(db, "historicoPromocoes"));

    // Filtra e ordena no cliente para evitar erro de índice
    const registros = snapAll.docs
      .map(d => d.data())
      .filter(d => d.tipo === tipo)
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, 200);

    lista.innerHTML = "";

    const voltar = document.createElement("button");
    voltar.className = "btn-voltar-inline";
    voltar.textContent = "← Voltar";
    voltar.onclick = tipo === "sorteio" ? verSorteios : verPremiacoes;
    lista.appendChild(voltar);

    const t = document.createElement("p");
    t.className = "secao-titulo";
    t.textContent = ` ${titulo}`;
    lista.appendChild(t);

    if (!registros.length) {
      const p = document.createElement("p");
      p.style.cssText = "color:#666;font-size:13px;margin-top:16px";
      p.textContent = "Nenhum registro encontrado.";
      lista.appendChild(p);
      return;
    }

    renderPaginado(lista, registros, (h) => {
      const card = document.createElement("div");
      card.className = "card";

      if (tipo === "sorteio") {
        const nomes = (h.ganhadores || []).map(n => sanitize(n)).join(", ");
        const ids   = (h.idsGanhadores || []).map(i => sanitize(i)).join(", ");
        card.innerHTML = `
          <div class="info">
            <h3> ${sanitize(h.nomeEmpresa || h.empresa)}</h3>
            <p style="margin:4px 0"><strong>Ganhadores:</strong> ${nomes || "—"}</p>
            ${ids ? `<p style="margin:4px 0;font-size:12px;color:#aaa"><strong>IDs:</strong> ${ids}</p>` : ""}
            <p style="color:rgba(255,215,0,0.5);font-size:11px;margin-top:8px"> ${sanitize(h.data || "--")} às ${sanitize(h.hora || "--")}</p>
          </div>`;
      } else {
        card.innerHTML = `
          <div class="info">
            <h3> ${sanitize(h.nomeCliente || h.clienteId)}</h3>
            <p style="margin:4px 0"><strong>Empresa:</strong> ${sanitize(h.nomeEmpresa || h.empresa)}</p>
            <p style="margin:4px 0"><strong>ID:</strong> ${sanitize(h.clienteId || "—")}</p>
            <p style="color:rgba(255,215,0,0.5);font-size:11px;margin-top:8px"> ${sanitize(h.data || "--")} às ${sanitize(h.hora || "--")}</p>
          </div>`;
      }

      lista.appendChild(card);
    });
  } catch (e) { console.error("Histórico erro:", e); lista.innerHTML = "Erro ao carregar ❌ — verifique o console."; }
};

window.verValidacoes = async function(btnId) {
  if (btnId) setActiveBtn(btnId);
  const token = novaView();
  lista.innerHTML = "Carregando...";
  fecharPainelConfig();

  try {
    const snap = await getDocs(
      query(collection(db, "clientesEmpresa"), orderBy("ultimaValidacao", "desc"))
    );
    if (!viewAtiva(token)) return;

    if (snap.empty) { lista.innerHTML = "Nenhuma validação encontrada ❗"; return; }

    const mapa = {};
    snap.forEach((docu) => {
      const d = docu.data();
      if (!mapa[d.empresa]) {
        mapa[d.empresa] = {
          empresa: d.empresa,
          nomeEmpresa: d.empresaNome || d.nomeEmpresa || "Empresa",
          total: 0, usos: 0, clientes: 0,
          ultimaValidacao: d.ultimaValidacao || 0,
          ultimaData: d.ultimaData || "--",
          ultimaHora: d.ultimaHora || "--"
        };
      }
      mapa[d.empresa].total    += Number(d.totalGasto || 0);
      mapa[d.empresa].usos     += Number(d.usos || 0);
      mapa[d.empresa].clientes++;
      if (Number(d.ultimaValidacao || 0) > mapa[d.empresa].ultimaValidacao) {
        mapa[d.empresa].ultimaValidacao = d.ultimaValidacao;
        mapa[d.empresa].ultimaData      = d.ultimaData || "--";
        mapa[d.empresa].ultimaHora      = d.ultimaHora || "--";
      }
    });

    const empresas = Object.values(mapa).sort((a, b) => b.ultimaValidacao - a.ultimaValidacao);
    lista.innerHTML = "";

    paginar(empresas, (e) => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="info">
          <h3>${e.nomeEmpresa}</h3>
          <p><strong>Total vendido:</strong> ${moeda(e.total)}</p>
          <p><strong>Usos:</strong> ${e.usos}</p>
          <p><strong>Clientes:</strong> ${e.clientes}</p>
          <p><strong>Última:</strong> ${e.ultimaData} ${e.ultimaHora}</p>
        </div>
        <div class="acao">
          <button class="btn-acao btn-ativar" onclick="verEmpresa('${e.empresa}')">Abrir</button>
        </div>`;
      lista.appendChild(card);
    });

  } catch (e) { console.error(e); lista.innerHTML = "Erro ao carregar ❌"; }
  restaurarBtnAtivo();
};


/* =========================================
   🔥 CLIENTES DE UMA EMPRESA (validações)
========================================= */

window.verEmpresa = async function(eId) {
  lista.innerHTML = "Carregando clientes...";
  fecharPainelConfig();

  try {
    const snap = await getDocs(query(
      collection(db, "clientesEmpresa"),
      where("empresa", "==", eId),
      orderBy("ultimaValidacao", "desc")
    ));

    lista.innerHTML = "";

    // Botão voltar
    const voltar = document.createElement("button");
    voltar.className = "btn-voltar-inline";
    voltar.textContent = "← Voltar";
    voltar.onclick = verValidacoes;
    lista.appendChild(voltar);

    if (snap.empty) {
      const p = document.createElement("p");
      p.textContent = "Nenhum cliente encontrado ❗";
      lista.appendChild(p);
      return;
    }

    const clientes = snap.docs.map(d => ({ data: d.data(), id: d.id }));

    renderPaginado(lista, clientes, ({ data: d }) => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <img src="${d.foto || "https://via.placeholder.com/80"}">
        <div class="info">
          <h3>${d.nome || d.clienteId}</h3>
          <p>${d.clienteId}</p>
          <p><strong>Total:</strong> ${moeda(d.totalGasto || 0)}</p>
          <p><strong>Usos:</strong> ${d.usos || 0}</p>
          ${d.premiacaoPendente ? '<span class="badge-premiacao"> Premiação pendente</span>' : ""}
          <p>${d.ultimaData || "--"} ${d.ultimaHora || "--"}</p>
        </div>
        <div class="acao">
          <button class="btn-acao btn-ativar"
            onclick="verDetalhesCliente('${eId}','${d.clienteId}')">
            Detalhes
          </button>
        </div>`;
      lista.appendChild(card);
    });

  } catch (e) { console.error(e); lista.innerHTML = "Erro ao carregar ❌"; }
};


/* =========================================
   🔥 HISTÓRICO DO CLIENTE
========================================= */

window.verDetalhesCliente = async function(eId, clienteId) {
  lista.innerHTML = "Carregando histórico...";
  fecharPainelConfig();

  try {
    const snap = await getDocs(query(
      collection(db, "validacoes"),
      where("empresa",   "==", eId),
      where("clienteId", "==", clienteId),
      orderBy("timestamp", "desc"),
      limit(200)
    ));

    lista.innerHTML = "";

    const voltar = document.createElement("button");
    voltar.className = "btn-voltar-inline";
    voltar.textContent = "← Voltar";
    voltar.onclick = () => verEmpresa(eId);
    lista.appendChild(voltar);

    if (snap.empty) {
      const p = document.createElement("p");
      p.textContent = "Nenhum histórico encontrado ❗";
      lista.appendChild(p);
      return;
    }

    const valids = snap.docs.map(d => d.data());

    renderPaginado(lista, valids, (d) => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="info">
          <h3>${d.clienteNome || clienteId}</h3>
          <p><strong>Valor:</strong> ${moeda(d.valor || 0)}</p>
          <p><strong>Desconto:</strong> ${d.desconto || 0}%</p>
          <p><strong>Total:</strong> ${moeda(d.total || 0)}</p>
          <p>${d.data || "--"} ${d.hora || "--"}</p>
        </div>`;
      lista.appendChild(card);
    });

  } catch (e) { console.error(e); lista.innerHTML = "Erro ao carregar ❌"; }
};

// Restaura o botão ativo ao carregar a página
document.addEventListener("DOMContentLoaded", restaurarBtnAtivo);
