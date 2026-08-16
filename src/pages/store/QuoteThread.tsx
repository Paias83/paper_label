import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase, type QuoteMessage, type QuoteRequest, type ShippingAddress } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { QUOTE_STATUS_LABEL } from '../../lib/quoteStatus'
import AddressForm, { isAddressComplete } from '../../components/AddressForm'
import DeliveryMethodPicker, { PICKUP_INFO, type DeliveryMethod } from '../../components/DeliveryMethodPicker'

const emptyAddress: ShippingAddress = {
  cep: '',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
}

export default function QuoteThread() {
  const { id } = useParams()
  const { user } = useAuth()

  const [quote, setQuote] = useState<QuoteRequest | null>(null)
  const [messages, setMessages] = useState<QuoteMessage[]>([])
  const [loading, setLoading] = useState(true)

  const [replyBody, setReplyBody] = useState('')
  const [replyImages, setReplyImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [sending, setSending] = useState(false)

  const [showAddressForm, setShowAddressForm] = useState(false)
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('entrega')
  const [address, setAddress] = useState<ShippingAddress>(emptyAddress)
  const [paying, setPaying] = useState(false)

  const canApprove = deliveryMethod === 'retirada' || isAddressComplete(address)
  const shippingCost = deliveryMethod === 'retirada' ? 0 : quote?.shipping_cost ?? 0

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

  async function sendReply(revertStatus: boolean) {
    if (!user || !quote) return
    if (!replyBody.trim() && replyImages.length === 0) return
    setSending(true)

    await supabase.from('quote_messages').insert({
      quote_request_id: quote.id,
      sender_role: 'cliente',
      sender_id: user.id,
      body: replyBody.trim() || null,
      images: replyImages,
    })

    if (revertStatus && quote.status === 'proposta_enviada') {
      await supabase.from('quote_requests').update({ status: 'em_analise' }).eq('id', quote.id)
    }

    setReplyBody('')
    setReplyImages([])
    setSending(false)
    load()
  }

  async function handlePedirAjuste() {
    if (!quote) return
    if (replyBody.trim() || replyImages.length > 0) {
      await sendReply(true)
    } else {
      await supabase.from('quote_requests').update({ status: 'em_analise' }).eq('id', quote.id)
      load()
    }
  }

  async function handleAprovar() {
    if (!quote || !canApprove) return
    setPaying(true)
    try {
      const { data, error } = await supabase.functions.invoke('create-quote-order', {
        body: {
          quote_request_id: quote.id,
          shipping_type: deliveryMethod,
          address: deliveryMethod === 'entrega' ? address : null,
        },
      })
      if (error) throw error
      window.location.href = data.init_point
    } catch (err) {
      console.error(err)
      alert('Não foi possível iniciar o pagamento. Tente novamente.')
      setPaying(false)
    }
  }

  if (loading) return <div className="container" style={{ padding: '40px 24px' }}>Carregando…</div>
  if (!quote) {
    return (
      <div className="container" style={{ padding: '40px 24px' }}>
        <h2>Orçamento não encontrado</h2>
        <Link to="/meus-orcamentos">Voltar aos meus orçamentos</Link>
      </div>
    )
  }

  return (
    <div className="container" style={{ padding: '40px 24px', maxWidth: 640 }}>
      <Link to="/meus-orcamentos" className="admin-back-link">
        ← Meus orçamentos
      </Link>
      <h2>{quote.title}</h2>
      <span className={`type-badge quote-status-${quote.status}`}>{QUOTE_STATUS_LABEL[quote.status]}</span>

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

      {quote.status === 'proposta_enviada' && quote.final_price != null && (
        <div className="checkout-summary">
          <div className="checkout-summary-row">
            <span>Valor proposto</span>
            <span>{quote.final_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </div>
          <div className="checkout-summary-row total">
            <span>Total (com frete)</span>
            <strong className="price">
              {(quote.final_price + shippingCost).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}
            </strong>
          </div>

          {showAddressForm ? (
            <>
              <DeliveryMethodPicker value={deliveryMethod} onChange={setDeliveryMethod} />

              {deliveryMethod === 'retirada' ? (
                <div className="form-card" style={{ marginTop: 'var(--space-3)' }}>
                  <h3>Retirada no local</h3>
                  <p className="checkout-hint">Retire seu pedido em: {PICKUP_INFO}</p>
                </div>
              ) : (
                <AddressForm address={address} onChange={setAddress} title="Endereço de entrega" />
              )}

              <button
                className="seal-button"
                onClick={handleAprovar}
                disabled={paying || !canApprove}
                style={{ width: '100%', marginTop: 12 }}
              >
                {paying ? 'Redirecionando…' : 'Confirmar e pagar'}
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="seal-button" onClick={() => setShowAddressForm(true)} style={{ flex: 1 }}>
                Aprovar e pagar
              </button>
              <button className="ghost-button" onClick={handlePedirAjuste} style={{ flex: 1 }}>
                Pedir ajuste
              </button>
            </div>
          )}
        </div>
      )}

      {quote.status !== 'aprovado' && quote.status !== 'recusado' && quote.status !== 'cancelado' && (
        <div className="form-card" style={{ marginTop: 'var(--space-3)' }}>
          <h3>Responder</h3>
          <textarea
            className="store-textarea"
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
          <button
            className="seal-button"
            onClick={() => sendReply(false)}
            disabled={sending || uploading || (!replyBody.trim() && replyImages.length === 0)}
          >
            {sending ? 'Enviando…' : 'Enviar mensagem'}
          </button>
        </div>
      )}
    </div>
  )
}
