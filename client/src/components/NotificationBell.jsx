import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useBranch } from '../context/BranchContext';
import { useAuth } from '../context/AuthContext';

/**
 * Navbar notification bell.
 * Shows a live badge: unread successful notifications (cleared when the
 * Notifications page is opened) plus failures that stay until resolved.
 * Blinks while a notification is being sent (see utils/notify.js).
 */
export default function NotificationBell({ className = 'icon-btn' }) {
  const navigate = useNavigate();
  const { activeBranch } = useBranch();
  const { hasPermission } = useAuth();
  const canSee = hasPermission('settings.view');

  const [summary, setSummary] = useState({ unread: 0, failed: 0, total: 0 });
  const [pulse, setPulse] = useState(false);
  const pulseTimer = useRef(null);

  useEffect(() => {
    if (!canSee) return undefined;
    let alive = true;

    const load = async () => {
      try {
        const r = await api.get('/notifications/summary', { params: { branch: activeBranch?._id } });
        if (alive) setSummary(r.data?.data || { unread: 0, failed: 0, total: 0 });
      } catch {
        /* offline — keep last value */
      }
    };

    load();
    const t = setInterval(load, 15000);

    const onRefresh = () => load();
    const onPending = () => {
      setPulse(true);
      clearTimeout(pulseTimer.current);
      pulseTimer.current = setTimeout(() => setPulse(false), 6000);
    };
    window.addEventListener('pos:notify', onRefresh);
    window.addEventListener('pos:notify-pending', onPending);

    return () => {
      alive = false;
      clearInterval(t);
      clearTimeout(pulseTimer.current);
      window.removeEventListener('pos:notify', onRefresh);
      window.removeEventListener('pos:notify-pending', onPending);
    };
  }, [canSee, activeBranch?._id]);

  if (!canSee) return null;

  const count = summary.total || 0;
  const hasFailed = (summary.failed || 0) > 0;

  return (
    <button
      type="button"
      className={`${className} notif-bell ${pulse ? 'notif-sending' : ''}`}
      title={count > 0
        ? `${count} new notification${count > 1 ? 's' : ''}${hasFailed ? ` · ${summary.failed} failed` : ''}`
        : 'Notifications'}
      onClick={() => navigate('/notifications')}
    >
      🔔
      {count > 0 && (
        <span className={`notif-badge ${hasFailed ? 'danger' : 'success'}`}>{count > 99 ? '99+' : count}</span>
      )}
    </button>
  );
}
