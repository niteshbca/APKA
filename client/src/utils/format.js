export const CURRENCY = '₹';

export function money(n) {
  const v = Number(n) || 0;
  return `${CURRENCY}${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function num(n) {
  return Number(n) || 0;
}

export function fmtDate(d) {
  if (!d) return '';
  const x = new Date(d);
  if (isNaN(x)) return '';
  return x.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateTime(d) {
  if (!d) return '';
  const x = new Date(d);
  if (isNaN(x)) return '';
  return `${fmtDate(x)} ${x.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
}

export function uid(prefix = '') {
  const s = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return prefix ? `${prefix}-${s}` : s;
}

export function shortDeviceId(deviceId) {
  if (!deviceId) return 'XXXX';
  return deviceId.replace(/[^A-Z0-9]/gi, '').slice(0, 4).toUpperCase();
}
