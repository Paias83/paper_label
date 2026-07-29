import { useEffect, useState } from 'react'
import { Link, NavLink, Navigate, Outlet } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

type Status = 'checking' | 'allowed' | 'denied' | 'anonymous'

export default function AdminLayout() {
  const [status, setStatus] = useState<Status>('checking')

  useEffect(() => {
    let active = true

    async function checkAccess() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        if (active) setStatus('anonymous')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (!active) return
      setStatus(profile?.role === 'admin' ? 'allowed' : 'denied')
    }

    checkAccess()

    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      checkAccess()
    })

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  if (status === 'checking') {
    return (
      <div className="container" style={{ padding: '40px 24px' }}>
        <p>Verificando acesso…</p>
      </div>
    )
  }

  if (status === 'anonymous') {
    return <Navigate to="/entrar" replace />
  }

  if (status === 'denied') {
    return (
      <div className="container" style={{ padding: '40px 24px' }}>
        <h2>Acesso negado</h2>
        <p>Sua conta não tem permissão de administrador.</p>
        <Link to="/">Voltar para a loja</Link>
      </div>
    )
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          Studio Paper
          <span>Administração</span>
        </div>
        <nav className="admin-nav">
          <span className="admin-nav-label">Catálogo</span>
          <NavLink to="/admin" end>
            Produtos
          </NavLink>
          <NavLink to="/admin/produtos/novo">+ Novo produto</NavLink>

          <span className="admin-nav-label">Estoque</span>
          <NavLink to="/admin/estoque">Matérias-primas</NavLink>
          <NavLink to="/admin/fornecedores">Fornecedores</NavLink>

          <span className="admin-nav-label">Vendas</span>
          <NavLink to="/admin/pedidos">Pedidos</NavLink>
        </nav>
        <div className="admin-sidebar-footer">
          <Link to="/">Voltar à loja</Link>
          <button onClick={() => supabase.auth.signOut()}>Sair</button>
        </div>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  )
}
