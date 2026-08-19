// Edge Function: create-manual-order
// Cria um pedido direto pelo admin (venda por telefone, presencial, etc.)
// sem passar pelo Mercado Pago — mesmo motor de create-preference, mas
// quem chama precisa ser admin, e o pedido pode já nascer "pago", o que
// dispara fulfill_order() na hora (mesma lógica de baixa de estoque
// pronto / empenho de matéria-prima / necessidade de compra que o
// mp-webhook usa quando um pagamento é aprovado).
//
// Deploy: supabase functions deploy create-manual-order

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

type IncomingItem = { product_id: string; quantity: number; price_at_purchase: number }
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
    const { customer_name, items, shipping_type, address, shipping_cost, shipping_service, status } =
      (await req.json()) as {
        customer_name: string | null
        items: IncomingItem[]
        shipping_type: 'entrega' | 'retirada'
        address: IncomingAddress | null
        shipping_cost: number
        shipping_service: string | null
        status: 'pendente' | 'pago'
      }

    if (!items?.length) {
      return jsonResponse({ error: 'Adicione ao menos um item ao pedido.' }, 400)
    }
    if (shipping_type === 'entrega' && !address?.cep) {
      return jsonResponse({ error: 'Endereço é obrigatório para entrega.' }, 400)
    }
    if (status !== 'pendente' && status !== 'pago') {
      return jsonResponse({ error: 'Status inválido.' }, 400)
    }

    // Só admin pode criar pedido manual — checa o papel de quem chamou
    // usando o próprio token (RLS de profiles já restringe a linha dele).
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const {
      data: { user },
    } = await authClient.auth.getUser()
    if (!user) {
      return jsonResponse({ error: 'É preciso estar logado.' }, 401)
    }
    const { data: profile } = await authClient.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') {
      return jsonResponse({ error: 'Só administradores podem criar pedidos manuais.' }, 403)
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const itemsTotal = items.reduce((sum, i) => sum + i.price_at_purchase * i.quantity, 0)
    const total = itemsTotal + (shipping_type === 'entrega' ? shipping_cost : 0)

    const { data: order, error: orderError } = await admin
      .from('orders')
      .insert({
        user_id: null,
        customer_name: customer_name || null,
        source: 'manual',
        status,
        total,
        shipping_type,
        shipping_cep: shipping_type === 'entrega' ? address?.cep : null,
        shipping_address: shipping_type === 'entrega' ? address : null,
        shipping_cost: shipping_type === 'entrega' ? shipping_cost : 0,
        shipping_service: shipping_type === 'entrega' ? shipping_service : 'Retirada no local',
        last_status_change_by: 'admin',
        admin_seen_at: new Date().toISOString(),
      })
      .select()
      .single()
    if (orderError || !order) throw orderError ?? new Error('Falha ao criar pedido')

    const { error: itemsError } = await admin.from('order_items').insert(
      items.map((i) => ({
        order_id: order.id,
        product_id: i.product_id,
        quantity: i.quantity,
        price_at_purchase: i.price_at_purchase,
      }))
    )
    if (itemsError) throw itemsError

    if (status === 'pago') {
      const { error: fulfillError } = await admin.rpc('fulfill_order', { p_order_id: order.id })
      if (fulfillError) console.error('fulfill_order falhou:', fulfillError)
    }

    return jsonResponse({ order_id: order.id })
  } catch (err) {
    console.error(err)
    return jsonResponse({ error: String(err) }, 500)
  }
})
