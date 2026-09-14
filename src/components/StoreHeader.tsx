import { useEffect, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { ChevronDown, LogIn, ShoppingBag, UserRound } from 'lucide-react'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function StoreHeader() {
  const { items } = useCart()
  const { user, profile, loading, signOut } = useAuth()
  const count = items.reduce((sum, i) => sum + i.quantity, 0)
  const [pendingQuotes, setPendingQuotes] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
          <div className="header-account" ref={menuRef}>
            <button className="header-account-trigger" onClick={() => setMenuOpen((open) => !open)}>
              <UserRound size={18} />
              <span>Olá, {profile?.name || user.email}</span>
              {pendingQuotes > 0 && <span className="nav-badge">{pendingQuotes}</span>}
              <ChevronDown size={14} />
            </button>
            {menuOpen && (
              <div className="header-account-menu">
                <Link
                  to="/meus-orcamentos"
                  className="header-account-menu-item"
                  onClick={() => setMenuOpen(false)}
                >
                  Meus orçamentos
                  {pendingQuotes > 0 && <span className="nav-badge">{pendingQuotes}</span>}
                </Link>
                <button
                  className="header-account-menu-item"
                  onClick={() => {
                    setMenuOpen(false)
                    signOut()
                  }}
                >
                  Sair
                </button>
              </div>
            )}
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
