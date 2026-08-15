-- Políticas de upload de imagens na conversa de orçamento (storage.objects).
-- Antes de rodar isto, crie o bucket "quote-attachments" pelo painel do
-- Supabase (Storage > New bucket), marcado como público — mesmo processo
-- já usado pro bucket "product-images".
-- Rode isto no SQL Editor do Supabase.

-- Diferente de product-images (admin-only), aqui cliente e admin
-- precisam poder subir imagem na própria conversa.
create policy "participante envia anexo de orcamento" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'quote-attachments');
