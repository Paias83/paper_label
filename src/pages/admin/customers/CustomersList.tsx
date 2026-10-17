import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, type Profile } from '../../../lib/supabase'
import { formatCPF } from '../../../lib/cpf'
import { formatPhone } from '../../../lib/phone'

type CustomerRow = Pick<
  Profile,
  'id' | 'name' | 'email' | 'phone' | 'cpf' | 'registration_completed' | 'created_by_admin' | 'created_at'
>

export default function CustomersList() {
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, name, email, phone, cpf, registration_completed, created_by_admin, created_at')
      .eq('role', 'cliente')
      .order('name')
      .then(({ data }) => setCustomers(data ?? []))
  }, [])

  const term = search.trim().toLowerCase()
  const digits = term.replace(/\D/g, '')
  const filtered = customers.filter(
    (c) =>
      !term ||
      (c.name ?? '').toLowerCase().includes(term) ||
      (c.email ?? '').toLowerCase().includes(term) ||
      (digits.length >= 3 && ((c.cpf ?? '').includes(digits) || (c.phone ?? '').includes(digits)))
  )

  function situation(c: CustomerRow) {
    if (c.registration_completed) return 'Cadastro completo'
    if (c.created_by_admin) return 'Cadastrado pelo painel'
    return 'Cadastro não concluído'
  }

  return (
    <div>
      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <p className="eyebrow">Vendas</p>
          <h2>Clientes</h2>
        </div>
        <Link to="/admin/clientes/novo" className="seal-button">
          + Novo cliente
        </Link>
      </div>

      <div className="list-toolbar">
        <input
          type="search"
          placeholder="Buscar por nome, e-mail, CPF ou telefone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="list-count">
          {filtered.length} {filtered.length === 1 ? 'cliente' : 'clientes'}
        </span>
      </div>

      <div className="list-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Telefone</th>
              <th>CPF</th>
              <th>Situação</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id}>
                <td className="customer-cell">
                  <span className="customer-name">{c.name || '(sem nome)'}</span>
                  {c.email && <span className="customer-email">{c.email}</span>}
                </td>
                <td>{c.phone ? formatPhone(c.phone) : '—'}</td>
                <td>{c.cpf ? formatCPF(c.cpf) : '—'}</td>
                <td>{situation(c)}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <Link to={`/admin/relatorios/pedidos?cliente=${c.id}&de=&ate=`} className="table-action-link">
                    Pedidos
                  </Link>{' '}
                  <Link to={`/admin/clientes/${c.id}`} className="table-action-link">
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-state">
                  Nenhum cliente encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
