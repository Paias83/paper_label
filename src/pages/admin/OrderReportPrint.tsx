import { Fragment, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ORDER_STATUS_LABEL } from '../../lib/orderStatus'
import {
  REPORT_STATUS_LABEL,
  filtersToParams,
  loadOrderReport,
  periodLabel,
  readFilters,
  type OrderReportData,
  type ReportRow,
} from '../../lib/orderReport'

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// Relatório de pedidos em A4 — mesmo esquema da folha de pedido (OrderPrint):
// rota fora do AdminLayout, checagem de admin própria e "Imprimir / Salvar PDF"
// pelo diálogo do navegador. Os filtros chegam pela query string da tela.
export default function OrderReportPrint() {
  const [params] = useSearchParams()
  const filters = readFilters(params)
  const [access, setAccess] = useState<'checking' | 'ok' | 'denied'>('checking')
  const [report, setReport] = useState<OrderReportData | null>(null)
  const [error, setError] = useState('')
  const query = filtersToParams(filters).toString()

  useEffect(() => {
    async function run() {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        setAccess('denied')
        return
      }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
      if (profile?.role !== 'admin') {
        setAccess('denied')
        return
      }
      setAccess('ok')
      try {
        setReport(await loadOrderReport(readFilters(new URLSearchParams(query))))
      } catch (err) {
        console.error(err)
        setError('Não foi possível carregar o relatório.')
      }
    }
    run()
  }, [query])

  if (access === 'checking') return <p style={{ padding: 40 }}>Verificando acesso…</p>
  if (access === 'denied') {
    return (
      <div style={{ padding: 40 }}>
        <h2>Acesso restrito</h2>
        <p>
          É preciso estar logado como administrador. <Link to="/entrar">Entrar</Link>
        </p>
      </div>
    )
  }
  if (error) return <p style={{ padding: 40 }}>{error}</p>
  if (!report) return <p style={{ padding: 40 }}>Carregando relatório…</p>

  const customerFilter = filters.cliente
    ? report.customerOptions.find((c) => c.key === filters.cliente)?.name ?? '—'
    : 'Todos'
  const count = report.rows.length

  function renderRow(r: ReportRow, showCustomer: boolean) {
    return (
      <tr key={r.order.id}>
        <td>{new Date(r.order.created_at).toLocaleDateString('pt-BR')}</td>
        <td>#{r.order.id.slice(0, 8).toUpperCase()}</td>
        {showCustomer && <td>{r.customerName}</td>}
        <td>{r.itemsSummary || '—'}</td>
        <td>{ORDER_STATUS_LABEL[r.order.status]}</td>
        <td className="op-num">{brl(r.order.total)}</td>
      </tr>
    )
  }

  return (
    <div className="order-print-page">
      <div className="order-print-actions">
        <Link to={`/admin/relatorios/pedidos?${query}`} className="ghost-button">
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
            <p className="op-doc-title">Relatório de pedidos</p>
            <p className="op-date">Gerado em {new Date().toLocaleString('pt-BR')}</p>
          </div>
        </header>

        <div className="op-rule" />

        <section className="op-meta">
          <div>
            <span className="op-label">Período</span>
            <p>{periodLabel(filters)}</p>
          </div>
          <div>
            <span className="op-label">Cliente</span>
            <p>{customerFilter}</p>
          </div>
          <div>
            <span className="op-label">Status</span>
            <p>{REPORT_STATUS_LABEL[filters.status]}</p>
          </div>
        </section>

        <table className="op-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Pedido</th>
              {!filters.agrupar && <th>Cliente</th>}
              <th>Itens</th>
              <th>Status</th>
              <th className="op-num">Total</th>
            </tr>
          </thead>
          <tbody>
            {count === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: '#777' }}>
                  Nenhum pedido com esses filtros.
                </td>
              </tr>
            )}
            {filters.agrupar
              ? report.groups.map((g) => (
                  <Fragment key={g.key}>
                    <tr className="op-group-row">
                      <td colSpan={4}>
                        {g.name} · {g.rows.length} {g.rows.length === 1 ? 'pedido' : 'pedidos'}
                      </td>
                      <td className="op-num">{brl(g.total)}</td>
                    </tr>
                    {g.rows.map((r) => renderRow(r, false))}
                  </Fragment>
                ))
              : report.rows.map((r) => renderRow(r, true))}
          </tbody>
        </table>

        <div className="op-totals">
          <div>
            <span>Pedidos</span>
            <span>{count}</span>
          </div>
          <div className="op-total-final">
            <span>Total</span>
            <span>{brl(report.total)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
