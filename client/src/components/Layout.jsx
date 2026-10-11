import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { useBranch } from '../context/BranchContext';

const NAV = [
  { to: '/', label: 'Dashboard', icon: '📊', perm: 'dashboard.view' },
  { to: '/billing', label: 'Billing', icon: '🧾', perm: 'sales.create' },
  { to: '/products', label: 'Products', icon: '📦', perm: 'products.view' },
  { to: '/categories', label: 'Categories', icon: '🗂️', perm: 'categories.view' },
  { to: '/customers', label: 'Customers', icon: '👥', perm: 'customers.view' },
  { to: '/purchases', label: 'Purchases', icon: '📥', perm: 'purchases.view' },
  { to: '/inventory', label: 'Inventory', icon: '🏬', perm: 'inventory.view' },
  { to: '/invoices', label: 'Invoices', icon: '📄', perm: 'sales.view' },
  { to: '/reports', label: 'Reports', icon: '📈', perm: 'reports.view' },
  { to: '/branches', label: 'Branches', icon: '🏬', perm: 'branches.view' },
  { to: '/users', label: 'Users', icon: '🔐', perm: 'users.view' },
  { to: '/license', label: 'License', icon: '🔑', perm: 'license.manage' },
  { to: '/license-admin', label: 'License Admin', icon: '🛡️', superadminOnly: true },
  { to: '/notifications', label: 'Notifications', icon: '🔔', perm: 'settings.view' },
  { to: '/settings', label: 'Settings', icon: '⚙️', perm: 'settings.view' },
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
  const { user, logout, isSuperAdmin, hasPermission } = useAuth();
  const { branches, activeBranch, setActiveBranch, canSwitchBranch } = useBranch();
  const sync = useSync();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [branchMenu, setBranchMenu] = useState(false);

  const items = NAV.filter((n) => {
    if (n.superadminOnly) return isSuperAdmin;
    return n.perm ? hasPermission(n.perm) : true;
  });

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      /* ignore */
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const branchLabel = activeBranch?.name || 'No branch';

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand">🛒 NiteshPro POS</div>
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
          <div className="flex gap-8" style={{ alignItems: 'center' }}>
            {canSwitchBranch && branches.length > 0 ? (
              <div style={{ position: 'relative' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setBranchMenu((s) => !s)} title="Switch branch">
                  🏬 {branchLabel} ▾
                </button>
                {branchMenu && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 60 }} onClick={() => setBranchMenu(false)} />
                    <div className="branch-dropdown">
                      {branches.map((b) => (
                        <button
                          key={b._id}
                          className={`branch-option ${activeBranch?._id === b._id ? 'active' : ''}`}
                          onClick={() => { setActiveBranch(b); setBranchMenu(false); }}
                        >
                          <span>{b.name} <span className="muted small">({b.code})</span></span>
                          {b.isMain && <span className="badge badge-info">Main</span>}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              branches.length > 0 && <span className="badge badge-neutral hide-mobile">🏬 {branchLabel}</span>
            )}
            <button
              className="btn btn-ghost btn-sm hide-mobile"
              onClick={toggleFullscreen}
              title="Toggle fullscreen"
            >
              {isFullscreen ? '🡼 Exit' : '⛶ Full Screen'}
            </button>
            <span className="muted small hide-mobile">{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</span>
            <button className="btn btn-ghost btn-sm hide-mobile" onClick={handleLogout}>Logout</button>
          </div>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}