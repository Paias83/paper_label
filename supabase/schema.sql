-- =========================================================
-- Schema inicial — Studio Paper
-- Rode isso no SQL Editor do painel do Supabase.
-- =========================================================

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique
);

create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(10,2) not null default 0,
  cost_price numeric(10,2) not null default 0, -- soma da ficha técnica (product_materials)
  category_id uuid references categories(id),
  stock integer not null default 0,
  images text[] not null default '{}',
  active boolean not null default true,
  featured boolean not null default false,
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  phone text,
  role text not null default 'cliente', -- 'cliente' | 'admin'
  addresses jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  status text not null default 'pendente',
  total numeric(10,2) not null,
  mp_payment_id text,
  created_at timestamptz not null default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  product_id uuid references products(id),
  quantity integer not null,
  price_at_purchase numeric(10,2) not null
);

-- =========================================================
-- Storage bucket para fotos de produto
-- Crie manualmente em Storage > New bucket > "product-images" (público)
-- ou rode:
-- =========================================================
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- O bucket público libera a LEITURA das fotos sem autenticação, mas
-- o storage.objects continua com RLS — sem estas políticas, nem o
-- admin consegue enviar (insert) ou remover (delete) arquivos.
create policy "admin envia fotos de produto" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "admin remove fotos de produto" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'product-images'
    and exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- =========================================================
-- Row Level Security
-- =========================================================
alter table products enable row level security;
alter table categories enable row level security;
alter table profiles enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;

-- Qualquer visitante pode ver produtos ativos e categorias
create policy "produtos ativos sao publicos" on products
  for select using (active = true);

create policy "categorias sao publicas" on categories
  for select using (true);

-- Só admin pode inserir/editar/apagar produtos
create policy "admin gerencia produtos" on products
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Só admin pode inserir/editar/apagar categorias
create policy "admin gerencia categorias" on categories
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Cada pessoa vê e edita só o próprio perfil
create policy "usuario ve proprio perfil" on profiles
  for select using (auth.uid() = id);
create policy "usuario edita proprio perfil" on profiles
  for update using (auth.uid() = id);

-- Cada pessoa vê só os próprios pedidos; admin vê todos
create policy "usuario ve proprios pedidos" on orders
  for select using (
    auth.uid() = user_id
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
create policy "admin atualiza pedidos" on orders
  for update using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "usuario ve itens dos proprios pedidos" on order_items
  for select using (
    exists (
      select 1 from orders
      where orders.id = order_items.order_id
      and (orders.user_id = auth.uid() or exists (
        select 1 from profiles where id = auth.uid() and role = 'admin'
      ))
    )
  );

-- =========================================================
-- Trigger: cria automaticamente a linha em profiles
-- quando alguém se cadastra (role padrão = 'cliente').
-- Promover a admin continua sendo manual, via SQL:
--   update profiles set role = 'admin' where id = '<uuid>';
-- =========================================================
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, role)
  values (new.id, new.raw_user_meta_data->>'name', 'cliente');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================
-- Seed opcional de categorias iniciais
-- =========================================================
insert into categories (name, slug) values
  ('Cadernos', 'cadernos'),
  ('Papelaria de convite', 'convites'),
  ('Canetas e acessórios', 'canetas'),
  ('Envelopes e lacres', 'envelopes');

-- =========================================================
-- Módulo de estoque de matéria-prima (mini-ERP interno)
-- Não tem relação com o estoque de produto — controla os
-- insumos usados na produção, com fornecedor e histórico.
-- =========================================================
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
  color text,
  brand text,
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

-- Ficha técnica do produto: matérias-primas usadas e suas quantidades.
-- products.cost_price é a soma de quantity * raw_materials.cost_price,
-- recalculada e salva pelo admin sempre que a ficha muda.
create table product_materials (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  material_id uuid not null references raw_materials(id) on delete restrict,
  quantity numeric(12,3) not null check (quantity > 0),
  created_at timestamptz not null default now()
);

create index product_materials_product_id_idx on product_materials(product_id);

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
alter table product_materials enable row level security;

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

