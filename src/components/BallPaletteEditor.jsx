import { useMemo } from 'react';
import { useI18n } from '../i18n';
import { useRom } from '../context/RomContext';
import RomParser from '../rom/RomParser';
import { rawToHex, hexToRaw, shadeRamp } from '../rom/palettes';
import { IconPitch } from './Icons';
import { SwatchRow } from './ColorSwatch';
import '../styles/match-palettes.css';

const BALL_PRESETS = [
  { id: 'original', base: null },
  { id: 'orange', base: hexToRaw('#f87800') },
  { id: 'yellow', base: hexToRaw('#f8f000') },
  { id: 'red', base: hexToRaw('#f80000') },
  { id: 'blue', base: hexToRaw('#2060f8') },
];

function BallPreview({ colors }) {
  const stops = colors.map((raw, i) => ({ c: rawToHex(raw), o: (i / (colors.length - 1)) * 100 }));
  return (
    <svg className="mp-ball" viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <radialGradient id="mp-ball-grad" cx="35%" cy="30%" r="75%">
          {[...stops].reverse().map((s, i) => (
            <stop key={i} offset={`${s.o}%`} stopColor={s.c} />
          ))}
        </radialGradient>
      </defs>
      <circle cx={20} cy={20} r={16} fill="url(#mp-ball-grad)" />
    </svg>
  );
}

export default function BallPaletteEditor() {
  const { t } = useI18n();
  const { romParser, matchPalettes, handleMatchPaletteChange } = useRom();

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

  const applyBall = (preset) => {
    handleMatchPaletteChange(
      'ball',
      preset.base === null ? [...originals.ball] : shadeRamp(preset.base, originals.ball.length),
    );
  };

  return (
    <div className="editor-panel match-palette-editor">
      <div className="editor-header">
        <div className="editor-header-title">
          <span className="editor-icon">
            <IconPitch size={18} />
          </span>
          <h2>{t('editorMatchBall')}</h2>
        </div>
      </div>

      <div className="mp-body">
        <section className="detail-section mp-section">
          <div className="detail-section-title">{t('mpBall')}</div>
          <div className="mp-inline">
            <BallPreview colors={matchPalettes.ball} />
            <div>
              <SwatchRow colors={matchPalettes.ball} onChange={setColor('ball')} />
              <p className="mp-hint">{t('mpBallHelp')}</p>
              <div className="mp-presets">
                {BALL_PRESETS.map((p) => (
                  <button key={p.id} className="kit-btn" onClick={() => applyBall(p)}>
                    {t(`mpBall_${p.id}`)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
