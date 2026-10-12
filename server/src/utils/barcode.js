/**
 * Shared barcode helpers.
 *
 * We only ever treat a value as an EAN-13 when it is 13 digits AND passes the
 * EAN-13 checksum. Anything else (internal SKUs, serial numbers, non-numeric
 * codes) is rendered as Code 128. We NEVER invent a valid retail barcode from
 * arbitrary product data and we never duplicate a unique identifier.
 */
function isDigits(value) {
  return /^[0-9]+$/.test(String(value || '').trim());
}

function ean13CheckDigit(twelveDigits) {
  const d = String(twelveDigits).padStart(12, '0').slice(0, 12);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const n = Number(d[i]);
    sum += i % 2 === 0 ? n : n * 3;
  }
  return (10 - (sum % 10)) % 10;
}

function isValidEan13(code) {
  const s = String(code || '').trim();
  if (!/^[0-9]{13}$/.test(s)) return false;
  return Number(s[12]) === ean13CheckDigit(s.slice(0, 12));
}

/**
 * @returns {{ format: 'ean13'|'code128'|'none', value: string, validEan: boolean }}
 */
function classifyBarcode(code) {
  const s = String(code || '').trim();
  if (!s) return { format: 'none', value: '', validEan: false };
  if (isValidEan13(s)) return { format: 'ean13', value: s, validEan: true };
  return { format: 'code128', value: s, validEan: false };
}

module.exports = { isValidEan13, ean13CheckDigit, classifyBarcode, isDigits };
