import { useEffect, useId, useRef, useState } from 'react';
import { useI18n } from '../i18n';

/** Snap an 8-bit channel to what the SNES can store (5 bits -> 0, 8, ... 248) */
const snap = (v) => Math.max(0, Math.min(31, Math.round((Number(v) || 0) / 8))) * 8;

const toHex = ({ r, g, b }) =>
  '#' + [r, g, b].map((c) => Math.min(255, c).toString(16).padStart(2, '0')).join('');

const parseHex = (text) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(text.trim());
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
};

/**
 * Colour card (preview + picker + hex + R/G/B) for 8-bit `{r, g, b}` colours.
 *
 * Every field keeps a local draft and only calls `onCommit({r, g, b})` once:
 * - picker: on the native `change` event (picker closed), not on every drag step
 * - hex / R / G / B: on Enter or blur; an invalid value reverts
 * so a single edit is a single undo step, and partial input ("#F", "") is allowed.
 * Values are snapped to the SNES 5-bit grid so the UI shows what the ROM stores.
 */
export default function ColorEditorCard({ label, color, onCommit }) {
  const { t } = useI18n();
  const id = useId();
  const committedHex = toHex(color);

  const [pickerValue, setPickerValue] = useState(committedHex);
  const [hexDraft, setHexDraft] = useState(committedHex.toUpperCase());
  const [rgbDraft, setRgbDraft] = useState({ r: color.r, g: color.g, b: color.b });
  const pickerRef = useRef(null);

  // Re-sync drafts when the colour changes from outside (undo, template, team switch)
  useEffect(() => {
    setPickerValue(committedHex);
    setHexDraft(committedHex.toUpperCase());
    setRgbDraft({ r: color.r, g: color.g, b: color.b });
  }, [committedHex, color.r, color.g, color.b]);

  const latest = useRef({ color, onCommit });
  latest.current = { color, onCommit };

  const commit = (rgb) => {
    const next = { r: snap(rgb.r), g: snap(rgb.g), b: snap(rgb.b) };
    const cur = latest.current.color;
    if (next.r === cur.r && next.g === cur.g && next.b === cur.b) {
      // Nothing changed for the ROM: just normalise what the fields show
      const hex = toHex(cur);
      setPickerValue(hex);
      setHexDraft(hex.toUpperCase());
      setRgbDraft({ r: cur.r, g: cur.g, b: cur.b });
      return;
    }
    latest.current.onCommit(next);
  };

  // Native `change` fires once when the picker closes (React's onChange is `input`)
  useEffect(() => {
    const el = pickerRef.current;
    if (!el) return undefined;
    const onNativeChange = (e) => {
      const rgb = parseHex(e.target.value);
      if (rgb) commit(rgb);
    };
    el.addEventListener('change', onNativeChange);
    return () => el.removeEventListener('change', onNativeChange);
  }, []);

  // Escape blurs the field; the blur that follows must not commit the draft
  const skipBlur = useRef(false);

  const draftRgb = () => {
    const parsed = {};
    for (const ch of ['r', 'g', 'b']) {
      const n = parseInt(rgbDraft[ch], 10);
      parsed[ch] = Number.isNaN(n) ? color[ch] : n;
    }
    return parsed;
  };

  const commitHex = () => {
    if (skipBlur.current) {
      skipBlur.current = false;
      return;
    }
    const rgb = parseHex(hexDraft);
    if (rgb) commit(rgb);
    else setHexDraft(committedHex.toUpperCase());
  };

  const commitRgb = () => {
    if (skipBlur.current) {
      skipBlur.current = false;
      return;
    }
    commit(draftRgb());
  };

  const onKey = (fn) => (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      fn();
    } else if (e.key === 'Escape') {
      setHexDraft(committedHex.toUpperCase());
      setRgbDraft({ r: color.r, g: color.g, b: color.b });
      skipBlur.current = true;
      e.currentTarget.blur();
    }
  };

  // Live preview of whatever is being edited (picker open, hex or R/G/B typed)
  const hexParsed = parseHex(hexDraft);
  const rgbPreview = toHex(
    Object.fromEntries(Object.entries(draftRgb()).map(([k, v]) => [k, snap(v)])),
  );
  let previewHex = committedHex;
  if (pickerValue !== committedHex) previewHex = pickerValue;
  else if (hexParsed && toHex(hexParsed) !== committedHex) previewHex = toHex(hexParsed);
  else if (rgbPreview !== committedHex) previewHex = rgbPreview;

  return (
    <div className="color-editor-card">
      <div className="color-card-header">
        <span className="color-card-label">{label}</span>
        {color.r5 !== undefined && (
          <span className="color-card-5bit" title={t('colorSnesValue')}>
            ({color.r5}, {color.g5}, {color.b5})
          </span>
        )}
      </div>
      <div className="color-card-body">
        <div className="color-preview-large" style={{ backgroundColor: previewHex }} />
        <div className="color-controls">
          <div className="color-input-row">
            <input
              ref={pickerRef}
              type="color"
              value={pickerValue}
              onChange={(e) => setPickerValue(e.target.value)}
              onBlur={() => pickerValue !== committedHex && commit(parseHex(pickerValue))}
              className="color-picker"
              aria-label={`${label} - ${t('colorPicker')}`}
            />
            <input
              type="text"
              value={hexDraft}
              onChange={(e) => setHexDraft(e.target.value.toUpperCase())}
              onBlur={commitHex}
              onKeyDown={onKey(commitHex)}
              className="color-hex-input"
              maxLength={7}
              spellCheck={false}
              aria-label={`${label} - hex`}
            />
          </div>
          <div className="color-rgb-row">
            {['r', 'g', 'b'].map((ch) => (
              <div key={ch} className="rgb-field">
                <label htmlFor={`${id}-${ch}`}>{ch.toUpperCase()}:</label>
                <input
                  id={`${id}-${ch}`}
                  type="number"
                  min={0}
                  max={248}
                  step={8}
                  value={rgbDraft[ch]}
                  onChange={(e) => setRgbDraft((d) => ({ ...d, [ch]: e.target.value }))}
                  onBlur={commitRgb}
                  onKeyDown={onKey(commitRgb)}
                  className="input-rgb"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
