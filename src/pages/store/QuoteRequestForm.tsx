import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

export default function QuoteRequestForm() {
  const [searchParams] = useSearchParams()
  const inspirationProductId = searchParams.get('produto')
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!inspirationProductId) return
    supabase
      .from('products')
      .select('name')
      .eq('id', inspirationProductId)
      .single()
      .then(({ data }) => {
        if (data) setTitle(`Inspirado em: ${data.name}`)
      })
  }, [inspirationProductId])

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
      setImages((prev) => [...prev, data.publicUrl])
    }
    setUploading(false)
    e.target.value = ''
  }

  function removeImage(url: string) {
    setImages((prev) => prev.filter((img) => img !== url))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSaving(true)

    const { data: quote, error } = await supabase
      .from('quote_requests')
      .insert({
        user_id: user.id,
        inspiration_product_id: inspirationProductId,
        title,
        description,
      })
      .select()
      .single()

    if (error || !quote) {
      setSaving(false)
      alert('Não foi possível enviar seu pedido de orçamento.')
      console.error(error)
      return
    }

    const { error: messageError } = await supabase.from('quote_messages').insert({
      quote_request_id: quote.id,
      sender_role: 'cliente',
      sender_id: user.id,
      body: description,
      images,
    })
    if (messageError) console.error(messageError)

    setSaving(false)
    navigate(`/meus-orcamentos/${quote.id}`)
  }

  if (!authLoading && !user) {
    return (
      <div className="container" style={{ padding: '40px 24px' }}>
        <h2>Solicitar orçamento</h2>
        <p style={{ color: 'var(--charcoal)' }}>Entre na sua conta para pedir um orçamento personalizado.</p>
        <Link to="/entrar" className="seal-button">
          Entrar
        </Link>
      </div>
    )
  }

  return (
    <div className="container" style={{ padding: '40px 24px', maxWidth: 560 }}>
      <h2>Solicitar orçamento</h2>
      <p style={{ color: 'var(--charcoal)', marginTop: -8, marginBottom: 24 }}>
        Conte sua ideia — a gente responde por aqui mesmo, com uma proposta de valor e prazo.
      </p>
      <form onSubmit={handleSubmit} className="store-form">
        <div className="form-card">
          <div className="form-field">
            <label className="form-field-label" htmlFor="title">
              Título
            </label>
            <input id="title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="form-field">
            <label className="form-field-label" htmlFor="description">
              Descreva sua ideia
            </label>
            <textarea
              id="description"
              className="store-textarea"
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>
          <div className="form-field">
            <label className="form-field-label">Referências (opcional)</label>
            <label className="upload-zone">
              <span className="icon">✎</span>
              <span className="label">{uploading ? 'Enviando…' : 'Clique ou arraste uma foto'}</span>
              <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
            </label>
            {images.length > 0 && (
              <div className="image-grid">
                {images.map((url) => (
                  <div key={url} className="image-thumb">
                    <img src={url} alt="" />
                    <button type="button" onClick={() => removeImage(url)} aria-label="Remover imagem">
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <button className="seal-button" type="submit" disabled={saving || uploading} style={{ marginTop: 16 }}>
          {saving ? 'Enviando…' : 'Enviar pedido de orçamento'}
        </button>
      </form>
    </div>
  )
}
