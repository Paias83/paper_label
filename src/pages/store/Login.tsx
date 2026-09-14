import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

type Step = 'email' | 'senha' | 'aguardando'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation() as { state?: { justRegistered?: boolean; email?: string } }

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [info, setInfo] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [existingAccount, setExistingAccount] = useState(false)

  useEffect(() => {
    if (location.state?.justRegistered && location.state.email) {
      setEmail(location.state.email)
      setStep('senha')
      setInfo('Cadastro concluído! Entre com a senha que você acabou de criar.')
    }
  }, [location.state])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  const redirectOptions = { emailRedirectTo: `${window.location.origin}/completar-cadastro` }

  // E-mail novo: signUp cria a conta e dispara o template "Confirm signup".
  async function sendNewAccountConfirmation() {
    const { error } = await supabase.auth.signUp({
      email,
      password: crypto.randomUUID(),
      options: redirectOptions,
    })
    if (error) {
      setMessage(error.message)
      return false
    }
    setStep('aguardando')
    setCooldown(30)
    return true
  }

  // Conta já existe mas o cadastro não foi concluído: usamos magic link em vez
  // de signUp, porque signUp não reenvia nada se o e-mail já foi confirmado
  // (ex: cliente confirmou e fechou a aba antes de terminar o formulário).
  async function sendContinueRegistrationLink() {
    const { error } = await supabase.auth.signInWithOtp({ email, options: redirectOptions })
    if (error) {
      setMessage(error.message)
      return false
    }
    setStep('aguardando')
    setCooldown(30)
    return true
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    setInfo('')

    const trimmed = email.trim().toLowerCase()
    if (!EMAIL_REGEX.test(trimmed)) {
      setMessage('Digite um e-mail válido.')
      return
    }
    setEmail(trimmed)
    setLoading(true)

    const { data, error } = await supabase.rpc('email_status', { p_email: trimmed })
    if (error) {
      setMessage('Não foi possível verificar o e-mail. Tente novamente.')
      setLoading(false)
      return
    }

    const status = data?.[0] as { exists_account: boolean; complete: boolean } | undefined
    if (status?.complete) {
      setStep('senha')
      setLoading(false)
      return
    }

    setExistingAccount(Boolean(status?.exists_account))
    await (status?.exists_account ? sendContinueRegistrationLink() : sendNewAccountConfirmation())
    setLoading(false)
  }

  async function handleResend() {
    if (cooldown > 0) return
    setMessage('')
    setLoading(true)
    await (existingAccount ? sendContinueRegistrationLink() : sendNewAccountConfirmation())
    setLoading(false)
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setMessage('E-mail ou senha inválidos.')
      setLoading(false)
      return
    }
    navigate('/')
  }

  function backToEmail() {
    setStep('email')
    setPassword('')
    setMessage('')
    setInfo('')
  }

  return (
    <div className="container" style={{ padding: '40px 24px', maxWidth: 400 }}>
      <div className="store-form">
        <div className="form-card">
          <h2 style={{ marginBottom: 0 }}>
            {step === 'senha' ? 'Entrar' : 'Entrar ou criar conta'}
          </h2>

          {info && <p className="checkout-hint">{info}</p>}

          {step === 'email' && (
            <form onSubmit={handleEmailSubmit} style={{ display: 'grid', gap: 12 }}>
              <div className="form-field">
                <label className="form-field-label" htmlFor="email">
                  E-mail
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <button className="seal-button" type="submit" disabled={loading}>
                {loading ? 'Verificando…' : 'Continuar'}
              </button>
            </form>
          )}

          {step === 'senha' && (
            <form onSubmit={handlePasswordSubmit} style={{ display: 'grid', gap: 12 }}>
              <p className="checkout-hint">{email}</p>
              <div className="form-field">
                <label className="form-field-label" htmlFor="password">
                  Senha
                </label>
                <input
                  id="password"
                  type="password"
                  placeholder="Sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <button className="seal-button" type="submit" disabled={loading}>
                {loading ? 'Entrando…' : 'Entrar'}
              </button>
              <button
                type="button"
                onClick={backToEmail}
                style={{ background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer' }}
              >
                Usar outro e-mail
              </button>
            </form>
          )}

          {step === 'aguardando' && (
            <div style={{ display: 'grid', gap: 12 }}>
              <p>
                Enviamos um link de confirmação para <strong>{email}</strong>. Clique nele para continuar
                seu cadastro.
              </p>
              <button className="seal-button" type="button" onClick={handleResend} disabled={loading || cooldown > 0}>
                {cooldown > 0 ? `Reenviar e-mail (${cooldown}s)` : 'Reenviar e-mail'}
              </button>
              <button
                type="button"
                onClick={backToEmail}
                style={{ background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer' }}
              >
                Usar outro e-mail
              </button>
            </div>
          )}

          {message && <p className="checkout-error">{message}</p>}
        </div>
      </div>
    </div>
  )
}
