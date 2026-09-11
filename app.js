// =====================================================
// BAZAR DA VAL — app.js (painel admin) — v4
// SEGURANÇA: RLS no banco — só usuário LOGADO lê/escreve.
//
// v4: produto c/ gênero, cor, custo; categorias novas;
//     venda com VÁRIOS itens + comprador + pagamento +
//     troco + descrição (log fica mesmo se o produto
//     for excluído); cliente c/ endereço + edição;
//     página de LUCRO com gráfico por produto.
// =====================================================

// Projeto usa o NOVO sistema de chaves do Supabase.
// NAVEGADOR: publishable key (pública por design). NUNCA a secret.
const SUPABASE_URL = "https://mwggbbfidojucvmlywxd.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_saYnOUna58kgHNNHfKZgOg_hdhs_gm9";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const CATEGORIAS = ["Roupas", "Calçados", "Acessórios", "Infantil", "Pets", "Utilidades para Casa"];
const CATEGORIAS_COM_TAMANHO = ["Roupas", "Infantil"];
const MAX_FOTOS = 4;
const MAX_FOTO_BYTES = 2 * 1024 * 1024;

// ---------- utilidades ----------
const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>\"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const moeda = (n) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (v) => { const n = parseFloat(v); return isNaN(n) ? null : n; };
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
    if (btn.dataset.aba === "lucro") carregarLucro();
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

// =====================================================
// ESTOQUE
// =====================================================
let produtos = [];
let editandoId = null;
let fotosManter = [];

// chips de números (19 a 46)
(function montarChips() {
  const box = $("#chips-numeros");
  for (let n = 19; n <= 46; n++) {
    const lb = document.createElement("label");
    lb.className = "chip-num";
    lb.innerHTML = `<input type="checkbox" value="${n}"><span>${n}</span>`;
    box.appendChild(lb);
  }
})();

function mostrarCondicionais() {
  const cat = $("#p-categoria").value;
  $("#campo-numeros").classList.toggle("oculta", cat !== "Calçados");
  $("#campo-tamanhos").classList.toggle("oculta", !CATEGORIAS_COM_TAMANHO.includes(cat));
}
$("#p-categoria").addEventListener("change", mostrarCondicionais);
mostrarCondicionais();

const numerosMarcados = () =>
  [...$("#chips-numeros").querySelectorAll("input:checked")].map((cb) => cb.value).join(" ");

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
  const { data, error } = await db.from("produtos").select("*").order("nome");
  if (error) { produtos = []; return alert("Erro: " + amigavel(error)); }
  produtos = data || [];
  const ul = $("#lista-produtos");
  ul.innerHTML = produtos.length
    ? produtos.map((p) => `
      <li class="item">
        ${fotosDe(p).length
          ? `<img class="thumb" src="${esc(fotosDe(p)[0])}" alt="" />`
          : '<span class="thumb emoji">🛍️</span>'}
        <div class="info">
          <span class="nome">${esc(p.nome)}${p.categoria ? ` <em class="cat-item">(${esc(p.categoria)}${p.genero ? " · " + esc(p.genero) : ""})</em>` : ""}</span>
          <span class="det">${p.quantidade} un · venda ${moeda(p.preco)}${p.custo ? " · custo " + moeda(p.custo) : ""}${p.cor ? " · " + esc(p.cor) : ""}${
            p.numeros ? " · n.º " + esc(p.numeros) : ""}${p.tamanhos ? " · " + esc(p.tamanhos) : ""}</span>
        </div>
        <span class="acoes-item">
          <button class="btn btn-mini" data-edit-p="${p.id}">Editar</button>
          <button class="btn btn-mini" data-del-p="${p.id}">Remover</button>
        </span>
      </li>`).join("")
    : '<li class="empty">Nenhum produto cadastrado.</li>';

  $("#v-produto").innerHTML =
    '<option value="">Produto…</option>' +
    produtos.map((p) =>
      `<option value="${p.id}">${esc(p.nome)}${p.categoria ? ` (${esc(p.categoria)}${p.genero ? " · " + esc(p.genero) : ""})` : ""} — ${moeda(p.preco)}</option>`).join("");

  ul.querySelectorAll("[data-del-p]").forEach((b) =>
    b.addEventListener("click", async () => {
      if (!confirm("Remover este produto? (Sai do catálogo. As vendas antigas continuam registradas.)")) return;
      try {
        const p = produtos.find((x) => x.id === b.dataset.delP);
        const { error } = await db.from("produtos").delete().eq("id", b.dataset.delP);
        if (error) throw new Error(amigavel(error));
        (p ? fotosDe(p) : []).forEach((url) => {
          const caminho = decodeURIComponent(url.split("/public/fotos/")[1] || "");
          if (caminho) db.storage.from("fotos").remove([caminho]).catch(() => {});
        });
        if (editandoId === b.dataset.delP) cancelarEdicaoProduto();
        carregarEstoque();
      } catch (e) { alert("Erro: " + e.message); }
    })
  );
  ul.querySelectorAll("[data-edit-p]").forEach((b) =>
    b.addEventListener("click", () => iniciarEdicaoProduto(b.dataset.editP))
  );
}

