import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import './i18n'

import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import Layout from './components/layout/Layout'
import Dashboard from './pages/dashboard/Dashboard'
import ProductsPage from './pages/products/ProductsPage'
import ProductFormPage from './pages/products/ProductFormPage'
import InboundPage from './pages/inbound/InboundPage'
import OutboundPage from './pages/outbound/OutboundPage'
import InventoryPage from './pages/inventory/InventoryPage'
import InventoryDetailPage from './pages/inventory/InventoryDetailPage'
import StockLogsPage from './pages/inventory/StockLogsPage'
import StockHistoryPage from './pages/inventory/StockHistoryPage'
import SalesPage from './pages/sales/SalesPage'
import SalesReportPage from './pages/sales/SalesReportPage'
import FavoritesPage from './pages/sales/FavoritesPage'
import FavoritesAddPage from './pages/sales/FavoritesAddPage'
import SuppliersPage from './pages/suppliers/SuppliersPage'
import AdminUsersPage from './pages/admin/AdminUsersPage'
import AdminMenuPage from './pages/admin/AdminMenuPage'
import LocationsPage from './pages/admin/LocationsPage'
import StockAlertsPage from './pages/alerts/StockAlertsPage'

function ProtectedRoute({ children, requiredRole }) {
  const { user, profile, loading } = useAuth()
  if (loading || (user && !profile)) {
    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"/>
      </div>
    )
  }
  if (!user || !profile?.is_approved) return <Navigate to="/login" replace />
  if (requiredRole === 'admin' && profile?.role !== 'admin') return <Navigate to="/dashboard" replace />
  if (requiredRole === 'manager' && !['admin', 'manager'].includes(profile?.role)) return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <AuthProvider>
        <Toaster position="top-right" toastOptions={{
          style: { background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155' }
        }} />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />

            {/* 상품 */}
            <Route path="products" element={<ProtectedRoute requiredRole="manager"><ProductsPage /></ProtectedRoute>} />
            <Route path="products/new" element={<ProtectedRoute requiredRole="manager"><ProductFormPage /></ProtectedRoute>} />
            <Route path="products/:id/edit" element={<ProtectedRoute requiredRole="manager"><ProductFormPage /></ProtectedRoute>} />

            {/* 입고 */}
            <Route path="inbound" element={<ProtectedRoute requiredRole="manager"><InboundPage /></ProtectedRoute>} />

            {/* 납품관리 (outbound + suppliers 통합) */}
            <Route path="outbound" element={<ProtectedRoute requiredRole="manager"><OutboundPage /></ProtectedRoute>} />
            <Route path="suppliers" element={<ProtectedRoute requiredRole="manager"><SuppliersPage /></ProtectedRoute>} />

            {/* 재고 */}
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="inventory/logs" element={<StockLogsPage />} />
            <Route path="inventory/history" element={<StockHistoryPage />} />
            <Route path="inventory/:id" element={<InventoryDetailPage />} />

            {/* 재고부족 알리미 */}
            <Route path="stock-alerts" element={<ProtectedRoute requiredRole="manager"><StockAlertsPage /></ProtectedRoute>} />

            {/* 오늘판매 */}
            <Route path="sales" element={<SalesPage />} />
            <Route path="sales/report" element={<SalesReportPage />} />
            <Route path="sales/favorites" element={<FavoritesPage />} />
            <Route path="sales/favorites/add" element={<FavoritesAddPage />} />

            {/* 관리자 */}
            <Route path="admin" element={<Navigate to="/admin/users" replace />} />
            <Route path="admin/users" element={<ProtectedRoute requiredRole="admin"><AdminUsersPage /></ProtectedRoute>} />
            <Route path="admin/menus" element={<ProtectedRoute requiredRole="admin"><AdminMenuPage /></ProtectedRoute>} />
            <Route path="admin/locations" element={<ProtectedRoute requiredRole="admin"><LocationsPage /></ProtectedRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
