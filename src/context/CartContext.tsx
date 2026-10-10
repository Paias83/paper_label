import React, { createContext, useContext, useEffect, useState } from 'react'
import type { Product } from '../lib/supabase'
import { useAuth } from './AuthContext'

export type CartItem = {
  product: Product
  quantity: number
}

type CartContextValue = {
  items: CartItem[]
  addItem: (product: Product, quantity?: number) => void
  removeItem: (productId: string) => void
  setQuantity: (productId: string, quantity: number) => void
  clear: () => void
  total: number
}

const CartContext = createContext<CartContextValue | null>(null)

// Um carrinho por conta (e um de visitante), salvo no navegador. Antes era uma
// chave só e o carrinho passava de um usuário para outro no mesmo navegador.
const LEGACY_KEY = 'papelaria_carrinho'
const storageKey = (owner: string | null) => `papelaria_carrinho:${owner ?? 'visitante'}`

function readCart(key: string): CartItem[] {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeCart(key: string, items: CartItem[]) {
  try {
    localStorage.setItem(key, JSON.stringify(items))
  } catch {
    // navegador sem armazenamento (aba anônima bloqueada etc.) — carrinho só na memória
  }
}

function removeCart(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    // idem
  }
}

// Junta dois carrinhos; produto repetido fica com a maior quantidade (não soma,
// para não dobrar quando o mesmo item já estava nos dois).
function mergeCarts(base: CartItem[], extra: CartItem[]) {
  const result = [...base]
  for (const item of extra) {
    const idx = result.findIndex((i) => i.product.id === item.product.id)
    if (idx === -1) result.push(item)
    else if (item.quantity > result[idx].quantity) result[idx] = item
  }
  return result
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  // undefined = sessão ainda carregando; null = visitante; string = id da conta
  const [owner, setOwner] = useState<string | null | undefined>(undefined)
  const [items, setItems] = useState<CartItem[]>([])

  useEffect(() => {
    if (loading) return
    const next = user?.id ?? null
    if (next === owner) return

    let loaded = readCart(storageKey(next))
    if (owner === undefined) {
      // Primeiro carregamento: o carrinho da chave antiga (única) vai para quem está logado.
      const legacy = readCart(LEGACY_KEY)
      if (legacy.length) loaded = mergeCarts(loaded, legacy)
      removeCart(LEGACY_KEY)
    } else if (owner === null && next) {
      // Visitante entrou ou se cadastrou: leva o que escolheu para a conta.
      loaded = mergeCarts(loaded, readCart(storageKey(null)))
      removeCart(storageKey(null))
    }
    // Conta → visitante (saiu) ou conta → outra conta: o carrinho anterior fica
    // guardado na chave dele e volta quando aquela conta entrar de novo.
    setOwner(next)
    setItems(loaded)
  }, [user?.id, loading, owner])

  useEffect(() => {
    if (owner !== undefined) writeCart(storageKey(owner), items)
  }, [items, owner])

  function addItem(product: Product, quantity = 1) {
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id)
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + quantity } : i
        )
      }
      return [...prev, { product, quantity }]
    })
  }

  function removeItem(productId: string) {
    setItems((prev) => prev.filter((i) => i.product.id !== productId))
  }

  function setQuantity(productId: string, quantity: number) {
    if (quantity <= 0) return removeItem(productId)
    setItems((prev) => prev.map((i) => (i.product.id === productId ? { ...i, quantity } : i)))
  }

  function clear() {
    setItems([])
  }

  const total = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0)

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, setQuantity, clear, total }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart precisa estar dentro de <CartProvider>')
  return ctx
}
