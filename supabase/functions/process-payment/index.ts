// Edge Function: process-payment
// Pagamento embutido no carrinho (Payment Brick do Mercado Pago). Ações:
//
// - create_order: grava o pedido "pendente" (preço e frete calculados no
//   servidor — _shared/checkoutOrder.ts) e devolve id + total para o Brick.
// - create_quote_order: o mesmo a partir de um orçamento com proposta
//   (_shared/quoteOrder.ts) — valor e frete vêm do orçamento no banco.
// - pay: recebe o formData do Brick (cartão já tokenizado pelo Mercado Pago,
//   ou Pix/boleto) e cria o pagamento na Payments API com o total DO BANCO —
//   o valor que vem do navegador é ignorado. Devolve id/status para o
//   Status Screen Brick mostrar o resultado (QR do Pix, boleto, aprovado...).
//
// A confirmação continua pelo mp-webhook (notification_url), que marca o
// pedido como pago, roda fulfill_order e manda os e-mails — igual ao Checkout Pro.
//
// Deploy: supabase functions deploy process-payment
// Secrets: MP_ACCESS_TOKEN (+ os do Melhor Envio, para recotar o frete).
//
// Documentação: https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/payment-brick/introduction

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { CheckoutError, createStoreOrder } from '../_shared/checkoutOrder.ts'
import { QuoteOrderError, createQuoteOrder } from '../_shared/quoteOrder.ts'

const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Mensagens do status_detail do Mercado Pago para cartão recusado.
const REJECTION_MESSAGES: Record<string, string> = {
  cc_rejected_insufficient_amount: 'Cartão sem limite suficiente.',
  cc_rejected_bad_filled_security_code: 'Código de segurança (CVV) incorreto.',
  cc_rejected_bad_filled_date: 'Data de validade incorreta.',
  cc_rejected_bad_filled_card_number: 'Número do cartão incorreto.',
  cc_rejected_bad_filled_other: 'Confira os dados do cartão.',
  cc_rejected_call_for_authorize: 'O banco pediu autorização: ligue para o emissor do cartão e tente de novo.',
  cc_rejected_card_disabled: 'Cartão desativado: ligue para o emissor para ativá-lo.',
  cc_rejected_duplicated_payment: 'Você já fez um pagamento com esse valor. Use outro cartão ou meio de pagamento.',
  cc_rejected_high_risk: 'Pagamento recusado por segurança. Tente outro cartão ou o Pix.',
  cc_rejected_max_attempts: 'Limite de tentativas atingido. Use outro cartão ou o Pix.',
}

// deno-lint-ignore no-explicit-any
type BrickFormData = Record<string, any>

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })
  }

  try {
    const body = await req.json()

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const {
      data: { user },
    } = await authClient.auth.getUser()
    if (!user) return jsonResponse({ error: 'É preciso estar logado para comprar.' }, 401)

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    if (body.action === 'create_order') {
      const { order } = await createStoreOrder(admin, user.id, body)
      return jsonResponse({ order_id: order.id, total: Number(order.total), payer_email: user.email })
    }

    if (body.action === 'create_quote_order') {
      const { order } = await createQuoteOrder(admin, user.id, body)
      return jsonResponse({ order_id: order.id, total: Number(order.total), payer_email: user.email })
    }

    if (body.action === 'pay') {
      const { order_id, form } = body as { order_id: string; form: BrickFormData }
      const { data: order } = await admin.from('orders').select('*').eq('id', order_id).single()
      if (!order || order.user_id !== user.id) return jsonResponse({ error: 'Pedido não encontrado.' }, 404)
      if (order.status !== 'pendente') return jsonResponse({ error: 'Esse pedido não está mais aguardando pagamento.' }, 400)
      if (!form?.payment_method_id) return jsonResponse({ error: 'Escolha uma forma de pagamento.' }, 400)

      const payment = {
        // Valor sempre do banco — o transaction_amount do formulário é ignorado.
        transaction_amount: Number(order.total),
        description: `Pedido #${order.id.slice(0, 8)} — Studio Paper`,
        payment_method_id: form.payment_method_id,
        token: form.token,
        installments: form.installments ? Number(form.installments) : undefined,
        issuer_id: form.issuer_id || undefined,
        payer: {
          ...form.payer,
          email: form.payer?.email || user.email,
        },
        external_reference: order.id,
        notification_url: `${SUPABASE_URL}/functions/v1/mp-webhook`,
        statement_descriptor: 'STUDIOPAPER',
      }

      const res = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
          // Obrigatório: evita pagamento em dobro se a requisição for repetida.
          'X-Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify(payment),
      })
      const data = await res.json()
      if (!res.ok) {
        console.error('Mercado Pago recusou a criação do pagamento:', res.status, JSON.stringify(data))
        return jsonResponse(
          { error: 'Não foi possível processar o pagamento. Confira os dados ou tente outra forma de pagamento.' },
          400
        )
      }

      return jsonResponse({
        payment_id: String(data.id),
        status: data.status,
        status_detail: data.status_detail,
        message:
          data.status === 'rejected'
            ? REJECTION_MESSAGES[data.status_detail] ?? 'Pagamento recusado. Tente outro cartão ou o Pix.'
            : null,
      })
    }

    return jsonResponse({ error: 'Ação inválida.' }, 400)
  } catch (err) {
    if (err instanceof CheckoutError) return jsonResponse({ error: err.message }, 400)
    if (err instanceof QuoteOrderError) return jsonResponse({ error: err.message }, err.status)
    console.error(err)
    return jsonResponse({ error: 'Erro inesperado ao processar o pagamento. Tente novamente.' }, 500)
  }
})
