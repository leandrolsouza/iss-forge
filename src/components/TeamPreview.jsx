import React from 'react';
import { HAIR_STYLES, SHOOTING_VALUES } from '../rom/constants';
import { useI18n } from '../i18n';
import { useRom } from '../context/RomContext';

export default function TeamPreview({ team, teamIndex }) {
  const { t, lang } = useI18n();
  const { handleExportTeam, handleImportTeam } = useRom();

  if (!team || !team.players) {
    return <div className="editor-panel empty">{t('openRomToSee')}</div>;
  }

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

  const getPositionLabel = (idx) => {
    if (idx === 0) return 'GK';
    if (idx <= 4) return 'DEF';
    if (idx <= 9) return 'MID';
    return 'ATK';
  };

  const getPositionColor = (idx) => {
    if (idx === 0) return '#ffb74d';
    if (idx <= 4) return '#4fc3f7';
    if (idx <= 9) return '#81c784';
    return '#ef5350';
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
          <span className="editor-icon">&#128203;</span>
          <h2>{team.name}</h2>
          <span className="editor-subtitle">- {t('overview')}</span>
        </div>
      </div>

      <div className="team-preview-body">
        {/* Import/Export Actions */}
        <div className="preview-actions">
          <button className="kit-btn active" onClick={() => handleExportTeam(teamIndex)}>
            Export JSON
          </button>
          <button className="kit-btn" onClick={() => handleImportTeam(teamIndex)}>
            Import JSON
          </button>
        </div>

        {/* Team Stats Summary */}
        <div className="preview-summary">
          <div className="preview-stat-card">
            <div className="preview-stat-label">{t('shooting')}</div>
            <div className="preview-stat-value" style={{ color: '#4fc3f7' }}>
              {avgShooting}
            </div>
          </div>
          <div className="preview-stat-card">
            <div className="preview-stat-label">{t('speed')}</div>
            <div className="preview-stat-value" style={{ color: '#81c784' }}>
              {avgSpeed}
            </div>
          </div>
          <div className="preview-stat-card">
            <div className="preview-stat-label">{t('stamina')}</div>
            <div className="preview-stat-value" style={{ color: '#ffb74d' }}>
              {avgStamina}
            </div>
          </div>
          <div className="preview-stat-card">
            <div className="preview-stat-label">{t('technique')}</div>
            <div className="preview-stat-value" style={{ color: '#ce93d8' }}>
              {avgTechnique}
            </div>
          </div>
          <div className="preview-stat-card">
            <div className="preview-stat-label">{t('name')}</div>
            <div className="preview-stat-value" style={{ color: '#fff', fontSize: 14 }}>
              {team.teamNameText || team.name}
            </div>
          </div>
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
                  <span
                    className="preview-pos-badge"
                    style={{ backgroundColor: getPositionColor(idx) }}
                  >
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
                <MiniBar value={player.shooting} max={15} color="#4fc3f7" label="C" />
                <MiniBar value={player.speed} max={16} color="#81c784" label="V" />
                <MiniBar value={player.stamina} max={16} color="#ffb74d" label="S" />
                <MiniBar value={player.technique} max={15} color="#ce93d8" label="T" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MiniBar({ value, max, color, label }) {
  const pct = (value / max) * 100;
  return (
    <div className="preview-mini-bar">
      <span className="preview-mini-label">{label}</span>
      <div className="preview-mini-track">
        <div className="preview-mini-fill" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="preview-mini-value">{value}</span>
    </div>
  );
}
