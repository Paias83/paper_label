import { useEffect, useState } from 'react'
import type { Order } from '../../lib/supabase'
import { advanceOnEnter } from '../../lib/formNav'
import { callShippingLabel, type LabelLinks } from '../../lib/shippingLabel'

type Volume = { height: number; width: number; length: number; weight: number }

type Preview = {
  options: {
    id: number
    name: string
    company: string
    price: number
    delivery_time: number
    packages: number
    volume: Volume | null
  }[]
  selected_service_id: number | null
  sender: { name: string; address: string; number: string; city: string; state_abbr: string; postal_code: string }
  sender_missing: string[]
  balance: number | null
  recipient: { name: string; document: string; phone: string; email: string }
  items: { name: string; quantity: number; unit_price: number }[]
  customer_paid_shipping: number
}

type Props = {
  order: Order
  onClose: () => void
  onBought: (links: LabelLinks) => void
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function ShippingLabelModal({ order, onClose, onBought }: Props) {
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loadError, setLoadError] = useState('')
  const [serviceId, setServiceId] = useState<number | null>(null)
  const [recipient, setRecipient] = useState({ name: '', document: '', phone: '', email: '' })
  const [volume, setVolume] = useState({ height: '', width: '', length: '', weight: '' })
  const [buying, setBuying] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<LabelLinks | null>(null)

  useEffect(() => {
    callShippingLabel<Preview>('preview', order.id)
      .then((data) => {
        setPreview(data)
        setRecipient(data.recipient)
        selectService(data, data.selected_service_id)
      })
      .catch((err) => setLoadError(err.message))
  }, [order.id])

  // Ao trocar de serviço, preenche o pacote com o que o Melhor Envio calculou para ele.
  function selectService(data: Preview, id: number | null) {
    setServiceId(id)
    const v = data.options.find((o) => o.id === id)?.volume
    if (v) {
      setVolume({ height: String(v.height), width: String(v.width), length: String(v.length), weight: String(v.weight) })
    }
  }

  const selected = preview?.options.find((o) => o.id === serviceId) ?? null
  const lowBalance = preview?.balance != null && selected != null && preview.balance < selected.price

  async function handleBuy(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    setError('')
    setBuying(true)
    try {
      const links = await callShippingLabel<LabelLinks>('buy', order.id, {
        service_id: selected.id,
        recipient,
        volume: {
          height: Number(volume.height),
          width: Number(volume.width),
          length: Number(volume.length),
          weight: Number(volume.weight.replace(',', '.')),
        },
      })
      setResult(links)
      onBought(links)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBuying(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={buying ? undefined : onClose}>
      <div
        className="modal-card"
        style={{ maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>Etiqueta de envio — pedido {order.id.slice(0, 8)}</h3>

        {result ? (
          <LabelResult links={result} onClose={onClose} />
        ) : loadError ? (
          <>
            <p className="checkout-error">{loadError}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" className="ghost-button" onClick={onClose}>
                Fechar
              </button>
            </div>
          </>
        ) : !preview ? (
          <p style={{ color: 'var(--charcoal)' }}>Consultando o Melhor Envio…</p>
        ) : (
          <form onSubmit={handleBuy} onKeyDown={advanceOnEnter}>
            <p className="form-field-label" style={{ marginBottom: 6 }}>
              Serviço
            </p>
            {preview.options.length === 0 ? (
              <p className="checkout-error">Nenhum serviço disponível para esse CEP.</p>
            ) : (
              <div className="shipping-options" style={{ marginBottom: 6 }}>
                {preview.options.map((o) => (
                  <label key={o.id} className="shipping-option">
                    <input
                      type="radio"
                      name="label-service"
                      checked={serviceId === o.id}
                      onChange={() => selectService(preview, o.id)}
                    />
                    <span className="shipping-option-info">
                      <span>
                        {o.name} <span className="shipping-option-carrier">· {o.company}</span>
                        <br />
                        <small style={{ color: 'var(--charcoal)' }}>
                          {o.delivery_time} {o.delivery_time === 1 ? 'dia útil' : 'dias úteis'}
                          {o.id === order.shipping_service_id ? ' · escolhido pelo cliente' : ''}
                        </small>
                      </span>
                      <span className="shipping-option-price">{brl(o.price)}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
            <p style={{ fontSize: '0.8rem', color: 'var(--charcoal)', margin: '0 0 16px' }}>
              Cliente pagou {brl(preview.customer_paid_shipping)} de frete
              {order.shipping_service ? ` (${order.shipping_service})` : ''}.
            </p>
            {selected && selected.packages > 1 && (
              <p className="checkout-error">
                O Melhor Envio calculou {selected.packages} volumes para esse pedido. Aqui só dá para gerar etiqueta
                de um volume — gere direto no site do Melhor Envio ou ajuste as medidas abaixo.
              </p>
            )}

            <p className="form-field-label" style={{ marginBottom: 6 }}>
              Pacote
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
              {(
                [
                  ['height', 'Altura (cm)'],
                  ['width', 'Largura (cm)'],
                  ['length', 'Compr. (cm)'],
                  ['weight', 'Peso (kg)'],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <label className="form-field-label" htmlFor={`vol-${key}`} style={{ fontSize: '0.75rem' }}>
                    {label}
                  </label>
                  <input
                    id={`vol-${key}`}
                    inputMode="decimal"
                    value={volume[key]}
                    onChange={(e) => setVolume((prev) => ({ ...prev, [key]: e.target.value }))}
                    required
                    style={{ fontFamily: 'var(--font-mono)' }}
                  />
                </div>
              ))}
            </div>

            <p className="form-field-label" style={{ marginBottom: 6 }}>
              Destinatário
            </p>
            <div className="form-field">
              <input
                placeholder="Nome completo"
                value={recipient.name}
                onChange={(e) => setRecipient((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 6 }}>
              <input
                placeholder="CPF"
                inputMode="numeric"
                value={recipient.document}
                onChange={(e) => setRecipient((prev) => ({ ...prev, document: e.target.value }))}
                required
              />
              <input
                placeholder="Telefone"
                inputMode="tel"
                value={recipient.phone}
                onChange={(e) => setRecipient((prev) => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--charcoal)', margin: '0 0 16px' }}>
              {order.shipping_address &&
                `${order.shipping_address.street}, ${order.shipping_address.number} — ${order.shipping_address.city}/${order.shipping_address.state}. `}
              CPF é obrigatório na declaração de conteúdo.
            </p>

            <p className="form-field-label" style={{ marginBottom: 6 }}>
              Declaração de conteúdo
            </p>
            <ul style={{ margin: '0 0 16px', paddingLeft: 18, fontSize: '0.85rem' }}>
              {preview.items.map((i, idx) => (
                <li key={idx}>
                  {i.name} × {i.quantity} — <span className="price">{brl(i.unit_price * i.quantity)}</span>
                </li>
              ))}
            </ul>

            <p style={{ fontSize: '0.8rem', color: 'var(--charcoal)', margin: '0 0 4px' }}>
              <strong>Remetente:</strong>{' '}
              {preview.sender_missing.length
                ? `cadastro incompleto no Melhor Envio (falta: ${preview.sender_missing.join(', ')})`
                : `${preview.sender.name} — ${preview.sender.address}, ${preview.sender.number} — ${preview.sender.city}/${preview.sender.state_abbr}`}
            </p>
            <p style={{ fontSize: '0.8rem', color: lowBalance ? 'var(--danger)' : 'var(--charcoal)', margin: 0 }}>
              <strong>Saldo na carteira do Melhor Envio:</strong>{' '}
              {preview.balance == null ? 'não foi possível consultar' : brl(preview.balance)}
              {lowBalance && ' — insuficiente para essa etiqueta'}
            </p>

            {error && (
              <p className="checkout-error" style={{ marginTop: 12 }}>
                {error}
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button type="button" className="ghost-button" onClick={onClose} disabled={buying}>
                Cancelar
              </button>
              <button
                type="submit"
                className="seal-button"
                disabled={buying || !selected || preview.sender_missing.length > 0}
              >
                {buying ? 'Comprando…' : selected ? `Comprar etiqueta — ${brl(selected.price)}` : 'Comprar etiqueta'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export function LabelResult({ links, onClose }: { links: LabelLinks; onClose?: () => void }) {
  return (
    <div>
      <p style={{ margin: '0 0 12px' }}>
        Etiqueta comprada. Imprima a etiqueta e a declaração de conteúdo e cole as duas no pacote.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {links.label_url && (
          <a href={links.label_url} target="_blank" rel="noreferrer" className="seal-button">
            Abrir etiqueta (PDF)
          </a>
        )}
        {links.dace_url ? (
          <a href={links.dace_url} target="_blank" rel="noreferrer" className="ghost-button">
            Abrir declaração de conteúdo
          </a>
        ) : (
          <span style={{ fontSize: '0.85rem', color: 'var(--charcoal)', alignSelf: 'center' }}>
            Declaração de conteúdo ainda sendo emitida — use "Imprimir etiqueta" no pedido daqui a alguns minutos.
          </span>
        )}
      </div>
      <p style={{ fontSize: '0.85rem', color: 'var(--charcoal)', margin: 0 }}>
        {links.tracking_code
          ? `Código de rastreio: ${links.tracking_code} (já salvo no pedido).`
          : 'O código de rastreio ainda não saiu — ele aparece no pedido quando você clicar em "Imprimir etiqueta" de novo.'}
      </p>
      {onClose && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" className="ghost-button" onClick={onClose}>
            Fechar
          </button>
        </div>
      )}
    </div>
  )
}
