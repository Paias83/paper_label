  -- Políticas de upload/remoção de fotos de produto (storage.objects)
  -- Rode isto no SQL Editor do Supabase.

  create policy "admin envia fotos de produto" on storage.objects
    for insert to authenticated
    with check (
      bucket_id = 'product-images'
      and exists (select 1 from profiles where id = auth.uid() and role = 'admin')
    );

  create policy "admin remove fotos de produto" on storage.objects
    for delete to authenticated
    using (
      bucket_id = 'product-images'
      and exists (select 1 from profiles where id = auth.uid() and role = 'admin')
    );
