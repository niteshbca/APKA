import React, { useState, useEffect, useRef } from 'react';
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
  { to: '/work-reports', label: 'Work Reports', icon: '🗒️', perm: 'workreports.view', module: 'workreports', group: 'Operations' },
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
  { to: '/edit-log', label: 'Edit Log', icon: '📝', perm: 'audit.view', module: 'audit', group: 'Administration' },
  { to: '/backup', label: 'Backup & Restore', icon: '💾', perm: 'backup.view', module: 'backup', group: 'Administration' },
  { to: '/modules', label: 'Modules', icon: '🧩', perm: 'settings.edit', module: 'settings', group: 'Administration' },
  { to: '/license', label: 'Subscription', icon: '🔑', perm: 'license.manage', module: 'subscription', group: 'Administration' },
  { to: '/settings', label: 'Settings', icon: '⚙️', perm: 'settings.view', module: 'settings', group: 'Administration' },
  { to: '/license-admin', label: 'License Admin', icon: '🛡️', superadminOnly: true, platform: true, group: 'Administration' },
  { to: '/platform', label: 'Platform', icon: '🌐', superadminOnly: true, platform: true, group: 'Administration' },
];

const SYNC_ICON = {
  ONLINE: '🌐',
  OFFLINE: '📴',
  SYNCING: '⟳',
  'SYNC COMPLETED': '✅',
  'SYNC FAILED': '⚠️',
};

