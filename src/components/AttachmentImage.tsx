import { useEffect, useState } from 'react'
import { getAttachmentPublicUrl, getAttachmentUrl } from '../lib/quoteAttachments'

// Imagem de anexo de orçamento: pede o link temporário e exibe. `value` é o
// caminho no Storage (ou o link público antigo, convertido em getAttachmentUrl).
export default function AttachmentImage({ value }: { value: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    getAttachmentUrl(value).then((signed) => {
      if (!active) return
      // Sem link temporário (ex.: antes da regra de leitura existir), tenta o público.
      setUrl(signed ?? getAttachmentPublicUrl(value))
    })
    return () => {
      active = false
    }
  }, [value])

  if (failed) return <span style={{ fontSize: '0.8rem', color: 'var(--charcoal)' }}>Imagem indisponível</span>
  if (!url) return <span style={{ fontSize: '0.8rem', color: 'var(--charcoal)' }}>Carregando imagem…</span>
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} alt="" onError={() => setFailed(true)} />
    </a>
  )
}
