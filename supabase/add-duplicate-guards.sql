-- Evita cadastro em duplicidade de produtos e matérias-primas.
-- Rode isto no SQL Editor do Supabase.
--
-- Regras de duplicidade:
--   produto        -> mesmo nome (sem diferenciar maiúsc./espaços) + mesma categoria
--   matéria-prima  -> mesmo nome + mesma cor + mesma marca
--
-- Se a criação do índice falhar por "could not create unique index", já
-- existem duplicados. Rode os SELECTs abaixo para encontrá-los, ajuste os
-- registros e rode o CREATE INDEX de novo.

-- Duplicados de produto:
--   select lower(btrim(name)) as nome,
--          coalesce(category_id::text, 'sem-categoria') as categoria,
--          count(*)
--   from products
--   group by 1, 2
--   having count(*) > 1;

-- Duplicados de matéria-prima:
--   select lower(btrim(name)) as nome,
--          lower(btrim(coalesce(color, ''))) as cor,
--          lower(btrim(coalesce(brand, ''))) as marca,
--          count(*)
--   from raw_materials
--   group by 1, 2, 3
--   having count(*) > 1;

create unique index if not exists products_name_category_uniq
  on products (
    lower(btrim(name)),
    coalesce(category_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create unique index if not exists raw_materials_name_color_brand_uniq
  on raw_materials (
    lower(btrim(name)),
    lower(btrim(coalesce(color, ''))),
    lower(btrim(coalesce(brand, '')))
  );
