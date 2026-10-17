import { Fragment, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ORDER_STATUS_LABEL } from '../../lib/orderStatus'
import {
  REPORT_STATUS_LABEL,
  filtersToParams,
  loadOrderReport,
  periodLabel,
  readFilters,
  type OrderReportData,
  type ReportFilters,
  type ReportRow,
  type ReportStatus,
} from '../../lib/orderReport'

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function OrderReport() {
  const [params, setParams] = useSearchParams()
  const filters = readFilters(params)
  const [report, setReport] = useState<OrderReportData | null>(null)
  const [error, setError] = useState('')
  const query = filtersToParams(filters).toString()

  useEffect(() => {
    let active = true
    setError('')
    loadOrderReport(readFilters(new URLSearchParams(query)))
      .then((data) => active && setReport(data))
      .catch((err) => {
        console.error(err)
        if (active) setError('Não foi possível carregar o relatório.')
      })
    return () => {
      active = false
    }
  }, [query])

  function update(changes: Partial<ReportFilters>) {
    setParams(filtersToParams({ ...filters, ...changes }), { replace: true })
  }

  function renderRow(r: ReportRow, showCustomer: boolean) {
    return (
      <tr key={r.order.id}>
        <td>{new Date(r.order.created_at).toLocaleDateString('pt-BR')}</td>
        <td>
          <span className="order-id">{r.order.id.slice(0, 8)}</span>
          {r.order.source === 'manual' && <span className="type-badge manual"> Manual</span>}
        </td>
        {showCustomer && (
          <td className="customer-cell">
            <span className="customer-name">{r.customerName}</span>
            {r.customerEmail && r.customerEmail !== r.customerName && (
              <span className="customer-email">{r.customerEmail}</span>
            )}
          </td>
        )}
        <td className="report-items">{r.itemsSummary || '—'}</td>
        <td>
          <span className={`type-badge order-status-${r.order.status}`}>{ORDER_STATUS_LABEL[r.order.status]}</span>
        </td>
        <td className="price">{brl(r.order.total)}</td>
      </tr>
    )
  }

  const colCount = filters.agrupar ? 5 : 6
  const count = report?.rows.length ?? 0

  return (
    <div>
      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <p className="eyebrow">Vendas</p>
          <h2>Relatório de pedidos</h2>
        </div>
        <a
          href={`/admin/relatorios/pedidos/pdf?${query}`}
          target="_blank"
          rel="noreferrer"
          className="seal-button"
          title="Abre a versão A4 para imprimir ou salvar em PDF"
        >
          Gerar PDF
        </a>
      </div>

      <div className="form-card report-filters">
        <div className="form-field">
          <label className="form-field-label" htmlFor="de">
            De
          </label>
          <input id="de" type="date" value={filters.de} onChange={(e) => update({ de: e.target.value })} />
        </div>
        <div className="form-field">
          <label className="form-field-label" htmlFor="ate">
            Até
          </label>
          <input id="ate" type="date" value={filters.ate} onChange={(e) => update({ ate: e.target.value })} />
        </div>
        <div className="form-field report-filter-wide">
          <label className="form-field-label" htmlFor="cliente">
            Cliente
          </label>
          <select id="cliente" value={filters.cliente} onChange={(e) => update({ cliente: e.target.value })}>
            <option value="">Todos os clientes</option>
            {report?.customerOptions.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field report-filter-wide">
          <label className="form-field-label" htmlFor="status">
            Status
          </label>
          <select
            id="status"
            value={filters.status}
            onChange={(e) => update({ status: e.target.value as ReportStatus })}
          >
            {Object.entries(REPORT_STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="report-filter-actions">
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={filters.agrupar} onChange={(e) => update({ agrupar: e.target.checked })} />
            Agrupar por cliente
          </label>
          <button type="button" className="ghost-button small" onClick={() => update({ de: '', ate: '' })}>
            Todo o período
          </button>
        </div>
      </div>

      {error && <p className="checkout-error">{error}</p>}

      <div className="list-toolbar">
        <span className="list-count">{periodLabel(filters)}</span>
        <span className="list-count">
          {count} {count === 1 ? 'pedido' : 'pedidos'} · total {brl(report?.total ?? 0)}
        </span>
      </div>

      <div className="list-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Pedido</th>
              {!filters.agrupar && <th>Cliente</th>}
              <th>Itens</th>
              <th>Status</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {!report && (
              <tr>
                <td colSpan={colCount} className="empty-state">
                  Carregando…
                </td>
              </tr>
            )}
            {report && count === 0 && (
              <tr>
                <td colSpan={colCount} className="empty-state">
                  Nenhum pedido com esses filtros.
                </td>
              </tr>
            )}
            {report &&
              (filters.agrupar
                ? report.groups.map((g) => (
                    <Fragment key={g.key}>
                      <tr className="report-group-row">
                        <td colSpan={colCount - 1}>
                          {g.name} · {g.rows.length} {g.rows.length === 1 ? 'pedido' : 'pedidos'}
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
                <td colSpan={colCount - 1}>Total geral · {count} {count === 1 ? 'pedido' : 'pedidos'}</td>
                <td className="price">{brl(report.total)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
