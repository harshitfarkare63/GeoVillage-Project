import { useState } from 'react'
import { Search, ChevronRight, Loader2 } from 'lucide-react'
import api from '../lib/api'

const ResultBlock = ({ title, items, fields }) => {
  if (!items?.length) return null
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header" style={{ marginBottom: 12 }}>
        <span className="card-title">{title}</span>
        <span className="badge badge-muted">{items.length} results</span>
      </div>
      <div className="table-wrapper" style={{ border: 'none' }}>
        <table>
          <thead>
            <tr>{fields.map((f) => <th key={f.key}>{f.label}</th>)}</tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i}>
                {fields.map((f) => (
                  <td key={f.key} style={f.mono ? { fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' } : {}}>
                    {item[f.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const ENDPOINTS = [
  { label: 'GET /states', path: '/v1/states', params: [] },
  { label: 'GET /districts', path: '/v1/districts', params: [{ key: 'stateId', placeholder: 'e.g. 1' }] },
  { label: 'GET /subdistricts', path: '/v1/subdistricts', params: [{ key: 'districtId', placeholder: 'e.g. 101' }] },
  { label: 'GET /villages', path: '/v1/villages', params: [{ key: 'subDistrictId', placeholder: 'e.g. 5001' }] },
  { label: 'GET /search', path: '/v1/search', params: [{ key: 'q', placeholder: 'e.g. Pune' }, { key: 'type', placeholder: 'village | district | state' }] },
  { label: 'GET /autocomplete', path: '/v1/autocomplete', params: [{ key: 'q', placeholder: 'e.g. Mumb' }] },
]

export const ApiExplorerPage = () => {
  const [selected, setSelected] = useState(ENDPOINTS[0])
  const [params, setParams] = useState({})
  const [limit, setLimit] = useState('20')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [latency, setLatency] = useState(null)

  const handleEndpointChange = (ep) => {
    setSelected(ep)
    setParams({})
    setResult(null)
    setError('')
    setLatency(null)
  }

  const handleRun = async () => {
    setLoading(true)
    setError('')
    setResult(null)
    const query = { ...params, limit }
    const queryStr = Object.entries(query)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&')
    const url = `/api${selected.path}${queryStr ? '?' + queryStr : ''}`
    const start = performance.now()
    try {
      const { data } = await api.get(url.replace('/api/api', '/api'))
      setLatency(Math.round(performance.now() - start))
      setResult(data)
    } catch (err) {
      setError(JSON.stringify(err.response?.data || { message: err.message }, null, 2))
      setLatency(Math.round(performance.now() - start))
    } finally {
      setLoading(false)
    }
  }

  const setParam = (key) => (e) => setParams((p) => ({ ...p, [key]: e.target.value }))

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">API Explorer</h1>
          <p className="page-subtitle">Test live GeoVillage API endpoints in the browser</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Endpoint List */}
        <div className="card" style={{ padding: 8 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', padding: '8px 10px 6px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Endpoints
          </div>
          {ENDPOINTS.map((ep) => (
            <button
              key={ep.path}
              onClick={() => handleEndpointChange(ep)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '9px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: '0.75rem', textAlign: 'left',
                background: selected.path === ep.path ? 'var(--accent-dim)' : 'none',
                color: selected.path === ep.path ? 'var(--accent)' : 'var(--text-secondary)',
                transition: 'all 0.15s',
              }}
            >
              {ep.label}
              {selected.path === ep.path && <ChevronRight size={12} />}
            </button>
          ))}
        </div>

        {/* Request Panel */}
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            {/* URL bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--success)', background: 'var(--success-dim)', padding: '2px 8px', borderRadius: 4 }}>GET</span>
              <code style={{ flex: 1, fontSize: '0.8125rem', color: 'var(--text-secondary)', background: 'none', border: 'none', padding: 0 }}>
                /api{selected.path}
              </code>
              {latency !== null && (
                <span style={{ fontSize: '0.75rem', color: latency < 100 ? 'var(--success)' : 'var(--warning)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                  {latency}ms
                </span>
              )}
            </div>

            {/* Params */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, marginBottom: 14 }}>
              {selected.params.map((p) => (
                <div key={p.key}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>{p.key}</label>
                  <input
                    className="form-input"
                    style={{ fontSize: '0.8125rem' }}
                    placeholder={p.placeholder}
                    value={params[p.key] || ''}
                    onChange={setParam(p.key)}
                  />
                </div>
              ))}
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>limit</label>
                <input className="form-input" style={{ fontSize: '0.8125rem' }} value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="20" />
              </div>
            </div>

            <button className="btn btn-primary" onClick={handleRun} disabled={loading}>
              {loading ? <Loader2 size={15} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Search size={15} />}
              {loading ? 'Running...' : 'Run Request'}
            </button>
          </div>

          {/* Response */}
          {error && (
            <div className="card" style={{ borderColor: 'rgba(244,63,94,0.3)', background: 'var(--danger-dim)' }}>
              <div className="card-header"><span style={{ color: 'var(--danger)', fontWeight: 600 }}>Error Response</span></div>
              <pre style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--danger)', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>{error}</pre>
            </div>
          )}

          {result && !error && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span className="badge badge-success">200 OK</span>
                {result.meta && (
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                    {result.meta.total?.toLocaleString()} total · showing {result.data?.length}
                  </span>
                )}
              </div>

              {/* Visual table for geo results */}
              {Array.isArray(result.data) && result.data.length > 0 && (
                <ResultBlock
                  title="Results"
                  items={result.data}
                  fields={Object.keys(result.data[0]).map((k) => ({ key: k, label: k, mono: k === 'id' }))}
                />
              )}

              {/* Raw JSON toggle */}
              <details>
                <summary style={{ cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--text-muted)', padding: '8px 0', userSelect: 'none' }}>
                  View raw JSON
                </summary>
                <div className="card" style={{ marginTop: 8 }}>
                  <pre style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)', overflowX: 'auto', whiteSpace: 'pre-wrap', maxHeight: 400 }}>
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              </details>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
