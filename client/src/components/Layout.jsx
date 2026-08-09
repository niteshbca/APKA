import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';

const NAV = [
  { to: '/', label: 'Dashboard', icon: '📊', roles: ['superadmin', 'admin', 'cashier'] },
  { to: '/billing', label: 'Billing', icon: '🧾', roles: ['superadmin', 'admin', 'cashier'] },
  { to: '/products', label: 'Products', icon: '📦', roles: ['superadmin', 'admin', 'cashier'] },
  { to: '/categories', label: 'Categories', icon: '🗂️', roles: ['superadmin', 'admin'] },
  { to: '/customers', label: 'Customers', icon: '👥', roles: ['superadmin', 'admin', 'cashier'] },
  { to: '/purchases', label: 'Purchases', icon: '📥', roles: ['superadmin', 'admin'] },
  { to: '/inventory', label: 'Inventory', icon: '🏬', roles: ['superadmin', 'admin', 'cashier'] },
  { to: '/invoices', label: 'Invoices', icon: '📄', roles: ['superadmin', 'admin', 'cashier'] },
  { to: '/reports', label: 'Reports', icon: '📈', roles: ['superadmin', 'admin'] },
  { to: '/users', label: 'Users', icon: '🔐', roles: ['superadmin', 'admin'] },
  { to: '/license', label: 'License', icon: '🔑', roles: ['superadmin', 'admin'] },
  { to: '/license-admin', label: 'License Admin', icon: '🛡️', roles: ['superadmin'] },
  { to: '/settings', label: 'Settings', icon: '⚙️', roles: ['superadmin', 'admin'] },
];

const SYNC_LABEL = {
  ONLINE: '● ONLINE',
  OFFLINE: '● OFFLINE',
  SYNCING: '⟳ SYNCING',
  'SYNC COMPLETED': '✓ SYNC COMPLETED',
  'SYNC FAILED': '✕ SYNC FAILED',
};

const SYNC_PILL_CLASS = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  SYNCING: 'syncing',
  'SYNC COMPLETED': 'completed',
  'SYNC FAILED': 'failed',
};

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const sync = useSync();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const items = NAV.filter((n) => n.roles.includes(user?.role));

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand">🛒 POS Suite</div>
        <nav>
          {items.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) => (isActive ? 'active' : '')}
              onClick={() => setMenuOpen(false)}
            >
              <span>{n.icon}</span> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className={`sync-pill ${SYNC_PILL_CLASS[sync.status] || 'offline'}`}>
          {SYNC_LABEL[sync.status] || sync.status}
        </div>
        {sync.pendingOps > 0 && (
          <div className="sync-pill" style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>
            {sync.pendingOps} pending sync
          </div>
        )}
        <div className="sidebar-footer">
          <button className="btn btn-ghost btn-sm" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.2)' }} onClick={handleLogout}>Logout</button>
        </div>
      </aside>

      {menuOpen && <div className="sidebar-overlay" onClick={() => setMenuOpen(false)} />}

      <div className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="menu-btn" aria-label="Menu" onClick={() => setMenuOpen(true)}>☰</button>
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              {user?.name} <span className="muted small">({user?.role})</span>
            </div>
          </div>
          <div className="flex gap-8">
            <span className="muted small hide-mobile">{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</span>
            <button className="btn btn-ghost btn-sm hide-mobile" onClick={handleLogout}>Logout</button>
          </div>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
