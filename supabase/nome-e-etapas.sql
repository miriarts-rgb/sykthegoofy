-- ============================================================
-- Nome público da comissão + etapas novas
--
-- 1) A fila mostrava "Comissão 01", "Comissão 02". Agora cada comissão
--    pode ter um nome escolhido por você.
--
--    ATENÇÃO: este campo é o ÚNICO do ateliê que o visitante enxerga.
--    É de propósito — é você quem escreve o que aparece. Justamente por
--    isso, não coloque aqui o @ nem o nome real do cliente: o que entrar
--    nesta coluna vai para a página, para qualquer um ler.
--
-- 2) Etapas novas: lineart, cor chapada e render, entre o sketch e a
--    entrega.
--
-- Rode no SQL Editor do Supabase.
-- ============================================================

alter table public.commissions
  add column if not exists label text;

-- a regra antiga só aceitava wait/sketch/color/done
alter table public.commissions
  drop constraint if exists commissions_stage_check;
alter table public.commissions
  add constraint commissions_stage_check
  check (stage in ('wait','sketch','line','flat','color','render','done'));

-- o visitante passa a ler o nome também; valor, moeda, cliente e prazo
-- continuam fora da lista
revoke all on public.commissions from anon;
grant select (label, type, stage, created_at) on public.commissions to anon;

-- ============================================================
-- Conferência: a primeira deve funcionar, a segunda deve dar ERRO
-- de permissão.
--
--   set role anon; select label, type, stage from public.commissions;
--   set role anon; select who, value, cur from public.commissions;
--
-- Depois: reset role;
-- ============================================================
