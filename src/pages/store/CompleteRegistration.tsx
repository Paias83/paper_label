import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase, type ShippingAddress } from '../../lib/supabase'
import AddressForm, { isAddressComplete } from '../../components/AddressForm'
import { formatCPF, isValidCPF } from '../../lib/cpf'

type Status = 'loading' | 'ready' | 'no-session' | 'already-complete'

const emptyAddress: ShippingAddress = {
  cep: '',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
}

function formatPhone(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 11)
  return digits
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d{1,4})$/, '$1-$2')
}

export default function CompleteRegistration() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('loading')
  const [user, setUser] = useState<User | null>(null)

  const [name, setName] = useState('')
  const [cpf, setCpf] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState<ShippingAddress>(emptyAddress)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const sessionUser = data.session?.user ?? null
      if (!sessionUser) {
        setStatus('no-session')
        return
      }
      setUser(sessionUser)

      const { data: profile } = await supabase.from('profiles').select('cpf').eq('id', sessionUser.id).single()
      setStatus(profile?.cpf ? 'already-complete' : 'ready')
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')

    if (!name.trim()) {
      setMessage('Informe seu nome completo.')
      return
    }
    if (!isValidCPF(cpf)) {
      setMessage('CPF inválido.')
      return
    }
    if (phone.replace(/\D/g, '').length < 10) {
      setMessage('Informe um telefone válido, com DDD.')
      return
    }
    if (!isAddressComplete(address)) {
      setMessage('Preencha o endereço completo.')
      return
    }
    if (password.length < 8) {
      setMessage('A senha precisa ter pelo menos 8 caracteres.')
      return
    }
    if (password !== confirmPassword) {
      setMessage('As senhas não conferem.')
      return
    }

    setSaving(true)

    const { error: passwordError } = await supabase.auth.updateUser({ password })
    if (passwordError) {
      setMessage(passwordError.message)
      setSaving(false)
      return
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        name: name.trim(),
        cpf: cpf.replace(/\D/g, ''),
        phone: phone.replace(/\D/g, ''),
        addresses: [address],
      })
      .eq('id', user!.id)

    if (profileError) {
      setMessage(
        profileError.code === '23505' ? 'Este CPF já está cadastrado em outra conta.' : profileError.message
      )
      setSaving(false)
      return
    }

    const email = user!.email
    await supabase.auth.signOut()
    navigate('/entrar', { state: { justRegistered: true, email } })
  }

  if (status === 'loading') {
    return (
      <div className="container" style={{ padding: '40px 24px' }}>
        <p>Carregando…</p>
      </div>
    )
  }

  if (status === 'no-session') {
    return <Navigate to="/entrar" replace />
  }

  if (status === 'already-complete') {
    return (
      <div className="container" style={{ padding: '40px 24px' }}>
        <h2>Cadastro já concluído</h2>
        <p>Sua conta já está completa. Faça login normalmente.</p>
        <a className="seal-button" href="/entrar">
          Ir para o login
        </a>
      </div>
    )
  }

  return (
    <div className="container" style={{ padding: '40px 24px', maxWidth: 640 }}>
      <h2>Complete seu cadastro</h2>
      <p className="checkout-hint" style={{ marginBottom: 'var(--space-3)' }}>
        {user?.email}
      </p>

      <form onSubmit={handleSubmit} className="store-form" style={{ display: 'grid', gap: 'var(--space-3)' }}>
        <div className="form-card">
          <h3>Dados pessoais</h3>
          <div className="form-field">
            <label className="form-field-label" htmlFor="name">
              Nome completo
            </label>
            <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="form-row">
            <div className="form-field">
              <label className="form-field-label" htmlFor="cpf">
                CPF
              </label>
              <input
                id="cpf"
                type="text"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(e) => setCpf(formatCPF(e.target.value))}
                maxLength={14}
                required
              />
            </div>
            <div className="form-field">
              <label className="form-field-label" htmlFor="phone">
                Telefone
              </label>
              <input
                id="phone"
                type="tel"
                placeholder="(00) 00000-0000"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                maxLength={15}
                required
              />
            </div>
          </div>
        </div>

        <AddressForm address={address} onChange={setAddress} />

        <div className="form-card">
          <h3>Senha de acesso</h3>
          <div className="form-row">
            <div className="form-field">
              <label className="form-field-label" htmlFor="password">
                Senha
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
            <div className="form-field">
              <label className="form-field-label" htmlFor="confirmPassword">
                Confirmar senha
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
          </div>
        </div>

        {message && <p className="checkout-error">{message}</p>}

        <button className="seal-button" type="submit" disabled={saving}>
          {saving ? 'Salvando…' : 'Concluir cadastro'}
        </button>
      </form>
    </div>
  )
}
