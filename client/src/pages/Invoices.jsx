import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';
import db from '../db';
import { queueOperation, supersedePendingOps } from '../db/offlineService';
import { useToast } from '../context/ToastContext';
import { useSync } from '../context/SyncContext';
import { Button, Card, Modal, EmptyState, Spinner, Pagination } from '../components/ui';
import { money, fmtDateTime } from '../utils/format';
import { printInvoice } from '../utils/print';

export default function Invoices() {
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [settings, setSettings] = useState({});
  const [view, setView] = useState(null);
  const { toast } = useToast();
  const sync = useSync();
  const online = sync.status !== 'OFFLINE';

  const load = useCallback(() => {
    api.get('/invoices', { params: { page, limit: 20, search } }).then((r) => {
      setRows(r.data.data);
      setTotal(r.data.total);
    }).catch(() => {
      db.getAll('invoices').then((all) => {
        const q = search.toLowerCase();
        const filtered = q ? all.filter((i) => String(i.invoiceNo || '').toLowerCase().includes(q)) : all;
        setRows(filtered.slice(0, 20));
        setTotal(filtered.length);
      });
    });
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    db.get('settings', 'business_settings').then(setSettings);
    api.get('/settings').then((r) => setSettings(r.data.data)).catch(() => {});
  }, []);

  const viewInvoice = async (inv) => {
    try {
      const res = await api.get(`/invoices/${inv._id}`);
      setView(res.data.data);
    } catch {
      setView(inv);
    }
  };

  // Offline delete -> also deletes the sale online once reconnected (tombstone
  // then propagates the deletion to every other device).
  const removeInvoice = async (inv) => {
    if (!window.confirm(`Delete invoice ${inv.invoiceNo}? This cannot be undone.`)) return;
    const localInv = await db.get('invoices', inv.invoiceNo);
    const localClientSaleId =
      localInv && localInv.clientSaleId && !String(localInv.clientSaleId).startsWith('server-')
        ? localInv.clientSaleId
        : inv.clientSaleId && !String(inv.clientSaleId).startsWith('server-')
        ? inv.clientSaleId
        : null;
    const clientSaleId = localClientSaleId;
    try {
      await db.delete('invoices', inv.invoiceNo);
      if (clientSaleId) {
        await db.delete('sales', clientSaleId);
        await supersedePendingOps(clientSaleId);
      } else {
        await supersedePendingOps(inv.invoiceNo);
      }
      let serverOk = false;
      if (online) {
        try {
          const target = clientSaleId || inv.sale || inv._id || inv.saleId;
          if (target) {
            await api.delete(`/sales/${target}`);
            serverOk = true;
          }
        } catch (e) {
          serverOk = false;
        }
      }
      if (!serverOk && clientSaleId) {
        await queueOperation('sale_delete', { clientSaleId, invoiceNo: inv.invoiceNo });
      }
      if (view && view.invoiceNo === inv.invoiceNo) setView(null);
      toast(serverOk ? 'Invoice deleted' : 'Deleted locally — will sync', 'success');
      load();
    } catch (e) {
      toast(e.response?.data?.message || e.message, 'error');
    }
  };

  return (
    <div>
      <div className="flex-between mb-16">
        <h2>Invoices</h2>
        <div style={{ maxWidth: 260 }}>
          <input className="input" placeholder="Search invoice no…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>
      <Card>
        {rows === null ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <EmptyState icon="🧾" title="No invoices yet" />
        ) : (
          <table className="table">
            <thead><tr><th>Invoice No</th><th>Date</th><th>Customer</th><th>Items</th><th>Payment</th><th style={{ textAlign: 'right' }}>Total</th><th></th></tr></thead>
            <tbody>
              {rows.map((inv) => (
                <tr key={inv._id || inv.invoiceNo}>
                  <td style={{ fontWeight: 700 }}>{inv.invoiceNo}</td>
                  <td className="muted">{fmtDateTime(inv.createdAt)}</td>
                  <td>{inv.customerName || '—'}</td>
                  <td>{inv.items?.length || 0}</td>
                  <td><span className="badge badge-info">{inv.paymentMode?.toUpperCase()}</span></td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(inv.total)}</td>
                  <td>
                    <div className="flex gap-8">
                      <Button size="sm" variant="ghost" onClick={() => viewInvoice(inv)}>View</Button>
                      <Button size="sm" variant="ghost" onClick={() => printInvoice(settings, inv, 'A4')}>Print</Button>
                      <Button size="sm" variant="ghost" onClick={() => printInvoice(settings, inv, 'thermal')}>Thermal</Button>
                      <Button size="sm" variant="danger" onClick={() => removeInvoice(inv)}>Del</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination page={page} total={total} limit={20} onPage={setPage} />
      </Card>

      <Modal open={!!view} title={`Invoice ${view?.invoiceNo || ''}`} onClose={() => setView(null)} width={640}>
        {view && (
          <>
            <div className="flex-between small mb-16">
              <div>
                <b>{view.businessName || settings.businessName}</b><br />
                <span className="muted">{fmtDateTime(view.createdAt)}</span><br />
                <span className="muted">Cashier: {view.cashierName}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <b>{view.customerName || 'Walk-in'}</b><br />
                <span className="muted">{view.customerMobile}</span><br />
                <span className="muted">GST: {view.customerGst || '—'}</span>
              </div>
            </div>
            <table className="table" style={{ fontSize: 13 }}>
              <thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>GST</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
              <tbody>
                {(view.items || []).map((it, i) => (
                  <tr key={i}><td>{it.name}</td><td>{it.qty}</td><td>{money(it.price)}</td><td>{it.gstRate}%</td><td style={{ textAlign: 'right' }}>{money(it.total)}</td></tr>
                ))}
              </tbody>
            </table>
            <div style={{ width: 240, marginLeft: 'auto', marginTop: 10, fontSize: 13 }}>
              <div className="flex-between"><span className="muted">Subtotal</span><span>{money(view.subtotal)}</span></div>
              {view.discount ? <div className="flex-between"><span className="muted">Discount</span><span>-{money(view.discount)}</span></div> : null}
              <div className="flex-between"><span className="muted">GST</span><span>{money(view.gstTotal)}</span></div>
              <div className="flex-between" style={{ fontWeight: 800, fontSize: 16, borderTop: '2px solid var(--text)', marginTop: 6, paddingTop: 6 }}>
                <span>Total</span><span>{money(view.total)}</span>
              </div>
              <div className="flex-between small mt-8"><span className="muted">Payment</span><span>{view.paymentMode?.toUpperCase()} {view.changeDue ? `· change ${money(view.changeDue)}` : ''}</span></div>
            </div>
            <div className="flex mt-16" style={{ gap: 8 }}>
              <Button onClick={() => printInvoice(settings, view, 'A4')}>🖨️ Print A4</Button>
              <Button variant="ghost" onClick={() => printInvoice(settings, view, 'thermal')}>🧾 Thermal</Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
