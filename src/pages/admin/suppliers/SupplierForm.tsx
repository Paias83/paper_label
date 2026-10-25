import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { advanceOnEnter } from '../../../lib/formNav'
import { formatDocument, isValidDocument } from '../../../lib/cpf'
import { formatPhone } from '../../../lib/phone'
import { findDuplicateSupplier } from '../../../lib/duplicates'
import { titleCase } from '../../../lib/textCase'

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
        if (data) {
          setForm({
            ...data,
            phone: data.phone ? formatPhone(data.phone) : '',
            document: data.document ? formatDocument(data.document) : '',
          })
        }
        setLoading(false)
      })
  }, [id, isEditing])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const name = titleCase(form.name)
    const document = form.document?.trim() ? formatDocument(form.document) : ''
    const email = form.email?.trim() ?? ''
    const phone = form.phone?.trim() ? formatPhone(form.phone) : ''
    if (!name) {
      alert('Informe o nome do fornecedor.')
      return
    }
    if (document && !isValidDocument(document)) {
      alert('CNPJ/CPF inválido. Confira os números ou deixe o campo em branco.')
      return
    }
    if (phone && phone.replace(/\D/g, '').length < 10) {
      alert('Telefone incompleto — informe com DDD.')
      return
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert('E-mail inválido. Confira o endereço ou deixe o campo em branco.')
      return
    }

    setSaving(true)
    const duplicate = await findDuplicateSupplier({ name, document }, id)
    if (duplicate) {
      setSaving(false)
      alert(duplicate)
      return
    }

    const payload = {
      name,
      contact_name: titleCase(form.contact_name) || null,
      phone: phone || null,
      email: email || null,
      document: document || null,
      notes: form.notes?.trim() || null,
    }
    const query = isEditing
      ? supabase.from('suppliers').update(payload).eq('id', id)
      : supabase.from('suppliers').insert(payload)
    const { error } = await query
    setSaving(false)
    if (error) {
      // Índices únicos do banco (add-duplicate-guards-v2.sql) barram o que escapar da checagem acima.
      alert(
        error.code === '23505'
          ? error.message.includes('document')
            ? 'Esse CNPJ/CPF já está cadastrado em outro fornecedor.'
            : 'Já existe um fornecedor com esse nome.'
          : 'Não foi possível salvar o fornecedor.'
      )
      console.error(error)
      return
    }
    navigate('/admin/fornecedores')
  }

  if (loading) {
    return <p>Carregando fornecedor…</p>
  }

  return (
    <form onSubmit={handleSave} onKeyDown={advanceOnEnter}>
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
            onBlur={() => setForm((f) => ({ ...f, name: titleCase(f.name) }))}
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
              onBlur={() => setForm((f) => ({ ...f, contact_name: titleCase(f.contact_name) }))}
            />
          </div>
          <div className="form-field">
            <label className="form-field-label" htmlFor="document">
              CNPJ / CPF
            </label>
            <input
              id="document"
              type="text"
              inputMode="numeric"
              placeholder="00.000.000/0000-00"
              value={form.document ?? ''}
              onChange={(e) => setForm({ ...form, document: formatDocument(e.target.value) })}
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
              inputMode="tel"
              placeholder="(44)99999-9999"
              value={form.phone ?? ''}
              onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })}
            />
          </div>
          <div className="form-field">
            <label className="form-field-label" htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              type="email"
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
