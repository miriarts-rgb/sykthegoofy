-- ============================================================
-- Banco do site da Syk — rode isto uma vez no Supabase
-- (menu SQL Editor → New query → cole tudo → Run)
--
-- Três tabelas:
--   site_content  o conteúdo do site (preços, galeria, YCH, textos).
--                 Qualquer visitante LÊ; só quem tem login ESCREVE.
--   orders        pedidos vindos do formulário.
--                 Qualquer visitante CRIA; só quem tem login LÊ.
--   commissions   o ateliê (clientes, valores, prazos, pagamento).
--                 Só quem tem login vê ou mexe. Ninguém mais.
--
-- A trava é a RLS (Row Level Security) do Postgres, aplicada no
-- servidor. Não adianta mexer no código do site no navegador: quem
-- não está logado não consegue ler pedido nem comissão.
-- ============================================================

-- ---------- conteúdo do site ----------
create table if not exists public.site_content (
  id         smallint primary key default 1,
  data       jsonb    not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint site_content_single_row check (id = 1)
);

-- ---------- pedidos ----------
create table if not exists public.orders (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status     text not null default 'novo'
             check (status in ('novo','aceito','recusado')),
  who        text not null,
  contact    text,
  type       text,
  finish     text,
  chars      int  default 1,
  bg         text,
  rating     text,
  cur        text,
  estimate   numeric,
  deadline   date,
  refs       text,
  descricao  text,
  message    text
);

-- ---------- ateliê ----------
create table if not exists public.commissions (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  who        text,
  type       text,
  stage      text not null default 'wait'
             check (stage in ('wait','sketch','color','done')),
  paid       text not null default 'no'
             check (paid in ('no','half','full')),
  value      numeric,
  deadline   date,
  position   int default 0
);

-- ============================================================
-- Regras de acesso
-- ============================================================
alter table public.site_content enable row level security;
alter table public.orders       enable row level security;
alter table public.commissions  enable row level security;

-- site_content: todo mundo lê, só logado escreve
drop policy if exists "conteudo visivel para todos" on public.site_content;
create policy "conteudo visivel para todos"
  on public.site_content for select
  to anon, authenticated
  using (true);

drop policy if exists "só logado altera o conteudo" on public.site_content;
create policy "só logado altera o conteudo"
  on public.site_content for all
  to authenticated
  using (true) with check (true);

-- orders: visitante só CRIA (não lê nem altera). Logado vê tudo.
drop policy if exists "visitante pode enviar pedido" on public.orders;
create policy "visitante pode enviar pedido"
  on public.orders for insert
  to anon, authenticated
  with check (status = 'novo');

drop policy if exists "só logado lê e gerencia pedidos" on public.orders;
create policy "só logado lê e gerencia pedidos"
  on public.orders for select
  to authenticated using (true);

drop policy if exists "só logado atualiza pedidos" on public.orders;
create policy "só logado atualiza pedidos"
  on public.orders for update
  to authenticated using (true) with check (true);

drop policy if exists "só logado apaga pedidos" on public.orders;
create policy "só logado apaga pedidos"
  on public.orders for delete
  to authenticated using (true);

-- commissions: fechado. Só quem tem login.
drop policy if exists "ateliê só para logados" on public.commissions;
create policy "ateliê só para logados"
  on public.commissions for all
  to authenticated
  using (true) with check (true);

-- ============================================================
-- Fila pública: o site mostra a fila SEM expor cliente, valor ou
-- prazo. Em vez de uma view que fura a trava, o visitante recebe
-- permissão para ler APENAS duas colunas, e só das comissões em
-- andamento. Pedir qualquer outra coluna é recusado pelo banco.
-- ============================================================
revoke all on public.commissions from anon;
grant select (type, stage, created_at) on public.commissions to anon;

drop policy if exists "fila publica sem dados de cliente" on public.commissions;
create policy "fila publica sem dados de cliente"
  on public.commissions for select
  to anon
  using (stage <> 'done');

-- linha inicial do conteúdo (vazia; o painel preenche na primeira publicação)
insert into public.site_content (id, data)
values (1, '{}'::jsonb)
on conflict (id) do nothing;
