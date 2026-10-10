import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { supabase, type Product } from '../../lib/supabase'
import { useCart } from '../../context/CartContext'

export default function ProductPage() {
  const { id } = useParams()
  const [product, setProduct] = useState<Product | null>(null)
  const [isCustom, setIsCustom] = useState(false)
  const [selectedImage, setSelectedImage] = useState(0)
  const [descriptionExpanded, setDescriptionExpanded] = useState(false)
  const [descriptionOverflows, setDescriptionOverflows] = useState(false)
  const descriptionRef = useRef<HTMLParagraphElement>(null)
  const { addItem } = useCart()
  const navigate = useNavigate()
  const location = useLocation()

  // Volta para a tela anterior (mantendo filtro de categoria etc.); se o cliente
  // entrou direto pelo link do produto, não há histórico do site e vai para a Home.
  function continueShopping() {
    if (location.key !== 'default') navigate(-1)
    else navigate('/')
  }

  // Só mostra os botões de expandir/recolher quando o texto passa do limite de altura.
  useLayoutEffect(() => {
    const el = descriptionRef.current
    if (el && !descriptionExpanded) setDescriptionOverflows(el.scrollHeight > el.clientHeight + 1)
  }, [product, descriptionExpanded])

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.from('products').select('*').eq('id', id).single()
      if (error) console.error(error)
      else setProduct(data)
      setSelectedImage(0)
      setDescriptionExpanded(false)

      if (data?.category_id) {
        const { data: category } = await supabase
          .from('categories')
          .select('slug')
          .eq('id', data.category_id)
          .single()
        setIsCustom(category?.slug === 'personalizados')
      } else {
        setIsCustom(false)
      }
    }
    if (id) load()
  }, [id])

  if (!product) return <div className="container">Carregando…</div>

  const images = product.images?.length ? product.images : ['']

  const linkButtonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    borderBottom: '1px solid var(--wine)',
    padding: '0 0 2px',
    color: 'var(--wine)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.85rem',
  }

  return (
    <div className="container" style={{ padding: '24px 24px 40px' }}>
      <button
        onClick={continueShopping}
        style={{
          ...linkButtonStyle,
          borderBottom: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 20,
        }}
      >
        <ArrowLeft size={16} />
        Continuar comprando
      </button>
      <div style={{ display: 'flex', gap: 40 }}>
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
            {isCustom ? 'A partir de ' : ''}
            {product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
          <div style={{ maxWidth: 420, marginBottom: 16 }}>
            <p
              ref={descriptionRef}
              style={{
                color: 'var(--charcoal)',
                whiteSpace: 'pre-line',
                margin: 0,
                maxHeight: descriptionExpanded ? 'none' : '7cm',
                overflow: 'hidden',
              }}
            >
              {product.description}
            </p>
            {descriptionOverflows && (
              <button
                onClick={() => setDescriptionExpanded(!descriptionExpanded)}
                style={{ ...linkButtonStyle, marginTop: 10 }}
              >
                {descriptionExpanded ? 'Recolher descrição' : 'Descrição completa'}
              </button>
            )}
          </div>
          {isCustom ? (
            <Link to={`/personalizados/novo?produto=${product.id}`} className="seal-button">
              Solicitar orçamento
            </Link>
          ) : (
            <>
              <button className="seal-button" onClick={() => addItem(product)}>
                Adicionar ao carrinho
              </button>
              {product.stock <= 0 && (
                <p style={{ color: 'var(--danger)', marginTop: 8 }}>Fora de estoque no momento.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
