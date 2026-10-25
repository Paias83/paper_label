import { Fragment, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  PRODUCT_STATUS_LABEL,
  PRODUCT_STOCK_LABEL,
  buildProductReport,
  formatMargin,
  loadProductData,
  productFiltersToParams,
  productStatusLabel,
  readProductFilters,
  type ProductData,
  type ProductReportFilters,
  type ProductRow,
  type ProductStatusFilter,
  type ProductStockFilter,
} from '../../lib/productReport'

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function ProductReport() {
  const [params, setParams] = useSearchParams()
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

  const report = useMemo(
    () => (data ? buildProductReport(data, readProductFilters(new URLSearchParams(query))) : null),
    [data, query]
  )

  function update(changes: Partial<ProductReportFilters>) {
    setParams(productFiltersToParams({ ...filters, ...changes }), { replace: true })
  }

  function renderRow(r: ProductRow, showCategory: boolean) {
    const p = r.product
    return (
      <tr key={p.id}>
        <td>
          <span className="product-name">{p.name}</span>
          {(p.archived || !p.active) && <span className="type-badge manual"> {productStatusLabel(p)}</span>}
        </td>
        {showCategory && <td>{r.categoryName}</td>}
        <td className="price">{brl(p.cost_price)}</td>
        <td className="price">{brl(p.price)}</td>
        <td className="price" title={p.margin_percent !== null ? 'Preço travado pela margem' : 'Preço manual'}>
          {formatMargin(r.marginPercent)}
        </td>
        <td>
          <span className={`stock-qty${p.stock <= 0 ? ' stock-low' : ''}`}>{p.stock}</span>
        </td>
        <td className="price">{brl(r.stockCost)}</td>
        <td className="price">{brl(r.stockValue)}</td>
      </tr>
    )
  }

  const colCount = filters.agrupar ? 7 : 8
  const count = report?.rows.length ?? 0

  return (
    <div>
      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <p className="eyebrow">Relatórios</p>
          <h2>Relatório de produtos</h2>
        </div>
        <a
          href={`/admin/relatorios/produtos/pdf?${query}`}
          target="_blank"
          rel="noreferrer"
          className="seal-button"
          title="Abre a versão A4 para imprimir ou salvar em PDF"
        >
          Gerar PDF
        </a>
      </div>

      <div className="form-card report-filters">
        <div className="form-field report-filter-wide">
          <label className="form-field-label" htmlFor="busca">
            Buscar
          </label>
          <input
            id="busca"
            type="search"
            placeholder="Nome do produto…"
            value={filters.busca}
            onChange={(e) => update({ busca: e.target.value })}
          />
        </div>
        <div className="form-field report-filter-wide">
          <label className="form-field-label" htmlFor="categoria">
            Categoria
          </label>
          <select id="categoria" value={filters.categoria} onChange={(e) => update({ categoria: e.target.value })}>
            <option value="">Todas as categorias</option>
            <option value="sem">Sem categoria</option>
            {data?.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {!c.active ? ' (interna)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field report-filter-wide">
          <label className="form-field-label" htmlFor="situacao">
            Situação
          </label>
          <select
            id="situacao"
            value={filters.situacao}
            onChange={(e) => update({ situacao: e.target.value as ProductStatusFilter })}
          >
            {Object.entries(PRODUCT_STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label className="form-field-label" htmlFor="estoque">
            Estoque
          </label>
          <select
            id="estoque"
            value={filters.estoque}
            onChange={(e) => update({ estoque: e.target.value as ProductStockFilter })}
          >
            {Object.entries(PRODUCT_STOCK_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="report-filter-actions">
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={filters.agrupar} onChange={(e) => update({ agrupar: e.target.checked })} />
            Agrupar por categoria
          </label>
          <button
            type="button"
            className="ghost-button small"
            onClick={() => update({ busca: '', categoria: '', situacao: 'cadastrados', estoque: 'todos' })}
          >
            Limpar filtros
          </button>
        </div>
      </div>

      {error && <p className="checkout-error">{error}</p>}

      <div className="list-toolbar">
        <span className="list-count">
          {count} {count === 1 ? 'produto' : 'produtos'} · {report?.totalStock ?? 0} un. em estoque
        </span>
        <span className="list-count">
          Estoque a custo {brl(report?.totalCost ?? 0)} · a preço de venda {brl(report?.totalValue ?? 0)}
        </span>
      </div>

      <div className="list-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Produto</th>
              {!filters.agrupar && <th>Categoria</th>}
              <th>Custo</th>
              <th>Preço</th>
              <th>Margem</th>
              <th>Estoque</th>
              <th>Estoque a custo</th>
              <th>Estoque a preço</th>
            </tr>
          </thead>
          <tbody>
            {!report && !error && (
              <tr>
                <td colSpan={colCount} className="empty-state">
                  Carregando…
                </td>
              </tr>
            )}
            {report && count === 0 && (
              <tr>
                <td colSpan={colCount} className="empty-state">
                  Nenhum produto com esses filtros.
                </td>
              </tr>
            )}
            {report &&
              (filters.agrupar
                ? report.groups.map((g) => (
                    <Fragment key={g.key}>
                      <tr className="report-group-row">
                        <td colSpan={colCount - 2}>
                          {g.name} · {g.rows.length} {g.rows.length === 1 ? 'produto' : 'produtos'}
                        </td>
                        <td className="price">{brl(g.totalCost)}</td>
                        <td className="price">{brl(g.totalValue)}</td>
                      </tr>
                      {g.rows.map((r) => renderRow(r, false))}
                    </Fragment>
                  ))
                : report.rows.map((r) => renderRow(r, true)))}
          </tbody>
          {report && count > 0 && (
            <tfoot>
              <tr className="report-total-row">
                <td colSpan={colCount - 2}>
                  Total geral · {count} {count === 1 ? 'produto' : 'produtos'}
                </td>
                <td className="price">{brl(report.totalCost)}</td>
                <td className="price">{brl(report.totalValue)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
