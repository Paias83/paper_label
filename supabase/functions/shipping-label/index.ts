// Edge Function: shipping-label
// Etiquetas de envio pelo Melhor Envio, chamada pelo admin (Orders.tsx /
// ShippingLabelModal.tsx). Só admin pode chamar (role checado pelo JWT).
//
// Ações (campo "action" no body):
// - preview: recota o frete do pedido e devolve serviços, pacote, remetente
//   (cadastro da conta no Melhor Envio), destinatário e saldo da carteira.
// - buy:     carrinho → compra com o saldo da carteira → gera a etiqueta;
//            grava label_* no pedido e o código de rastreio (se já disponível).
// - print:   links da etiqueta (PDF) e da declaração de conteúdo (DACE);
//            aproveita para buscar o rastreio se ainda não veio.
// - cancel:  cancela a etiqueta (estorno do Melhor Envio em até 12h).
//
// Envio sem nota fiscal: non_commercial = true — o Melhor Envio emite a
// declaração de conteúdo eletrônica (DC-e) e o DACE precisa ir junto do pacote.
//
// Deploy: supabase functions deploy shipping-label
// Usa o mesmo secret do calculate-shipping (MELHOR_ENVIO_TOKEN, STORE_ORIGIN_CEP).
// O token precisa das permissões de carrinho, compra, geração, impressão,
// rastreio, cancelamento e leitura de usuário/saldo (ver CLAUDE.md).

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isSupportedCompany } from '../_shared/melhorEnvio.ts'

const MELHOR_ENVIO_TOKEN = Deno.env.get('MELHOR_ENVIO_TOKEN')!
const STORE_ORIGIN_CEP = Deno.env.get('STORE_ORIGIN_CEP')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const ME_API = 'https://melhorenvio.com.br/api/v2/me'
// Pacote genérico para itens sem medidas (orçamentos) — mesmo padrão do resto da loja.
const GENERIC_PACKAGE = { weight: 0.3, width: 16, height: 4, length: 16 }

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

class UserError extends Error {}

const digits = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '')

