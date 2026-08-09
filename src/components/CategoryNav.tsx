import { Link } from 'react-router-dom'
import { Cake, Candy, PartyPopper, Sparkles, Star, Tag, Wand2, type LucideIcon } from 'lucide-react'
import type { Category } from '../lib/supabase'

type CategoryNavProps = {
  categories: Category[]
  activeSlug: string | null
}

const ICONS_BY_SLUG: Record<string, LucideIcon> = {
  'topo-de-bolo': Cake,
  'topo-de-doce': Candy,
  'kit-de-festa': PartyPopper,
  personalizados: Wand2,
  decoracao: Sparkles,
}

function getCategoryIcon(slug: string): LucideIcon {
  return ICONS_BY_SLUG[slug] ?? Tag
}

export default function CategoryNav({ categories, activeSlug }: CategoryNavProps) {
  return (
    <nav className="category-nav" aria-label="Categorias">
      <Link to="/" className={`category-pill${activeSlug ? '' : ' active'}`}>
        <Star size={14} />
        Em destaque
      </Link>
      {categories.map((c) => {
        const Icon = getCategoryIcon(c.slug)
        return (
          <Link
            key={c.id}
            to={`/?categoria=${c.slug}`}
            className={`category-pill${activeSlug === c.slug ? ' active' : ''}`}
          >
            <Icon size={14} />
            {c.name}
          </Link>
        )
      })}
    </nav>
  )
}
