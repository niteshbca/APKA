import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import db from '../db';
import { queueOperation, supersedePendingOps } from '../db/offlineService';
import { useToast } from '../context/ToastContext';
import { useSync } from '../context/SyncContext';
import { Button, Card, Modal, Field, EmptyState, Spinner } from '../components/ui';
import ImageField from '../components/ImageField';
import { uid } from '../utils/format';

const EMPTY = { name: '', description: '', image: '' };

export default function Categories() {
  const [rows, setRows] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState(null);
  const { toast } = useToast();
  const sync = useSync();
  const online = sync.status !== 'OFFLINE';

  const load = () => {
    setError(null);
    api.get('/categories').then((r) => {
      setRows(r.data.data);
      db.putMany('categories', r.data.data.map((c) => ({ ...c, id: c._id })));
    }).catch(async (e) => {
      const all = await db.getAll('categories');
      if (all.length > 0 || !online) {
        setRows(all);
      } else {
        setRows([]);
        setError(e.message || 'Could not load categories');
      }
    });
  };

  useEffect(load, []);

  const save = async () => {
    if (!form.name.trim()) return toast('Name required', 'error');
    const payload = { name: form.name.trim(), description: (form.description || '').trim(), image: form.image || '' };

    const saveLocal = async () => {
      if (editingId) {
        const all = await db.getAll('categories');
        const existing = all.find((c) => c._id === editingId || c.id === editingId || c.clientId === editingId);
        const localId = existing?.id || existing?._id || `local-${uid('cat')}`;
        await db.put('categories', {
          ...(existing || {}),
          ...payload,
          _id: existing?._id || localId,
          id: localId,
          clientId: existing?.clientId || uid('cat'),
          updatedAt: new Date().toISOString(),
        });
        await queueOperation('category_update', { id: editingId, clientId: existing?.clientId, ...payload });
      } else {
        const clientId = uid('cat');
        await db.put('categories', {
          ...payload,
          _id: `local-${clientId}`,
          id: `local-${clientId}`,
          clientId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        await queueOperation('category_create', { clientId, ...payload });
      }
    };

    try {
      if (online) {
        if (editingId) await api.put(`/categories/${editingId}`, payload);
        else await api.post('/categories', payload);
        toast('Category saved', 'success');
      } else {
        await saveLocal();
        toast('Saved locally — will sync', 'success');
      }
      setShowModal(false);
      setForm(EMPTY);
      setEditingId(null);
      load();
    } catch (e) {
      if (e && !e.response) {
        try {
          await saveLocal();
          toast('Saved locally — will sync', 'success');
          setShowModal(false);
          setForm(EMPTY);
          setEditingId(null);
          load();
          return;
        } catch (e2) {
          toast(e2.message, 'error');
          return;
        }
      }
      toast(e.response?.data?.message || e.message, 'error');
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete "${c.name}"?`)) return;
    const isLocalOnly = String(c._id || c.id || '').startsWith('local-');
    try {
      await db.delete('categories', c.id || c._id);
      await supersedePendingOps(c.clientId);
      let serverOk = false;
      if (online && !isLocalOnly) {
        try {
          await api.delete(`/categories/${c._id}`);
          serverOk = true;
        } catch (e) {
          serverOk = false;
        }
      }
      if (!serverOk && !isLocalOnly) {
        await queueOperation('category_delete', { id: c._id, clientId: c.clientId });
      }
      toast(serverOk ? 'Deleted' : 'Deleted locally — will sync', 'success');
      load();
    } catch (e) {
      toast(e.response?.data?.message || e.message, 'error');
    }
  };

  return (
    <div>
      <div className="flex-between mb-16">
        <h2>Categories</h2>
        <Button onClick={() => { setEditingId(null); setForm(EMPTY); setShowModal(true); }}>＋ Add Category</Button>
      </div>
      <Card>
        {rows === null ? (
          <Spinner />
        ) : error ? (
          <>
            <EmptyState icon="📡" title="Could not load categories" sub={error} />
            <div className="flex" style={{ justifyContent: 'center' }}>
              <Button onClick={load}>Retry</Button>
            </div>
          </>
        ) : rows.length === 0 ? (
          <EmptyState icon="🗂️" title="No categories" />
        ) : (
          <table className="table">
            <thead><tr><th>Name</th><th>Description</th><th></th></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c._id}>
                  <td>
                    <div className="flex gap-8" style={{ alignItems: 'center' }}>
                      <span className="thumb">
                        {c.image ? <img src={c.image} alt={c.name} /> : <span className="thumb-empty">🗂️</span>}
                      </span>
                      <span style={{ fontWeight: 600 }}>{c.name}</span>
                    </div>
                  </td>
                  <td className="muted">{c.description || '—'}</td>
                  <td>
                    <div className="flex gap-8">
                      <Button size="sm" variant="ghost" onClick={() => { setEditingId(c._id); setForm({ name: c.name, description: c.description, image: c.image || '' }); setShowModal(true); }}>Edit</Button>
                      <Button size="sm" variant="danger" onClick={() => remove(c)}>Del</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={showModal} title={editingId ? 'Edit Category' : 'Add Category'} onClose={() => setShowModal(false)}>
        <Field label="Name *"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Description"><textarea className="input" rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        <ImageField label="Category Image" value={form.image} onChange={(v) => setForm({ ...form, image: v })} toast={toast} />
        <Button className="btn-block" onClick={save}>Save</Button>
      </Modal>
    </div>
  );
}
