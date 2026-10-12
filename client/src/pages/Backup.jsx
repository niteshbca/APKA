import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { Button, Card, Badge, Spinner, EmptyState } from '../components/ui';

function bytes(n) {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function when(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function Backup() {
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState('');
  const { toast } = useToast();

  const load = useCallback(() => {
    api.get('/backup')
      .then((r) => setRows(r.data.data || []))
      .catch((e) => { setRows([]); toast(e.message, 'error'); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setBusy('create');
    try {
      const r = await api.post('/backup');
      toast(`Backup created · ${r.data.data.documents} documents`, 'success');
      load();
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(''); }
  };

  const download = async (file) => {
    try {
      const r = await api.get(`/backup/${file}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = file;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) { toast(e.message, 'error'); }
  };

  const restore = async (file) => {
    if (!window.confirm('Restore this backup? Current company data for the backed-up collections will be replaced.')) return;
    setBusy(file);
    try {
      const r = await api.post(`/backup/${file}/restore`);
      toast(`Restored ${r.data.data.restored} documents`, 'success');
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(''); }
  };

  const remove = async (file) => {
    if (!window.confirm('Delete this backup file?')) return;
    try {
      await api.delete(`/backup/${file}`);
      toast('Backup deleted', 'success');
      load();
    } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <div>
      <div className="flex-between mb-16">
        <div>
          <h2>Backup & Restore</h2>
          <div className="muted small mt-8">Create a full JSON snapshot of this company's data. Restoring replaces the backed-up collections.</div>
        </div>
        <Button onClick={create} disabled={busy === 'create'}>
          {busy === 'create' ? 'Creating…' : '💾 Create Backup'}
        </Button>
      </div>

      <Card>
        {rows === null ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <EmptyState icon="💾" title="No backups yet" sub="Click “Create Backup” to take your first snapshot." />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Created</th>
                <th>By</th>
                <th style={{ textAlign: 'right' }}>Documents</th>
                <th style={{ textAlign: 'right' }}>Size</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.file}>
                  <td>{when(b.meta?.createdAt || b.modifiedAt)}</td>
                  <td>{b.meta?.createdBy || '—'}</td>
                  <td style={{ textAlign: 'right' }}>{b.meta?.documents ?? '—'}</td>
                  <td style={{ textAlign: 'right' }}>{bytes(b.size)}</td>
                  <td>
                    <div className="flex gap-8">
                      <Button size="sm" variant="ghost" onClick={() => download(b.file)}>Download</Button>
                      <Button size="sm" variant="ghost" disabled={busy === b.file} onClick={() => restore(b.file)}>
                        {busy === b.file ? 'Restoring…' : 'Restore'}
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => remove(b.file)}>Del</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <div className="muted small mt-16">
        <Badge tone="warning">Tip</Badge> Backups are stored on the server under <code>server/backups/</code>. Download a copy regularly to keep it safe.
      </div>
    </div>
  );
}
