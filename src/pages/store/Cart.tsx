import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '../../context/CartContext'
import { useAuth } from '../../context/AuthContext'
import { supabase, type ShippingAddress } from '../../lib/supabase'
import AddressForm, { isAddressComplete } from '../../components/AddressForm'
import EmbeddedPayment, { MP_PUBLIC_KEY } from '../../components/EmbeddedPayment'
import { callProcessPayment } from '../../lib/payment'
import DeliveryMethodPicker, { PICKUP_INFO, type DeliveryMethod } from '../../components/DeliveryMethodPicker'

type ShippingOption = {
  id: number
  name: string
  price: number
  delivery_time: number
  company: string
}

const emptyAddress: ShippingAddress = {
  cep: '',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
}

const PICKUP_OPTION: ShippingOption = {
  id: -1,
  name: 'Retirada no local',
  price: 0,
  delivery_time: 0,
  company: 'Studio Paper',
}

export default function Cart() {
  const { items, setQuantity, removeItem, clear, total } = useCart()
  const { user, loading: authLoading } = useAuth()

  const [paying, setPaying] = useState(false)
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('entrega')
  const [address, setAddress] = useState<ShippingAddress>(emptyAddress)
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([])
  const [selectedShippingId, setSelectedShippingId] = useState<number | null>(null)
  const [shippingLoading, setShippingLoading] = useState(false)
  const [shippingError, setShippingError] = useState('')
  const [addressFromProfile, setAddressFromProfile] = useState(false)
  // Descarta respostas de cotações antigas (CEP/quantidade mudou no meio do caminho).
  const quoteRequestId = useRef(0)
  // Pedido criado para o pagamento embutido. Vale só para o carrinho do jeito
  // que estava (checkoutKey): mudou produto, frete ou endereço, gera outro.
  const [checkout, setCheckout] = useState<{ orderId: string; total: number; payerEmail: string; key: string } | null>(
    null
  )
  const [paidOrderId, setPaidOrderId] = useState<string | null>(null)

  const selectedShipping =
    deliveryMethod === 'retirada' ? PICKUP_OPTION : shippingOptions.find((o) => o.id === selectedShippingId) ?? null
  const grandTotal = total + (selectedShipping?.price ?? 0)
  const canPay =
    deliveryMethod === 'retirada' ? true : isAddressComplete(address) && Boolean(selectedShipping)
  const checkoutKey = JSON.stringify([
    items.map((i) => [i.product.id, i.quantity]),
    deliveryMethod,
    deliveryMethod === 'entrega' ? address : null,
    selectedShipping?.id ?? null,
  ])
  const activeCheckout = checkout && checkout.key === checkoutKey ? checkout : null

  // Pré-preenche com o endereço do cadastro (o cliente pode alterar à vontade).
  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select('addresses')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        const saved = (data?.addresses as ShippingAddress[] | null)?.[0]
        if (!saved?.cep) return
        setAddress((prev) => (prev.cep ? prev : { ...emptyAddress, ...saved }))
        setAddressFromProfile(true)
      })
  }, [user?.id])

  // Cota o frete sozinho sempre que houver CEP completo — e de novo se o CEP ou as
  // quantidades mudarem. Mexer em número/complemento não apaga mais o frete.
  const cepDigits = address.cep.replace(/\D/g, '')
  const itemsKey = items.map((i) => `${i.product.id}:${i.quantity}`).join(',')
  useEffect(() => {
    if (deliveryMethod !== 'entrega' || cepDigits.length !== 8 || items.length === 0) {
      quoteRequestId.current++
      setShippingOptions([])
      setSelectedShippingId(null)
      setShippingLoading(false)
      return
    }
    const timer = setTimeout(() => calculateShipping(cepDigits), 400)
    return () => clearTimeout(timer)
  }, [cepDigits, itemsKey, deliveryMethod])

  function handleAddressChange(next: ShippingAddress) {
    setAddress(next)
  }

  function handleDeliveryMethodChange(next: DeliveryMethod) {
    setDeliveryMethod(next)
    setShippingError('')
  }

  async function calculateShipping(cepDigits: string) {
    const requestId = ++quoteRequestId.current
    setShippingLoading(true)
    setShippingError('')
    try {
      const { data, error } = await supabase.functions.invoke('calculate-shipping', {
        body: {
          cep_destino: cepDigits,
          items: items.map((i) => ({ product_id: i.product.id, quantity: i.quantity })),
        },
      })
      if (requestId !== quoteRequestId.current) return
      if (error) throw error
      if (!data.options?.length) {
        setShippingOptions([])
        setSelectedShippingId(null)
        setShippingError('Nenhuma opção de frete disponível para esse CEP.')
        return
      }
      const options: ShippingOption[] = data.options
      setShippingOptions(options)
      // Mantém o serviço que o cliente já tinha escolhido, se ainda existir.
      setSelectedShippingId((prev) => (options.some((o) => o.id === prev) ? prev : options[0].id))
    } catch (err) {
      if (requestId !== quoteRequestId.current) return
      console.error(err)
      setShippingError('Não foi possível calcular o frete. Tente novamente.')
    } finally {
      if (requestId === quoteRequestId.current) setShippingLoading(false)
    }
  }

  function orderBody() {
    return {
      items: items.map((i) => ({ id: i.product.id, quantity: i.quantity })),
      shipping: { type: deliveryMethod, service_id: selectedShipping?.id },
      address: deliveryMethod === 'entrega' ? address : null,
    }
  }

  // Guarda o endereço no perfil pra pré-preencher da próxima compra —
  // best-effort, não bloqueia o checkout se falhar.
  function rememberAddress() {
    if (user && deliveryMethod === 'entrega') {
      supabase.from('profiles').update({ addresses: [address] }).eq('id', user.id)
    }
  }

  // Pagamento embutido: cria o pedido (preço e frete calculados no servidor)
  // e abre o formulário do Mercado Pago logo abaixo do resumo.
  async function handleGoToPayment() {
    if (!canPay || !selectedShipping) return
    setPaying(true)
    try {
      const data = await callProcessPayment<{ order_id: string; total: number; payer_email: string }>(
        'create_order',
        orderBody()
      )
      rememberAddress()
      setCheckout({ orderId: data.order_id, total: data.total, payerEmail: data.payer_email, key: checkoutKey })
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setPaying(false)
    }
  }

  function handlePaymentApproved() {
    if (!activeCheckout) return
    setPaidOrderId(activeCheckout.orderId)
    setCheckout(null)
    clear()
  }

  // Plano B (sem VITE_MP_PUBLIC_KEY): Checkout Pro, redireciona para o Mercado Pago.
  async function handlePagar() {
    if (!canPay || !selectedShipping) return
    setPaying(true)
    try {
      const { data, error } = await supabase.functions.invoke('create-preference', { body: orderBody() })
      if (error) throw error
      rememberAddress()
      window.location.href = data.init_point
    } catch (err) {
      console.error(err)
      // A função responde { error } com status 4xx (ex: frete mudou, produto
      // indisponível); o supabase-js guarda o corpo em error.context.
      let message = 'Não foi possível iniciar o pagamento. Tente novamente.'
      try {
        const body = await (err as { context?: Response }).context?.json()
        if (body?.error) message = body.error
      } catch {
        // corpo não era JSON — fica a mensagem genérica
      }
      alert(message)
    } finally {
      setPaying(false)
    }
  }

  if (paidOrderId) {
    return (
      <div className="container" style={{ padding: '40px 24px', maxWidth: 640 }}>
        <div className="form-card">
          <h2>Pagamento confirmado!</h2>
          <p>
            Recebemos o pagamento do pedido <strong>#{paidOrderId.slice(0, 8)}</strong>. Você vai receber a
            confirmação por e-mail e pode acompanhar tudo em "Meus pedidos".
          </p>
          <Link to="/meus-pedidos" className="seal-button">
            Ver meus pedidos
          </Link>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="container" style={{ padding: '40px 24px' }}>
        <h2>Seu carrinho está vazio</h2>
        <Link to="/catalogo" className="seal-button">
          Ver produtos
        </Link>
      </div>
    )
  }

  return (
    <div className="container" style={{ padding: '40px 24px', maxWidth: 640 }}>
      <h2>Carrinho</h2>
      {items.map((item) => (
        <div key={item.product.id} className="cart-item">
          <img src={item.product.images?.[0] ?? ''} alt={item.product.name} />
          <div style={{ flex: 1 }}>
            <strong>{item.product.name}</strong>
            <div className="price">
              {item.product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          </div>
          <input
            type="number"
            min={1}
            value={item.quantity}
            onChange={(e) => setQuantity(item.product.id, Number(e.target.value))}
            style={{ width: 56 }}
          />
          <button className="cart-item-remove" onClick={() => removeItem(item.product.id)}>
            Remover
          </button>
        </div>
      ))}

      <div className="deckle-divider" style={{ marginTop: 'var(--space-3)' }} />

      <div className="checkout-panel">
        {!authLoading && !user ? (
          <div>
            <p style={{ color: 'var(--charcoal)' }}>Entre na sua conta para finalizar a compra.</p>
            <Link to="/entrar" className="seal-button">
              Entrar
            </Link>
          </div>
        ) : (
          <div>
            <DeliveryMethodPicker value={deliveryMethod} onChange={handleDeliveryMethodChange} />

            {deliveryMethod === 'retirada' ? (
              <div className="form-card" style={{ marginTop: 'var(--space-3)' }}>
                <h3>Retirada no local</h3>
                <p className="checkout-hint">Retire seu pedido em: {PICKUP_INFO}</p>
              </div>
            ) : (
              <>
                <AddressForm address={address} onChange={handleAddressChange} />
                {addressFromProfile && (
                  <p className="checkout-hint">
                    Endereço do seu cadastro — altere os campos acima se quiser entregar em outro lugar.
                  </p>
                )}

                {shippingLoading && <p className="checkout-hint">Calculando frete…</p>}
                {shippingError && <p className="checkout-error">{shippingError}</p>}

                {shippingOptions.length > 0 && (
                  <div className="form-card" style={{ marginTop: 'var(--space-3)' }}>
                    <h3>Frete</h3>
                    <div className="shipping-options">
                      {shippingOptions.map((opt) => (
                        <label key={opt.id} className="shipping-option">
                          <input
                            type="radio"
                            name="shipping"
                            checked={selectedShippingId === opt.id}
                            onChange={() => setSelectedShippingId(opt.id)}
                          />
                          <span className="shipping-option-info">
                            <span>
                              {opt.company} {opt.name}
                              <span className="shipping-option-carrier"> — {opt.delivery_time} dias úteis</span>
                            </span>
                            <span className="shipping-option-price">
                              {opt.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="checkout-summary">
              <div className="checkout-summary-row">
                <span>Produtos</span>
                <span>{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
              <div className="checkout-summary-row">
                <span>Frete</span>
                <span>
                  {selectedShipping
                    ? selectedShipping.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                    : '—'}
                </span>
              </div>
              <div className="checkout-summary-row total">
                <span>Total</span>
                <strong className="price">
                  {grandTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </strong>
              </div>
              {MP_PUBLIC_KEY ? (
                !activeCheckout && (
                  <button
                    className="seal-button"
                    onClick={handleGoToPayment}
                    disabled={paying || authLoading || !canPay || !selectedShipping}
                  >
                    {paying ? 'Preparando pagamento…' : 'Ir para o pagamento'}
                  </button>
                )
              ) : (
                <button
                  className="seal-button"
                  onClick={handlePagar}
                  disabled={paying || authLoading || !canPay || !selectedShipping}
                >
                  {paying ? 'Redirecionando…' : 'Pagar com Mercado Pago'}
                </button>
              )}
            </div>
            {activeCheckout && (
              <>
                <p className="checkout-hint" style={{ marginTop: 'var(--space-3)' }}>
                  Pagamento processado com segurança pelo Mercado Pago — os dados do cartão não passam pela loja.
                </p>
                <EmbeddedPayment
                  key={activeCheckout.orderId}
                  orderId={activeCheckout.orderId}
                  amount={activeCheckout.total}
                  payerEmail={activeCheckout.payerEmail}
                  onApproved={handlePaymentApproved}
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
