// =====================================================
// BAZAR EL SHADAY — app.js (admin da loja)
// SEGURANÇA: RLS no banco (Supabase) — só usuário LOGADO
// lê/escreve os dados; o catálogo público (anon) só lê
// produtos. Sem chave secreta no navegador, sem dependência
// de Edge Function (que ficou com o caminho público travado
// na plataforma — ver LEIA-ME, seção PLANO B).
//
// Configuração (já preenchida para o projeto do bazar):
//   - SUPABASE_URL            (Project Settings > API)
//   - SUPABASE_PUBLISHABLE_KEY (a chave PÚBLICA — nunca a secret)
//
// O CATÁLOGO público (catalogo.html) lê a MESMA tabela
// "produtos" — é assim que as duas páginas se conectam.
// =====================================================

// Projeto usa o NOVO sistema de chaves do Supabase.
// No NAVEGADOR use a PUBLISHABLE KEY (sb_publishable_...) — é pública por
// design, segura no cliente. NUNCA coloque a secret key (sb_secret_...) aqui.
const SUPABASE_URL = "https://mwggbbfidojucvmlywxd.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_saYnOUna58kgHNNHfKZgOg_hdhs_gm9";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// ---------- utilidades ----------
const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const moeda = (n) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Chamada única à base de dados.
// PLANO B (sem Edge Function): o app fala DIRETO com o banco via
// PostgREST, usando o token do login + RLS (só logado lê/escreve —
// a segurança fica no banco, que é o modelo oficial do Supabase).
function amigavel(error) {
  if (error.code === "42501")
    return "sem permissão (precisa estar logada — entre de novo)";
  return error.message;
}

async function api(payload) {
  const { cmd, tabela, id, dados, produtoId, qtd } = payload;

  if (cmd === "list") {
    const q = tabela === "vendas"
      ? db.from("vendas").select("*, produtos(nome)")
          .order("created_at", { ascending: false }).limit(30)
      : db.from(tabela).select("*").order("nome");
    const { data, error } = await q;
    if (error) throw new Error(amigavel(error));
    return data;
  }

  if (cmd === "add") {
    const { error } = await db.from(tabela).insert(dados);
    if (error) throw new Error(amigavel(error));
    return { ok: true };
  }

  if (cmd === "del") {
    const { error } = await db.from(tabela).delete().eq("id", id);
    if (error) throw new Error(amigavel(error));
    return { ok: true };
  }

  if (cmd === "venda") {
    const { data: p, error: e0 } = await db.from("produtos")
      .select("id, nome, quantidade, preco").eq("id", produtoId).single();
    if (e0 || !p) throw new Error("produto não encontrado");
    if (p.quantidade < qtd)
      throw new Error("estoque insuficiente (tem " + p.quantidade + ")");
    const total = Math.round((p.preco || 0) * qtd * 100) / 100;
    const { error: e1 } = await db.from("vendas")
      .insert({ produto_id: p.id, quantidade: qtd, total });
    if (e1) throw new Error(amigavel(e1));
    const { error: e2 } = await db.from("produtos")
      .update({ quantidade: p.quantidade - qtd }).eq("id", p.id);
    if (e2) throw new Error(amigavel(e2));
    return { ok: true, produto: p.nome, qtd, total };
  }

  throw new Error("comando inválido");
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
