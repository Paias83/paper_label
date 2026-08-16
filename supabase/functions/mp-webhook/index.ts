// Edge Function: mp-webhook
// Recebe a notificação do Mercado Pago quando o status de um pagamento
// muda. Se o pagamento foi aprovado, marca o pedido como "pago" e chama
// fulfill_order() no banco — que dá baixa no estoque pronto, empenha
// matéria-prima ou gera necessidade de compra, item por item.
//
// Deploy: supabase functions deploy mp-webhook --no-verify-jwt
// Configure a notification_url no Mercado Pago (ou já é enviada junto
// da preferência, em create-preference) apontando pra:
//   https://<projeto>.supabase.co/functions/v1/mp-webhook

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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

    if (payment.status === 'approved') {
      // Só processa uma vez: se já estava "pago", não roda o fulfillment de novo.
      // admin_seen_at volta a null pra sinalizar no painel que precisa de atenção.
      const { data: updated } = await admin
        .from('orders')
        .update({
          status: 'pago',
          mp_payment_id: String(paymentId),
          admin_seen_at: null,
          last_status_change_by: 'sistema',
        })
        .eq('id', orderId)
        .neq('status', 'pago')
        .select()
        .single()

      if (updated) {
        const { error: fulfillError } = await admin.rpc('fulfill_order', { p_order_id: orderId })
        if (fulfillError) console.error('fulfill_order falhou:', fulfillError)
      }
    } else if (payment.status === 'rejected' || payment.status === 'cancelled') {
      await admin
        .from('orders')
        .update({ status: 'cancelado', admin_seen_at: null, last_status_change_by: 'sistema' })
        .eq('id', orderId)
        .neq('status', 'pago')
    }

    return new Response('ok', { status: 200 })
  } catch (err) {
    console.error(err)
    // Sempre 200 — MP reenvia em loop se receber erro, e não queremos isso.
    return new Response('ok', { status: 200 })
  }
})
