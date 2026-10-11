import React, { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { Button, Card, Modal, Field, Badge, EmptyState, Spinner } from '../components/ui';
import { fmtDate } from '../utils/format';

const ROLES = [
  { value: 'superadmin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'cashier', label: 'Cashier' },
];

const PERMISSION_GROUPS = [
  { key: 'sales', label: 'Sales', perms: ['sales.create', 'sales.view', 'sales.delete', 'sales.hold', 'sales.park'] },
  { key: 'products', label: 'Products', perms: ['products.create', 'products.view', 'products.edit', 'products.delete'] },
  { key: 'categories', label: 'Categories', perms: ['categories.create', 'categories.view', 'categories.edit', 'categories.delete'] },
  { key: 'customers', label: 'Customers', perms: ['customers.create', 'customers.view', 'customers.edit', 'customers.delete'] },
  { key: 'purchases', label: 'Purchases', perms: ['purchases.create', 'purchases.view', 'purchases.edit', 'purchases.delete'] },
  { key: 'inventory', label: 'Inventory', perms: ['inventory.view', 'inventory.adjust', 'inventory.transfer'] },
  { key: 'reports', label: 'Reports', perms: ['reports.view', 'reports.export'] },
  { key: 'users', label: 'Users', perms: ['users.create', 'users.view', 'users.edit', 'users.delete'] },
  { key: 'branches', label: 'Branches', perms: ['branches.create', 'branches.view', 'branches.edit', 'branches.delete'] },
  { key: 'settings', label: 'Settings', perms: ['settings.view', 'settings.edit'] },
  { key: 'dashboard', label: 'Dashboard', perms: ['dashboard.view', 'license.manage'] },
];

const DEFAULT_PERMISSIONS = {
  admin: PERMISSION_GROUPS.flatMap((g) => g.perms),
  manager: [
    'sales.create', 'sales.view', 'sales.hold', 'sales.park',
    'products.view', 'products.edit',
    'categories.view', 'categories.edit',
    'customers.create', 'customers.view', 'customers.edit',
    'purchases.create', 'purchases.view', 'purchases.edit',
    'inventory.view', 'inventory.adjust', 'inventory.transfer',
    'reports.view', 'reports.export', 'users.view', 'branches.view',
    'settings.view', 'dashboard.view',
  ],
  cashier: [
    'sales.create', 'sales.view', 'sales.hold', 'sales.park',
    'products.view', 'categories.view',
    'customers.create', 'customers.view', 'purchases.view',
    'inventory.view', 'dashboard.view',
  ],
};

const EMPTY = { name: '', username: '', email: '', password: '', pin: '', role: 'cashier', branch: '', permissions: DEFAULT_PERMISSIONS.cashier, active: true };

export default function Users() {
  const [rows, setRows] = useState(null);
  const [branches, setBranches] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [showPerms, setShowPerms] = useState(false);
  const { toast } = useToast();
  const { user, isSuperAdmin, isAdmin } = useAuth();

  const load = () => {
    api.get('/users').then((r) => setRows(r.data.data)).catch((e) => toast(e.message, 'error'));
    api.get('/branches').then((r) => setBranches(r.data.data || [])).catch(() => {});
  };

  useEffect(load, []);

  const canGrantSuperadmin = isSuperAdmin;
  const roleOptions = useMemo(() => (canGrantSuperadmin ? ROLES : ROLES.filter((r) => r.value !== 'superadmin')), [canGrantSuperadmin]);

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...EMPTY, branch: user?.branch?._id || user?.branch || '' });
    setShowModal(true);
  };

  const openEdit = (u) => {
    setEditingId(u._id);
    const perms = u.permissions && u.permissions.length ? u.permissions : (DEFAULT_PERMISSIONS[u.role] || []);
    setForm({
      name: u.name || '',
      username: u.username || '',
      email: u.email || '',
      password: '',
      pin: '',
      role: u.role || 'cashier',
      branch: u.branch?._id || u.branch || '',
      permissions: perms,
      active: u.active !== false,
    });
    setShowModal(true);
  };

  const togglePerm = (perm) => {
    setForm((f) => {
      const has = f.permissions.includes(perm);
      return { ...f, permissions: has ? f.permissions.filter((p) => p !== perm) : [...f.permissions, perm] };
    });
  };

  const onRoleChange = (role) => {
    setForm((f) => ({ ...f, role, permissions: DEFAULT_PERMISSIONS[role] || [] }));
  };

  const save = async () => {
    if (!form.name.trim() || !form.username.trim() || (!editingId && !form.password)) {
      return toast('Fill required fields (password needed for new users)', 'error');
    }
    try {
      const payload = { ...form };
      if (!payload.password) delete payload.password;
      if (!payload.pin) delete payload.pin;
      if (!editingId && !payload.branch) delete payload.branch;
      if (editingId) {
        await api.put(`/users/${editingId}`, payload);
        toast('User updated', 'success');
      } else {
        await api.post('/users', payload);
        toast('User created', 'success');
      }
      setShowModal(false);
      setForm(EMPTY);
      setEditingId(null);
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const toggleActive = async (u) => {
    try {
      await api.put(`/users/${u._id}`, { active: !u.active });
      toast('Updated', 'success');
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const branchName = (b) => (b ? (branches.find((x) => x._id === b)?.name || '—') : '—');

  const roleBadge = (role) => {
    const map = { superadmin: 'badge-warning', admin: 'badge-info', manager: 'badge-success', cashier: 'badge-neutral' };
    return map[role] || 'badge-neutral';
  };

  return (
    <div>
      <div className="flex-between mb-16">
        <div>
          <h2>Users & Permissions</h2>
          <div className="muted small">Manage staff accounts, branches and access rights</div>
        </div>
        <Button onClick={openAdd}>＋ Add User</Button>
      </div>
      <Card>
        {rows === null ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <EmptyState icon="🔐" title="No users" />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Branch</th><th>Permissions</th><th>Status</th><th>Created</th><th></th></tr></thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u._id}>
                    <td style={{ fontWeight: 600 }}>{u.name}</td>
                    <td>{u.username}</td>
                    <td><span className={`badge ${roleBadge(u.role)}`}>{u.role}</span></td>
                    <td>{u.role === 'superadmin' ? <span className="muted">All branches</span> : branchName(u.branch?._id || u.branch)}</td>
                    <td><span className="badge badge-neutral">{(u.permissions || []).length} perms</span></td>
                    <td>{u.active ? <Badge tone="success">Active</Badge> : <Badge tone="danger">Inactive</Badge>}</td>
                    <td className="muted small">{fmtDate(u.createdAt)}</td>
                    <td>
                      <div className="flex gap-8">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(u)}>Edit</Button>
                        {isAdmin && (
                          <Button size="sm" variant={u.active ? 'warning' : 'success'} onClick={() => toggleActive(u)}>{u.active ? 'Disable' : 'Enable'}</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={showModal} title={editingId ? 'Edit User' : 'Add User'} onClose={() => setShowModal(false)} width={620}>
        <div className="form-row">
          <Field label="Name *"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Username *"><input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} disabled={!!editingId} /></Field>
        </div>
        <div className="form-row">
          <Field label="Email"><input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label={editingId ? 'New Password (leave blank to keep)' : 'Password *'}>
            <input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
        </div>
        <div className="form-row">
          <Field label="Role">
            <select className="select" value={form.role} onChange={(e) => onRoleChange(e.target.value)}>
              {roleOptions.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </Field>
          <Field label="Branch">
            <select className="select" value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} disabled={!isSuperAdmin}>
              {isSuperAdmin && <option value="">All branches (superadmin)</option>}
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name} ({b.code})</option>)}
            </select>
          </Field>
        </div>
        <div className="form-row">
          <Field label={editingId ? 'New PIN (leave blank to keep)' : 'Quick Login PIN (optional)'}>
            <input className="input" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} maxLength={6} placeholder="4-6 digits" />
          </Field>
          <Field label="Status">
            <select className="select" value={form.active ? 'active' : 'inactive'} onChange={(e) => setForm({ ...form, active: e.target.value === 'active' })}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>
        </div>

        {isSuperAdmin && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 14 }}>
            <div className="flex-between mb-16">
              <div style={{ fontWeight: 700, fontSize: 13 }}>Permissions</div>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => setShowPerms((s) => !s)}>
                {showPerms ? 'Hide' : 'Customize'}
              </button>
            </div>
            {showPerms && (
              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                {PERMISSION_GROUPS.map((g) => (
                  <div key={g.key} style={{ marginBottom: 10 }}>
                    <div className="muted small" style={{ fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>{g.label}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {g.perms.map((p) => (
                        <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, background: form.permissions.includes(p) ? 'var(--primary-light)' : 'var(--bg)', padding: '4px 8px', borderRadius: 6, cursor: 'pointer' }}>
                          <input type="checkbox" checked={form.permissions.includes(p)} onChange={() => togglePerm(p)} />
                          {p.split('.')[1]}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!showPerms && (
              <div className="muted small">{form.role === 'superadmin' ? 'Full access to everything' : `${(form.permissions || []).length} permissions selected`}</div>
            )}
          </div>
        )}

        <Button className="btn-block" onClick={save}>Save User</Button>
      </Modal>
    </div>
  );
}