import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { Button, Card, Field, StatCard, EmptyState } from '../components/ui';
import { fmtDateTime } from '../utils/format';

export default function Operations() {
  const [summary, setSummary] = useState(null);
  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [form, setForm] = useState({ product: '', toBranch: '', qty: '', note: '' });
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const load = useCallback(() => {
    api.get('/operations/summary').then((r) => setSummary(r.data.data)).catch(() => {});
    api.get('/operations/transfers').then((r) => setTransfers(r.data.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    api.get('/products', { params: { limit: 500, sort: 'name' } }).then((r) => setProducts(r.data.data || [])).catch(() => {});
    api.get('/branches').then((r) => setBranches(r.data.data || [])).catch(() => {});
  }, [load]);

  const submit = async () => {
    if (!form.product || !form.toBranch || !form.qty) return toast('Product, branch and quantity are required', 'error');
    setBusy(true);
    try {
      const r = await api.post('/operations/transfer', { ...form, qty: Number(form.qty) });
      toast(`Transferred ${r.data.data.transferred} × ${r.data.data.product}`, 'success');
      setForm({ product: '', toBranch: '', qty: '', note: '' });
      load();
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <h2 className="mb-16">Operations</h2>

      <div className="kpi-grid mb-16">
        <StatCard label="Stock transfers" value={summary?.transfers ?? '—'} icon="🔁" />
        <StatCard label="Active branches" value={summary?.branches ?? '—'} icon="🏢" />
        <StatCard label="Low stock items" value={summary?.lowStock ?? '—'} tone="warning" icon="⚠️" />
      </div>

      <Card title="Stock Transfer" className="mb-16">
        <div className="form-row">
          <Field label="Product">
            <select className="input" value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })}>
              <option value="">Select product…</option>
              {products.map((p) => <option key={p._id} value={p._id}>{p.name} {p.sku ? `(${p.sku})` : ''} — stock {p.stock}</option>)}
            </select>
          </Field>
          <Field label="To branch">
            <select className="input" value={form.toBranch} onChange={(e) => setForm({ ...form, toBranch: e.target.value })}>
              <option value="">Select branch…</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="form-row">
          <Field label="Quantity"><input className="input" type="number" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} /></Field>
          <Field label="Note"><input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
        </div>
        <Button onClick={submit} disabled={busy}>{busy ? 'Transferring…' : 'Transfer Stock'}</Button>
      </Card>

      <Card title="Transfer History">
        {transfers.length === 0 ? (
          <EmptyState icon="🔁" title="No transfers yet" />
        ) : (
          <table className="table">
            <thead><tr><th>When</th><th>Product</th><th>Qty</th><th>Reference</th><th>Note</th><th>By</th></tr></thead>
            <tbody>
              {transfers.map((t) => (
                <tr key={t._id}>
                  <td>{fmtDateTime(t.createdAt)}</td>
                  <td>{t.name}</td>
                  <td>{t.qty}</td>
                  <td>{t.reference}</td>
                  <td className="muted">{t.note || '—'}</td>
                  <td>{t.userName || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
