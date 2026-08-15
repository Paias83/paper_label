import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { CartProvider } from './context/CartContext'
import { AuthProvider } from './context/AuthContext'

import StoreLayout from './pages/store/StoreLayout'
import Home from './pages/store/Home'
import Catalog from './pages/store/Catalog'
import ProductPage from './pages/store/ProductPage'
import Cart from './pages/store/Cart'
import Login from './pages/store/Login'
import QuoteRequestForm from './pages/store/QuoteRequestForm'
import MyQuotes from './pages/store/MyQuotes'
import QuoteThread from './pages/store/QuoteThread'

import AdminLayout from './pages/admin/AdminLayout'
import ProductList from './pages/admin/ProductList'
import ProductForm from './pages/admin/ProductForm'
import Orders from './pages/admin/Orders'
import Quotes from './pages/admin/Quotes'
import AdminQuoteThread from './pages/admin/QuoteThread'
import SuppliersList from './pages/admin/suppliers/SuppliersList'
import SupplierForm from './pages/admin/suppliers/SupplierForm'
import MaterialsList from './pages/admin/stock/MaterialsList'
import MaterialForm from './pages/admin/stock/MaterialForm'
import Movements from './pages/admin/stock/Movements'
import PurchaseNeeds from './pages/admin/stock/PurchaseNeeds'

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <Routes>
            {/* Loja pública */}
            <Route element={<StoreLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/catalogo" element={<Catalog />} />
              <Route path="/produto/:id" element={<ProductPage />} />
              <Route path="/carrinho" element={<Cart />} />
              <Route path="/entrar" element={<Login />} />
              <Route path="/personalizados/novo" element={<QuoteRequestForm />} />
              <Route path="/meus-orcamentos" element={<MyQuotes />} />
              <Route path="/meus-orcamentos/:id" element={<QuoteThread />} />
            </Route>

            {/* Painel administrativo — acesso restrito a role=admin (checagem em AdminLayout) */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<ProductList />} />
              <Route path="produtos/novo" element={<ProductForm />} />
              <Route path="produtos/:id" element={<ProductForm />} />
              <Route path="pedidos" element={<Orders />} />
              <Route path="orcamentos" element={<Quotes />} />
              <Route path="orcamentos/:id" element={<AdminQuoteThread />} />
              <Route path="fornecedores" element={<SuppliersList />} />
              <Route path="fornecedores/novo" element={<SupplierForm />} />
              <Route path="fornecedores/:id" element={<SupplierForm />} />
              <Route path="estoque" element={<MaterialsList />} />
              <Route path="estoque/novo" element={<MaterialForm />} />
              <Route path="estoque/movimentacoes" element={<Movements />} />
              <Route path="estoque/necessidades-de-compra" element={<PurchaseNeeds />} />
              <Route path="estoque/:id" element={<MaterialForm />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  )
}
