import { useState } from 'react'
import { supabase, type RawMaterial, type Supplier } from '../../../lib/supabase'
import CurrencyInput from '../../../components/CurrencyInput'
import { advanceOnEnter } from '../../../lib/formNav'

const UNITS = ['un', 'kg', 'g', 'l', 'ml', 'm', 'cm', 'cx', 'pct', 'kWh', 'hora']

type Props = {
  suppliers: Supplier[]
  onClose: () => void
  onCreated: (material: RawMaterial) => void
}

// Cadastro enxuto de matéria-prima direto de dentro do formulário de produto,
// pra não perder o que já foi digitado. Reaproveita as mesmas regras do
// cadastro completo (índice único de nome+cor+marca, movimentação de estoque
// inicial). O ajuste fino — observações etc. — continua na tela de estoque.
export default function MaterialQuickForm({ suppliers, onClose, onCreated }: Props) {
  const [form, setForm] = useState({
    name: '',
    unit: 'un',
    color: '',
    brand: '',
    min_stock: 0,
    cost_price: 0,
    supplier_id: '',
  })
  const [initialStock, setInitialStock] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)

    const payload = {
      name: form.name.trim(),
      unit: form.unit,
      min_stock: form.min_stock,
      cost_price: form.cost_price,
      supplier_id: form.supplier_id || null,
      color: form.color.trim() || null,
      brand: form.brand.trim() || null,
      active: true,
    }

    const { data, error } = await supabase.from('raw_materials').insert(payload).select().single()
    if (error || !data) {
      setSaving(false)
      alert(
        error?.code === '23505'
          ? 'Já existe uma matéria-prima com esse nome, cor e marca.'
          : 'Não foi possível salvar a matéria-prima.'
      )
      console.error(error)
      return
    }

    const qty = Number(initialStock)
    if (qty > 0) {
      await supabase.from('stock_movements').insert({
        material_id: data.id,
        type: 'entrada',
        quantity: qty,
        unit_cost: form.cost_price || null,
        supplier_id: form.supplier_id || null,
        note: 'Estoque inicial',
      })
    }

    setSaving(false)
    onCreated({ ...data, stock: qty > 0 ? qty : data.stock })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3>Nova matéria-prima</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--charcoal)', marginBottom: 16 }}>
          Ela já entra na lista da ficha técnica ao salvar.
        </p>
        <form onSubmit={handleSubmit} onKeyDown={advanceOnEnter}>
          <div className="form-field">
            <label className="form-field-label" htmlFor="q_name">
              Nome
            </label>
            <input
              id="q_name"
              type="text"
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-field">
              <label className="form-field-label" htmlFor="q_color">
                Cor
              </label>
              <input
                id="q_color"
                type="text"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label className="form-field-label" htmlFor="q_brand">
                Marca
              </label>
              <input
                id="q_brand"
                type="text"
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label className="form-field-label" htmlFor="q_unit">
                Unidade
              </label>
              <select
                id="q_unit"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label className="form-field-label" htmlFor="q_cost">
                {form.unit === 'kWh' || form.unit === 'hora' ? 'Custo por hora' : 'Custo unitário'}
              </label>
              <div className="price-field">
                <span className="prefix">R$</span>
                <CurrencyInput
                  id="q_cost"
                  value={form.cost_price}
                  onChange={(v) => setForm({ ...form, cost_price: v ?? 0 })}
                />
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label className="form-field-label" htmlFor="q_min">
                Estoque mínimo
              </label>
              <input
                id="q_min"
                type="number"
                step="0.001"
                min="0"
                value={form.min_stock}
                onChange={(e) => setForm({ ...form, min_stock: Number(e.target.value) })}
              />
            </div>
            <div className="form-field">
              <label className="form-field-label" htmlFor="q_initial">
                Estoque inicial ({form.unit})
              </label>
              <input
                id="q_initial"
                type="number"
                step="0.001"
                min="0"
                value={initialStock}
                onChange={(e) => setInitialStock(e.target.value)}
              />
            </div>
          </div>

          <div className="form-field">
            <label className="form-field-label" htmlFor="q_supplier">
              Fornecedor
            </label>
            <select
              id="q_supplier"
              value={form.supplier_id}
              onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
            >
              <option value="">Sem fornecedor</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
            <button type="button" className="ghost-button" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="seal-button" disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar matéria-prima'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