function iniciarEdicaoProduto(id) {
  const p = produtos.find((x) => x.id === id);
  if (!p) return;
  editandoId = id;
  $("#p-nome").value = p.nome || "";
  $("#p-qtd").value = p.quantidade ?? "";
  $("#p-preco").value = p.preco ?? "";
  $("#p-custo").value = p.custo ?? "";
  $("#p-categoria").value = p.categoria || "";
  $("#p-genero").value = p.genero || "";
  $("#p-cor").value = p.cor || "";
  mostrarCondicionais();
  $("#p-tam").value = p.tamanhos || "";
  const nums = (p.numeros || "").split(/\s+/).filter(Boolean);
  $("#chips-numeros").querySelectorAll("input[type=checkbox]").forEach((cb) =>
    (cb.checked = nums.includes(cb.value)));
  $("#p-desc").value = p.descricao || "";
  fotosManter = fotosDe(p);
  renderizarPreview();
  $("#btn-salvar-produto").textContent = "Salvar alterações";
  $("#btn-cancelar-edicao").classList.remove("oculta");
  $("#form-produto").scrollIntoView({ behavior: "smooth", block: "start" });
}

function cancelarEdicaoProduto() {
  editandoId = null;
  fotosManter = [];
  renderizarPreview();
  $("#form-produto").reset();
  mostrarCondicionais();
  $("#btn-salvar-produto").textContent = "Adicionar";
  $("#btn-cancelar-edicao").classList.add("oculta");
}
$("#btn-cancelar-edicao").addEventListener("click", cancelarEdicaoProduto);

$("#form-produto").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("#btn-salvar-produto");
  const cat = $("#p-categoria").value;
  try {
    const dados = {
      nome: $("#p-nome").value.trim(),
      quantidade: +$("#p-qtd").value,
      preco: num($("#p-preco").value) || 0,
      custo: num($("#p-custo").value),
      categoria: cat || null,
      genero: $("#p-genero").value || null,
      cor: $("#p-cor").value.trim() || null,
      tamanhos: CATEGORIAS_COM_TAMANHO.includes(cat) ? ($("#p-tam").value.trim() || null) : null,
      numeros: cat === "Calçados" ? (numerosMarcados() || null) : null,
      descricao: $("#p-desc").value.trim() || null,
    };
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
    cancelarEdicaoProduto();
    e.target.reset();
    carregarEstoque();
  } catch (err) { alert("Erro: " + err.message); }
  finally {
    btn.textContent = editandoId ? "Salvar alterações" : "Adicionar";
  }
});

// =====================================================
// VENDAS (vários itens + comprador + pagamento + troco)
// =====================================================
let carrinho = []; // {id, nome, preco, custo, qtd}

