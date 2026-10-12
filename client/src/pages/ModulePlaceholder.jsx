import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, EmptyState } from '../components/ui';
import { useModules } from '../context/ModulesContext';

export default function ModulePlaceholder() {
  const { key } = useParams();
  const navigate = useNavigate();
  const { registry, isEnabled } = useModules();
  const mod = registry.find((m) => m.key === key);

  if (!isEnabled(key)) {
    return (
      <div>
        <EmptyState icon="🔒" title="Module not enabled" sub="Turn this module on from the Modules page." />
        <div className="flex" style={{ justifyContent: 'center' }}>
          <Button onClick={() => navigate('/')}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex-between mb-16">
        <h2>{mod ? `${mod.icon} ${mod.label}` : 'Module'}</h2>
        <Button variant="ghost" onClick={() => navigate('/')}>Back</Button>
      </div>
      <Card>
        <EmptyState
          icon={mod?.icon || '🧩'}
          title={`${mod?.label || 'This module'} is enabled`}
          sub="This workspace is active for your business. The full screen for this module is being built and will arrive in an upcoming update."
        />
        <div className="muted small" style={{ textAlign: 'center', marginTop: 12 }}>
          Module key: <b>{key}</b>{mod?.group ? ` · ${mod.group}` : ''}
        </div>
      </Card>
    </div>
  );
}
