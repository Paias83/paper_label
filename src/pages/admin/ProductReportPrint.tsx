import { Fragment, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AdminPrintGate from '../../components/AdminPrintGate'
import {
  PRODUCT_STATUS_LABEL,
  PRODUCT_STOCK_LABEL,
  buildProductReport,
  categoryFilterLabel,
  formatMargin,
  loadProductData,
  productFiltersToParams,
  productStatusLabel,
  readProductFilters,
  type ProductData,
  type ProductRow,
} from '../../lib/productReport'

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// Relatório de produtos em A4 — mesmo esquema do relatório de pedidos
// (OrderReportPrint): rota fora do AdminLayout e "Imprimir / Salvar PDF" pelo
// diálogo do navegador. Os filtros chegam pela query string da tela.
export default function ProductReportPrint() {
  return (
    <AdminPrintGate>
      <ProductReportSheet />
    </AdminPrintGate>
  )
}

function ProductReportSheet() {
  const [params] = useSearchParams()
  const filters = readProductFilters(params)
  const [data, setData] = useState<ProductData | null>(null)
  const [error, setError] = useState('')
  const query = productFiltersToParams(filters).toString()

  useEffect(() => {
    loadProductData()
      .then(setData)
      .catch((err) => {
        console.error(err)
        setError('Não foi possível carregar o relatório.')
      })
  }, [])

  if (error) return <p style={{ padding: 40 }}>{error}</p>
  if (!data) return <p style={{ padding: 40 }}>Carregando relatório…</p>

  const report = buildProductReport(data, filters)
  const count = report.rows.length
  const colCount = filters.agrupar ? 7 : 8

  function renderRow(r: ProductRow, showCategory: boolean) {
    const p = r.product
    return (
      <tr key={p.id}>
        <td>
          {p.name}
          {(p.archived || !p.active) && ` (${productStatusLabel(p).toLowerCase()})`}
        </td>
        {showCategory && <td>{r.categoryName}</td>}
        <td className="op-num">{brl(p.cost_price)}</td>
        <td className="op-num">{brl(p.price)}</td>
        <td className="op-num">{formatMargin(r.marginPercent)}</td>
        <td className="op-num">{p.stock}</td>
        <td className="op-num">{brl(r.stockCost)}</td>
        <td className="op-num">{brl(r.stockValue)}</td>
      </tr>
    )
  }

  return (
    <div className="order-print-page">
      <div className="order-print-actions">
        <Link to={`/admin/relatorios/produtos?${query}`} className="ghost-button">
          ← Relatório
        </Link>
        <button type="button" className="seal-button" onClick={() => window.print()}>
          Imprimir / Salvar PDF
        </button>
      </div>

      <div className="op-doc">
        <header className="op-head">
          <div>
            <p className="op-brand">Studio Paper</p>
            <p className="op-brand-sub">Relatório interno</p>
          </div>
          <div className="op-head-right">
            <p className="op-doc-title">Relatório de produtos</p>
            <p className="op-date">Gerado em {new Date().toLocaleString('pt-BR')}</p>
          </div>
        </header>

        <div className="op-rule" />

        <section className="op-meta">
          <div>
            <span className="op-label">Categoria</span>
            <p>{categoryFilterLabel(data, filters.categoria)}</p>
          </div>
          <div>
            <span className="op-label">Situação</span>
            <p>{PRODUCT_STATUS_LABEL[filters.situacao]}</p>
          </div>
          <div>
            <span className="op-label">Estoque</span>
            <p>{PRODUCT_STOCK_LABEL[filters.estoque]}</p>
          </div>
          {filters.busca && (
            <div>
              <span className="op-label">Busca</span>
              <p>“{filters.busca}”</p>
            </div>
          )}
        </section>

        <table className="op-table">
          <thead>
            <tr>
              <th>Produto</th>
              {!filters.agrupar && <th>Categoria</th>}
              <th className="op-num">Custo</th>
              <th className="op-num">Preço</th>
              <th className="op-num">Margem</th>
              <th className="op-num">Estoque</th>
              <th className="op-num">Est. a custo</th>
              <th className="op-num">Est. a preço</th>
            </tr>
          </thead>
          <tbody>
            {count === 0 && (
              <tr>
                <td colSpan={colCount} style={{ textAlign: 'center', color: '#777' }}>
                  Nenhum produto com esses filtros.
                </td>
              </tr>
            )}
            {filters.agrupar
              ? report.groups.map((g) => (
                  <Fragment key={g.key}>
                    <tr className="op-group-row">
                      <td colSpan={colCount - 2}>
                        {g.name} · {g.rows.length} {g.rows.length === 1 ? 'produto' : 'produtos'}
                      </td>
                      <td className="op-num">{brl(g.totalCost)}</td>
                      <td className="op-num">{brl(g.totalValue)}</td>
                    </tr>
                    {g.rows.map((r) => renderRow(r, false))}
                  </Fragment>
                ))
              : report.rows.map((r) => renderRow(r, true))}
          </tbody>
        </table>

        <div className="op-totals">
          <div>
            <span>Produtos</span>
            <span>{count}</span>
          </div>
          <div>
            <span>Unidades em estoque</span>
            <span>{report.totalStock}</span>
          </div>
          <div>
            <span>Estoque a custo</span>
            <span>{brl(report.totalCost)}</span>
          </div>
          <div className="op-total-final">
            <span>Estoque a preço de venda</span>
            <span>{brl(report.totalValue)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
