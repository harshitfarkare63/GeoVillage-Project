import { useEffect, useState } from 'react'
import { Activity, Key, TrendingUp, Zap } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'

const planColors = { FREE: 'var(--text-muted)', PREMIUM: 'var(--accent)', PRO: 'var(--accent-2)', UNLIMITED: 'var(--warning)' }

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 8, padding: '10px 14px', fontSize: '0.8125rem' }}>
      <p style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{label}</p>
      <p style={{ color: 'var(--accent)', fontWeight: 600 }}>{Number(payload[0]?.value).toLocaleString()} requests</p>
    </div>
  )
}

export const DashboardPage = () => {
  const { user } = useAuth()
  const [usage, setUsage] = useState(null)
  const [keys, setKeys] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/b2b/usage?days=7'),
      api.get('/b2b/keys'),
    ]).then(([usageRes, keysRes]) => {
      setUsage(usageRes.data.data)
      setKeys(keysRes.data.data || [])
    }).finally(() => setLoading(false))
  }, [])

  const planLimit = { FREE: 1000, PREMIUM: 50000, PRO: 500000, UNLIMITED: Infinity }[user?.plan] || 1000
  const used = usage?.totalRequests || 0
  const pct = Math.min((used / planLimit) * 100, 100)

  const chartData = (usage?.byDay || []).map((d) => ({
    date: new Date(d.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
    requests: Number(d.requests),
    avgMs: Math.round(Number(d.avg_ms)),
  }))

  if (loading) return <div className="loading-state"><div className="spinner" /><span>Loading dashboard...</span></div>

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome back, {user?.name} · {user?.plan} Plan</p>
        </div>
        <span className="plan-chip plan-{user?.plan}" style={{ color: planColors[user?.plan], background: 'var(--accent-dim)', padding: '6px 14px', borderRadius: 99, fontSize: '0.8125rem', fontWeight: 700 }}>
          {user?.plan}
        </span>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        {[
          { label: 'Requests (7d)', value: used.toLocaleString(), icon: Activity, color: 'var(--accent)' },
          { label: 'Active API Keys', value: keys.filter(k => k.isActive).length, icon: Key, color: 'var(--accent-2)' },
          { label: 'Avg Latency', value: `${Math.round(usage?.byDay?.[0]?.avg_ms || 0)}ms`, icon: Zap, color: 'var(--warning)' },
          { label: 'Daily Quota', value: planLimit === Infinity ? '∞' : planLimit.toLocaleString(), icon: TrendingUp, color: 'var(--success)' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="stat-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span className="stat-label">{label}</span>
              <Icon size={16} color={color} />
            </div>
            <div className="stat-value" style={{ color, fontSize: '1.5rem' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Quota Bar */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">Daily Quota Usage</span>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{used.toLocaleString()} / {planLimit === Infinity ? '∞' : planLimit.toLocaleString()}</span>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 99, height: 8, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, var(--accent), var(--accent-2))`, borderRadius: 99, transition: 'width 0.6s ease' }} />
        </div>
        <p style={{ marginTop: 8, fontSize: '0.75rem' }}>{pct.toFixed(1)}% of daily limit used</p>
      </div>

      {/* Charts */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Requests Over 7 Days</span>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradR" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00d4aa" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00d4aa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="requests" stroke="#00d4aa" strokeWidth={2} fill="url(#gradR)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Top Endpoints</span>
          </div>
          {(usage?.byEndpoint || []).slice(0, 5).map((e, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <code style={{ flex: 1, fontSize: '0.75rem' }}>{e.endpoint}</code>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', fontWeight: 600 }}>{Number(e.requests).toLocaleString()}</span>
            </div>
          ))}
          {!usage?.byEndpoint?.length && <p style={{ fontSize: '0.875rem', textAlign: 'center', padding: '20px 0' }}>No requests yet</p>}
        </div>
      </div>
    </div>
  )
}
