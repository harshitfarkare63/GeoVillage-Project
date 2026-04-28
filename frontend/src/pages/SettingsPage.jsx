import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react'
import api from '../lib/api'

const StatusDot = ({ ok }) => (
  <div style={{ width: 10, height: 10, borderRadius: '50%', background: ok ? 'var(--success)' : 'var(--danger)', flexShrink: 0, boxShadow: ok ? '0 0 8px var(--success)' : '0 0 8px var(--danger)' }} />
)

export const SettingsPage = () => {
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchHealth = () => {
    setLoading(true)
    // Use the shared api client so it hits the backend URL, not the frontend domain
    api.get('/health')
      .then((r) => setHealth(r.data))
      .catch(() => setHealth({ status: 'error' }))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchHealth() }, [])

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Account, preferences, and system health</p>
        </div>
      </div>

      {/* System Health */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h3>System Health</h3>
          <button className="btn btn-secondary btn-sm" onClick={fetchHealth}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="loading-state"><div className="spinner" /></div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {[
              { label: 'API Server', ok: health?.status !== 'error', detail: `Uptime: ${Math.round(health?.uptime || 0)}s` },
              { label: 'PostgreSQL', ok: health?.database?.status === 'healthy', detail: `${health?.database?.latencyMs ?? '?'}ms` },
              { label: 'Redis Cache', ok: health?.cache?.status === 'healthy', detail: `${health?.cache?.latencyMs ?? '?'}ms` },
            ].map(({ label, ok, detail }) => (
              <div key={label} style={{ background: ok ? 'var(--success-dim)' : 'var(--danger-dim)', border: `1px solid ${ok ? 'rgba(16,185,129,0.2)' : 'rgba(244,63,94,0.2)'}`, borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <StatusDot ok={ok} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{label}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{detail}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Plan Info */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 16 }}>Subscription Plan</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { plan: 'FREE', price: '₹0/mo', limit: '1K req/day', color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.04)' },
            { plan: 'PREMIUM', price: '₹999/mo', limit: '50K req/day', color: 'var(--accent)', bg: 'var(--accent-dim)' },
            { plan: 'PRO', price: '₹4,999/mo', limit: '500K req/day', color: 'var(--accent-2)', bg: 'var(--accent-2-dim)' },
            { plan: 'UNLIMITED', price: 'Custom', limit: 'Unlimited', color: 'var(--warning)', bg: 'var(--warning-dim)' },
          ].map(({ plan, price, limit, color, bg }) => (
            <div key={plan} style={{ background: bg, border: `1px solid ${color}33`, borderRadius: 10, padding: '14px', textAlign: 'center' }}>
              <div style={{ fontWeight: 800, color, fontSize: '0.9375rem', marginBottom: 4 }}>{plan}</div>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{price}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{limit}</div>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 14, fontSize: '0.8125rem' }}>
          To upgrade your plan, contact <a href="mailto:support@geovillage.in" style={{ color: 'var(--accent)', textDecoration: 'none' }}>support@geovillage.in</a>
        </p>
      </div>

      {/* API Reference */}
      <div className="card">
        <h3 style={{ marginBottom: 12 }}>API Quick Reference</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { method: 'GET', path: '/api/v1/states', desc: 'All Indian states' },
            { method: 'GET', path: '/api/v1/districts?stateId=', desc: 'Districts for state' },
            { method: 'GET', path: '/api/v1/subdistricts?districtId=', desc: 'Sub-districts for district' },
            { method: 'GET', path: '/api/v1/villages?subDistrictId=', desc: 'Villages for sub-district' },
            { method: 'GET', path: '/api/v1/search?q=', desc: 'Fuzzy search across all entities' },
            { method: 'GET', path: '/api/v1/autocomplete?q=', desc: 'Typeahead suggestions' },
            { method: 'GET', path: '/health', desc: 'System health check' },
          ].map(({ method, path, desc }) => (
            <div key={path} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--success)', background: 'var(--success-dim)', padding: '2px 7px', borderRadius: 4, flexShrink: 0 }}>{method}</span>
              <code style={{ fontSize: '0.8125rem', flex: 1 }}>{path}</code>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
