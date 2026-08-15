import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, type QuoteRequest } from '../../lib/supabase'
import { QUOTE_STATUS_LABEL } from '../../lib/quoteStatus'

type Profile = { id: string; name: string | null }

export default function Quotes() {
  const [quotes, setQuotes] = useState<QuoteRequest[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [quotesRes, profilesRes] = await Promise.all([
        supabase.from('quote_requests').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, name'),
      ])
      setQuotes(quotesRes.data ?? [])
      setProfiles(profilesRes.data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const clientName = (userId: string) => profiles.find((p) => p.id === userId)?.name ?? '—'

  return (
    <div>
      <div className="admin-page-header">
        <p className="eyebrow">Vendas</p>
        <h2>Orçamentos</h2>
      </div>

      <div className="list-toolbar" style={{ justifyContent: 'flex-end' }}>
        <span className="list-count">
          {quotes.length} {quotes.length === 1 ? 'orçamento' : 'orçamentos'}
        </span>
      </div>

      <div className="list-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Título</th>
              <th>Status</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="empty-state">
                  Carregando…
                </td>
              </tr>
            ) : quotes.length === 0 ? (
              <tr>
                <td colSpan={4} className="empty-state">
                  Nenhum orçamento ainda.
                </td>
              </tr>
            ) : (
              quotes.map((q) => (
                <tr key={q.id}>
                  <td>{clientName(q.user_id)}</td>
                  <td>
                    <Link to={`/admin/orcamentos/${q.id}`} className="table-action-link">
                      {q.title}
                    </Link>
                  </td>
                  <td>
                    <span className={`type-badge quote-status-${q.status}`}>{QUOTE_STATUS_LABEL[q.status]}</span>
                  </td>
                  <td>{new Date(q.created_at).toLocaleDateString('pt-BR')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
