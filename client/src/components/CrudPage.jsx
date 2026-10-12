import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { Button, Card, Modal, Field, EmptyState, Spinner } from './ui';

/**
 * Generic list + create/edit/delete screen driven by a small config.
 * Used by the HR/Accounts/Tasks/Master modules so each screen stays declarative.
 */
export default function CrudPage({
  endpoint,
  columns,
  fields,
  title,
  addLabel = 'Add',
  emptyForm = {},
  toForm = (row) => ({ ...emptyForm, ...row }),
  toPayload = (form) => form,
  params = {},
  search = true,
  searchPlaceholder = 'Search…',
  canManage = true,
  rowActions,
  onLoaded,
}) {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState(null);
  const { toast } = useToast();
  const paramsKey = JSON.stringify(params);

  const load = useCallback(() => {
    const p = { ...params };
    if (q) p.search = q;
    api.get(endpoint, { params: p })
      .then((r) => {
        setRows(r.data.data || []);
        if (onLoaded) onLoaded(r.data);
      })
      .catch((e) => { setRows([]); toast(e.message, 'error'); });
  }, [endpoint, q, paramsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setForm({ ...emptyForm }); setEditingId(null); setShow(true); };
  const openEdit = (row) => { setForm(toForm(row)); setEditingId(row._id); setShow(true); };

  const save = async () => {
    if (canManage === false) return;
    try {
      const payload = toPayload(form);
      if (editingId) await api.put(`${endpoint}/${editingId}`, payload);
      else await api.post(endpoint, payload);
      toast('Saved', 'success');
      setShow(false);
      setForm({ ...emptyForm });
      setEditingId(null);
      load();
    } catch (e) { toast(e.message, 'error'); }
  };

  const remove = async (row) => {
    if (canManage === false) return;
    if (!window.confirm('Delete this record?')) return;
    try { await api.delete(`${endpoint}/${row._id}`); toast('Deleted', 'success'); load(); }
    catch (e) { toast(e.message, 'error'); }
  };

  const renderInput = (f) => {
    const value = form[f.key] === undefined || form[f.key] === null ? '' : form[f.key];
    const onChange = (e) => setForm({ ...form, [f.key]: e.target.value });
    if (f.type === 'select') {
      return (
        <select className="input" value={value} onChange={onChange}>
          {(f.options || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    }
    if (f.type === 'textarea') return <textarea className="input" rows={3} value={value} onChange={onChange} />;
    return <input className="input" type={f.type || 'text'} value={value} onChange={onChange} />;
  };

  return (
    <div>
      <div className="flex-between mb-16">
        <h2>{title}</h2>
        {canManage !== false && <Button onClick={openAdd}>+ {addLabel}</Button>}
      </div>
      <Card>
        {search && (
          <div className="mb-16" style={{ maxWidth: 320 }}>
            <input className="input" placeholder={searchPlaceholder} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        )}
        {rows === null ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <EmptyState icon="📋" title="Nothing here yet" sub={canManage !== false ? `Click "${addLabel}" to add the first record.` : undefined} />
        ) : (
          <table className="table">
            <thead>
              <tr>
                {columns.map((c) => <th key={c.key} style={c.align ? { textAlign: c.align } : undefined}>{c.label}</th>)}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row._id}>
                  {columns.map((c) => (
                    <td key={c.key} style={c.align ? { textAlign: c.align } : undefined}>
                      {c.render ? c.render(row) : (row[c.key] === undefined || row[c.key] === '' ? '—' : row[c.key])}
                    </td>
                  ))}
                  <td>
                    <div className="flex gap-8">
                      {rowActions && rowActions(row, load)}
                      {canManage !== false && <Button size="sm" variant="ghost" onClick={() => openEdit(row)}>Edit</Button>}
                      {canManage !== false && <Button size="sm" variant="danger" onClick={() => remove(row)}>Del</Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={show} title={editingId ? `Edit ${title}` : `${addLabel}`} onClose={() => setShow(false)} width={620}>
        {fields.map((f) => (
          <Field key={f.key} label={f.label}>{renderInput(f)}</Field>
        ))}
        <Button className="btn-block" onClick={save}>Save</Button>
      </Modal>
    </div>
  );
}
