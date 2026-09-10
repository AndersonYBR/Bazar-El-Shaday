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

async function carregarCatalogo() {
  // Enquanto não está carregando, não apaga a lista que já está na tela
  if (!listaCatalogo.dataset.preenchido)
    mensagem.textContent = "Carregando produtos...";

  const { data: produtos, error } = await dbPublico
    .from("produtos")
    .select("id, nome, quantidade, preco, foto_url, tamanhos, created_at")
    .gt("quantidade", 0)
    .order("created_at", { ascending: false }); // mais recentes primeiro

  if (error) {
    console.error("Erro ao carregar catálogo:", error);
    mensagem.textContent = "Não foi possível carregar os produtos.";
    return;
  }

  mensagem.textContent = "Atualizado às " +
    new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  listaCatalogo.dataset.preenchido = "1";

  if (!produtos || produtos.length === 0) {
    listaCatalogo.innerHTML =
      '<p class="empty">Nenhum produto disponível no momento.</p>';
    return;
  }

  listaCatalogo.innerHTML = produtos.map((produto) => `
    <article class="card-produto">
      <div class="imagem-produto">
        ${produto.foto_url
          ? `<img src="${escapar(produto.foto_url)}" alt="${escapar(produto.nome)}"
               onerror="this.outerHTML='🛍️'" />`
          : "🛍️"}
      </div>
      <h2>${escapar(produto.nome)}</h2>
      ${produto.tamanhos
        ? `<p class="tamanhos">${escapar(produto.tamanhos)}</p>`
        : ""}
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

// Atualiza sozinho a cada 30s — o que a dona cadastra no app
// (com quantidade > 0) aparece aqui sem precisar recarregar a página.
carregarCatalogo();
setInterval(carregarCatalogo, 30000);

// Botão "Atualizar agora" (acrescentado no catalogo.html)
const btnAtualizar = document.querySelector("#btn-atualizar");
if (btnAtualizar)
  btnAtualizar.addEventListener("click", () => {
    mensagem.textContent = "Atualizando...";
    carregarCatalogo();
  });
