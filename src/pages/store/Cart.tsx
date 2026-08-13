import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '../../context/CartContext'
import { useAuth } from '../../context/AuthContext'
import { supabase, type ShippingAddress } from '../../lib/supabase'

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

export default function Cart() {
  const { items, setQuantity, removeItem, total } = useCart()
  const { user, loading: authLoading } = useAuth()

  const [paying, setPaying] = useState(false)
  const [address, setAddress] = useState<ShippingAddress>(emptyAddress)
  const [cepLoading, setCepLoading] = useState(false)
  const [cepError, setCepError] = useState('')
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([])
  const [selectedShippingId, setSelectedShippingId] = useState<number | null>(null)
  const [shippingLoading, setShippingLoading] = useState(false)
  const [shippingError, setShippingError] = useState('')

  const selectedShipping = shippingOptions.find((o) => o.id === selectedShippingId) ?? null
  const grandTotal = total + (selectedShipping?.price ?? 0)

  async function handleCepBlur() {
    const digits = address.cep.replace(/\D/g, '')
    if (digits.length !== 8) return

    setCepError('')
    setCepLoading(true)
    setShippingOptions([])
    setSelectedShippingId(null)

    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      const data = await res.json()
      if (data.erro) {
        setCepError('CEP não encontrado.')
        return
      }
      setAddress((a) => ({
        ...a,
        street: data.logradouro ?? '',
        neighborhood: data.bairro ?? '',
        city: data.localidade ?? '',
        state: data.uf ?? '',
      }))
      await calculateShipping(digits)
    } catch {
      setCepError('Não foi possível buscar o CEP.')
    } finally {
      setCepLoading(false)
    }
  }

  async function calculateShipping(cepDigits: string) {
    setShippingLoading(true)
    setShippingError('')
    try {
      const { data, error } = await supabase.functions.invoke('calculate-shipping', {
        body: {
          cep_destino: cepDigits,
          items: items.map((i) => ({ product_id: i.product.id, quantity: i.quantity })),
        },
      })
      if (error) throw error
      if (!data.options?.length) {
        setShippingError('Nenhuma opção de frete disponível para esse CEP.')
        return
      }
      setShippingOptions(data.options)
      setSelectedShippingId(data.options[0].id)
    } catch (err) {
      console.error(err)
      setShippingError('Não foi possível calcular o frete. Tente novamente.')
    } finally {
      setShippingLoading(false)
    }
  }

  function addressComplete() {
    return (
      address.cep.replace(/\D/g, '').length === 8 &&
      address.street &&
      address.number &&
      address.neighborhood &&
      address.city &&
      address.state
    )
  }

  async function handlePagar() {
    if (!addressComplete() || !selectedShipping) return
    setPaying(true)
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
          shipping: { service_name: selectedShipping.name, price: selectedShipping.price },
          address,
        },
      })
      if (error) throw error

      // Guarda o endereço no perfil pra pré-preencher da próxima compra —
      // best-effort, não bloqueia o checkout se falhar.
      if (user) {
        supabase.from('profiles').update({ addresses: [address] }).eq('id', user.id)
      }

      window.location.href = data.init_point
    } catch (err) {
      console.error(err)
      alert('Não foi possível iniciar o pagamento. Tente novamente.')
    } finally {
      setPaying(false)
    }
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
          <div className="store-form">
            <div className="form-card">
              <h3>Endereço de entrega</h3>
              <div className="form-field">
                <label className="form-field-label" htmlFor="cep">
                  CEP
                </label>
                <input
                  id="cep"
                  type="text"
                  placeholder="00000-000"
                  value={address.cep}
                  onChange={(e) => setAddress({ ...address, cep: e.target.value })}
                  onBlur={handleCepBlur}
                  maxLength={9}
                  required
                />
                {cepLoading && <p className="checkout-hint">Buscando endereço…</p>}
                {cepError && <p className="checkout-error">{cepError}</p>}
              </div>

              <div className="form-field">
                <label className="form-field-label" htmlFor="street">
                  Rua
                </label>
                <input
                  id="street"
                  type="text"
                  value={address.street}
                  onChange={(e) => setAddress({ ...address, street: e.target.value })}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label className="form-field-label" htmlFor="number">
                    Número
                  </label>
                  <input
                    id="number"
                    type="text"
                    value={address.number}
                    onChange={(e) => setAddress({ ...address, number: e.target.value })}
                    required
                  />
                </div>
                <div className="form-field">
                  <label className="form-field-label" htmlFor="complement">
                    Complemento
                  </label>
                  <input
                    id="complement"
                    type="text"
                    value={address.complement}
                    onChange={(e) => setAddress({ ...address, complement: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-field">
                <label className="form-field-label" htmlFor="neighborhood">
                  Bairro
                </label>
                <input
                  id="neighborhood"
                  type="text"
                  value={address.neighborhood}
                  onChange={(e) => setAddress({ ...address, neighborhood: e.target.value })}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label className="form-field-label" htmlFor="city">
                    Cidade
                  </label>
                  <input
                    id="city"
                    type="text"
                    value={address.city}
                    onChange={(e) => setAddress({ ...address, city: e.target.value })}
                    required
                  />
                </div>
                <div className="form-field">
                  <label className="form-field-label" htmlFor="state">
                    UF
                  </label>
                  <input
                    id="state"
                    type="text"
                    value={address.state}
                    maxLength={2}
                    onChange={(e) => setAddress({ ...address, state: e.target.value.toUpperCase() })}
                    required
                  />
                </div>
              </div>
            </div>

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
              <button
                className="seal-button"
                onClick={handlePagar}
                disabled={paying || authLoading || !addressComplete() || !selectedShipping}
              >
                {paying ? 'Redirecionando…' : 'Pagar com Mercado Pago'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
