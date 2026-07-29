import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, type RawMaterial, type StockMovement, type Supplier } from '../../../lib/supabase'
import StockMovementModal from './StockMovementModal'

export default function Movements() {
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [materials, setMaterials] = useState<RawMaterial[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [materialFilter, setMaterialFilter] = useState('')
  const [movementType, setMovementType] = useState<'entrada' | 'saida' | null>(null)

  async function load() {
    const [movementsRes, materialsRes, suppliersRes] = await Promise.all([
      supabase.from('stock_movements').select('*').order('created_at', { ascending: false }),
      supabase.from('raw_materials').select('*').order('name'),
      supabase.from('suppliers').select('*').order('name'),
    ])
    setMovements(movementsRes.data ?? [])
    setMaterials(materialsRes.data ?? [])
    setSuppliers(suppliersRes.data ?? [])
  }

  useEffect(() => {
    load()
  }, [])

  const materialName = (id: string) => materials.find((m) => m.id === id)?.name ?? '—'
  const supplierName = (id: string | null) => suppliers.find((s) => s.id === id)?.name ?? '—'

  const filtered = materialFilter ? movements.filter((mv) => mv.material_id === materialFilter) : movements

  return (
    <div>
      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <Link to="/admin/estoque" className="admin-back-link">
            ← Matérias-primas
          </Link>
          <p className="eyebrow">Estoque</p>
          <h2>Movimentações</h2>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="ghost-button" onClick={() => setMovementType('saida')}>
            − Saída
          </button>
          <button type="button" className="seal-button" onClick={() => setMovementType('entrada')}>
            + Entrada
          </button>
        </div>
      </div>

      <div className="list-toolbar">
        <select value={materialFilter} onChange={(e) => setMaterialFilter(e.target.value)} style={{ maxWidth: 280 }}>
          <option value="">Todas as matérias-primas</option>
          {materials.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <span className="list-count">
          {filtered.length} {filtered.length === 1 ? 'movimentação' : 'movimentações'}
        </span>
      </div>

      <div className="list-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Matéria-prima</th>
              <th>Tipo</th>
              <th>Quantidade</th>
              <th>Custo unit.</th>
              <th>Fornecedor</th>
              <th>Observação</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((mv) => (
              <tr key={mv.id}>
                <td>{new Date(mv.created_at).toLocaleString('pt-BR')}</td>
                <td>{materialName(mv.material_id)}</td>
                <td>
                  <span className={`type-badge ${mv.type}`}>{mv.type}</span>
                </td>
                <td className="stock-qty">{mv.quantity}</td>
                <td className="price">
                  {mv.unit_cost != null
                    ? mv.unit_cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                    : '—'}
                </td>
                <td>{mv.supplier_id ? supplierName(mv.supplier_id) : '—'}</td>
                <td>{mv.note || '—'}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="empty-state">
                  Nenhuma movimentação registrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {movementType && (
        <StockMovementModal
          type={movementType}
          materials={materials}
          suppliers={suppliers}
          onClose={() => setMovementType(null)}
          onSaved={() => {
            setMovementType(null)
            load()
          }}
        />
      )}
    </div>
  )
}
