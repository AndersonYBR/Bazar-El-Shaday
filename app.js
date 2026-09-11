// =====================================================
// BAZAR EL SHADAY — app.js (admin da loja) — v3
// SEGURANÇA: RLS no banco (Supabase) — só usuário LOGADO
// lê/escreve os dados; o catálogo público (anon) só lê
// produtos com estoque. Fotos no Storage (bucket "fotos").
//
// Recursos v3:
//  - Editar produto (nome, qtd, preço, categoria, tamanhos,
//    números e fotos)
//  - Até 4 fotos por produto (carrossel no catálogo)
//  - Categoria: Tenis, Roupa Masculina, Roupa Feminina,
//    Infantil, Outros
//  - Números selecionáveis p/ a categoria Tenis (19–46)
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

const CATEGORIAS = ["Tenis", "Roupa Masculina", "Roupa Feminina", "Infantil", "Outros"];
const CATEGORIAS_ROUPA = ["Roupa Masculina", "Roupa Feminina", "Infantil"];
const MAX_FOTOS = 4;
const MAX_FOTO_BYTES = 2 * 1024 * 1024;

// ---------- utilidades ----------
const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>\"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const moeda = (n) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fotosDe = (p) =>
  (Array.isArray(p.fotos) && p.fotos.length ? p.fotos
    : p.foto_url ? [p.foto_url] : []).slice(0, MAX_FOTOS);

