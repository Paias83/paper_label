-- Módulo de estoque de matéria-prima (mini-ERP interno)
-- Não tem relação com o estoque de produto — controla os
-- insumos usados na produção, com fornecedor e histórico.
-- Rode isto no SQL Editor do Supabase.

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  phone text,
  email text,
  document text, -- CNPJ ou CPF
  notes text,
  created_at timestamptz not null default now()
);

create table raw_materials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null default 'un', -- un, kg, g, l, ml, m, cm...
  stock numeric(12,3) not null default 0,
  min_stock numeric(12,3) not null default 0,
  cost_price numeric(10,2) not null default 0,
  supplier_id uuid references suppliers(id) on delete set null,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references raw_materials(id) on delete restrict,
  type text not null check (type in ('entrada', 'saida')),
  quantity numeric(12,3) not null check (quantity > 0),
  unit_cost numeric(10,2),
  supplier_id uuid references suppliers(id) on delete set null,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index stock_movements_material_id_idx on stock_movements(material_id);

-- A movimentação é a fonte da verdade: raw_materials.stock é sempre
-- recalculado a partir dela via trigger, nunca editado diretamente,
-- pra não desincronizar o saldo do histórico.
create function public.apply_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.type = 'entrada' then
    update raw_materials set stock = stock + new.quantity where id = new.material_id;
  else
    update raw_materials set stock = stock - new.quantity where id = new.material_id;
  end if;
  return new;
end;
$$;

create trigger on_stock_movement_insert
  after insert on stock_movements
  for each row execute function public.apply_stock_movement();

-- Módulo interno — só admin acessa (nem clientes, nem anônimos)
alter table suppliers enable row level security;
alter table raw_materials enable row level security;
alter table stock_movements enable row level security;

create policy "admin gerencia fornecedores" on suppliers
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "admin gerencia materias primas" on raw_materials
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "admin gerencia movimentacoes" on stock_movements
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
