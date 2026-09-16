// Edge Function: send-order-status-email
// Chamada pelo admin (Orders.tsx) depois de trocar o status de um pedido
// manualmente — manda o e-mail de status correspondente pro cliente.
// Reusa o mesmo helper que o mp-webhook usa pra pagamentos via Mercado Pago.
//
// Deploy: supabase functions deploy send-order-status-email

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendOrderStatusEmail } from '../_shared/orderEmail.ts'

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
    const { order_id } = (await req.json()) as { order_id: string }
    if (!order_id) {
      return jsonResponse({ error: 'Pedido não informado.' }, 400)
    }

    // Só admin pode disparar — checa o papel de quem chamou usando o
    // próprio token (mesmo padrão de create-manual-order/update-manual-order).
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
      return jsonResponse({ error: 'Só administradores podem disparar esse e-mail.' }, 403)
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: order, error: orderError } = await admin.from('orders').select('*').eq('id', order_id).single()
    if (orderError || !order) {
      return jsonResponse({ error: 'Pedido não encontrado.' }, 404)
    }

    await sendOrderStatusEmail(admin, order)

    return jsonResponse({ ok: true })
  } catch (err) {
    console.error(err)
    return jsonResponse({ error: String(err) }, 500)
  }
})
