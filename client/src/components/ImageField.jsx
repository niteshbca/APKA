import React, { useRef } from 'react';
import { fileToDataUrl } from '../utils/image';

/**
 * Reusable product/category image picker. Supports pasting an image URL or
 * uploading a file (converted to a compact data URL). Shows a live preview.
 */
export default function ImageField({ label = 'Image', value, onChange, toast }) {
  const inputRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      onChange(dataUrl);
    } catch (err) {
      toast?.(err.message, 'error');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="field">
      {label && <label>{label}</label>}
      <div className="image-field">
        <div className="image-preview">
          {value ? (
            <img src={value} alt="preview" />
          ) : (
            <span className="image-preview-empty">🖼️</span>
          )}
        </div>
        <div className="image-field-controls">
          <input
            className="input"
            placeholder="Paste image URL or upload…"
            value={value && !value.startsWith('data:') ? value : ''}
            onChange={(e) => onChange(e.target.value)}
          />
          <div className="flex gap-8">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => inputRef.current?.click()}>📁 Upload</button>
            {value && (
              <button type="button" className="btn btn-danger btn-sm" onClick={() => onChange('')}>Remove</button>
            )}
          </div>
          <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
          {value && value.startsWith('data:') && <span className="muted small">Uploaded image ({Math.round(value.length / 1024)} KB)</span>}
        </div>
      </div>
    </div>
  );
}
