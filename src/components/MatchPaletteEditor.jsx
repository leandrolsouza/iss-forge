import { useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { useRom } from '../context/RomContext';
import RomParser from '../rom/RomParser';
import { REFEREE_PARTS, CROWD_PARTS, TEAMS } from '../rom/constants';
import {
  rawToHex,
  hexToRaw,
  rgbToRaw,
  adjustPalette,
  shadeRamp,
  GRASS_PRESETS,
} from '../rom/palettes';
import { IconPitch } from './Icons';
import { ColorSwatch, SwatchRow } from './ColorSwatch';
import PixelCanvas from './PixelCanvas';
import { renderPitch } from '../rom/pitchPreview';
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

/** The grass with the game's own tiles and the edited colours (lines drawn as a plan) */
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
  const { romParser, matchPalettes, teams, handleMatchPaletteChange } = useRom();
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

        {/* ---------------- Stadium ---------------- */}
        <section className="detail-section mp-section">
          <div className="detail-section-title">{t('mpStadium')}</div>
          <p className="mp-hint">{t('mpStadiumHelp')}</p>
          {['stadium_wall', 'stadium_people'].map((id) => (
            <div key={id} className="mp-referee-part">
              <span className="mp-swatch-label">{t(`mp_${id}`)}</span>
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

        {/* ---------------- Crowd ---------------- */}
        <CrowdSection
          t={t}
          teams={teams}
          palettes={matchPalettes}
          originals={originals}
          onChange={handleMatchPaletteChange}
        />
      </div>
    </div>
  );
}

const WALL_PRESETS = [
  { id: 'original', adjust: null },
  { id: 'blue', adjust: { hue: 200, saturation: 3, lightness: 0.9 } },
  { id: 'red', adjust: { hue: -40, saturation: 3, lightness: 0.85 } },
  { id: 'dark', adjust: { hue: 0, saturation: 1, lightness: 0.6 } },
];

/** Brightest colour of a uniform part ({ r, g, b } list) as a raw SNES colour */
function brightestRaw(colors) {
  if (!Array.isArray(colors) || !colors.length) return null;
  const best = [...colors].sort((a, b) => b.r + b.g + b.b - (a.r + a.g + a.b))[0];
  return rgbToRaw(best);
}

function CrowdSection({ t, teams, palettes, originals, onChange }) {
  const [teamIndex, setTeamIndex] = useState(0);
  const n = palettes.crowdMap[teamIndex];
  const colors = palettes.crowds[n] || [];
  const teamName = (i) => teams[i]?.name || TEAMS[i]?.name || '?';
  const sharedWith = palettes.crowdMap
    .map((m, i) => (m === n && i !== teamIndex ? teamName(i) : null))
    .filter(Boolean);

  const setColors = (next) => onChange({ [`crowd:${n}`]: next });
  const setOne = (index, raw) => {
    const next = [...colors];
    next[index] = raw;
    setColors(next);
  };
  const setPart = (rowOffset, key, raw) => {
    const part = CROWD_PARTS.find((p) => p.key === key);
    const next = [...colors];
    shadeRamp(raw, part.count)
      .reverse() // crowd shirts go light → dark
      .forEach((v, i) => (next[rowOffset + part.from + i] = v));
    setColors(next);
  };

  const fromUniform = () => {
    const u = teams[teamIndex]?.uniforms;
    if (!u) return;
    const picks = [
      [0, 'shirtA', brightestRaw(u.home?.shirt)],
      [0, 'shirtB', brightestRaw(u.away?.shirt)],
      [15, 'shirtA', brightestRaw(u.home?.shorts)],
      [15, 'shirtB', brightestRaw(u.home?.socks)],
    ];
    const next = [...colors];
    picks.forEach(([rowOffset, key, raw]) => {
      if (raw === null) return;
      const part = CROWD_PARTS.find((p) => p.key === key);
      shadeRamp(raw, part.count)
        .reverse() // crowd shirts go light → dark
        .forEach((v, i) => (next[rowOffset + part.from + i] = v));
    });
    setColors(next);
  };

  const paletteLabel = (m) => {
    const users = palettes.crowdMap.map((x, i) => (x === m ? teamName(i) : null)).filter(Boolean);
    return `#${m + 1}${users.length ? ` — ${users.join(', ')}` : ` — ${t('mpCrowdUnused')}`}`;
  };

  return (
    <section className="detail-section mp-section">
      <div className="detail-section-title">{t('mpCrowd')}</div>
      <p className="mp-hint">{t('mpCrowdHelp')}</p>
      <div className="mp-crowd-header">
        <label className="mp-field">
          <span>{t('mpCrowdHomeTeam')}</span>
          <select
            className="input-stat"
            value={teamIndex}
            onChange={(e) => setTeamIndex(Number(e.target.value))}
          >
            {TEAMS.map((tm, i) => (
              <option key={tm.id} value={i}>
                {teamName(i)}
              </option>
            ))}
          </select>
        </label>
        <label className="mp-field">
          <span>{t('mpCrowdUses')}</span>
          <select
            className="input-stat"
            value={n}
            onChange={(e) => onChange({ [`crowdMap:${teamIndex}`]: Number(e.target.value) })}
          >
            {palettes.crowds.map((_, m) => (
              <option key={m} value={m}>
                {paletteLabel(m)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {sharedWith.length > 0 && (
        <p className="mp-warning">
          {t('mpCrowdShared')}: {sharedWith.join(', ')}
        </p>
      )}

      {[0, 15].map((rowOffset, r) => (
        <div key={rowOffset} className="mp-crowd-row">
          <div className="mp-crowd-row-title">
            {t('mpCrowdRow')} {r + 1}
          </div>
          {CROWD_PARTS.map(({ key, from, count }) => (
            <div key={key} className="mp-referee-part">
              <span className="mp-swatch-label">{t(`mpCrowd_${key}`)}</span>
              <SwatchRow
                colors={colors.slice(rowOffset + from, rowOffset + from + count)}
                offset={rowOffset + from}
                onChange={setOne}
              />
              {(key === 'shirtA' || key === 'shirtB') && (
                <label className="mp-quick">
                  <span>{t('mpQuickColor')}</span>
                  <ColorSwatch
                    raw={colors[rowOffset + from]}
                    onCommit={(v) => setPart(rowOffset, key, v)}
                  />
                </label>
              )}
            </div>
          ))}
        </div>
      ))}

      <div className="mp-presets">
        <button className="kit-btn active" onClick={fromUniform}>
          {t('mpCrowdFromUniform')}
        </button>
        <button
          className="kit-btn"
          onClick={() =>
            onChange({
              [`crowd:${n}`]: [...originals.crowds[n]],
              [`crowdMap:${teamIndex}`]: originals.crowdMap[teamIndex],
            })
          }
        >
          {t('mpRestore')}
        </button>
      </div>
    </section>
  );
}
