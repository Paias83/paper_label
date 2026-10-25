import { supabase, type Category, type Product } from './supabase'
import { normText } from './duplicates'

// Relatório de produtos (admin): mesmos filtros e agrupamento para a tela
// (ProductReport.tsx) e para a folha A4 (ProductReportPrint.tsx). Os filtros
// moram na URL, então o botão "Gerar PDF" só repassa a query string.
// A tabela é pequena: carrega tudo uma vez e filtra no navegador.

export type ProductStatusFilter = 'cadastrados' | 'ativos' | 'inativos' | 'arquivados' | 'todos'
export type ProductStockFilter = 'todos' | 'com' | 'sem'

export const PRODUCT_STATUS_LABEL: Record<ProductStatusFilter, string> = {
  cadastrados: 'Todos, exceto arquivados',
  ativos: 'À venda na loja',
  inativos: 'Inativos (fora da loja)',
  arquivados: 'Arquivados',
  todos: 'Todos, inclusive arquivados',
}

export const PRODUCT_STOCK_LABEL: Record<ProductStockFilter, string> = {
  todos: 'Todos',
  com: 'Com estoque pronto',
  sem: 'Sem estoque pronto',
}

export type ProductReportFilters = {
  busca: string
  categoria: string // id, 'sem' (sem categoria) ou '' (todas)
  situacao: ProductStatusFilter
  estoque: ProductStockFilter
  agrupar: boolean
}

export type ProductRow = {
  product: Product
  categoryName: string
  marginPercent: number | null // margem real sobre o custo; null sem custo
  stockCost: number // estoque × custo
  stockValue: number // estoque × preço
}

export type ProductGroup = { key: string; name: string; rows: ProductRow[]; totalCost: number; totalValue: number }

export function readProductFilters(params: URLSearchParams): ProductReportFilters {
  const situacao = params.get('situacao') as ProductStatusFilter | null
  const estoque = params.get('estoque') as ProductStockFilter | null
  return {
    busca: params.get('busca') ?? '',
    categoria: params.get('categoria') ?? '',
    situacao: situacao && situacao in PRODUCT_STATUS_LABEL ? situacao : 'cadastrados',
    estoque: estoque && estoque in PRODUCT_STOCK_LABEL ? estoque : 'todos',
    agrupar: params.get('agrupar') === '1',
  }
}

export function productFiltersToParams(f: ProductReportFilters) {
  const params = new URLSearchParams({ situacao: f.situacao, estoque: f.estoque })
  if (f.busca) params.set('busca', f.busca)
  if (f.categoria) params.set('categoria', f.categoria)
  if (f.agrupar) params.set('agrupar', '1')
  return params
}

export async function loadProductData() {
  const [productsRes, categoriesRes] = await Promise.all([
    supabase.from('products').select('*').order('name'),
    supabase.from('categories').select('*').order('name'),
  ])
  if (productsRes.error) throw productsRes.error
  return {
    products: (productsRes.data ?? []) as Product[],
    categories: (categoriesRes.data ?? []) as Category[],
  }
}

export type ProductData = Awaited<ReturnType<typeof loadProductData>>

export function categoryFilterLabel(data: ProductData, categoria: string) {
  if (!categoria) return 'Todas'
  if (categoria === 'sem') return 'Sem categoria'
  return data.categories.find((c) => c.id === categoria)?.name ?? '—'
}

function matchesStatus(p: Product, s: ProductStatusFilter) {
  if (s === 'todos') return true
  if (s === 'arquivados') return p.archived
  if (p.archived) return false
  if (s === 'ativos') return p.active
  if (s === 'inativos') return !p.active
  return true
}

export function buildProductReport(data: ProductData, f: ProductReportFilters) {
  const categoryName = new Map(data.categories.map((c) => [c.id, c.name]))
  const search = normText(f.busca)

  const rows: ProductRow[] = data.products
    .filter((p) => matchesStatus(p, f.situacao))
    .filter((p) => !f.categoria || (f.categoria === 'sem' ? !p.category_id : p.category_id === f.categoria))
    .filter((p) => f.estoque === 'todos' || (f.estoque === 'com' ? p.stock > 0 : p.stock <= 0))
    .filter((p) => !search || normText(p.name).includes(search))
    .map((p) => {
      const stock = Math.max(p.stock, 0)
      return {
        product: p,
        categoryName: (p.category_id && categoryName.get(p.category_id)) || 'Sem categoria',
        marginPercent: p.cost_price > 0 ? (p.price / p.cost_price - 1) * 100 : null,
        stockCost: stock * p.cost_price,
        stockValue: stock * p.price,
      }
    })
    .sort((a, b) => a.product.name.localeCompare(b.product.name, 'pt-BR'))

  const groupMap = new Map<string, ProductGroup>()
  for (const r of rows) {
    const key = r.product.category_id ?? 'sem'
    const g = groupMap.get(key) ?? { key, name: r.categoryName, rows: [], totalCost: 0, totalValue: 0 }
    g.rows.push(r)
    g.totalCost += r.stockCost
    g.totalValue += r.stockValue
    groupMap.set(key, g)
  }
  const groups = [...groupMap.values()].sort((a, b) =>
    // "Sem categoria" vai para o fim.
    a.key === 'sem' ? 1 : b.key === 'sem' ? -1 : a.name.localeCompare(b.name, 'pt-BR')
  )

  return {
    rows,
    groups,
    totalCost: rows.reduce((sum, r) => sum + r.stockCost, 0),
    totalValue: rows.reduce((sum, r) => sum + r.stockValue, 0),
    totalStock: rows.reduce((sum, r) => sum + Math.max(r.product.stock, 0), 0),
  }
}

export type ProductReport = ReturnType<typeof buildProductReport>

export function productStatusLabel(p: Product) {
  if (p.archived) return 'Arquivado'
  return p.active ? 'Na loja' : 'Inativo'
}

export function formatMargin(m: number | null) {
  return m === null ? '—' : `${m.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`
}
