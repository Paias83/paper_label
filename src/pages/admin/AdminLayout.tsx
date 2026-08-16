import { useEffect, useState } from 'react'
import { Link, NavLink, Navigate, Outlet } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

type Status = 'checking' | 'allowed' | 'denied' | 'anonymous'

export default function AdminLayout() {
  const [status, setStatus] = useState<Status>('checking')
  const [pendingQuotes, setPendingQuotes] = useState(0)
  const [pendingOrders, setPendingOrders] = useState(0)

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

      if (profile?.role === 'admin') {
        // Orçamentos que ainda não receberam proposta — precisam de atenção.
        const { count } = await supabase
          .from('quote_requests')
          .select('id', { count: 'exact', head: true })
          .in('status', ['solicitado', 'em_analise'])
        if (active) setPendingQuotes(count ?? 0)

        // Pedidos novos ou com mudança de status feita pelo sistema, ainda
        // não conferidos pelo admin (ver Orders.tsx / mp-webhook).
        const { count: ordersCount } = await supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .is('admin_seen_at', null)
        if (active) setPendingOrders(ordersCount ?? 0)
      }
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
          <NavLink to="/admin/estoque/necessidades-de-compra">Necessidades de compra</NavLink>
          <NavLink to="/admin/fornecedores">Fornecedores</NavLink>

          <span className="admin-nav-label">Vendas</span>
          <NavLink to="/admin/pedidos">
            Pedidos
            {pendingOrders > 0 && <span className="nav-badge">{pendingOrders}</span>}
          </NavLink>
          <NavLink to="/admin/orcamentos">
            Orçamentos
            {pendingQuotes > 0 && <span className="nav-badge">{pendingQuotes}</span>}
          </NavLink>
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
