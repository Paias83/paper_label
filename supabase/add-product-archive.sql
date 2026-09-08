-- Permite tirar produtos da lista do admin.
-- Rode isto no SQL Editor do Supabase.
--
-- Dois caminhos, decididos pelo próprio app:
--   1. Produto sem nenhum pedido nem produção  -> exclusão de verdade (DELETE).
--      O product_materials some junto (on delete cascade).
--   2. Produto que já apareceu em pedido/produção -> não pode sumir sem
--      quebrar o histórico, então vira "arquivado": some da lista e da loja,
--      mas continua no banco pros pedidos antigos.

alter table products
  add column if not exists archived boolean not null default false;

-- Índice parcial: as listas quase sempre pedem "não arquivados".
create index if not exists products_not_archived_idx
  on products (created_at desc)
  where archived = false;
