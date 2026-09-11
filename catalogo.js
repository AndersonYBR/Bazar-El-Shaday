const SUPABASE_URL = "https://mwggbbfidojucvmlywxd.supabase.co";

// Use somente a Publishable key.
// Nunca coloque a Secret key neste arquivo.
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_saYnOUna58kgHNNHfKZgOg_hdhs_gm9";

const dbPublico = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
 );

const listaCatalogo = document.querySelector("#lista-catalogo");
const mensagem = document.querySelector("#msg-catalogo");
const selectOrdenar = document.querySelector("#ordenar-catalogo");
const chipsCategoria = document.querySelector("#chips-categoria");

const CATEGORIAS = ["Tenis", "Roupa Masculina", "Roupa Feminina", "Infantil", "Outros"];
const MAX_FOTOS = 4;

let produtosAtual = [];
let filtroCategoria = "Todos";
let ordem = "recentes";
let carrossels = [];

function escapar(texto) {
  return String(texto ?? "").replace(/[&<>\"']/g, (caractere) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[caractere]));
}

function formatarPreco(valor) {
  return Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

// Fotos do produto: a lista nova (fotos[]) ou a antiga (foto_url)
function fotosDe(produto) {
  const f = Array.isArray(produto.fotos) && produto.fotos.length
    ? produto.fotos
    : produto.foto_url ? [produto.foto_url] : [];
  return f.slice(0, MAX_FOTOS);
}

async function carregarCatalogo() {
  // Enquanto não está carregando, não apaga a lista que já está na tela
  if (!listaCatalogo.dataset.preenchido)
    mensagem.textContent = "Carregando produtos...";

  const { data: produtos, error } = await dbPublico
    .from("produtos")
    .select("id, nome, quantidade, preco, foto_url, fotos, tamanhos, numeros, categoria, created_at")
    .gt("quantidade", 0)
    .limit(300);

  if (error) {
    console.error("Erro ao carregar catálogo:", error);
    mensagem.textContent = "Não foi possível carregar os produtos.";
    return;
  }

  mensagem.textContent = "Atualizado às " +
    new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  produtosAtual = produtos || [];
  montarChips();
  renderizar();
  listaCatalogo.dataset.preenchido = "1";
}

// Filtros de categoria (mostra só as que existem, + "Todos")
function montarChips() {
  const presentes = CATEGORIAS.filter(
    (c) => produtosAtual.some((p) => p.categoria === c)
  );
  if (!presentes.includes(filtroCategoria) && filtroCategoria !== "Todos")
    filtroCategoria = "Todos";
  const opcoes = ["Todos", ...presentes];
  chipsCategoria.innerHTML = opcoes.map((c) =>
    `<button type="button" class="chip-cat ${c === filtroCategoria ? "ativa" : ""}"
      data-cat="${escapar(c)}">${escapar(c)}</button>`
  ).join("");
  chipsCategoria.querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => {
      filtroCategoria = b.dataset.cat;
      renderizar();
    })
  );
}

function renderizar() {
  let lista = produtosAtual.filter(
    (p) => filtroCategoria === "Todos" || p.categoria === filtroCategoria
  );
  const ordenadores = {
    recentes: (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0),
    "preco-asc": (a, b) => a.preco - b.preco,
    "preco-desc": (a, b) => b.preco - a.preco,
    nome: (a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"),
  };
  lista = [...lista].sort(ordenadores[ordem] || ordenadores.recentes);

  // mantém o chip ativo destacado
  chipsCategoria.querySelectorAll("button").forEach((b) =>
    b.classList.toggle("ativa", b.dataset.cat === filtroCategoria));

  if (!lista.length) {
    listaCatalogo.innerHTML =
      '<p class="empty">Nenhum produto disponível no momento.</p>';
    carrossels = [];
    return;
  }

  listaCatalogo.innerHTML = lista.map((p) => card(p)).join("");
  iniciarCarrossels();
}

function card(produto) {
  const fotos = fotosDe(produto);
  const imagem = fotos.length
    ? `<div class="carousel">
        ${fotos.map((f, i) =>
          `<img class="slide ${i === 0 ? "ativa" : ""}" src="${escapar(f)}"
            alt="${escapar(produto.nome)}" ${i > 0 ? 'loading="lazy"' : ""}
            onerror="${fotos.length === 1 ? "this.outerHTML='🛍️'" : "this.remove()"}" />`).join("")}
        ${fotos.length > 1
          ? `<div class="dots">${fotos.map((_, i) =>
              `<span class="dot ${i === 0 ? "ativa" : ""}" data-dot="${i}"></span>`).join("")}</div>`
          : ""}
      </div>`
    : '<div class="imagem-produto">🛍️</div>';

  return `
    <article class="card-produto">
      ${imagem}
      ${produto.categoria
        ? `<span class="badge-cat">${escapar(produto.categoria)}</span>`
        : ""}
      <h2>${escapar(produto.nome)}</h2>
      ${produto.numeros
        ? `<p class="numeros">Números: ${escapar(produto.numeros)}</p>`
        : ""}
      ${produto.tamanhos
        ? `<p class="tamanhos">${escapar(produto.tamanhos)}</p>`
        : ""}
      <p class="preco">${formatarPreco(produto.preco)}</p>
      <p class="disponibilidade">
        ${produto.quantidade} unidade(s) disponível(is)
      </p>
      <p class="contato">📱 (31) 97189-2234 · Nova Pampulha, Vespasiano/MG</p>
      <a
        class="btn"
        target="_blank"
        rel="noopener"
        href="https://wa.me/5531971892234?text=${encodeURIComponent(
          `Olá! Tenho interesse no produto: ${produto.nome}`
         )}">
        Tenho interesse
      </a>
    </article>
  `;
}

// ---------- carrossel (roda sozinho a cada 3,5s) ----------
function iniciarCarrossels() {
  carrossels = [...document.querySelectorAll(".carousel")].map((el) => {
    const c = {
      el,
      imgs: [...el.querySelectorAll(".slide")],
      dots: [...el.querySelectorAll(".dot")],
      i: 0,
    };
    c.dots.forEach((d, n) => d.addEventListener("click", () => irPara(c, n)));
    return c;
  }).filter((c) => c.imgs.length > 1);
}

function irPara(c, n) {
  c.i = (n + c.imgs.length) % c.imgs.length;
  c.imgs.forEach((img, x) => img.classList.toggle("ativa", x === c.i));
  c.dots.forEach((d, x) => d.classList.toggle("ativa", x === c.i));
}

// Atualiza sozinho a cada 30s — o que a dona cadastra no app
// (com quantidade > 0) aparece aqui sem precisar recarregar a página.
carregarCatalogo();
setInterval(carregarCatalogo, 30000);
setInterval(() => carrossels.forEach((c) => irPara(c, c.i + 1)), 3500);

// ---------- carrossel de banners (topo) ----------
(function bannerCarrossel() {
  const slides = [...document.querySelectorAll(".banner-slide")];
  const dots = [...document.querySelectorAll(".banner-dot")];
  let i = 0;
  if (slides.length < 2) return;

  function irPara(n) {
    i = (n + slides.length) % slides.length;
    slides.forEach((s, x) => s.classList.toggle("ativa", x === i));
    dots.forEach((d, x) => d.classList.toggle("ativa", x === i));
  }

  dots.forEach((d, n) => d.addEventListener("click", () => irPara(n)));
  document.querySelector("#banner-ant")?.addEventListener("click", () => irPara(i - 1));
  document.querySelector("#banner-prox")?.addEventListener("click", () => irPara(i + 1));
  setInterval(() => irPara(i + 1), 5000); // troca sozinho a cada 5s
})();

// Ordenação escolhida pelo cliente
selectOrdenar.addEventListener("change", () => {
  ordem = selectOrdenar.value;
  renderizar();
});

// Botão "Atualizar agora"
const btnAtualizar = document.querySelector("#btn-atualizar");
if (btnAtualizar)
  btnAtualizar.addEventListener("click", () => {
    mensagem.textContent = "Atualizando...";
    carregarCatalogo();
  });
