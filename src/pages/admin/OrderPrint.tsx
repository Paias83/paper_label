import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase, type Order, type OrderItem, type Product, type QuoteRequest } from '../../lib/supabase'

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Aguardando pagamento',
  pago: 'Pago',
  enviado: 'Enviado',
  entregue: 'Entregue',
  pronto_para_retirada: 'Pronto para retirada',
  retirado: 'Retirado',
  cancelado: 'Cancelado',
}

// Folha de pedido em A4 pra enviar ao cliente. Rota fora do AdminLayout —
// sem menu lateral, só o documento — e o botão "Imprimir / Salvar PDF"
// abre o diálogo do navegador, onde dá pra escolher "Salvar como PDF".
export default function OrderPrint() {
  const { id } = useParams()
  const [access, setAccess] = useState<'checking' | 'ok' | 'denied'>('checking')
  const [order, setOrder] = useState<Order | null>(null)
  const [items, setItems] = useState<OrderItem[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [quotes, setQuotes] = useState<QuoteRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function run() {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        setAccess('denied')
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()
      if (profile?.role !== 'admin') {
        setAccess('denied')
        return
      }
      setAccess('ok')

      const [orderRes, itemsRes, productsRes, quotesRes] = await Promise.all([
        supabase.from('orders').select('*').eq('id', id).single(),
        supabase.from('order_items').select('*').eq('order_id', id),
        supabase.from('products').select('id, name'),
        supabase.from('quote_requests').select('id, title'),
      ])
      setOrder(orderRes.data ?? null)
      setItems(itemsRes.data ?? [])
      setProducts((productsRes.data as Product[]) ?? [])
      setQuotes((quotesRes.data as QuoteRequest[]) ?? [])
      setLoading(false)
    }
    run()
  }, [id])

  function itemName(it: OrderItem) {
    if (it.product_id) return products.find((p) => p.id === it.product_id)?.name ?? 'Produto'
    if (it.custom_request_id) {
      const q = quotes.find((x) => x.id === it.custom_request_id)
      return q ? `${q.title} (personalizado)` : 'Pedido personalizado'
    }
    return 'Item'
  }

  if (access === 'checking') return <p style={{ padding: 40 }}>Verificando acesso…</p>
  if (access === 'denied') {
    return (
      <div style={{ padding: 40 }}>
        <h2>Acesso restrito</h2>
        <p>
          É preciso estar logado como administrador. <Link to="/entrar">Entrar</Link>
        </p>
      </div>
    )
  }
  if (loading) return <p style={{ padding: 40 }}>Carregando pedido…</p>
  if (!order) {
    return (
      <div style={{ padding: 40 }}>
        <h2>Pedido não encontrado</h2>
        <Link to="/admin/pedidos">← Voltar aos pedidos</Link>
      </div>
    )
  }

  const shortId = order.id.slice(0, 8).toUpperCase()
  const itemsTotal = items.reduce((s, it) => s + it.price_at_purchase * it.quantity, 0)
  const isEntrega = order.shipping_type === 'entrega'
  const addr = order.shipping_address

  return (
    <div className="order-print-page">
      <div className="order-print-actions">
        <Link to="/admin/pedidos" className="ghost-button">
          ← Pedidos
        </Link>
        <button
          type="button"
          className="seal-button"
          onClick={() => window.print()}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M19 8H5a3 3 0 0 0-3 3v6h4v4h12v-4h4v-6a3 3 0 0 0-3-3Zm-3 11H8v-5h8v5Zm3-7a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm-1-7H6V3h12v2Z"
            />
          </svg>
          Imprimir / Salvar PDF
        </button>
      </div>

      <div className="op-doc">
        <header className="op-head">
          <div>
            <p className="op-brand">Studio Paper</p>
            <p className="op-brand-sub">Feito à mão, enviado com cuidado.</p>
          </div>
          <div className="op-head-right">
            <p className="op-doc-title">Pedido</p>
            <p className="op-number">#{shortId}</p>
            <p className="op-date">{new Date(order.created_at).toLocaleDateString('pt-BR')}</p>
          </div>
        </header>

        <div className="op-rule" />

        <section className="op-meta">
          <div>
            <span className="op-label">Cliente</span>
            <p>{order.customer_name || '—'}</p>
          </div>
          <div>
            <span className="op-label">Pagamento</span>
            <p>{STATUS_LABEL[order.status] ?? order.status}</p>
          </div>
          <div>
            <span className="op-label">Entrega</span>
            <p>{isEntrega ? 'Envio' : 'Retirada no local'}</p>
          </div>
        </section>

        {order.notes && (
          <section className="op-notes">
            <span className="op-label">Observação</span>
            <p>{order.notes}</p>
          </section>
        )}

        <table className="op-table">
          <thead>
            <tr>
              <th>Item</th>
              <th className="op-num">Qtd.</th>
              <th className="op-num">Preço unit.</th>
              <th className="op-num">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td>{itemName(it)}</td>
                <td className="op-num">{it.quantity}</td>
                <td className="op-num">{brl(it.price_at_purchase)}</td>
                <td className="op-num">{brl(it.price_at_purchase * it.quantity)}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', color: '#777' }}>
                  Sem itens registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="op-totals">
          <div>
            <span>Itens</span>
            <span>{brl(itemsTotal)}</span>
          </div>
          {isEntrega && (
            <div>
              <span>Frete{order.shipping_service ? ` — ${order.shipping_service}` : ''}</span>
              <span>{brl(order.shipping_cost)}</span>
            </div>
          )}
          <div className="op-total-final">
            <span>Total</span>
            <span>{brl(order.total)}</span>
          </div>
        </div>

        <section className="op-delivery">
          <span className="op-label">{isEntrega ? 'Endereço de entrega' : 'Retirada'}</span>
          {isEntrega && addr ? (
            <p>
              {addr.street}, {addr.number}
              {addr.complement ? ` — ${addr.complement}` : ''}
              <br />
              {addr.neighborhood} — {addr.city}/{addr.state} — CEP {addr.cep}
            </p>
          ) : isEntrega ? (
            <p>Endereço a combinar.</p>
          ) : (
            <p>Retirada no local, sem custo de frete.</p>
          )}
          {isEntrega && order.tracking_code && (
            <p>
              <strong>Rastreio:</strong> {order.tracking_code}
            </p>
          )}
        </section>

        <footer className="op-foot">
          <p>Obrigada pela preferência!</p>
          <p>contato@studiopaper.com.br · studiopaper.com.br</p>
        </footer>
      </div>
    </div>
  )
}
