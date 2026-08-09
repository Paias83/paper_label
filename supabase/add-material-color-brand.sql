-- Adiciona os campos "cor" e "marca" ao cadastro de matéria-prima.
-- Rode isto no SQL Editor do Supabase.

alter table raw_materials add column if not exists color text;
alter table raw_materials add column if not exists brand text;
