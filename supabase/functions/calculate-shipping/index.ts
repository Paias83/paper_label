// Edge Function: calculate-shipping
// Recebe o CEP de destino + itens do carrinho, busca peso/dimensões/preço
// de cada produto no banco (nunca confia no que o cliente manda) e cota
// o frete real na API do Melhor Envio.
//
// Deploy: supabase functions deploy calculate-shipping
// Configure os secrets antes:
//   supabase secrets set MELHOR_ENVIO_TOKEN=seu_token STORE_ORIGIN_CEP=seu_cep
//
// Documentação: https://docs.melhorenvio.com.br/reference/calculo-de-fretes-por-produtos

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MELHOR_ENVIO_TOKEN = Deno.env.get('MELHOR_ENVIO_TOKEN')!
const STORE_ORIGIN_CEP = Deno.env.get('STORE_ORIGIN_CEP')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

type IncomingItem = { product_id: string; quantity: number }

// Mesmo padrão de CORS do create-preference — chamada direto do navegador
// via supabase.functions.invoke precisa responder ao preflight OPTIONS.
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
    const { cep_destino, items } = (await req.json()) as {
      cep_destino: string
      items: IncomingItem[]
    }

    const cepDigits = (cep_destino ?? '').replace(/\D/g, '')
    if (cepDigits.length !== 8) {
      return jsonResponse({ error: 'CEP de destino inválido.' }, 400)
    }
    if (!items?.length) {
      return jsonResponse({ error: 'Carrinho vazio.' }, 400)
    }

    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    const productIds = items.map((i) => i.product_id)
    const { data: products, error: productsError } = await client
      .from('products')
      .select('id, price, weight_kg, width_cm, height_cm, length_cm')
      .in('id', productIds)
    if (productsError) throw productsError

    const meProducts = items.map((item) => {
      const product = products?.find((p) => p.id === item.product_id)
      if (!product) throw new Error(`Produto não encontrado: ${item.product_id}`)
      return {
        id: product.id,
        width: product.width_cm,
        height: product.height_cm,
        length: product.length_cm,
        weight: product.weight_kg,
        insurance_value: product.price,
        quantity: item.quantity,
      }
    })

    const res = await fetch('https://melhorenvio.com.br/api/v2/me/shipment/calculate', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MELHOR_ENVIO_TOKEN}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'Studio Paper (contato@studiopaper.com.br)',
      },
      body: JSON.stringify({
        from: { postal_code: STORE_ORIGIN_CEP },
        to: { postal_code: cepDigits },
        products: meProducts,
      }),
    })

    const data = await res.json()
    if (!Array.isArray(data)) {
      console.error('Resposta inesperada do Melhor Envio:', data)
      return jsonResponse({ error: 'Não foi possível calcular o frete no momento.' }, 502)
    }

    // A API devolve entradas com "error" pra serviços indisponíveis
    // pra essa rota/pacote (ex: transportadora não atende a região) —
    // filtra pra só devolver opções realmente cotadas.
    const options = data
      .filter((opt) => !opt.error && opt.price)
      .map((opt) => ({
        id: opt.id,
        name: opt.name,
        price: Number(opt.custom_price ?? opt.price),
        delivery_time: opt.custom_delivery_time ?? opt.delivery_time,
        company: opt.company?.name ?? '',
      }))

    return jsonResponse({ options })
  } catch (err) {
    console.error(err)
    return jsonResponse({ error: String(err) }, 500)
  }
})
