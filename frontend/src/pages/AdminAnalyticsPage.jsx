import { useEffect, useState } from 'react'
import { BarChart2, Users, Zap, AlertCircle, RefreshCw } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import api from '../lib/api'

const COLORS = ['#00d4aa', '#6366f1', '#f59e0b', '#f43f5e']

export const AdminAnalyticsPage = () => {
  const [data, setData] = useState(null)
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    setLoading(true)
    const [analyticsRes, healthRes] = await Promise.all([
      api.get('/admin/analytics'),
      api.get('/admin/health-data'),
    ])
    setData(analyticsRes.data.data)
    setHealth(healthRes.data.data)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  if (loading) return <div className="loading-state"><div className="spinner" /><span>Loading platform analytics...</span></div>

  const pieData = [
    { name: 'Success (2xx)', value: (data?.totalRequests || 0) - (data?.errorRequests || 0) },
    { name: 'Errors (4xx/5xx)', value: data?.errorRequests || 0 },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Platform Analytics</h1>
          <p className="page-subtitle">Real-time platform health and usage overview</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchData}><RefreshCw size={14} /> Refresh</button>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        {[
          { label: 'Requests (24h)', value: (data?.totalRequests || 0).toLocaleString(), icon: Zap, color: 'var(--accent)' },
          { label: 'Error Rate', value: data?.errorRate || '0%', icon: AlertCircle, color: 'var(--danger)' },
          { label: 'Avg Latency', value: `${Math.round(data?.avgLatencyMs || 0)}ms`, icon: BarChart2, color: 'var(--warning)' },
          { label: 'Total Users', value: (health?.users || 0).toLocaleString(), icon: Users, color: 'var(--accent-2)' },
          { label: 'Active API Keys', value: (health?.activeApiKeys || 0).toLocaleString(), icon: Zap, color: 'var(--success)' },
          { label: 'Village Records', value: (health?.villages || 0).toLocaleString(), icon: BarChart2, color: 'var(--accent)' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="stat-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span className="stat-label">{label}</span>
              <Icon size={15} color={color} />
            </div>
            <div className="stat-value" style={{ color, fontSize: '1.375rem' }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        {/* Success vs Error Pie */}
        <div className="card">
          <div className="card-header"><span className="card-title">Request Status (24h)</span></div>
          <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PieChart width={220} height={220}>
              <Pie data={pieData} cx={110} cy={110} innerRadius={60} outerRadius={95} paddingAngle={3} dataKey="value">
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip formatter={(v) => v.toLocaleString()} contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 8, fontSize: '0.8125rem' }} />
            </PieChart>
          </div>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', fontSize: '0.8125rem' }}>
            {pieData.map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[i] }} />
                <span style={{ color: 'var(--text-secondary)' }}>{d.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Users */}
        <div className="card">
          <div className="card-header"><span className="card-title">Top Users (24h)</span></div>
          {(data?.topUsers || []).slice(0, 6).map((u, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: `hsl(${i * 60}, 60%, 50%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#000', flexShrink: 0 }}>
                {i + 1}
              </div>
              <code style={{ flex: 1, fontSize: '0.75rem' }}>{u.userId.slice(0, 16)}...</code>
              <span style={{ fontWeight: 600, color: 'var(--accent)', fontSize: '0.875rem' }}>{Number(u.requests).toLocaleString()}</span>
            </div>
          ))}
          {!data?.topUsers?.length && <p style={{ fontSize: '0.875rem', textAlign: 'center', padding: '20px 0' }}>No data yet</p>}
        </div>
      </div>
    </div>
  )
}
