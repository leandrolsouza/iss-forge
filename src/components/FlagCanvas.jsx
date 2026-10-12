import { useEffect, useMemo, useRef } from 'react';
import { colorToRaw, renderIndexed, paintCanvas } from '../rom/snesRender';
import '../styles/player-preview.css';

/**
 * A team flag as the game draws it: the 24x16 design with the 4 flag colours
 * (index 0 is transparent).
 * @param {{ grid: number[][], colors: object[], scale?: number, label?: string }} props
 */
export default function FlagCanvas({ grid, colors, scale = 6, label }) {
  const ref = useRef(null);
  const image = useMemo(() => {
    if (!Array.isArray(grid) || !grid.length) return null;
    return renderIndexed(grid, [0, ...(colors || []).map(colorToRaw)]);
  }, [grid, colors]);

  useEffect(() => {
    if (image) paintCanvas(ref.current, image);
  }, [image]);

  if (!image) return null;
  return (
    <canvas
      ref={ref}
      className="flag-preview-canvas"
      style={{ width: image.width * scale, height: image.height * scale }}
      role="img"
      aria-label={label}
    />
  );
}
