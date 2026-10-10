// Cotação de frete no Melhor Envio, compartilhada entre calculate-shipping
// (carrinho mostra as opções) e create-preference (servidor recalcula o preço
// do serviço escolhido — nunca confia no valor que vem do navegador).
//
// Peso/medidas sempre lidos do banco.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MELHOR_ENVIO_TOKEN = Deno.env.get('MELHOR_ENVIO_TOKEN')!
const STORE_ORIGIN_CEP = Deno.env.get('STORE_ORIGIN_CEP')!

export type ShippingQuoteItem = { product_id: string; quantity: number }
export type ShippingOption = { id: number; name: string; price: number; delivery_time: number; company: string }

export class ShippingQuoteError extends Error {}

// Transportadoras que exigem agência de postagem (ou não podem ser compradas
// via API) — não geram etiqueta pelo painel, então ficam fora do carrinho também.
export const UNSUPPORTED_COMPANIES = ['azul', 'latam', 'buslog']

export function isSupportedCompany(companyName: string | undefined) {
  const name = (companyName ?? '').toLowerCase()
  return !UNSUPPORTED_COMPANIES.some((c) => name.includes(c))
}

export async function quoteShipping(
  client: SupabaseClient,
  cepDestino: string,
  items: ShippingQuoteItem[]
): Promise<ShippingOption[]> {
  const cepDigits = (cepDestino ?? '').replace(/\D/g, '')
  if (cepDigits.length !== 8) throw new ShippingQuoteError('CEP de destino inválido.')
  if (!items?.length) throw new ShippingQuoteError('Carrinho vazio.')

  const { data: products, error: productsError } = await client
    .from('products')
    .select('id, price, weight_kg, width_cm, height_cm, length_cm')
    .in(
      'id',
      items.map((i) => i.product_id)
    )
  if (productsError) throw productsError

  const meProducts = items.map((item) => {
    const product = products?.find((p) => p.id === item.product_id)
    if (!product) throw new ShippingQuoteError(`Produto não encontrado: ${item.product_id}`)
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
    throw new ShippingQuoteError('Não foi possível calcular o frete no momento.')
  }

  // A API devolve entradas com "error" pra serviços indisponíveis
  // pra essa rota/pacote (ex: transportadora não atende a região) —
  // filtra pra só devolver opções realmente cotadas.
  return data
    .filter((opt) => !opt.error && opt.price && isSupportedCompany(opt.company?.name))
    .map((opt) => ({
      id: opt.id,
      name: opt.name,
      price: Number(opt.custom_price ?? opt.price),
      delivery_time: opt.custom_delivery_time ?? opt.delivery_time,
      company: opt.company?.name ?? '',
    }))
}
