// Helper compartilhado dos e-mails de pedido/pagamento — monta e manda via
// API HTTP do Resend (não a SMTP que o Supabase Auth usa internamente, essa a
// aplicação não consegue chamar).
//
// - sendOrderStatusEmail: um e-mail por status do pedido (pago, enviado...).
//   Usado pelo mp-webhook, pedidos manuais e pelo admin (send-order-status-email).
// - sendPaymentNoticeEmail: avisos de pagamento que não mudam o status do pedido
//   (Pix/boleto aguardando, pagamento em análise, cartão recusado). Só o mp-webhook usa.
// - sendStoreNewOrderEmail: aviso de venda para a loja (contato@) quando um
//   pagamento é aprovado. Só o mp-webhook usa.
//
// Requer o secret RESEND_API_KEY: supabase secrets set RESEND_API_KEY=...

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SITE_URL = 'https://www.studiopaper.com.br'
const STORE_EMAIL = 'contato@studiopaper.com.br'
// Duplicado em src/components/DeliveryMethodPicker.tsx — se mudar, alterar nos dois.
const PICKUP_INFO = 'Rua Pion. Walcyr Bavelone, 362 — das 9h às 17h.'

// Mesmos tokens de src/styles/global.css (e-mail não lê CSS externo).
const C = {
  ink: '#1c1b19',
  paper: '#f7f3ea',
  raised: '#fffdf8',
  charcoal: '#3a362e',
  wine: '#6b1f2a',
  brass: '#b08d57',
  hairline: '#d8d0bf',
}
const SERIF = "Georgia, 'Times New Roman', serif"
const SANS = "'Helvetica Neue', Arial, sans-serif"
const MONO = "'Courier New', Courier, monospace"

type OrderForEmail = {
  id: string
  user_id: string | null
  status: string
  total: number
  shipping_type: 'entrega' | 'retirada'
  shipping_cost: number
  shipping_service: string | null
  shipping_address: {
    street: string
    number: string
    complement: string
    neighborhood: string
    city: string
    state: string
    cep: string
  } | null
  tracking_code: string | null
  last_status_change_by?: 'sistema' | 'admin' | null
}

export type PaymentNotice =
  | { kind: 'aguardando_pix' | 'aguardando_boleto'; paymentUrl: string | null; expiresAt: string | null }
  | { kind: 'em_analise' }
  | { kind: 'recusado' }

export type EmailItem = { name: string; quantity: number; price: number }

type EmailContent = {
  subject: string
  heading: string
  bodyHtml: string
  cta?: { label: string; url: string }
}

