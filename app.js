// =====================================================
// BAZAR EL SHADAY — app.js (admin da loja)
// O app NÃO fala direto com o banco: cada escrita passa
// pelo "portão" (Edge Function), que faz rate limit por
// usuário, valida comando/campos e guarda a chave forte.
//
// Configuração (já preenchida para o projeto do bazar):
//   - SUPABASE_URL            (Project Settings > API)
//   - SUPABASE_PUBLISHABLE_KEY (a chave PÚBLICA — nunca a secret)
//   - NOME_FUNCAO             (nome da Edge Function no Supabase)
//
// O CATÁLOGO público (catalogo.html) lê a MESMA tabela
// "produtos" — é assim que as duas páginas se conectam.
// =====================================================

// Projeto usa o NOVO sistema de chaves do Supabase.
// No NAVEGADOR use a PUBLISHABLE KEY (sb_publishable_...) — é pública por
// design, segura no cliente. NUNCA coloque a secret key (sb_secret_...) aqui.
const SUPABASE_URL = "https://mwggbbfidojucvmlywxd.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_saYnOUna58kgHNNHfKZgOg_hdhs_gm9";

// Nome da Edge Function = o SLUG dela (o que aparece na Function URL):
// https://mwggbbfidojucvmlywxd.supabase.co/functions/v1/rapid-responder
// ATENÇÃO: o rótulo "api" que aparece no dashboard é só nome de EXIBIÇÃO —
// a URL usa o slug, que não muda quando você renomeia a função.
const NOME_FUNCAO = "rapid-responder";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// ---------- utilidades ----------
const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const moeda = (n) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Chamada única ao "portão" (o token do login vai junto automaticamente)
async function api(payload) {
  const { data, error } = await db.functions.invoke(NOME_FUNCAO, { body: payload });
  if (error) {
    let msg = error.message;
    try { msg = (await error.context.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  return data;
}

// ---------- abas ----------
document.querySelectorAll(".aba").forEach((btn) =>
  btn.addEventListener("click", () => {
    document.querySelectorAll(".aba").forEach((b) => b.classList.remove("ativa"));
    document.querySelectorAll(".conteudo").forEach((c) => c.classList.add("oculta"));
    btn.classList.add("ativa");
    $("#aba-" + btn.dataset.aba).classList.remove("oculta");
  })
);

// ---------- LOGIN / LOGOUT ----------
$("#form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const { error } = await db.auth.signInWithPassword({
    email: $("#login-email").value.trim(),
    password: $("#login-senha").value,
  });
  $("#msg-login").textContent = error ? "Erro: " + error.message : "";
  $("#msg-login").className = "msg " + (error ? "erro" : "ok");
});

$("#btn-sair").addEventListener("click", () => db.auth.signOut());

db.auth.onAuthStateChange((_ev, session) => {
  $("#tela-login").classList.toggle("oculta", !!session);
  $("#tela-app").classList.toggle("oculta", !session);
  if (session) carregarTudo();
});

// ---------- ESTOQUE ----------
let produtos = [];

async function carregarEstoque() {
  try {
    produtos = (await api({ cmd: "list", tabela: "produtos" })) || [];
  } catch (e) { produtos = []; return alert("Erro: " + e.message); }
  const ul = $("#lista-produtos");
  ul.innerHTML = produtos.length
    ? produtos.map((p) => `
      <li class="item">
        <div class="info">
          <span class="nome">${esc(p.nome)}</span>
          <span class="det">${p.quantidade} un. · ${moeda(p.preco)}</span>
        </div>
        <button class="btn btn-mini" data-del-p="${p.id}">Remover</button>
      </li>`).join("")
    : '<li class="empty">Nenhum produto cadastrado.</li>';
  $("#v-produto").innerHTML =
    '<option value="">Escolha o produto…</option>' +
    produtos.map((p) => `<option value="${p.id}">${esc(p.nome)} — ${moeda(p.preco)}</option>`).join("");
  ul.querySelectorAll("[data-del-p]").forEach((b) =>
    b.addEventListener("click", async () => {
      if (!confirm("Remover este produto?")) return;
      try {
        await api({ cmd: "del", tabela: "produtos", id: b.dataset.delP });
        carregarEstoque();
      } catch (e) { alert("Erro: " + e.message); }
    })
  );
}

$("#form-produto").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api({
      cmd: "add", tabela: "produtos",
      dados: {
        nome: $("#p-nome").value.trim(),
        quantidade: +$("#p-qtd").value,
        preco: +$("#p-preco").value,
      },
    });
    e.target.reset();
    carregarEstoque();
  } catch (err) { alert("Erro: " + err.message); }
});

// ---------- VENDAS ----------
$("#form-venda").addEventListener("submit", async (e) => {
  e.preventDefault();
  const produto = produtos.find((p) => p.id === $("#v-produto").value);
  if (!produto) return;
  const qtd = +$("#v-qtd").value;
  try {
    const r = await api({ cmd: "venda", produtoId: produto.id, qtd });
    $("#msg-venda").textContent = "Venda registrada: " + r.produto + " × " + qtd + " = " + moeda(r.total);
    $("#msg-venda").className = "msg ok";
    e.target.reset();
    carregarTudo();
  } catch (err) {
    $("#msg-venda").textContent = err.message;
    $("#msg-venda").className = "msg erro";
  }
});

async function carregarVendas() {
  let vendas = [];
  try { vendas = (await api({ cmd: "list", tabela: "vendas" })) || []; } catch {}
  const hoje = new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD
  const ul = $("#lista-vendas");
  const deHoje = vendas.filter((v) => (v.created_at || "").startsWith(hoje));
  ul.innerHTML = deHoje.length
    ? deHoje.map((v) => `
      <li class="item">
        <div class="info">
          <span class="nome">${esc(v.produtos?.nome || "Produto removido")} × ${v.quantidade}</span>
          <span class="det">${new Date(v.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
        <strong>${moeda(v.total)}</strong>
      </li>`).join("")
    : '<li class="empty">Nenhuma venda hoje.</li>';
}

// ---------- CLIENTES ----------
async function carregarClientes() {
  let clientes = [];
  try { clientes = (await api({ cmd: "list", tabela: "clientes" })) || []; } catch (e) { return; }
  const ul = $("#lista-clientes");
  ul.innerHTML = clientes.length
    ? clientes.map((c) => `
      <li class="item">
        <div class="info">
          <span class="nome">${esc(c.nome)}</span>
          <span class="det">${esc(c.telefone)}</span>
        </div>
        <button class="btn btn-mini" data-del-c="${c.id}">Remover</button>
      </li>`).join("")
    : '<li class="empty">Nenhum cliente cadastrado.</li>';
  ul.querySelectorAll("[data-del-c]").forEach((b) =>
    b.addEventListener("click", async () => {
      if (!confirm("Remover este cliente?")) return;
      try {
        await api({ cmd: "del", tabela: "clientes", id: b.dataset.delC });
        carregarClientes();
      } catch (e) { alert("Erro: " + e.message); }
    })
  );
}

$("#form-cliente").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api({
      cmd: "add", tabela: "clientes",
      dados: {
        nome: $("#c-nome").value.trim(),
        telefone: $("#c-telefone").value.trim(),
      },
    });
    e.target.reset();
    carregarClientes();
  } catch (err) { alert("Erro: " + err.message); }
});

// ---------- iniciar ----------
function carregarTudo() {
  carregarEstoque();
  carregarVendas();
  carregarClientes();
}
db.auth.getSession().then(({ data }) => {
  if (data.session) carregarTudo();
});
