import type { QuoteStatus } from './supabase'

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  solicitado: 'Solicitado',
  em_analise: 'Em análise',
  proposta_enviada: 'Proposta enviada',
  aprovado: 'Aprovado',
  recusado: 'Recusado',
  cancelado: 'Cancelado',
}
