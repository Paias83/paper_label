import { Fragment, useEffect, useState } from 'react'
import { supabase, type Order, type OrderItem, type Product } from '../../lib/supabase'

const STATUS_OPTIONS: Order['status'][] = ['pendente', 'pago', 'enviado', 'entregue', 'cancelado']

const FULFILLMENT_LABEL: Record<string, string> = {
  estoque_pronto: 'Estoque pronto',
  empenhado: 'Matéria-prima empenhada',
  aguardando_compra: 'Aguardando compra',
}

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [items, setItems] = useState<OrderItem[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [trackingDrafts, setTrackingDrafts] = useState<Record<string, string>>({})
  const [savingTracking, setSavingTracking] = useState<string | null>(null)

  async function load() {
    const [ordersRes, itemsRes, productsRes] = await Promise.all([
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('order_items').select('*'),
      supabase.from('products').select('*'),
    ])
    setOrders(ordersRes.data ?? [])
    setItems(itemsRes.data ?? [])
    setProducts(productsRes.data ?? [])
  }

  useEffect(() => {
    load()
  }, [])

  async function updateStatus(id: string, status: Order['status']) {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)))
    await supabase.from('orders').update({ status }).eq('id', id)
  }

  function trackingDraft(order: Order) {
    return trackingDrafts[order.id] ?? order.tracking_code ?? ''
  }

  async function saveTracking(id: string) {
    const tracking_code = trackingDrafts[id]?.trim()
    if (!tracking_code) return
    setSavingTracking(id)
    await supabase.from('orders').update({ tracking_code }).eq('id', id)
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, tracking_code } : o)))
    setSavingTracking(null)
  }

  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? '—'
  const itemsForOrder = (orderId: string) => items.filter((i) => i.order_id === orderId)

  return (
    <div>
      <div className="admin-page-header">
        <p className="eyebrow">Vendas</p>
        <h2>Pedidos</h2>
      </div>

      <div className="list-toolbar" style={{ justifyContent: 'flex-end' }}>
        <span className="list-count">
          {orders.length} {orders.length === 1 ? 'pedido' : 'pedidos'}
        </span>
      </div>

      <div className="list-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th></th>
              <th>Pedido</th>
              <th>Total</th>
              <th>Status</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const orderItems = itemsForOrder(o.id)
              const isOpen = expanded === o.id
              return (
                <Fragment key={o.id}>
                  <tr>
                    <td>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={isOpen ? 'Recolher itens' : 'Ver itens'}
                        onClick={() => setExpanded(isOpen ? null : o.id)}
                      >
                        {isOpen ? '−' : '+'}
                      </button>
                    </td>
                    <td>
                      <span className="order-id">{o.id.slice(0, 8)}</span>
                    </td>
                    <td className="price">
                      {o.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td>
                      <select value={o.status} onChange={(e) => updateStatus(o.id, e.target.value as Order['status'])}>
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>{new Date(o.created_at).toLocaleDateString('pt-BR')}</td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td></td>
                      <td colSpan={4}>
                        {o.shipping_address ? (
                          <div style={{ margin: '8px 0' }}>
                            <strong>Entrega:</strong>{' '}
                            {o.shipping_address.street}, {o.shipping_address.number}
                            {o.shipping_address.complement ? ` - ${o.shipping_address.complement}` : ''} —{' '}
                            {o.shipping_address.neighborhood}, {o.shipping_address.city}/
                            {o.shipping_address.state} — CEP {o.shipping_address.cep}
                            <br />
                            <strong>Frete:</strong> {o.shipping_service ?? '—'} —{' '}
                            {o.shipping_cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </div>
                        ) : (
                          <p style={{ color: 'var(--charcoal)', margin: '8px 0' }}>
                            Sem endereço de entrega registrado (pedido anterior a esse fluxo).
                          </p>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0' }}>
                          <strong>Rastreio:</strong>
                          <input
                            type="text"
                            placeholder="Código de rastreio"
                            value={trackingDraft(o)}
                            onChange={(e) =>
                              setTrackingDrafts((prev) => ({ ...prev, [o.id]: e.target.value }))
                            }
                            style={{ maxWidth: 200 }}
                          />
                          <button
                            type="button"
                            className="ghost-button small"
                            disabled={savingTracking === o.id}
                            onClick={() => saveTracking(o.id)}
                          >
                            {savingTracking === o.id ? 'Salvando…' : 'Salvar'}
                          </button>
                        </div>

                        {orderItems.length === 0 ? (
                          <p style={{ color: 'var(--charcoal)', margin: '8px 0' }}>
                            Sem itens registrados (pedido criado antes do fluxo atual, ou ainda pendente de pagamento).
                          </p>
                        ) : (
                          <table className="admin-table" style={{ margin: '8px 0' }}>
                            <thead>
                              <tr>
                                <th>Produto</th>
                                <th>Qtd.</th>
                                <th>Do estoque</th>
                                <th>Situação</th>
                              </tr>
                            </thead>
                            <tbody>
                              {orderItems.map((it) => (
                                <tr key={it.id}>
                                  <td>{productName(it.product_id)}</td>
                                  <td>{it.quantity}</td>
                                  <td>{it.quantity_from_stock}</td>
                                  <td>
                                    {it.fulfillment_status ? (
                                      <span className={`type-badge ${it.fulfillment_status}`}>
                                        {FULFILLMENT_LABEL[it.fulfillment_status] ?? it.fulfillment_status}
                                      </span>
                                    ) : (
                                      <span style={{ color: 'var(--charcoal)' }}>
                                        Aguardando pagamento
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
            {orders.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-state">
                  Nenhum pedido ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
