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

const CATEGORIAS = ["Roupas", "Calçados", "Acessórios", "Infantil", "Pets", "Utilidades para Casa"];
const MAX_FOTOS = 4;

let produtosAtual = [];
let filtroCategoria = "Todos";
let filtroGenero = "";
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
    .select("id, nome, quantidade, preco, foto_url, fotos, tamanhos, numeros, categoria, genero, cor, created_at")
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
  if (filtroCategoria !== "Todos" && !presentes.includes(filtroCategoria))
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
    (p) =>
      (filtroCategoria === "Todos" || p.categoria === filtroCategoria) &&
      (!filtroGenero || p.genero === filtroGenero)
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

  // clique no card (fora dos botões) abre a página do produto
  listaCatalogo.querySelectorAll(".card-produto").forEach((el) =>
    el.addEventListener("click", (e) => {
      if (e.target.closest("a,button")) return;
      location.href = "produto.html?produto=" + el.dataset.id;
    }));
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
    <article class="card-produto" data-id="${produto.id}" title="Ver detalhes">
      ${imagem}
      <div class="badge-linha">
        ${produto.categoria
          ? `<span class="badge-cat">${escapar(produto.categoria)}</span>`
          : ""}
        ${produto.genero
          ? `<span class="badge-gen">${escapar(produto.genero)}</span>`
          : ""}
      </div>
      <h2>${escapar(produto.nome)}</h2>
      ${produto.numeros
        ? `<p class="numeros">Números: ${escapar(produto.numeros)}</p>`
        : ""}
      ${produto.cor
        ? `<p class="cor-produto">🎨 ${escapar(produto.cor)}</p>`
        : ""}
      ${produto.tamanhos
        ? `<p class="tamanhos">${escapar(produto.tamanhos)}</p>`
        : ""}
      <p class="preco">${formatarPreco(produto.preco)}</p>
      <p class="disponibilidade">
        ${produto.quantidade} unidade(s) disponível(is)
      </p>
      <p class="contato">📱 (31) 8886-6910 · Nova Pampulha, Vespasiano/MG</p>
      <a
        class="btn"
        target="_blank"
        rel="noopener"
        href="https://wa.me/553188866910?text=${encodeURIComponent(
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

// ---------- filtros: navbar + gênero ----------
const NAV_FILTROS = {
  inicio:     { genero: "", categoria: "Todos" },
  masculino: { genero: "Masculino", categoria: "Todos" },
  feminino:  { genero: "Feminino", categoria: "Todos" },
  infantil:  { genero: "Infantil", categoria: "Todos" },
  pets:      { genero: "", categoria: "Pets" },
  utilidades:{ genero: "", categoria: "Utilidades para Casa" },
};
function aplicarFiltro(f) {
  filtroGenero = f.genero;
  filtroCategoria = f.categoria;
  const sel = document.querySelector("#sel-genero");
  if (sel) sel.value = f.genero || "";
  renderizar();
}
document.querySelectorAll("[data-filtro]").forEach((a) =>
  a.addEventListener("click", (e) => {
    const f = NAV_FILTROS[a.dataset.filtro];
    if (!f) return;
    aplicarFiltro(f);
    document.querySelectorAll("[data-filtro]").forEach((x) =>
      x.classList.toggle("ativa", x === a));
    if (a.dataset.filtro !== "inicio")
      e.preventDefault();
    document.querySelector("#produtos").scrollIntoView({ behavior: "smooth" });
  }));
document.querySelector("#sel-genero").addEventListener("change", (e) => {
  filtroGenero = e.target.value;
  renderizar();
});

// ---------- menu mobile (hambúrguer) ----------
(function menuMobile() {
  const toggle = document.querySelector("#nav-toggle");
  const links = document.querySelector("#nav-links");
  if (!toggle || !links) return;
  toggle.addEventListener("click", () => links.classList.toggle("aberto"));
  links.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => links.classList.remove("aberto")));
})();

// ---------- navbar recolhe ao rolar ----------
(function navbarRolagem() {
  const nav = document.querySelector(".navbar");
  if (!nav) return;
  const checar = () => nav.classList.toggle("rolando", window.scrollY > 40);
  window.addEventListener("scroll", checar, { passive: true });
  checar();
})();

// ---------- carrossel de banners (topo) — vem do banco, com os 5 originais de reserva ----------
let bannerTimer = null;
const bannerState = { slides: [], dots: [], i: 0 };
function irParaBanner(n) {
  const { slides, dots } = bannerState;
  bannerState.i = (n + slides.length) % slides.length;
  slides.forEach((s, x) => s.classList.toggle("ativa", x === bannerState.i));
  dots.forEach((d, x) => d.classList.toggle("ativa", x === bannerState.i));
}
function iniciarCarrossel() {
  bannerState.slides = [...document.querySelectorAll(".banner-slide")];
  bannerState.dots = [...document.querySelectorAll(".banner-dot")];
  bannerState.i = 0;
  if (bannerTimer) { clearInterval(bannerTimer); bannerTimer = null; }
  if (bannerState.slides.length < 2) return;
  bannerState.dots.forEach((d, n) => d.addEventListener("click", () => irParaBanner(n)));
  bannerTimer = setInterval(() => irParaBanner(bannerState.i + 1), 5000); // troca sozinho a cada 5s
}
document.querySelector("#banner-ant")?.addEventListener("click", () => irParaBanner(bannerState.i - 1));
document.querySelector("#banner-prox")?.addEventListener("click", () => irParaBanner(bannerState.i + 1));
async function carregarBannersTopo() {
  const { data, error } = await dbPublico.from("banners")
    .select("url, legenda").eq("ativo", true).order("ordem").limit(10);
  const wrap = document.querySelector(".banner-slides");
  const dotsWrap = document.querySelector(".banner-dots");
  if (!wrap || error || !data || !data.length) { iniciarCarrossel(); return; } // sem banco: mantém os 5 originais
  wrap.innerHTML = data.map((b, x) =>
    `<img class="banner-slide${x === 0 ? " ativa" : ""}" src="${escapar(b.url)}" alt="${escapar(b.legenda || "Promoção")}"${x === 0 ? "" : ' loading="lazy"'} />`
  ).join("");
  if (dotsWrap)
    dotsWrap.innerHTML = data.map((_, x) =>
      `<span class="banner-dot${x === 0 ? " ativa" : ""}" data-b="${x}"></span>`
    ).join("");
  iniciarCarrossel();
}
carregarBannersTopo();

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
