import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { LogIn, ShoppingBag, UserRound } from 'lucide-react'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function StoreHeader() {
  const { items } = useCart()
  const { user, loading, signOut } = useAuth()
  const count = items.reduce((sum, i) => sum + i.quantity, 0)
  const [pendingQuotes, setPendingQuotes] = useState(0)

  useEffect(() => {
    if (!user) {
      setPendingQuotes(0)
      return
    }
    // Propostas que o cliente ainda não respondeu — precisam de atenção.
    supabase
      .from('quote_requests')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'proposta_enviada')
      .then(({ count }) => setPendingQuotes(count ?? 0))
  }, [user])

  return (
    <header className="site-header">
      <nav>
        <NavLink to="/admin">Admin</NavLink>
      </nav>
      <Link to="/" className="logo">
        Studio Paper
      </Link>
      <div className="header-actions">
        {!loading && user ? (
          <div className="header-account">
            <UserRound size={18} />
            <span>{user.email?.split('@')[0]}</span>
            <Link to="/meus-orcamentos" className="header-action" style={{ fontSize: '0.85rem' }}>
              Meus orçamentos
              {pendingQuotes > 0 && <span className="nav-badge">{pendingQuotes}</span>}
            </Link>
            <button className="header-signout" onClick={() => signOut()}>
              Sair
            </button>
          </div>
        ) : (
          <Link to="/entrar" className="header-action">
            <LogIn size={18} />
            Entrar / Cadastrar
          </Link>
        )}
        <Link to="/carrinho" className="cart-link" aria-label="Ver carrinho">
          <ShoppingBag size={20} strokeWidth={1.6} />
          {count > 0 && <span className="cart-count">{count}</span>}
        </Link>
      </div>
    </header>
  )
}
