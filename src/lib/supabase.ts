import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    'Supabase não configurado. Copie .env.example para .env e preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Tipos básicos das tabelas — expanda conforme o schema.sql
export type Product = {
  id: string
  name: string
  description: string | null
  price: number
  cost_price: number
  category_id: string | null
  stock: number
  images: string[]
  active: boolean
  featured: boolean
  weight_kg: number
  width_cm: number
  height_cm: number
  length_cm: number
  created_at: string
}

export type Category = {
  id: string
  name: string
  slug: string
}

export type ShippingAddress = {
  cep: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
}

export type Order = {
  id: string
  user_id: string
  status:
    | 'pendente'
    | 'pago'
    | 'enviado'
    | 'entregue'
    | 'pronto_para_retirada'
    | 'retirado'
    | 'cancelado'
  total: number
  mp_payment_id: string | null
  shipping_type: 'entrega' | 'retirada'
  shipping_cep: string | null
  shipping_address: ShippingAddress | null
  shipping_cost: number
  shipping_service: string | null
  tracking_code: string | null
  admin_seen_at: string | null
  last_status_change_by: 'sistema' | 'admin' | null
  created_at: string
}

export type OrderItem = {
  id: string
  order_id: string
  product_id: string | null
  custom_request_id: string | null
  quantity: number
  price_at_purchase: number
  quantity_from_stock: number
  fulfillment_status: 'estoque_pronto' | 'empenhado' | 'aguardando_compra' | 'personalizado' | null
}

export type OrderItemReservation = {
  id: string
  order_item_id: string
  status: 'empenhado' | 'aguardando_compra'
  quantity: number
  created_at: string
}

export type PurchaseNeed = {
  id: string
  material_id: string
  quantity: number
  status: 'pendente' | 'resolvido'
  created_at: string
  resolved_at: string | null
}

export type Supplier = {
  id: string
  name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  document: string | null
  notes: string | null
  created_at: string
}

export type RawMaterial = {
  id: string
  name: string
  unit: string
  stock: number
  min_stock: number
  cost_price: number
  supplier_id: string | null
  color: string | null
  brand: string | null
  notes: string | null
  active: boolean
  created_at: string
}

export type StockMovement = {
  id: string
  material_id: string
  type: 'entrada' | 'saida'
  quantity: number
  unit_cost: number | null
  supplier_id: string | null
  note: string | null
  created_by: string | null
  created_at: string
}

export type ProductMaterial = {
  id: string
  product_id: string
  material_id: string
  quantity: number
  created_at: string
}

export type QuoteStatus =
  | 'solicitado'
  | 'em_analise'
  | 'proposta_enviada'
  | 'aprovado'
  | 'recusado'
  | 'cancelado'

export type QuoteRequest = {
  id: string
  user_id: string
  inspiration_product_id: string | null
  title: string
  description: string
  status: QuoteStatus
  final_price: number | null
  shipping_cost: number | null
  order_id: string | null
  created_at: string
}

export type QuoteMessage = {
  id: string
  quote_request_id: string
  sender_role: 'cliente' | 'admin'
  sender_id: string
  body: string | null
  images: string[]
  proposed_price: number | null
  proposed_shipping_cost: number | null
  created_at: string
}

export type ProductProduction = {
  id: string
  product_id: string
  quantity: number
  note: string | null
  created_by: string | null
  created_at: string
}
