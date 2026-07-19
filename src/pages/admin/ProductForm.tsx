import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase, type Category } from '../../lib/supabase'

const emptyForm = {
  name: '',
  description: '',
  price: 0,
  stock: 0,
  category_id: '',
  images: [] as string[],
  active: true,
  featured: false,
}

export default function ProductForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = Boolean(id)
  const [form, setForm] = useState(emptyForm)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(isEditing)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [savingCategory, setSavingCategory] = useState(false)

  useEffect(() => {
    supabase
      .from('categories')
      .select('*')
      .order('name')
      .then(({ data }) => setCategories(data ?? []))
  }, [])

  useEffect(() => {
    if (!isEditing) return
    supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) setForm(data)
        setLoading(false)
      })
  }, [id, isEditing])

  // Upload de fotos direto pro Supabase Storage — a pessoa só arrasta o arquivo,
  // sem precisar entender de URLs ou buckets.
  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const path = `${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('product-images').upload(path, file)
    if (error) {
      alert('Falha ao enviar a imagem.')
    } else {
      const { data } = supabase.storage.from('product-images').getPublicUrl(path)
      setForm((f) => ({ ...f, images: [...f.images, data.publicUrl] }))
    }
    setUploading(false)
    e.target.value = ''
  }

  function removeImage(url: string) {
    setForm((f) => ({ ...f, images: f.images.filter((img) => img !== url) }))
  }

  function slugify(text: string) {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[^\x00-\x7F]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
  }

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault()
    const name = newCategoryName.trim()
    if (!name) return
    setSavingCategory(true)
    const { data, error } = await supabase
      .from('categories')
      .insert({ name, slug: slugify(name) })
      .select()
      .single()
    setSavingCategory(false)
    if (error || !data) {
      alert('Não foi possível criar a categoria. Talvez já exista uma com esse nome.')
      console.error(error)
      return
    }
    setCategories((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    setForm((f) => ({ ...f, category_id: data.id }))
    setNewCategoryName('')
    setAddingCategory(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = { ...form, category_id: form.category_id || null }
    const query = isEditing
      ? supabase.from('products').update(payload).eq('id', id)
      : supabase.from('products').insert(payload)
    const { error } = await query
    setSaving(false)
    if (error) {
      alert('Não foi possível salvar o produto.')
      console.error(error)
      return
    }
    navigate('/admin')
  }

  if (loading) {
    return <p>Carregando produto…</p>
  }

  return (
    <form onSubmit={handleSave}>
      <div className="admin-page-header">
        <Link to="/admin" className="admin-back-link">
          ← Produtos
        </Link>
        <h2>{isEditing ? 'Editar produto' : 'Novo produto'}</h2>
      </div>

      <div className="form-shell">
        <div>
          <div className="form-card">
            <h3>Informações</h3>
            <div className="form-field">
              <label className="form-field-label" htmlFor="name">
                Nome
              </label>
              <input
                id="name"
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="form-field">
              <label className="form-field-label" htmlFor="description">
                Descrição
              </label>
              <textarea
                id="description"
                value={form.description ?? ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={5}
              />
            </div>
            <div className="form-field">
              <label className="form-field-label" htmlFor="category">
                Categoria
              </label>
              <div className="category-row">
                <select
                  id="category"
                  value={form.category_id ?? ''}
                  onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                >
                  <option value="">Sem categoria</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Nova categoria"
                  title="Nova categoria"
                  onClick={() => setAddingCategory((v) => !v)}
                >
                  +
                </button>
              </div>
              {addingCategory && (
                <div className="category-add-row">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Nome da nova categoria"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateCategory(e)
                      if (e.key === 'Escape') setAddingCategory(false)
                    }}
                  />
                  <button
                    type="button"
                    className="ghost-button small"
                    disabled={savingCategory || !newCategoryName.trim()}
                    onClick={handleCreateCategory}
                  >
                    {savingCategory ? 'Salvando…' : 'Adicionar'}
                  </button>
                </div>
              )}
            </div>
            <div className="form-row">
              <div className="form-field">
                <label className="form-field-label" htmlFor="price">
                  Preço
                </label>
                <div className="price-field">
                  <span className="prefix">R$</span>
                  <input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                    required
                  />
                </div>
              </div>
              <div className="form-field">
                <label className="form-field-label" htmlFor="stock">
                  Estoque
                </label>
                <input
                  id="stock"
                  type="number"
                  min="0"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
                  required
                />
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="form-card">
            <h3>Fotos</h3>
            <label className="upload-zone">
              <span className="icon">✎</span>
              <span className="label">
                {uploading ? 'Enviando…' : 'Clique ou arraste uma foto'}
              </span>
              <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
            </label>
            {form.images.length > 0 && (
              <div className="image-grid">
                {form.images.map((url) => (
                  <div key={url} className="image-thumb">
                    <img src={url} alt="" />
                    <button type="button" onClick={() => removeImage(url)} aria-label="Remover foto">
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-card">
            <h3>Visibilidade</h3>
            <div className="toggle-field">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                <span className="track" />
              </label>
              <div className="toggle-text">
                <strong>Visível na loja</strong>
                <span>Aparece no catálogo para os clientes</span>
              </div>
            </div>
            <div className="toggle-field">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                />
                <span className="track" />
              </label>
              <div className="toggle-text">
                <strong>Destaque na home</strong>
                <span>Mostrado na vitrine da página inicial</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="form-actions">
        <Link to="/admin" className="ghost-button">
          Cancelar
        </Link>
        <button className="seal-button" type="submit" disabled={uploading || saving}>
          {saving ? 'Salvando…' : 'Salvar produto'}
        </button>
      </div>
    </form>
  )
}
