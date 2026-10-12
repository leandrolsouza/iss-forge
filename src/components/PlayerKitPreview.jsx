import { useEffect, useMemo, useRef } from 'react';
import { useI18n } from '../i18n';
import { useRom } from '../context/RomContext';
import { renderTeamKit } from '../rom/playerPreview';
import { paintCanvas } from '../rom/snesRender';
import '../styles/player-preview.css';

function SpriteCanvas({ image, label, scale }) {
  const ref = useRef(null);
  useEffect(() => {
    if (image) paintCanvas(ref.current, image);
  }, [image]);
  if (!image) return null;
  return (
    <figure className="player-preview-item">
      <canvas
        ref={ref}
        className="player-preview-canvas"
        style={{ width: image.width * scale, height: image.height * scale }}
        role="img"
        aria-label={label}
      />
      <figcaption>{label}</figcaption>
    </figure>
  );
}

/**
 * A team's player (or goalkeeper) drawn with the game's own sprites, front and back,
 * in the given kit. Follows every colour edit (kit, hair/skin and the flag colours,
 * which paint the crest on the shirt): the colours come from the team state.
 * @param {{ team: object, teamIndex: number, kit: 'home'|'away'|'goalkeeper', kits?: string[],
 *   views?: ('front'|'back')[], scale?: number }} props
 *   `kits` draws several kits side by side (e.g. ['home', 'goalkeeper'])
 */
export default function PlayerKitPreview({
  team,
  teamIndex,
  kit = 'home',
  kits,
  views = ['front', 'back'],
  scale = 3,
}) {
  const { t } = useI18n();
  const { romParser } = useRom();
  const list = kits || [kit];
  const key = list.join(',');

  const images = useMemo(() => {
    if (!romParser || !team?.uniforms) return [];
    return key.split(',').map((k) => ({ kit: k, ...renderTeamKit(romParser, team, teamIndex, k) }));
    // the drawing only depends on the colours, not on the other team fields
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [romParser, teamIndex, key, team?.uniforms, team?.hairSkin, team?.flagColors]);

  if (!images.length) return null;
  const kitName = { home: t('home'), away: t('away'), goalkeeper: t('keeper') };

  return (
    <div className="player-preview">
      {images.map(({ kit: k, front, back }) => (
        <div key={k} className="player-preview-kit">
          {views.includes('front') && (
            <SpriteCanvas
              image={front}
              scale={scale}
              label={views.length > 1 ? `${kitName[k]} · ${t('previewFront')}` : kitName[k]}
            />
          )}
          {views.includes('back') && (
            <SpriteCanvas
              image={back}
              scale={scale}
              label={`${kitName[k]} · ${t('previewBack')}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
