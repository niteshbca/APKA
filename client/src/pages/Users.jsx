import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { Button, Card, Modal, Field, Badge, EmptyState, Spinner } from '../components/ui';
import { fmtDate } from '../utils/format';

export default function Users() {
  const [rows, setRows] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', username: '', password: '', role: 'cashier' });
  const [editingId, setEditingId] = useState(null);
  const { toast } = useToast();

  const load = () => {
    api.get('/users').then((r) => setRows(r.data.data)).catch((e) => toast(e.message, 'error'));
  };

  useEffect(load, []);

  const save = async () => {
    if (!form.name.trim() || !form.username.trim() || (!editingId && !form.password)) {
      return toast('Fill required fields (password needed for new users)', 'error');
    }
    try {
      if (editingId) {
        await api.put(`/users/${editingId}`, form);
        toast('User updated', 'success');
      } else {
        await api.post('/users', form);
        toast('User created', 'success');
      }
      setShowModal(false);
      setForm({ name: '', username: '', password: '', role: 'cashier' });
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

  return (
    <div>
      <div className="flex-between mb-16">
        <h2>Users</h2>
        <Button onClick={() => { setEditingId(null); setForm({ name: '', username: '', password: '', role: 'cashier' }); setShowModal(true); }}>＋ Add User</Button>
      </div>
      <Card>
        {rows === null ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <EmptyState icon="🔐" title="No users" />
        ) : (
          <table className="table">
            <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Status</th><th>Created</th><th></th></tr></thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u._id}>
                  <td style={{ fontWeight: 600 }}>{u.name}</td>
                  <td>{u.username}</td>
                  <td><span className={`badge ${u.role === 'superadmin' ? 'badge-warning' : u.role === 'admin' ? 'badge-info' : 'badge-neutral'}`}>{u.role}</span></td>
                  <td>{u.active ? <Badge tone="success">Active</Badge> : <Badge tone="danger">Inactive</Badge>}</td>
                  <td className="muted">{fmtDate(u.createdAt)}</td>
                  <td>
                    <div className="flex gap-8">
                      <Button size="sm" variant="ghost" onClick={() => { setEditingId(u._id); setForm({ name: u.name, username: u.username, password: '', role: u.role }); setShowModal(true); }}>Edit</Button>
                      <Button size="sm" variant={u.active ? 'warning' : 'success'} onClick={() => toggleActive(u)}>{u.active ? 'Disable' : 'Enable'}</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={showModal} title={editingId ? 'Edit User' : 'Add User'} onClose={() => setShowModal(false)} width={480}>
        <Field label="Name *"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Username *"><input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></Field>
        <Field label={editingId ? 'New Password (leave blank to keep)' : 'Password *'}>
          <input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <Field label="Role">
          <select className="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="admin">Admin</option>
            <option value="cashier">Cashier</option>
          </select>
        </Field>
        <Button className="btn-block" onClick={save}>Save</Button>
      </Modal>
    </div>
  );
}
