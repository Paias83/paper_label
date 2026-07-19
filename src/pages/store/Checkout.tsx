import { useState } from 'react'
import { useCart } from '../../context/CartContext'
import { supabase } from '../../lib/supabase'

export default function Checkout() {
  const { items, total } = useCart()
  const [loading, setLoading] = useState(false)

  async function handlePagar() {
    setLoading(true)
    try {
      // Chama a Edge Function que cria a preferência no Mercado Pago
      // e devolve o init_point (URL de pagamento) — ver supabase/functions/create-preference
      const { data, error } = await supabase.functions.invoke('create-preference', {
        body: {
          items: items.map((i) => ({
            id: i.product.id,
            title: i.product.name,
            quantity: i.quantity,
            unit_price: i.product.price,
          })),
        },
      })
      if (error) throw error
      window.location.href = data.init_point
    } catch (err) {
      console.error(err)
      alert('Não foi possível iniciar o pagamento. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container" style={{ padding: '40px 24px' }}>
      <h2>Finalizar compra</h2>
      <p>
        Total:{' '}
        <strong className="price">
          {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </strong>
      </p>
      {/* TODO: formulário de endereço de entrega, salvo em profiles.addresses */}
      <button className="seal-button" onClick={handlePagar} disabled={loading}>
        {loading ? 'Redirecionando…' : 'Pagar com Mercado Pago'}
      </button>
    </div>
  )
}
