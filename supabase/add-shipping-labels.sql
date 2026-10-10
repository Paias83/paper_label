-- Etiquetas de envio pelo Melhor Envio (Edge Function shipping-label).
-- Idempotente: pode rodar mais de uma vez.
--
--   npx supabase db query --linked -f supabase/add-shipping-labels.sql

-- Id do serviço do Melhor Envio escolhido pelo cliente no carrinho (1 = PAC, 2 = SEDEX...).
-- Nulo em pedidos antigos, manuais e de orçamento — o admin escolhe na hora da etiqueta.
alter table public.orders add column if not exists shipping_service_id integer;

-- Etiqueta comprada: id da etiqueta no Melhor Envio, quanto custou e quando.
-- Voltam a nulo se a etiqueta for cancelada.
alter table public.orders add column if not exists label_me_id text;
alter table public.orders add column if not exists label_cost numeric(10, 2);
alter table public.orders add column if not exists label_created_at timestamptz;