create policy "admin gerencia composicao de produtos" on product_materials
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- =========================================================
-- Produção de produto pronto e cumprimento de pedido
-- Ver supabase/add-order-fulfillment.sql para os comentários
-- completos de cada peça.
-- =========================================================
create table product_production (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index product_production_product_id_idx on product_production(product_id);

create function public.apply_product_production()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  missing text := '';
begin
  for rec in
    select rm.name, (pm.quantity * new.quantity) as required, rm.stock
    from product_materials pm
    join raw_materials rm on rm.id = pm.material_id
    where pm.product_id = new.product_id
  loop
    if rec.stock < rec.required then
      missing := missing || rec.name || ' (falta ' || (rec.required - rec.stock) || '); ';
    end if;
  end loop;

  if missing <> '' then
    raise exception 'Matéria-prima insuficiente para produzir: %', missing;
  end if;

  insert into stock_movements (material_id, type, quantity, note, created_by)
  select pm.material_id, 'saida', pm.quantity * new.quantity,
         'Consumo de produção de produto', new.created_by
  from product_materials pm
  where pm.product_id = new.product_id;

  update products set stock = stock + new.quantity where id = new.product_id;

  return new;
end;
$$;

create trigger on_product_production_insert
  after insert on product_production
  for each row execute function public.apply_product_production();

alter table product_production enable row level security;

create policy "admin gerencia producao" on product_production
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

alter table order_items add column if not exists quantity_from_stock integer not null default 0;
alter table order_items add column if not exists fulfillment_status text;

create table order_item_reservations (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references order_items(id) on delete cascade,
  status text not null check (status in ('empenhado', 'aguardando_compra')),
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);

create index order_item_reservations_order_item_id_idx on order_item_reservations(order_item_id);

create table purchase_needs (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references raw_materials(id) on delete cascade,
  quantity numeric(12,3) not null check (quantity > 0),
  status text not null default 'pendente' check (status in ('pendente', 'resolvido')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index purchase_needs_material_status_idx on purchase_needs(material_id, status);

alter table order_item_reservations enable row level security;
alter table purchase_needs enable row level security;

create policy "admin ve empenhos" on order_item_reservations
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "admin gerencia necessidades de compra" on purchase_needs
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create function public.fulfill_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item record;
  taken integer;
  shortfall integer;
  material record;
  insufficient boolean;
  needed numeric(12,3);
begin
  for item in select * from order_items where order_id = p_order_id loop
    select least(stock, item.quantity) into taken from products where id = item.product_id;
    taken := coalesce(taken, 0);

    if taken > 0 then
      update products set stock = stock - taken where id = item.product_id;
    end if;

    shortfall := item.quantity - taken;

    update order_items
    set quantity_from_stock = taken,
        fulfillment_status = case when shortfall = 0 then 'estoque_pronto' else null end
    where id = item.id;

    if shortfall > 0 then
      insufficient := false;
      for material in
        select rm.id, rm.name, rm.stock, (pm.quantity * shortfall) as required
        from product_materials pm
        join raw_materials rm on rm.id = pm.material_id
        where pm.product_id = item.product_id
      loop
        if material.stock < material.required then
          insufficient := true;
          needed := material.required - material.stock;

          if exists (select 1 from purchase_needs where material_id = material.id and status = 'pendente') then
            update purchase_needs
            set quantity = quantity + needed
            where material_id = material.id and status = 'pendente';
          else
            insert into purchase_needs (material_id, quantity) values (material.id, needed);
          end if;
        end if;
      end loop;

      if insufficient then
        insert into order_item_reservations (order_item_id, status, quantity)
        values (item.id, 'aguardando_compra', shortfall);
        update order_items set fulfillment_status = 'aguardando_compra' where id = item.id;
      else
        insert into order_item_reservations (order_item_id, status, quantity)
        values (item.id, 'empenhado', shortfall);
        update order_items set fulfillment_status = 'empenhado' where id = item.id;
      end if;
    end if;
  end loop;
end;
$$;

revoke all on function public.fulfill_order(uuid) from public;
grant execute on function public.fulfill_order(uuid) to service_role;
