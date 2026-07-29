import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'

const emptyForm = {
  name: '',
  contact_name: '',
  phone: '',
  email: '',
  document: '',
  notes: '',
}

export default function SupplierForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = Boolean(id)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isEditing) return
    supabase
      .from('suppliers')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) setForm(data)
        setLoading(false)
      })
  }, [id, isEditing])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const query = isEditing
      ? supabase.from('suppliers').update(form).eq('id', id)
      : supabase.from('suppliers').insert(form)
    const { error } = await query
    setSaving(false)
    if (error) {
      alert('Não foi possível salvar o fornecedor.')
      console.error(error)
      return
    }
    navigate('/admin/fornecedores')
  }

  if (loading) {
    return <p>Carregando fornecedor…</p>
  }

  return (
    <form onSubmit={handleSave}>
      <div className="admin-page-header">
        <Link to="/admin/fornecedores" className="admin-back-link">
          ← Fornecedores
        </Link>
        <h2>{isEditing ? 'Editar fornecedor' : 'Novo fornecedor'}</h2>
      </div>

      <div className="form-card">
        <div className="form-field">
          <label className="form-field-label" htmlFor="name">
            Nome / razão social
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
            <label className="form-field-label" htmlFor="contact_name">
              Pessoa de contato
            </label>
            <input
              id="contact_name"
              type="text"
              value={form.contact_name ?? ''}
              onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
            />
          </div>
          <div className="form-field">
            <label className="form-field-label" htmlFor="document">
              CNPJ / CPF
            </label>
            <input
              id="document"
              type="text"
              value={form.document ?? ''}
              onChange={(e) => setForm({ ...form, document: e.target.value })}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-field">
            <label className="form-field-label" htmlFor="phone">
              Telefone
            </label>
            <input
              id="phone"
              type="text"
              value={form.phone ?? ''}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="form-field">
            <label className="form-field-label" htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              type="text"
              value={form.email ?? ''}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
        </div>
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
      </div>

      <div className="form-actions">
        <Link to="/admin/fornecedores" className="ghost-button">
          Cancelar
        </Link>
        <button className="seal-button" type="submit" disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar fornecedor'}
        </button>
      </div>
    </form>
  )
}
