// Edge Function: create-preference
// Grava o pedido (orders + order_items) como "pendente", cria a
// preferência de pagamento no Mercado Pago com external_reference
// apontando pra esse pedido, e devolve o init_point (URL de pagamento).
//
// Segurança: do navegador só se aproveitam ids, quantidades, o serviço de
// frete escolhido e o endereço. Preço/nome dos produtos vêm do banco e o
// frete é recotado no Melhor Envio aqui — senão dava pra pagar R$ 1 em tudo.
//
// Deploy: supabase functions deploy create-preference
// Configure o secret antes:
//   supabase secrets set MP_ACCESS_TOKEN=seu_access_token_de_producao
//
// Documentação: https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/landing

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { quoteShipping, ShippingQuoteError } from '../_shared/melhorEnvio.ts'

const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// title/unit_price ainda vêm do Cart.tsx, mas são ignorados (ver cabeçalho).
type IncomingItem = { id: string; quantity: number }
// service_name/price também são ignorados: o frete é recotado pelo service_id.
type IncomingShipping = { type: 'entrega' | 'retirada'; service_id?: number }
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
    if (shipping?.type !== 'entrega' && shipping?.type !== 'retirada') {
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

    if (items.some((i) => !Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 999)) {
      return new Response(JSON.stringify({ error: 'Quantidade inválida no carrinho.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { data: dbProducts, error: productsError } = await admin
      .from('products')
      .select('id, name, price, active')
      .in(
        'id',
        items.map((i) => i.id)
      )
    if (productsError) throw productsError
    const lines = items.map((i) => {
      const product = dbProducts?.find((p) => p.id === i.id)
      return product?.active
        ? { id: product.id, title: product.name as string, quantity: i.quantity, unit_price: Number(product.price) }
        : null
    })
    if (lines.some((l) => !l)) {
      return new Response(
        JSON.stringify({ error: 'Algum produto do carrinho não está mais disponível. Remova-o e tente de novo.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const orderLines = lines as NonNullable<(typeof lines)[number]>[]

    // Frete: retirada é grátis; entrega é recotada e o preço sai do Melhor Envio.
    let shippingPrice = 0
    let shippingName = 'Retirada no local'
    let shippingServiceId: number | null = null
    if (shipping.type === 'entrega') {
      const options = await quoteShipping(
        admin,
        address!.cep,
        orderLines.map((l) => ({ product_id: l.id, quantity: l.quantity }))
      )
      const chosen = options.find((o) => o.id === shipping.service_id)
      if (!chosen) {
        return new Response(
          JSON.stringify({ error: 'O frete escolhido não está mais disponível. Calcule o frete de novo.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      shippingPrice = chosen.price
      shippingName = chosen.name
      shippingServiceId = chosen.id
    }

    const itemsTotal = orderLines.reduce((sum, l) => sum + l.unit_price * l.quantity, 0)
    const total = Math.round((itemsTotal + shippingPrice) * 100) / 100

    const { data: order, error: orderError } = await admin
      .from('orders')
      .insert({
        user_id: user.id,
        status: 'pendente',
        total,
        shipping_type: shipping.type,
        shipping_cep: shipping.type === 'entrega' ? address?.cep : null,
        shipping_address: shipping.type === 'entrega' ? address : null,
        shipping_cost: shippingPrice,
        shipping_service: shippingName,
        // Id do serviço no Melhor Envio — pré-seleciona o serviço na hora de gerar a etiqueta.
        shipping_service_id: shippingServiceId,
      })
      .select()
      .single()
    if (orderError || !order) throw orderError ?? new Error('Falha ao criar pedido')

    const { error: itemsError } = await admin.from('order_items').insert(
      orderLines.map((l) => ({
        order_id: order.id,
        product_id: l.id,
        quantity: l.quantity,
        price_at_purchase: l.unit_price,
      }))
    )
    if (itemsError) throw itemsError

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
    if (err instanceof ShippingQuoteError) {
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
