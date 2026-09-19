-- ============================================================
-- Correção: trocar a view SECURITY DEFINER por permissão de coluna
--
-- Antes: uma view lia commissions ignorando a trava e devolvia
--        posição/tipo/etapa. Funcionava, mas fura a RLS por desenho.
-- Agora: o visitante pode ler DUAS COLUNAS da própria tabela
--        (type e stage) e só das linhas em andamento. Se tentar ler
--        o cliente, o valor ou o prazo, o Postgres recusa.
--
-- Rode no SQL Editor do Supabase, como fez com o schema.
-- ============================================================

-- 1) fora a view que disparou o alerta
drop view if exists public.public_queue;

-- 2) zera o acesso do visitante à tabela
revoke all on public.commissions from anon;

-- 3) devolve SÓ o que a fila do site precisa mostrar
grant select (type, stage, created_at) on public.commissions to anon;

-- 4) e só das comissões que ainda estão em andamento
drop policy if exists "fila publica sem dados de cliente" on public.commissions;
create policy "fila publica sem dados de cliente"
  on public.commissions for select
  to anon
  using (stage <> 'done');

-- A política do ateliê continua igual: quem tem login vê tudo.
-- (policy "ateliê só para logados", criada no schema.sql)

-- ============================================================
-- Conferindo que a trava funciona
--
-- Rode as duas linhas abaixo, uma de cada vez, para ver a diferença.
-- A primeira deve funcionar; a segunda deve dar ERRO de permissão —
-- e é exatamente esse erro que prova que o nome do cliente está
-- protegido de quem visita o site.
--
--   set role anon; select type, stage from public.commissions;
--   set role anon; select who  from public.commissions;
--
-- Depois de testar, volte ao normal com:  reset role;
-- ============================================================
