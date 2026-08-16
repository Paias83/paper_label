-- Sinalização de pedidos que precisam de atenção do admin: pedido novo ou
-- mudança de status feita pelo sistema (Mercado Pago, via mp-webhook).
-- Rode isto no SQL Editor do Supabase.

-- admin_seen_at nulo = "não visto", conta pro badge no menu lateral.
-- Fica nulo em pedidos recém-criados e é zerado de novo pelo mp-webhook a
-- cada mudança automática de status. Vira not-null quando o admin abre o
-- pedido no painel (Orders.tsx) ou muda o status manualmente.
alter table orders
  add column if not exists admin_seen_at timestamptz;

-- last_status_change_by é só informativo — mostra no pedido expandido
-- quem fez a última mudança de status, mesmo depois de já visto.
alter table orders
  add column if not exists last_status_change_by text
    check (last_status_change_by in ('sistema', 'admin'));

-- Pedidos já existentes não devem aparecer como "não vistos" quando essa
-- feature entrar no ar.
update orders set admin_seen_at = now() where admin_seen_at is null;
