import { useEffect, useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import api from '../lib/api'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 8, padding: '10px 14px', fontSize: '0.8125rem' }}>
      <p style={{ color: 'var(--text-muted)', marginBottom: 6 }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color, fontWeight: 600, marginBottom: 2 }}>
          {p.name}: {Number(p.value).toLocaleString()}
        </p>
      ))}
    </div>
  )
}

export const UsagePage = () => {
  const [usage, setUsage] = useState(null)
  const [days, setDays] = useState(7)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get(`/b2b/usage?days=${days}`)
      .then(({ data }) => setUsage(data.data))
      .finally(() => setLoading(false))
  }, [days])

  const chartData = (usage?.byDay || []).map((d) => ({
    date: new Date(d.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
    requests: Number(d.requests),
    avgMs: Math.round(Number(d.avg_ms)),
  }))

  const endpointData = (usage?.byEndpoint || []).slice(0, 8).map((e) => ({
    endpoint: e.endpoint.replace('/api/v1', ''),
    requests: Number(e.requests),
  }))

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Usage Analytics</h1>
          <p className="page-subtitle">Detailed breakdown of your API consumption</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[7, 14, 30].map((d) => (
            <button key={d} className={`btn btn-sm ${days === d ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setDays(d)}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="loading-state"><div className="spinner" /><span>Loading analytics...</span></div>
      ) : (
        <>
          <div className="stats-grid" style={{ marginBottom: 24 }}>
            {[
              { label: `Total Requests (${days}d)`, value: (usage?.totalRequests || 0).toLocaleString(), color: 'var(--accent)' },
              { label: 'Avg Daily Requests', value: Math.round((usage?.totalRequests || 0) / days).toLocaleString(), color: 'var(--accent-2)' },
              { label: 'Unique Endpoints', value: (usage?.byEndpoint?.length || 0), color: 'var(--warning)' },
              { label: 'Avg Latency (last day)', value: `${Math.round(chartData[chartData.length - 1]?.avgMs || 0)}ms`, color: 'var(--success)' },
            ].map(({ label, value, color }) => (
              <div key={label} className="stat-card">
                <div className="stat-label">{label}</div>
                <div className="stat-value" style={{ color, fontSize: '1.5rem' }}>{value}</div>
              </div>
            ))}
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <span className="card-title">Requests & Latency Over Time</span>
            </div>
            <div className="chart-container" style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gReq" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00d4aa" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#00d4aa" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gMs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} unit="ms" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }} />
                  <Area yAxisId="left" type="monotone" dataKey="requests" name="Requests" stroke="#00d4aa" strokeWidth={2} fill="url(#gReq)" />
                  <Area yAxisId="right" type="monotone" dataKey="avgMs" name="Avg Latency (ms)" stroke="#6366f1" strokeWidth={2} fill="url(#gMs)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Requests by Endpoint</span>
            </div>
            <div className="chart-container" style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={endpointData} layout="vertical" margin={{ top: 0, right: 20, left: 60, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="endpoint" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} width={60} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="requests" name="Requests" fill="#00d4aa" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
