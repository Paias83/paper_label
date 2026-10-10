import { supabase } from './supabase'

// Chama a Edge Function shipping-label (etiquetas do Melhor Envio). Em erro, a
// função responde com { error } e status 4xx — o supabase-js descarta o corpo
// nesse caso, então a mensagem é lida de error.context.
export async function callShippingLabel<T>(action: string, orderId: string, extra: object = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('shipping-label', {
    body: { action, order_id: orderId, ...extra },
  })
  if (error) {
    let message = 'Não foi possível falar com o Melhor Envio. Tente novamente.'
    try {
      const body = await (error as { context?: Response }).context?.json()
      if (body?.error) message = body.error
    } catch {
      // corpo não era JSON — fica a mensagem genérica
    }
    throw new Error(message)
  }
  return data as T
}

export type LabelLinks = { label_url: string | null; dace_url: string | null; tracking_code: string | null }
