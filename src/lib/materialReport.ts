import { supabase, type RawMaterial, type Supplier } from './supabase'
import { normText } from './duplicates'

// Relatório de matérias-primas (admin): mesmos filtros e agrupamento para a
// tela (MaterialReport.tsx) e para a folha A4 (MaterialReportPrint.tsx). Os
// filtros moram na URL, então o botão "Gerar PDF" só repassa a query string.
// A tabela é pequena: carrega tudo uma vez e filtra no navegador.

export type MaterialStockFilter = 'todos' | 'baixo' | 'zerado' | 'ok'
export type MaterialActiveFilter = 'ativos' | 'inativos' | 'todos'

export const MATERIAL_STOCK_LABEL: Record<MaterialStockFilter, string> = {
  todos: 'Todos',
  baixo: 'Estoque baixo (no mínimo ou abaixo)',
  zerado: 'Sem estoque',
  ok: 'Acima do mínimo',
}

export const MATERIAL_ACTIVE_LABEL: Record<MaterialActiveFilter, string> = {
  ativos: 'Só ativas',
  inativos: 'Só inativas',
  todos: 'Ativas e inativas',
}

export type MaterialReportFilters = {
  busca: string
  fornecedor: string // id, 'sem' (sem fornecedor) ou '' (todos)
  estoque: MaterialStockFilter
  situacao: MaterialActiveFilter
  agrupar: boolean
}

export type MaterialRow = {
  material: RawMaterial
  supplierName: string
  low: boolean
  value: number // estoque × custo unitário
}

export type MaterialGroup = { key: string; name: string; rows: MaterialRow[]; total: number }

export function readMaterialFilters(params: URLSearchParams): MaterialReportFilters {
  const estoque = params.get('estoque') as MaterialStockFilter | null
  const situacao = params.get('situacao') as MaterialActiveFilter | null
  return {
    busca: params.get('busca') ?? '',
    fornecedor: params.get('fornecedor') ?? '',
    estoque: estoque && estoque in MATERIAL_STOCK_LABEL ? estoque : 'todos',
    situacao: situacao && situacao in MATERIAL_ACTIVE_LABEL ? situacao : 'ativos',
    agrupar: params.get('agrupar') === '1',
  }
}

export function materialFiltersToParams(f: MaterialReportFilters) {
  const params = new URLSearchParams({ estoque: f.estoque, situacao: f.situacao })
  if (f.busca) params.set('busca', f.busca)
  if (f.fornecedor) params.set('fornecedor', f.fornecedor)
  if (f.agrupar) params.set('agrupar', '1')
  return params
}

export async function loadMaterialData() {
  const [materialsRes, suppliersRes] = await Promise.all([
    supabase.from('raw_materials').select('*').order('name'),
    supabase.from('suppliers').select('*').order('name'),
  ])
  if (materialsRes.error) throw materialsRes.error
  return {
    materials: (materialsRes.data ?? []) as RawMaterial[],
    suppliers: (suppliersRes.data ?? []) as Supplier[],
  }
}

export type MaterialData = Awaited<ReturnType<typeof loadMaterialData>>

export function supplierFilterLabel(data: MaterialData, fornecedor: string) {
  if (!fornecedor) return 'Todos'
  if (fornecedor === 'sem') return 'Sem fornecedor'
  return data.suppliers.find((s) => s.id === fornecedor)?.name ?? '—'
}

export function buildMaterialReport(data: MaterialData, f: MaterialReportFilters) {
  const supplierName = new Map(data.suppliers.map((s) => [s.id, s.name]))
  const search = normText(f.busca)

  const rows: MaterialRow[] = data.materials
    .filter((m) => f.situacao === 'todos' || m.active === (f.situacao === 'ativos'))
    .filter((m) => !f.fornecedor || (f.fornecedor === 'sem' ? !m.supplier_id : m.supplier_id === f.fornecedor))
    .filter((m) => !search || normText([m.name, m.color, m.brand].filter(Boolean).join(' ')).includes(search))
    .map((m) => ({
      material: m,
      supplierName: (m.supplier_id && supplierName.get(m.supplier_id)) || 'Sem fornecedor',
      // Mesma regra do selo "Estoque baixo" da lista de matérias-primas.
      low: m.stock <= m.min_stock,
      value: Math.max(m.stock, 0) * m.cost_price,
    }))
    .filter((r) => {
      if (f.estoque === 'baixo') return r.low
      if (f.estoque === 'zerado') return r.material.stock <= 0
      if (f.estoque === 'ok') return !r.low
      return true
    })
    .sort((a, b) => a.material.name.localeCompare(b.material.name, 'pt-BR'))

  const groupMap = new Map<string, MaterialGroup>()
  for (const r of rows) {
    const key = r.material.supplier_id ?? 'sem'
    const g = groupMap.get(key) ?? { key, name: r.supplierName, rows: [], total: 0 }
    g.rows.push(r)
    g.total += r.value
    groupMap.set(key, g)
  }
  const groups = [...groupMap.values()].sort((a, b) =>
    // "Sem fornecedor" vai para o fim.
    a.key === 'sem' ? 1 : b.key === 'sem' ? -1 : a.name.localeCompare(b.name, 'pt-BR')
  )

  return {
    rows,
    groups,
    total: rows.reduce((sum, r) => sum + r.value, 0),
    lowCount: rows.filter((r) => r.low).length,
  }
}

export type MaterialReport = ReturnType<typeof buildMaterialReport>

// "Filamento PLA · Vermelho · Masterprint"
export function materialLabel(m: RawMaterial) {
  return [m.name, m.color, m.brand].filter(Boolean).join(' · ')
}

export function formatQty(n: number) {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}
