import { useEffect, useState } from 'react'
import { supabase, type Order } from '../../lib/supabase'

const STATUS_OPTIONS: Order['status'][] = ['pendente', 'pago', 'enviado', 'entregue', 'cancelado']

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([])

  useEffect(() => {
    supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => setOrders(data ?? []))
  }, [])

  async function updateStatus(id: string, status: Order['status']) {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)))
    await supabase.from('orders').update({ status }).eq('id', id)
  }

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
              <th>Pedido</th>
              <th>Total</th>
              <th>Status</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
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
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={4} className="empty-state">
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
