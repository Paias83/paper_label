import { Navigate, useSearchParams } from 'react-router-dom'

export default function Catalog() {
  const [params] = useSearchParams()
  const categoria = params.get('categoria')
  return <Navigate to={categoria ? `/?categoria=${categoria}` : '/'} replace />
}
