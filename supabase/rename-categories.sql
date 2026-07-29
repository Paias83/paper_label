-- Atualiza as categorias da loja para o novo catálogo de produtos
-- (de papelaria para artigos de festa: topos de bolo/doce, kits, personalizados).
-- Rode isto no SQL Editor do Supabase.

update categories set name = 'Topo de bolo', slug = 'topo-de-bolo' where slug = 'cadernos';
update categories set name = 'Topo de doce', slug = 'topo-de-doce' where slug = 'convites';
update categories set name = 'Kit de festa', slug = 'kit-de-festa' where slug = 'canetas';
update categories set name = 'Personalizados', slug = 'personalizados' where name = 'categoria teste';

-- "Envelopes e lacres" não tem correspondente nas 4 categorias novas.
-- Solta os produtos dela (se houver) antes de remover a categoria.
update products set category_id = null where category_id = (select id from categories where slug = 'envelopes');
delete from categories where slug = 'envelopes';
