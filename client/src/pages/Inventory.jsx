import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';
import db from '../db';
import { queueOperation, adjustStockLocal } from '../db/offlineService';
import { useToast } from '../context/ToastContext';
import { useSync } from '../context/SyncContext';
import { Button, Card, Modal, Field, Badge, EmptyState, Spinner } from '../components/ui';
import { money, fmtDateTime } from '../utils/format';

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdjust, setShowAdjust] = useState(null);
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const { toast } = useToast();
  const sync = useSync();
  const online = sync.status !== 'OFFLINE';

  const loadAll = useCallback(async () => {
    setLoading(true);
    const local = await db.getAll('products');
    setProducts(local);
    try {
      const r = await api.get('/stock/transactions', { params: { limit: 30 } });
      setTransactions(r.data.data);
    } catch {
      /* keep previous */
    }
    try {
      const r = await api.get('/stock/low-stock');
      setLowStock(r.data.data);
    } catch {
      setLowStock(local.filter((p) => p.isLowStock));
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const doAdjust = async () => {
    const d = Number(delta) || 0;
    if (d === 0) return toast('Enter a non-zero adjustment', 'error');
    try {
      if (online) {
        await api.post('/stock/adjust', { product: showAdjust._id, delta: d, reason, userName: JSON.parse(localStorage.getItem('pos_user') || '{}').name });
        toast('Stock adjusted', 'success');
      } else {
        await adjustStockLocal(showAdjust, d, { note: reason, reference: 'MANUAL' });
        await queueOperation('stock_adjustment', { product: showAdjust._id, productClientId: showAdjust.clientId || undefined, delta: d, reason, userName: 'admin', createdAt: new Date().toISOString() });
        toast('Adjusted offline — will sync', 'info');
      }
      setShowAdjust(null);
      setDelta('');
      setReason('');
      loadAll();
    } catch (e) {
      if (e && !e.response) {
        try {
          await adjustStockLocal(showAdjust, d, { note: reason, reference: 'MANUAL' });
          await queueOperation('stock_adjustment', { product: showAdjust._id, productClientId: showAdjust.clientId || undefined, delta: d, reason, userName: 'admin', createdAt: new Date().toISOString() });
          toast('Adjusted offline — will sync', 'info');
          setShowAdjust(null);
          setDelta('');
          setReason('');
          loadAll();
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
      <h2 className="mb-16">Inventory</h2>
      <div className="flex gap-8 mb-16">
        <Badge tone={lowStock.length ? 'danger' : 'success'}>{lowStock.length} low stock items</Badge>
        <Badge tone="info">{products.length} products cached locally</Badge>
      </div>

      <div className="stat-grid">
        <Card title="Low Stock Alerts" className="mt-8">
          {loading ? (
            <Spinner />
          ) : lowStock.length === 0 ? (
            <EmptyState icon="✅" title="All stocked up" />
          ) : (
            <table className="table">
              <thead><tr><th>Product</th><th>Stock</th><th>Min</th><th></th></tr></thead>
              <tbody>
                {lowStock.map((p) => (
                  <tr key={p._id || p.sku}>
                    <td>{p.name}</td>
                    <td><Badge tone="danger">{p.stock}</Badge></td>
                    <td>{p.minStock}</td>
                    <td><Button size="sm" variant="ghost" onClick={() => setShowAdjust(p)}>Adjust</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <Card title="Stock History">
        {loading ? (
          <Spinner />
        ) : transactions.length === 0 ? (
          <EmptyState icon="📜" title="No stock transactions yet" />
        ) : (
          <table className="table">
            <thead><tr><th>Date</th><th>Product</th><th>Type</th><th>Change</th><th>Stock</th><th>Ref</th></tr></thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t._id}>
                  <td className="muted">{fmtDateTime(t.createdAt)}</td>
                  <td>{t.name}</td>
                  <td><Badge tone={t.type === 'sale' ? 'warning' : t.type === 'purchase' ? 'success' : 'info'}>{t.type}</Badge></td>
                  <td style={{ color: t.qty >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>
                    {t.qty >= 0 ? `+${t.qty}` : t.qty}
                  </td>
                  <td>{t.previousStock} → {t.newStock}</td>
                  <td className="muted">{t.reference || t.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={!!showAdjust} title={`Adjust Stock — ${showAdjust?.name || ''}`} onClose={() => setShowAdjust(null)} width={420}>
        <div className="flex-between mb-16" style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 10 }}>
          <span className="muted">Current stock</span>
          <b>{showAdjust?.stock}</b>
        </div>
        <Field label="Adjustment (+ add / − remove)">
          <input className="input" type="number" value={delta} onChange={(e) => setDelta(e.target.value)} autoFocus />
        </Field>
        <Field label="Reason"><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <Button className="btn-block" onClick={doAdjust}>Apply Adjustment</Button>
      </Modal>
    </div>
  );
}
