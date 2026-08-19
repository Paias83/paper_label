import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase, type QuoteMessage, type QuoteRequest, type QuoteStatus } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { QUOTE_STATUS_LABEL } from '../../lib/quoteStatus'
import CurrencyInput from '../../components/CurrencyInput'

const STATUS_OPTIONS: QuoteStatus[] = [
  'solicitado',
  'em_analise',
  'proposta_enviada',
  'aprovado',
  'recusado',
  'cancelado',
]

export default function QuoteThread() {
  const { id } = useParams()
  const { user } = useAuth()

  const [quote, setQuote] = useState<QuoteRequest | null>(null)
  const [messages, setMessages] = useState<QuoteMessage[]>([])
  const [loading, setLoading] = useState(true)

  const [replyBody, setReplyBody] = useState('')
  const [replyImages, setReplyImages] = useState<string[]>([])
  const [proposedPrice, setProposedPrice] = useState<number | null>(null)
  const [proposedShipping, setProposedShipping] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const [sending, setSending] = useState(false)

  async function load() {
    if (!id) return
    const [quoteRes, messagesRes] = await Promise.all([
      supabase.from('quote_requests').select('*').eq('id', id).single(),
      supabase.from('quote_messages').select('*').eq('quote_request_id', id).order('created_at'),
    ])
    setQuote(quoteRes.data ?? null)
    setMessages(messagesRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [id])

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const path = `${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('quote-attachments').upload(path, file)
    if (error) {
      alert('Falha ao enviar a imagem.')
    } else {
      const { data } = supabase.storage.from('quote-attachments').getPublicUrl(path)
      setReplyImages((prev) => [...prev, data.publicUrl])
    }
    setUploading(false)
    e.target.value = ''
  }

  async function updateStatus(status: QuoteStatus) {
    if (!quote) return
    await supabase.from('quote_requests').update({ status }).eq('id', quote.id)
    load()
  }

  async function handleSend() {
    if (!user || !quote) return
    if (!replyBody.trim() && replyImages.length === 0) return
    setSending(true)

    const price = proposedPrice
    const shipping = proposedShipping

    await supabase.from('quote_messages').insert({
      quote_request_id: quote.id,
      sender_role: 'admin',
      sender_id: user.id,
      body: replyBody.trim() || null,
      images: replyImages,
      proposed_price: price,
      proposed_shipping_cost: shipping,
    })

    if (price != null) {
      await supabase
        .from('quote_requests')
        .update({ status: 'proposta_enviada', final_price: price, shipping_cost: shipping ?? 0 })
        .eq('id', quote.id)
    }

    setReplyBody('')
    setReplyImages([])
    setProposedPrice(null)
    setProposedShipping(null)
    setSending(false)
    load()
  }

  if (loading) return <p>Carregando…</p>
  if (!quote) {
    return (
      <div>
        <h2>Orçamento não encontrado</h2>
        <Link to="/admin/orcamentos" className="admin-back-link">
          ← Orçamentos
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="admin-page-header">
        <Link to="/admin/orcamentos" className="admin-back-link">
          ← Orçamentos
        </Link>
        <h2>{quote.title}</h2>
      </div>

      <div className="form-field" style={{ maxWidth: 240, marginBottom: 'var(--space-3)' }}>
        <label className="form-field-label">Status</label>
        <select value={quote.status} onChange={(e) => updateStatus(e.target.value as QuoteStatus)}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {QUOTE_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      <p style={{ color: 'var(--charcoal)', whiteSpace: 'pre-line' }}>{quote.description}</p>

      <div className="quote-thread">
        {messages.map((m) => (
          <div key={m.id} className={`quote-bubble quote-bubble-${m.sender_role}`}>
            {m.body && <p>{m.body}</p>}
            {m.images.length > 0 && (
              <div className="quote-bubble-images">
                {m.images.map((url) => (
                  <img key={url} src={url} alt="" />
                ))}
              </div>
            )}
            {m.proposed_price != null && (
              <div className="quote-bubble-proposal">
                Proposta: {m.proposed_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                {m.proposed_shipping_cost != null &&
                  ` + frete ${m.proposed_shipping_cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="form-card" style={{ marginTop: 'var(--space-3)' }}>
        <h3>Responder</h3>
        <textarea
          rows={3}
          value={replyBody}
          onChange={(e) => setReplyBody(e.target.value)}
          placeholder="Escreva sua mensagem…"
        />
        <label className="upload-zone">
          <span className="icon">✎</span>
          <span className="label">{uploading ? 'Enviando…' : 'Anexar imagem'}</span>
          <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
        </label>
        {replyImages.length > 0 && (
          <div className="image-grid">
            {replyImages.map((url) => (
              <div key={url} className="image-thumb">
                <img src={url} alt="" />
                <button
                  type="button"
                  onClick={() => setReplyImages((prev) => prev.filter((i) => i !== url))}
                  aria-label="Remover imagem"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <p className="form-field-label" style={{ marginTop: 8 }}>
          Propor valor (opcional — envia a proposta e atualiza o status)
        </p>
        <div className="form-row">
          <div className="form-field">
            <label className="form-field-label" htmlFor="proposed-price">
              Preço
            </label>
            <div className="price-field">
              <span className="prefix">R$</span>
              <CurrencyInput id="proposed-price" value={proposedPrice} onChange={setProposedPrice} />
            </div>
          </div>
          <div className="form-field">
            <label className="form-field-label" htmlFor="proposed-shipping">
              Frete
            </label>
            <div className="price-field">
              <span className="prefix">R$</span>
              <CurrencyInput id="proposed-shipping" value={proposedShipping} onChange={setProposedShipping} />
            </div>
          </div>
        </div>

        <button
          className="seal-button"
          onClick={handleSend}
          disabled={sending || uploading || (!replyBody.trim() && replyImages.length === 0)}
        >
          {sending ? 'Enviando…' : 'Enviar'}
        </button>
      </div>
    </div>
  )
}
