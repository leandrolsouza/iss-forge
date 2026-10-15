import { useMemo } from 'react';
import { useRom } from '../context/RomContext';
import { renderMatchScene } from '../rom/stadiumPreview';
import PixelCanvas from './PixelCanvas';

/**
 * A scene of the match (stadiumPreview.js) drawn with the given colours; follows
 * every edit because the colours come from the editor state.
 * @param {{ scene: object, colors: object, highlight?: number[]|null, label: string,
 *   scale?: number }} props - `highlight`: BG palette rows kept bright (others dimmed)
 */
export default function MatchScenePreview({ scene, colors, highlight = null, label, scale = 2 }) {
  const { romParser } = useRom();
  const { people, grass, wall, crowd, detail } = colors;
  const key = highlight ? highlight.join(',') : '';
  const image = useMemo(() => {
    if (!romParser) return null;
    const rows = key ? key.split(',').map(Number) : undefined;
    return renderMatchScene(
      romParser,
      scene,
      { people, grass, wall, crowd, detail },
      { highlight: rows },
    );
  }, [romParser, scene, people, grass, wall, crowd, detail, key]);

  if (!image) return null;
  return (
    <figure className="mp-scene">
      <PixelCanvas image={image} scale={scale} label={label} className="mp-scene-canvas" />
      <figcaption>{label}</figcaption>
    </figure>
  );
}
