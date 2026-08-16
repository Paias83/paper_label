// Edge Function: create-preference
// Grava o pedido (orders + order_items) como "pendente", cria a
// preferência de pagamento no Mercado Pago com external_reference
// apontando pra esse pedido, e devolve o init_point (URL de pagamento).
//
// Deploy: supabase functions deploy create-preference
// Configure o secret antes:
//   supabase secrets set MP_ACCESS_TOKEN=seu_access_token_de_producao
//
// Documentação: https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/landing

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

type IncomingItem = { id: string; title: string; quantity: number; unit_price: number }
type IncomingShipping = { type: 'entrega' | 'retirada'; service_name: string; price: number }
type IncomingAddress = {
  cep: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
}

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
    const { items, shipping, address } = (await req.json()) as {
      items: IncomingItem[]
      shipping: IncomingShipping
      address: IncomingAddress | null
    }
    if (!items?.length) {
      return new Response(JSON.stringify({ error: 'Carrinho vazio.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    // shipping.price pode ser 0 legitimamente (retirada no local), por isso
    // a validação checa presença do objeto/tipo, não o valor do preço.
    if (!shipping?.type || shipping.price == null) {
      return new Response(JSON.stringify({ error: 'Frete é obrigatório.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (shipping.type === 'entrega' && !address?.cep) {
      return new Response(JSON.stringify({ error: 'Endereço é obrigatório para entrega.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

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
    const itemsTotal = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0)
    const total = itemsTotal + shipping.price

    const { data: order, error: orderError } = await admin
      .from('orders')
      .insert({
        user_id: user.id,
        status: 'pendente',
        total,
        shipping_type: shipping.type,
        shipping_cep: shipping.type === 'entrega' ? address?.cep : null,
        shipping_address: shipping.type === 'entrega' ? address : null,
        shipping_cost: shipping.price,
        shipping_service: shipping.service_name,
      })
      .select()
      .single()
    if (orderError || !order) throw orderError ?? new Error('Falha ao criar pedido')

    const { error: itemsError } = await admin.from('order_items').insert(
      items.map((i) => ({
        order_id: order.id,
        product_id: i.id,
        quantity: i.quantity,
        price_at_purchase: i.unit_price,
      }))
    )
    if (itemsError) throw itemsError

    const preference = {
      items: [
        ...items.map((i) => ({
          id: i.id,
          title: i.title,
          quantity: i.quantity,
          unit_price: i.unit_price,
          currency_id: 'BRL',
        })),
        // Retirada no local tem preço 0 — o Mercado Pago não aceita item
        // com unit_price zero, então omitimos a linha de frete nesse caso.
        ...(shipping.price > 0
          ? [
              {
                id: 'frete',
                title: `Frete - ${shipping.service_name}`,
                quantity: 1,
                unit_price: shipping.price,
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
    return new Response(JSON.stringify({ init_point: data.init_point, order_id: order.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
