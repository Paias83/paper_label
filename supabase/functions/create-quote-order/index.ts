// Edge Function: create-quote-order
// Plano B (Checkout Pro, redireciona): só é usada se o site estiver sem a
// Public Key do Mercado Pago. O caminho normal é o pagamento embutido
// (process-payment, ação create_quote_order). Converte o orçamento em
// pedido (_shared/quoteOrder.ts) e devolve o init_point do Mercado Pago.
//
// Deploy: supabase functions deploy create-quote-order

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { QuoteOrderError, createQuoteOrder, type QuoteOrderAddress } from '../_shared/quoteOrder.ts'

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
      address: QuoteOrderAddress | null
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
    const { order, quote } = await createQuoteOrder(admin, user.id, { quote_request_id, shipping_type, address })
    const shippingCost = Number(order.shipping_cost)

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
      statement_descriptor: 'STUDIOPAPER',
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
    if (err instanceof QuoteOrderError) return jsonResponse({ error: err.message }, err.status)
    console.error(err)
    return jsonResponse({ error: String(err) }, 500)
  }
})
