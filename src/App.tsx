import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { CartProvider } from './context/CartContext'

import StoreLayout from './pages/store/StoreLayout'
import Home from './pages/store/Home'
import Catalog from './pages/store/Catalog'
import ProductPage from './pages/store/ProductPage'
import Cart from './pages/store/Cart'
import Checkout from './pages/store/Checkout'
import Login from './pages/store/Login'

import AdminLayout from './pages/admin/AdminLayout'
import ProductList from './pages/admin/ProductList'
import ProductForm from './pages/admin/ProductForm'
import Orders from './pages/admin/Orders'

export default function App() {
  return (
    <CartProvider>
      <BrowserRouter>
        <Routes>
          {/* Loja pública */}
          <Route element={<StoreLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/catalogo" element={<Catalog />} />
            <Route path="/produto/:id" element={<ProductPage />} />
            <Route path="/carrinho" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/entrar" element={<Login />} />
          </Route>

          {/* Painel administrativo — proteger com checagem de role=admin */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<ProductList />} />
            <Route path="produtos/novo" element={<ProductForm />} />
            <Route path="produtos/:id" element={<ProductForm />} />
            <Route path="pedidos" element={<Orders />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </CartProvider>
  )
}