export type EmailDetails = {
  firstName: string | null
  items: EmailItem[]
  isQuoteOrder: boolean
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function brl(value: number) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function p(html: string) {
  return `<p style="margin:0 0 14px;font-family:${SANS};font-size:15px;line-height:1.6;color:${C.charcoal};">${html}</p>`
}

export function statusContent(order: OrderForEmail): EmailContent | null {
  const shortId = order.id.slice(0, 8)

  switch (order.status) {
    case 'pendente':
      // Hoje só sai para pedido manual criado como pendente (venda por telefone/presencial).
      return {
        subject: `Recebemos seu pedido #${shortId}`,
        heading: 'Recebemos seu pedido',
        bodyHtml: p(
          `Seu pedido <strong>#${shortId}</strong> foi registrado e está aguardando a confirmação do pagamento. Assim que for confirmado, te avisamos por aqui.`
        ),
      }
    case 'pago':
      return {
        subject: `Pagamento confirmado — pedido #${shortId}`,
        heading: 'Pagamento confirmado!',
        bodyHtml:
          p(`Recebemos o pagamento do seu pedido <strong>#${shortId}</strong> e já estamos preparando tudo com carinho.`) +
          p(
            order.shipping_type === 'retirada'
              ? 'Avisaremos por e-mail assim que ele estiver pronto para retirada.'
              : 'Assim que ele for enviado, mandamos o código de rastreio por e-mail.'
          ),
      }
    case 'enviado': {
      const tracking = order.tracking_code
        ? p(
            `<strong>Transportadora:</strong> ${escapeHtml(order.shipping_service ?? '—')}<br><strong>Código de rastreio:</strong> <span style="font-family:${MONO};">${escapeHtml(order.tracking_code)}</span>`
          )
        : ''
      return {
        subject: `Seu pedido #${shortId} foi enviado`,
        heading: 'Seu pedido está a caminho',
        bodyHtml: p(`Seu pedido <strong>#${shortId}</strong> foi enviado.`) + tracking,
      }
    }
    case 'entregue':
      return {
        subject: `Seu pedido #${shortId} foi entregue`,
        heading: 'Pedido entregue',
        bodyHtml: p(`Seu pedido <strong>#${shortId}</strong> foi entregue. Esperamos que você ame! Obrigado pela preferência.`),
      }
    case 'pronto_para_retirada':
      return {
        subject: `Seu pedido #${shortId} está pronto para retirada`,
        heading: 'Pronto para retirada',
        bodyHtml: p(`Seu pedido <strong>#${shortId}</strong> está pronto e esperando por você.`),
      }
    case 'retirado':
      return {
        subject: `Retirada confirmada — pedido #${shortId}`,
        heading: 'Retirada confirmada',
        bodyHtml: p(`Confirmamos a retirada do seu pedido <strong>#${shortId}</strong>. Obrigado pela preferência!`),
      }
    case 'cancelado':
      // 'sistema' = o Mercado Pago cancelou (Pix/boleto vencido); 'admin' = cancelado pela loja.
      return order.last_status_change_by === 'sistema'
        ? {
            subject: `Pagamento não confirmado — pedido #${shortId}`,
            heading: 'Pagamento não confirmado',
            bodyHtml:
              p(`O prazo para pagamento do pedido <strong>#${shortId}</strong> terminou e ele foi cancelado. Nenhum valor foi cobrado.`) +
              p('Se ainda quiser os produtos, é só fazer a compra novamente no site.'),
            cta: { label: 'Voltar à loja', url: SITE_URL },
          }
        : {
            subject: `Pedido #${shortId} cancelado`,
            heading: 'Pedido cancelado',
            bodyHtml: p(`Seu pedido <strong>#${shortId}</strong> foi cancelado. Se tiver qualquer dúvida, é só responder este e-mail.`),
          }
    default:
      return null
  }
}

export function noticeContent(order: OrderForEmail, notice: PaymentNotice, details: EmailDetails): EmailContent {
  const shortId = order.id.slice(0, 8)
  const expires =
    'expiresAt' in notice && notice.expiresAt ? ` até <strong>${formatDateTime(notice.expiresAt)}</strong>` : ''

  switch (notice.kind) {
    case 'aguardando_pix':
      return {
        subject: `Seu Pix do pedido #${shortId} está aguardando pagamento`,
        heading: 'Falta só pagar o Pix',
        bodyHtml:
          p(`O Pix do pedido <strong>#${shortId}</strong> foi gerado. Pague pelo QR Code ou pelo código copia e cola${expires}.`) +
          p('O pedido é confirmado automaticamente assim que o pagamento cair — você recebe outro e-mail.'),
        cta: notice.paymentUrl ? { label: 'Pagar com Pix', url: notice.paymentUrl } : undefined,
      }
    case 'aguardando_boleto':
      return {
        subject: `Seu boleto do pedido #${shortId} foi gerado`,
        heading: 'Boleto gerado',
        bodyHtml:
          p(`O boleto do pedido <strong>#${shortId}</strong> foi gerado. Pague${expires} pelo app do seu banco ou numa lotérica.`) +
          p('A compensação do boleto pode levar até 3 dias úteis. Assim que for confirmado, te avisamos por e-mail.'),
        cta: notice.paymentUrl ? { label: 'Ver boleto', url: notice.paymentUrl } : undefined,
      }
    case 'em_analise':
      return {
        subject: `Pagamento em análise — pedido #${shortId}`,
        heading: 'Pagamento em análise',
        bodyHtml:
          p(`O Mercado Pago está analisando o pagamento do pedido <strong>#${shortId}</strong>.`) +
          p('Isso costuma levar poucos minutos, mas pode chegar a 2 dias úteis. Avisamos assim que for aprovado.'),
      }
    case 'recusado':
      return {
        subject: `Pagamento não aprovado — pedido #${shortId}`,
        heading: 'Pagamento não aprovado',
        bodyHtml:
          p(`O pagamento do pedido <strong>#${shortId}</strong> não foi aprovado e nenhum valor foi cobrado.`) +
          (details.isQuoteOrder
            ? p('Responda este e-mail que a gente envia um novo link de pagamento para o seu orçamento.')
            : p('Seus produtos continuam no carrinho: é só voltar ao site e tentar de novo com outro cartão ou com Pix.')),
        cta: details.isQuoteOrder ? undefined : { label: 'Voltar ao carrinho', url: `${SITE_URL}/carrinho` },
      }
  }
}

const CUSTOMER_FOOTER = `<a href="${SITE_URL}/meus-pedidos" style="color:${C.wine};">Ver meus pedidos</a><br>
      Dúvidas? Responda este e-mail ou fale com a gente em contato@studiopaper.com.br`

// Monta o HTML completo — exportado separado para dar para gerar prévia local.
export function renderEmail(
  order: OrderForEmail,
  content: EmailContent,
  details: EmailDetails,
  footerHtml: string = CUSTOMER_FOOTER
) {
  const shortId = order.id.slice(0, 8)
  const greeting = details.firstName ? p(`Olá, ${escapeHtml(details.firstName)}!`) : ''

  const cta = content.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;"><tr><td style="background:${C.wine};border-radius:2px;">
        <a href="${escapeHtml(content.cta.url)}" style="display:inline-block;padding:13px 26px;font-family:${SANS};font-size:13px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:#ffffff;text-decoration:none;">${escapeHtml(content.cta.label)}</a>
      </td></tr></table>`
    : ''

  const cell = `padding:8px 0;border-bottom:1px solid ${C.hairline};font-family:${SANS};font-size:14px;color:${C.ink};`
  const priceCell = `padding:8px 0 8px 12px;border-bottom:1px solid ${C.hairline};font-family:${MONO};font-size:14px;color:${C.ink};text-align:right;white-space:nowrap;`
  const itemRows = details.items
    .map(
      (i) => `<tr>
        <td style="${cell}">${escapeHtml(i.name)} <span style="color:${C.charcoal};font-family:${MONO};">× ${i.quantity}</span></td>
        <td style="${priceCell}">${brl(i.price * i.quantity)}</td>
      </tr>`
    )
    .join('')
  const shippingLabel = order.shipping_type === 'retirada' ? 'Retirada no local' : `Frete${order.shipping_service ? ` — ${escapeHtml(order.shipping_service)}` : ''}`

  const a = order.shipping_address
  const delivery =
    order.shipping_type === 'retirada'
      ? `<strong>Retirada no local:</strong><br>${PICKUP_INFO}`
      : a
        ? `<strong>Entrega em:</strong><br>${escapeHtml(`${a.street}, ${a.number}${a.complement ? ` — ${a.complement}` : ''}`)}<br>${escapeHtml(`${a.neighborhood} — ${a.city}/${a.state} — CEP ${a.cep}`)}`
        : ''

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(content.subject)}</title></head>
<body style="margin:0;padding:0;background:${C.paper};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper};padding:24px 12px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${C.raised};border:1px solid ${C.hairline};">
    <tr><td style="padding:28px 32px 18px;border-bottom:2px solid ${C.brass};text-align:center;">
      <a href="${SITE_URL}" style="font-family:${SERIF};font-style:italic;font-size:28px;color:${C.wine};text-decoration:none;">Studio Paper</a>
    </td></tr>
    <tr><td style="padding:28px 32px 8px;">
      <h1 style="margin:0 0 18px;font-family:${SERIF};font-weight:normal;font-size:24px;color:${C.ink};">${escapeHtml(content.heading)}</h1>
      ${greeting}
      ${content.bodyHtml}
      ${cta}
    </td></tr>
    <tr><td style="padding:0 32px 24px;">
      <p style="margin:0 0 6px;font-family:${SANS};font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:${C.wine};font-weight:bold;">Resumo do pedido #${shortId}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${itemRows}
        <tr>
          <td style="${cell}">${shippingLabel}</td>
          <td style="${priceCell}">${order.shipping_cost > 0 ? brl(order.shipping_cost) : 'Grátis'}</td>
        </tr>
        <tr>
          <td style="padding:12px 0 0;font-family:${SANS};font-size:15px;font-weight:bold;color:${C.ink};">Total</td>
          <td style="padding:12px 0 0 12px;font-family:${MONO};font-size:16px;font-weight:bold;color:${C.ink};text-align:right;white-space:nowrap;">${brl(order.total)}</td>
        </tr>
      </table>
      ${delivery ? `<p style="margin:20px 0 0;font-family:${SANS};font-size:14px;line-height:1.6;color:${C.charcoal};">${delivery}</p>` : ''}
    </td></tr>
    <tr><td style="padding:18px 32px 26px;border-top:1px solid ${C.hairline};font-family:${SANS};font-size:12px;line-height:1.6;color:#8a8a8a;">
      ${footerHtml}
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`
}

// Busca e-mail/nome do cliente e os itens com nome (produto ou título do orçamento).
async function loadDetails(admin: SupabaseClient, order: OrderForEmail) {
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(order.user_id!)
  const email = userData?.user?.email
  if (userError || !email) {
    console.error('Não foi possível obter o e-mail do cliente para o pedido', order.id, userError)
    return null
  }

  const [{ data: profile }, { data: rows }] = await Promise.all([
    admin.from('profiles').select('name').eq('id', order.user_id!).maybeSingle(),
    admin.from('order_items').select('product_id, custom_request_id, quantity, price_at_purchase').eq('order_id', order.id),
  ])
  const orderItems = rows ?? []

  const productIds = orderItems.map((r) => r.product_id).filter(Boolean)
  const quoteIds = orderItems.map((r) => r.custom_request_id).filter(Boolean)
  const [{ data: products }, { data: quotes }] = await Promise.all([
    productIds.length ? admin.from('products').select('id, name').in('id', productIds) : Promise.resolve({ data: [] }),
    quoteIds.length ? admin.from('quote_requests').select('id, title').in('id', quoteIds) : Promise.resolve({ data: [] }),
  ])
  const nameById = new Map<string, string>()
  for (const prod of products ?? []) nameById.set(prod.id, prod.name)
  for (const q of quotes ?? []) nameById.set(q.id, q.title)

  const details: EmailDetails = {
    firstName: profile?.name?.trim().split(/\s+/)[0] ?? null,
    items: orderItems.map((r) => ({
      name: nameById.get(r.product_id ?? r.custom_request_id) ?? 'Item personalizado',
      quantity: r.quantity,
      price: r.price_at_purchase,
    })),
    isQuoteOrder: quoteIds.length > 0,
  }
  return { email, details }
}

async function send(
  admin: SupabaseClient,
  order: OrderForEmail,
  buildContent: (details: EmailDetails) => EmailContent | null
) {
  if (!order.user_id) return
  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY não configurada — e-mail de pedido não enviado.')
    return
  }

  try {
    const loaded = await loadDetails(admin, order)
    if (!loaded) return
    const content = buildContent(loaded.details)
    if (!content) return

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Studio Paper <contato@studiopaper.com.br>',
        to: loaded.email,
        subject: content.subject,
        html: renderEmail(order, content, loaded.details),
      }),
    })

    if (!res.ok) {
      console.error('Resend recusou o envio:', await res.text())
    }
  } catch (err) {
    console.error('Falha ao enviar e-mail de pedido:', err)
  }
}

