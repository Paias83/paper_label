import { useEffect, useState } from 'react'
import { supabase, type Category } from '../../lib/supabase'

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export default function CategoriesList() {
  const [categories, setCategories] = useState<Category[]>([])
  const [search, setSearch] = useState('')
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    const { data, error } = await supabase.from('categories').select('*').order('name')
    if (error) console.error(error)
    setCategories(data ?? [])
  }

  useEffect(() => {
    load()
  }, [])

  async function toggleActive(c: Category) {
    setCategories((prev) => prev.map((x) => (x.id === c.id ? { ...x, active: !c.active } : x)))
    const { error } = await supabase.from('categories').update({ active: !c.active }).eq('id', c.id)
    if (error) {
      console.error(error)
      alert('Não foi possível salvar a alteração. Tente novamente.')
      load()
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setSaving(true)
    const { data, error } = await supabase
      .from('categories')
      .insert({ name, slug: slugify(name) })
      .select()
      .single()
    setSaving(false)
    if (error || !data) {
      alert('Não foi possível criar a categoria. Talvez já exista uma com esse nome.')
      return
    }
    setCategories((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    setNewName('')
  }

  const filtered = categories.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <p className="eyebrow">Catálogo</p>
          <h2>Categorias</h2>
        </div>
      </div>

      <p style={{ color: 'var(--charcoal)', maxWidth: 640 }}>
        Categorias inativas não aparecem na navegação da loja, mas continuam disponíveis para uso
        interno: relacionar produtos, ficha técnica e pedidos manuais.
      </p>

      <form onSubmit={handleCreate} className="category-add-row" style={{ margin: '16px 0' }}>
        <input
          type="text"
          placeholder="Nome da nova categoria"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="submit" className="seal-button" disabled={saving || !newName.trim()}>
          {saving ? 'Salvando…' : '+ Adicionar'}
        </button>
      </form>

      <div className="list-toolbar">
        <input
          type="search"
          placeholder="Buscar categoria…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="list-count">
          {filtered.length} {filtered.length === 1 ? 'categoria' : 'categorias'}
        </span>
      </div>

      <div className="list-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Categoria</th>
              <th>Slug</th>
              <th>Exibida na loja</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id}>
                <td>
                  <span className="product-name">{c.name}</span>
                  {!c.active && <span className="type-badge manual"> Interna</span>}
                </td>
                <td>{c.slug}</td>
                <td>
                  <label className="toggle-switch">
                    <input type="checkbox" checked={c.active} onChange={() => toggleActive(c)} />
                    <span className="track" />
                  </label>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={3} className="empty-state">
                  Nenhuma categoria encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
