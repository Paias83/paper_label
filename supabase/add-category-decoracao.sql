-- Adiciona a categoria "Decoração" ao catálogo da loja.
-- Rode isto no SQL Editor do Supabase.

insert into categories (name, slug) values ('Decoração', 'decoracao')
on conflict (slug) do nothing;
