-- Política de escrita para categorias (só existia leitura pública).
-- Sem isso, o admin não consegue criar/editar/apagar categorias.
-- Rode isto no SQL Editor do Supabase.

create policy "admin gerencia categorias" on categories
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
