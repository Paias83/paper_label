import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase, type Category, type RawMaterial } from '../../lib/supabase'
import CurrencyInput from '../../components/CurrencyInput'

const emptyForm = {
  name: '',
  description: '',
  price: 0,
  stock: 0,
  category_id: '',
  images: [] as string[],
  active: true,
  featured: false,
  weight_kg: 0.3,
  width_cm: 16,
  height_cm: 4,
  length_cm: 16,
}

type RecipeRow = { material_id: string; quantity: number }

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
  const [materials, setMaterials] = useState<RawMaterial[]>([])
  const [recipe, setRecipe] = useState<RecipeRow[]>([])

  useEffect(() => {
    supabase
      .from('categories')
      .select('*')
      .order('name')
      .then(({ data }) => setCategories(data ?? []))

    supabase
      .from('raw_materials')
      .select('*')
      .eq('active', true)
      .order('name')
      .then(({ data }) => setMaterials(data ?? []))
  }, [])

  useEffect(() => {
    if (!isEditing) return
    supabase
      .from('product_materials')
      .select('material_id, quantity')
      .eq('product_id', id)
      .then(({ data }) => setRecipe(data ?? []))
  }, [id, isEditing])

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

  function setCoverImage(url: string) {
    setForm((f) => ({ ...f, images: [url, ...f.images.filter((img) => img !== url)] }))
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

  function materialCost(materialId: string) {
    return materials.find((m) => m.id === materialId)?.cost_price ?? 0
  }

  function addRecipeRow() {
    setRecipe((rows) => [...rows, { material_id: '', quantity: 1 }])
  }

  function updateRecipeRow(index: number, changes: Partial<RecipeRow>) {
    setRecipe((rows) => rows.map((row, i) => (i === index ? { ...row, ...changes } : row)))
  }

  // Para matéria-prima em kWh, a quantidade é armazenada em horas —
  // o custo por hora já está salvo como custo unitário da matéria-prima.
  function updateRecipeTime(index: number, changes: { hours?: number; minutes?: number }) {
    setRecipe((rows) =>
      rows.map((row, i) => {
        if (i !== index) return row
        const current = row.quantity || 0
        const currentHours = Math.floor(current)
        const currentMinutes = Math.round((current - currentHours) * 60)
        const hours = changes.hours ?? currentHours
        const minutes = changes.minutes ?? currentMinutes
        return { ...row, quantity: hours + minutes / 60 }
      })
    )
  }

  function removeRecipeRow(index: number) {
    setRecipe((rows) => rows.filter((_, i) => i !== index))
  }

  const totalCost = recipe.reduce((sum, row) => sum + materialCost(row.material_id) * row.quantity, 0)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = { ...form, category_id: form.category_id || null, cost_price: totalCost }
    const query = isEditing
      ? supabase.from('products').update(payload).eq('id', id).select().single()
      : supabase.from('products').insert(payload).select().single()
    const { data, error } = await query
    if (error || !data) {
      setSaving(false)
      alert('Não foi possível salvar o produto.')
      console.error(error)
      return
    }

    const validRows = recipe.filter((row) => row.material_id && row.quantity > 0)
    await supabase.from('product_materials').delete().eq('product_id', data.id)
    if (validRows.length > 0) {
      const { error: recipeError } = await supabase.from('product_materials').insert(
        validRows.map((row) => ({ product_id: data.id, material_id: row.material_id, quantity: row.quantity }))
      )
      if (recipeError) {
        setSaving(false)
        alert('Produto salvo, mas não foi possível salvar a ficha técnica.')
        console.error(recipeError)
        return
      }
    }

    setSaving(false)
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
                  <CurrencyInput
                    id="price"
                    value={form.price}
                    onChange={(v) => setForm({ ...form, price: v ?? 0 })}
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
            <p style={{ marginTop: 8, marginBottom: -8, color: 'var(--charcoal)', fontSize: '0.85rem' }}>
              Peso e dimensões da embalagem — usados para calcular o frete real na loja.
            </p>
            <div className="form-row">
              <div className="form-field">
                <label className="form-field-label" htmlFor="weight_kg">
                  Peso (kg)
                </label>
                <input
                  id="weight_kg"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.weight_kg}
                  onChange={(e) => setForm({ ...form, weight_kg: Number(e.target.value) })}
                  required
                />
              </div>
              <div className="form-field">
                <label className="form-field-label" htmlFor="width_cm">
                  Largura (cm)
                </label>
                <input
                  id="width_cm"
                  type="number"
                  step="0.1"
                  min="1"
                  value={form.width_cm}
                  onChange={(e) => setForm({ ...form, width_cm: Number(e.target.value) })}
                  required
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-field">
                <label className="form-field-label" htmlFor="height_cm">
                  Altura (cm)
                </label>
                <input
                  id="height_cm"
                  type="number"
                  step="0.1"
                  min="1"
                  value={form.height_cm}
                  onChange={(e) => setForm({ ...form, height_cm: Number(e.target.value) })}
                  required
                />
              </div>
              <div className="form-field">
                <label className="form-field-label" htmlFor="length_cm">
                  Comprimento (cm)
                </label>
                <input
                  id="length_cm"
                  type="number"
                  step="0.1"
                  min="1"
                  value={form.length_cm}
                  onChange={(e) => setForm({ ...form, length_cm: Number(e.target.value) })}
                  required
                />
              </div>
            </div>
          </div>

          <div className="form-card">
            <h3>Ficha técnica</h3>
            <p style={{ marginTop: -8, marginBottom: 16, color: 'var(--charcoal)', fontSize: '0.85rem' }}>
              Matérias-primas usadas para fabricar este produto — define o preço de custo.
            </p>
            {recipe.map((row, index) => {
              const material = materials.find((m) => m.id === row.material_id)
              const lineCost = materialCost(row.material_id) * row.quantity
              return (
                <div key={index} className="form-row recipe-row">
                  <div className="form-field recipe-field-material">
                    <label className="form-field-label">Matéria-prima</label>
                    <select
                      value={row.material_id}
                      onChange={(e) => updateRecipeRow(index, { material_id: e.target.value })}
                    >
                      <option value="">Selecione…</option>
                      {materials.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.color ? `${m.name} — ${m.color}` : m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {material?.unit === 'kWh' || material?.unit === 'hora' ? (
                    <>
                      <div className="form-field recipe-field-narrow">
                        <label className="form-field-label">Horas</label>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={Math.floor(row.quantity)}
                          onChange={(e) => updateRecipeTime(index, { hours: Number(e.target.value) })}
                        />
                      </div>
                      <div className="form-field recipe-field-narrow">
                        <label className="form-field-label">Minutos</label>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          max="59"
                          value={Math.round((row.quantity - Math.floor(row.quantity)) * 60)}
                          onChange={(e) => updateRecipeTime(index, { minutes: Number(e.target.value) })}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="form-field recipe-field-qty">
                      <label className="form-field-label">Qtd. {material ? `(${material.unit})` : ''}</label>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        value={row.quantity}
                        onChange={(e) => updateRecipeRow(index, { quantity: Number(e.target.value) })}
                      />
                    </div>
                  )}
                  <div className="form-field recipe-field-cost">
                    <label className="form-field-label">Preço fracionado</label>
                    <p style={{ margin: '0 0 8px' }}>
                      {lineCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="icon-button recipe-field-remove"
                    aria-label="Remover material"
                    title="Remover material"
                    onClick={() => removeRecipeRow(index)}
                  >
                    ×
                  </button>
                </div>
              )
            })}
            <button type="button" className="ghost-button small" onClick={addRecipeRow}>
              + Adicionar material
            </button>
            <div className="form-field" style={{ marginTop: 16 }}>
              <span className="form-field-label">Preço de custo do produto</span>
              <p style={{ margin: 0, fontWeight: 600 }}>
                {totalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
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
                {form.images.map((url, index) => (
                  <div key={url} className={`image-thumb${index === 0 ? ' is-cover' : ''}`}>
                    <img src={url} alt="" />
                    <button type="button" onClick={() => removeImage(url)} aria-label="Remover foto">
                      ×
                    </button>
                    {index === 0 ? (
                      <span className="cover-badge">Capa</span>
                    ) : (
                      <button
                        type="button"
                        className="set-cover-button"
                        onClick={() => setCoverImage(url)}
                      >
                        Definir como capa
                      </button>
                    )}
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
