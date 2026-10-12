import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { money } from '../utils/format';
import { useBranch } from '../context/BranchContext';
import { useAuth } from '../context/AuthContext';
import { StatCard, Spinner, Card, Button, EmptyState } from '../components/ui';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const { activeBranch } = useBranch();
  const { isSuperAdmin } = useAuth();

  const load = () => {
    const params = {};
    if (isSuperAdmin && activeBranch?._id) params.branch = activeBranch._id;
    setData(null);
    setError(null);
    api.get('/dashboard', { params })
      .then((r) => setData(r.data.data))
      .catch((e) => setError(e.message || 'Could not load the dashboard'));
  };

  useEffect(() => { load(); }, [activeBranch, isSuperAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div>
        <h2 className="mb-16">Dashboard</h2>
        <Card>
          <EmptyState icon="📡" title="Could not load the dashboard" sub={error} />
          <div className="flex" style={{ justifyContent: 'center' }}>
            <Button onClick={load}>Retry</Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!data) return <Spinner />;

  const { today, totals, productCount, lowStockCount, lowStockProducts = [], customerCount, trend = [], topProducts = [], paymentSplit = {}, branchStats = [] } = data;

  const maxTrend = Math.max(1, ...trend.map((t) => t.sales));
  const payTotal = (paymentSplit.cash || 0) + (paymentSplit.upi || 0) + (paymentSplit.card || 0) || 1;
  const payPct = (v) => Math.round(((v || 0) / payTotal) * 100);

  return (
    <div>
      <div className="flex-between mb-16">
        <h2>Dashboard</h2>
        {activeBranch && <span className="badge badge-info">🏬 {activeBranch.name}</span>}
      </div>

      <div className="stat-grid">
        <StatCard label="Today's Sales" value={money(today.sales)} sub={`${today.invoices} invoices today`} icon="💰" tone="success" />
        <StatCard label="Today's Profit" value={money(today.profit)} sub="Gross margin today" icon="📈" tone="info" />
        <StatCard label="Total Invoices" value={totals.invoices} sub={`${money(totals.sales)} lifetime`} icon="🧾" tone="primary" />
        <StatCard label="Cash Collection" value={money(today.cash)} sub="Today" icon="💵" tone="success" />
        <StatCard label="UPI Collection" value={money(today.upi)} sub="Today" icon="📱" tone="info" />
        <StatCard label="Card Collection" value={money(today.card)} sub="Today" icon="💳" tone="warning" />
        <StatCard label="Total Products" value={productCount} sub={`${customerCount} customers`} icon="📦" tone="primary" />
        <StatCard label="Low Stock Items" value={lowStockCount} sub="Need restocking" icon="⚠️" tone="danger" />
      </div>

      <div className="dashboard-grid">
        <Card title="Sales Trend (Last 7 Days)">
          <div className="bar-chart">
            {trend.map((t) => (
              <div key={t.date} className="bar-col">
                <div className="bar-value">{money(t.sales)}</div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ height: `${Math.max(3, (t.sales / maxTrend) * 100)}%` }} />
                </div>
                <div className="bar-label">{t.date}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Payment Mode Split (Today)">
          <div className="payment-split">
            <div className="split-row">
              <span>💵 Cash</span>
              <div className="split-bar"><div className="split-fill cash" style={{ width: `${payPct(paymentSplit.cash)}%` }} /></div>
              <span className="split-pct">{payPct(paymentSplit.cash)}%</span>
            </div>
            <div className="split-row">
              <span>📱 UPI</span>
              <div className="split-bar"><div className="split-fill upi" style={{ width: `${payPct(paymentSplit.upi)}%` }} /></div>
              <span className="split-pct">{payPct(paymentSplit.upi)}%</span>
            </div>
            <div className="split-row">
              <span>💳 Card</span>
              <div className="split-bar"><div className="split-fill card" style={{ width: `${payPct(paymentSplit.card)}%` }} /></div>
              <span className="split-pct">{payPct(paymentSplit.card)}%</span>
            </div>
            <div className="split-total">
              <span className="muted small">Lifetime collection</span>
              <strong>{money(payTotal)}</strong>
            </div>
          </div>
        </Card>
      </div>

      <div className="dashboard-grid mt-16">
        <Card title="Top Selling Products">
          {topProducts.length === 0 ? (
            <div className="muted small">No sales data yet.</div>
          ) : (
            <table className="table">
              <thead><tr><th>#</th><th>Product</th><th>Qty Sold</th><th style={{ textAlign: 'right' }}>Revenue</th></tr></thead>
              <tbody>
                {topProducts.map((p, i) => (
                  <tr key={p.sku || p.name}>
                    <td><span className={`rank-badge rank-${i + 1}`}>{i + 1}</span></td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      <div className="muted small">{p.sku}</div>
                    </td>
                    <td>{p.qty}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {isSuperAdmin && branchStats.length > 0 ? (
          <Card title="Branch Performance (All Time)">
            <table className="table">
              <thead><tr><th>Branch</th><th>Invoices</th><th style={{ textAlign: 'right' }}>Sales</th></tr></thead>
              <tbody>
                {branchStats.map((b, i) => (
                  <tr key={b._id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{b.name}</div>
                      <div className="muted small">{b.code}</div>
                    </td>
                    <td>{b.invoices}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(b.sales)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ) : (
          <Card title="Today at a glance">
            <div className="muted">
              {today.invoices === 0
                ? <>No sales yet today. Open the <b>Billing</b> screen to start billing. Works offline too — invoices sync automatically when the internet returns.</>
                : <>Great going! You've made <b>{today.invoices}</b> sales today worth <b>{money(today.sales)}</b>.</>}
            </div>
          </Card>
        )}
      </div>

      {lowStockProducts.length > 0 && (
        <Card title="Low Stock Alerts" className="mt-16">
          <table className="table">
            <thead>
              <tr><th>Product</th><th>SKU</th><th>Stock</th><th>Min Stock</th><th>Status</th></tr>
            </thead>
            <tbody>
              {lowStockProducts.slice(0, 10).map((p) => (
                <tr key={p.sku}>
                  <td>{p.name}</td>
                  <td>{p.sku}</td>
                  <td>{p.stock}</td>
                  <td>{p.minStock}</td>
                  <td><span className="badge badge-danger">Low</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}