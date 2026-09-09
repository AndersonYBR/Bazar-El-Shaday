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

function escapar(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, (caractere) => ({
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

async function carregarCatalogo() {
  mensagem.textContent = "Carregando produtos...";

  const { data: produtos, error } = await dbPublico
    .from("produtos")
    .select("id, nome, quantidade, preco")
    .gt("quantidade", 0)
    .order("id", { ascending: false });

  if (error) {
    console.error("Erro ao carregar catálogo:", error);
    mensagem.textContent = "Não foi possível carregar os produtos.";
    return;
  }

  mensagem.textContent = "";

  if (!produtos || produtos.length === 0) {
    listaCatalogo.innerHTML =
      '<p class="empty">Nenhum produto disponível no momento.</p>';
    return;
  }

  listaCatalogo.innerHTML = produtos.map((produto) => `
    <article class="card-produto">
      <div class="imagem-produto">🛍️</div>
      <h2>${escapar(produto.nome)}</h2>
      <p class="preco">${formatarPreco(produto.preco)}</p>
      <p class="disponibilidade">
        ${produto.quantidade} unidade(s) disponível(is)
      </p>
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
  `).join("");
}

carregarCatalogo();
