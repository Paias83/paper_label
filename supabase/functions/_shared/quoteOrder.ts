// Converte um orçamento com proposta em pedido de verdade: orders +
// order_items (sem product_id, ligado por custom_request_id) e marca o
// orçamento como 'aprovado'. Usado pelo pagamento embutido (process-payment,
// ação create_quote_order) e pelo plano B com Checkout Pro (create-quote-order).
//
// Preço e frete vêm sempre do orçamento no banco. Se o orçamento já foi
// aprovado e o pedido ainda está pendente (cliente fechou a página antes de
// pagar), reaproveita esse pedido com a entrega escolhida agora; se o pedido
// foi cancelado (Pix/boleto vencido), cria outro — assim o cliente nunca fica
// sem como pagar.

// deno-lint-ignore-file no-explicit-any
type SupabaseAdmin = any

export type QuoteOrderAddress = {
  cep: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
}

export class QuoteOrderError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

export async function createQuoteOrder(
  admin: SupabaseAdmin,
  userId: string,
  input: { quote_request_id: string; shipping_type: 'entrega' | 'retirada'; address: QuoteOrderAddress | null }
) {
  const { quote_request_id, shipping_type, address } = input
  if (!quote_request_id) throw new QuoteOrderError('Orçamento é obrigatório.')
  if (shipping_type !== 'entrega' && shipping_type !== 'retirada') throw new QuoteOrderError('Escolha a forma de entrega.')
  if (shipping_type === 'entrega' && !address?.cep) throw new QuoteOrderError('Endereço é obrigatório para entrega.')

  const { data: quote } = await admin.from('quote_requests').select('*').eq('id', quote_request_id).single()
  if (!quote) throw new QuoteOrderError('Orçamento não encontrado.', 404)
  if (quote.user_id !== userId) throw new QuoteOrderError('Esse orçamento não pertence a essa conta.', 403)

  let pendingOrderId: string | null = null
  if (quote.status === 'aprovado' && quote.order_id) {
    const { data: existing } = await admin.from('orders').select('*').eq('id', quote.order_id).single()
    if (existing?.status === 'pendente') pendingOrderId = existing.id
    else if (existing && existing.status !== 'cancelado') {
      throw new QuoteOrderError('Esse orçamento já foi pago.')
    }
    // Pedido cancelado: segue e cria um novo com a mesma proposta.
  } else if (quote.status !== 'proposta_enviada') {
    throw new QuoteOrderError('Esse orçamento ainda não tem uma proposta pra aprovar.')
  }
  if (quote.final_price == null) throw new QuoteOrderError('Esse orçamento ainda não tem uma proposta pra aprovar.')

  // Retirada no local sempre é grátis, mesmo que um frete tenha sido
  // negociado na conversa — o cliente decide o método na hora de aprovar.
  const shippingCost = shipping_type === 'retirada' ? 0 : Number(quote.shipping_cost ?? 0)
  const total = Number(quote.final_price) + shippingCost

  const orderFields = {
    total,
    shipping_type,
    shipping_cep: shipping_type === 'entrega' ? address?.cep : null,
    shipping_address: shipping_type === 'entrega' ? address : null,
    shipping_cost: shippingCost,
    shipping_service: shipping_type === 'retirada' ? 'Retirada no local' : 'Combinado no orçamento',
  }

  if (pendingOrderId) {
    const { data: order, error } = await admin
      .from('orders')
      .update(orderFields)
      .eq('id', pendingOrderId)
      .eq('status', 'pendente')
      .select()
      .single()
    if (error || !order) throw error ?? new Error('Falha ao atualizar pedido')
    return { order, quote }
  }

  const { data: order, error: orderError } = await admin
    .from('orders')
    .insert({ user_id: userId, status: 'pendente', ...orderFields })
    .select()
    .single()
  if (orderError || !order) throw orderError ?? new Error('Falha ao criar pedido')

  const { error: itemError } = await admin.from('order_items').insert({
    order_id: order.id,
    product_id: null,
    custom_request_id: quote.id,
    quantity: 1,
    price_at_purchase: quote.final_price,
  })
  if (itemError) throw itemError

  await admin.from('quote_requests').update({ status: 'aprovado', order_id: order.id }).eq('id', quote.id)

  return { order, quote }
}
