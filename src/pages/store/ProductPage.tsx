import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase, type Product } from '../../lib/supabase'
import { useCart } from '../../context/CartContext'

export default function ProductPage() {
  const { id } = useParams()
  const [product, setProduct] = useState<Product | null>(null)
  const { addItem } = useCart()

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.from('products').select('*').eq('id', id).single()
      if (error) console.error(error)
      else setProduct(data)
    }
    if (id) load()
  }, [id])

  if (!product) return <div className="container">Carregando…</div>

  return (
    <div className="container" style={{ padding: '40px 24px', display: 'flex', gap: 40 }}>
      <img
        src={product.images?.[0] ?? ''}
        alt={product.name}
        style={{ width: 420, aspectRatio: '4/5', objectFit: 'cover' }}
      />
      <div>
        <h1>{product.name}</h1>
        <p className="price" style={{ fontSize: '1.3rem' }}>
          {product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </p>
        <p style={{ color: 'var(--charcoal)', maxWidth: 420 }}>{product.description}</p>
        <button className="seal-button" onClick={() => addItem(product)}>
          Adicionar ao carrinho
        </button>
        {product.stock <= 0 && (
          <p style={{ color: 'var(--danger)', marginTop: 8 }}>Fora de estoque no momento.</p>
        )}
      </div>
    </div>
  )
}
