import { Outlet } from 'react-router-dom'
import TopBar from '../../components/TopBar'
import StoreHeader from '../../components/StoreHeader'
import StoreFooter from '../../components/StoreFooter'

export default function StoreLayout() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <TopBar />
      <StoreHeader />
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
      <StoreFooter />
    </div>
  )
}
