import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { useBranch } from '../context/BranchContext';
import { useModules } from '../context/ModulesContext';

// Ordered sidebar sections — gives the app a professional, scannable layout.
const GROUP_ORDER = ['Overview', 'Sales', 'Inventory', 'Finance', 'People', 'Operations', 'Marketing', 'Intelligence', 'Administration'];

const NAV = [
  { to: '/', label: 'Dashboard', icon: '📊', perm: 'dashboard.view', module: 'dashboard', group: 'Overview' },

  // Sales
  { to: '/billing', label: 'Sales & Billing', icon: '🧾', perm: 'sales.create', module: 'sales', group: 'Sales' },
  { to: '/invoices', label: 'Invoices', icon: '📄', perm: 'sales.view', module: 'invoices', group: 'Sales' },
  { to: '/customers', label: 'CRM — Customers', icon: '👥', perm: 'customers.view', module: 'crm', group: 'Sales' },
  { to: '/labels', label: 'Label Printing', icon: '🏷️', perm: 'labels.view', module: 'labels', group: 'Sales' },

  // Inventory / Catalog
  { to: '/products', label: 'Products', icon: '📦', perm: 'products.view', module: 'products', group: 'Inventory' },
  { to: '/categories', label: 'Categories', icon: '🗂️', perm: 'categories.view', module: 'products', group: 'Inventory' },
  { to: '/purchases', label: 'Purchases', icon: '📥', perm: 'purchases.view', module: 'purchases', group: 'Inventory' },
  { to: '/inventory', label: 'Inventory', icon: '🏬', perm: 'inventory.view', module: 'inventory', group: 'Inventory' },

  // Finance
  { to: '/accounts', label: 'Accounts', icon: '💰', perm: 'accounts.view', module: 'accounts', group: 'Finance' },
  { to: '/reports', label: 'Reports', icon: '📈', perm: 'reports.view', module: 'reports', group: 'Finance' },

  // People
  { to: '/hr', label: 'HR & Staff', icon: '🧑💼', perm: 'hr.view', module: 'hr', group: 'People' },

  // Operations
  { to: '/tasks', label: 'Tasks', icon: '✅', perm: 'tasks.view', module: 'tasks', group: 'Operations' },
  { to: '/operations', label: 'Operations', icon: '🚚', perm: 'operations.view', module: 'operations', group: 'Operations' },

  // Marketing
  { to: '/marketing', label: 'Marketing', icon: '📣', perm: 'marketing.view', module: 'marketing', group: 'Marketing' },
  { to: '/notifications', label: 'Notifications', icon: '🔔', perm: 'settings.view', module: 'notifications', group: 'Marketing' },

  // Intelligence
  { to: '/ai', label: 'AI Assistant', icon: '🤖', perm: 'ai.view', module: 'ai', group: 'Intelligence' },

  // Administration
  { to: '/masters', label: 'Master Data', icon: '🗃️', perm: 'master.view', module: 'master', group: 'Administration' },
  { to: '/branches', label: 'Branches', icon: '🏢', perm: 'branches.view', module: 'branches', group: 'Administration' },
  { to: '/users', label: 'Users & Roles', icon: '🔐', perm: 'users.view', module: 'admin', group: 'Administration' },
  { to: '/integrations', label: 'Integrations', icon: '🔗', perm: 'integrations.view', module: 'integrations', group: 'Administration' },
  { to: '/modules', label: 'Modules', icon: '🧩', perm: 'settings.edit', module: 'settings', group: 'Administration' },
  { to: '/license', label: 'Subscription', icon: '🔑', perm: 'license.manage', module: 'subscription', group: 'Administration' },
  { to: '/settings', label: 'Settings', icon: '⚙️', perm: 'settings.view', module: 'settings', group: 'Administration' },
  { to: '/license-admin', label: 'License Admin', icon: '🛡️', superadminOnly: true, platform: true, group: 'Administration' },
  { to: '/platform', label: 'Platform', icon: '🌐', superadminOnly: true, platform: true, group: 'Administration' },
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
  const { isEnabled, registry } = useModules();
  const sync = useSync();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [branchMenu, setBranchMenu] = useState(false);

  const navModuleKeys = NAV.map((n) => n.module).filter(Boolean);
  const visible = [
    ...NAV.filter((n) => {
      if (n.superadminOnly) return isSuperAdmin;
      if (!hasPermission(n.perm)) return false;
      if (n.module && !isEnabled(n.module)) return false;
      return true;
    }),
    // Every other enabled module still gets a sidebar entry so users can see
    // that the capability is switched on (dedicated screens arrive later).
    ...registry
      .filter((m) => !navModuleKeys.includes(m.key) && isEnabled(m.key))
      .map((m) => ({ to: `/module/${m.key}`, label: m.label, icon: m.icon || '🧩', module: m.key, group: 'More', placeholder: true })),
  ];

  // Bucket the visible items into ordered professional sections.
  const sections = [];
  for (const g of [...GROUP_ORDER, 'More']) {
    const groupItems = visible.filter((n) => (n.group || 'More') === g);
    if (groupItems.length) sections.push({ group: g, items: groupItems });
  }

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
          {sections.map((section) => (
            <div className="nav-group" key={section.group}>
              <div className="nav-group-title">{section.group}</div>
              {section.items.map((n) => (
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
            </div>
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