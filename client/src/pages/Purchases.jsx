import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';
import db from '../db';
import { queueOperation, adjustStockLocal } from '../db/offlineService';
import { useToast } from '../context/ToastContext';
import { useSync } from '../context/SyncContext';
import { Button, Card, Modal, Field, EmptyState, Spinner, Pagination } from '../components/ui';
import { money, fmtDateTime } from '../utils/format';

export default function Purchases() {
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [products, setProducts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ product: '', supplierName: '', qty: '1', costPrice: '', note: '', type: 'purchase' });
  const { toast } = useToast();
  const sync = useSync();
  const online = sync.status !== 'OFFLINE';

  const load = useCallback(() => {
    api.get('/purchases', { params: { page, limit: 20 } }).then((r) => {
      setRows(r.data.data);
      setTotal(r.data.total);
    }).catch(() => {
      db.getAll('purchases').then((all) => {
        setRows(all.slice(0, 20));
        setTotal(all.length);
      });
    });
  }, [page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    db.getAll('products').then(setProducts);
  }, []);

  const save = async () => {
    if (!form.product || !form.qty || Number(form.qty) <= 0) return toast('Select product and quantity', 'error');
    const product = products.find((p) => (p._id || p.sku) === form.product || p.sku === form.product);
    if (!product) return toast('Product not found', 'error');

    const payload = {
      product: product._id,
      productClientId: product.clientId || undefined,
      name: product.name,
      sku: product.sku,
      supplierName: form.supplierName,
      qty: Number(form.qty),
      costPrice: Number(form.costPrice) || 0,
      note: form.note,
      type: form.type,
      userName: JSON.parse(localStorage.getItem('pos_user') || '{}').name || 'admin',
      createdAt: new Date().toISOString(),
    };

    try {
      if (online) {
        await api.post('/purchases', payload);
        toast('Purchase recorded', 'success');
      } else {
        await adjustStockLocal(product, payload.qty, { note: payload.note, reference: `PUR-${Date.now()}` });
        await db.put('purchases', { id: `purchase-${Date.now()}`, ...payload });
        await queueOperation('purchase', payload);
        toast('Purchase saved offline — will sync', 'info');
      }
      setShowModal(false);
      setForm({ product: '', supplierName: '', qty: '1', costPrice: '', note: '', type: 'purchase' });
      load();
    } catch (e) {
      if (e && !e.response) {
        try {
          await adjustStockLocal(product, payload.qty, { note: payload.note, reference: `PUR-${Date.now()}` });
          await db.put('purchases', { id: `purchase-${Date.now()}`, ...payload });
          await queueOperation('purchase', payload);
          toast('Purchase saved offline — will sync', 'info');
          setShowModal(false);
          setForm({ product: '', supplierName: '', qty: '1', costPrice: '', note: '', type: 'purchase' });
          load();
          return;
        } catch (e2) {
          toast(e2.message, 'error');
          return;
        }
      }
      toast(e.message, 'error');
    }
  };

  return (
    <div>
      <div className="flex-between mb-16">
        <h2>Purchases</h2>
        <Button onClick={() => setShowModal(true)}>＋ Add Purchase / Stock</Button>
      </div>
      <Card>
        {rows === null ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <EmptyState icon="📥" title="No purchases yet" sub="Record purchase entries to add stock" />
        ) : (
          <table className="table">
            <thead><tr><th>Product</th><th>Type</th><th>Supplier</th><th>Qty</th><th>Cost</th><th>Total</th><th>Date</th></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p._id || p.id}>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td><span className="badge badge-info">{p.type}</span></td>
                  <td>{p.supplierName || '—'}</td>
                  <td>{p.qty}</td>
                  <td>{money(p.costPrice)}</td>
                  <td>{money(p.total)}</td>
                  <td className="muted">{fmtDateTime(p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination page={page} total={total} limit={20} onPage={setPage} />
      </Card>

      <Modal open={showModal} title="Purchase Entry" onClose={() => setShowModal(false)} width={560}>
        <Field label="Product *">
          <select className="select" value={form.product} onChange={(e) => {
            const p = products.find((x) => (x._id || x.sku) === e.target.value);
            setForm({ ...form, product: e.target.value, costPrice: p ? p.purchasePrice : '' });
          }}>
            <option value="">Select product…</option>
            {products.map((p) => <option key={p._id || p.sku} value={p._id || p.sku}>{p.name} ({p.sku})</option>)}
          </select>
        </Field>
        <div className="form-row">
          <Field label="Quantity *"><input className="input" type="number" min="1" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} /></Field>
          <Field label="Cost Price"><input className="input" type="number" min="0" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} /></Field>
        </div>
        <div className="form-row">
          <Field label="Supplier"><input className="input" value={form.supplierName} onChange={(e) => setForm({ ...form, supplierName: e.target.value })} /></Field>
          <Field label="Type">
            <select className="select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="purchase">Purchase</option>
              <option value="opening">Opening Stock</option>
            </select>
          </Field>
        </div>
        <Field label="Note"><input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
        <Button className="btn-block" onClick={save}>Save Purchase</Button>
      </Modal>
    </div>
  );
}
