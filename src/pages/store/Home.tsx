import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ShoppingBag, Wand2 } from 'lucide-react'
import { supabase, type Category, type Product } from '../../lib/supabase'
import FeaturedCarousel from '../../components/FeaturedCarousel'
import CategoryNav from '../../components/CategoryNav'
import { useCart } from '../../context/CartContext'

export default function Home() {
  const [searchParams] = useSearchParams()
  const categorySlug = searchParams.get('categoria')
  const { addItem } = useCart()

  const [categories, setCategories] = useState<Category[]>([])
  const [carouselProducts, setCarouselProducts] = useState<Product[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadCategories() {
      const { data, error } = await supabase.from('categories').select('*').order('name')
      if (error) console.error(error)
      setCategories(data ?? [])
    }
    loadCategories()
  }, [])

  useEffect(() => {
    async function loadCarousel() {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .eq('featured', true)
        .order('created_at', { ascending: false })
        .limit(8)
      if (error) console.error(error)
      setCarouselProducts(data ?? [])
    }
    loadCarousel()
  }, [])

  useEffect(() => {
    async function loadProducts() {
      setLoading(true)

      if (categorySlug) {
        const category = categories.find((c) => c.slug === categorySlug)
        if (!category) {
          setProducts([])
          setLoading(false)
          return
        }
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('active', true)
          .eq('category_id', category.id)
          .order('created_at', { ascending: false })
        if (error) console.error(error)
        setProducts(data ?? [])
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .eq('featured', true)
        .order('created_at', { ascending: false })
        .limit(4)

      if (error) console.error(error)

      if (data && data.length > 0) {
        setProducts(data)
        setLoading(false)
        return
      }

      const { data: recent, error: recentError } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(4)

      if (recentError) console.error(recentError)
      setProducts(recent ?? [])
      setLoading(false)
    }

    if (categorySlug && categories.length === 0) return
    loadProducts()
  }, [categorySlug, categories])

  const activeCategory = categorySlug ? categories.find((c) => c.slug === categorySlug) : null
  const sectionTitle = activeCategory ? activeCategory.name : 'Em destaque'

  function isCustomProduct(p: Product) {
    return categories.find((c) => c.id === p.category_id)?.slug === 'personalizados'
  }

  return (
    <div>
      <FeaturedCarousel products={carouselProducts} />

      <CategoryNav categories={categories} activeSlug={categorySlug} />

      <section>
        <div className="section-heading container">
          <h2>{sectionTitle}</h2>
        </div>

        {loading ? (
          <p className="container" style={{ color: 'var(--charcoal)' }}>
            Carregando produtos…
          </p>
        ) : products.length === 0 ? (
          <p className="container" style={{ color: 'var(--charcoal)' }}>
            {activeCategory
              ? 'Nenhum produto nesta categoria ainda.'
              : 'Nenhum produto cadastrado ainda. Cadastre peças no painel administrativo para exibi-las aqui.'}
          </p>
        ) : (
          <div className="product-grid container">
            {products.map((p) => (
              <Link key={p.id} to={`/produto/${p.id}`} className="product-card">
                <div className="image-wrap">
                  <img src={p.images?.[0] ?? ''} alt={p.name} />
                </div>
                <div className="body">
                  <h3>{p.name}</h3>
                  <div className="product-card-footer">
                    <span className="price">
                      {isCustomProduct(p)
                        ? `A partir de ${p.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                        : p.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                    {isCustomProduct(p) ? (
                      <Link
                        to={`/personalizados/novo?produto=${p.id}`}
                        className="add-to-cart-button"
                        aria-label={`Solicitar orçamento inspirado em ${p.name}`}
                        title="Solicitar orçamento"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Wand2 size={16} strokeWidth={1.6} />
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="add-to-cart-button"
                        aria-label={`Adicionar ${p.name} ao carrinho`}
                        title="Adicionar ao carrinho"
                        disabled={p.stock <= 0}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          addItem(p)
                        }}
                      >
                        <ShoppingBag size={16} strokeWidth={1.6} />
                      </button>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="value-props container">
        <div className="value">
          <span className="mark">I</span>
          <strong>Papel de algodão</strong>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--charcoal)' }}>
            Miolo de alta gramatura, com textura que segura tinta e caneta-tinteiro sem borrar.
          </p>
        </div>
        <div className="value">
          <span className="mark">II</span>
          <strong>Encadernação à mão</strong>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--charcoal)' }}>
            Cada exemplar passa pelas mãos de um encadernador antes de chegar até você.
          </p>
        </div>
        <div className="value">
          <span className="mark">III</span>
          <strong>Embalagem para presentear</strong>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--charcoal)' }}>
            Lacre de cera e papel de seda em toda encomenda, sem custo adicional.
          </p>
        </div>
      </section>
    </div>
  )
}
