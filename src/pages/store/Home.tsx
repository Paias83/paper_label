import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ShoppingBag, Wand2 } from 'lucide-react'
import { supabase, type Category, type Product } from '../../lib/supabase'
import FeaturedCarousel from '../../components/FeaturedCarousel'
import CategoryNav from '../../components/CategoryNav'
import { useCart } from '../../context/CartContext'

const PAGE_SIZE = 20

export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams()
  const categorySlug = searchParams.get('categoria')
  const page = Math.max(1, Number(searchParams.get('pagina')) || 1)
  const { addItem } = useCart()
  const listRef = useRef<HTMLElement>(null)

  const [categories, setCategories] = useState<Category[]>([])
  const [categoriesLoaded, setCategoriesLoaded] = useState(false)
  const [carouselProducts, setCarouselProducts] = useState<Product[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadCategories() {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('active', true)
        .order('name')
      if (error) console.error(error)
      setCategories(data ?? [])
      setCategoriesLoaded(true)
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

  // Lista da Home: todos os produtos ativos (ou só os da categoria escolhida),
  // 20 por página. Produtos de categorias internas (active = false) ficam de fora.
  useEffect(() => {
    if (!categoriesLoaded) return
    let cancelled = false

    async function loadProducts() {
      setLoading(true)
      let query = supabase
        .from('products')
        .select('*', { count: 'exact' })
        .eq('active', true)
        .order('created_at', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

      if (categorySlug) {
        const category = categories.find((c) => c.slug === categorySlug)
        if (!category) {
          setProducts([])
          setTotalCount(0)
          setLoading(false)
          return
        }
        query = query.eq('category_id', category.id)
      } else {
        const visibleIds = categories.map((c) => c.id)
        query = visibleIds.length
          ? query.or(`category_id.is.null,category_id.in.(${visibleIds.join(',')})`)
          : query.is('category_id', null)
      }

      const { data, count, error } = await query
      if (cancelled) return
      if (error) console.error(error)
      setProducts(data ?? [])
      setTotalCount(count ?? 0)
      setLoading(false)
    }

    loadProducts()
    return () => {
      cancelled = true
    }
  }, [categorySlug, categories, categoriesLoaded, page])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  function goToPage(next: number) {
    const params = new URLSearchParams(searchParams)
    if (next <= 1) params.delete('pagina')
    else params.set('pagina', String(next))
    setSearchParams(params)
    listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const activeCategory = categorySlug ? categories.find((c) => c.slug === categorySlug) : null
  const sectionTitle = activeCategory ? activeCategory.name : 'Todos os produtos'

  function isCustomProduct(p: Product) {
    return categories.find((c) => c.id === p.category_id)?.slug === 'personalizados'
  }

  return (
    <div>
      <FeaturedCarousel products={carouselProducts} />

      <CategoryNav categories={categories} activeSlug={categorySlug} />

      <section ref={listRef} style={{ scrollMarginTop: 'var(--space-3)' }}>
        <div className="section-heading container">
          <h2>{sectionTitle}</h2>
          {!loading && totalCount > 0 && (
            <span className="list-count">
              {totalCount} {totalCount === 1 ? 'produto' : 'produtos'}
            </span>
          )}
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

        {!loading && totalPages > 1 && (
          <nav className="pagination container" aria-label="Páginas">
            <button type="button" onClick={() => goToPage(page - 1)} disabled={page <= 1}>
              ← Anterior
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                className={n === page ? 'active' : ''}
                aria-current={n === page ? 'page' : undefined}
                onClick={() => goToPage(n)}
              >
                {n}
              </button>
            ))}
            <button type="button" onClick={() => goToPage(page + 1)} disabled={page >= totalPages}>
              Próxima →
            </button>
          </nav>
        )}
      </section>

      <section className="value-props container">
        <div className="value">
          <span className="mark">I</span>
          <strong>3D Personalizados</strong>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--charcoal)' }}>
            Criação de objetos tridimensionais exclusivos e sob medida que transformam 
            inovação tecnológica em presentes afetivos e marcantes.
          </p>
        </div>
        <div className="value">
          <span className="mark">II</span>
          <strong>Itens de Decoração</strong>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--charcoal)' }}>
            Peças funcionais e elegantes, como vasos e ornamentos, 
            voltadas para personalizar e harmonizar ambientes com estilo e sofisticação.
          </p>
        </div>
        <div className="value">
          <span className="mark">III</span>
          <strong>Lembranças em Papelaria Personalizada</strong>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--charcoal)' }}>
            Desenvolvimento de itens com acabamento artesanal e riquezas de detalhes 
            que transformam festas e celebrações em recordações inesquecíveis.
          </p>
        </div>
      </section>
    </div>
  )
}
