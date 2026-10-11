import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';
import db from '../db';
import { queueOperation, supersedePendingOps } from '../db/offlineService';
import { useToast } from '../context/ToastContext';
import { useSync } from '../context/SyncContext';
import { Button, Card, Modal, Field, EmptyState, Spinner, Pagination } from '../components/ui';
import { money, fmtDateTime, uid } from '../utils/format';

const emptyForm = { name: '', mobile: '', email: '', address: '', gstNumber: '' };

export default function Customers() {
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [history, setHistory] = useState(null);
  const [historyCustomer, setHistoryCustomer] = useState(null);
  const { toast } = useToast();
  const sync = useSync();
  const online = sync.status !== 'OFFLINE';

  const load = useCallback(() => {
    api.get('/customers', { params: { page, limit: 20, search } }).then((r) => {
      setRows(r.data.data);
      setTotal(r.data.total);
      db.putMany('customers', r.data.data.map((c) => ({ ...c, id: c._id })));
    }).catch(() => {
      db.getAll('customers').then((all) => {
        const q = search.toLowerCase();
        const filtered = q ? all.filter((c) => [c.name, c.mobile, c.gstNumber].some((v) => String(v || '').toLowerCase().includes(q))) : all;
        setRows(filtered);
        setTotal(filtered.length);
      });
    });
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.name.trim()) return toast('Name required', 'error');

    const saveLocal = async () => {
      if (editingId) {
        const all = await db.getAll('customers');
        const existing = all.find((c) => c._id === editingId || c.id === editingId || c.clientId === editingId);
        const localId = existing?.id || existing?._id || `local-${uid('cust')}`;
        await db.put('customers', {
          ...(existing || {}),
          ...form,
          _id: existing?._id || localId,
          id: localId,
          clientId: existing?.clientId || uid('cust'),
          updatedAt: new Date().toISOString(),
        });
        await queueOperation('customer_update', { id: editingId, clientId: existing?.clientId, ...form });
      } else {
        const clientId = uid('cust');
        await db.put('customers', {
          ...form,
          _id: `local-${clientId}`,
          id: `local-${clientId}`,
          clientId,
          totalPurchases: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        await queueOperation('customer_create', { clientId, ...form });
      }
    };

    try {
      if (online) {
        if (editingId) await api.put(`/customers/${editingId}`, form);
        else await api.post('/customers', form);
        toast('Customer saved', 'success');
      } else {
        await saveLocal();
        toast('Saved locally — will sync', 'success');
      }
      setShowModal(false);
      setForm(emptyForm);
      setEditingId(null);
      load();
    } catch (e) {
      if (e && !e.response) {
        try {
          await saveLocal();
          toast('Saved locally — will sync', 'success');
          setShowModal(false);
          setForm(emptyForm);
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

  const viewHistory = async (c) => {
    try {
      const res = await api.get(`/customers/${c._id}/history`);
      setHistoryCustomer(res.data.data.customer);
      setHistory(res.data.data.sales);
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  // Offline delete -> also deletes online once reconnected (tombstone then
  // propagates the deletion to every other device).
  const remove = async (c) => {
    if (!window.confirm(`Delete customer "${c.name}"?`)) return;
    const isLocalOnly = String(c._id || c.id || '').startsWith('local-');
    const targetId = c._id || c.id;
    try {
      await db.delete('customers', c.id || c._id);
      await supersedePendingOps(c.clientId);
      let serverOk = false;
      if (online && !isLocalOnly) {
        try {
          await api.delete(`/customers/${targetId}`);
          serverOk = true;
        } catch (e) {
          serverOk = false;
        }
      }
      if (!serverOk && !isLocalOnly) {
        await queueOperation('customer_delete', { id: targetId, clientId: c.clientId });
      }
      toast(serverOk ? 'Customer deleted' : 'Deleted locally — will sync', 'success');
      load();
    } catch (e) {
      toast(e.response?.data?.message || e.message, 'error');
    }
  };

  return (
    <div>
      <div className="flex-between mb-16">
        <h2>Customers</h2>
        <Button onClick={() => { setEditingId(null); setForm(emptyForm); setShowModal(true); }}>＋ Add Customer</Button>
      </div>
      <Card>
        <div className="mb-16" style={{ maxWidth: 320 }}>
          <input className="input" placeholder="Search name / mobile / GST…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        {rows === null ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <EmptyState icon="👥" title="No customers" />
        ) : (
          <table className="table">
            <thead><tr><th>Name</th><th>Mobile</th><th>GST</th><th>Address</th><th>Purchases</th><th></th></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c._id}>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td>{c.mobile || '—'}</td>
                  <td className="muted">{c.gstNumber || '—'}</td>
                  <td className="muted">{c.address || '—'}</td>
                  <td>{money(c.totalPurchases || 0)}</td>
                  <td>
                    <div className="flex gap-8">
                      <Button size="sm" variant="ghost" onClick={() => viewHistory(c)}>History</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditingId(c._id); setForm({ name: c.name, mobile: c.mobile || '', email: c.email || '', address: c.address || '', gstNumber: c.gstNumber || '' }); setShowModal(true); }}>Edit</Button>
                      <Button size="sm" variant="danger" onClick={() => remove(c)}>Del</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination page={page} total={total} limit={20} onPage={setPage} />
      </Card>

      <Modal open={showModal} title={editingId ? 'Edit Customer' : 'Add Customer'} onClose={() => setShowModal(false)} width={560}>
        <div className="form-row">
          <Field label="Name *"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Mobile"><input className="input" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></Field>
        </div>
        <div className="form-row">
          <Field label="Email"><input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="GST Number"><input className="input" value={form.gstNumber} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} /></Field>
        </div>
        <Field label="Address"><input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
        <Button className="btn-block" onClick={save}>Save</Button>
      </Modal>

      <Modal open={!!history} title={`Purchase History — ${historyCustomer?.name || ''}`} onClose={() => setHistory(null)} width={640}>
        {history && history.length === 0 ? (
          <EmptyState icon="🧾" title="No purchases yet" />
        ) : (
          <table className="table">
            <thead><tr><th>Invoice</th><th>Date</th><th>Items</th><th>Payment</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
            <tbody>
              {(history || []).map((s) => (
                <tr key={s._id}>
                  <td>{s.invoiceNo}</td>
                  <td>{fmtDateTime(s.createdAt)}</td>
                  <td>{s.items?.length || 0}</td>
                  <td>{(s.paymentMode || '').toUpperCase()}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(s.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Modal>
    </div>
  );
}
