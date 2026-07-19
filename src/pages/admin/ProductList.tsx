import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, type Product } from '../../lib/supabase'

export default function ProductList() {
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')

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

  // Edição rápida direto na lista — o objetivo é que a pessoa
  // leiga nunca precise abrir um formulário só pra mudar preço/estoque.
  async function updateField(id: string, field: keyof Product, value: unknown) {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)))
    const { error } = await supabase.from('products').update({ [field]: value }).eq('id', id)
    if (error) {
      console.error(error)
      alert('Não foi possível salvar a alteração. Tente novamente.')
      load()
    }
  }

  const filtered = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))

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
        <input
          type="search"
          placeholder="Buscar produto…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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
                  <input
                    type="number"
                    step="0.01"
                    value={p.price}
                    onChange={(e) => updateField(p.id, 'price', Number(e.target.value))}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={p.stock}
                    onChange={(e) => updateField(p.id, 'stock', Number(e.target.value))}
                  />
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
                  <Link to={`/admin/produtos/${p.id}`} className="table-action-link">
                    Editar
                  </Link>
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
    </div>
  )
}
