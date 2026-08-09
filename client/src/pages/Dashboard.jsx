import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { money, fmtDate } from '../utils/format';
import { StatCard, Spinner, Card } from '../components/ui';

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/dashboard').then((r) => setData(r.data.data)).catch(() => {});
  }, []);

  if (!data) return <Spinner />;

  const { today, totals, productCount, lowStockCount, lowStockProducts, customerCount } = data;

  return (
    <div>
      <h2 style={{ marginBottom: 18 }}>Dashboard</h2>
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

      {lowStockProducts.length > 0 && (
        <Card title="Low Stock Alerts">
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

      {today.invoices === 0 && (
        <Card title="Today at a glance">
          <div className="muted">
            No sales yet today. Open the <b>Billing</b> screen to start billing. Works offline too — invoices sync automatically when the internet returns.
          </div>
        </Card>
      )}
    </div>
  );
}
