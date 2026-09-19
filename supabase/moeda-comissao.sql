-- ============================================================
-- Moeda por comissão
--
-- O ateliê tratava todo valor como real. Com cliente de fora, uma
-- comissão em dólar entrava como se fosse R$ e bagunçava os totais.
--
-- Esta coluna fica FORA do que o visitante pode ler: a permissão dele
-- continua sendo só (type, stage, created_at). Valor e moeda seguem
-- visíveis apenas para quem tem login.
--
-- Rode no SQL Editor do Supabase.
-- ============================================================

alter table public.commissions
  add column if not exists cur text not null default 'BRL'
  check (cur in ('BRL','USD'));

-- confirma que o visitante continua sem acesso ao valor e à moeda
revoke all on public.commissions from anon;
grant select (type, stage, created_at) on public.commissions to anon;

-- ============================================================
-- Para conferir, rode uma de cada vez. A primeira deve funcionar;
-- a segunda deve dar ERRO de permissão — é essa recusa que prova
-- que a moeda e o valor não saem do banco para quem visita.
--
--   set role anon; select type, stage from public.commissions;
--   set role anon; select cur, value from public.commissions;
--
-- Depois: reset role;
-- ============================================================
