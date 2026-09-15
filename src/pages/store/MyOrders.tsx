import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase, type Order, type OrderItem, type Product, type QuoteRequest } from '../../lib/supabase'
import { ORDER_STATUS_LABEL } from '../../lib/orderStatus'

export default function MyOrders() {
  const { user, loading: authLoading } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [items, setItems] = useState<OrderItem[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [quotes, setQuotes] = useState<QuoteRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return

    async function load() {
      const [ordersRes, itemsRes, productsRes, quotesRes] = await Promise.all([
        supabase.from('orders').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }),
        supabase.from('order_items').select('*'),
        supabase.from('products').select('*'),
        supabase.from('quote_requests').select('*').eq('user_id', user!.id),
      ])
      setOrders(ordersRes.data ?? [])
      setItems(itemsRes.data ?? [])
      setProducts(productsRes.data ?? [])
      setQuotes(quotesRes.data ?? [])
      setLoading(false)
    }

    load()
  }, [user])

  function itemName(item: OrderItem) {
    if (item.product_id) return products.find((p) => p.id === item.product_id)?.name ?? 'Produto'
    if (item.custom_request_id) {
      const quote = quotes.find((q) => q.id === item.custom_request_id)
      return quote ? `${quote.title} (personalizado)` : 'Pedido personalizado'
    }
    return 'Item do pedido'
  }

  const itemsForOrder = (orderId: string) => items.filter((i) => i.order_id === orderId)

  if (!authLoading && !user) {
    return (
      <div className="container" style={{ padding: '40px 24px' }}>
        <h2>Meus pedidos</h2>
        <p style={{ color: 'var(--charcoal)' }}>Entre na sua conta para ver seus pedidos.</p>
        <Link to="/entrar" className="seal-button">
          Entrar
        </Link>
      </div>
    )
  }

  return (
    <div className="container" style={{ padding: '40px 24px', maxWidth: 640 }}>
      <h2>Meus pedidos</h2>
      {loading ? (
        <p style={{ color: 'var(--charcoal)' }}>Carregando…</p>
      ) : orders.length === 0 ? (
        <p style={{ color: 'var(--charcoal)' }}>
          Você ainda não fez nenhum pedido. Dá uma olhada no <Link to="/catalogo">catálogo</Link>.
        </p>
      ) : (
        <div className="quote-list">
          {orders.map((o) => {
            const isOpen = expanded === o.id
            const orderItems = itemsForOrder(o.id)
            const itemCount = orderItems.reduce((sum, i) => sum + i.quantity, 0)
            return (
              <div key={o.id} className="order-card">
                <button
                  type="button"
                  className="order-card-summary"
                  onClick={() => setExpanded(isOpen ? null : o.id)}
                >
                  <div>
                    <strong>Pedido #{o.id.slice(0, 8)}</strong>
                    <span className="checkout-hint" style={{ margin: 0 }}>
                      {new Date(o.created_at).toLocaleDateString('pt-BR')} ·{' '}
                      {itemCount === 1 ? '1 item' : `${itemCount} itens`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <strong className="price">
                      {o.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </strong>
                    <span className={`type-badge order-status-${o.status}`}>
                      {ORDER_STATUS_LABEL[o.status]}
                    </span>
                    <ChevronDown
                      size={16}
                      style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}
                    />
                  </div>
                </button>

                {isOpen && (
                  <div className="order-card-detail">
                    {o.shipping_type === 'retirada' ? (
                      <p style={{ margin: 0 }}>
                        <strong>Retirada no local</strong>
                      </p>
                    ) : o.shipping_address ? (
                      <p style={{ margin: 0 }}>
                        <strong>Entrega:</strong> {o.shipping_address.street}, {o.shipping_address.number}
                        {o.shipping_address.complement ? ` - ${o.shipping_address.complement}` : ''} —{' '}
                        {o.shipping_address.neighborhood}, {o.shipping_address.city}/{o.shipping_address.state}
                        {o.shipping_service && (
                          <>
                            <br />
                            <strong>Transportadora:</strong> {o.shipping_service}
                          </>
                        )}
                      </p>
                    ) : null}

                    {o.tracking_code && (
                      <p style={{ margin: 0 }}>
                        <strong>Código de rastreio:</strong> {o.tracking_code}
                      </p>
                    )}

                    {o.notes && (
                      <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                        <strong>Observação:</strong> {o.notes}
                      </p>
                    )}

                    <div className="order-card-items">
                      {orderItems.map((it) => (
                        <div key={it.id} className="order-card-item-row">
                          <span>
                            {itemName(it)} × {it.quantity}
                          </span>
                          <span className="price">
                            {(it.price_at_purchase * it.quantity).toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