export function sendOrderStatusEmail(admin: SupabaseClient, order: OrderForEmail) {
  return send(admin, order, () => statusContent(order))
}

export function sendPaymentNoticeEmail(admin: SupabaseClient, order: OrderForEmail, notice: PaymentNotice) {
  return send(admin, order, (details) => noticeContent(order, notice, details))
}

// Aviso de venda para a loja: quem comprou, itens, total e entrega/retirada.
// Responder o e-mail vai direto para o cliente (reply_to).
export async function sendStoreNewOrderEmail(admin: SupabaseClient, order: OrderForEmail) {
  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY não configurada — aviso de venda não enviado.')
    return
  }
  try {
    const loaded = order.user_id ? await loadDetails(admin, order) : null
    const { data: profile } = order.user_id
      ? await admin.from('profiles').select('name, phone').eq('id', order.user_id).maybeSingle()
      : { data: null }
    const shortId = order.id.slice(0, 8)
    const customerName = profile?.name?.trim() || loaded?.email || 'Cliente sem cadastro'
    const phone = profile?.phone ? String(profile.phone) : ''
    const contact = [loaded?.email, phone].filter(Boolean).map((v) => escapeHtml(v!)).join(' · ')

    const content: EmailContent = {
      subject: `Nova venda — pedido #${shortId} — ${brl(order.total)}`,
      heading: 'Nova venda paga!',
      bodyHtml:
        p(`O pagamento do pedido <strong>#${shortId}</strong> foi aprovado pelo Mercado Pago.`) +
        p(`<strong>Cliente:</strong> ${escapeHtml(customerName)}${contact ? `<br>${contact}` : ''}`) +
        p(
          order.shipping_type === 'retirada'
            ? 'O cliente vai <strong>retirar no local</strong>.'
            : 'Depois de separar, gere a etiqueta no painel (pedido → "Gerar etiqueta").'
        ),
      cta: { label: 'Abrir pedidos no painel', url: `${SITE_URL}/admin/pedidos` },
    }
    const details: EmailDetails = {
      firstName: null,
      items: loaded?.details.items ?? [],
      isQuoteOrder: loaded?.details.isQuoteOrder ?? false,
    }
    const footer = `Aviso automático da loja. Responder este e-mail escreve para o cliente.`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Studio Paper <${STORE_EMAIL}>`,
        to: STORE_EMAIL,
        reply_to: loaded?.email || undefined,
        subject: content.subject,
        html: renderEmail(order, content, details, footer),
      }),
    })
    if (!res.ok) console.error('Resend recusou o aviso de venda:', await res.text())
  } catch (err) {
    console.error('Falha ao enviar aviso de venda:', err)
  }
}
