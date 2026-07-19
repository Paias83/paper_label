// Edge Function: create-preference
// Cria uma preferência de pagamento no Mercado Pago e devolve o init_point
// (URL pra onde o cliente é redirecionado pra pagar).
//
// Deploy: supabase functions deploy create-preference
// Configure o secret antes:
//   supabase secrets set MP_ACCESS_TOKEN=seu_access_token_de_producao
//
// Documentação: https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/landing

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'

const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN')!

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  try {
    const { items } = await req.json()

    const preference = {
      items: items.map((i: { id: string; title: string; quantity: number; unit_price: number }) => ({
        id: i.id,
        title: i.title,
        quantity: i.quantity,
        unit_price: i.unit_price,
        currency_id: 'BRL',
      })),
      back_urls: {
        success: `${req.headers.get('origin')}/checkout/sucesso`,
        failure: `${req.headers.get('origin')}/checkout/falha`,
        pending: `${req.headers.get('origin')}/checkout/pendente`,
      },
      auto_return: 'approved',
      // notification_url: aponte para outra Edge Function que recebe o webhook
      // e atualiza orders.status quando o pagamento é aprovado.
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
    return new Response(JSON.stringify({ init_point: data.init_point }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
