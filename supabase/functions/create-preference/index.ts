// Edge Function: create-preference
// LEGADO: o carrinho agora paga embutido (process-payment). Fica no ar como
// plano B enquanto o pagamento embutido é validado em produção.
//
// Grava o pedido como "pendente" (_shared/checkoutOrder.ts — preço e frete
// calculados no servidor), cria a preferência no Mercado Pago com
// external_reference apontando pra esse pedido e devolve o init_point.
//
// Deploy: supabase functions deploy create-preference
// Configure o secret antes:
//   supabase secrets set MP_ACCESS_TOKEN=seu_access_token_de_producao
//
// Documentação: https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/landing

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { CheckoutError, createStoreOrder } from '../_shared/checkoutOrder.ts'

const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Chamada direto do navegador (supabase.functions.invoke) precisa de CORS,
// incluindo resposta ao preflight OPTIONS — sem isso o navegador bloqueia
// a requisição antes dela chegar aqui.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })
  }

  try {
    const body = await req.json()

    // Identifica quem está comprando a partir do token que o cliente já
    // manda automaticamente (supabase.functions.invoke inclui o Authorization).
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const {
      data: { user },
    } = await authClient.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'É preciso estar logado para comprar.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Grava o pedido com a service role — só o servidor pode criar pedidos,
    // o cliente não tem policy de insert em orders/order_items.
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { order, orderLines, shippingPrice, shippingName } = await createStoreOrder(admin, user.id, body)

    // Sem e-mail aqui: o cliente pode desistir no Mercado Pago. O primeiro aviso
    // sai do mp-webhook (Pix/boleto gerado, pagamento aprovado ou recusado).

    const preference = {
      items: [
        ...orderLines.map((l) => ({
          id: l.id,
          title: l.title,
          quantity: l.quantity,
          unit_price: l.unit_price,
          currency_id: 'BRL',
        })),
        // Retirada no local tem preço 0 — o Mercado Pago não aceita item
        // com unit_price zero, então omitimos a linha de frete nesse caso.
        ...(shippingPrice > 0
          ? [
              {
                id: 'frete',
                title: `Frete - ${shippingName}`,
                quantity: 1,
                unit_price: shippingPrice,
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
    return new Response(JSON.stringify({ init_point: data.init_point, order_id: order.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    if (err instanceof CheckoutError) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    console.error(err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
