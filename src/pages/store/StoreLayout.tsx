import { Outlet } from 'react-router-dom'
import TopBar from '../../components/TopBar'
import StoreHeader from '../../components/StoreHeader'
import StoreFooter from '../../components/StoreFooter'
import ScrollManager from '../../components/ScrollManager'

export default function StoreLayout() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <ScrollManager />
      <TopBar />
      <StoreHeader />
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
      <StoreFooter />
    </div>
  )
}
