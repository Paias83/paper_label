-- Pedidos criados manualmente pelo admin (venda por telefone, presencial,
-- etc.) — precisam seguir a mesma lógica de baixa/empenho de matéria-prima
-- dos pedidos da loja, só que sem passar pelo Mercado Pago.
-- Rode isto no SQL Editor do Supabase.

alter table orders add column if not exists customer_name text;
alter table orders add column if not exists source text not null default 'loja'
  check (source in ('loja', 'manual'));
