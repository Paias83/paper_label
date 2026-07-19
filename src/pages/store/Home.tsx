import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, type Product } from '../../lib/supabase'

export default function Home() {
  const [featured, setFeatured] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .eq('featured', true)
        .order('created_at', { ascending: false })
        .limit(4)

      if (error) console.error(error)

      if (data && data.length > 0) {
        setFeatured(data)
        setLoading(false)
        return
      }

      // Nenhum produto marcado como destaque ainda — mostra os mais recentes
      const { data: recent, error: recentError } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(4)

      if (recentError) console.error(recentError)
      setFeatured(recent ?? [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div>
      <section className="hero container">
        <div>
          <p className="eyebrow">Papelaria fina, feita para durar</p>
          <h1 style={{ fontSize: '3rem' }}>
            Cada folha, cada capa, escolhida com a mesma atenção de quem escreve.
          </h1>
          <p style={{ maxWidth: 480, color: 'var(--charcoal)' }}>
            Cadernos encadernados à mão, papelaria de convite e acessórios de escrita —
            selecionados para quem trata o papel como objeto, não como consumível.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginTop: 24, flexWrap: 'wrap' }}>
            <Link to="/catalogo" className="seal-button">
              Ver a coleção
            </Link>
            <a href="#destaques" style={{ fontSize: '0.9rem', textDecoration: 'underline' }}>
              Peças em destaque
            </a>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <span className="hero-art-mark">P</span>
          <div className="deckle-divider" style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }} />
        </div>
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

      <section id="destaques">
        <div className="section-heading container">
          <h2>Em destaque</h2>
          <Link to="/catalogo" style={{ fontSize: '0.9rem' }}>
            Ver tudo →
          </Link>
        </div>

        {loading ? (
          <p className="container" style={{ color: 'var(--charcoal)' }}>
            Carregando peças em destaque…
          </p>
        ) : featured.length === 0 ? (
          <p className="container" style={{ color: 'var(--charcoal)' }}>
            Nenhum produto cadastrado ainda. Cadastre peças no painel administrativo para exibi-las aqui.
          </p>
        ) : (
          <div className="product-grid container">
            {featured.map((p) => (
              <Link key={p.id} to={`/produto/${p.id}`} className="product-card">
                <img src={p.images?.[0] ?? ''} alt={p.name} />
                <div className="body">
                  <h3>{p.name}</h3>
                  <span className="price">
                    {p.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
