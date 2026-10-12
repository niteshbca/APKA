import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { Badge } from '../components/ui';
import CrudPage from '../components/CrudPage';

const pretty = (s) => String(s).replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function Masters() {
  const [types, setTypes] = useState([]);
  const [type, setType] = useState('');

  useEffect(() => {
    api.get('/masters/types').then((r) => {
      const t = r.data.data || [];
      setTypes(t);
      if (t.length) setType(t[0].key);
    }).catch(() => {});
  }, []);

  const meta = types.find((t) => t.key === type);
  const extraFields = meta?.fields || [];

  const emptyForm = { name: '', code: '', description: '', active: 'true', ...Object.fromEntries(extraFields.map((f) => [f, ''])) };
  const toForm = (r) => ({ name: r.name || '', code: r.code || '', description: r.description || '', active: String(r.active !== false), ...Object.fromEntries(extraFields.map((f) => [f, (r.data && r.data[f]) || ''])) });
  const toPayload = (f) => ({
    name: f.name, code: f.code, description: f.description, active: f.active === 'true',
    data: Object.fromEntries(extraFields.map((k) => [k, f[k]])),
  });

  return (
    <div>
      <div className="flex-between mb-16">
        <h2>Master Data</h2>
        <select className="input" style={{ maxWidth: 320 }} value={type} onChange={(e) => setType(e.target.value)}>
          {types.map((t) => <option key={t.key} value={t.key}>{t.domain} — {t.label}</option>)}
        </select>
      </div>

      {!type ? (
        <p className="muted">Loading master types…</p>
      ) : (
        <CrudPage
          key={type}
          endpoint={`/masters/${type}`}
          title={meta?.label || 'Records'}
          addLabel={`Add ${meta?.label || 'Record'}`}
          searchPlaceholder="Search name / code…"
          emptyForm={emptyForm}
          toForm={toForm}
          toPayload={toPayload}
          columns={[
            { key: 'name', label: 'Name', render: (r) => <b>{r.name}</b> },
            { key: 'code', label: 'Code' },
            { key: 'description', label: 'Description' },
            { key: 'active', label: 'Active', render: (r) => <Badge tone={r.active ? 'success' : 'neutral'}>{r.active ? 'Active' : 'Inactive'}</Badge> },
          ]}
          fields={[
            { key: 'name', label: 'Name *' },
            { key: 'code', label: 'Code' },
            { key: 'description', label: 'Description' },
            ...extraFields.map((f) => ({ key: f, label: pretty(f) })),
            { key: 'active', label: 'Active', type: 'select', options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }] },
          ]}
        />
      )}
    </div>
  );
}
