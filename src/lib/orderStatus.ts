import type { Order } from './supabase'

export const ORDER_STATUS_LABEL: Record<Order['status'], string> = {
  pendente: 'Aguardando pagamento',
  pago: 'Pagamento confirmado',
  enviado: 'Enviado',
  entregue: 'Entregue',
  pronto_para_retirada: 'Pronto para retirada',
  retirado: 'Retirado',
  cancelado: 'Cancelado',
}
