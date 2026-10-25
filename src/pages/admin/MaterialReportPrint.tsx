import { Fragment, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AdminPrintGate from '../../components/AdminPrintGate'
import {
  MATERIAL_ACTIVE_LABEL,
  MATERIAL_STOCK_LABEL,
  buildMaterialReport,
  formatQty,
  loadMaterialData,
  materialFiltersToParams,
  materialLabel,
  readMaterialFilters,
  supplierFilterLabel,
  type MaterialData,
  type MaterialRow,
} from '../../lib/materialReport'

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// Relatório de matérias-primas em A4 — mesmo esquema do relatório de pedidos
// (OrderReportPrint): rota fora do AdminLayout e "Imprimir / Salvar PDF" pelo
// diálogo do navegador. Os filtros chegam pela query string da tela.
export default function MaterialReportPrint() {
  return (
    <AdminPrintGate>
      <MaterialReportSheet />
    </AdminPrintGate>
  )
}

function MaterialReportSheet() {
  const [params] = useSearchParams()
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

  if (error) return <p style={{ padding: 40 }}>{error}</p>
  if (!data) return <p style={{ padding: 40 }}>Carregando relatório…</p>

  const report = buildMaterialReport(data, filters)
  const count = report.rows.length
  const colCount = filters.agrupar ? 5 : 6

  function renderRow(r: MaterialRow, showSupplier: boolean) {
    const m = r.material
    return (
      <tr key={m.id}>
        <td>
          {materialLabel(m)}
          {!m.active && ' (inativa)'}
        </td>
        {showSupplier && <td>{r.supplierName}</td>}
        <td className="op-num">
          {formatQty(m.stock)} {m.unit}
          {r.low && ' ⚠'}
        </td>
        <td className="op-num">
          {formatQty(m.min_stock)} {m.unit}
        </td>
        <td className="op-num">{brl(m.cost_price)}</td>
        <td className="op-num">{brl(r.value)}</td>
      </tr>
    )
  }

  return (
    <div className="order-print-page">
      <div className="order-print-actions">
        <Link to={`/admin/relatorios/materias-primas?${query}`} className="ghost-button">
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
            <p className="op-doc-title">Relatório de matérias-primas</p>
            <p className="op-date">Gerado em {new Date().toLocaleString('pt-BR')}</p>
          </div>
        </header>

        <div className="op-rule" />

        <section className="op-meta">
          <div>
            <span className="op-label">Fornecedor</span>
            <p>{supplierFilterLabel(data, filters.fornecedor)}</p>
          </div>
          <div>
            <span className="op-label">Estoque</span>
            <p>{MATERIAL_STOCK_LABEL[filters.estoque]}</p>
          </div>
          <div>
            <span className="op-label">Situação</span>
            <p>{MATERIAL_ACTIVE_LABEL[filters.situacao]}</p>
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
              <th>Matéria-prima</th>
              {!filters.agrupar && <th>Fornecedor</th>}
              <th className="op-num">Estoque</th>
              <th className="op-num">Mínimo</th>
              <th className="op-num">Custo unit.</th>
              <th className="op-num">Valor</th>
            </tr>
          </thead>
          <tbody>
            {count === 0 && (
              <tr>
                <td colSpan={colCount} style={{ textAlign: 'center', color: '#777' }}>
                  Nenhuma matéria-prima com esses filtros.
                </td>
              </tr>
            )}
            {filters.agrupar
              ? report.groups.map((g) => (
                  <Fragment key={g.key}>
                    <tr className="op-group-row">
                      <td colSpan={colCount - 1}>
                        {g.name} · {g.rows.length} {g.rows.length === 1 ? 'item' : 'itens'}
                      </td>
                      <td className="op-num">{brl(g.total)}</td>
                    </tr>
                    {g.rows.map((r) => renderRow(r, false))}
                  </Fragment>
                ))
              : report.rows.map((r) => renderRow(r, true))}
          </tbody>
        </table>

        {report.lowCount > 0 && (
          <p style={{ fontSize: 11, color: '#555', margin: '0 0 12px' }}>
            ⚠ estoque no mínimo ou abaixo ({report.lowCount} {report.lowCount === 1 ? 'item' : 'itens'})
          </p>
        )}

        <div className="op-totals">
          <div>
            <span>Itens</span>
            <span>{count}</span>
          </div>
          <div className="op-total-final">
            <span>Valor em estoque</span>
            <span>{brl(report.total)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
