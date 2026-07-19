import { Outlet } from 'react-router-dom'
import StoreHeader from '../../components/StoreHeader'
import StoreFooter from '../../components/StoreFooter'

export default function StoreLayout() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <StoreHeader />
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
      <StoreFooter />
    </div>
  )
}
