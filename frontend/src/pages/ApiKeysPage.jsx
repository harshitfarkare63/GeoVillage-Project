import { useEffect, useState } from 'react'
import { Plus, Copy, Trash2, Eye, EyeOff, RefreshCw } from 'lucide-react'
import api from '../lib/api'

const PlanBadge = ({ plan }) => {
  const cls = { FREE: 'badge-muted', PREMIUM: 'badge-accent', PRO: 'badge-purple', UNLIMITED: 'badge-warning' }[plan] || 'badge-muted'
  return <span className={`badge ${cls}`}>{plan}</span>
}

export const ApiKeysPage = ({ addToast }) => {
  const [keys, setKeys] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [newKey, setNewKey] = useState(null)
  const [showNewKey, setShowNewKey] = useState(true)

  const fetchKeys = async () => {
    setLoading(true)
    const { data } = await api.get('/b2b/keys')
    setKeys(data.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchKeys() }, [])

  const generateKey = async () => {
    setGenerating(true)
    try {
      const { data } = await api.post('/b2b/keys/generate')
      setNewKey(data.data)
      setShowNewKey(true)
      addToast('API key generated! Save it now — it won\'t be shown again.', 'success')
      fetchKeys()
    } catch {
      addToast('Failed to generate API key', 'error')
    } finally {
      setGenerating(false)
    }
  }

  const revokeKey = async (id) => {
    if (!confirm('Revoke this API key? This cannot be undone.')) return
    try {
      await api.delete(`/b2b/keys/${id}`)
      addToast('API key revoked', 'success')
      fetchKeys()
    } catch {
      addToast('Failed to revoke key', 'error')
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    addToast('Copied to clipboard', 'success')
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">API Keys</h1>
          <p className="page-subtitle">Manage your API keys for authenticating requests</p>
        </div>
        <button className="btn btn-primary" onClick={generateKey} disabled={generating}>
          {generating ? <div className="spinner" style={{ width: 14, height: 14 }} /> : <Plus size={16} />}
          Generate Key
        </button>
      </div>

      {/* New Key Reveal */}
      {newKey && (
        <div className="card" style={{ marginBottom: 20, border: '1px solid rgba(0,212,170,0.3)', background: 'rgba(0,212,170,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <h3 style={{ color: 'var(--accent)', marginBottom: 2 }}>🔑 New API Key Generated</h3>
              <p style={{ fontSize: '0.8125rem' }}>Copy and store this key securely. It will not be shown again.</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowNewKey(s => !s)}>
                {showNewKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setNewKey(null)}><Trash2 size={14} /></button>
            </div>
          </div>
          <div className="key-display">
            <span style={{ flex: 1 }}>{showNewKey ? newKey.apiKey : newKey.apiKey.replace(/./g, '•')}</span>
            <button onClick={() => copyToClipboard(newKey.apiKey)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', display: 'flex' }}>
              <Copy size={14} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            <span>Plan: <PlanBadge plan={newKey.plan} /></span>
            <span>Daily Limit: <strong style={{ color: 'var(--text-primary)' }}>{newKey.dailyLimit?.toLocaleString()}</strong></span>
          </div>
        </div>
      )}

      {/* Keys Table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Your API Keys ({keys.length})</span>
          <button className="btn btn-secondary btn-sm" onClick={fetchKeys}><RefreshCw size={13} /></button>
        </div>

        {loading ? (
          <div className="loading-state"><div className="spinner" /><span>Loading keys...</span></div>
        ) : keys.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🔑</div>
            <h3>No API Keys</h3>
            <p>Generate your first key to start using the API</p>
          </div>
        ) : (
          <div className="table-wrapper" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>Key Prefix</th>
                  <th>Plan</th>
                  <th>Daily Limit</th>
                  <th>Status</th>
                  <th>Last Used</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <code style={{ fontSize: '0.8125rem' }}>{k.prefix}</code>
                        <button onClick={() => copyToClipboard(k.prefix)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                          <Copy size={12} />
                        </button>
                      </div>
                    </td>
                    <td><PlanBadge plan={k.plan} /></td>
                    <td style={{ fontWeight: 600 }}>{k.dailyLimit?.toLocaleString()}</td>
                    <td>
                      <span className={`badge ${k.isActive ? 'badge-success' : 'badge-danger'}`}>
                        {k.isActive ? 'Active' : 'Revoked'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                      {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                      {new Date(k.createdAt).toLocaleDateString('en-IN')}
                    </td>
                    <td>
                      {k.isActive && (
                        <button className="btn btn-danger btn-sm" onClick={() => revokeKey(k.id)}>
                          <Trash2 size={12} /> Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Usage Guide */}
      <div className="card" style={{ marginTop: 20 }}>
        <h3 style={{ marginBottom: 12 }}>Quick Start</h3>
        <p style={{ marginBottom: 12, fontSize: '0.875rem' }}>Include your API key in the <code>X-API-Key</code> header:</p>
        <div className="key-display" style={{ marginBottom: 10 }}>
          <code style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
            curl -H "X-API-Key: gva_live_your_key" https://api.geovillage.in/api/v1/states
          </code>
          <button onClick={() => copyToClipboard('curl -H "X-API-Key: gva_live_your_key" https://api.geovillage.in/api/v1/states')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <Copy size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
