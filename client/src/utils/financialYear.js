const toISO = (d) => d.toISOString().slice(0, 10);

/**
 * Indian financial year runs 1 April → 31 March.
 * Returns a descriptor with a short key ("2025-26") and inclusive from/to dates.
 */
export function getFinancialYear(date = new Date()) {
  const d = new Date(date);
  const startYear = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  const endYear = startYear + 1;
  const start = new Date(Date.UTC(startYear, 3, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(endYear, 2, 31, 23, 59, 59, 999));
  return {
    key: `${startYear}-${String(endYear).slice(2)}`,
    startYear,
    endYear,
    from: toISO(start),
    to: toISO(end),
  };
}

/** Current FY first, then the previous `count` financial years. */
export function fyOptions(count = 6) {
  const current = getFinancialYear();
  const list = [];
  for (let i = 0; i < count; i += 1) {
    const probe = new Date(Date.UTC(current.startYear - i, 6, 1));
    list.push(getFinancialYear(probe));
  }
  return list;
}

const STORAGE_KEY = 'pos_financial_year';

/** The FY selected in the topbar (falls back to the current one). */
export function getActiveFY() {
  let saved = null;
  try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* ignore */ }
  const all = fyOptions();
  return all.find((f) => f.key === saved) || all[0];
}

/** Persists the selection and notifies every listening page. */
export function setActiveFY(key) {
  try { localStorage.setItem(STORAGE_KEY, key); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent('pos:financial-year', { detail: key }));
}
