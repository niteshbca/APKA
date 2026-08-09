import React from 'react';
import { money } from '../../utils/format';
import { lineTotal } from '../../utils/gst';

export default function CartTable({ items, onInc, onDec, onRemove, onSetLineDiscount }) {
  if (items.length === 0) {
    return (
      <div className="empty-state">
        <div className="icon">🛒</div>
        <div>Cart is empty</div>
        <div className="muted small mt-8">Search a product above or scan a barcode to add items</div>
      </div>
    );
  }
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Item</th>
          <th>Price</th>
          <th>Qty</th>
          <th>GST</th>
          <th>Disc</th>
          <th style={{ textAlign: 'right' }}>Total</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {items.map((it, i) => (
          <tr key={`${it.sku}-${i}`}>
            <td>
              <div style={{ fontWeight: 600 }}>{it.name}</div>
              <div className="muted small">{it.sku}</div>
            </td>
            <td>{money(it.price)}</td>
            <td>
              <div className="cart-qty">
                <button onClick={() => onDec(i)}>-</button>
                <span>{it.qty}</span>
                <button onClick={() => onInc(i)}>+</button>
              </div>
            </td>
            <td>{it.gstRate}%</td>
            <td>
              <input
                type="number"
                min="0"
                style={{ width: 70, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--border)' }}
                value={it.lineDiscount || 0}
                onChange={(e) => onSetLineDiscount(i, Number(e.target.value) || 0)}
              />
            </td>
            <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(lineTotal(it))}</td>
            <td>
              <button className="btn btn-danger btn-sm" onClick={() => onRemove(i)}>✕</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
