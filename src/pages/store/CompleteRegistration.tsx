import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import type { EmailOtpType, User } from '@supabase/supabase-js'
import { supabase, type ShippingAddress } from '../../lib/supabase'
import AddressForm, { isAddressComplete } from '../../components/AddressForm'
import { formatCPF, isValidCPF } from '../../lib/cpf'

type Status = 'loading' | 'ready' | 'no-session' | 'link-failed' | 'already-complete'

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
  const [acceptedTerms, setAcceptedTerms] = useState(false)

  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function init() {
      const params = new URLSearchParams(window.location.search)

      // Link novo dos e-mails (?token_hash=...&type=email): confirmado aqui, pelo
      // navegador que abriu o link — funciona em qualquer aparelho, ao contrário
      // do ?code= do PKCE, que só vale no navegador onde o e-mail foi digitado.
      // Também não é consumido pelo pré-fetch do Gmail (que não roda o JS da página).
      const tokenHash = params.get('token_hash')
      if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: (params.get('type') as EmailOtpType | null) ?? 'email',
        })
        window.history.replaceState(null, '', window.location.pathname)
        if (error) {
          console.error(error)
          setStatus('link-failed')
          return
        }
      }

      const { data } = await supabase.auth.getSession()
      const sessionUser = data.session?.user ?? null
      if (!sessionUser) {
        // Veio de um link (?code= de outro navegador, expirado ou já usado): explica
        // em vez de voltar calado para o login.
        const cameFromLink = params.has('code') || params.has('error') || params.has('error_description')
        setStatus(cameFromLink || tokenHash ? 'link-failed' : 'no-session')
        return
      }
      setUser(sessionUser)

      const { data: profile } = await supabase
        .from('profiles')
        .select('registration_completed')
        .eq('id', sessionUser.id)
        .single()
      setStatus(profile?.registration_completed ? 'already-complete' : 'ready')
    }
    init()
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
    if (!acceptedTerms) {
      setMessage('Para concluir, aceite os Termos de Uso e a Política de Privacidade.')
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
        registration_completed: true,
        terms_accepted_at: new Date().toISOString(),
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

  if (status === 'link-failed') {
    return (
      <div className="container" style={{ padding: '40px 24px', maxWidth: 480 }}>
        <h2>Esse link não funcionou</h2>
        <p>
          O link de confirmação pode ter expirado, já ter sido usado ou ter sido aberto em outro navegador. Seu e-mail
          continua reservado: é só pedir um link novo e abrir o e-mail <strong>neste mesmo aparelho</strong>.
        </p>
        <Link className="seal-button" to="/entrar">
          Receber um novo link
        </Link>
      </div>
    )
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
          {/* Diz ao gerenciador de senhas do navegador de qual e-mail é a senha —
              sem isso o Chrome oferece "atualizar senha" da última conta salva. */}
          <input type="email" name="username" autoComplete="username" value={user?.email ?? ''} readOnly hidden />
          <div className="form-row">
            <div className="form-field">
              <label className="form-field-label" htmlFor="password">
                Senha
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
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
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
          </div>
        </div>

        <label className="terms-accept">
          <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} />
          <span>
            Li e aceito os{' '}
            <Link to="/termos" target="_blank" rel="noreferrer">
              Termos de Uso e Compra
            </Link>{' '}
            e a{' '}
            <Link to="/privacidade" target="_blank" rel="noreferrer">
              Política de Privacidade
            </Link>
            .
          </span>
        </label>

        {message && <p className="checkout-error">{message}</p>}

        <button className="seal-button" type="submit" disabled={saving}>
          {saving ? 'Salvando…' : 'Concluir cadastro'}
        </button>
      </form>
    </div>
  )
}
