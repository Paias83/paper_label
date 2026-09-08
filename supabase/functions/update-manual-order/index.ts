// Edge Function: update-manual-order
// Edita um pedido manual que ainda está "pendente" (antes do pagamento) —
// cliente pediu pra mudar item/endereço/quantidade e hoje só dava pra
// cancelar e recriar o pedido do zero. Só mexe em pedidos manuais e
// pendentes: depois de pago, o estoque/matéria-prima já foi baixado por
// fulfill_order() e editar os itens desincronizaria tudo.
//
// Deploy: supabase functions deploy update-manual-order

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
    const { order_id, customer_name, notes, items, shipping_type, address, shipping_cost, shipping_service, status } =
      (await req.json()) as {
        order_id: string
        customer_name: string | null
        notes: string | null
        items: IncomingItem[]
        shipping_type: 'entrega' | 'retirada'
        address: IncomingAddress | null
        shipping_cost: number
        shipping_service: string | null
        status: 'pendente' | 'pago'
      }

    if (!order_id) {
      return jsonResponse({ error: 'Pedido não informado.' }, 400)
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

    // Só admin pode editar pedido manual — checa o papel de quem chamou
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
      return jsonResponse({ error: 'Só administradores podem editar pedidos manuais.' }, 403)
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: existing, error: existingError } = await admin
      .from('orders')
      .select('id, source, status')
      .eq('id', order_id)
      .single()
    if (existingError || !existing) {
      return jsonResponse({ error: 'Pedido não encontrado.' }, 404)
    }
    if (existing.source !== 'manual' || existing.status !== 'pendente') {
      return jsonResponse(
        { error: 'Só é possível editar pedidos manuais que ainda estão pendentes de pagamento.' },
        400
      )
    }

    const itemsTotal = items.reduce((sum, i) => sum + i.price_at_purchase * i.quantity, 0)
    const total = itemsTotal + (shipping_type === 'entrega' ? shipping_cost : 0)

    const { error: deleteError } = await admin.from('order_items').delete().eq('order_id', order_id)
    if (deleteError) throw deleteError

    const { error: itemsError } = await admin.from('order_items').insert(
      items.map((i) => ({
        order_id,
        product_id: i.product_id,
        quantity: i.quantity,
        price_at_purchase: i.price_at_purchase,
      }))
    )
    if (itemsError) throw itemsError

    const { error: orderError } = await admin
      .from('orders')
      .update({
        customer_name: customer_name || null,
        notes: notes || null,
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
      .eq('id', order_id)
    if (orderError) throw orderError

    if (status === 'pago') {
      const { error: fulfillError } = await admin.rpc('fulfill_order', { p_order_id: order_id })
      if (fulfillError) console.error('fulfill_order falhou:', fulfillError)
    }

    return jsonResponse({ order_id })
  } catch (err) {
    console.error(err)
    return jsonResponse({ error: String(err) }, 500)
  }
})
