import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { Card, StatCard, Badge, Spinner, EmptyState, Pagination } from '../components/ui';

const LIMIT = 50;

function when(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AuditLog() {
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [outcome, setOutcome] = useState('');
  const [summary, setSummary] = useState(null);
  const [detail, setDetail] = useState(null);
  const { toast } = useToast();

  const load = useCallback(() => {
    const params = { page, limit: LIMIT };
    if (search) params.search = search;
    if (outcome) params.outcome = outcome;
    api.get('/audit', { params })
      .then((r) => { setRows(r.data.data || []); setTotal(r.data.total || 0); })
      .catch((e) => { setRows([]); toast(e.message, 'error'); });
  }, [page, search, outcome]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadSummary = useCallback(() => {
    api.get('/audit/summary').then((r) => setSummary(r.data.data)).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadSummary(); }, [loadSummary]);

  useEffect(() => { setPage(1); }, [search, outcome]);

  return (
    <div>
      <div className="flex-between mb-16">
        <h2>Edit Log</h2>
      </div>

      <div className="kpi-grid mb-16">
        <StatCard label="Total events" value={summary?.total ?? '—'} icon="📝" />
        <StatCard label="Successful" value={summary?.success ?? '—'} tone="success" icon="✅" />
        <StatCard label="Failed" value={summary?.failure ?? '—'} tone="danger" icon="⛔" />
      </div>

      {summary?.byAction?.length > 0 && (
        <div className="mb-16 flex gap-8" style={{ flexWrap: 'wrap' }}>
          {summary.byAction.slice(0, 8).map((a) => (
            <Badge key={a.action} tone="info">{a.action} · {a.count}</Badge>
          ))}
        </div>
      )}

      <Card>
        <div className="flex gap-8 mb-16" style={{ flexWrap: 'wrap', maxWidth: 640 }}>
          <input
            className="input"
            placeholder="Search action / entity / user…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="input" style={{ maxWidth: 160 }} value={outcome} onChange={(e) => setOutcome(e.target.value)}>
            <option value="">All outcomes</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
          </select>
        </div>

        {rows === null ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <EmptyState icon="📝" title="No log entries" sub="Administrative and edit actions will appear here." />
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>IP</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r._id} onClick={() => setDetail(r)} style={{ cursor: 'pointer' }}>
                    <td>{when(r.createdAt)}</td>
                    <td>{r.userName || 'System'}</td>
                    <td><code>{r.action}</code></td>
                    <td>{r.entity || '—'}{r.entityId ? ` #${r.entityId}` : ''}</td>
                    <td className="muted small">{r.ip || '—'}</td>
                    <td><Badge tone={r.outcome === 'failure' ? 'danger' : 'success'}>{r.outcome}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} total={total} limit={LIMIT} onPage={setPage} />
          </>
        )}
      </Card>

      {detail && (
        <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && setDetail(null)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Edit log detail</div>
              <button className="modal-close" onClick={() => setDetail(null)}>×</button>
            </div>
            <div className="mb-8"><b>{detail.action}</b> on <b>{detail.entity || 'n/a'}</b></div>
            <div className="muted small mb-8">By {detail.userName || 'System'} · {when(detail.createdAt)} · {detail.ip || '—'}</div>
            <pre className="code-block" style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(detail.meta || {}, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
