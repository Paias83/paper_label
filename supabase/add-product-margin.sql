-- Preço do produto calculado por margem sobre o custo.
-- Rode isto no SQL Editor do Supabase.
--
-- margin_percent NULL  -> preço é digitado à mão (comportamento antigo).
-- margin_percent = 60   -> preço = cost_price * 1.60, recalculado quando
--                          a ficha técnica muda. O valor final continua
--                          gravado em products.price normalmente.

alter table products
  add column if not exists margin_percent numeric(6,2);
