import { useEffect, useRef, useState } from 'react';
import { rawToHex, hexToRaw } from '../rom/palettes';
import '../styles/match-palettes.css';

/**
 * Color input that commits on the native `change` event (fired when the picker
 * is closed / confirmed) instead of on every `input`, so dragging inside the
 * picker creates a single undo step. Blur and Enter are fallbacks.
 * Colours are raw SNES 15-bit values.
 */
export function ColorSwatch({ raw, onCommit, title }) {
  const [value, setValue] = useState(rawToHex(raw));
  const ref = useRef(null);
  const latest = useRef({ raw, onCommit });
  latest.current = { raw, onCommit };
  useEffect(() => setValue(rawToHex(raw)), [raw]);

  const commitHex = (hex) => {
    const v = hexToRaw(hex);
    if (v !== null && v !== latest.current.raw) latest.current.onCommit(v);
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const onNativeChange = (e) => commitHex(e.target.value);
    el.addEventListener('change', onNativeChange);
    return () => el.removeEventListener('change', onNativeChange);
  }, []);

  return (
    <input
      ref={ref}
      type="color"
      className="mp-swatch"
      value={value}
      title={title || value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => commitHex(value)}
      onKeyDown={(e) => e.key === 'Enter' && commitHex(value)}
    />
  );
}

/** A row of colour swatches; `onChange(index, raw)` gets the index in the full palette */
export function SwatchRow({ colors, onChange, offset = 0, label }) {
  return (
    <div className="mp-swatch-row">
      {label && <span className="mp-swatch-label">{label}</span>}
      {colors.map((raw, i) => (
        <ColorSwatch
          key={i}
          raw={raw}
          title={`#${offset + i + 1} ${rawToHex(raw)}`}
          onCommit={(v) => onChange(offset + i, v)}
        />
      ))}
    </div>
  );
}
