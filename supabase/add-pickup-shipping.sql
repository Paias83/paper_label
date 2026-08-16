-- Opção "Retirada no local" no checkout, ao lado do frete real (Melhor Envio).
-- Rode isto no SQL Editor do Supabase.

-- shipping_type diferencia pedidos com entrega (endereço + frete pago) de
-- pedidos que o cliente vai buscar na loja (sem endereço, frete zero).
-- Default 'entrega' preserva o comportamento de todos os pedidos já existentes.
alter table orders
  add column if not exists shipping_type text not null default 'entrega'
    check (shipping_type in ('entrega', 'retirada'));

-- orders.status continua sem CHECK constraint (é texto livre) — pedidos de
-- retirada usam os valores 'pronto_para_retirada' e 'retirado' no lugar de
-- 'enviado'/'entregue', tratados só na camada de aplicação (admin Orders.tsx).
