import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';
import { Card, Button, Badge, Spinner, Field } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { useModules } from '../context/ModulesContext';

export default function Modules() {
  const { toast } = useToast();
  const { reload } = useModules();
  const [registry, setRegistry] = useState([]);
  const [enabled, setEnabled] = useState([]);
  const [platform, setPlatform] = useState(false);
  const [tenants, setTenants] = useState([]);
  const [tenantId, setTenantId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const allKeys = (reg) => reg.map((m) => m.key);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/modules');
      const reg = res.data.data.registry || [];
      const isPlatform = !!res.data.data.platform;
      setRegistry(reg);
      setPlatform(isPlatform);

      if (isPlatform) {
        const listRes = await api.get('/tenants/platform/list', { params: { limit: 200 } });
        const list = listRes.data.data || [];
        setTenants(list);
        const preferred = list.find((t) => t.slug === 'default') || list[0];
        if (preferred) {
          setTenantId(preferred._id);
          setEnabled(preferred.enabledModules && preferred.enabledModules.length ? preferred.enabledModules : allKeys(reg));
        } else {
          setEnabled(allKeys(reg));
        }
      } else {
        const on = res.data.data.enabled || [];
        setEnabled(on.length ? on : allKeys(reg));
      }
    } catch (err) {
      toast(err.response?.data?.message || err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const pickTenant = (id) => {
    setTenantId(id);
    const t = tenants.find((x) => x._id === id);
    setEnabled(t && t.enabledModules && t.enabledModules.length ? t.enabledModules : allKeys(registry));
  };

  const toggle = (key) => {
    setEnabled((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const save = async () => {
    setSaving(true);
    try {
      if (platform) {
        if (!tenantId) {
          toast('Select a tenant first', 'error');
          return;
        }
        await api.put(`/tenants/platform/${tenantId}`, { enabledModules: enabled });
        setTenants((prev) => prev.map((t) => (t._id === tenantId ? { ...t, enabledModules: enabled } : t)));
        toast('Modules updated for tenant', 'success');
      } else {
        await api.put('/modules', { enabledModules: enabled });
        toast('Modules updated', 'success');
      }
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
        <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Button>
      </div>

      <Card>
        {platform ? (
          <>
            <Badge tone="info">Platform administrator — pick a business below to configure its modules.</Badge>
            <div className="mt-16" style={{ maxWidth: 360 }}>
              <Field label="Business / Tenant">
                <select className="select" value={tenantId} onChange={(e) => pickTenant(e.target.value)}>
                  {tenants.length === 0 && <option value="">No tenants</option>}
                  {tenants.map((t) => (
                    <option key={t._id} value={t._id}>{t.name} ({t.slug})</option>
                  ))}
                </select>
              </Field>
            </div>
          </>
        ) : (
          <p className="muted small">
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
                  const on = enabled.includes(m.key);
                  return (
                    <label
                      key={m.key}
                      className="flex gap-8"
                      style={{
                        alignItems: 'center',
                        padding: '10px 12px',
                        border: '1px solid var(--border, #e5e7eb)',
                        borderRadius: 10,
                        cursor: 'pointer',
                      }}
                    >
                      <input type="checkbox" checked={on} onChange={() => toggle(m.key)} />
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