// deno-lint-ignore no-explicit-any
async function me(path: string, init: { method?: string; body?: unknown } = {}): Promise<any> {
  const res = await fetch(`${ME_API}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${MELHOR_ENVIO_TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'Studio Paper (contato@studiopaper.com.br)',
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  })
  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!res.ok) {
    console.error(`Melhor Envio ${init.method ?? 'GET'} ${path} → ${res.status}`, text)
    throw new UserError(meErrorMessage(res.status, data))
  }
  return data
}

// Transforma o erro do Melhor Envio em algo que o admin entenda.
function meErrorMessage(status: number, data: unknown): string {
  if (status === 401) return 'O token do Melhor Envio expirou ou é inválido. Gere um novo no painel do Melhor Envio.'
  if (status === 403) return 'O token do Melhor Envio não tem permissão para essa ação. Gere um token com todas as permissões de envio.'
  // deno-lint-ignore no-explicit-any
  const d = data as any
  const details = d?.errors
    ? Object.values(d.errors).flat().join(' ')
    : d?.error ?? d?.message ?? ''
  const text = String(details)
  if (/saldo|balance|insuficiente/i.test(text)) return 'Saldo insuficiente na carteira do Melhor Envio. Adicione saldo e tente de novo.'
  return text ? `Melhor Envio: ${text}` : `Erro do Melhor Envio (${status}).`
}

async function loadOrder(admin: SupabaseClient, orderId: string) {
  const { data: order } = await admin.from('orders').select('*').eq('id', orderId).single()
  if (!order) throw new UserError('Pedido não encontrado.')
  if (order.shipping_type !== 'entrega') throw new UserError('Pedido de retirada no local não tem etiqueta.')
  if (!order.shipping_address?.cep) throw new UserError('Pedido sem endereço de entrega.')
  return order
}

async function loadItems(admin: SupabaseClient, orderId: string) {
  const { data: rows } = await admin
    .from('order_items')
    .select('product_id, custom_request_id, quantity, price_at_purchase')
    .eq('order_id', orderId)
  const items = rows ?? []
  const productIds = items.map((r) => r.product_id).filter(Boolean)
  const quoteIds = items.map((r) => r.custom_request_id).filter(Boolean)
  const [{ data: products }, { data: quotes }] = await Promise.all([
    productIds.length
      ? admin.from('products').select('id, name, weight_kg, width_cm, height_cm, length_cm').in('id', productIds)
      : Promise.resolve({ data: [] }),
    quoteIds.length ? admin.from('quote_requests').select('id, title').in('id', quoteIds) : Promise.resolve({ data: [] }),
  ])
  return items.map((r) => {
    const product = (products ?? []).find((p) => p.id === r.product_id)
    const quote = (quotes ?? []).find((q) => q.id === r.custom_request_id)
    return {
      name: product?.name ?? quote?.title ?? 'Item personalizado',
      quantity: r.quantity as number,
      unit_price: Number(r.price_at_purchase),
      dims: product
        ? { weight: product.weight_kg, width: product.width_cm, height: product.height_cm, length: product.length_cm }
        : GENERIC_PACKAGE,
    }
  })
}

// Remetente = cadastro da conta no Melhor Envio (nome, CPF, telefone, endereço).
// Assim nenhum dado pessoal do dono fica no repositório público.
async function loadSender() {
  const u = await me('')
  const a = u?.address ?? {}
  const sender = {
    name: [u?.firstname, u?.lastname].filter(Boolean).join(' ').trim(),
    email: u?.email ?? '',
    phone: digits(u?.phone?.phone ?? u?.phone),
    document: digits(u?.document),
    address: a.address ?? '',
    number: a.number ?? '',
    complement: a.complement ?? '',
    district: a.district ?? '',
    city: a.city?.city ?? '',
    state_abbr: a.city?.state?.state_abbr ?? '',
    postal_code: digits(a.postal_code) || digits(STORE_ORIGIN_CEP),
    country_id: 'BR',
  }
  const missing = [
    !sender.name && 'nome',
    sender.document.length !== 11 && sender.document.length !== 14 && 'CPF',
    !sender.address && 'endereço',
    !sender.number && 'número',
    !sender.city && 'cidade',
  ].filter(Boolean)
  return { sender, missing }
}

async function handlePreview(admin: SupabaseClient, orderId: string) {
  const order = await loadOrder(admin, orderId)
  const items = await loadItems(admin, orderId)

  const [quote, senderInfo, balance, profileRes] = await Promise.all([
    me('/shipment/calculate', {
      method: 'POST',
      body: {
        from: { postal_code: digits(STORE_ORIGIN_CEP) },
        to: { postal_code: digits(order.shipping_address.cep) },
        products: items.map((i, idx) => ({
          id: String(idx),
          ...i.dims,
          insurance_value: i.unit_price,
          quantity: i.quantity,
        })),
      },
    }),
    loadSender(),
    me('/balance').catch(() => null),
    order.user_id
      ? admin.from('profiles').select('name, email, phone, cpf').eq('id', order.user_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  // deno-lint-ignore no-explicit-any
  const options = (Array.isArray(quote) ? quote : [])
    .filter((o: any) => !o.error && o.price)
    .filter((o: any) => isSupportedCompany(o.company?.name))
    .map((o: any) => {
      const pkg = o.packages?.[0]
      return {
        id: o.id,
        name: o.name,
        company: o.company?.name ?? '',
        price: Number(o.custom_price ?? o.price),
        delivery_time: o.custom_delivery_time ?? o.delivery_time,
        packages: o.packages?.length ?? 1,
        volume: pkg
          ? {
              height: Number(pkg.dimensions?.height),
              width: Number(pkg.dimensions?.width),
              length: Number(pkg.dimensions?.length),
              weight: Number(pkg.weight),
            }
          : null,
      }
    })

  const selected =
    options.find((o) => o.id === order.shipping_service_id) ??
    options.find((o) => order.shipping_service && order.shipping_service.toLowerCase().includes(o.name.toLowerCase())) ??
    options[0] ??
    null

  const profile = profileRes.data
  return {
    options,
    selected_service_id: selected?.id ?? null,
    sender: senderInfo.sender,
    sender_missing: senderInfo.missing,
    balance: balance ? Number(balance.balance ?? 0) : null,
    recipient: {
      name: profile?.name ?? order.customer_name ?? '',
      document: digits(profile?.cpf),
      phone: digits(profile?.phone),
      email: profile?.email ?? '',
    },
    items: items.map((i) => ({ name: i.name, quantity: i.quantity, unit_price: i.unit_price })),
    customer_paid_shipping: Number(order.shipping_cost),
  }
}

type BuyInput = {
  service_id: number
  recipient: { name: string; document: string; phone: string; email: string }
  volume: { height: number; width: number; length: number; weight: number }
}

async function handleBuy(admin: SupabaseClient, orderId: string, input: BuyInput) {
  const order = await loadOrder(admin, orderId)
  if (order.label_me_id) throw new UserError('Esse pedido já tem etiqueta. Cancele a atual para gerar outra.')
  if (!['pago', 'enviado'].includes(order.status)) throw new UserError('Só dá para gerar etiqueta de pedido pago.')

  const r = input.recipient
  if (!r?.name?.trim()) throw new UserError('Informe o nome do destinatário.')
  if (digits(r.document).length !== 11 && digits(r.document).length !== 14) {
    throw new UserError('Informe o CPF (ou CNPJ) do destinatário — é obrigatório na declaração de conteúdo.')
  }
  const v = input.volume
  if (!(v?.height > 0 && v?.width > 0 && v?.length > 0 && v?.weight > 0)) {
    throw new UserError('Informe as medidas e o peso do pacote.')
  }

  const items = await loadItems(admin, orderId)
  const { sender, missing } = await loadSender()
  if (missing.length) {
    throw new UserError(`Complete o cadastro da sua conta no Melhor Envio (falta: ${missing.join(', ')}).`)
  }

  const a = order.shipping_address
  const doc = digits(r.document)
  const insurance = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0)

  const cart = await me('/cart', {
    method: 'POST',
    body: {
      service: input.service_id,
      from: {
        ...sender,
        document: sender.document.length === 11 ? sender.document : '',
        company_document: sender.document.length === 14 ? sender.document : '',
        state_register: '',
      },
      to: {
        name: r.name.trim(),
        email: r.email ?? '',
        phone: digits(r.phone),
        document: doc.length === 11 ? doc : '',
        company_document: doc.length === 14 ? doc : '',
        state_register: 'ISENTO',
        address: a.street,
        number: a.number,
        complement: a.complement ?? '',
        district: a.neighborhood,
        city: a.city,
        state_abbr: a.state,
        postal_code: digits(a.cep),
        country_id: 'BR',
      },
      products: items.map((i) => ({
        name: i.name,
        quantity: String(i.quantity),
        unitary_value: i.unit_price.toFixed(2),
      })),
      volumes: [
        {
          height: Math.round(v.height),
          width: Math.round(v.width),
          length: Math.round(v.length),
          weight: v.weight,
        },
      ],
      options: {
        insurance_value: Number(insurance.toFixed(2)),
        receipt: false,
        own_hand: false,
        reverse: false,
        non_commercial: true,
        platform: 'Studio Paper',
        tags: [{ tag: order.id.slice(0, 8), url: null }],
      },
    },
  })
  const meId: string = cart.id

  // Se a compra falhar (ex: saldo insuficiente), tira do carrinho do Melhor Envio
  // para não acumular etiquetas abandonadas lá.
  try {
    await me('/shipment/checkout', { method: 'POST', body: { orders: [meId] } })
  } catch (err) {
    await me(`/cart/${meId}`, { method: 'DELETE' }).catch(() => {})
    throw err
  }

  // Daqui em diante a etiqueta já foi paga: grava no pedido antes de qualquer
  // outra coisa, para não perder o vínculo se a geração falhar.
  await admin
    .from('orders')
    .update({ label_me_id: meId, label_cost: Number(cart.price), label_created_at: new Date().toISOString() })
    .eq('id', orderId)

  const generated = await me('/shipment/generate', { method: 'POST', body: { orders: [meId] } })
  if (generated?.[meId]?.status === false) {
    throw new UserError(
      `Etiqueta paga, mas o Melhor Envio não conseguiu gerá-la: ${generated[meId].message ?? 'erro desconhecido'}. Tente "Imprimir" daqui a pouco ou veja no painel do Melhor Envio.`
    )
  }

  return await handlePrint(admin, orderId)
}

async function refreshTracking(admin: SupabaseClient, orderId: string, meId: string, current: string | null) {
  if (current) return current
  const t = await me('/shipment/tracking', { method: 'POST', body: { orders: [meId] } }).catch(() => null)
  const code = t?.[meId]?.tracking ?? null
  if (code) await admin.from('orders').update({ tracking_code: code }).eq('id', orderId)
  return code
}

async function handlePrint(admin: SupabaseClient, orderId: string) {
  const { data: order } = await admin.from('orders').select('label_me_id, tracking_code').eq('id', orderId).single()
  if (!order?.label_me_id) throw new UserError('Esse pedido ainda não tem etiqueta.')
  const meId = order.label_me_id

  const [print, dace, tracking] = await Promise.all([
    me('/shipment/print', { method: 'POST', body: { mode: 'public', orders: [meId] } }),
    // A DC-e é emitida pelo Melhor Envio de forma assíncrona — pode ainda não existir.
    me(`/imprimir/dace/pdf/${meId}`).catch(() => null),
    refreshTracking(admin, orderId, meId, order.tracking_code),
  ])

  return {
    label_url: print?.url ?? null,
    dace_url: dace?.pdf ?? null,
    tracking_code: tracking,
  }
}

async function handleCancel(admin: SupabaseClient, orderId: string) {
  const { data: order } = await admin.from('orders').select('label_me_id, tracking_code').eq('id', orderId).single()
  if (!order?.label_me_id) throw new UserError('Esse pedido não tem etiqueta.')
  const meId = order.label_me_id

  const res = await me('/shipment/cancel', {
    method: 'POST',
    body: { order: { id: meId, reason_id: '2', description: 'Cancelada pelo painel da loja' } },
  })
  if (!res?.[meId]?.canceled) {
    throw new UserError('O Melhor Envio não permitiu cancelar (a etiqueta pode já ter sido postada).')
  }

  // O rastreio veio da etiqueta — deixa de valer junto com ela.
  await admin
    .from('orders')
    .update({ label_me_id: null, label_cost: null, label_created_at: null, tracking_code: null })
    .eq('id', orderId)
  return { ok: true }
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
    const { action, order_id } = body as { action: string; order_id: string }
    if (!order_id) return jsonResponse({ error: 'Pedido não informado.' }, 400)

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const {
      data: { user },
    } = await authClient.auth.getUser()
    if (!user) return jsonResponse({ error: 'É preciso estar logado.' }, 401)
    const { data: profile } = await authClient.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return jsonResponse({ error: 'Só administradores podem gerar etiquetas.' }, 403)

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    switch (action) {
      case 'preview':
        return jsonResponse(await handlePreview(admin, order_id))
      case 'buy':
        return jsonResponse(await handleBuy(admin, order_id, body as BuyInput))
      case 'print':
        return jsonResponse(await handlePrint(admin, order_id))
      case 'cancel':
        return jsonResponse(await handleCancel(admin, order_id))
      default:
        return jsonResponse({ error: 'Ação inválida.' }, 400)
    }
  } catch (err) {
    if (err instanceof UserError) return jsonResponse({ error: err.message }, 400)
    console.error(err)
    return jsonResponse({ error: String(err) }, 500)
  }
})
