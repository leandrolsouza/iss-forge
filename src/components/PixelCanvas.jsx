import { useEffect, useRef } from 'react';
import { paintCanvas } from '../rom/snesRender';
import '../styles/player-preview.css';

/**
 * An RGBA image ({ width, height, data }) on a canvas, scaled up with crisp pixels.
 * @param {{ image: object|null, scale?: number, label?: string, className?: string }} props
 */
export default function PixelCanvas({ image, scale = 2, label, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    if (image) paintCanvas(ref.current, image);
  }, [image]);
  if (!image) return null;
  return (
    <canvas
      ref={ref}
      className={`pixel-canvas ${className}`}
      style={{ width: image.width * scale, height: image.height * scale }}
      role="img"
      aria-label={label}
    />
  );
}
