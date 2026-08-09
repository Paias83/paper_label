import { useState } from 'react'
import { supabase, type Product } from '../../lib/supabase'

type Props = {
  product: Product
  onClose: () => void
  onSaved: () => void
}

export default function ProductionModal({ product, onClose, onSaved }: Props) {
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const qty = Number(quantity)
    if (!qty || qty <= 0) return

    setSaving(true)
    const { error } = await supabase.from('product_production').insert({
      product_id: product.id,
      quantity: qty,
      note: note || null,
    })
    setSaving(false)
    if (error) {
      alert(
        error.message.includes('Matéria-prima insuficiente')
          ? error.message
          : 'Não foi possível registrar a produção.'
      )
      console.error(error)
      return
    }
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3>Registrar produção</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--charcoal)', marginBottom: 16 }}>
          {product.name} — estoque atual: {product.stock}
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label className="form-field-label" htmlFor="quantity">
              Quantidade produzida
            </label>
            <input
              id="quantity"
              type="number"
              step="1"
              min="1"
              autoFocus
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </div>
          <div className="form-field">
            <label className="form-field-label" htmlFor="note">
              Observação
            </label>
            <input
              id="note"
              type="text"
              placeholder="Ex: lote de 20/03"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--charcoal)' }}>
            A matéria-prima da ficha técnica deste produto será baixada automaticamente do estoque.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
            <button type="button" className="ghost-button" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="seal-button" disabled={saving}>
              {saving ? 'Salvando…' : 'Confirmar produção'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
