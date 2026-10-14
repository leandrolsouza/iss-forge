import { useMemo } from 'react';
import { useI18n } from '../i18n';
import { useRom } from '../context/RomContext';
import RomParser from '../rom/RomParser';
import { REFEREE_PARTS } from '../rom/constants';
import { hexToRaw, shadeRamp } from '../rom/palettes';
import { IconUniform } from './Icons';
import { ColorSwatch, SwatchRow } from './ColorSwatch';
import '../styles/match-palettes.css';

const REFEREE_PRESETS = [
  { id: 'original', kit: null },
  { id: 'yellow', kit: { shirt: '#f8e000', shorts: '#202020', socks: '#202020' } },
  { id: 'red', kit: { shirt: '#e00000', shorts: '#202020', socks: '#e00000' } },
  { id: 'green', kit: { shirt: '#00b040', shorts: '#202020', socks: '#00b040' } },
  { id: 'blue', kit: { shirt: '#2050f0', shorts: '#202020', socks: '#2050f0' } },
  { id: 'pink', kit: { shirt: '#f070c0', shorts: '#202020', socks: '#202020' } },
];

export default function RefereePaletteEditor() {
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

  const applyReferee = (preset) => {
    if (!preset.kit) {
      handleMatchPaletteChange('referee', [...originals.referee]);
      return;
    }
    const next = [...matchPalettes.referee];
    REFEREE_PARTS.forEach(({ key, from, count }) => {
      if (!preset.kit[key]) return;
      shadeRamp(hexToRaw(preset.kit[key]), count).forEach((raw, i) => (next[from + i] = raw));
    });
    handleMatchPaletteChange('referee', next);
  };

  const setRefereePart = (key, raw) => {
    const part = REFEREE_PARTS.find((p) => p.key === key);
    const next = [...matchPalettes.referee];
    shadeRamp(raw, part.count).forEach((v, i) => (next[part.from + i] = v));
    handleMatchPaletteChange('referee', next);
  };

  return (
    <div className="editor-panel match-palette-editor">
      <div className="editor-header">
        <div className="editor-header-title">
          <span className="editor-icon">
            <IconUniform size={18} />
          </span>
          <h2>{t('editorMatchReferee')}</h2>
        </div>
      </div>

      <div className="mp-body">
        <section className="detail-section mp-section">
          <div className="detail-section-title">{t('mpReferee')}</div>
          <p className="mp-hint">{t('mpRefereeHelp')}</p>
          <div className="mp-referee">
            {REFEREE_PARTS.map(({ key, from, count }) => (
              <div key={key} className="mp-referee-part">
                <span className="mp-swatch-label">{t(`mpRef_${key}`)}</span>
                <SwatchRow
                  colors={matchPalettes.referee.slice(from, from + count)}
                  offset={from}
                  onChange={setColor('referee')}
                />
                {['shirt', 'shorts', 'socks'].includes(key) && (
                  <label className="mp-quick" title={t('mpQuickColor')}>
                    <span>{t('mpQuickColor')}</span>
                    <ColorSwatch
                      raw={matchPalettes.referee[from + count - 1]}
                      onCommit={(v) => setRefereePart(key, v)}
                    />
                  </label>
                )}
              </div>
            ))}
          </div>
          <div className="mp-presets">
            {REFEREE_PRESETS.map((p) => (
              <button key={p.id} className="kit-btn" onClick={() => applyReferee(p)}>
                {t(`mpRefPreset_${p.id}`)}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