$("#btn-adicionar-item").addEventListener("click", () => {
  const id = $("#v-produto").value;
  const p = produtos.find((x) => x.id === id);
  if (!p) return alert("Escolha um produto.");
  const qtd = +$("#v-qtd").value;
  if (!qtd || qtd < 1) return alert("Quantidade inválida.");
  if (p.quantidade < qtd + (carrinho.find((i) => i.id === id)?.qtd || 0))
    return alert("Estoque insuficiente (tem " + p.quantidade + ").");
  const existente = carrinho.find((i) => i.id === id);
  if (existente) existente.qtd += qtd;
  else carrinho.push({ id: p.id, nome: p.nome, preco: p.preco, custo: p.custo || 0, qtd });
  $("#v-qtd").value = 1;
  renderizarCarrinho();
});

function renderizarCarrinho() {
  const ul = $("#venda-itens");
  ul.innerHTML = carrinho.length
    ? carrinho.map((i, x) => `
      <li class="item">
        <div class="info">
          <span class="nome">${esc(i.nome)} × ${i.qtd}</span>
          <span class="det">${moeda(i.preco)} un · ${moeda(i.preco * i.qtd)}</span>
        </div>
        <button class="btn btn-mini" data-rm-item="${x}">Tirar</button>
      </li>`).join("")
    : '<li class="empty">Nenhum item na venda — adicione acima.</li>';
  ul.querySelectorAll("[data-rm-item]").forEach((b) =>
    b.addEventListener("click", () => {
      carrinho.splice(+b.dataset.rmItem, 1);
      renderizarCarrinho();
    })
  );
  $("#venda-total").textContent = carrinho.length
    ? "Total: " + moeda(carrinho.reduce((s, i) => s + i.preco * i.qtd, 0))
    : "";
}

// cliente selecionado preenche nome/telefone
$("#v-cliente").addEventListener("change", () => {
  const c = clientes.find((x) => x.id === $("#v-cliente").value);
  if (c) { $("#v-nome").value = c.nome; $("#v-tel").value = c.telefone || ""; }
  else { $("#v-nome").value = ""; $("#v-tel").value = ""; }
});

