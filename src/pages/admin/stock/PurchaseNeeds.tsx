import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, type PurchaseNeed, type RawMaterial, type Supplier } from '../../../lib/supabase'

export default function PurchaseNeeds() {
  const [needs, setNeeds] = useState<PurchaseNeed[]>([])
  const [materials, setMaterials] = useState<RawMaterial[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [showResolved, setShowResolved] = useState(false)

  async function load() {
    const [needsRes, materialsRes, suppliersRes] = await Promise.all([
      supabase.from('purchase_needs').select('*').order('created_at', { ascending: false }),
      supabase.from('raw_materials').select('*'),
      supabase.from('suppliers').select('*'),
    ])
    setNeeds(needsRes.data ?? [])
    setMaterials(materialsRes.data ?? [])
    setSuppliers(suppliersRes.data ?? [])
  }

  useEffect(() => {
    load()
  }, [])

  const material = (id: string) => materials.find((m) => m.id === id)
  const supplierName = (id: string | null | undefined) => suppliers.find((s) => s.id === id)?.name ?? '—'

  async function markResolved(id: string) {
    setNeeds((prev) => prev.map((n) => (n.id === id ? { ...n, status: 'resolvido' } : n)))
    await supabase.from('purchase_needs').update({ status: 'resolvido', resolved_at: new Date().toISOString() }).eq('id', id)
  }

  const filtered = needs.filter((n) => showResolved || n.status === 'pendente')

  return (
    <div>
      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <Link to="/admin/estoque" className="admin-back-link">
            ← Matérias-primas
          </Link>
          <p className="eyebrow">Estoque</p>
          <h2>Necessidades de compra</h2>
        </div>
      </div>

      <div className="list-toolbar">
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: 'var(--charcoal)' }}>
          <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
          Mostrar resolvidas
        </label>
        <span className="list-count">
          {filtered.length} {filtered.length === 1 ? 'item' : 'itens'}
        </span>
      </div>

      <div className="list-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Matéria-prima</th>
              <th>Quantidade faltante</th>
              <th>Fornecedor</th>
              <th>Origem</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((n) => {
              const m = material(n.material_id)
              return (
                <tr key={n.id}>
                  <td>
                    <span className="product-name">{m?.name ?? '—'}</span>
                  </td>
                  <td>
                    <span className="stock-qty stock-low">
                      {n.quantity} {m?.unit ?? ''}
                    </span>
                  </td>
                  <td>{supplierName(m?.supplier_id)}</td>
                  <td>Pedido sem estoque suficiente</td>
                  <td>
                    {n.status === 'pendente' ? (
                      <button type="button" className="table-action-link" onClick={() => markResolved(n.id)}>
                        Marcar como resolvida
                      </button>
                    ) : (
                      <span style={{ color: 'var(--success)', fontSize: '0.85rem' }}>Resolvida</span>
                    )}
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-state">
                  Nenhuma necessidade de compra pendente.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
