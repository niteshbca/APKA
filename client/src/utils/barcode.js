import { useRef, useEffect } from 'react';

/**
 * Barcode scanners emulate a keyboard typing the code followed by Enter.
 * This hook buffers fast keystrokes and fires onScan when the terminator
 * key is pressed (or a 60ms gap elapses).
 */
export function useBarcodeScanner(onScan, { timeout = 60 } = {}) {
  const bufferRef = useRef('');
  const timerRef = useRef(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter') {
        const code = bufferRef.current;
        if (code && onScanRef.current) {
          onScanRef.current(code);
        }
        bufferRef.current = '';
        if (timerRef.current) clearTimeout(timerRef.current);
        return;
      }
      if (e.key.length === 1) {
        bufferRef.current += e.key;
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          if (bufferRef.current && onScanRef.current) onScanRef.current(bufferRef.current);
          bufferRef.current = '';
        }, timeout);
      }
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [timeout]);
}

export function looksLikeBarcode(value) {
  return /^[0-9]{8,14}$/.test(String(value).trim());
}
