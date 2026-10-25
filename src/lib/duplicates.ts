import { supabase } from './supabase'

// Mesma regra de public.norm_text (supabase/add-duplicate-guards-v2.sql):
// minúsculas, sem acento, espaços repetidos colapsados. Os índices únicos no
// banco são a trava final; aqui é só para avisar antes, mostrando o que já existe.
export function normText(v: string | null | undefined): string {
  return (v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

type MaterialKey = { name: string; color?: string | null; brand?: string | null }

// Devolve a descrição da matéria-prima igual já cadastrada, ou null.
export async function findDuplicateMaterial(m: MaterialKey, ignoreId?: string) {
  const { data } = await supabase.from('raw_materials').select('id, name, color, brand')
  const dup = (data ?? []).find(
    (x) =>
      x.id !== ignoreId &&
      normText(x.name) === normText(m.name) &&
      normText(x.color) === normText(m.color) &&
      normText(x.brand) === normText(m.brand)
  )
  return dup ? [dup.name, dup.color, dup.brand].filter(Boolean).join(' · ') : null
}

type SupplierKey = { name: string; document?: string | null }

// Devolve a mensagem de bloqueio se o nome ou o CNPJ/CPF já existem, ou null.
export async function findDuplicateSupplier(s: SupplierKey, ignoreId?: string) {
  const { data } = await supabase.from('suppliers').select('id, name, document')
  const others = (data ?? []).filter((x) => x.id !== ignoreId)
  const byName = others.find((x) => normText(x.name) === normText(s.name))
  if (byName) return `Já existe um fornecedor com esse nome: ${byName.name}.`
  const digits = (s.document ?? '').replace(/\D/g, '')
  if (digits) {
    const byDoc = others.find((x) => (x.document ?? '').replace(/\D/g, '') === digits)
    if (byDoc) return `Esse CNPJ/CPF já está cadastrado no fornecedor ${byDoc.name}.`
  }
  return null
}
