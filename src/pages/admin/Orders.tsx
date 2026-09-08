import { Fragment, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, type Order, type OrderItem, type Product, type QuoteRequest } from '../../lib/supabase'

const STATUS_OPTIONS_ENTREGA: Order['status'][] = ['pendente', 'pago', 'enviado', 'entregue', 'cancelado']
const STATUS_OPTIONS_RETIRADA: Order['status'][] = [
  'pendente',
  'pago',
  'pronto_para_retirada',
  'retirado',
  'cancelado',
]

const FULFILLMENT_LABEL: Record<string, string> = {
  estoque_pronto: 'Estoque pronto',
  empenhado: 'Matéria-prima empenhada',
  aguardando_compra: 'Aguardando compra',
  personalizado: 'Sob encomenda (orçamento)',
}

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [items, setItems] = useState<OrderItem[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [quotes, setQuotes] = useState<QuoteRequest[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [trackingDrafts, setTrackingDrafts] = useState<Record<string, string>>({})
  const [savingTracking, setSavingTracking] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showCancelled, setShowCancelled] = useState(false)

  async function load() {
    const [ordersRes, itemsRes, productsRes, quotesRes] = await Promise.all([
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('order_items').select('*'),
      supabase.from('products').select('*'),
      supabase.from('quote_requests').select('*'),
    ])
    setOrders(ordersRes.data ?? [])
    setItems(itemsRes.data ?? [])
    setProducts(productsRes.data ?? [])
    setQuotes(quotesRes.data ?? [])
  }

  useEffect(() => {
    load()
  }, [])

  async function updateStatus(id: string, status: Order['status']) {
    const admin_seen_at = new Date().toISOString()
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status, admin_seen_at, last_status_change_by: 'admin' } : o))
    )
    await supabase.from('orders').update({ status, admin_seen_at, last_status_change_by: 'admin' }).eq('id', id)
  }

  async function toggleExpanded(order: Order) {
    const next = expanded === order.id ? null : order.id
    setExpanded(next)
    if (next && !order.admin_seen_at) {
      const admin_seen_at = new Date().toISOString()
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, admin_seen_at } : o)))
      await supabase.from('orders').update({ admin_seen_at }).eq('id', order.id)
    }
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

  function itemName(item: OrderItem) {
    if (item.product_id) return products.find((p) => p.id === item.product_id)?.name ?? '—'
    if (item.custom_request_id) {
      const quote = quotes.find((q) => q.id === item.custom_request_id)
      return quote ? `${quote.title} (orçamento)` : 'Pedido personalizado'
    }
    return '—'
  }
  const itemsForOrder = (orderId: string) => items.filter((i) => i.order_id === orderId)

  const filteredOrders = orders.filter((o) => {
    if (!showCancelled && o.status === 'cancelado') return false
    const term = search.trim().toLowerCase()
    if (!term) return true
    return (
      o.id.toLowerCase().includes(term) ||
      (o.customer_name ?? '').toLowerCase().includes(term) ||
      (o.notes ?? '').toLowerCase().includes(term)
    )
  })

  return (
    <div>
      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <p className="eyebrow">Vendas</p>
          <h2>Pedidos</h2>
        </div>
        <Link to="/admin/pedidos/novo" className="seal-button">
          + Novo pedido
        </Link>
      </div>

      <div className="list-toolbar">
        <input
          type="search"
          placeholder="Buscar por cliente, observação ou nº do pedido…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showCancelled}
              onChange={(e) => setShowCancelled(e.target.checked)}
            />
            Mostrar cancelados
          </label>
          <span className="list-count">
            {filteredOrders.length} {filteredOrders.length === 1 ? 'pedido' : 'pedidos'}
          </span>
        </div>
      </div>

      <div className="list-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th></th>
              <th>Pedido</th>
              <th>Cliente</th>
              <th>Total</th>
              <th>Status</th>
              <th>Data</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((o) => {
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
                        onClick={() => toggleExpanded(o)}
                      >
                        {isOpen ? '−' : '+'}
                      </button>
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <span className="order-id">{o.id.slice(0, 8)}</span>
                        <a
                          href={`/admin/pedidos/${o.id}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className="table-action-link"
                          title="Gerar folha do pedido em PDF (A4)"
                        >
                          PDF
                        </a>
                      </span>
                    </td>
                    <td>
                      {o.customer_name || '—'}
                      {o.source === 'manual' && <span className="type-badge manual"> Manual</span>}
                    </td>
                    <td className="price">
                      {o.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td>
                      <select value={o.status} onChange={(e) => updateStatus(o.id, e.target.value as Order['status'])}>
                        {(o.shipping_type === 'retirada' ? STATUS_OPTIONS_RETIRADA : STATUS_OPTIONS_ENTREGA).map(
                          (s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          )
                        )}
                      </select>
                    </td>
                    <td>{new Date(o.created_at).toLocaleDateString('pt-BR')}</td>
                    <td>
                      {o.source === 'manual' && o.status === 'pendente' && (
                        <Link to={`/admin/pedidos/${o.id}/editar`} className="table-action-link">
                          Editar
                        </Link>
                      )}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td></td>
                      <td colSpan={6}>
                        {o.notes && (
                          <p style={{ margin: '0 0 8px', whiteSpace: 'pre-wrap' }}>
                            <strong>Observação:</strong> {o.notes}
                          </p>
                        )}
                        {o.last_status_change_by && (
                          <p style={{ color: 'var(--charcoal)', margin: '0 0 8px' }}>
                            <strong>Última mudança de status:</strong>{' '}
                            {o.last_status_change_by === 'sistema'
                              ? 'automática (Mercado Pago)'
                              : 'manual (admin)'}
                          </p>
                        )}
                        {o.shipping_type === 'retirada' ? (
                          <p style={{ margin: '8px 0' }}>
                            <strong>Retirada no local</strong> — sem custo de frete.
                          </p>
                        ) : o.shipping_address ? (
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

                        {o.shipping_type !== 'retirada' && (
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
                        )}

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
                                  <td>{itemName(it)}</td>
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
            {filteredOrders.length === 0 && (
              <tr>
                <td colSpan={7} className="empty-state">
                  {orders.length === 0 ? 'Nenhum pedido ainda.' : 'Nenhum pedido encontrado.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
