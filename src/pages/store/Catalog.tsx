import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, type Product } from '../../lib/supabase'

export default function Catalog() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: false })

      if (error) console.error(error)
      else setProducts(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="container">Carregando catálogo…</div>

  return (
    <div className="container" style={{ padding: '40px 24px' }}>
      <h2>Catálogo</h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 24,
        }}
      >
        {products.map((p) => (
          <Link
            key={p.id}
            to={`/produto/${p.id}`}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <div
              style={{
                background: 'var(--paper-raised)',
                border: '1px solid var(--hairline)',
                padding: 12,
              }}
            >
              <img
                src={p.images?.[0] ?? ''}
                alt={p.name}
                style={{ width: '100%', aspectRatio: '4/5', objectFit: 'cover' }}
              />
              <h3 style={{ fontSize: '1.05rem', margin: '8px 0 4px' }}>{p.name}</h3>
              <span className="price">
                {p.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
          </Link>
        ))}
        {products.length === 0 && <p>Nenhum produto cadastrado ainda.</p>}
      </div>
    </div>
  )
}
