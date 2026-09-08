-- Campo de observação no pedido manual — vários pedidos para o mesmo
-- cliente, o admin precisa anotar o que é cada um.
-- Rode isto no SQL Editor do Supabase.

alter table orders add column if not exists notes text;
