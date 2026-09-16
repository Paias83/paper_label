// Helper compartilhado entre mp-webhook e send-order-status-email — monta e
// manda o e-mail de status de pedido via API HTTP do Resend (não a SMTP que
// o Supabase Auth usa internamente, essa a aplicação não consegue chamar).
//
// Requer o secret RESEND_API_KEY: supabase secrets set RESEND_API_KEY=...

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SITE_URL = 'https://www.studiopaper.com.br'
const PICKUP_INFO = 'Rua Pion. Walcyr Bavelone, 362 — das 9h às 17h.'

type OrderForEmail = {
  id: string
  user_id: string | null
  status: string
  shipping_type: 'entrega' | 'retirada'
  shipping_service: string | null
  tracking_code: string | null
}

function contentFor(order: OrderForEmail): { subject: string; bodyHtml: string } | null {
  const shortId = order.id.slice(0, 8)

  switch (order.status) {
    case 'pendente':
      return {
        subject: 'Recebemos seu pedido!',
        bodyHtml: `<p>Recebemos seu pedido <strong>#${shortId}</strong> e estamos aguardando a confirmação do pagamento. Assim que for aprovado, te avisamos por aqui.</p>`,
      }
    case 'pago':
      return {
        subject: 'Pagamento confirmado! 🎉',
        bodyHtml: `<p>Recebemos o pagamento do seu pedido <strong>#${shortId}</strong> e já estamos preparando tudo com carinho.</p>`,
      }
    case 'enviado': {
      const tracking = order.tracking_code
        ? `<p><strong>Transportadora:</strong> ${order.shipping_service ?? '—'}<br><strong>Código de rastreio:</strong> ${order.tracking_code}</p>`
        : ''
      return {
        subject: 'Seu pedido foi enviado!',
        bodyHtml: `<p>Seu pedido <strong>#${shortId}</strong> foi enviado.</p>${tracking}`,
      }
    }
    case 'entregue':
      return {
        subject: 'Seu pedido foi entregue',
        bodyHtml: `<p>Seu pedido <strong>#${shortId}</strong> foi entregue. Esperamos que você ame! Obrigado pela preferência.</p>`,
      }
    case 'pronto_para_retirada':
      return {
        subject: 'Seu pedido está pronto para retirada!',
        bodyHtml: `<p>Seu pedido <strong>#${shortId}</strong> está pronto para retirada.</p><p><strong>Endereço:</strong> ${PICKUP_INFO}</p>`,
      }
    case 'retirado':
      return {
        subject: 'Retirada confirmada',
        bodyHtml: `<p>Confirmamos a retirada do seu pedido <strong>#${shortId}</strong>. Obrigado pela preferência!</p>`,
      }
    case 'cancelado':
      return {
        subject: 'Não conseguimos confirmar seu pagamento',
        bodyHtml: `<p>Seu pedido <strong>#${shortId}</strong> foi cancelado porque não conseguimos confirmar o pagamento. Se quiser, é só tentar novamente.</p>`,
      }
    default:
      return null
  }
}

export async function sendOrderStatusEmail(admin: SupabaseClient, order: OrderForEmail) {
  if (!order.user_id) return
  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY não configurada — e-mail de status não enviado.')
    return
  }

  const content = contentFor(order)
  if (!content) return

  try {
    const { data, error } = await admin.auth.admin.getUserById(order.user_id)
    const email = data?.user?.email
    if (error || !email) {
      console.error('Não foi possível obter o e-mail do cliente para o pedido', order.id, error)
      return
    }

    const html = `
      ${content.bodyHtml}
      <p><a href="${SITE_URL}/meus-pedidos">Ver meus pedidos</a></p>
      <p style="color:#8a8a8a;font-size:12px;">Dúvidas? Responda este e-mail ou fale com a gente em contato@studiopaper.com.br</p>
    `

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Studio Paper <contato@studiopaper.com.br>',
        to: email,
        subject: content.subject,
        html,
      }),
    })

    if (!res.ok) {
      console.error('Resend recusou o envio:', await res.text())
    }
  } catch (err) {
    console.error('Falha ao enviar e-mail de status de pedido:', err)
  }
}
