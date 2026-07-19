import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'entrar' | 'cadastrar'>('entrar')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    const action =
      mode === 'entrar'
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password })

    const { error } = await action
    if (error) setMessage(error.message)
    else if (mode === 'cadastrar') setMessage('Verifique seu e-mail para confirmar o cadastro.')
    else window.location.href = '/'
  }

  return (
    <div className="container" style={{ padding: '40px 24px', maxWidth: 360 }}>
      <h2>{mode === 'entrar' ? 'Entrar' : 'Criar conta'}</h2>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
        <input
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button className="seal-button" type="submit">
          {mode === 'entrar' ? 'Entrar' : 'Cadastrar'}
        </button>
      </form>
      {message && <p style={{ color: 'var(--wine)' }}>{message}</p>}
      <button
        onClick={() => setMode(mode === 'entrar' ? 'cadastrar' : 'entrar')}
        style={{ background: 'none', border: 'none', textDecoration: 'underline', marginTop: 12 }}
      >
        {mode === 'entrar' ? 'Ainda não tem conta? Cadastre-se' : 'Já tem conta? Entrar'}
      </button>
    </div>
  )
}
