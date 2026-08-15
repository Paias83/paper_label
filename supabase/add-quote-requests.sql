-- Área de Orçamentos (Personalizados) — pedidos sob medida negociados
-- com o cliente antes de virarem um pedido de verdade no sistema.
-- Rode isto no SQL Editor do Supabase.

create table quote_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  inspiration_product_id uuid references products(id),
  title text not null,
  description text not null,
  status text not null default 'solicitado'
    check (status in ('solicitado', 'em_analise', 'proposta_enviada', 'aprovado', 'recusado', 'cancelado')),
  final_price numeric(10,2),
  shipping_cost numeric(10,2),
  order_id uuid references orders(id),
  created_at timestamptz not null default now()
);

create index quote_requests_user_id_idx on quote_requests(user_id);

create table quote_messages (
  id uuid primary key default gen_random_uuid(),
  quote_request_id uuid not null references quote_requests(id) on delete cascade,
  sender_role text not null check (sender_role in ('cliente', 'admin')),
  sender_id uuid not null references auth.users(id),
  body text,
  images text[] not null default '{}',
  proposed_price numeric(10,2),
  proposed_shipping_cost numeric(10,2),
  created_at timestamptz not null default now()
);

create index quote_messages_quote_request_id_idx on quote_messages(quote_request_id);

-- Pedidos personalizados não referenciam um product_id real — ligam
-- direto ao orçamento que os originou.
alter table order_items add column if not exists custom_request_id uuid references quote_requests(id);

alter table quote_requests enable row level security;
alter table quote_messages enable row level security;

create policy "cliente ve proprios orcamentos" on quote_requests
  for select using (
    user_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "cliente cria proprio orcamento" on quote_requests
  for insert with check (user_id = auth.uid());

create policy "admin atualiza orcamentos" on quote_requests
  for update using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "cliente atualiza proprio orcamento" on quote_requests
  for update using (user_id = auth.uid());

create policy "participante ve mensagens" on quote_messages
  for select using (
    exists (select 1 from quote_requests where id = quote_request_id and user_id = auth.uid())
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "participante envia mensagem" on quote_messages
  for insert with check (
    sender_id = auth.uid()
    and (
      exists (select 1 from quote_requests where id = quote_request_id and user_id = auth.uid())
      or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
    )
  );

-- =========================================================
-- fulfill_order(): pedidos personalizados (order_items.product_id
-- nulo) não têm ficha técnica nem estoque pronto — pulam direto
-- pra "personalizado", sem entrar na lógica de baixa/empenho.
-- Redefine a função inteira (mesma lógica de add-order-fulfillment.sql
-- + esse guard no início do loop).
-- =========================================================
create or replace function public.fulfill_order(p_order_id uuid)
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
    if item.product_id is null then
      update order_items set fulfillment_status = 'personalizado' where id = item.id;
      continue;
    end if;

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
