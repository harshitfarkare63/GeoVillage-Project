import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export const AuthPage = () => {
  const [tab, setTab] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login, register } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = tab === 'login'
        ? await login(form.email, form.password)
        : await register(form.name, form.email, form.password)
      navigate(user.role === 'ADMIN' ? '/admin/analytics' : '/dashboard')
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const set = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }))

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-badge">🌍</div>
          <h2 style={{ fontSize: '1.25rem', marginBottom: 4 }}>GeoVillage API</h2>
          <p style={{ fontSize: '0.875rem' }}>Village-level geographic data for India</p>
        </div>

        <div className="auth-tabs">
          <button className={`auth-tab${tab === 'login' ? ' active' : ''}`} onClick={() => setTab('login')}>Sign In</button>
          <button className={`auth-tab${tab === 'register' ? ' active' : ''}`} onClick={() => setTab('register')}>Register</button>
        </div>

        <form onSubmit={handleSubmit}>
          {tab === 'register' && (
            <div className="form-group">
              <label className="form-label">Company / Full Name</label>
              <input className="form-input" placeholder="Acme Corp" value={form.name} onChange={set('name')} required />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" placeholder="admin@company.com" value={form.email} onChange={set('email')} required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" placeholder="Min 8 characters" value={form.password} onChange={set('password')} required />
          </div>

          {error && (
            <div style={{ background: 'var(--danger-dim)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 'var(--radius-sm)', padding: '10px 13px', fontSize: '0.8125rem', color: 'var(--danger)', marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '10px' }}>
            {loading ? <div className="spinner" style={{ width: 16, height: 16 }} /> : tab === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="divider" />
        <p style={{ fontSize: '0.75rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          By continuing you agree to GeoVillage's Terms of Service
        </p>
      </div>
    </div>
  )
}
