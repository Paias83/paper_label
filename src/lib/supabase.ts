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
  category_id: string | null
  stock: number
  images: string[]
  active: boolean
  featured: boolean
  created_at: string
}

export type Category = {
  id: string
  name: string
  slug: string
}

export type Order = {
  id: string
  user_id: string
  status: 'pendente' | 'pago' | 'enviado' | 'entregue' | 'cancelado'
  total: number
  mp_payment_id: string | null
  created_at: string
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
