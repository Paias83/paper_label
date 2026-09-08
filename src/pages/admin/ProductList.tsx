import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, type Product } from '../../lib/supabase'
import ProductionModal from './ProductionModal'
import CurrencyInput from '../../components/CurrencyInput'

export default function ProductList() {
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [producing, setProducing] = useState<Product | null>(null)

  async function load() {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) console.error(error)
    else setProducts(data ?? [])
  }

  useEffect(() => {
    load()
  }, [])

  // Exclui de verdade quando o produto nunca foi vendido nem produzido.
  // Se já tem histórico, o banco barra com erro de chave estrangeira (23503)
  // e a gente oferece arquivar — some da lista e da loja, sem quebrar pedidos.
  async function removeProduct(p: Product) {
    if (!confirm(`Excluir "${p.name}"? Essa ação não pode ser desfeita.`)) return

    await supabase.from('product_materials').delete().eq('product_id', p.id)
    const { error } = await supabase.from('products').delete().eq('id', p.id)

    if (!error) {
      if (p.images?.length) {
        const paths = p.images
          .map((url) => url.split('/product-images/')[1])
          .filter(Boolean) as string[]
        if (paths.length) await supabase.storage.from('product-images').remove(paths)
      }
      setProducts((prev) => prev.filter((x) => x.id !== p.id))
      return
    }

    if (error.code === '23503') {
      if (
        confirm(
          `"${p.name}" já aparece em pedidos ou produções, então não pode ser excluído. ` +
            'Deseja arquivar? Ele some da lista e da loja, mas continua nos pedidos antigos.'
        )
      ) {
        await archiveProduct(p, true)
      }
      return
    }

    console.error(error)
    alert('Não foi possível excluir o produto.')
  }

  async function archiveProduct(p: Product, archived: boolean) {
    const patch = archived ? { archived: true, active: false } : { archived: false }
    setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...patch } : x)))
    const { error } = await supabase.from('products').update(patch).eq('id', p.id)
    if (error) {
      console.error(error)
      alert('Não foi possível salvar a alteração. Tente novamente.')
      load()
    }
  }

  // Edição rápida direto na lista — o objetivo é que a pessoa
  // leiga nunca precise abrir um formulário só pra mudar preço.
  // Estoque não entra aqui: só sobe via "+ Produção" (consome a
  // ficha técnica) pra não desincronizar da matéria-prima.
  async function updateField(id: string, field: keyof Product, value: unknown) {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)))
    const { error } = await supabase.from('products').update({ [field]: value }).eq('id', id)
    if (error) {
      console.error(error)
      alert('Não foi possível salvar a alteração. Tente novamente.')
      load()
    }
  }

  const filtered = products
    .filter((p) => (showArchived ? p.archived : !p.archived))
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <p className="eyebrow">Catálogo</p>
          <h2>Produtos</h2>
        </div>
        <Link to="/admin/produtos/novo" className="seal-button">
          + Novo produto
        </Link>
      </div>

      <div className="list-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <input
            type="search"
            placeholder="Buscar produto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: 'var(--charcoal)' }}>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Ver arquivados
          </label>
        </div>
        <span className="list-count">
          {filtered.length} {filtered.length === 1 ? 'produto' : 'produtos'}
        </span>
      </div>

      <div className="list-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Produto</th>
              <th>Preço (R$)</th>
              <th>Estoque</th>
              <th>Ativo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                <td>
                  <div className="product-cell">
                    {p.images?.[0] ? (
                      <img className="product-thumb" src={p.images[0]} alt="" />
                    ) : (
                      <span className="product-thumb-empty">✎</span>
                    )}
                    <span className="product-name">{p.name}</span>
                  </div>
                </td>
                <td>
                  <CurrencyInput value={p.price} onChange={(v) => updateField(p.id, 'price', v ?? 0)} />
                </td>
                <td>
                  <span className={`stock-qty${p.stock <= 0 ? ' stock-low' : ''}`}>{p.stock}</span>
                </td>
                <td>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={p.active}
                      onChange={(e) => updateField(p.id, 'active', e.target.checked)}
                    />
                    <span className="track" />
                  </label>
                </td>
                <td>
                  <div className="movement-actions">
                    {p.archived ? (
                      <button
                        type="button"
                        className="entrada"
                        onClick={() => archiveProduct(p, false)}
                      >
                        Restaurar
                      </button>
                    ) : (
                      <>
                        <button type="button" className="entrada" onClick={() => setProducing(p)}>
                          + Produção
                        </button>
                        <Link to={`/admin/produtos/${p.id}`} className="table-action-link">
                          Editar
                        </Link>
                      </>
                    )}
                    <button type="button" className="saida" onClick={() => removeProduct(p)}>
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-state">
                  Nenhum produto encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {producing && (
        <ProductionModal
          product={producing}
          onClose={() => setProducing(null)}
          onSaved={() => {
            setProducing(null)
            load()
          }}
        />
      )}
    </div>
  )
}
