import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase, type Supplier } from '../../../lib/supabase'

const UNITS = ['un', 'kg', 'g', 'l', 'ml', 'm', 'cm', 'cx', 'pct', 'kWh']

const emptyForm = {
  name: '',
  unit: 'un',
  min_stock: 0,
  cost_price: 0,
  supplier_id: '',
  color: '',
  brand: '',
  notes: '',
  active: true,
}

export default function MaterialForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = Boolean(id)
  const [form, setForm] = useState(emptyForm)
  const [initialStock, setInitialStock] = useState('')
  const [currentStock, setCurrentStock] = useState(0)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase
      .from('suppliers')
      .select('*')
      .order('name')
      .then(({ data }) => setSuppliers(data ?? []))
  }, [])

  useEffect(() => {
    if (!isEditing) return
    supabase
      .from('raw_materials')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) {
          setForm(data)
          setCurrentStock(data.stock)
        }
        setLoading(false)
      })
  }, [id, isEditing])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      ...form,
      supplier_id: form.supplier_id || null,
      color: form.color || null,
      brand: form.brand || null,
    }

    if (isEditing) {
      const { error } = await supabase.from('raw_materials').update(payload).eq('id', id)
      setSaving(false)
      if (error) {
        alert('Não foi possível salvar a matéria-prima.')
        console.error(error)
        return
      }
      navigate('/admin/estoque')
      return
    }

    const { data, error } = await supabase.from('raw_materials').insert(payload).select().single()
    if (error || !data) {
      setSaving(false)
      alert('Não foi possível salvar a matéria-prima.')
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
    navigate('/admin/estoque')
  }

  if (loading) {
    return <p>Carregando matéria-prima…</p>
  }

  return (
    <form onSubmit={handleSave}>
      <div className="admin-page-header">
        <Link to="/admin/estoque" className="admin-back-link">
          ← Matérias-primas
        </Link>
        <h2>{isEditing ? 'Editar matéria-prima' : 'Nova matéria-prima'}</h2>
      </div>

      <div className="form-card">
        <div className="form-field">
          <label className="form-field-label" htmlFor="name">
            Nome
          </label>
          <input
            id="name"
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </div>

        <div className="form-row">
          <div className="form-field">
            <label className="form-field-label" htmlFor="color">
              Cor
            </label>
            <input
              id="color"
              type="text"
              value={form.color ?? ''}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
            />
          </div>
          <div className="form-field">
            <label className="form-field-label" htmlFor="brand">
              Marca
            </label>
            <input
              id="brand"
              type="text"
              value={form.brand ?? ''}
              onChange={(e) => setForm({ ...form, brand: e.target.value })}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label className="form-field-label" htmlFor="unit">
              Unidade
            </label>
            <select id="unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label className="form-field-label" htmlFor="min_stock">
              Estoque mínimo
            </label>
            <input
              id="min_stock"
              type="number"
              step="0.001"
              min="0"
              value={form.min_stock}
              onChange={(e) => setForm({ ...form, min_stock: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label className="form-field-label" htmlFor="cost_price">
              {form.unit === 'kWh' ? 'Custo por hora' : 'Custo unitário'}
            </label>
            <div className="price-field">
              <span className="prefix">R$</span>
              <input
                id="cost_price"
                type="number"
                step="0.01"
                min="0"
                value={form.cost_price}
                onChange={(e) => setForm({ ...form, cost_price: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="form-field">
            <label className="form-field-label" htmlFor="supplier">
              Fornecedor
            </label>
            <select
              id="supplier"
              value={form.supplier_id ?? ''}
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
        </div>

        {isEditing ? (
          <div className="form-field">
            <span className="form-field-label">Estoque atual</span>
            <p style={{ margin: 0 }}>
              {currentStock} {form.unit} — use os botões de Entrada/Saída na lista para ajustar
            </p>
          </div>
        ) : (
          <div className="form-field">
            <label className="form-field-label" htmlFor="initial_stock">
              Estoque inicial ({form.unit})
            </label>
            <input
              id="initial_stock"
              type="number"
              step="0.001"
              min="0"
              value={initialStock}
              onChange={(e) => setInitialStock(e.target.value)}
            />
          </div>
        )}

        <div className="form-field">
          <label className="form-field-label" htmlFor="notes">
            Observações
          </label>
          <textarea
            id="notes"
            value={form.notes ?? ''}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={3}
          />
        </div>

        <div className="toggle-field">
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            <span className="track" />
          </label>
          <div className="toggle-text">
            <strong>Ativo</strong>
            <span>Matérias-primas inativas somem das opções de movimentação</span>
          </div>
        </div>
      </div>

      <div className="form-actions">
        <Link to="/admin/estoque" className="ghost-button">
          Cancelar
        </Link>
        <button className="seal-button" type="submit" disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar matéria-prima'}
        </button>
      </div>
    </form>
  )
}
