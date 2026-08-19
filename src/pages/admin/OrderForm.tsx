import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, type Product, type ShippingAddress } from '../../lib/supabase'
import CurrencyInput from '../../components/CurrencyInput'
import AddressForm from '../../components/AddressForm'

type ItemRow = { product_id: string; quantity: number; price_at_purchase: number }

const emptyAddress: ShippingAddress = {
  cep: '',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
}

export default function OrderForm() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [customerName, setCustomerName] = useState('')
  const [items, setItems] = useState<ItemRow[]>([{ product_id: '', quantity: 1, price_at_purchase: 0 }])
  const [shippingType, setShippingType] = useState<'entrega' | 'retirada'>('retirada')
  const [address, setAddress] = useState<ShippingAddress>(emptyAddress)
  const [shippingService, setShippingService] = useState('')
  const [shippingCost, setShippingCost] = useState(0)
  const [status, setStatus] = useState<'pago' | 'pendente'>('pago')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('products')
      .select('*')
      .order('name')
      .then(({ data }) => setProducts(data ?? []))
  }, [])

  function addItem() {
    setItems((rows) => [...rows, { product_id: '', quantity: 1, price_at_purchase: 0 }])
  }

  function updateItem(index: number, changes: Partial<ItemRow>) {
    setItems((rows) => rows.map((row, i) => (i === index ? { ...row, ...changes } : row)))
  }

  function selectProduct(index: number, productId: string) {
    const product = products.find((p) => p.id === productId)
    updateItem(index, { product_id: productId, price_at_purchase: product?.price ?? 0 })
  }

  function removeItem(index: number) {
    setItems((rows) => rows.filter((_, i) => i !== index))
  }

  const itemsTotal = items.reduce((sum, row) => sum + row.price_at_purchase * row.quantity, 0)
  const total = itemsTotal + (shippingType === 'entrega' ? shippingCost : 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const validItems = items.filter((row) => row.product_id && row.quantity > 0)
    if (validItems.length === 0) {
      setError('Adicione ao menos um item ao pedido.')
      return
    }
    if (shippingType === 'entrega' && !address.cep) {
      setError('Endereço é obrigatório para entrega.')
      return
    }

    setSaving(true)
    const { data, error: fnError } = await supabase.functions.invoke('create-manual-order', {
      body: {
        customer_name: customerName.trim() || null,
        items: validItems,
        shipping_type: shippingType,
        address: shippingType === 'entrega' ? address : null,
        shipping_cost: shippingType === 'entrega' ? shippingCost : 0,
        shipping_service: shippingType === 'entrega' ? shippingService.trim() || null : null,
        status,
      },
    })
    setSaving(false)

    if (fnError || data?.error) {
      setError(data?.error ?? 'Não foi possível criar o pedido.')
      return
    }
    navigate('/admin/pedidos')
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="admin-page-header">
        <Link to="/admin/pedidos" className="admin-back-link">
          ← Pedidos
        </Link>
        <h2>Novo pedido manual</h2>
      </div>

      <div className="form-card">
        <div className="form-field">
          <label className="form-field-label" htmlFor="customer_name">
            Cliente (opcional)
          </label>
          <input
            id="customer_name"
            type="text"
            placeholder="Nome ou referência do cliente"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
        </div>
      </div>

      <div className="form-card">
        <h3>Itens do pedido</h3>
        {items.map((row, index) => {
          const lineTotal = row.price_at_purchase * row.quantity
          return (
            <div key={index} className="form-row recipe-row">
              <div className="form-field recipe-field-material">
                <label className="form-field-label">Produto</label>
                <select value={row.product_id} onChange={(e) => selectProduct(index, e.target.value)}>
                  <option value="">Selecione…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.active ? p.name : `${p.name} (inativo)`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field recipe-field-narrow">
                <label className="form-field-label">Qtd.</label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={row.quantity}
                  onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })}
                />
              </div>
              <div className="form-field" style={{ flex: '0 0 140px' }}>
                <label className="form-field-label">Preço unit.</label>
                <div className="price-field">
                  <span className="prefix">R$</span>
                  <CurrencyInput
                    value={row.price_at_purchase}
                    onChange={(v) => updateItem(index, { price_at_purchase: v ?? 0 })}
                  />
                </div>
              </div>
              <div className="form-field recipe-field-cost">
                <label className="form-field-label">Subtotal</label>
                <p style={{ margin: '0 0 8px' }}>
                  {lineTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
              <button
                type="button"
                className="icon-button recipe-field-remove"
                aria-label="Remover item"
                title="Remover item"
                onClick={() => removeItem(index)}
              >
                ×
              </button>
            </div>
          )
        })}
        <button type="button" className="ghost-button small" onClick={addItem}>
          + Adicionar item
        </button>
      </div>

      <div className="form-card">
        <h3>Entrega</h3>
        <div className="form-field">
          <label className="form-field-label" htmlFor="shipping_type">
            Tipo
          </label>
          <select
            id="shipping_type"
            value={shippingType}
            onChange={(e) => setShippingType(e.target.value as 'entrega' | 'retirada')}
          >
            <option value="retirada">Retirada no local</option>
            <option value="entrega">Entrega</option>
          </select>
        </div>
        {shippingType === 'entrega' && (
          <>
            <AddressForm address={address} onChange={setAddress} title="Endereço de entrega" />
            <div className="form-row">
              <div className="form-field">
                <label className="form-field-label" htmlFor="shipping_service">
                  Serviço de frete
                </label>
                <input
                  id="shipping_service"
                  type="text"
                  placeholder="Ex: Combinado, Correios PAC…"
                  value={shippingService}
                  onChange={(e) => setShippingService(e.target.value)}
                />
              </div>
              <div className="form-field">
                <label className="form-field-label" htmlFor="shipping_cost">
                  Custo do frete
                </label>
                <div className="price-field">
                  <span className="prefix">R$</span>
                  <CurrencyInput id="shipping_cost" value={shippingCost} onChange={(v) => setShippingCost(v ?? 0)} />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="form-card">
        <h3>Pagamento</h3>
        <div className="form-field">
          <label className="form-field-label" htmlFor="status">
            Status do pedido
          </label>
          <select id="status" value={status} onChange={(e) => setStatus(e.target.value as 'pago' | 'pendente')}>
            <option value="pago">Pago — dá baixa de estoque e matéria-prima na hora</option>
            <option value="pendente">Pendente — aguardando pagamento</option>
          </select>
        </div>
        <div className="form-field" style={{ marginTop: 8 }}>
          <span className="form-field-label">Total do pedido</span>
          <p style={{ margin: 0, fontWeight: 600 }}>
            {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>
      </div>

      {error && <p className="checkout-error">{error}</p>}

      <div className="form-actions">
        <Link to="/admin/pedidos" className="ghost-button">
          Cancelar
        </Link>
        <button className="seal-button" type="submit" disabled={saving}>
          {saving ? 'Salvando…' : 'Criar pedido'}
        </button>
      </div>
    </form>
  )
}
