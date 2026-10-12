import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';
import { Card, Button, Badge, Spinner } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { useModules } from '../context/ModulesContext';

export default function Modules() {
  const { toast } = useToast();
  const { reload } = useModules();
  const [registry, setRegistry] = useState([]);
  const [enabled, setEnabled] = useState([]);
  const [platform, setPlatform] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/modules');
      setRegistry(res.data.data.registry || []);
      setEnabled(res.data.data.enabled || []);
      setPlatform(!!res.data.data.platform);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (key) => {
    setEnabled((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/modules', { enabledModules: enabled });
      toast('Modules updated', 'success');
      await reload();
    } catch (err) {
      toast(err.response?.data?.message || err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const groups = registry.reduce((acc, m) => {
    const g = m.group || 'Other';
    (acc[g] = acc[g] || []).push(m);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex-between mb-16">
        <h2>Modules</h2>
        {!platform && (
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Button>
        )}
      </div>

      <Card>
        {platform ? (
          <Badge tone="info">Platform administrator — all modules are always enabled.</Badge>
        ) : (
          <p className="muted small mb-16">
            Turn capabilities on or off for your business. Changes apply to every user and device
            immediately.
          </p>
        )}

        {loading ? (
          <Spinner />
        ) : (
          Object.entries(groups).map(([group, mods]) => (
            <div key={group} className="mb-16">
              <div className="muted small" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, margin: '12px 0 8px' }}>
                {group}
              </div>
              <div className="grid-2">
                {mods.map((m) => {
                  const on = platform || enabled.includes(m.key) || enabled.length === 0;
                  return (
                    <label
                      key={m.key}
                      className="flex gap-8"
                      style={{
                        alignItems: 'center',
                        padding: '10px 12px',
                        border: '1px solid var(--border, #e5e7eb)',
                        borderRadius: 10,
                        cursor: platform ? 'default' : 'pointer',
                      }}
                    >
                      <input type="checkbox" checked={on} disabled={platform} onChange={() => toggle(m.key)} />
                      <span style={{ fontSize: 18 }}>{m.icon}</span>
                      <span style={{ fontWeight: 600 }}>{m.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
