import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { useBranch } from '../context/BranchContext';
import { Button, Card, Modal, Field, Badge, EmptyState, Spinner } from '../components/ui';

const EMPTY = {
  name: '', code: '', address: '', phone: '', email: '', gstin: '',
  isActive: true,
  settings: { invoicePrefix: 'INV', currency: 'INR', lowStockThreshold: 10 },
};

export default function Branches() {
  const [rows, setRows] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const { toast } = useToast();
  const { refresh } = useBranch();

  const load = () => {
    api.get('/branches').then((r) => setRows(r.data.data)).catch((e) => toast(e.message, 'error'));
  };

  useEffect(load, []);

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY);
    setShowModal(true);
  };

  const openEdit = (b) => {
    setEditingId(b._id);
    setForm({
      name: b.name || '',
      code: b.code || '',
      address: b.address || '',
      phone: b.phone || '',
      email: b.email || '',
      gstin: b.gstin || '',
      isActive: b.isActive !== false,
      settings: {
        invoicePrefix: b.settings?.invoicePrefix || 'INV',
        currency: b.settings?.currency || 'INR',
        lowStockThreshold: b.settings?.lowStockThreshold ?? 10,
      },
    });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      return toast('Name and code are required', 'error');
    }
    try {
      if (editingId) {
        await api.put(`/branches/${editingId}`, form);
        toast('Branch updated', 'success');
      } else {
        await api.post('/branches', form);
        toast('Branch created', 'success');
      }
      setShowModal(false);
      setForm(EMPTY);
      setEditingId(null);
      load();
      refresh();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const remove = async (b) => {
    if (!window.confirm(`Delete branch "${b.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/branches/${b._id}`);
      toast('Branch deleted', 'success');
      load();
      refresh();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setSetting = (k) => (e) => setForm({ ...form, settings: { ...form.settings, [k]: e.target.value } });

  return (
    <div>
      <div className="flex-between mb-16">
        <div>
          <h2>Branches</h2>
          <div className="muted small">Manage multiple outlets / stores</div>
        </div>
        <Button onClick={openAdd}>＋ Add Branch</Button>
      </div>

      <Card>
        {rows === null ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <EmptyState icon="🏬" title="No branches" sub="Add your first branch to get started" />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Branch</th><th>Code</th><th>Contact</th><th>GSTIN</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b._id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>
                      {b.name} {b.isMain && <Badge tone="info">Main</Badge>}
                    </div>
                    <div className="muted small">{b.address || '—'}</div>
                  </td>
                  <td><span className="badge badge-neutral">{b.code}</span></td>
                  <td>
                    <div>{b.phone || '—'}</div>
                    <div className="muted small">{b.email || ''}</div>
                  </td>
                  <td className="muted small">{b.gstin || '—'}</td>
                  <td>{b.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="danger">Inactive</Badge>}</td>
                  <td>
                    <div className="flex gap-8">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(b)}>Edit</Button>
                      {!b.isMain && (
                        <Button size="sm" variant="danger" onClick={() => remove(b)}>Delete</Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={showModal} title={editingId ? 'Edit Branch' : 'Add Branch'} onClose={() => setShowModal(false)} width={560}>
        <div className="form-row">
          <Field label="Branch Name *"><input className="input" value={form.name} onChange={set('name')} placeholder="e.g. Bandra Branch" /></Field>
          <Field label="Branch Code *"><input className="input" value={form.code} onChange={set('code')} placeholder="e.g. BAND" /></Field>
        </div>
        <Field label="Address"><input className="input" value={form.address} onChange={set('address')} /></Field>
        <div className="form-row">
          <Field label="Phone"><input className="input" value={form.phone} onChange={set('phone')} /></Field>
          <Field label="Email"><input className="input" value={form.email} onChange={set('email')} /></Field>
        </div>
        <div className="form-row">
          <Field label="GSTIN"><input className="input" value={form.gstin} onChange={set('gstin')} /></Field>
          <Field label="Invoice Prefix"><input className="input" value={form.settings.invoicePrefix} onChange={setSetting('invoicePrefix')} /></Field>
        </div>
        <div className="form-row">
          <Field label="Low Stock Threshold">
            <input className="input" type="number" value={form.settings.lowStockThreshold} onChange={setSetting('lowStockThreshold')} />
          </Field>
          <Field label="Status">
            <select className="select" value={form.isActive ? 'active' : 'inactive'} onChange={(e) => setForm({ ...form, isActive: e.target.value === 'active' })}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>
        </div>
        <Button className="btn-block" onClick={save}>Save Branch</Button>
      </Modal>
    </div>
  );
}