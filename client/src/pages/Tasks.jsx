import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { Button, StatCard, Badge } from '../components/ui';
import CrudPage from '../components/CrudPage';
import { fmtDate } from '../utils/format';

export default function Tasks() {
  const [summary, setSummary] = useState(null);
  const { toast } = useToast();

  const load = useCallback(() => {
    api.get('/tasks/summary').then((r) => setSummary(r.data.data)).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (row, status, reload) => {
    try { await api.put(`/tasks/${row._id}`, { status }); toast('Updated', 'success'); reload(); load(); }
    catch (e) { toast(e.message, 'error'); }
  };

  return (
    <div>
      <h2 className="mb-16">Tasks</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }} className="mb-16">
        <StatCard label="Pending" value={summary?.pending ?? '—'} tone="warning" icon="⏳" />
        <StatCard label="In progress" value={summary?.inProgress ?? '—'} icon="🔄" />
        <StatCard label="Completed" value={summary?.done ?? '—'} tone="success" icon="✅" />
        <StatCard label="Overdue" value={summary?.overdue ?? '—'} tone="danger" icon="⚠️" />
      </div>

      <CrudPage
        endpoint="/tasks"
        title="All Tasks"
        addLabel="Add Task"
        searchPlaceholder="Search title / assignee…"
        onLoaded={load}
        emptyForm={{ title: '', description: '', assignedTo: '', priority: 'medium', status: 'pending', dueDate: '' }}
        toForm={(r) => ({
          title: r.title || '', description: r.description || '', assignedTo: r.assignedTo || '',
          priority: r.priority || 'medium', status: r.status || 'pending',
          dueDate: r.dueDate ? String(r.dueDate).slice(0, 10) : '',
        })}
        rowActions={(row, reload) => (
          <>
            {row.status === 'pending' && <Button size="sm" variant="ghost" onClick={() => setStatus(row, 'in_progress', reload)}>Start</Button>}
            {row.status !== 'done' && <Button size="sm" variant="ghost" onClick={() => setStatus(row, 'done', reload)}>Done</Button>}
          </>
        )}
        columns={[
          { key: 'title', label: 'Task', render: (r) => <b style={{ textDecoration: r.status === 'done' ? 'line-through' : 'none' }}>{r.title}</b> },
          { key: 'assignedTo', label: 'Assigned to' },
          { key: 'priority', label: 'Priority', render: (r) => <Badge tone={r.priority === 'high' ? 'danger' : r.priority === 'low' ? 'neutral' : 'warning'}>{r.priority}</Badge> },
          { key: 'dueDate', label: 'Due', render: (r) => (r.dueDate ? fmtDate(r.dueDate) : '—') },
          { key: 'status', label: 'Status', render: (r) => <Badge tone={r.status === 'done' ? 'success' : r.status === 'in_progress' ? 'primary' : 'warning'}>{(r.status || '').replace('_', ' ')}</Badge> },
        ]}
        fields={[
          { key: 'title', label: 'Title *' },
          { key: 'description', label: 'Description', type: 'textarea' },
          { key: 'assignedTo', label: 'Assign to' },
          { key: 'priority', label: 'Priority', type: 'select', options: [{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }] },
          { key: 'status', label: 'Status', type: 'select', options: [{ value: 'pending', label: 'Pending' }, { value: 'in_progress', label: 'In progress' }, { value: 'done', label: 'Done' }] },
          { key: 'dueDate', label: 'Due date', type: 'date' },
        ]}
      />
    </div>
  );
}
