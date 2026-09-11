-- ============================================
-- BAZAR EL SHADAY — Schema do banco (Supabase)
-- Cole tudo aqui: Supabase > SQL Editor > Run
-- ============================================

create table produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  quantidade int not null default 0,
  preco numeric(10,2) not null default 0,
  foto_url text,            -- foto antiga (mantida p/ compatibilidade)
  fotos text[],             -- até 4 fotos (carrossel no catálogo)
  categoria text,           -- Tenis | Roupa Masculina | Roupa Feminina | Infantil | Outros
  numeros text,             -- números de calçado (ex.: "34 35 36 37")
  tamanhos text,            -- tamanhos livres (ex.: "P, M, G")
  created_at timestamptz default now()
);

create table clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text not null,
  created_at timestamptz default now()
);

create table vendas (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid references produtos(id) on delete set null,
  quantidade int not null,
  total numeric(10,2) not null,
  created_at timestamptz default now()
);

-- ================= SEGURANÇA (RLS) =================
-- RLS garante que SÓ usuário logado acessa os dados.
alter table produtos enable row level security;
alter table clientes enable row level security;
alter table vendas enable row level security;

create policy "produtos_select" on produtos for select to authenticated using (true);
-- VITRINE PÚBLICA: o catálogo (catalogo.html) lê os produtos sem login.
-- (Se já rodou o schema antes, basta executar SÓ esta linha no SQL Editor.)
create policy "produtos_publico_select" on produtos for select to anon using (true);
create policy "produtos_insert" on produtos for insert to authenticated with check (true);
create policy "produtos_update" on produtos for update to authenticated using (true);
create policy "produtos_delete" on produtos for delete to authenticated using (true);

create policy "clientes_select" on clientes for select to authenticated using (true);
create policy "clientes_insert" on clientes for insert to authenticated with check (true);
create policy "clientes_update" on clientes for update to authenticated using (true);
create policy "clientes_delete" on clientes for delete to authenticated using (true);

create policy "vendas_select" on vendas for select to authenticated using (true);
create policy "vendas_insert" on vendas for insert to authenticated with check (true);
create policy "vendas_update" on vendas for update to authenticated using (true);
create policy "vendas_delete" on vendas for delete to authenticated using (true);

-- ================= PERMISSÕES DE TABELA (GRANTs) =================
-- Necessárias no novo sistema de chaves do Supabase.
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public
  to authenticated, service_role;
grant select on all tables in schema public to anon;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges in schema public
  grant select on tables to anon;

-- ================= STORAGE (bucket público de fotos) =================
insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', true)
on conflict (id) do update set public = true;

create policy "fotos_leitura" on storage.objects
  for select using (bucket_id = 'fotos');
create policy "fotos_envio" on storage.objects
  for insert to authenticated with check (bucket_id = 'fotos');
create policy "fotos_apagamento" on storage.objects
  for delete to authenticated using (bucket_id = 'fotos');
