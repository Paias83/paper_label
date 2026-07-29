import { Link, NavLink } from 'react-router-dom'
import { LogIn, ShoppingBag, UserRound } from 'lucide-react'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'

export default function StoreHeader() {
  const { items } = useCart()
  const { user, loading, signOut } = useAuth()
  const count = items.reduce((sum, i) => sum + i.quantity, 0)

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
