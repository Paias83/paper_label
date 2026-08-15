import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, type QuoteRequest } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { QUOTE_STATUS_LABEL } from '../../lib/quoteStatus'

export default function MyQuotes() {
  const { user, loading: authLoading } = useAuth()
  const [quotes, setQuotes] = useState<QuoteRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase
      .from('quote_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setQuotes(data ?? [])
        setLoading(false)
      })
  }, [user])

  if (!authLoading && !user) {
    return (
      <div className="container" style={{ padding: '40px 24px' }}>
        <h2>Meus orçamentos</h2>
        <p style={{ color: 'var(--charcoal)' }}>Entre na sua conta para ver seus orçamentos.</p>
        <Link to="/entrar" className="seal-button">
          Entrar
        </Link>
      </div>
    )
  }

  return (
    <div className="container" style={{ padding: '40px 24px', maxWidth: 640 }}>
      <h2>Meus orçamentos</h2>
      {loading ? (
        <p style={{ color: 'var(--charcoal)' }}>Carregando…</p>
      ) : quotes.length === 0 ? (
        <p style={{ color: 'var(--charcoal)' }}>
          Você ainda não pediu nenhum orçamento. Encontre uma ideia na aba{' '}
          <Link to="/?categoria=personalizados">Personalizados</Link>.
        </p>
      ) : (
        <div className="quote-list">
          {quotes.map((q) => (
            <Link key={q.id} to={`/meus-orcamentos/${q.id}`} className="quote-list-item">
              <div>
                <strong>{q.title}</strong>
                <span className="checkout-hint" style={{ margin: 0 }}>
                  {new Date(q.created_at).toLocaleDateString('pt-BR')}
                </span>
              </div>
              <span className={`type-badge quote-status-${q.status}`}>
                {QUOTE_STATUS_LABEL[q.status]}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
