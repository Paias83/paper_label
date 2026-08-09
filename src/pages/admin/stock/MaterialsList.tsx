import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, type RawMaterial, type Supplier } from '../../../lib/supabase'
import StockMovementModal from './StockMovementModal'

export default function MaterialsList() {
  const [materials, setMaterials] = useState<RawMaterial[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [movement, setMovement] = useState<{ material: RawMaterial; type: 'entrada' | 'saida' } | null>(null)

  async function load() {
    const [materialsRes, suppliersRes] = await Promise.all([
      supabase.from('raw_materials').select('*').order('name'),
      supabase.from('suppliers').select('*').order('name'),
    ])
    setMaterials(materialsRes.data ?? [])
    setSuppliers(suppliersRes.data ?? [])
  }

  useEffect(() => {
    load()
  }, [])

  const supplierName = (id: string | null) => suppliers.find((s) => s.id === id)?.name ?? '—'

  const filtered = materials
    .filter((m) => showInactive || m.active)
    .filter((m) => m.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <p className="eyebrow">Estoque</p>
          <h2>Matérias-primas</h2>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/admin/estoque/movimentacoes" className="ghost-button">
            Movimentações
          </Link>
          <Link to="/admin/estoque/necessidades-de-compra" className="ghost-button">
            Necessidades de compra
          </Link>
          <Link to="/admin/fornecedores/novo" className="ghost-button">
            + Fornecedor
          </Link>
          <Link to="/admin/estoque/novo" className="seal-button">
            + Nova matéria-prima
          </Link>
        </div>
      </div>

      <div className="list-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <input
            type="search"
            placeholder="Buscar matéria-prima…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: 'var(--charcoal)' }}>
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Mostrar inativos
          </label>
        </div>
        <span className="list-count">
          {filtered.length} {filtered.length === 1 ? 'item' : 'itens'}
        </span>
      </div>

      <div className="list-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Matéria-prima</th>
              <th>Estoque</th>
              <th>Custo unit.</th>
              <th>Fornecedor</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => {
              const low = m.stock <= m.min_stock
              return (
                <tr key={m.id}>
                  <td>
                    <span className="product-name">{m.name}</span>
                  </td>
                  <td>
                    <span className={`stock-qty${low ? ' stock-low' : ''}`}>
                      {m.stock} {m.unit}
                    </span>
                    {low && <span className="stock-badge">Estoque baixo</span>}
                  </td>
                  <td className="price">
                    {m.cost_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td>{supplierName(m.supplier_id)}</td>
                  <td>
                    <div className="movement-actions">
                      <button
                        type="button"
                        className="entrada"
                        onClick={() => setMovement({ material: m, type: 'entrada' })}
                      >
                        + Entrada
                      </button>
                      <button
                        type="button"
                        className="saida"
                        onClick={() => setMovement({ material: m, type: 'saida' })}
                      >
                        − Saída
                      </button>
                      <Link to={`/admin/estoque/${m.id}`} className="table-action-link">
                        Editar
                      </Link>
                    </div>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-state">
                  Nenhuma matéria-prima cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {movement && (
        <StockMovementModal
          material={movement.material}
          type={movement.type}
          suppliers={suppliers}
          onClose={() => setMovement(null)}
          onSaved={() => {
            setMovement(null)
            load()
          }}
        />
      )}
    </div>
  )
}
