import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { useToast } from './hooks/useToast'
import { ToastContainer } from './components/ToastContainer'
import { Sidebar } from './components/Sidebar'
import { AuthPage } from './pages/AuthPage'
import { DashboardPage } from './pages/DashboardPage'
import { ApiKeysPage } from './pages/ApiKeysPage'
import { UsagePage } from './pages/UsagePage'
import { AdminAnalyticsPage } from './pages/AdminAnalyticsPage'
import { AdminUsersPage } from './pages/AdminUsersPage'
import { ApiExplorerPage } from './pages/ApiExplorerPage'
import { AdminDataImportPage } from './pages/AdminDataImportPage'
import { SettingsPage } from './pages/SettingsPage'

// ── Protected Route Wrapper ──
const Protected = ({ children, adminOnly = false }) => {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && user.role !== 'ADMIN') return <Navigate to="/dashboard" replace />
  return children
}

// ── App Shell (sidebar + content) ──
const AppShell = ({ children }) => (
  <div className="layout">
    <Sidebar />
    <main className="main-content">{children}</main>
  </div>
)

// ── Inner App (needs auth context) ──
const InnerApp = () => {
  const { toasts, addToast, removeToast } = useToast()

  return (
    <>
      <Routes>
        <Route path="/login" element={<AuthPage />} />

        {/* B2B Routes */}
        <Route path="/dashboard" element={
          <Protected><AppShell><DashboardPage /></AppShell></Protected>
        } />
        <Route path="/keys" element={
          <Protected><AppShell><ApiKeysPage addToast={addToast} /></AppShell></Protected>
        } />
        <Route path="/usage" element={
          <Protected><AppShell><UsagePage /></AppShell></Protected>
        } />
        <Route path="/explorer" element={
          <Protected><AppShell><ApiExplorerPage /></AppShell></Protected>
        } />
        <Route path="/settings" element={
          <Protected><AppShell><SettingsPage /></AppShell></Protected>
        } />

        {/* Admin Routes */}
        <Route path="/admin/analytics" element={
          <Protected adminOnly><AppShell><AdminAnalyticsPage /></AppShell></Protected>
        } />
        <Route path="/admin/users" element={
          <Protected adminOnly><AppShell><AdminUsersPage /></AppShell></Protected>
        } />
        <Route path="/admin/data" element={
          <Protected adminOnly><AppShell><AdminDataImportPage /></AppShell></Protected>
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <InnerApp />
      </AuthProvider>
    </BrowserRouter>
  )
}
