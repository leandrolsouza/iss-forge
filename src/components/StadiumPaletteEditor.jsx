import { useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { useRom } from '../context/RomContext';
import RomParser from '../rom/RomParser';
import { adjustPalette } from '../rom/palettes';
import { TEAMS } from '../rom/constants';
import { GOAL_SCENE, STAND_SCENE, matchSceneColors } from '../rom/stadiumPreview';
import { IconPitch } from './Icons';
import { SwatchRow } from './ColorSwatch';
import MatchScenePreview from './MatchScenePreview';
import '../styles/match-palettes.css';

const WALL_PRESETS = [
  { id: 'original', adjust: null },
  { id: 'blue', adjust: { hue: 200, saturation: 3, lightness: 0.9 } },
  { id: 'red', adjust: { hue: -40, saturation: 3, lightness: 0.85 } },
  { id: 'dark', adjust: { hue: 0, saturation: 1, lightness: 0.6 } },
];

/** BG palette row of each stadium palette (to highlight it in the previews) */
const PALETTE_ROWS = { stadium_wall: [4], stadium_people: [1] };

export default function StadiumPaletteEditor() {
  const { t } = useI18n();
  const { romParser, matchPalettes, teams, handleMatchPaletteChange } = useRom();
  const [highlight, setHighlight] = useState(null);

  const originals = useMemo(
    () => (romParser ? new RomParser(romParser.getOriginalData()).readMatchPalettes() : null),
    [romParser],
  );

  if (!romParser || !matchPalettes || !originals) {
    return <div className="editor-panel empty">{t('openRomToSee')}</div>;
  }

  const setColor = (id) => (index, raw) => {
    const next = [...matchPalettes[id]];
    next[index] = raw;
    handleMatchPaletteChange(id, next);
  };

  const isOriginal = (id) => JSON.stringify(matchPalettes[id]) === JSON.stringify(originals[id]);

  const colors = matchSceneColors(matchPalettes, 0);

  return (
    <div className="editor-panel match-palette-editor">
      <div className="editor-header">
        <div className="editor-header-title">
          <span className="editor-icon">
            <IconPitch size={18} />
          </span>
          <h2>{t('editorMatchStadium')}</h2>
        </div>
      </div>

      <div className="mp-body">
        <section className="detail-section mp-section">
          <div className="detail-section-title">{t('mpStadium')}</div>
          <p className="mp-hint">{t('mpStadiumHelp')}</p>
          <div className="mp-scene-row">
            <MatchScenePreview
              scene={STAND_SCENE}
              colors={colors}
              highlight={highlight}
              label={`${t('mpSceneStand')} · ${t('mpCrowd')}: ${teams?.[0]?.name || TEAMS[0].name}`}
            />
            <MatchScenePreview
              scene={GOAL_SCENE}
              colors={colors}
              highlight={highlight}
              label={t('mpSceneGoal')}
            />
          </div>
          <p className="mp-hint">{t('mpScenePreviewHint')}</p>
          {['stadium_wall', 'stadium_people'].map((id) => (
            <div key={id} className="mp-referee-part">
              <span
                className="mp-swatch-label mp-highlightable"
                onMouseEnter={() => setHighlight(PALETTE_ROWS[id])}
                onMouseLeave={() => setHighlight(null)}
              >
                {t(`mp_${id}`)}
              </span>
              <SwatchRow colors={matchPalettes[id]} onChange={setColor(id)} />
              <button
                className="kit-btn"
                disabled={isOriginal(id)}
                onClick={() => handleMatchPaletteChange(id, [...originals[id]])}
              >
                {t('mpRestore')}
              </button>
            </div>
          ))}
          <div className="mp-presets">
            <span>{t('mp_stadium_wall')}:</span>
            {WALL_PRESETS.map((p) => (
              <button
                key={p.id}
                className="kit-btn"
                onClick={() =>
                  handleMatchPaletteChange(
                    'stadium_wall',
                    p.adjust
                      ? adjustPalette(originals.stadium_wall, p.adjust)
                      : [...originals.stadium_wall],
                  )
                }
              >
                {t(`mpWall_${p.id}`)}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
