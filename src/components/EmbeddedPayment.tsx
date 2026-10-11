import { useEffect, useRef, useState } from 'react'
import { initMercadoPago, Payment, StatusScreen } from '@mercadopago/sdk-react'
import { supabase } from '../lib/supabase'
import { callProcessPayment } from '../lib/payment'

// Public Key de produção do Mercado Pago — pública por natureza (feita para ir
// no front, só identifica a conta; quem cobra é o Access Token, que fica nos
// secrets do Supabase). VITE_MP_PUBLIC_KEY sobrescreve (ex: chave de teste).
// Vazia, o carrinho cai no Checkout Pro (redirecionamento), ver Cart.tsx.
export const MP_PUBLIC_KEY =
  (import.meta.env.VITE_MP_PUBLIC_KEY as string | undefined) || 'APP_USR-9042e9b8-13b5-4934-86c6-c9a4ae8815a0'

let mpInitialized = false
function ensureMercadoPago() {
  if (!mpInitialized && MP_PUBLIC_KEY) {
    initMercadoPago(MP_PUBLIC_KEY, { locale: 'pt-BR' })
    mpInitialized = true
  }
}

type PayResult = { payment_id: string; status: string; status_detail: string; message: string | null }

type Props = {
  orderId: string
  amount: number
  payerEmail: string
  onApproved: () => void
}

// Formulário de pagamento do Mercado Pago (cartão, Pix, boleto) dentro do
// carrinho. Os dados do cartão são digitados em campos do próprio Mercado Pago
// e chegam ao nosso servidor só como token. Depois do envio, o Status Screen
// mostra o resultado (QR do Pix, boleto, aprovado) e a página acompanha o
// pedido até o mp-webhook confirmar o pagamento.
export default function EmbeddedPayment({ orderId, amount, payerEmail, onApproved }: Props) {
  ensureMercadoPago()
  const [paymentId, setPaymentId] = useState<string | null>(null)
  const [rejection, setRejection] = useState('')
  const approvedRef = useRef(onApproved)
  approvedRef.current = onApproved

  // Acompanha o pedido (Pix/boleto confirmam depois): quando o webhook marcar
  // como pago, o carrinho mostra a confirmação e se esvazia.
  useEffect(() => {
    if (!paymentId) return
    const timer = setInterval(async () => {
      const { data } = await supabase.from('orders').select('status').eq('id', orderId).single()
      if (data?.status === 'pago') {
        clearInterval(timer)
        approvedRef.current()
      }
    }, 5000)
    return () => clearInterval(timer)
  }, [paymentId, orderId])

  async function handleSubmit({ formData }: { formData: unknown }) {
    setRejection('')
    const result = await callProcessPayment<PayResult>('pay', { order_id: orderId, form: formData })
    if (result.status === 'rejected') {
      setRejection(result.message ?? 'Pagamento recusado. Tente outro cartão ou o Pix.')
      // Rejeitar a promise mantém o formulário aberto para tentar de novo.
      throw new Error(result.message ?? 'rejected')
    }
    if (result.status === 'approved') {
      onApproved()
      return
    }
    setPaymentId(result.payment_id)
  }

  const shortId = orderId.slice(0, 8)

  if (paymentId) {
    return (
      <div style={{ marginTop: 'var(--space-3)' }}>
        <StatusScreen
          initialization={{ paymentId }}
          customization={{ visual: { style: { customVariables: BRICK_VARIABLES } } }}
          locale="pt-BR"
        />
        <p className="checkout-hint">
          Pedido <strong>#{shortId}</strong>. Assim que o pagamento for confirmado esta página avisa — e você também
          recebe um e-mail.
        </p>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 'var(--space-3)' }}>
      {rejection && <p className="checkout-error">{rejection}</p>}
      <Payment
        initialization={{ amount, payer: { email: payerEmail } }}
        customization={{
          paymentMethods: {
            creditCard: 'all',
            debitCard: 'all',
            bankTransfer: 'all',
            ticket: 'all',
            maxInstallments: 12,
          },
          visual: { style: { customVariables: BRICK_VARIABLES } },
        }}
        locale="pt-BR"
        onSubmit={handleSubmit}
        onError={(error) => console.error('Payment Brick:', error)}
      />
    </div>
  )
}

// Visual "papel/lacre" da loja (mesmos tokens de global.css).
const BRICK_VARIABLES = {
  baseColor: '#6b1f2a',
  baseColorFirstVariant: '#4d151d',
  baseColorSecondVariant: '#8a3a45',
  textPrimaryColor: '#1c1b19',
  textSecondaryColor: '#3a362e',
  formBackgroundColor: '#fffdf8',
  inputBackgroundColor: '#ffffff',
  outlinePrimaryColor: '#d8d0bf',
  errorColor: '#a13a2f',
  successColor: '#3f5d43',
  borderRadiusSmall: '2px',
  borderRadiusMedium: '2px',
  borderRadiusLarge: '2px',
}
