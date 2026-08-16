// Edge Function: create-quote-order
// Converte um orçamento aprovado (quote_requests com status
// 'proposta_enviada') em um pedido de verdade: cria orders +
// order_items (sem product_id, ligado por custom_request_id),
// marca o orçamento como 'aprovado' e devolve o init_point de
// pagamento no Mercado Pago — mesmo motor de create-preference,
// só que a partir de um orçamento em vez do carrinho.
//
// Deploy: supabase functions deploy create-quote-order

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

type IncomingAddress = {
  cep: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
}

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })
  }

  try {
    const { quote_request_id, shipping_type, address } = (await req.json()) as {
      quote_request_id: string
      shipping_type: 'entrega' | 'retirada'
      address: IncomingAddress | null
    }
    if (!quote_request_id) {
      return jsonResponse({ error: 'Orçamento é obrigatório.' }, 400)
    }
    if (shipping_type === 'entrega' && !address?.cep) {
      return jsonResponse({ error: 'Endereço é obrigatório para entrega.' }, 400)
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const {
      data: { user },
    } = await authClient.auth.getUser()
    if (!user) {
      return jsonResponse({ error: 'É preciso estar logado.' }, 401)
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: quote, error: quoteError } = await admin
      .from('quote_requests')
      .select('*')
      .eq('id', quote_request_id)
      .single()
    if (quoteError || !quote) {
      return jsonResponse({ error: 'Orçamento não encontrado.' }, 404)
    }
    if (quote.user_id !== user.id) {
      return jsonResponse({ error: 'Esse orçamento não pertence a essa conta.' }, 403)
    }
    if (quote.status !== 'proposta_enviada' || quote.final_price == null) {
      return jsonResponse({ error: 'Esse orçamento ainda não tem uma proposta pra aprovar.' }, 400)
    }

    // Retirada no local sempre é grátis, mesmo que um frete tenha sido
    // negociado na conversa — o cliente decide o método na hora de aprovar.
    const shippingCost = shipping_type === 'retirada' ? 0 : quote.shipping_cost ?? 0
    const total = quote.final_price + shippingCost

    const { data: order, error: orderError } = await admin
      .from('orders')
      .insert({
        user_id: user.id,
        status: 'pendente',
        total,
        shipping_type,
        shipping_cep: shipping_type === 'entrega' ? address?.cep : null,
        shipping_address: shipping_type === 'entrega' ? address : null,
        shipping_cost: shippingCost,
        shipping_service: shipping_type === 'retirada' ? 'Retirada no local' : 'Combinado no orçamento',
      })
      .select()
      .single()
    if (orderError || !order) throw orderError ?? new Error('Falha ao criar pedido')

    const { error: itemError } = await admin.from('order_items').insert({
      order_id: order.id,
      product_id: null,
      custom_request_id: quote.id,
      quantity: 1,
      price_at_purchase: quote.final_price,
    })
    if (itemError) throw itemError

    await admin
      .from('quote_requests')
      .update({ status: 'aprovado', order_id: order.id })
      .eq('id', quote.id)

    const preference = {
      items: [
        {
          id: 'orcamento',
          title: quote.title,
          quantity: 1,
          unit_price: quote.final_price,
          currency_id: 'BRL',
        },
        // Mercado Pago não aceita item com unit_price zero — omite a linha
        // de frete quando é retirada no local.
        ...(shippingCost > 0
          ? [
              {
                id: 'frete',
                title: 'Frete - Combinado no orçamento',
                quantity: 1,
                unit_price: shippingCost,
                currency_id: 'BRL',
              },
            ]
          : []),
      ],
      external_reference: order.id,
      notification_url: `${SUPABASE_URL}/functions/v1/mp-webhook`,
      back_urls: {
        success: `${req.headers.get('origin')}/checkout/sucesso`,
        failure: `${req.headers.get('origin')}/checkout/falha`,
        pending: `${req.headers.get('origin')}/checkout/pendente`,
      },
      auto_return: 'approved',
    }

    const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preference),
    })

    const data = await res.json()
    return jsonResponse({ init_point: data.init_point, order_id: order.id })
  } catch (err) {
    console.error(err)
    return jsonResponse({ error: String(err) }, 500)
  }
})
