import { useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { useRom } from '../context/RomContext';
import RomParser from '../rom/RomParser';
import { CROWD_PARTS, TEAMS } from '../rom/constants';
import { hexToRaw, rgbToRaw, shadeRamp } from '../rom/palettes';
import { STAND_SCENE, matchSceneColors } from '../rom/stadiumPreview';
import { IconPlayers } from './Icons';
import { ColorSwatch, SwatchRow } from './ColorSwatch';
import MatchScenePreview from './MatchScenePreview';
import '../styles/match-palettes.css';

/** BG palette row of each fan group (to highlight it in the preview) */
const GROUP_ROWS = [[5], [6]];

/**
 * Crowd presets: two shirt colours spread over the 4 shirt ramps (group 1 = main /
 * second, group 2 = second / main), so the stand mixes both. `null` = original palette.
 */
const CROWD_PRESETS = [
  { id: 'original', shirts: null },
  { id: 'redWhite', shirts: ['#e01010', '#f8f8f8'] },
  { id: 'blueWhite', shirts: ['#2050f0', '#f8f8f8'] },
  { id: 'skyWhite', shirts: ['#68b8f8', '#f8f8f8'] },
  { id: 'greenYellow', shirts: ['#10a040', '#f8e000'] },
  { id: 'redYellow', shirts: ['#e01010', '#f8d000'] },
  { id: 'orange', shirts: ['#f87000', '#f8f8f8'] },
  { id: 'blackWhite', shirts: ['#383838', '#f8f8f8'] },
];

/** Brightest colour of a uniform part ({ r, g, b } list) as a raw SNES colour */
function brightestRaw(colors) {
  if (!Array.isArray(colors) || !colors.length) return null;
  const best = [...colors].sort((a, b) => b.r + b.g + b.b - (a.r + a.g + a.b))[0];
  return rgbToRaw(best);
}

export default function CrowdPaletteEditor() {
  const { t } = useI18n();
  const { romParser, matchPalettes, teams, handleMatchPaletteChange } = useRom();
  const [teamIndex, setTeamIndex] = useState(0);
  const [highlight, setHighlight] = useState(null);

  const originals = useMemo(
    () => (romParser ? new RomParser(romParser.getOriginalData()).readMatchPalettes() : null),
    [romParser],
  );

  if (!romParser || !matchPalettes || !originals) {
    return <div className="editor-panel empty">{t('openRomToSee')}</div>;
  }

  const n = matchPalettes.crowdMap[teamIndex];
  const colors = matchPalettes.crowds[n] || [];
  const teamName = (i) => teams[i]?.name || TEAMS[i]?.name || '?';

  const sharedWith = matchPalettes.crowdMap
    .map((m, i) => (m === n && i !== teamIndex ? teamName(i) : null))
    .filter(Boolean);

  const setColors = (next) => handleMatchPaletteChange({ [`crowd:${n}`]: next });

  const setOne = (index, raw) => {
    const next = [...colors];
    next[index] = raw;
    setColors(next);
  };

  const setPart = (rowOffset, key, raw) => {
    const part = CROWD_PARTS.find((p) => p.key === key);
    const next = [...colors];
    shadeRamp(raw, part.count)
      .reverse()
      .forEach((v, i) => (next[rowOffset + part.from + i] = v));
    setColors(next);
  };

  /** Paint shirt ramps: picks = [rowOffset, 'shirtA'|'shirtB', raw | null] */
  const paintShirts = (picks) => {
    const next = [...colors];
    picks.forEach(([rowOffset, key, raw]) => {
      if (raw === null) return;
      const part = CROWD_PARTS.find((p) => p.key === key);
      shadeRamp(raw, part.count)
        .reverse()
        .forEach((v, i) => (next[rowOffset + part.from + i] = v));
    });
    setColors(next);
  };

  const fromUniform = () => {
    const u = teams[teamIndex]?.uniforms;
    if (!u) return;
    paintShirts([
      [0, 'shirtA', brightestRaw(u.home?.shirt)],
      [0, 'shirtB', brightestRaw(u.away?.shirt)],
      [15, 'shirtA', brightestRaw(u.home?.shorts)],
      [15, 'shirtB', brightestRaw(u.home?.socks)],
    ]);
  };

  const applyPreset = ({ shirts }) => {
    if (!shirts) {
      setColors([...originals.crowds[n]]);
      return;
    }
    const [main, second] = shirts.map(hexToRaw);
    paintShirts([
      [0, 'shirtA', main],
      [0, 'shirtB', second],
      [15, 'shirtA', second],
      [15, 'shirtB', main],
    ]);
  };

  const paletteLabel = (m) => {
    const users = matchPalettes.crowdMap
      .map((x, i) => (x === m ? teamName(i) : null))
      .filter(Boolean);
    return `#${m + 1}${users.length ? ` — ${users.join(', ')}` : ` — ${t('mpCrowdUnused')}`}`;
  };

  return (
    <div className="editor-panel match-palette-editor">
      <div className="editor-header">
        <div className="editor-header-title">
          <span className="editor-icon">
            <IconPlayers size={18} />
          </span>
          <h2>{t('editorMatchCrowd')}</h2>
        </div>
      </div>

      <div className="mp-body">
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
                onChange={(e) =>
                  handleMatchPaletteChange({ [`crowdMap:${teamIndex}`]: Number(e.target.value) })
                }
              >
                {matchPalettes.crowds.map((_, m) => (
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

          <div className="mp-scene-row">
            <MatchScenePreview
              scene={STAND_SCENE}
              colors={matchSceneColors(matchPalettes, teamIndex)}
              highlight={highlight}
              label={`${t('mpSceneStand')} · ${teamName(teamIndex)}`}
            />
          </div>
          <p className="mp-hint">{t('mpScenePreviewHint')}</p>

          <div className="mp-presets">
            <span>{t('mpGrassPresets')}</span>
            {CROWD_PRESETS.map((p) => (
              <button
                key={p.id}
                className="kit-btn"
                title={p.shirts ? undefined : t('mpCrowdPresetOriginalHelp')}
                onClick={() => applyPreset(p)}
              >
                {p.shirts && (
                  <span className="mp-preset-chips" aria-hidden="true">
                    {p.shirts.map((hex) => (
                      <span key={hex} className="mp-preset-chip" style={{ background: hex }} />
                    ))}
                  </span>
                )}
                {t(`mpCrowdPreset_${p.id}`)}
              </button>
            ))}
          </div>

          {[0, 15].map((rowOffset, r) => (
            <div key={rowOffset} className="mp-crowd-row">
              <div
                className="mp-crowd-row-title mp-highlightable"
                onMouseEnter={() => setHighlight(GROUP_ROWS[r])}
                onMouseLeave={() => setHighlight(null)}
              >
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
                handleMatchPaletteChange({
                  [`crowd:${n}`]: [...originals.crowds[n]],
                  [`crowdMap:${teamIndex}`]: originals.crowdMap[teamIndex],
                })
              }
            >
              {t('mpRestore')}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
