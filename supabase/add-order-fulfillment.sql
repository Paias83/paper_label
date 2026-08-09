-- Controle de produção e cumprimento de pedido.
-- Rode isto no SQL Editor do Supabase.

-- =========================================================
-- 1) Produção de produto pronto: dar entrada em produto
-- consome a matéria-prima da ficha técnica (product_materials).
-- products.stock nunca é editado direto — só via produção
-- (mesma filosofia de stock_movements pra matéria-prima).
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
  -- valida se há matéria-prima suficiente pra cada item da ficha técnica
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

  -- dá baixa na matéria-prima consumida via stock_movements — fonte da
  -- verdade do estoque de matéria-prima, já existe o trigger que aplica.
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

-- =========================================================
-- 2) Cumprimento de pedido: quando um pedido é pago, cada item
-- é atendido por estoque pronto; o que faltar é "empenhado" na
-- matéria-prima (se houver o suficiente) ou vira necessidade de
-- compra (se não houver).
-- =========================================================
alter table order_items add column if not exists quantity_from_stock integer not null default 0;
alter table order_items add column if not exists fulfillment_status text;

-- Empenho: registra que X unidades de um item do pedido dependem
-- de matéria-prima reservada (sem mexer no número de estoque —
-- só sinaliza, a baixa de verdade acontece quando o produto for
-- produzido de fato, via product_production).
create table order_item_reservations (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references order_items(id) on delete cascade,
  status text not null check (status in ('empenhado', 'aguardando_compra')),
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);

create index order_item_reservations_order_item_id_idx on order_item_reservations(order_item_id);

-- Necessidade de compra: lista agregada por matéria-prima do que falta
-- comprar. Uma linha "pendente" por material — vai acumulando quantidade
-- conforme novos pedidos esbarram na mesma falta.
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

-- Função principal: roda quando um pedido é confirmado como pago.
-- security definer pra poder mexer em products/stock_movements/etc
-- mesmo chamada a partir da service role da Edge Function.
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
    -- 1) atende o quanto der com estoque pronto do produto
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
      -- 2) confere se a matéria-prima da ficha técnica cobre o restante
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

          -- acumula na necessidade de compra pendente desse material
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
