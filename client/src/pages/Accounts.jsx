import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';
import { StatCard, Badge } from '../components/ui';
import CrudPage from '../components/CrudPage';
import { money, fmtDate } from '../utils/format';
import { getActiveFY } from '../utils/financialYear';

export default function Accounts() {
  const [summary, setSummary] = useState(null);
  const [fy, setFy] = useState(() => getActiveFY());

  const load = useCallback(() => {
    api.get('/accounts/summary', { params: { from: fy.from, to: fy.to } })
      .then((r) => setSummary(r.data.data)).catch(() => {});
  }, [fy]);

  // The topbar financial-year selector drives this page (accounting only).
  useEffect(() => {
    const onFy = () => setFy(getActiveFY());
    window.addEventListener('pos:financial-year', onFy);
    window.addEventListener('storage', onFy);
    return () => {
      window.removeEventListener('pos:financial-year', onFy);
      window.removeEventListener('storage', onFy);
    };
  }, []);

  useEffect(() => { load(); }, [load]);

  const today = new Date().toISOString().slice(0, 10);
  const defaultDate = today >= fy.from && today <= fy.to ? today : fy.from;

  return (
    <div>
      <div className="flex-between mb-16">
        <h2>Accounts</h2>
        <span className="badge badge-info" title={`1 Apr ${fy.startYear} – 31 Mar ${fy.endYear}`}>
          📅 FY {fy.key} (Apr–Mar)
        </span>
      </div>

      <div className="kpi-grid mb-16">
        <StatCard label={`Income (FY ${fy.key})`} value={summary ? money(summary.income) : '—'} tone="success" icon="📥" />
        <StatCard label={`Expense (FY ${fy.key})`} value={summary ? money(summary.expense) : '—'} tone="danger" icon="📤" />
        <StatCard label={`Net (FY ${fy.key})`} value={summary ? money(summary.net) : '—'} tone="primary" icon="💰" />
        <StatCard label="All-time net" value={summary ? money((summary.allTimeIncome || 0) - (summary.allTimeExpense || 0)) : '—'} icon="📊" />
      </div>

      {summary && summary.byCategory?.length > 0 && (
        <div className="mb-16 muted small">
          Top categories (FY {fy.key}): {summary.byCategory.slice(0, 6).map((c) => `${c.category} (${c.type}) ${money(c.amount)}`).join(' · ')}
        </div>
      )}

      <CrudPage
        key={fy.key}
        endpoint="/accounts/entries"
        title={`Income & Expenses · FY ${fy.key}`}
        params={{ from: fy.from, to: fy.to }}
        searchPlaceholder="Search party / reference / note…"
        emptyForm={{ type: 'expense', category: '', amount: '', date: defaultDate, paymentMode: 'cash', party: '', reference: '', note: '' }}
        toForm={(r) => ({
          type: r.type || 'expense', category: r.category || '', amount: r.amount ?? '',
          date: r.date ? String(r.date).slice(0, 10) : '', paymentMode: r.paymentMode || 'cash',
          party: r.party || '', reference: r.reference || '', note: r.note || '',
        })}
        toPayload={(f) => ({ ...f, amount: Number(f.amount) || 0 })}
        columns={[
          { key: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
          { key: 'type', label: 'Type', render: (r) => <Badge tone={r.type === 'income' ? 'success' : 'danger'}>{r.type}</Badge> },
          { key: 'category', label: 'Category' },
          { key: 'party', label: 'Party' },
          { key: 'paymentMode', label: 'Mode' },
          { key: 'amount', label: 'Amount', align: 'right', render: (r) => <b style={{ color: r.type === 'income' ? '#16a34a' : '#dc2626' }}>{money(r.amount)}</b> },
        ]}
        fields={[
          { key: 'type', label: 'Type *', type: 'select', options: [{ value: 'income', label: 'Income' }, { value: 'expense', label: 'Expense' }] },
          { key: 'category', label: 'Category' },
          { key: 'amount', label: 'Amount *', type: 'number' },
          { key: 'date', label: 'Date', type: 'date' },
          { key: 'paymentMode', label: 'Payment mode', type: 'select', options: [{ value: 'cash', label: 'Cash' }, { value: 'upi', label: 'UPI' }, { value: 'card', label: 'Card' }, { value: 'bank', label: 'Bank' }] },
          { key: 'party', label: 'Party / Vendor' },
          { key: 'reference', label: 'Reference' },
          { key: 'note', label: 'Note', type: 'textarea' },
        ]}
      />
    </div>
  );
}
