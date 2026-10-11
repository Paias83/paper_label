import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

type Status = 'loading' | 'ready' | 'link-failed'

// Página do link "Esqueci minha senha". O modelo de e-mail "Reset Password"
// aponta para /redefinir-senha?token_hash=...&type=recovery; o token é
// confirmado aqui (verifyOtp), então funciona em qualquer navegador/aparelho —
// mesmo padrão do CompleteRegistration.
export default function ResetPassword() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('loading')
  const [user, setUser] = useState<User | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function init() {
      const params = new URLSearchParams(window.location.search)
      const tokenHash = params.get('token_hash')
      if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
        window.history.replaceState(null, '', window.location.pathname)
        if (error) {
          console.error(error)
          setStatus('link-failed')
          return
        }
      }
      const { data } = await supabase.auth.getSession()
      if (!data.session?.user) {
        setStatus('link-failed')
        return
      }
      setUser(data.session.user)
      setStatus('ready')
    }
    init()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    if (password.length < 8) {
      setMessage('A senha precisa ter pelo menos 8 caracteres.')
      return
    }
    if (password !== confirmPassword) {
      setMessage('As senhas não conferem.')
      return
    }

    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setMessage(
        error.code === 'same_password'
          ? 'A nova senha precisa ser diferente da anterior.'
          : 'Não foi possível salvar a nova senha. Tente novamente.'
      )
      setSaving(false)
      return
    }

    // Mesmo padrão do fim do cadastro: desloga e volta ao login com o e-mail preenchido.
    const email = user!.email
    await supabase.auth.signOut()
    navigate('/entrar', { state: { passwordReset: true, email } })
  }

  if (status === 'loading') {
    return (
      <div className="container" style={{ padding: '40px 24px' }}>
        <p>Carregando…</p>
      </div>
    )
  }

  if (status === 'link-failed') {
    return (
      <div className="container" style={{ padding: '40px 24px', maxWidth: 480 }}>
        <h2>Esse link não funcionou</h2>
        <p>
          O link para criar uma nova senha pode ter expirado ou já ter sido usado. Peça um novo na tela de login, em
          "Esqueci minha senha".
        </p>
        <Link className="seal-button" to="/entrar">
          Ir para o login
        </Link>
      </div>
    )
  }

  return (
    <div className="container" style={{ padding: '40px 24px', maxWidth: 400 }}>
      <div className="store-form">
        <form className="form-card" onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
          <h2 style={{ marginBottom: 0 }}>Criar nova senha</h2>
          <p className="checkout-hint">{user?.email}</p>
          {/* E-mail oculto para o gerenciador de senhas saber de qual conta é a senha. */}
          <input type="email" name="username" autoComplete="username" value={user?.email ?? ''} readOnly hidden />
          <div className="form-field">
            <label className="form-field-label" htmlFor="password">
              Nova senha
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              autoFocus
              required
            />
          </div>
          <div className="form-field">
            <label className="form-field-label" htmlFor="confirmPassword">
              Confirmar nova senha
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
          <button className="seal-button" type="submit" disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar nova senha'}
          </button>
          {message && <p className="checkout-error">{message}</p>}
        </form>
      </div>
    </div>
  )
}
