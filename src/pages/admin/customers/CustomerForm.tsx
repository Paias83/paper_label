import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase, type ShippingAddress } from '../../../lib/supabase'
import AddressForm, { isAddressComplete } from '../../../components/AddressForm'
import { advanceOnEnter } from '../../../lib/formNav'
import { formatCPF, isValidCPF } from '../../../lib/cpf'
import { formatPhone } from '../../../lib/phone'

const emptyAddress: ShippingAddress = {
  cep: '',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
}

// Cadastro manual de cliente (venda por telefone/presencial). Cria a conta de
// verdade pela Edge Function save-customer, já confirmada e sem senha; quando o
// cliente entrar no site, ele completa o cadastro (senha + aceite dos termos).
export default function CustomerForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = Boolean(id)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [cpf, setCpf] = useState('')
  const [phone, setPhone] = useState('')
  const [hasAddress, setHasAddress] = useState(false)
  const [address, setAddress] = useState<ShippingAddress>(emptyAddress)
  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isEditing) return
    supabase
      .from('profiles')
      .select('name, email, cpf, phone, addresses')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) {
          setName(data.name ?? '')
          setEmail(data.email ?? '')
          setCpf(data.cpf ? formatCPF(data.cpf) : '')
          setPhone(data.phone ? formatPhone(data.phone) : '')
          if (data.addresses?.[0]) {
            setHasAddress(true)
            setAddress({ ...emptyAddress, ...data.addresses[0] })
          }
        }
        setLoading(false)
      })
  }, [id, isEditing])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Informe o nome do cliente.')
      return
    }
    if (cpf && !isValidCPF(cpf)) {
      setError('CPF inválido.')
      return
    }
    if (phone && phone.replace(/\D/g, '').length < 10) {
      setError('Telefone incompleto — informe com DDD.')
      return
    }
    if (hasAddress && !isAddressComplete(address)) {
      setError('Preencha o endereço completo ou desmarque "Informar endereço".')
      return
    }

    setSaving(true)
    const { data, error: fnError } = await supabase.functions.invoke('save-customer', {
      body: {
        ...(isEditing ? { id } : { email }),
        name,
        cpf: cpf || null,
        phone: phone || null,
        address: hasAddress ? address : null,
      },
    })
    setSaving(false)

    if (fnError || data?.error) {
      // Em resposta 4xx/5xx o supabase-js descarta o corpo: a mensagem vem de error.context.
      let message = data?.error ?? 'Não foi possível salvar o cliente.'
      try {
        const body = await (fnError as { context?: Response } | null)?.context?.json()
        if (body?.error) message = body.error
      } catch {
        // corpo não era JSON — fica a mensagem genérica
      }
      setError(message)
      return
    }
    navigate('/admin/clientes')
  }

  if (loading) {
    return <p>Carregando cliente…</p>
  }

  return (
    <form onSubmit={handleSave} onKeyDown={advanceOnEnter}>
      <div className="admin-page-header">
        <Link to="/admin/clientes" className="admin-back-link">
          ← Clientes
        </Link>
        <h2>{isEditing ? 'Editar cliente' : 'Novo cliente'}</h2>
      </div>

      <div className="form-card">
        <div className="form-field">
          <label className="form-field-label" htmlFor="name">
            Nome completo
          </label>
          <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="form-field">
          <label className="form-field-label" htmlFor="email">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isEditing}
            required={!isEditing}
          />
          <p className="checkout-hint">
            {isEditing
              ? 'O e-mail é o login do cliente e não pode ser alterado por aqui.'
              : 'A conta é criada já confirmada, sem enviar e-mail. Quando o cliente entrar no site com este e-mail, ele cria a senha e aceita os termos.'}
          </p>
        </div>
        <div className="form-row">
          <div className="form-field">
            <label className="form-field-label" htmlFor="cpf">
              CPF (opcional)
            </label>
            <input
              id="cpf"
              type="text"
              inputMode="numeric"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => setCpf(formatCPF(e.target.value))}
            />
          </div>
          <div className="form-field">
            <label className="form-field-label" htmlFor="phone">
              Telefone (opcional)
            </label>
            <input
              id="phone"
              type="tel"
              placeholder="(00) 00000-0000"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
            />
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={hasAddress} onChange={(e) => setHasAddress(e.target.checked)} />
          Informar endereço
        </label>
      </div>

      {hasAddress && <AddressForm address={address} onChange={setAddress} title="Endereço" />}

      {error && <p className="checkout-error">{error}</p>}

      <div className="form-actions">
        <Link to="/admin/clientes" className="ghost-button">
          Cancelar
        </Link>
        <button className="seal-button" type="submit" disabled={saving}>
          {saving ? 'Salvando…' : isEditing ? 'Salvar alterações' : 'Cadastrar cliente'}
        </button>
      </div>
    </form>
  )
}
