-- =========================================================
-- Schema inicial — Papelaria de Luxo
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
