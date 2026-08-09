-- Ficha técnica do produto: lista as matérias-primas usadas para fabricá-lo,
-- suas quantidades, e permite calcular o preço de custo do produto.
-- Rode isto no SQL Editor do Supabase.

alter table products add column if not exists cost_price numeric(10,2) not null default 0;

create table if not exists product_materials (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  material_id uuid not null references raw_materials(id) on delete restrict,
  quantity numeric(12,3) not null check (quantity > 0),
  created_at timestamptz not null default now()
);

create index if not exists product_materials_product_id_idx on product_materials(product_id);

alter table product_materials enable row level security;

create policy "admin gerencia composicao de produtos" on product_materials
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
