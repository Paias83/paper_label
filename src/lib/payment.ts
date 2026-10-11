import { supabase } from './supabase'

// Chama a Edge Function process-payment (pagamento embutido no carrinho). Em
// erro, a função responde { error } com status 4xx — o supabase-js descarta o
// corpo nesse caso, então a mensagem é lida de error.context.
export async function callProcessPayment<T>(action: 'create_order' | 'pay', body: object): Promise<T> {
  const { data, error } = await supabase.functions.invoke('process-payment', { body: { action, ...body } })
  if (error) {
    let message = 'Não foi possível processar o pagamento. Tente novamente.'
    try {
      const parsed = await (error as { context?: Response }).context?.json()
      if (parsed?.error) message = parsed.error
    } catch {
      // corpo não era JSON — fica a mensagem genérica
    }
    throw new Error(message)
  }
  return data as T
}
