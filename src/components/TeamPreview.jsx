import React, { useEffect, useState } from 'react';
import { HAIR_STYLES, SHOOTING_VALUES } from '../rom/constants';
import { getPositionLabel as slotPositionLabel, getLineCategory } from '../rom/formation';
import { useI18n } from '../i18n';
import { useRom } from '../context/RomContext';
import { useConfirm } from '../context/ConfirmContext';
import { IconOverview } from './Icons';
import FlagCanvas from './FlagCanvas';
import PlayerKitPreview from './PlayerKitPreview';

export default function TeamPreview({ team, teamIndex }) {
  const { t, lang } = useI18n();
  const confirm = useConfirm();
  const { teams, handleExportTeam, handleImportTeam, handleCopyTeam } = useRom();
  const [copyTarget, setCopyTarget] = useState(teamIndex === 0 ? 1 : 0);
  useEffect(() => {
    if (copyTarget === teamIndex) setCopyTarget(teamIndex === 0 ? 1 : 0);
  }, [teamIndex, copyTarget]);

  if (!team || !team.players) {
    return <div className="editor-panel empty">{t('openRomToSee')}</div>;
  }

  const copyToTarget = async () => {
    const ok = await confirm({
      message: t('confirmCopyTeam', {
        from: team.name,
        to: teams[copyTarget]?.name || copyTarget + 1,
      }),
      confirmLabel: t('confirmCopyBtn'),
      danger: true,
    });
    if (ok) handleCopyTeam(teamIndex, copyTarget, false);
  };

  const importIntoTeam = async () => {
    const ok = await confirm({
      message: t('confirmImportTeam', { team: team.name }),
      confirmLabel: t('confirmImportBtn'),
      danger: true,
    });
    if (ok) handleImportTeam(teamIndex);
  };

  const uniforms = team.uniforms?.home;
  const shirtColor = uniforms?.shirt?.[0]
    ? `rgb(${uniforms.shirt[0].r},${uniforms.shirt[0].g},${uniforms.shirt[0].b})`
    : '#444';
  const shirtDetail = uniforms?.shirt?.[1]
    ? `rgb(${uniforms.shirt[1].r},${uniforms.shirt[1].g},${uniforms.shirt[1].b})`
    : '#666';
  const shortsColor = uniforms?.shorts?.[0]
    ? `rgb(${uniforms.shorts[0].r},${uniforms.shorts[0].g},${uniforms.shorts[0].b})`
    : '#333';

  // Positions come from the team's formation (same as the Players tab), not the list order
  const formationSlots = team.formation?.slots || [];
  const getPositionLabel = (idx) => {
    if (idx >= 11) return 'SUB';
    const slot = formationSlots[idx];
    if (slot) return slotPositionLabel(slot);
    return idx === 0 ? 'GK' : '?';
  };
  const getPositionCategory = (idx) => {
    if (idx >= 11) return 'sub';
    const slot = formationSlots[idx];
    return slot ? getLineCategory(slot.line) : idx === 0 ? 'gk' : 'mid';
  };

  // Calculate team averages
  const avgShooting = (team.players.reduce((s, p) => s + p.shooting, 0) / 15).toFixed(1);
  const avgSpeed = (team.players.reduce((s, p) => s + p.speed, 0) / 15).toFixed(1);
  const avgStamina = (team.players.reduce((s, p) => s + p.stamina, 0) / 15).toFixed(1);
  const avgTechnique = (team.players.reduce((s, p) => s + p.technique, 0) / 15).toFixed(1);

  return (
    <div className="editor-panel team-preview-panel">
      <div className="editor-header">
        <div className="editor-header-title">
          <span className="editor-icon">
            <IconOverview size={18} />
          </span>
          <h2>{team.name}</h2>
          <span className="editor-subtitle">- {t('overview')}</span>
        </div>
      </div>

      <div className="team-preview-body">
        {/* Import/Export Actions */}
        <div className="preview-actions">
          <button className="kit-btn active" onClick={() => handleExportTeam(teamIndex)}>
            {t('exportJson')}
          </button>
          <button className="kit-btn" onClick={importIntoTeam}>
            {t('importJson')}
          </button>
          <span className="preview-actions-sep" />
          <select
            className="input-stat"
            value={copyTarget}
            onChange={(e) => setCopyTarget(Number(e.target.value))}
            aria-label={t('copyTeamTarget')}
          >
            {teams.map((tm, i) =>
              i === teamIndex ? null : (
                <option key={i} value={i}>
                  {i + 1}. {tm.name}
                </option>
              ),
            )}
          </select>
          <button className="kit-btn danger" title={t('copyTeamHelp')} onClick={copyToTarget}>
            {t('copyTeamTo')}
          </button>
          <button
            className="kit-btn"
            title={t('swapTeamHelp')}
            onClick={() => handleCopyTeam(teamIndex, copyTarget, true)}
          >
            {t('swapTeamWith')}
          </button>
        </div>

        {/* Team Stats Summary */}
        <div className="preview-summary">
          <div className="preview-stat-card">
            <div className="preview-stat-label">{t('shooting')}</div>
            <div className="preview-stat-value" style={{ color: 'var(--stat-shooting)' }}>
              {avgShooting}
            </div>
          </div>
          <div className="preview-stat-card">
            <div className="preview-stat-label">{t('speed')}</div>
            <div className="preview-stat-value" style={{ color: 'var(--stat-speed)' }}>
              {avgSpeed}
            </div>
          </div>
          <div className="preview-stat-card">
            <div className="preview-stat-label">{t('stamina')}</div>
            <div className="preview-stat-value" style={{ color: 'var(--stat-stamina)' }}>
              {avgStamina}
            </div>
          </div>
          <div className="preview-stat-card">
            <div className="preview-stat-label">{t('technique')}</div>
            <div className="preview-stat-value" style={{ color: 'var(--stat-technique)' }}>
              {avgTechnique}
            </div>
          </div>
          <div className="preview-stat-card">
            <div className="preview-stat-label">{t('name')}</div>
            <div className="preview-stat-value preview-stat-value--text">
              {team.teamNameText || team.name}
            </div>
          </div>
        </div>

        {/* Flag and kits drawn with the game's graphics */}
        <div className="preview-kits">
          <FlagCanvas
            grid={team.flagDesign?.grid}
            colors={team.flagColors}
            scale={4}
            label={t('flagPreview')}
          />
          <PlayerKitPreview
            team={team}
            teamIndex={teamIndex}
            kits={['home', 'away', 'goalkeeper']}
            views={['front']}
            scale={2}
          />
        </div>

        {/* Player Cards Grid */}
        <div className="preview-players-grid">
          {team.players.map((player, idx) => (
            <div key={idx} className="preview-player-card">
              {/* Mini kit */}
              <div className="preview-kit-mini">
                <svg width="28" height="36" viewBox="0 0 28 36">
                  <path
                    d="M7,6 L5,7 L3,12 L5,13 L6,10 L6,22 L22,22 L22,10 L23,13 L25,12 L23,7 L21,6 L18,5 L16,6 L12,6 L10,5 Z"
                    fill={shirtColor}
                    stroke={shirtDetail}
                    strokeWidth="0.8"
                  />
                  <path d="M6,22 L6,30 L13,30 L14,23 L15,30 L22,30 L22,22 Z" fill={shortsColor} />
                  <text
                    x="14"
                    y="17"
                    textAnchor="middle"
                    fontSize="6"
                    fontWeight="bold"
                    fill={shirtDetail}
                  >
                    {player.number}
                  </text>
                </svg>
              </div>

              {/* Info */}
              <div className="preview-player-info">
                <div className="preview-player-name">{player.name || '---'}</div>
                <div className="preview-player-pos">
                  <span className={`pos-badge pos-${getPositionCategory(idx)}`}>
                    {getPositionLabel(idx)}
                  </span>
                  <span className="preview-player-hair">
                    {HAIR_STYLES[player.hairStyle]
                      ? lang === 'en'
                        ? HAIR_STYLES[player.hairStyle].nameEn
                        : HAIR_STYLES[player.hairStyle].name
                      : ''}
                  </span>
                </div>
              </div>

              {/* Stats bars */}
              <div className="preview-player-stats">
                <MiniBar
                  value={player.shooting}
                  max={15}
                  color="var(--stat-shooting)"
                  label={t('shooting')}
                />
                <MiniBar
                  value={player.speed}
                  max={16}
                  color="var(--stat-speed)"
                  label={t('speed')}
                />
                <MiniBar
                  value={player.stamina}
                  max={16}
                  color="var(--stat-stamina)"
                  label={t('stamina')}
                />
                <MiniBar
                  value={player.technique}
                  max={15}
                  color="var(--stat-technique)"
                  label={t('technique')}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** `label` is the full attribute name: its first letter is shown, the rest goes in the tooltip */
function MiniBar({ value, max, color, label }) {
  const pct = (value / max) * 100;
  return (
    <div className="preview-mini-bar" title={`${label}: ${value}`}>
      <span className="preview-mini-label" aria-hidden="true">
        {label.charAt(0).toUpperCase()}
      </span>
      <div className="preview-mini-track">
        <div className="preview-mini-fill" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="preview-mini-value">{value}</span>
    </div>
  );
}
