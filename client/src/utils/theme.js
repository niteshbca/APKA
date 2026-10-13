// Accent-colour system: one hex drives the whole software's brand colour by
// overriding CSS custom properties on <html>. Persisted in localStorage (instant,
// no flash) and mirrored to the business settings so it syncs across devices.

const DEFAULT = '#4f46e5';
const WHITE = { r: 255, g: 255, b: 255 };
const BLACK = { r: 0, g: 0, b: 0 };

export const ACCENTS = [
  { name: 'Indigo', value: '#4f46e5' },
  { name: 'Blue', value: '#2563eb' },
  { name: 'Sky', value: '#0284c7' },
  { name: 'Cyan', value: '#0891b2' },
  { name: 'Teal', value: '#0d9488' },
  { name: 'Green', value: '#16a34a' },
  { name: 'Lime', value: '#65a30d' },
  { name: 'Amber', value: '#d97706' },
  { name: 'Orange', value: '#ea580c' },
  { name: 'Red', value: '#dc2626' },
  { name: 'Rose', value: '#e11d48' },
  { name: 'Pink', value: '#db2777' },
  { name: 'Fuchsia', value: '#c026d3' },
  { name: 'Purple', value: '#9333ea' },
  { name: 'Violet', value: '#7c3aed' },
  { name: 'Slate', value: '#475569' },
];

function normalize(hex) {
  let h = String(hex || '').trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return DEFAULT;
  return '#' + h.toLowerCase();
}

function toRgb(hex) {
  const h = normalize(hex).slice(1);
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

function mix(a, b, t) {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

function toHex({ r, g, b }) {
  const c = (n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}

/** Applies a hex accent to the document and remembers it locally. */
export function applyAccent(hex) {
  const base = normalize(hex);
  const rgb = toRgb(base);
  const dark = mix(rgb, BLACK, 0.2);
  const light = mix(rgb, WHITE, 0.3);
  const root = document.documentElement.style;
  root.setProperty('--primary', base);
  root.setProperty('--primary-rgb', `${rgb.r},${rgb.g},${rgb.b}`);
  root.setProperty('--primary-dark', toHex(dark));
  root.setProperty('--primary-light', `rgba(${rgb.r},${rgb.g},${rgb.b},0.12)`);
  root.setProperty('--grad-primary', `linear-gradient(135deg, ${base} 0%, ${toHex(light)} 100%)`);
  root.setProperty('--ring', `0 0 0 4px rgba(${rgb.r},${rgb.g},${rgb.b},0.18)`);
  try { localStorage.setItem('pos_accent', base); } catch { /* ignore */ }
  return base;
}

/** The locally-saved accent (falls back to the default indigo). */
export function savedAccent() {
  try { return localStorage.getItem('pos_accent') || DEFAULT; } catch { return DEFAULT; }
}

export const DEFAULT_ACCENT = DEFAULT;
