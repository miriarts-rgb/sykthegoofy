-- ============================================================
-- Pedido só entra com a fila aberta
--
-- Desligar o botão no site impede o visitante comum, mas quem abrir o
-- console do navegador ainda conseguia gravar um pedido. Esta regra
-- move a decisão para o banco: com as comissões fechadas, ou com todas
-- as vagas ocupadas, o insert é recusado — venha de onde vier.
--
-- A função lê o mesmo conteúdo que o site lê, então basta você mexer em
-- "vagas" no painel: não precisa rodar SQL de novo para abrir ou fechar.
--
-- Rode no SQL Editor do Supabase.
-- ============================================================

-- Sem security definer de propósito: roda com os direitos de quem
-- chamou, e o visitante já pode ler o conteúdo do site e contar a fila.
create or replace function public.fila_aberta()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce((sc.data->>'open')::boolean, false)
         and (select count(*) from public.commissions where stage <> 'done')
             < coalesce((sc.data->>'slotsTotal')::int, 0)
  from public.site_content sc
  where sc.id = 1
$$;

grant execute on function public.fila_aberta() to anon, authenticated;

-- O visitante passa pela regra da fila. Você, logada, continua podendo
-- lançar um pedido à mão mesmo com tudo fechado.
drop policy if exists "visitante pode enviar pedido" on public.orders;

create policy "visitante só envia com a fila aberta"
  on public.orders for insert
  to anon
  with check (status = 'novo' and public.fila_aberta());

create policy "logada envia pedido a qualquer hora"
  on public.orders for insert
  to authenticated
  with check (status = 'novo');

-- ============================================================
-- Conferir:
--   select public.fila_aberta();
--
-- true  = site aceitando pedidos
-- false = fechado ou lotado, e o insert do visitante é recusado
-- ============================================================
