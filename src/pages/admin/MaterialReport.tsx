import { Fragment, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  MATERIAL_ACTIVE_LABEL,
  MATERIAL_STOCK_LABEL,
  buildMaterialReport,
  formatQty,
  loadMaterialData,
  materialFiltersToParams,
  readMaterialFilters,
  type MaterialActiveFilter,
  type MaterialData,
  type MaterialReportFilters,
  type MaterialRow,
  type MaterialStockFilter,
} from '../../lib/materialReport'

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function MaterialReport() {
  const [params, setParams] = useSearchParams()
  const filters = readMaterialFilters(params)
  const [data, setData] = useState<MaterialData | null>(null)
  const [error, setError] = useState('')
  const query = materialFiltersToParams(filters).toString()

  useEffect(() => {
    loadMaterialData()
      .then(setData)
      .catch((err) => {
        console.error(err)
        setError('Não foi possível carregar o relatório.')
      })
  }, [])

  const report = useMemo(
    () => (data ? buildMaterialReport(data, readMaterialFilters(new URLSearchParams(query))) : null),
    [data, query]
  )

  function update(changes: Partial<MaterialReportFilters>) {
    setParams(materialFiltersToParams({ ...filters, ...changes }), { replace: true })
  }

  function renderRow(r: MaterialRow, showSupplier: boolean) {
    const m = r.material
    return (
      <tr key={m.id}>
        <td>
          <span className="product-name">{m.name}</span>
          {!m.active && <span className="type-badge manual"> Inativa</span>}
          {(m.color || m.brand) && (
            <span className="report-sub">{[m.color, m.brand].filter(Boolean).join(' · ')}</span>
          )}
        </td>
        {showSupplier && <td>{r.supplierName}</td>}
        <td>
          <span className={`stock-qty${r.low ? ' stock-low' : ''}`}>
            {formatQty(m.stock)} {m.unit}
          </span>
          {r.low && <span className="stock-badge">Estoque baixo</span>}
        </td>
        <td>
          {formatQty(m.min_stock)} {m.unit}
        </td>
        <td className="price">{brl(m.cost_price)}</td>
        <td className="price">{brl(r.value)}</td>
      </tr>
    )
  }

  const colCount = filters.agrupar ? 5 : 6
  const count = report?.rows.length ?? 0

  return (
    <div>
      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <p className="eyebrow">Relatórios</p>
          <h2>Relatório de matérias-primas</h2>
        </div>
        <a
          href={`/admin/relatorios/materias-primas/pdf?${query}`}
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
            placeholder="Nome, cor ou marca…"
            value={filters.busca}
            onChange={(e) => update({ busca: e.target.value })}
          />
        </div>
        <div className="form-field report-filter-wide">
          <label className="form-field-label" htmlFor="fornecedor">
            Fornecedor
          </label>
          <select id="fornecedor" value={filters.fornecedor} onChange={(e) => update({ fornecedor: e.target.value })}>
            <option value="">Todos os fornecedores</option>
            <option value="sem">Sem fornecedor</option>
            {data?.suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field report-filter-wide">
          <label className="form-field-label" htmlFor="estoque">
            Estoque
          </label>
          <select
            id="estoque"
            value={filters.estoque}
            onChange={(e) => update({ estoque: e.target.value as MaterialStockFilter })}
          >
            {Object.entries(MATERIAL_STOCK_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label className="form-field-label" htmlFor="situacao">
            Situação
          </label>
          <select
            id="situacao"
            value={filters.situacao}
            onChange={(e) => update({ situacao: e.target.value as MaterialActiveFilter })}
          >
            {Object.entries(MATERIAL_ACTIVE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="report-filter-actions">
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={filters.agrupar} onChange={(e) => update({ agrupar: e.target.checked })} />
            Agrupar por fornecedor
          </label>
          <button
            type="button"
            className="ghost-button small"
            onClick={() => update({ busca: '', fornecedor: '', estoque: 'todos', situacao: 'ativos' })}
          >
            Limpar filtros
          </button>
        </div>
      </div>

      {error && <p className="checkout-error">{error}</p>}

      <div className="list-toolbar">
        <span className="list-count">
          {report && report.lowCount > 0 ? `${report.lowCount} com estoque baixo` : ''}
        </span>
        <span className="list-count">
          {count} {count === 1 ? 'item' : 'itens'} · valor em estoque {brl(report?.total ?? 0)}
        </span>
      </div>

      <div className="list-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Matéria-prima</th>
              {!filters.agrupar && <th>Fornecedor</th>}
              <th>Estoque</th>
              <th>Mínimo</th>
              <th>Custo unit.</th>
              <th>Valor em estoque</th>
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
                  Nenhuma matéria-prima com esses filtros.
                </td>
              </tr>
            )}
            {report &&
              (filters.agrupar
                ? report.groups.map((g) => (
                    <Fragment key={g.key}>
                      <tr className="report-group-row">
                        <td colSpan={colCount - 1}>
                          {g.name} · {g.rows.length} {g.rows.length === 1 ? 'item' : 'itens'}
                        </td>
                        <td className="price">{brl(g.total)}</td>
                      </tr>
                      {g.rows.map((r) => renderRow(r, false))}
                    </Fragment>
                  ))
                : report.rows.map((r) => renderRow(r, true)))}
          </tbody>
          {report && count > 0 && (
            <tfoot>
              <tr className="report-total-row">
                <td colSpan={colCount - 1}>
                  Total geral · {count} {count === 1 ? 'item' : 'itens'}
                </td>
                <td className="price">{brl(report.total)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