function amigavel(error) {
  if (error.code === "42501")
    return "sem permissão (precisa estar logada — entre de novo)";
  return error.message;
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
let editandoId = null;   // id do produto em edição (null = modo adicionar)
let fotosManter = [];    // fotos existentes que continuam no produto

// chips de números (19 a 46) — gerados uma vez
(function montarChips() {
  const box = $("#chips-numeros");
  for (let n = 19; n <= 46; n++) {
    const lb = document.createElement("label");
    lb.className = "chip-num";
    lb.innerHTML = `<input type="checkbox" value="${n}"><span>${n}</span>`;
    box.appendChild(lb);
  }
})();

// mostra/oculta campos conforme a categoria escolhida
function mostrarCondicionais() {
  const cat = $("#p-categoria").value;
  $("#campo-numeros").classList.toggle("oculta", cat !== "Tenis");
  $("#campo-tamanhos").classList.toggle("oculta", !CATEGORIAS_ROUPA.includes(cat));
}
$("#p-categoria").addEventListener("change", mostrarCondicionais);
mostrarCondicionais();

function numerosMarcados() {
  return [...$("#chips-numeros").querySelectorAll("input:checked")]
    .map((cb) => cb.value).join(" ");
}

function renderizarPreview() {
  const box = $("#foto-preview");
  box.innerHTML = fotosManter.map((url, i) =>
    `<span class="mini-foto"><img src="${esc(url)}" alt="" />
      <button type="button" data-rm="${i}" title="Tirar esta foto">×</button></span>`
  ).join("");
  box.querySelectorAll("button[data-rm]").forEach((b) =>
    b.addEventListener("click", () => {
      fotosManter.splice(+b.dataset.rm, 1);
      renderizarPreview();
    })
  );
}

async function enviarFotos(arquivos, btn) {
  const urls = [];
  for (const file of arquivos) {
    if (file.size > MAX_FOTO_BYTES) throw new Error("foto muito grande (máx. 2 MB)");
    btn.textContent = "Enviando foto…";
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const caminho = "bazar/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) +
      "." + (/[a-z0-9]{2,4}$/.test(ext) ? ext : "jpg");
    const { error } = await db.storage.from("fotos").upload(caminho, file);
    if (error) throw new Error("falha ao enviar a foto: " + error.message);
    urls.push(db.storage.from("fotos").getPublicUrl(caminho).data.publicUrl);
  }
  return urls;
}

async function carregarEstoque() {
  try {
    produtos = (await db.from("produtos").select("*").order("nome").then((r) => {
      if (r.error) throw new Error(amigavel(r.error));
      return r.data;
    })) || [];
  } catch (e) { produtos = []; return alert("Erro: " + e.message); }
  const ul = $("#lista-produtos");
  ul.innerHTML = produtos.length
    ? produtos.map((p) => `
      <li class="item">
        ${fotosDe(p).length
          ? `<img class="thumb" src="${esc(fotosDe(p)[0])}" alt="" />`
          : '<span class="thumb emoji">🛍️</span>'}
        <div class="info">
          <span class="nome">${esc(p.nome)}${p.categoria ? ` <em class="cat-item">(${esc(p.categoria)})</em>` : ""}</span>
          <span class="det">${p.quantidade} un. · ${moeda(p.preco)}${
            p.numeros ? " · n.º " + esc(p.numeros) : ""}${
            p.tamanhos ? " · " + esc(p.tamanhos) : ""}</span>
        </div>
        <span class="acoes-item">
          <button class="btn btn-mini" data-edit-p="${p.id}">Editar</button>
          <button class="btn btn-mini" data-del-p="${p.id}">Remover</button>
        </span>
      </li>`).join("")
    : '<li class="empty">Nenhum produto cadastrado.</li>';
  $("#v-produto").innerHTML =
    '<option value="">Escolha o produto…</option>' +
    produtos.map((p) =>
      `<option value="${p.id}">${esc(p.nome)}${p.categoria ? ` (${esc(p.categoria)})` : ""} — ${moeda(p.preco)}</option>`).join("");
  ul.querySelectorAll("[data-del-p]").forEach((b) =>
    b.addEventListener("click", async () => {
      if (!confirm("Remover este produto? (Sai do catálogo também)")) return;
      try {
        const p = produtos.find((x) => x.id === b.dataset.delP);
        const { error } = await db.from("produtos").delete().eq("id", b.dataset.delP);
        if (error) throw new Error(amigavel(error));
        // tenta apagar as fotos do Storage (melhor esforço)
        (p ? fotosDe(p) : []).forEach((url) => {
          const caminho = decodeURIComponent(url.split("/public/fotos/")[1] || "");
          if (caminho) db.storage.from("fotos").remove([caminho]).catch(() => {});
        });
        if (editandoId === b.dataset.delP) cancelarEdicao();
        carregarEstoque();
      } catch (e) { alert("Erro: " + e.message); }
    })
  );
  ul.querySelectorAll("[data-edit-p]").forEach((b) =>
    b.addEventListener("click", () => iniciarEdicao(b.dataset.editP))
  );
}

function iniciarEdicao(id) {
  const p = produtos.find((x) => x.id === id);
  if (!p) return;
  editandoId = id;
  $("#p-nome").value = p.nome || "";
  $("#p-qtd").value = p.quantidade ?? "";
  $("#p-preco").value = p.preco ?? "";
  $("#p-categoria").value = p.categoria || "";
  mostrarCondicionais();
  $("#p-tam").value = p.tamanhos || "";
  const nums = (p.numeros || "").split(/\s+/).filter(Boolean);
  $("#chips-numeros").querySelectorAll("input[type=checkbox]").forEach((cb) =>
    (cb.checked = nums.includes(cb.value)));
  fotosManter = fotosDe(p);
  renderizarPreview();
  $("#btn-salvar-produto").textContent = "Salvar alterações";
  $("#btn-cancelar-edicao").classList.remove("oculta");
  $("#form-produto").scrollIntoView({ behavior: "smooth", block: "start" });
}

function cancelarEdicao() {
  editandoId = null;
  fotosManter = [];
  renderizarPreview();
  $("#form-produto").reset();
  mostrarCondicionais();
  $("#btn-salvar-produto").textContent = "Adicionar";
  $("#btn-cancelar-edicao").classList.add("oculta");
}
$("#btn-cancelar-edicao").addEventListener("click", cancelarEdicao);

$("#form-produto").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("#btn-salvar-produto");
  const cat = $("#p-categoria").value;
  try {
    const dados = {
      nome: $("#p-nome").value.trim(),
      quantidade: +$("#p-qtd").value,
      preco: +$("#p-preco").value,
      categoria: cat || null,
      tamanhos: CATEGORIAS_ROUPA.includes(cat) ? ($("#p-tam").value.trim() || null) : null,
      numeros: cat === "Tenis" ? (numerosMarcados() || null) : null,
    };

    // Fotos: mantém as existentes (sem as marcadas com ×) + as novas
    const novosArquivos = [...$("#p-fotos").files];
    if (novosArquivos.length > MAX_FOTOS - fotosManter.length)
      throw new Error(`máximo de ${MAX_FOTOS} fotos (o produto já tem ${fotosManter.length})`);
    const novas = await enviarFotos(novosArquivos, btn);
    dados.fotos = [...fotosManter, ...novas];

    btn.textContent = editandoId ? "Salvando…" : "Adicionando…";
    if (editandoId) {
      const { error } = await db.from("produtos").update(dados).eq("id", editandoId);
      if (error) throw new Error(amigavel(error));
    } else {
      const { error } = await db.from("produtos").insert(dados);
      if (error) throw new Error(amigavel(error));
    }
    cancelarEdicao();
    e.target.reset();
    carregarEstoque();
  } catch (err) { alert("Erro: " + err.message); }
  finally {
    btn.textContent = editandoId ? "Salvar alterações" : "Adicionar";
  }
});

