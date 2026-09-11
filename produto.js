// =====================================================
// BAZAR DA VAL — produto.js (página de detalhes)
// Lê o produto pelo link: produto.html?produto=<id>
// =====================================================
const SUPABASE_URL = "https://mwggbbfidojucvmlywxd.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_saYnOUna58kgHNNHfKZgOg_hdhs_gm9";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const MAX_FOTOS = 4;

function escapar(texto) {
  return String(texto ?? "").replace(/[&<>\"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function formatarPreco(valor) {
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fotosDe(produto) {
  const f = Array.isArray(produto.fotos) && produto.fotos.length
    ? produto.fotos
    : produto.foto_url ? [produto.foto_url] : [];
  return f.slice(0, MAX_FOTOS);
}

// ---------- menu mobile ----------
(function menuMobile() {
  const toggle = document.querySelector("#nav-toggle");
  const links = document.querySelector("#nav-links");
  if (!toggle || !links) return;
  toggle.addEventListener("click", () => links.classList.toggle("aberto"));
  links.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => links.classList.remove("aberto")));
})();

// ---------- carrossel ----------
let carrossel = null;
function iniciarCarrossel() {
  const el = document.querySelector(".carousel");
  if (!el) return;
  const imgs = [...el.querySelectorAll(".slide")];
  const dots = [...el.querySelectorAll(".dot")];
  if (imgs.length < 2) return;
  carrossel = { imgs, dots, i: 0 };
  dots.forEach((d, n) => d.addEventListener("click", () => irPara(n)));
  setInterval(() => irPara(carrossel.i + 1), 3500);
}
function irPara(n) {
  carrossel.i = (n + carrossel.imgs.length) % carrossel.imgs.length;
  carrossel.imgs.forEach((img, x) => img.classList.toggle("ativa", x === carrossel.i));
  carrossel.dots.forEach((d, x) => d.classList.toggle("ativa", x === carrossel.i));
}

// ---------- carregar o produto ----------
async function carregar() {
  const id = new URLSearchParams(location.search).get("produto");
  const box = document.querySelector("#produto-container");
  if (!id) {
    box.innerHTML = '<p class="empty">Produto não informado.</p>';
    return;
  }
  const { data, error } = await db.from("produtos").select("*").eq("id", id).maybeSingle();
  if (error || !data) {
    box.innerHTML = '<p class="empty">Produto não encontrado. Ele pode ter sido removido.</p>';
    return;
  }
  if ((data.quantidade || 0) < 1) {
    box.innerHTML = '<p class="empty">Este produto está momentaneamente fora de estoque.<br>Chame no WhatsApp para saber quando volta 😉</p>';
    return;
  }

  document.title = data.nome + " — Bazar da Val";
  const fotos = fotosDe(data);

  const fotosHtml = fotos.length
    ? `<div class="carousel">
        ${fotos.map((f, i) =>
          `<img class="slide ${i === 0 ? "ativa" : ""}" src="${escapar(f)}"
            alt="${escapar(data.nome)}" ${i > 0 ? 'loading="lazy"' : ""}
            onerror="this.remove()" />`).join("")}
        ${fotos.length > 1
          ? `<div class="dots">${fotos.map((_, i) =>
              `<span class="dot ${i === 0 ? "ativa" : ""}" data-dot="${i}"></span>`).join("")}</div>`
          : ""}
      </div>`
    : '<div class="imagem-produto imagem-grande">🛍️</div>';

  const attrs = [
    data.cor ? `<p class="detalhe">🎨 Cor: <strong>${escapar(data.cor)}</strong></p>` : "",
    data.tamanhos ? `<p class="detalhe">📏 Tamanhos: <strong>${escapar(data.tamanhos)}</strong></p>` : "",
    data.numeros ? `<p class="detalhe">👟 Números: <strong>${escapar(data.numeros)}</strong></p>` : "",
  ].join("");

  box.innerHTML = `
    <div class="produto-grid">
      <div class="produto-fotos">${fotosHtml}</div>
      <div class="produto-info">
        <div class="badge-linha">
          ${data.categoria ? `<span class="badge-cat">${escapar(data.categoria)}</span>` : ""}
          ${data.genero ? `<span class="badge-gen">${escapar(data.genero)}</span>` : ""}
        </div>
        <h1>${escapar(data.nome)}</h1>
        <p class="preco-grande">${formatarPreco(data.preco)}</p>
        <p class="disponibilidade">✔ ${data.quantidade} unidade(s) disponível(is)</p>
        ${attrs}
        ${data.descricao
          ? `<div class="descricao-box">
               <h3>Descrição</h3>
               <p>${escapar(data.descricao)}</p>
             </div>`
          : ""}
        <a class="btn btn-grande" target="_blank" rel="noopener"
           href="https://wa.me/553188866910?text=${encodeURIComponent(`Olá! Tenho interesse no produto: ${data.nome}`)}">
          Tenho interesse
        </a>
        <p class="contato">📱 (31) 8886-6910 · Nova Pampulha, Vespasiano/MG</p>
      </div>
    </div>`;
  iniciarCarrossel();
}

carregar();
