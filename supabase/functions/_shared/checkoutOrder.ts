// Criação do pedido "pendente" da loja, compartilhada entre process-payment
// (pagamento embutido no carrinho) e create-preference (Checkout Pro, legado).
//
// Segurança: do navegador só se aproveitam ids, quantidades, o serviço de
// frete escolhido e o endereço. Preço/nome dos produtos vêm do banco e o
// frete é recotado no Melhor Envio aqui — senão dava pra pagar R$ 1 em tudo.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { quoteShipping, ShippingQuoteError } from './melhorEnvio.ts'

// title/unit_price ainda podem vir do navegador, mas são ignorados.
export type IncomingItem = { id: string; quantity: number }
// service_name/price também são ignorados: o frete é recotado pelo service_id.
export type IncomingShipping = { type: 'entrega' | 'retirada'; service_id?: number }
export type IncomingAddress = {
  cep: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
}

export type OrderLine = { id: string; title: string; quantity: number; unit_price: number }

// Erro com mensagem para mostrar ao cliente (vira resposta 400).
export class CheckoutError extends Error {}

export async function createStoreOrder(
  admin: SupabaseClient,
  userId: string,
  input: { items: IncomingItem[]; shipping: IncomingShipping; address: IncomingAddress | null }
) {
  const { items, shipping, address } = input
  if (!items?.length) throw new CheckoutError('Carrinho vazio.')
  if (shipping?.type !== 'entrega' && shipping?.type !== 'retirada') throw new CheckoutError('Frete é obrigatório.')
  if (shipping.type === 'entrega' && !address?.cep) throw new CheckoutError('Endereço é obrigatório para entrega.')
  if (items.some((i) => !Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 999)) {
    throw new CheckoutError('Quantidade inválida no carrinho.')
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
    throw new CheckoutError('Algum produto do carrinho não está mais disponível. Remova-o e tente de novo.')
  }
  const orderLines = lines as OrderLine[]

  // Frete: retirada é grátis; entrega é recotada e o preço sai do Melhor Envio.
  let shippingPrice = 0
  let shippingName = 'Retirada no local'
  let shippingServiceId: number | null = null
  if (shipping.type === 'entrega') {
    let options
    try {
      options = await quoteShipping(
        admin,
        address!.cep,
        orderLines.map((l) => ({ product_id: l.id, quantity: l.quantity }))
      )
    } catch (err) {
      if (err instanceof ShippingQuoteError) throw new CheckoutError(err.message)
      throw err
    }
    const chosen = options.find((o) => o.id === shipping.service_id)
    if (!chosen) throw new CheckoutError('O frete escolhido não está mais disponível. Calcule o frete de novo.')
    shippingPrice = chosen.price
    shippingName = chosen.name
    shippingServiceId = chosen.id
  }

  const itemsTotal = orderLines.reduce((sum, l) => sum + l.unit_price * l.quantity, 0)
  const total = Math.round((itemsTotal + shippingPrice) * 100) / 100

  const { data: order, error: orderError } = await admin
    .from('orders')
    .insert({
      user_id: userId,
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

  return { order, orderLines, shippingPrice, shippingName }
}
