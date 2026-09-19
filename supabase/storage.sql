-- ============================================================
-- Armazenamento das artes da galeria
--
-- Cria um "balde" público chamado "galeria". Público aqui significa
-- que qualquer visitante VÊ as imagens (é uma galeria, afinal) — mas
-- só quem tem login consegue enviar, trocar ou apagar arquivo.
--
-- O banco passa a guardar só o endereço de cada arte, algumas dezenas
-- de bytes, em vez da imagem inteira em texto.
--
-- Rode no SQL Editor do Supabase, como fez com os outros.
-- ============================================================

-- 1) o balde. 8 MB por arquivo e só tipos de imagem/vídeo aceitos:
--    duas travas que impedem subir por engano algo gigante ou indevido.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'galeria', 'galeria', true, 8388608,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm']
)
on conflict (id) do update
  set public = true,
      file_size_limit = 8388608,
      allowed_mime_types = excluded.allowed_mime_types;

-- 2) quem vê: todo mundo
drop policy if exists "galeria visivel para todos" on storage.objects;
create policy "galeria visivel para todos"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'galeria');

-- 3) quem envia, troca e apaga: só com login
drop policy if exists "so logado envia arte" on storage.objects;
create policy "so logado envia arte"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'galeria');

drop policy if exists "so logado troca arte" on storage.objects;
create policy "so logado troca arte"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'galeria') with check (bucket_id = 'galeria');

drop policy if exists "so logado apaga arte" on storage.objects;
create policy "so logado apaga arte"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'galeria');

-- ============================================================
-- Conferindo
-- Depois de rodar, o balde aparece em Storage no menu lateral.
-- Um visitante deslogado consegue ABRIR o endereço de uma imagem,
-- mas qualquer tentativa de enviar arquivo é recusada.
-- ============================================================
