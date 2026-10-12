import { useMemo } from 'react';
import { useRom } from '../context/RomContext';
import { renderBoxText, renderFixedText, BOX_BACKGROUND } from '../rom/textRender';
import { encodeScenarioText } from '../rom/scenario';
import { layoutFixed } from '../rom/gameTexts';
import PixelCanvas from './PixelCanvas';

/**
 * A text drawn with the game's fonts, as it appears in its box.
 * @param {object} props
 * @param {'box'|'fixed'|'bytes'} props.kind - box: 8x8 ASCII text; fixed: 8x16 ISS text;
 *   bytes: already encoded 8x8 box bytes (FE colour codes included)
 * @param {string} [props.text]
 * @param {number[]} [props.bytes]
 * @param {{ lines: number, columns: number }} props.box
 * @param {'training'|'selection'} [props.palette]
 * @param {number} [props.scale]
 * @param {string} [props.label]
 */
export default function GameTextPreview({
  kind,
  text = '',
  bytes,
  box,
  palette = 'training',
  scale = 2,
  label,
}) {
  const { romParser } = useRom();
  const { lines, columns } = box;
  const image = useMemo(() => {
    if (!romParser) return null;
    const opts = { lines, columns, palette, background: BOX_BACKGROUND };
    if (kind === 'fixed')
      return renderFixedText(romParser, layoutFixed(text, lines, columns).codes, opts);
    const data = kind === 'bytes' ? bytes : encodeScenarioText(text, columns).bytes;
    return renderBoxText(romParser, data || [], opts);
  }, [romParser, kind, text, bytes, lines, columns, palette]);

  return <PixelCanvas image={image} scale={scale} label={label} className="game-text-canvas" />;
}
