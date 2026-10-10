import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { useRom } from '../context/RomContext';
import RomParser from '../rom/RomParser';
import { REFEREE_PARTS } from '../rom/constants';
import { rawToHex, hexToRaw, adjustPalette, shadeRamp, GRASS_PRESETS } from '../rom/palettes';
import { IconPitch } from './Icons';
import '../styles/match-palettes.css';

const WEATHERS = ['sunny', 'rain', 'snow'];
const TYPES = ['B', 'AC'];

const grassId = (type, weather) => `grass${type}_${weather}`;
const detailId = (type, weather) =>
  type === 'AC' && weather !== 'sunny' ? `detailAC_${weather}` : 'detail_shared';

const BALL_PRESETS = [
  { id: 'original', base: null },
  { id: 'orange', base: hexToRaw('#f87800') },
  { id: 'yellow', base: hexToRaw('#f8f000') },
  { id: 'red', base: hexToRaw('#f80000') },
  { id: 'blue', base: hexToRaw('#2060f8') },
];

const REFEREE_PRESETS = [
  { id: 'original', kit: null },
  { id: 'yellow', kit: { shirt: '#f8e000', shorts: '#202020', socks: '#202020' } },
  { id: 'red', kit: { shirt: '#e00000', shorts: '#202020', socks: '#e00000' } },
  { id: 'green', kit: { shirt: '#00b040', shorts: '#202020', socks: '#00b040' } },
  { id: 'blue', kit: { shirt: '#2050f0', shorts: '#202020', socks: '#2050f0' } },
  { id: 'pink', kit: { shirt: '#f070c0', shorts: '#202020', socks: '#202020' } },
];

/** Color input that commits on blur, so dragging the picker creates one undo step */
function ColorSwatch({ raw, onCommit, title }) {
  const [value, setValue] = useState(rawToHex(raw));
  useEffect(() => setValue(rawToHex(raw)), [raw]);
  const commit = () => {
    const v = hexToRaw(value);
    if (v !== null && v !== raw) onCommit(v);
  };
  return (
    <input
      type="color"
      className="mp-swatch"
      value={value}
      title={title || value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
    />
  );
}

function SwatchRow({ colors, onChange, offset = 0, label }) {
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

function PitchPreview({ grass, detail }) {
  // Approximation: alternating mowing stripes (first colour of each grass row) + white lines
  const a = rawToHex(grass[0]);
  const b = rawToHex(grass[15]);
  const line = rawToHex(grass[7]);
  const extra = rawToHex(detail[0]);
  return (
    <svg className="mp-pitch" viewBox="0 0 200 130" aria-hidden="true">
      {Array.from({ length: 10 }).map((_, i) => (
        <rect key={i} x={i * 20} y={0} width={20} height={130} fill={i % 2 ? a : b} />
      ))}
      <rect x={6} y={6} width={188} height={118} fill="none" stroke={line} strokeWidth={1.5} />
      <line x1={100} y1={6} x2={100} y2={124} stroke={line} strokeWidth={1.5} />
      <circle cx={100} cy={65} r={18} fill="none" stroke={line} strokeWidth={1.5} />
      <rect x={6} y={38} width={26} height={54} fill="none" stroke={line} strokeWidth={1.5} />
      <rect x={168} y={38} width={26} height={54} fill="none" stroke={line} strokeWidth={1.5} />
      <rect x={0} y={124} width={200} height={6} fill={extra} />
    </svg>
  );
}

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

export default function MatchPaletteEditor() {
  const { t } = useI18n();
  const { romParser, matchPalettes, handleMatchPaletteChange } = useRom();
  const [type, setType] = useState('B');
  const [weather, setWeather] = useState('sunny');
  const [adjust, setAdjust] = useState({ hue: 0, saturation: 1, lightness: 1 });
  const [allConditions, setAllConditions] = useState(false);

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

  const applyGrassAdjust = (adj) => {
    const updates = {};
    // Grass rows and the pitch-detail row are recoloured together (detail palettes
    // can be shared, so each id is processed once)
    grassTargets()
      .flat()
      .forEach((id) => {
        if (updates[id]) return;
        updates[id] = adj ? adjustPalette(originals[id], adj) : [...originals[id]];
      });
    handleMatchPaletteChange(updates);
  };

  const applyBall = (preset) => {
    handleMatchPaletteChange(
      'ball',
      preset.base === null ? [...originals.ball] : shadeRamp(preset.base, originals.ball.length),
    );
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

  const setRefereePart = (key, hex) => {
    const part = REFEREE_PARTS.find((p) => p.key === key);
    const next = [...matchPalettes.referee];
    shadeRamp(hexToRaw(hex), part.count).forEach((raw, i) => (next[part.from + i] = raw));
    handleMatchPaletteChange('referee', next);
  };

  const isOriginal = (id) => JSON.stringify(matchPalettes[id]) === JSON.stringify(originals[id]);

  return (
    <div className="editor-panel match-palette-editor">
      <div className="editor-header">
        <div className="editor-header-title">
          <span className="editor-icon">
            <IconPitch size={18} />
          </span>
          <h2>{t('editorMatchPalettes')}</h2>
          <span className="editor-subtitle">- {t('mpSubtitle')}</span>
        </div>
      </div>

      <div className="mp-body">
        {/* ---------------- Pitch ---------------- */}
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

          <div className="mp-pitch-row">
            <PitchPreview grass={grass} detail={detail} />
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
            <button className="kit-btn active" onClick={() => applyGrassAdjust(adjust)}>
              {t('mpApplyAdjust')}
            </button>
          </div>
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

        {/* ---------------- Ball ---------------- */}
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

        {/* ---------------- Referee ---------------- */}
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
                      onCommit={(v) => setRefereePart(key, rawToHex(v))}
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
