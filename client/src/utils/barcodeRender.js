import QRCode from 'qrcode';

/**
 * Retail barcode + QR rendering helpers.
 *
 * We deliberately do NOT invent barcodes. A product's own barcode is rendered
 * as EAN-13 only when it is a genuine 13-digit, checksum-valid GTIN; otherwise
 * it is rendered as Code 128 (which can encode any alphanumeric SKU/batch).
 *
 * Everything returns a self-contained inline SVG string so labels can be
 * dropped into a print window or rendered in React via dangerouslySetInnerHTML.
 */

const EAN_L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const EAN_G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const EAN_R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
const EAN_PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

// Code 128 element widths (indices 0..106: values, StartA=103, StartB=104, StartC=105, Stop=106).
const CODE128 = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

export function ean13CheckDigit(twelve) {
  const digits = String(twelve).replace(/\D/g, '');
  if (digits.length !== 12) return null;
  let sum = 0;
  for (let i = 0; i < 12; i += 1) sum += Number(digits[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10;
}

export function isValidEan13(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length !== 13) return false;
  return Number(digits[12]) === ean13CheckDigit(digits.slice(0, 12));
}

export function classifyBarcode(value) {
  const raw = String(value || '').trim();
  if (!raw) return { format: 'none', validEan: false };
  if (/^\d{13}$/.test(raw) && isValidEan13(raw)) return { format: 'ean13', validEan: true };
  return { format: 'code128', validEan: false };
}

/** Turns Code 128 / EAN element-width strings into a '1'/'0' module string. */
function widthsToModules(widths) {
  let out = '';
  let bar = true;
  for (const ch of widths) {
    const n = Number(ch);
    out += (bar ? '1' : '0').repeat(n);
    bar = !bar;
  }
  return out;
}

function ean13Modules(value) {
  const digits = String(value).replace(/\D/g, '');
  const parity = EAN_PARITY[Number(digits[0])];
  let bits = '101';
  for (let i = 1; i <= 6; i += 1) {
    const d = Number(digits[i]);
    bits += parity[i - 1] === 'L' ? EAN_L[d] : EAN_G[d];
  }
  bits += '01010';
  for (let i = 7; i <= 12; i += 1) bits += EAN_R[Number(digits[i])];
  bits += '101';
  return bits;
}

function code128Modules(value) {
  const text = String(value);
  let checksum = 104; // Start B
  let bits = widthsToModules(CODE128[104]);
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i) - 32;
    const safe = code >= 0 && code <= 94 ? code : 0;
    checksum += safe * (i + 1);
    bits += widthsToModules(CODE128[safe]);
  }
  bits += widthsToModules(CODE128[checksum % 103]);
  bits += widthsToModules(CODE128[106]); // Stop
  return { bits, text };
}

function modulesToSvg(bits, { moduleWidth = 2, height = 60, quietModules = 10, text = '', fontSize = 12 }) {
  const totalModules = bits.length + quietModules * 2;
  const width = totalModules * moduleWidth;
  let rects = '';
  let x = quietModules * moduleWidth;
  let i = 0;
  while (i < bits.length) {
    if (bits[i] === '1') {
      let run = 1;
      while (bits[i + run] === '1') run += 1;
      rects += `<rect x="${x}" y="0" width="${run * moduleWidth}" height="${height}" fill="#000"/>`;
      x += run * moduleWidth;
      i += run;
    } else {
      x += moduleWidth;
      i += 1;
    }
  }
  const textHeight = text ? fontSize + 4 : 0;
  const label = text
    ? `<text x="${width / 2}" y="${height + fontSize + 1}" font-family="monospace" font-size="${fontSize}" text-anchor="middle" fill="#000">${text}</text>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height + textHeight}" viewBox="0 0 ${width} ${height + textHeight}"><rect width="100%" height="100%" fill="#fff"/>${rects}${label}</svg>`;
}

/**
 * Renders the best barcode for a value.
 * options: { moduleWidth, height, showText, text }
 */
export function barcodeSvg(value, options = {}) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const cls = classifyBarcode(raw);
  const opts = { moduleWidth: 2, height: 60, text: options.showText === false ? '' : raw, ...options };
  if (cls.format === 'ean13') {
    return modulesToSvg(ean13Modules(raw), { moduleWidth: 2, height: 64, quietModules: 11, fontSize: 12, ...opts });
  }
  const { bits } = code128Modules(raw);
  return modulesToSvg(bits, { moduleWidth: 2, height: 60, quietModules: 10, fontSize: 11, ...opts });
}

export function ean13Svg(value, options = {}) {
  const digits = String(value).replace(/\D/g, '');
  if (digits.length !== 13) return '';
  const opts = { moduleWidth: 2, height: 64, quietModules: 11, text: options.showText === false ? '' : digits, fontSize: 12, ...options };
  return modulesToSvg(ean13Modules(digits), opts);
}

export function code128Svg(value, options = {}) {
  const { bits } = code128Modules(String(value));
  const opts = { moduleWidth: 2, height: 60, quietModules: 10, text: options.showText === false ? '' : String(value), fontSize: 11, ...options };
  return modulesToSvg(bits, opts);
}

/** Returns an inline SVG QR code string (synchronous-friendly via promise). */
export async function qrSvg(text, options = {}) {
  try {
    return await QRCode.toString(String(text), {
      type: 'svg',
      margin: 0,
      errorCorrectionLevel: options.level || 'M',
      width: options.width || 120,
      color: { dark: '#000000', light: '#ffffff' },
    });
  } catch {
    return '';
  }
}

export async function qrDataUrl(text, options = {}) {
  try {
    return await QRCode.toDataURL(String(text), {
      margin: 0,
      errorCorrectionLevel: options.level || 'M',
      width: options.width || 160,
    });
  } catch {
    return '';
  }
}
