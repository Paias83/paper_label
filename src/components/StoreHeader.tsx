import { Link, NavLink } from 'react-router-dom'
import { useCart } from '../context/CartContext'

export default function StoreHeader() {
  const { items } = useCart()
  const count = items.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <header className="site-header">
      <Link to="/" className="logo">
        Papelaria de Luxo
      </Link>
      <nav>
        <NavLink to="/catalogo">Catálogo</NavLink>
        <NavLink to="/admin">Admin</NavLink>
        <NavLink to="/entrar">Entrar</NavLink>
        <Link to="/carrinho" className="cart-link" aria-label="Ver carrinho">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M6 8h12l-1 12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 8Z" strokeLinejoin="round" />
            <path d="M9 8V6a3 3 0 0 1 6 0v2" strokeLinecap="round" />
          </svg>
          {count > 0 && <span className="cart-count">{count}</span>}
        </Link>
      </nav>
    </header>
  )
}
