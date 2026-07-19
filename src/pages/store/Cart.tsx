import { Link } from 'react-router-dom'
import { useCart } from '../../context/CartContext'

export default function Cart() {
  const { items, setQuantity, removeItem, total } = useCart()

  if (items.length === 0) {
    return (
      <div className="container" style={{ padding: '40px 24px' }}>
        <h2>Seu carrinho está vazio</h2>
        <Link to="/catalogo" className="seal-button">
          Ver produtos
        </Link>
      </div>
    )
  }

  return (
    <div className="container" style={{ padding: '40px 24px' }}>
      <h2>Carrinho</h2>
      {items.map((item) => (
        <div
          key={item.product.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            borderBottom: '1px solid var(--hairline)',
            padding: '12px 0',
          }}
        >
          <img
            src={item.product.images?.[0] ?? ''}
            alt={item.product.name}
            style={{ width: 64, height: 80, objectFit: 'cover' }}
          />
          <div style={{ flex: 1 }}>
            <strong>{item.product.name}</strong>
            <div className="price">
              {item.product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          </div>
          <input
            type="number"
            min={1}
            value={item.quantity}
            onChange={(e) => setQuantity(item.product.id, Number(e.target.value))}
            style={{ width: 56 }}
          />
          <button onClick={() => removeItem(item.product.id)}>Remover</button>
        </div>
      ))}
      <p style={{ marginTop: 16 }}>
        Total:{' '}
        <strong className="price">
          {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </strong>
      </p>
      <Link to="/checkout" className="seal-button">
        Finalizar compra
      </Link>
    </div>
  )
}