export default function Layout({ children }) {
  const { user, logout, isSuperAdmin, hasPermission } = useAuth();
  const { branches, activeBranch, setActiveBranch, canSwitchBranch } = useBranch();
  const { isEnabled, registry } = useModules();
  const sync = useSync();
  const navigate = useNavigate();
  const location = useLocation();

  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('pos_sidebar_collapsed') === '1');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [branchMenu, setBranchMenu] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [q, setQ] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [sideQuery, setSideQuery] = useState('');
  const [sideOpen, setSideOpen] = useState(false);
  const [closedGroups, setClosedGroups] = useState([]);
  const [theme, setTheme] = useState(() => localStorage.getItem('pos_theme') || 'light');
  const [now, setNow] = useState(() => new Date());
  const searchRef = useRef(null);

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

  const current = visible.find((n) => (n.to === '/' ? location.pathname === '/' : location.pathname.startsWith(n.to)));
  const results = q.trim()
    ? visible.filter((n) => n.label.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8)
    : [];
  const sideResults = sideQuery.trim()
    ? visible.filter((n) => n.label.toLowerCase().includes(sideQuery.trim().toLowerCase())).slice(0, 10)
    : [];

  const initials = (user?.name || user?.username || '?').trim().charAt(0).toUpperCase();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('pos_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('pos_sidebar_collapsed', collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Live clock — current date & time in the top bar.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Close any open popover when the route changes.
  useEffect(() => {
    setBranchMenu(false);
    setUserMenu(false);
    setSearchOpen(false);
    setQ('');
    setSideOpen(false);
    setSideQuery('');
    setMenuOpen(false);
  }, [location.pathname]);

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
    setUserMenu(false);
    logout();
    navigate('/login');
  };

  const go = (to) => {
    setQ('');
    setSearchOpen(false);
    navigate(to);
  };

  const goSide = (to) => {
    setSideQuery('');
    setSideOpen(false);
    setMenuOpen(false);
    navigate(to);
  };

  const toggleGroup = (g) => {
    setClosedGroups((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  };

  const branchLabel = activeBranch?.name || 'No branch';

  // Single source of truth for the one-and-only sidebar sync indicator.
  const syncState = sync.pendingOps > 0
    ? { cls: 'syncing', label: `⟳ ${sync.pendingOps} pending sync` }
    : sync.status === 'SYNCING' ? { cls: 'syncing', label: '⟳ SYNCING' }
    : sync.status === 'OFFLINE' ? { cls: 'offline', label: '● OFFLINE' }
    : sync.status === 'SYNC FAILED' ? { cls: 'failed', label: '✕ SYNC FAILED' }
    : { cls: 'online', label: '● ONLINE' };

  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand" onClick={() => collapsed && setCollapsed(false)} title={collapsed ? 'Expand sidebar' : ''} style={collapsed ? { cursor: 'pointer' } : undefined}>
          <span className="brand-mark-sm">🛒</span>
          <span className="brand-text">
            <b>NiteshPro</b>
            <span>Point of Sale</span>
          </span>
          <button className="collapse-btn" title="Collapse sidebar" onClick={() => setCollapsed(true)}>⇤</button>
        </div>

        <div className="sidebar-search">
          <span className="ss-ico">🔍</span>
          <input
            className="ss-input"
            placeholder="Search menu…"
            value={sideQuery}
            onChange={(e) => { setSideQuery(e.target.value); setSideOpen(true); }}
            onFocus={() => setSideOpen(true)}
            onBlur={() => setTimeout(() => setSideOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && sideResults[0]) goSide(sideResults[0].to);
              if (e.key === 'Escape') { setSideOpen(false); setSideQuery(''); }
            }}
          />
          {sideOpen && sideQuery.trim() && (
            <div className="sidebar-results">
              {sideResults.length === 0 ? (
                <div className="cmd-empty">No matches for “{sideQuery}”.</div>
              ) : (
                sideResults.map((n) => (
                  <button key={n.to} className="cmd-item" onMouseDown={(e) => e.preventDefault()} onClick={() => goSide(n.to)}>
                    <span className="cmd-ico-cell">{n.icon}</span>
                    {n.label}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <nav>
          {sections.map((section) => {
            const isOpen = collapsed || !closedGroups.includes(section.group);
            return (
              <div className="nav-group" key={section.group}>
                <button className="nav-group-title" onClick={() => toggleGroup(section.group)}>
                  <span>{section.group}</span>
                  <span className={`nav-caret ${isOpen ? 'open' : ''}`}>▾</span>
                </button>
                {isOpen && section.items.map((n) => (
                  <NavLink
                    key={n.to}
                    to={n.to}
                    end={n.to === '/'}
                    title={n.label}
                    className={({ isActive }) => (isActive ? 'active' : '')}
                    onClick={() => setMenuOpen(false)}
                  >
                    <span className="nav-ico">{n.icon}</span>
                    <span className="nav-label">{n.label}</span>
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        <div className={`sync-pill ${syncState.cls}`} title="Click to sync now" onClick={sync.triggerSync}>
          <span className="sync-dot" />
          <span className="sync-text">{syncState.label}</span>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span className="user-avatar-sm">{initials}</span>
            <span className="user-meta">
              <b>{user?.name}</b>
              <span>{user?.role}</span>
            </span>
          </div>
          <button className="btn btn-sm sidebar-logout" onClick={handleLogout}>
            ⎋ <span>Logout</span>
          </button>
        </div>
      </aside>

      {menuOpen && <div className="sidebar-overlay" onClick={() => setMenuOpen(false)} />}

      <div className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="menu-btn" aria-label="Menu" onClick={() => setMenuOpen(true)}>☰</button>
            <div className="topbar-title">
              <b>{current?.label || 'Dashboard'}</b>
              <span>Welcome back, {user?.name}</span>
            </div>
          </div>

          <div className="cmd">
            <span className="cmd-ico">🔍</span>
            <input
              ref={searchRef}
              className="cmd-input"
              placeholder="Search modules, pages, actions…"
              value={q}
              onChange={(e) => { setQ(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && results[0]) go(results[0].to);
                if (e.key === 'Escape') { setSearchOpen(false); setQ(''); }
              }}
            />
            {searchOpen && q.trim() && (
              <>
                <div className="pop-backdrop" onClick={() => setSearchOpen(false)} />
                <div className="cmd-menu">
                  {results.length === 0 ? (
                    <div className="cmd-empty">No matches for “{q}”.</div>
                  ) : (
                    results.map((n) => (
                      <button key={n.to} className="cmd-item" onClick={() => go(n.to)}>
                        <span className="cmd-ico-cell">{n.icon}</span>
                        {n.label}
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          <div className="flex gap-8" style={{ alignItems: 'center' }}>
            <div className="topbar-clock hide-md" title={now.toString()}>
              <span className="tc-date">{now.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</span>
              <span className="tc-time">{now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </div>
            {canSwitchBranch && branches.length > 0 ? (
              <div style={{ position: 'relative' }}>
                <button className="icon-btn" onClick={() => { setBranchMenu((s) => !s); setUserMenu(false); }} title="Switch branch">
                  🏬
                </button>
                {branchMenu && (
                  <>
                    <div className="pop-backdrop" onClick={() => setBranchMenu(false)} />
                    <div className="branch-dropdown">
                      <div className="menu-pop-head muted small">Active branch · {branchLabel}</div>
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

            <button className="icon-btn" title={`Sync: ${sync.status}`} onClick={sync.triggerSync} style={{ color: sync.status === 'OFFLINE' ? '#f87171' : sync.status === 'ONLINE' ? '#16a34a' : undefined }}>
              {SYNC_ICON[sync.status] || '🌐'}
              {sync.pendingOps > 0 && <span className="dot" />}
            </button>

            <button className="icon-btn" onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} title="Toggle theme">
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>

            <button className="icon-btn hide-md" onClick={toggleFullscreen} title="Toggle fullscreen">
              {isFullscreen ? '🡼' : '⛶'}
            </button>

            {hasPermission('settings.view') && (
              <button className="icon-btn hide-md" onClick={() => navigate('/notifications')} title="Notifications">
                🔔
              </button>
            )}

            <div style={{ position: 'relative' }}>
              <button className="user-chip" onClick={() => { setUserMenu((s) => !s); setBranchMenu(false); }}>
                <span className="user-avatar-sm">{initials}</span>
                <span className="user-name">{user?.name}</span>
                <span className="muted" style={{ fontSize: 10 }}>▾</span>
              </button>
              {userMenu && (
                <>
                  <div className="pop-backdrop" onClick={() => setUserMenu(false)} />
                  <div className="menu-pop">
                    <div className="menu-pop-head">
                      <div style={{ fontWeight: 800 }}>{user?.name}</div>
                      <div className="muted small" style={{ textTransform: 'capitalize' }}>{user?.role}</div>
                    </div>
                    {hasPermission('settings.view') && (
                      <button className="menu-item" onClick={() => { setUserMenu(false); navigate('/settings'); }}>⚙️ Settings</button>
                    )}
                    {hasPermission('license.manage') && (
                      <button className="menu-item" onClick={() => { setUserMenu(false); navigate('/license'); }}>🔑 Subscription</button>
                    )}
                    <button className="menu-item danger" onClick={handleLogout}>⎋ Logout</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
