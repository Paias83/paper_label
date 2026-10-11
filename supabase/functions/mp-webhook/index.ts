// Edge Function: mp-webhook
// Recebe a notificação do Mercado Pago quando o status de um pagamento
// muda. Se o pagamento foi aprovado, marca o pedido como "pago" e chama
// fulfill_order() no banco — que dá baixa no estoque pronto, empenha
// matéria-prima ou gera necessidade de compra, item por item.
// Pix/boleto gerado, pagamento em análise ou cartão recusado só geram aviso
// por e-mail (pedido segue pendente); Pix/boleto vencido cancela o pedido.
//
// Deploy: supabase functions deploy mp-webhook --no-verify-jwt
// Configure a notification_url no Mercado Pago (ou já é enviada junto
// da preferência, em create-preference) apontando pra:
//   https://<projeto>.supabase.co/functions/v1/mp-webhook

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  sendOrderStatusEmail,
  sendPaymentNoticeEmail,
  sendStoreNewOrderEmail,
  type PaymentNotice,
} from '../_shared/orderEmail.ts'

const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Traduz o pagamento do MP no aviso por e-mail correspondente.
// deno-lint-ignore no-explicit-any
function noticeFor(payment: any): PaymentNotice {
  if (payment.status === 'rejected') return { kind: 'recusado' }
  if (payment.status === 'pending' && payment.payment_method_id === 'pix') {
    return {
      kind: 'aguardando_pix',
      paymentUrl: payment.point_of_interaction?.transaction_data?.ticket_url ?? null,
      expiresAt: payment.date_of_expiration ?? null,
    }
  }
  if (payment.status === 'pending' && payment.payment_type_id === 'ticket') {
    return {
      kind: 'aguardando_boleto',
      paymentUrl: payment.transaction_details?.external_resource_url ?? null,
      expiresAt: payment.date_of_expiration ?? null,
    }
  }
  return { kind: 'em_analise' }
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  try {
    const url = new URL(req.url)
    // Mercado Pago manda o id do pagamento tanto na query string (formato
    // legado ?topic=payment&id=X) quanto no corpo (formato novo).
    let paymentId = url.searchParams.get('id') ?? url.searchParams.get('data.id')
    if (!paymentId) {
      const body = await req.json().catch(() => null)
      paymentId = body?.data?.id ?? null
    }
    if (!paymentId) {
      return new Response('ok', { status: 200 })
    }

    const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    })
    const payment = await paymentRes.json()
    const orderId = payment.external_reference
    if (!orderId) {
      return new Response('ok', { status: 200 })
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const pid = String(paymentId)

    if (payment.status === 'approved') {
      // Confere o valor pago com o total do pedido (gravado pelo servidor). Pagamento
      // menor = preferência adulterada: não libera o pedido, só sinaliza no painel.
      const { data: current } = await admin.from('orders').select('total').eq('id', orderId).maybeSingle()
      if (current && Number(payment.transaction_amount) + 0.01 < Number(current.total)) {
        console.error(
          `Pagamento ${pid} do pedido ${orderId} veio com R$ ${payment.transaction_amount}, total é R$ ${current.total} — não marcado como pago.`
        )
        await admin
          .from('orders')
          .update({ mp_payment_id: pid, admin_seen_at: null, last_status_change_by: 'sistema' })
          .eq('id', orderId)
        return new Response('ok', { status: 200 })
      }

      // Só processa uma vez: o pedido precisa estar pendente (ou cancelado, caso o
      // cliente pague depois). Se já foi pago/enviado/entregue, uma notificação
      // repetida do MP não pode voltar o status nem rodar o fulfillment de novo.
      // admin_seen_at volta a null pra sinalizar no painel que precisa de atenção.
      const { data: updated } = await admin
        .from('orders')
        .update({
          status: 'pago',
          mp_payment_id: pid,
          admin_seen_at: null,
          last_status_change_by: 'sistema',
        })
        .eq('id', orderId)
        .in('status', ['pendente', 'cancelado'])
        .select()
        .maybeSingle()

      if (updated) {
        const { error: fulfillError } = await admin.rpc('fulfill_order', { p_order_id: orderId })
        if (fulfillError) console.error('fulfill_order falhou:', fulfillError)
        await Promise.all([sendOrderStatusEmail(admin, updated), sendStoreNewOrderEmail(admin, updated)])
      }
    } else if (['pending', 'in_process', 'authorized', 'rejected'].includes(payment.status)) {
      // Tentativa de pagamento que não fecha o pedido (Pix/boleto gerado, em análise,
      // cartão recusado). O pedido continua pendente — no Checkout Pro o cliente pode
      // tentar de novo. Grava o id da tentativa e só avisa uma vez por pagamento
      // (o MP manda várias notificações para o mesmo pagamento).
      const { data: marked } = await admin
        .from('orders')
        .update({ mp_payment_id: pid })
        .eq('id', orderId)
        .eq('status', 'pendente')
        .or(`mp_payment_id.is.null,mp_payment_id.neq.${pid}`)
        .select()
        .maybeSingle()

      if (marked) await sendPaymentNoticeEmail(admin, marked, noticeFor(payment))
    } else if (payment.status === 'cancelled') {
      // Pix/boleto vencido. Só cancela se essa for a última tentativa do cliente —
      // se ele gerou outro Pix ou pagou com cartão depois, o pedido segue.
      const { data: cancelled } = await admin
        .from('orders')
        .update({ status: 'cancelado', admin_seen_at: null, last_status_change_by: 'sistema' })
        .eq('id', orderId)
        .eq('status', 'pendente')
        .or(`mp_payment_id.is.null,mp_payment_id.eq.${pid}`)
        .select()
        .maybeSingle()

      if (cancelled) await sendOrderStatusEmail(admin, cancelled)
    }

    return new Response('ok', { status: 200 })
  } catch (err) {
    console.error(err)
    // Sempre 200 — MP reenvia em loop se receber erro, e não queremos isso.
    return new Response('ok', { status: 200 })
  }
})
