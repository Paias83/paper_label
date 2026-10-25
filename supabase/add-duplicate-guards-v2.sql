-- Travas de duplicidade mais rígidas para matéria-prima e fornecedor.
-- Complementa add-duplicate-guards.sql (idempotente; pode rodar de novo).
--
-- norm_text: minúsculas, sem acento e com espaços repetidos colapsados, para
-- "Papel  Fotográfico" e "papel fotografico" contarem como o mesmo nome.
-- (translate em vez da extensão unaccent porque o índice exige função IMMUTABLE.)
-- A mesma regra existe no front em src/lib/duplicates.ts (normText).
--
-- Regras:
--   matéria-prima -> mesmo nome + mesma cor + mesma marca (normalizados)
--   fornecedor    -> mesmo nome (normalizado) OU mesmo CNPJ/CPF (só dígitos)
--
-- Se um CREATE INDEX falhar com "could not create unique index", já existem
-- duplicados. Encontre-os com:
--   select public.norm_text(name), count(*) from suppliers group by 1 having count(*) > 1;
--   select regexp_replace(document, '\D', '', 'g'), count(*) from suppliers
--     where coalesce(document, '') <> '' group by 1 having count(*) > 1;
--   select public.norm_text(name), public.norm_text(color), public.norm_text(brand), count(*)
--     from raw_materials group by 1, 2, 3 having count(*) > 1;

create or replace function public.norm_text(t text)
returns text
language sql
immutable
parallel safe
as $$
  select lower(regexp_replace(
    translate(
      btrim(coalesce(t, '')),
      'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
      'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
    ),
    '\s+', ' ', 'g'
  ))
$$;

-- Matéria-prima: troca o índice antigo (só lower/btrim) pelo normalizado.
drop index if exists raw_materials_name_color_brand_uniq;
create unique index if not exists raw_materials_norm_name_color_brand_uniq
  on raw_materials (public.norm_text(name), public.norm_text(color), public.norm_text(brand));

-- Fornecedor: nome normalizado único.
create unique index if not exists suppliers_norm_name_uniq
  on suppliers (public.norm_text(name));

-- Fornecedor: CNPJ/CPF único (comparando só os dígitos; vazio não conta).
update suppliers set document = null where btrim(document) = '';
create unique index if not exists suppliers_document_uniq
  on suppliers (regexp_replace(document, '\D', '', 'g'))
  where document is not null;
