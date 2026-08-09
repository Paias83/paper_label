import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase, type Product } from '../../lib/supabase'
import { useCart } from '../../context/CartContext'

export default function ProductPage() {
  const { id } = useParams()
  const [product, setProduct] = useState<Product | null>(null)
  const [selectedImage, setSelectedImage] = useState(0)
  const { addItem } = useCart()

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.from('products').select('*').eq('id', id).single()
      if (error) console.error(error)
      else setProduct(data)
      setSelectedImage(0)
    }
    if (id) load()
  }, [id])

  if (!product) return <div className="container">Carregando…</div>

  const images = product.images?.length ? product.images : ['']

  return (
    <div className="container" style={{ padding: '40px 24px', display: 'flex', gap: 40 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <img
          src={images[selectedImage]}
          alt={product.name}
          style={{ width: 320, aspectRatio: '4/5', objectFit: 'cover' }}
        />
        {images.length > 1 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {images.map((img, index) => (
              <img
                key={index}
                src={img}
                alt={`${product.name} ${index + 1}`}
                onClick={() => setSelectedImage(index)}
                style={{
                  width: 72,
                  height: 72,
                  objectFit: 'cover',
                  cursor: 'pointer',
                  border:
                    index === selectedImage
                      ? '2px solid var(--charcoal)'
                      : '2px solid transparent',
                  opacity: index === selectedImage ? 1 : 0.7,
                }}
              />
            ))}
          </div>
        )}
      </div>
      <div>
        <h1>{product.name}</h1>
        <p className="price" style={{ fontSize: '1.3rem' }}>
          {product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </p>
        <p style={{ color: 'var(--charcoal)', maxWidth: 420, whiteSpace: 'pre-line' }}>
          {product.description}
        </p>
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
