import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, type Supplier } from '../../../lib/supabase'

export default function SuppliersList() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    supabase
      .from('suppliers')
      .select('*')
      .order('name')
      .then(({ data }) => setSuppliers(data ?? []))
  }, [])

  const filtered = suppliers.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <p className="eyebrow">Estoque</p>
          <h2>Fornecedores</h2>
        </div>
        <Link to="/admin/fornecedores/novo" className="seal-button">
          + Novo fornecedor
        </Link>
      </div>

      <div className="list-toolbar">
        <input
          type="search"
          placeholder="Buscar fornecedor…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="list-count">
          {filtered.length} {filtered.length === 1 ? 'fornecedor' : 'fornecedores'}
        </span>
      </div>

      <div className="list-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Fornecedor</th>
              <th>Contato</th>
              <th>Telefone</th>
              <th>E-mail</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id}>
                <td>
                  <span className="product-name">{s.name}</span>
                </td>
                <td>{s.contact_name || '—'}</td>
                <td>{s.phone || '—'}</td>
                <td>{s.email || '—'}</td>
                <td>
                  <Link to={`/admin/fornecedores/${s.id}`} className="table-action-link">
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-state">
                  Nenhum fornecedor cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