async function carregarClientes() {
  const { data, error } = await db.from("clientes").select("*").order("nome");
  if (!error) clientes = data || [];
  // select de comprador na venda
  $("#v-cliente").innerHTML =
    '<option value="">Comprador: avulso (sem cliente)</option>' +
    (clientes || []).map((c) =>
      `<option value="${c.id}">${esc(c.nome)}${c.telefone ? " — " + esc(c.telefone) : ""}</option>`).join("");
  const ul = $("#lista-clientes");
  ul.innerHTML = (clientes || []).length
    ? clientes.map((c) => `
      <li class="item">
        <div class="info">
          <span class="nome">${esc(c.nome)}</span>
          <span class="det">${esc(c.telefone)}${c.endereco ? " · " + esc(c.endereco) : ""}</span>
        </div>
        <span class="acoes-item">
          <button class="btn btn-mini" data-edit-c="${c.id}">Editar</button>
          <button class="btn btn-mini" data-del-c="${c.id}">Remover</button>
        </span>
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
  ul.querySelectorAll("[data-edit-c]").forEach((b) =>
    b.addEventListener("click", () => iniciarEdicaoCliente(b.dataset.editC))
  );
}

$("#form-cliente").addEventListener("submit", async (e) => {
  e.preventDefault();
  const dados = {
    nome: $("#c-nome").value.trim(),
    telefone: $("#c-telefone").value.trim(),
    endereco: $("#c-endereco").value.trim() || null,
  };
  try {
    if (editandoClienteId) {
      const { error } = await db.from("clientes").update(dados).eq("id", editandoClienteId);
      if (error) throw new Error(amigavel(error));
    } else {
      const { error } = await db.from("clientes").insert(dados);
      if (error) throw new Error(amigavel(error));
    }
    cancelarEdicaoCliente();
    e.target.reset();
    carregarClientes();
  } catch (err) { alert("Erro: " + err.message); }
});

let editandoClienteId = null;
function iniciarEdicaoCliente(id) {
  const c = (clientes || []).find((x) => x.id === id);
  if (!c) return;
  editandoClienteId = id;
  $("#c-nome").value = c.nome || "";
  $("#c-telefone").value = c.telefone || "";
  $("#c-endereco").value = c.endereco || "";
  $("#btn-salvar-cliente").textContent = "Salvar alterações";
  $("#btn-cancelar-cliente").classList.remove("oculta");
  $("#form-cliente").scrollIntoView({ behavior: "smooth", block: "start" });
}
function cancelarEdicaoCliente() {
  editandoClienteId = null;
  $("#form-cliente").reset();
  $("#btn-salvar-cliente").textContent = "Adicionar";
  $("#btn-cancelar-cliente").classList.add("oculta");
}
$("#btn-cancelar-cliente").addEventListener("click", cancelarEdicaoCliente);

$("#form-venda").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("#msg-venda");
  msg.className = "msg";
  if (!carrinho.length) { msg.textContent = "Adicione ao menos um item à venda."; msg.className = "msg erro"; return; }
  const total = Math.round(carrinho.reduce((s, i) => s + i.preco * i.qtd, 0) * 100) / 100;

  // confere estoque de tudo
  const emEstoque = (id, qtd) => {
    const p = produtos.find((x) => x.id === id);
    return p && p.quantidade >= qtd;
  };
  for (const i of carrinho)
    if (!emEstoque(i.id, i.qtd)) {
      msg.textContent = "Estoque insuficiente: " + i.nome;
      msg.className = "msg erro";
      return;
    }

  try {
    // baixa o estoque
    for (const i of carrinho) {
      const p = produtos.find((x) => x.id === i.id);
      const { error } = await db.from("produtos")
        .update({ quantidade: p.quantidade - i.qtd }).eq("id", p.id);
      if (error) throw new Error(amigavel(error));
    }
    // grava a venda (cabecalho)
    const header = {
      cliente_id: $("#v-cliente").value || null,
      cliente_nome: $("#v-nome").value.trim() || null,
      cliente_telefone: $("#v-tel").value.trim() || null,
      pagamento: $("#v-pagamento").value || null,
      troco: num($("#v-troco").value),
      descricao: $("#v-desc").value.trim() || null,
      total,
    };
    const { data: venda, error: e1 } = await db.from("vendas")
      .insert(header).select("id").single();
    if (e1) throw new Error(amigavel(e1));

    // grava os itens (com snapshot de nome/preço/custo = log permanente)
    const itens = carrinho.map((i) => ({
      venda_id: venda.id,
      produto_id: i.id,
      produto_nome: i.nome,
      quantidade: i.qtd,
      preco_unit: i.preco,
      custo_unit: i.custo || 0,
      valor: Math.round(i.preco * i.qtd * 100) / 100,
    }));
    const { error: e2 } = await db.from("venda_itens").insert(itens);
    if (e2) {
      await db.from("vendas").delete().eq("id", venda.id); // desfaz o cabeçalho
      // repõe o estoque
      for (const i of carrinho) {
        const p = produtos.find((x) => x.id === i.id);
        db.from("produtos").update({ quantidade: p.quantidade + i.qtd }).eq("id", p.id);
      }
      throw new Error(amigavel(e2));
    }
    msg.textContent = "Venda registrada: " + moeda(total) +
      (header.cliente_nome ? " · " + header.cliente_nome : "") +
      (header.pagamento ? " · " + header.pagamento : "");
    msg.className = "msg ok";
    carrinho = [];
    renderizarCarrinho();
    e.target.reset();
    carregarEstoque();
    carregarVendas();
  } catch (err) {
    msg.textContent = "Erro: " + err.message;
    msg.className = "msg erro";
  }
});

async function carregarVendas() {
  const { data, error } = await db.from("vendas")
    .select("id, total, pagamento, troco, descricao, cliente_nome, created_at, venda_itens(produto_nome, quantidade, valor)")
    .order("created_at", { ascending: false }).limit(20);
  const vendas = (!error && data) ? data : [];
  const ul = $("#lista-vendas");
  ul.innerHTML = vendas.length
    ? vendas.map((v) => {
        const d = new Date(v.created_at);
        const dataHora = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) +
          " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        const itens = (v.venda_itens || []).map((i) => esc(i.produto_nome) + " × " + i.quantidade).join(", ");
        const extra = [
          v.pagamento,
          v.troco ? "troco " + moeda(v.troco) : null,
          v.cliente_nome ? "👤 " + v.cliente_nome : null,
          v.descricao ? "“" + v.descricao + "”" : null,
        ].filter(Boolean).join(" · ");
        return `
      <li class="item">
        <div class="info">
          <span class="nome">${itens}</span>
          <span class="det">${dataHora}${extra ? " · " + esc(extra) : ""}</span>
        </div>
        <strong>${moeda(v.total)}</strong>
      </li>`;
      }).join("")
    : '<li class="empty">Nenhuma venda registrada.</li>';
}

// =====================================================
// LUCRO (gráfico por produto)
// =====================================================
async function carregarLucro() {
  const { data, error } = await db.from("vendas")
    .select("created_at, venda_itens(produto_nome, quantidade, custo_unit, valor)")
    .order("created_at", { ascending: false }).limit(500);
  const vendas = (!error && data) ? data : [];
  const periodo = $("#lucro-periodo").value;
  const agora = new Date();
  const inicio = new Date();
  if (periodo === "hoje") { inicio.setHours(0, 0, 0, 0); }
  else if (periodo === "7d") inicio.setDate(agora.getDate() - 7);
  else if (periodo === "mes") { inicio.setDate(1); inicio.setHours(0, 0, 0, 0); }

  const porProduto = {};
  let receita = 0, custo = 0;
  for (const v of vendas) {
    if (periodo !== "tudo" && new Date(v.created_at) < inicio) continue;
    for (const i of v.venda_itens || []) {
      const nome = i.produto_nome || "Produto removido";
      const r = Number(i.valor || 0);
      const c = Number(i.custo_unit || 0) * Number(i.quantidade || 0);
      receita += r; custo += c;
      const g = porProduto[nome] || (porProduto[nome] = { qtd: 0, receita: 0, custo: 0 });
      g.qtd += Number(i.quantidade || 0);
      g.receita += r; g.custo += c;
    }
  }
  const lucro = receita - custo;
  const margem = receita > 0 ? Math.round((lucro / receita) * 100) : 0;

  $("#lucro-cards").innerHTML = `
    <div class="lucro-card"><span class="lbl">RECEITA</span><span class="val">${moeda(receita)}</span></div>
    <div class="lucro-card"><span class="lbl">CUSTO</span><span class="val">${moeda(custo)}</span></div>
    <div class="lucro-card ${lucro >= 0 ? "ok" : "ruim"}"><span class="lbl">LUCRO</span><span class="val">${moeda(lucro)}</span></div>
    <div class="lucro-card ${margem >= 0 ? "ok" : "ruim"}"><span class="lbl">MARGEM</span><span class="val">${margem}%</span></div>`;

  const lista = Object.entries(porProduto)
    .map(([nome, g]) => ({ nome, ...g, lucro: g.receita - g.custo }))
    .sort((a, b) => b.lucro - a.lucro);
  const maxReceita = Math.max(...lista.map((l) => l.receita), 1);

  $("#lucro-grafico").innerHTML = lista.length
    ? lista.map((l) => `
      <div class="lucro-produto">
        <div class="topo">
          <span>${esc(l.nome)} <em class="cat-item">(${l.qtd} un.)</em></span>
          <span class="${l.lucro >= 0 ? "ok" : "ruim"}">${moeda(l.lucro)}</span>
        </div>
        <div class="barra receita"><span style="width:${Math.max(3, (l.receita / maxReceita) * 100)}%"></span></div>
        <div class="barra lucro"><span style="width:${Math.max(3, ((l.lucro > 0 ? l.lucro : 0) / maxReceita) * 100)}%"></span></div>
        <p class="det-barra">Receita ${moeda(l.receita)} · Custo ${moeda(l.custo)}</p>
      </div>`).join("")
    : '<p class="empty">Sem vendas no período. (O lucro usa o “Custo unit.” lançado no produto.)</p>';
}
$("#lucro-periodo").addEventListener("change", carregarLucro);

// =====================================================
// iniciar
// =====================================================
let clientes = [];
function carregarTudo() {
  carregarEstoque();
  carregarClientes();
  carregarVendas();
  renderizarCarrinho();
}
db.auth.getSession().then(({ data }) => {
  if (data.session) carregarTudo();
});
