import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';
import { StatCard, Badge } from '../components/ui';
import CrudPage from '../components/CrudPage';
import { money, fmtDate } from '../utils/format';

const KIND_META = {
  return: { label: 'Return', tone: 'danger', icon: '↩️' },
  udhaar: { label: 'Udhaar', tone: 'warning', icon: '📝' },
  payment: { label: 'Recovery', tone: 'success', icon: '💵' },
};

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'return', label: '↩️ Returns' },
  { key: 'udhaar', label: '📝 Udhaar (Credit)' },
  { key: 'payment', label: '💵 Recovery' },
];

const FIELDS = [
  {
    key: 'kind', label: 'Type', type: 'select', options: [
      { value: 'return', label: 'Return / Refund' },
      { value: 'udhaar', label: 'Udhaar (credit given)' },
      { value: 'payment', label: 'Recovery (payment received)' },
    ],
  },
  { key: 'customerName', label: 'Customer name' },
  { key: 'customerMobile', label: 'Mobile' },
  { key: 'invoiceNo', label: 'Invoice no.' },
  { key: 'amount', label: 'Amount *', type: 'number' },
  { key: 'reason', label: 'Reason' },
  { key: 'date', label: 'Date', type: 'date' },
  {
    key: 'status', label: 'Status', type: 'select', options: [
      { value: 'open', label: 'Open' },
      { value: 'settled', label: 'Settled' },
    ],
  },
  { key: 'note', label: 'Note', type: 'textarea' },
];

export default function Returns() {
  const [tab, setTab] = useState('all');
  const [summary, setSummary] = useState(null);

  const loadSummary = useCallback(() => {
    api.get('/returns/summary').then((r) => setSummary(r.data.data)).catch(() => {});
  }, []);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  const params = tab === 'all' ? {} : { kind: tab };
  const addLabel = tab === 'udhaar' ? 'Add Udhaar' : tab === 'payment' ? 'Add Recovery' : tab === 'return' ? 'Add Return' : 'Add Entry';

  return (
    <div>
      <div className="flex-between mb-16" style={{ flexWrap: 'wrap', gap: 10 }}>
        <h2>Returns & Udhaar</h2>
        <span className="muted small">Refunds, credit (udhaar) and recovery — one ledger.</span>
      </div>

      <div className="kpi-grid mb-16">
        <StatCard label="Returns / Refunds" value={money(summary?.returnsAmount || 0)} sub={`${summary?.returnsCount || 0} entries`} tone="danger" icon="↩️" />
        <StatCard label="Udhaar Given" value={money(summary?.udhaarGiven || 0)} sub={`${summary?.udhaarCount || 0} entries`} tone="warning" icon="📝" />
        <StatCard label="Recovered" value={money(summary?.recovered || 0)} sub="Payments received" tone="success" icon="💵" />
        <StatCard label="Outstanding" value={money(summary?.outstanding || 0)} sub={`${summary?.openCount || 0} open`} tone="info" icon="⏳" />
      </div>

      <div className="tabs mb-16" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`btn btn-sm ${tab === t.key ? '' : 'btn-ghost'}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <CrudPage
        key={tab}
        endpoint="/returns"
        title={tab === 'all' ? 'All entries' : `${KIND_META[tab]?.label || ''} entries`}
        addLabel={addLabel}
        searchPlaceholder="Search customer / invoice / reason…"
        params={params}
        onLoaded={loadSummary}
        emptyForm={{ kind: tab === 'all' ? 'return' : tab, customerName: '', customerMobile: '', invoiceNo: '', amount: '', reason: '', date: new Date().toISOString().slice(0, 10), status: 'open', note: '' }}
        toForm={(r) => ({
          kind: r.kind || 'return',
          customerName: r.customerName || '',
          customerMobile: r.customerMobile || '',
          invoiceNo: r.invoiceNo || '',
          amount: r.amount ?? '',
          reason: r.reason || '',
          date: r.date ? String(r.date).slice(0, 10) : '',
          status: r.status || 'open',
          note: r.note || '',
        })}
        columns={[
          { key: 'date', label: 'Date', render: (r) => (r.date ? fmtDate(r.date) : '—') },
          { key: 'kind', label: 'Type', render: (r) => <Badge tone={KIND_META[r.kind]?.tone}>{KIND_META[r.kind]?.label || r.kind}</Badge> },
          { key: 'customerName', label: 'Customer', render: (r) => r.customerName || '—' },
          { key: 'invoiceNo', label: 'Invoice' },
          { key: 'amount', label: 'Amount', align: 'right', render: (r) => <b>{money(r.amount)}</b> },
          { key: 'status', label: 'Status', render: (r) => <Badge tone={r.status === 'settled' ? 'success' : 'neutral'}>{r.status}</Badge> },
        ]}
        fields={FIELDS}
      />
    </div>
  );
}
