-- ============================================
-- BAZAR EL SHADAY — Schema do banco (Supabase)
-- Cole tudo aqui: Supabase > SQL Editor > Run
-- ============================================

create table produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  quantidade int not null default 0,
  preco numeric(10,2) not null default 0,
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
