import React, { useEffect, useState } from 'react';
import { Modal, Button, Field } from '../ui';
import { money } from '../../utils/format';

const MODES = [
  { id: 'cash', label: '💵 Cash' },
  { id: 'upi', label: '📱 UPI' },
  { id: 'card', label: '💳 Card' },
];

export default function PaymentModal({ open, totals, onClose, onConfirm, submitting }) {
  const [mode, setMode] = useState('cash');
  const [received, setReceived] = useState('');

  useEffect(() => {
    if (open) {
      setMode('cash');
      setReceived(totals.total ? String(totals.total) : '');
    }
  }, [open, totals.total]);

  const receivedNum = Number(received) || 0;
  const change = mode === 'cash' ? Math.max(0, receivedNum - totals.total) : 0;

  return (
    <Modal
      open={open}
      title="Payment"
      onClose={onClose}
      width={480}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => onConfirm({ mode, amountReceived: mode === 'cash' ? receivedNum : totals.total, changeDue: change })}
            disabled={submitting || (mode === 'cash' && receivedNum < totals.total)}
          >
            {submitting ? 'Processing...' : `Confirm ${money(totals.total)}`}
          </Button>
        </>
      }
    >
      <div style={{ textAlign: 'center', marginBottom: 18 }}>
        <div className="muted small">Amount Due</div>
        <div style={{ fontSize: 34, fontWeight: 800 }}>{money(totals.total)}</div>
      </div>

      <div className="form-row" style={{ marginBottom: 14 }}>
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            style={{
              padding: '14px 10px',
              borderRadius: 10,
              border: `2px solid ${mode === m.id ? 'var(--primary)' : 'var(--border)'}`,
              background: mode === m.id ? 'var(--primary-light)' : '#fff',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'cash' && (
        <Field label={`Amount Received (Tender)`}>
          <input
            className="input"
            type="number"
            min="0"
            value={received}
            onChange={(e) => setReceived(e.target.value)}
            autoFocus
          />
        </Field>
      )}

      {mode === 'cash' && (
        <div className="flex-between" style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 10 }}>
          <span className="muted">Balance to return</span>
          <b style={{ color: change >= 0 ? 'var(--success)' : 'var(--danger)' }}>{money(change)}</b>
        </div>
      )}
      {mode !== 'cash' && (
        <div className="muted small">
          Collect the exact amount via {mode.toUpperCase()}. Enter transaction reference on the invoice if needed.
        </div>
      )}
    </Modal>
  );
}
