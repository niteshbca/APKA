import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { Button, Card, Field, Badge, EmptyState, Spinner } from '../components/ui';
import { money, fmtDate } from '../utils/format';

const TABS = [
  { id: 'sales', label: 'Sales' },
  { id: 'product', label: 'Product-wise' },
  { id: 'customer', label: 'Customer-wise' },
  { id: 'payment', label: 'Payment-wise' },
  { id: 'profit', label: 'Profit' },
  { id: 'stock', label: 'Stock' },
];

export default function Reports() {
  const [tab, setTab] = useState('sales');
  const [from, setFrom] = useState(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const params = { from, to };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === 'sales') {
        const r = await api.get('/reports/sales', { params });
        setData(r.data.data);
      } else if (tab === 'product') {
        const r = await api.get('/reports/product-wise', { params });
        setData(r.data.data);
      } else if (tab === 'customer') {
        const r = await api.get('/reports/customer-wise', { params });
        setData(r.data.data);
      } else if (tab === 'payment') {
        const r = await api.get('/reports/payment-wise', { params });
        setData(r.data.data);
      } else if (tab === 'profit') {
        const r = await api.get('/reports/profit', { params });
        setData(r.data.data);
      } else if (tab === 'stock') {
        const r = await api.get('/reports/stock');
        setData(r.data.data);
      }
    } catch (e) {
      setData(null);
      setError(e.response?.data?.message || e.message || 'Could not load report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tab]);

  const totalSales = Array.isArray(data) ? data.reduce((a, b) => a + (b.sales || b.revenue || b.amount || 0), 0) : data?.revenue || 0;

  return (
    <div>
      <h2 className="mb-16">Reports</h2>

      <div className="filter-bar">
        {TABS.map((t) => (
          <Button key={t.id} size="sm" variant={tab === t.id ? 'primary' : 'ghost'} onClick={() => setTab(t.id)}>{t.label}</Button>
        ))}
      </div>

      <Card>
        <div className="filter-bar">
          {tab !== 'stock' && (
            <>
              <Field label="From"><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
              <Field label="To"><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
              <Button onClick={fetchData}>Apply Range</Button>
            </>
          )}
          {tab === 'profit' && data && !Array.isArray(data) && (
            <div className="flex gap-8">
              <Badge tone="info">Revenue {money(data.revenue)}</Badge>
              <Badge tone="warning">Cost {money(data.cost)}</Badge>
              <Badge tone="success">Profit {money(data.profit)}</Badge>
              <Badge tone="neutral">{data.invoices} invoices</Badge>
            </div>
          )}
          {tab === 'sales' && Array.isArray(data) && (
            <Badge tone="info">Total in range: {money(totalSales)}</Badge>
          )}
        </div>

        {loading ? (
          <Spinner />
        ) : error ? (
          <>
            <EmptyState icon="📡" title="Could not load report" sub={error} />
            <div className="flex" style={{ justifyContent: 'center' }}><Button onClick={fetchData}>Retry</Button></div>
          </>
        ) : !data || (Array.isArray(data) && data.length === 0) || (tab === 'profit' && !Array.isArray(data) && (data.invoices || 0) === 0 && (!data.buckets || data.buckets.length === 0)) ? (
          <EmptyState icon="📊" title="No data for this range" />
        ) : tab === 'sales' ? (
          <table className="table">
            <thead><tr><th>Date</th><th>Sales</th><th>Invoices</th><th>Profit</th></tr></thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.date}>
                  <td>{r.date}</td>
                  <td>{money(r.sales)}</td>
                  <td>{r.invoices}</td>
                  <td>{money(r.profit)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ fontWeight: 700 }}>Total</td>
                <td style={{ fontWeight: 700 }}>{money(data.reduce((a, b) => a + (b.sales || 0), 0))}</td>
                <td style={{ fontWeight: 700 }}>{data.reduce((a, b) => a + (b.invoices || 0), 0)}</td>
                <td style={{ fontWeight: 700 }}>{money(data.reduce((a, b) => a + (b.profit || 0), 0))}</td>
              </tr>
            </tfoot>
          </table>
        ) : tab === 'product' ? (
          <table className="table">
            <thead><tr><th>Product</th><th>SKU</th><th>Qty Sold</th><th>Revenue</th><th>Cost</th><th>Profit</th></tr></thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.sku}>
                  <td>{r.name}</td>
                  <td className="muted">{r.sku}</td>
                  <td>{r.qty}</td>
                  <td>{money(r.revenue)}</td>
                  <td>{money(r.cost)}</td>
                  <td style={{ fontWeight: 700 }}>{money(r.profit)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2} style={{ fontWeight: 700 }}>Total</td>
                <td style={{ fontWeight: 700 }}>{data.reduce((a, b) => a + (b.qty || 0), 0)}</td>
                <td style={{ fontWeight: 700 }}>{money(data.reduce((a, b) => a + (b.revenue || 0), 0))}</td>
                <td style={{ fontWeight: 700 }}>{money(data.reduce((a, b) => a + (b.cost || 0), 0))}</td>
                <td style={{ fontWeight: 700 }}>{money(data.reduce((a, b) => a + (b.profit || 0), 0))}</td>
              </tr>
            </tfoot>
          </table>
        ) : tab === 'customer' ? (
          <table className="table">
            <thead><tr><th>Customer</th><th>Mobile</th><th>Invoices</th><th>Total</th></tr></thead>
            <tbody>
              {data.map((r, i) => (
                <tr key={i}>
                  <td>{r.customer}</td>
                  <td>{r.mobile || '—'}</td>
                  <td>{r.invoices}</td>
                  <td>{money(r.sales)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2} style={{ fontWeight: 700 }}>Total</td>
                <td style={{ fontWeight: 700 }}>{data.reduce((a, b) => a + (b.invoices || 0), 0)}</td>
                <td style={{ fontWeight: 700 }}>{money(data.reduce((a, b) => a + (b.sales || 0), 0))}</td>
              </tr>
            </tfoot>
          </table>
        ) : tab === 'payment' ? (
          <table className="table">
            <thead><tr><th>Payment Mode</th><th>Amount</th><th>Transactions</th></tr></thead>
            <tbody>
              {data.map((r, i) => (
                <tr key={i}>
                  <td><Badge tone="info">{(r.paymentMode || '').toUpperCase()}</Badge></td>
                  <td>{money(r.amount)}</td>
                  <td>{r.count}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ fontWeight: 700 }}>Total</td>
                <td style={{ fontWeight: 700 }}>{money(data.reduce((a, b) => a + (b.amount || 0), 0))}</td>
                <td style={{ fontWeight: 700 }}>{data.reduce((a, b) => a + (b.count || 0), 0)}</td>
              </tr>
            </tfoot>
          </table>
        ) : tab === 'profit' ? (
          data.buckets && data.buckets.length > 0 ? (
            <table className="table">
              <thead><tr><th>Period</th><th>Sales</th><th>Profit</th><th>Invoices</th></tr></thead>
              <tbody>
                {data.buckets.map((r) => (
                  <tr key={r.date}>
                    <td>{r.date}</td>
                    <td>{money(r.sales)}</td>
                    <td>{money(r.profit)}</td>
                    <td>{r.invoices}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td style={{ fontWeight: 700 }}>Total</td>
                  <td style={{ fontWeight: 700 }}>{money(data.revenue)}</td>
                  <td style={{ fontWeight: 700 }}>{money(data.profit)}</td>
                  <td style={{ fontWeight: 700 }}>{data.invoices}</td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <EmptyState icon="📊" title="No data for this range" />
          )
        ) : (
          <table className="table">
            <thead><tr><th>Product</th><th>SKU</th><th>Stock</th><th>Min</th><th>Status</th></tr></thead>
            <tbody>
              {Array.isArray(data) && data.map((p) => (
                <tr key={p.sku}>
                  <td>{p.name}</td>
                  <td className="muted">{p.sku}</td>
                  <td>{p.stock}</td>
                  <td>{p.minStock}</td>
                  <td>{p.isLowStock ? <Badge tone="danger">Low</Badge> : <Badge tone="success">OK</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
