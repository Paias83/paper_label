import { supabase, type Order, type OrderItem } from './supabase'

// Relatório de pedidos (admin): mesma busca e agrupamento para a tela
// (OrderReport.tsx) e para a folha A4 (OrderReportPrint.tsx). Os filtros
// moram na URL, então o botão "Gerar PDF" só repassa a query string.

export type ReportStatus = 'ativos' | 'efetivados' | 'pendente' | 'cancelado' | 'todos'

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  ativos: 'Todos, exceto cancelados',
  efetivados: 'Pagos (pago, enviado, entregue, retirada)',
  pendente: 'Aguardando pagamento',
  cancelado: 'Cancelados',
  todos: 'Todos, inclusive cancelados',
}

const PAID_STATUSES: Order['status'][] = ['pago', 'enviado', 'entregue', 'pronto_para_retirada', 'retirado']

export type ReportFilters = {
  de: string // 'YYYY-MM-DD' ou '' (sem limite)
  ate: string
  cliente: string // chave de customerKey() ou '' (todos)
  status: ReportStatus
  agrupar: boolean
}

export type ReportRow = {
  order: Order
  customerKey: string
  customerName: string
  customerEmail: string
  itemsSummary: string
}

export type ReportGroup = { key: string; name: string; rows: ReportRow[]; total: number }

function isoDay(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Parâmetro ausente = padrão (mês atual); presente e vazio = sem limite.
export function readFilters(params: URLSearchParams): ReportFilters {
  const today = new Date()
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const status = params.get('status') as ReportStatus | null
  return {
    de: params.get('de') ?? isoDay(monthStart),
    ate: params.get('ate') ?? isoDay(today),
    cliente: params.get('cliente') ?? '',
    status: status && status in REPORT_STATUS_LABEL ? status : 'ativos',
    agrupar: params.get('agrupar') === '1',
  }
}

export function filtersToParams(f: ReportFilters) {
  const params = new URLSearchParams({ de: f.de, ate: f.ate, status: f.status })
  if (f.cliente) params.set('cliente', f.cliente)
  if (f.agrupar) params.set('agrupar', '1')
  return params
}

export function formatDay(day: string) {
  return day ? day.split('-').reverse().join('/') : ''
}

export function periodLabel(f: ReportFilters) {
  if (f.de && f.ate) return `${formatDay(f.de)} a ${formatDay(f.ate)}`
  if (f.de) return `A partir de ${formatDay(f.de)}`
  if (f.ate) return `Até ${formatDay(f.ate)}`
  return 'Todo o período'
}

// Cliente com conta = user_id; venda manual sem conta = nome digitado.
function customerKey(o: Order) {
  if (o.user_id) return o.user_id
  const name = o.customer_name?.trim().toLowerCase()
  return name ? `nome:${name}` : 'sem-cliente'
}

export async function loadOrderReport(f: ReportFilters) {
  let query = supabase.from('orders').select('*').order('created_at', { ascending: true })
  if (f.de) query = query.gte('created_at', new Date(`${f.de}T00:00:00`).toISOString())
  if (f.ate) {
    const end = new Date(`${f.ate}T00:00:00`)
    end.setDate(end.getDate() + 1)
    query = query.lt('created_at', end.toISOString())
  }
  if (f.status === 'ativos') query = query.neq('status', 'cancelado')
  if (f.status === 'efetivados') query = query.in('status', PAID_STATUSES)
  if (f.status === 'pendente' || f.status === 'cancelado') query = query.eq('status', f.status)

  const { data: orders, error } = await query
  if (error) throw error

  const orderIds = (orders ?? []).map((o) => o.id)
  const userIds = [...new Set((orders ?? []).map((o) => o.user_id).filter(Boolean) as string[])]
  if (f.cliente && !f.cliente.startsWith('nome:') && f.cliente !== 'sem-cliente' && !userIds.includes(f.cliente)) {
    userIds.push(f.cliente) // cliente escolhido sem pedidos no período: nome no filtro mesmo assim
  }

  // .in() vai na URL — lotes de 150 ids para não estourar o tamanho.
  const items: OrderItem[] = []
  for (let i = 0; i < orderIds.length; i += 150) {
    const { data } = await supabase.from('order_items').select('*').in('order_id', orderIds.slice(i, i + 150))
    items.push(...(data ?? []))
  }
  const [productsRes, quotesRes, profilesRes] = await Promise.all([
    supabase.from('products').select('id, name'),
    supabase.from('quote_requests').select('id, title'),
    userIds.length ? supabase.from('profiles').select('id, name, email').in('id', userIds) : Promise.resolve({ data: [] }),
  ])
  const productName = new Map((productsRes.data ?? []).map((p) => [p.id, p.name as string]))
  const quoteTitle = new Map((quotesRes.data ?? []).map((q) => [q.id, q.title as string]))
  const profiles = new Map(
    ((profilesRes.data ?? []) as { id: string; name: string | null; email: string | null }[]).map((p) => [p.id, p])
  )

  function itemLabel(it: OrderItem) {
    if (it.product_id) return productName.get(it.product_id) ?? 'Produto'
    if (it.custom_request_id) return `${quoteTitle.get(it.custom_request_id) ?? 'Pedido'} (personalizado)`
    return 'Item'
  }

  const allRows: ReportRow[] = (orders ?? []).map((order) => {
    const profile = order.user_id ? profiles.get(order.user_id) : undefined
    return {
      order,
      customerKey: customerKey(order),
      customerName: order.customer_name || profile?.name || profile?.email || 'Sem cliente informado',
      customerEmail: profile?.email ?? '',
      itemsSummary: items
        .filter((it) => it.order_id === order.id)
        .map((it) => `${it.quantity}× ${itemLabel(it)}`)
        .join(', '),
    }
  })

  // Opções do filtro de cliente: quem tem pedido no período/status escolhido.
  const customerOptions = new Map<string, string>()
  for (const r of allRows) if (!customerOptions.has(r.customerKey)) customerOptions.set(r.customerKey, r.customerName)
  if (f.cliente && !customerOptions.has(f.cliente)) {
    const p = profiles.get(f.cliente)
    customerOptions.set(f.cliente, p?.name || p?.email || f.cliente.replace(/^nome:/, ''))
  }

  const rows = f.cliente ? allRows.filter((r) => r.customerKey === f.cliente) : allRows

  const groupMap = new Map<string, ReportGroup>()
  for (const r of rows) {
    const g = groupMap.get(r.customerKey) ?? { key: r.customerKey, name: r.customerName, rows: [], total: 0 }
    g.rows.push(r)
    g.total += r.order.total
    groupMap.set(r.customerKey, g)
  }
  const groups = [...groupMap.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  return {
    rows,
    groups,
    total: rows.reduce((sum, r) => sum + r.order.total, 0),
    customerOptions: [...customerOptions.entries()]
      .map(([key, name]) => ({ key, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
  }
}

export type OrderReportData = Awaited<ReturnType<typeof loadOrderReport>>
