import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// Folhas A4 do admin ficam fora do AdminLayout (sem menu lateral), então
// checam o papel de admin por conta própria antes de mostrar o conteúdo.
export default function AdminPrintGate({ children }: { children: ReactNode }) {
  const [access, setAccess] = useState<'checking' | 'ok' | 'denied'>('checking')

  useEffect(() => {
    async function run() {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        setAccess('denied')
        return
      }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
      setAccess(profile?.role === 'admin' ? 'ok' : 'denied')
    }
    run()
  }, [])

  if (access === 'checking') return <p style={{ padding: 40 }}>Verificando acesso…</p>
  if (access === 'denied') {
    return (
      <div style={{ padding: 40 }}>
        <h2>Acesso restrito</h2>
        <p>
          É preciso estar logado como administrador. <Link to="/entrar">Entrar</Link>
        </p>
      </div>
    )
  }
  return <>{children}</>
}
