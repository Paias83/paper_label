-- Permite marcar uma categoria como "somente interna" (não aparece na loja),
-- mantendo-a disponível para uso no admin (produtos, ficha técnica, pedidos manuais).
-- Rode isto no SQL Editor do Supabase.

alter table categories add column if not exists active boolean not null default true;
