import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase, type Order } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { ORDER_STATUS_LABEL } from '../../lib/orderStatus'

type Variant = 'sucesso' | 'falha' | 'pendente'

const COPY: Record<Variant, { title: string; text: string }> = {
  sucesso: {
    title: 'Pagamento recebido!',
    text: 'O Mercado Pago aprovou o seu pagamento. Você vai receber a confirmação por e-mail.',
  },
  pendente: {
    title: 'Pagamento em processamento',
    text: 'Se você pagou com Pix ou boleto, a confirmação pode levar alguns minutos (boleto: até 3 dias úteis). Avisamos por e-mail assim que for aprovado.',
  },
  falha: {
    title: 'O pagamento não foi concluído',
    text: 'Nenhum valor foi cobrado. Você pode tentar de novo com outro cartão ou pelo Pix.',
  },
}

// Retorno do Checkout Pro (back_urls de create-preference / create-quote-order):
// o Mercado Pago volta com ?external_reference=<id do pedido>&status=... .
// Quem confirma de verdade é o mp-webhook; aqui mostramos o status do pedido no
// banco e, enquanto estiver pendente, consultamos de novo a cada 5 s.
export default function CheckoutReturn({ variant }: { variant: Variant }) {
  const [params] = useSearchParams()
  const { user } = useAuth()
  const orderId = params.get('external_reference')
  const [order, setOrder] = useState<Pick<Order, 'id' | 'status'> | null>(null)

  useEffect(() => {
    if (!orderId || !user) return
    let active = true
    let attempts = 0

    async function check() {
      const { data } = await supabase.from('orders').select('id, status').eq('id', orderId).maybeSingle()
      if (!active) return
      if (data) setOrder(data)
      attempts += 1
      // Para depois de ~2 min ou quando o webhook já resolveu.
      if (data?.status === 'pendente' && variant !== 'falha' && attempts < 24) setTimeout(check, 5000)
    }

    check()
    return () => {
      active = false
    }
  }, [orderId, user, variant])

  // O status do banco manda: se o webhook já confirmou, mostra sucesso mesmo
  // que o Mercado Pago tenha voltado por "pendente".
  const effective: Variant =
    order && order.status !== 'pendente' && order.status !== 'cancelado' ? 'sucesso' : variant
  const copy = COPY[effective]

  return (
    <div className="container" style={{ padding: '40px 24px', maxWidth: 640 }}>
      <div className="form-card">
        <h2>{copy.title}</h2>
        <p>{copy.text}</p>
        {order && (
          <p className="checkout-hint">
            Pedido <strong>#{order.id.slice(0, 8)}</strong> — {ORDER_STATUS_LABEL[order.status]}
          </p>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link to="/meus-pedidos" className="seal-button">
            Ver meus pedidos
          </Link>
          {effective === 'falha' ? (
            <Link to="/carrinho" className="ghost-button">
              Voltar ao carrinho
            </Link>
          ) : (
            <Link to="/" className="ghost-button">
              Continuar comprando
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
