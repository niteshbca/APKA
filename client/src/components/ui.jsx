import React from 'react';

export function Button({ children, variant = 'primary', size, className = '', ...props }) {
  const cls = ['btn', variant !== 'primary' ? `btn-${variant}` : '', size ? `btn-${size}` : '', className].join(' ');
  return (
    <button className={cls} {...props}>
      {children}
    </button>
  );
}

export function Card({ children, className = '', title, action }) {
  return (
    <div className={`card ${className}`}>
      {(title || action) && (
        <div className="flex-between mb-16">
          {title && <h3 style={{ fontSize: 16, fontWeight: 700 }}>{title}</h3>}
          {action}
        </div>
      )}
      <div className="card-content">{children}</div>
    </div>
  );
}

export function Modal({ open, title, onClose, children, footer, width }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={width ? { maxWidth: width } : undefined}>
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {children}
        {footer && <div className="mt-16 flex gap-8" style={{ justifyContent: 'flex-end' }}>{footer}</div>}
      </div>
    </div>
  );
}

export function Badge({ children, tone = 'neutral' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function EmptyState({ icon = '📦', title = 'Nothing here yet', sub }) {
  return (
    <div className="empty-state">
      <div className="icon">{icon}</div>
      <div style={{ fontWeight: 700 }}>{title}</div>
      {sub && <div className="muted small mt-8">{sub}</div>}
    </div>
  );
}

export function Spinner({ label = 'Loading...' }) {
  return (
    <div className="empty-state">
      <div className="icon" style={{ animation: 'spin 1s linear infinite' }}>⏳</div>
      <div>{label}</div>
    </div>
  );
}

export function Field({ label, children, className = '' }) {
  return (
    <div className={`field ${className}`}>
      {label && <label>{label}</label>}
      {children}
    </div>
  );
}

export function StatCard({ label, value, sub, icon, tone = 'primary', accent, trend, trendLabel }) {
  const colors = {
    primary: { bg: '#eef2ff', fg: '#4f46e5' },
    success: { bg: '#dcfce7', fg: '#16a34a' },
    danger: { bg: '#fee2e2', fg: '#dc2626' },
    warning: { bg: '#fef3c7', fg: '#d97706' },
    info: { bg: '#e0f2fe', fg: '#0284c7' },
  };
  const c = colors[tone] || colors.primary;
  return (
    <div className="stat-card" style={{ '--stat-accent': accent || c.fg }}>
      <div className="flex-between">
        <div className="label">{label}</div>
        {icon && (
          <div className="stat-ico" style={{ background: c.bg, color: c.fg }}>
            {icon}
          </div>
        )}
      </div>
      <div className="value">{value}</div>
      <div className="stat-foot">
        {typeof trend === 'number' && (
          <span className={`stat-trend ${trend >= 0 ? 'up' : 'down'}`}>
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
          </span>
        )}
        {(sub || trendLabel) && <span className="sub" style={{ margin: 0 }}>{trendLabel || sub}</span>}
      </div>
    </div>
  );
}

export function Pagination({ page, total, limit, onPage }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="pagination">
      <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>‹ Prev</Button>
      <span className="muted small">Page {page} of {pages} ({total} records)</span>
      <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next ›</Button>
    </div>
  );
}
