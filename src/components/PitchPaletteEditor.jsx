import { useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { useRom } from '../context/RomContext';
import RomParser from '../rom/RomParser';
import { adjustPalette, rawToHex, GRASS_PRESETS } from '../rom/palettes';
import { IconPitch } from './Icons';
import { SwatchRow } from './ColorSwatch';
import PixelCanvas from './PixelCanvas';
import { renderPitch } from '../rom/pitchPreview';
import '../styles/match-palettes.css';

const WEATHERS = ['sunny', 'rain', 'snow'];
const TYPES = ['B', 'AC'];

const grassId = (type, weather) => `grass${type}_${weather}`;
const detailId = (type, weather) =>
  type === 'AC' && weather !== 'sunny' ? `detailAC_${weather}` : 'detail_shared';

function PitchPreview({ rom, grass, detail, label }) {
  const image = useMemo(
    () => (rom ? renderPitch(rom, grass, { width: 256, height: 160 }) : null),
    [rom, grass],
  );
  return (
    <div className="mp-pitch-wrap">
      <PixelCanvas image={image} scale={1} label={label} className="mp-pitch-canvas" />
      <div className="mp-pitch-detail" style={{ background: rawToHex(detail[0]) }} />
    </div>
  );
}

export default function PitchPaletteEditor() {
  const { t } = useI18n();
  const { romParser, matchPalettes, handleMatchPaletteChange } = useRom();
  const [type, setType] = useState('B');
  const [weather, setWeather] = useState('sunny');
  const [adjust, setAdjust] = useState({ hue: 0, saturation: 1, lightness: 1 });
  const [allConditions, setAllConditions] = useState(false);
  const [fromCurrent, setFromCurrent] = useState(true);

  const originals = useMemo(
    () => (romParser ? new RomParser(romParser.getOriginalData()).readMatchPalettes() : null),
    [romParser],
  );

  if (!romParser || !matchPalettes || !originals) {
    return <div className="editor-panel empty">{t('openRomToSee')}</div>;
  }

  const gId = grassId(type, weather);
  const dId = detailId(type, weather);
  const grass = matchPalettes[gId];
  const detail = matchPalettes[dId];

  const setColor = (id) => (index, raw) => {
    const next = [...matchPalettes[id]];
    next[index] = raw;
    handleMatchPaletteChange(id, next);
  };

  const grassTargets = () =>
    allConditions
      ? TYPES.flatMap((ty) => WEATHERS.map((w) => [grassId(ty, w), detailId(ty, w)]))
      : [[gId, dId]];

  const applyGrassAdjust = (adj, relative = false) => {
    const updates = {};
    grassTargets()
      .flat()
      .forEach((id) => {
        if (updates[id]) return;
        const base = relative ? matchPalettes[id] : originals[id];
        updates[id] = adj ? adjustPalette(base, adj) : [...originals[id]];
      });
    handleMatchPaletteChange(updates);
  };

  const applySliders = () => {
    applyGrassAdjust(adjust, fromCurrent);
    if (fromCurrent) setAdjust({ hue: 0, saturation: 1, lightness: 1 });
  };

  const isOriginal = (id) =>
    JSON.stringify(matchPalettes[id]) === JSON.stringify(originals[id]);

  return (
    <div className="editor-panel match-palette-editor">
      <div className="editor-header">
        <div className="editor-header-title">
          <span className="editor-icon">
            <IconPitch size={18} />
          </span>
          <h2>{t('editorMatchPitch')}</h2>
        </div>
      </div>

      <div className="mp-body">
        <section className="detail-section mp-section">
          <div className="detail-section-title">{t('mpPitch')}</div>
          <div className="mp-conditions">
            <div className="mp-toggle-group" role="group" aria-label={t('mpPitchType')}>
              <span>{t('mpPitchType')}</span>
              {TYPES.map((ty) => (
                <button
                  key={ty}
                  className={`kit-btn ${type === ty ? 'active' : ''}`}
                  onClick={() => setType(ty)}
                >
                  {t(`mpType${ty}`)}
                </button>
              ))}
            </div>
            <div className="mp-toggle-group" role="group" aria-label={t('mpWeather')}>
              <span>{t('mpWeather')}</span>
              {WEATHERS.map((w) => (
                <button
                  key={w}
                  className={`kit-btn ${weather === w ? 'active' : ''}`}
                  onClick={() => setWeather(w)}
                >
                  {t(`mpWeather_${w}`)}
                </button>
              ))}
            </div>
          </div>
          <p className="mp-hint">{t('mpPitchHelp')}</p>
          <p className="mp-hint">{t('mpPitchPreviewHint')}</p>

          <div className="mp-pitch-row">
            <PitchPreview
              rom={romParser}
              grass={grass}
              detail={detail}
              label={t('mpPitchPreview')}
            />
            <div className="mp-pitch-colors">
              <SwatchRow
                label={t('mpGrassRow1')}
                colors={grass.slice(0, 15)}
                onChange={setColor(gId)}
              />
              <SwatchRow
                label={t('mpGrassRow2')}
                colors={grass.slice(15)}
                offset={15}
                onChange={setColor(gId)}
              />
              <SwatchRow label={t('mpPitchDetail')} colors={detail} onChange={setColor(dId)} />
              <p className="mp-hint">
                {dId === 'detail_shared' ? t('mpDetailSharedHelp') : t('mpDetailHelp')}
              </p>
            </div>
          </div>

          <div className="mp-presets">
            <span>{t('mpGrassPresets')}</span>
            {GRASS_PRESETS.map((p) => (
              <button key={p.id} className="kit-btn" onClick={() => applyGrassAdjust(p.adjust)}>
                {t(`mpGrass_${p.id}`)}
              </button>
            ))}
          </div>

          <div className="mp-sliders">
            {[
              ['hue', -180, 180, 1],
              ['saturation', 0, 2, 0.05],
              ['lightness', 0.5, 1.5, 0.05],
            ].map(([key, min, max, step]) => (
              <label key={key} className="mp-slider">
                <span>
                  {t(`mp_${key}`)}: {adjust[key]}
                </span>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={adjust[key]}
                  onChange={(e) => setAdjust((a) => ({ ...a, [key]: Number(e.target.value) }))}
                />
              </label>
            ))}
            <button className="kit-btn active" onClick={applySliders}>
              {t('mpApplyAdjust')}
            </button>
          </div>
          <label className="mp-check">
            <input
              type="checkbox"
              checked={fromCurrent}
              onChange={(e) => setFromCurrent(e.target.checked)}
            />
            {t('mpAdjustFromCurrent')}
          </label>
          <label className="mp-check">
            <input
              type="checkbox"
              checked={allConditions}
              onChange={(e) => setAllConditions(e.target.checked)}
            />
            {t('mpAllConditions')}
          </label>
          {!isOriginal(gId) && <span className="mp-modified">{t('mpModified')}</span>}
        </section>
      </div>
    </div>
  );
}
