import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import useEmblaCarousel from 'embla-carousel-react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Product } from '../lib/supabase'

type FeaturedCarouselProps = {
  products: Product[]
}

export default function FeaturedCarousel({ products }: FeaturedCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true })
  const [selectedIndex, setSelectedIndex] = useState(0)

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi])
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap())
    emblaApi.on('select', onSelect)
    onSelect()
    return () => {
      emblaApi.off('select', onSelect)
    }
  }, [emblaApi])

  if (products.length === 0) return null

  return (
    <div className="carousel container">
      <div className="carousel-viewport" ref={emblaRef}>
        <div className="carousel-track">
          {products.map((p) => (
            <Link key={p.id} to={`/produto/${p.id}`} className="carousel-slide">
              <img src={p.images?.[0] ?? ''} alt={p.name} />
              <div className="carousel-slide-caption">
                <h3>{p.name}</h3>
                <span className="price">
                  {p.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {products.length > 1 && (
        <>
          <button className="carousel-arrow prev" onClick={scrollPrev} aria-label="Anterior">
            <ChevronLeft size={20} />
          </button>
          <button className="carousel-arrow next" onClick={scrollNext} aria-label="Próximo">
            <ChevronRight size={20} />
          </button>
          <div className="carousel-dots">
            {products.map((_, i) => (
              <button
                key={i}
                className={`carousel-dot${i === selectedIndex ? ' active' : ''}`}
                onClick={() => emblaApi?.scrollTo(i)}
                aria-label={`Ir para o slide ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