// ---------- VENDAS ----------
$("#form-venda").addEventListener("submit", async (e) => {
  e.preventDefault();
  const produto = produtos.find((p) => p.id === $("#v-produto").value);
  if (!produto) return;
  const qtd = +$("#v-qtd").value;
  const { data: p, error: e0 } = await db.from("produtos")
    .select("id, nome, quantidade, preco").eq("id", produto.id).single();
  if (e0 || !p) {
    $("#msg-venda").textContent = "Produto não encontrado (recarregue a lista)";
    $("#msg-venda").className = "msg erro";
    return;
  }
  if (p.quantidade < qtd) {
    $("#msg-venda").textContent = "Estoque insuficiente (tem " + p.quantidade + ")";
    $("#msg-venda").className = "msg erro";
    return;
  }
  const total = Math.round((p.preco || 0) * qtd * 100) / 100;
  const { error: e1 } = await db.from("vendas")
    .insert({ produto_id: p.id, quantidade: qtd, total });
  if (e1) {
    $("#msg-venda").textContent = "Erro: " + amigavel(e1);
    $("#msg-venda").className = "msg erro";
    return;
  }
  const { error: e2 } = await db.from("produtos")
    .update({ quantidade: p.quantidade - qtd }).eq("id", p.id);
  if (e2) {
    $("#msg-venda").textContent = "Venda gravada, mas o estoque não baixou: " + amigavel(e2);
    $("#msg-venda").className = "msg erro";
    return;
  }
  $("#msg-venda").textContent = "Venda registrada: " + p.nome + " × " + qtd + " = " + moeda(total);
  $("#msg-venda").className = "msg ok";
  e.target.reset();
  carregarTudo();
});

async function carregarVendas() {
  let vendas = [];
  const { data, error } = await db.from("vendas")
    .select("*, produtos(nome)")
    .order("created_at", { ascending: false }).limit(30);
  if (!error) vendas = data || [];
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
  const { data, error } = await db.from("clientes").select("*").order("nome");
  if (!error) clientes = data || [];
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
      const { error } = await db.from("clientes").delete().eq("id", b.dataset.delC);
      if (error) alert("Erro: " + amigavel(error));
      carregarClientes();
    })
  );
}

$("#form-cliente").addEventListener("submit", async (e) => {
  e.preventDefault();
  const { error } = await db.from("clientes").insert({
    nome: $("#c-nome").value.trim(),
    telefone: $("#c-telefone").value.trim(),
  });
  if (error) return alert("Erro: " + amigavel(error));
  e.target.reset();
  carregarClientes();
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
