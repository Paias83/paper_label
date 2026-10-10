// Edge Function: calculate-shipping
// Recebe o CEP de destino + itens do carrinho e cota o frete real na API do
// Melhor Envio (lógica em _shared/melhorEnvio.ts — peso/medidas/preço vêm do banco).
//
// Deploy: supabase functions deploy calculate-shipping
// Configure os secrets antes:
//   supabase secrets set MELHOR_ENVIO_TOKEN=seu_token STORE_ORIGIN_CEP=seu_cep
//
// Documentação: https://docs.melhorenvio.com.br/reference/calculo-de-fretes-por-produtos

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { quoteShipping, ShippingQuoteError, type ShippingQuoteItem } from '../_shared/melhorEnvio.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

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
      items: ShippingQuoteItem[]
    }
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    const options = await quoteShipping(client, cep_destino, items)
    return jsonResponse({ options })
  } catch (err) {
    if (err instanceof ShippingQuoteError) return jsonResponse({ error: err.message }, 400)
    console.error(err)
    return jsonResponse({ error: String(err) }, 500)
  }
})
