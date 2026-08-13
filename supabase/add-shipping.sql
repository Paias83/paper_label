-- Frete real (Melhor Envio) + endereço de entrega no checkout.
-- Rode isto no SQL Editor do Supabase.

-- Peso/dimensões por produto — necessário pra cotar frete pela API do
-- Melhor Envio. Default = pacote pequeno genérico (mínimo aceito pelos
-- Correios), pra cotação nunca quebrar em produto sem dado preenchido
-- ainda; o admin deve ajustar cada produto com o peso/dimensão real.
alter table products
  add column if not exists weight_kg numeric(10,3) not null default 0.3,
  add column if not exists width_cm numeric(6,2) not null default 16,
  add column if not exists height_cm numeric(6,2) not null default 4,
  add column if not exists length_cm numeric(6,2) not null default 16;

-- Endereço/frete/rastreio do pedido. shipping_address guarda o endereço
-- "congelado" no momento da compra (não referencia profiles.addresses,
-- que pode mudar depois). shipping_cost é o frete isolado; orders.total
-- continua sendo o valor total cobrado (itens + frete).
alter table orders
  add column if not exists shipping_cep text,
  add column if not exists shipping_address jsonb,
  add column if not exists shipping_cost numeric(10,2) not null default 0,
  add column if not exists shipping_service text,
  add column if not exists tracking_code text;
