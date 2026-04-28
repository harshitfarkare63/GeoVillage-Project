import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Key, BarChart2, Users,
  Database, Settings, LogOut, Globe, Activity
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const NavItem = ({ to, icon: Icon, label }) => (
  <NavLink
    to={to}
    className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
  >
    <Icon size={16} className="nav-item-icon" />
    {label}
  </NavLink>
)

export const Sidebar = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isAdmin = user?.role === 'ADMIN'

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">🌍</div>
        <div>
          <div className="sidebar-logo-text">GeoVillage</div>
          <div className="sidebar-logo-sub">API Platform</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-label">Dashboard</div>
        <NavItem to="/dashboard" icon={LayoutDashboard} label="Overview" />
        <NavItem to="/usage" icon={Activity} label="Usage Analytics" />

        <div className="nav-section-label">API</div>
        <NavItem to="/keys" icon={Key} label="API Keys" />
        <NavItem to="/explorer" icon={Globe} label="API Explorer" />

        {isAdmin && (
          <>
            <div className="nav-section-label">Admin</div>
            <NavItem to="/admin/users" icon={Users} label="Users" />
            <NavItem to="/admin/analytics" icon={BarChart2} label="Platform Analytics" />
            <NavItem to="/admin/data" icon={Database} label="Data Import" />
          </>
        )}

        <div className="nav-section-label">Account</div>
        <NavItem to="/settings" icon={Settings} label="Settings" />
      </nav>

      <div className="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: '#000', flexShrink: 0
          }}>
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.name}
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email}
            </div>
          </div>
        </div>
        <button className="nav-item" onClick={handleLogout} style={{ color: 'var(--danger)', width: '100%' }}>
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
