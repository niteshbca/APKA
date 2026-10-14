import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { Card, StatCard, Badge, Spinner, EmptyState } from '../components/ui';
import { money } from '../utils/format';

const today = () => new Date().toISOString().slice(0, 10);
const daysAgoStr = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

export default function WorkReports() {
  const [data, setData] = useState(null);
  const [from, setFrom] = useState(daysAgoStr(29));
  const [to, setTo] = useState(today());
  const { toast } = useToast();

  const load = useCallback(() => {
    api.get('/work-reports', { params: { from, to } })
      .then((r) => setData(r.data.data))
      .catch((e) => toast(e.message, 'error'));
  }, [from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const att = data?.attendance;

  return (
    <div>
      <div className="flex-between mb-16" style={{ flexWrap: 'wrap', gap: 12 }}>
        <h2>Work Reports</h2>
        <div className="flex gap-8" style={{ alignItems: 'center' }}>
          <input type="date" className="input" style={{ maxWidth: 160 }} value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="muted small">to</span>
          <input type="date" className="input" style={{ maxWidth: 160 }} value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {!data ? (
        <Spinner />
      ) : (
        <>
          <div className="kpi-grid mb-16">
            <StatCard label="Tasks open" value={data.tasks.byStatus.pending + data.tasks.byStatus.in_progress} sub={`${data.tasks.byStatus.done} done`} tone="warning" icon="✅" />
            <StatCard label="Overdue tasks" value={data.tasks.overdue} tone="danger" icon="⚠️" />
            <StatCard label="Sales" value={money(data.sales.total)} sub={`${data.sales.orders} orders`} tone="success" icon="💰" />
            <StatCard label="Present days" value={att.present} sub={`${att.absent} absent · ${att.leave} leave`} icon="🧑💼" />
          </div>

          <div className="grid-2">
            <Card title="Tasks by assignee">
              {data.tasks.byAssignee.length === 0 ? (
                <EmptyState icon="✅" title="No tasks" />
              ) : (
                <table className="table">
                  <thead><tr><th>Assignee</th><th style={{ textAlign: 'right' }}>Total</th><th style={{ textAlign: 'right' }}>Done</th></tr></thead>
                  <tbody>
                    {data.tasks.byAssignee.map((a) => (
                      <tr key={a.assignedTo}>
                        <td>{a.assignedTo}</td>
                        <td style={{ textAlign: 'right' }}>{a.total}</td>
                        <td style={{ textAlign: 'right' }}>{a.done}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            <Card title="Sales by cashier">
              {data.sales.byCashier.length === 0 ? (
                <EmptyState icon="🧾" title="No sales in range" />
              ) : (
                <table className="table">
                  <thead><tr><th>Cashier</th><th style={{ textAlign: 'right' }}>Orders</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
                  <tbody>
                    {data.sales.byCashier.map((s) => (
                      <tr key={s.cashierName}>
                        <td>{s.cashierName}</td>
                        <td style={{ textAlign: 'right' }}>{s.orders}</td>
                        <td style={{ textAlign: 'right' }}>{money(s.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            <Card title="Attendance by staff">
              {data.attendance.byEmployee.length === 0 ? (
                <EmptyState icon="🧑💼" title="No attendance in range" />
              ) : (
                <table className="table">
                  <thead><tr><th>Staff</th><th style={{ textAlign: 'right' }}>Present</th><th style={{ textAlign: 'right' }}>Leave</th><th style={{ textAlign: 'right' }}>Absent</th></tr></thead>
                  <tbody>
                    {data.attendance.byEmployee.map((e) => (
                      <tr key={e.employeeName}>
                        <td>{e.employeeName}</td>
                        <td style={{ textAlign: 'right' }}>{e.present}</td>
                        <td style={{ textAlign: 'right' }}>{e.leave}</td>
                        <td style={{ textAlign: 'right' }}>{e.absent}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            <Card title="Activity">
              <div className="mb-16">
                <div className="muted small mb-8">Stock movements</div>
                <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
                  {data.activity.stock.length === 0 && <span className="muted small">No stock activity</span>}
                  {data.activity.stock.map((s) => (
                    <Badge key={s.type} tone="info">{s.type}: {s.count} ({s.qty} qty)</Badge>
                  ))}
                </div>
              </div>
              <div className="mb-16">
                <div className="muted small mb-8">Ledger</div>
                <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
                  {data.activity.ledger.length === 0 && <span className="muted small">No ledger entries</span>}
                  {data.activity.ledger.map((l) => (
                    <Badge key={l.type} tone={l.type === 'income' ? 'success' : 'danger'}>{l.type}: {money(l.total)} ({l.count})</Badge>
                  ))}
                </div>
              </div>
              <div>
                <div className="muted small mb-8">Campaigns</div>
                {data.activity.campaigns.length === 0 ? (
                  <span className="muted small">No campaigns</span>
                ) : (
                  <table className="table">
                    <thead><tr><th>Name</th><th>Channel</th><th>Status</th></tr></thead>
                    <tbody>
                      {data.activity.campaigns.map((c, i) => (
                        <tr key={i}>
                          <td>{c.name}</td>
                          <td>{c.channel}</td>
                          <td><Badge tone={c.status === 'sent' ? 'success' : c.status === 'failed' ? 'danger' : 'warning'}>{c.status}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
