import { useState } from 'react'
import { supabase, type RawMaterial, type Supplier } from '../../../lib/supabase'

type Props = {
  material?: RawMaterial | null
  materials?: RawMaterial[]
  type: 'entrada' | 'saida'
  suppliers: Supplier[]
  onClose: () => void
  onSaved: () => void
}

export default function StockMovementModal({
  material: fixedMaterial,
  materials = [],
  type,
  suppliers,
  onClose,
  onSaved,
}: Props) {
  const [materialId, setMaterialId] = useState(fixedMaterial?.id ?? '')
  const [quantity, setQuantity] = useState('')
  const [unitCost, setUnitCost] = useState(fixedMaterial?.cost_price ? String(fixedMaterial.cost_price) : '')
  const [supplierId, setSupplierId] = useState(fixedMaterial?.supplier_id ?? '')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const isEntrada = type === 'entrada'
  const material = fixedMaterial ?? materials.find((m) => m.id === materialId) ?? null

  function handleMaterialChange(id: string) {
    setMaterialId(id)
    const m = materials.find((mat) => mat.id === id)
    setUnitCost(m?.cost_price ? String(m.cost_price) : '')
    setSupplierId(m?.supplier_id ?? '')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!material) return
    const qty = Number(quantity)
    if (!qty || qty <= 0) return

    if (!isEntrada && qty > material.stock) {
      alert(`Quantidade maior que o estoque disponível (${material.stock} ${material.unit}).`)
      return
    }

    setSaving(true)
    const { error } = await supabase.from('stock_movements').insert({
      material_id: material.id,
      type,
      quantity: qty,
      unit_cost: isEntrada && unitCost ? Number(unitCost) : null,
      supplier_id: isEntrada && supplierId ? supplierId : null,
      note: note || null,
    })
    setSaving(false)
    if (error) {
      alert('Não foi possível registrar a movimentação.')
      console.error(error)
      return
    }
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3>{isEntrada ? 'Entrada de estoque' : 'Saída de estoque'}</h3>
        {material && (
          <p style={{ fontSize: '0.85rem', color: 'var(--charcoal)', marginBottom: 16 }}>
            Estoque atual: {material.stock} {material.unit}
          </p>
        )}
        <form onSubmit={handleSubmit}>
          {!fixedMaterial && (
            <div className="form-field">
              <label className="form-field-label" htmlFor="material">
                Matéria-prima
              </label>
              <select
                id="material"
                autoFocus
                value={materialId}
                onChange={(e) => handleMaterialChange(e.target.value)}
                required
              >
                <option value="">Selecione…</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="form-field">
            <label className="form-field-label" htmlFor="quantity">
              Quantidade {material ? `(${material.unit})` : ''}
            </label>
            <input
              id="quantity"
              type="number"
              step="0.001"
              min="0"
              autoFocus={Boolean(fixedMaterial)}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </div>
          {isEntrada && (
            <>
              <div className="form-field">
                <label className="form-field-label" htmlFor="unit_cost">
                  Custo unitário (R$)
                </label>
                <input
                  id="unit_cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                />
              </div>
              <div className="form-field">
                <label className="form-field-label" htmlFor="supplier">
                  Fornecedor
                </label>
                <select id="supplier" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                  <option value="">Sem fornecedor</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
          <div className="form-field">
            <label className="form-field-label" htmlFor="note">
              Observação
            </label>
            <input
              id="note"
              type="text"
              placeholder={isEntrada ? 'Ex: NF 1234' : 'Ex: consumo da produção'}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
            <button type="button" className="ghost-button" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="seal-button" disabled={saving || !material}>
              {saving ? 'Salvando…' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
