import React, { useState } from 'react';
import { HAIR_STYLES, SHOOTING_VALUES, TEAM_FORMATIONS } from '../rom/constants';
import { useI18n } from '../i18n';
import { IconPlayers } from './Icons';

function HelpTooltip({ text }) {
  return (
    <span className="help-tooltip-wrapper">
      <span className="help-icon">?</span>
      <span className="help-tooltip">{text}</span>
    </span>
  );
}

export default function PlayerEditor({ team, teamIndex, onPlayerChange }) {
  const [selectedPlayer, setSelectedPlayer] = useState(0);
  const { t, lang } = useI18n();

  if (!team || !team.players) {
    return <div className="editor-panel empty">{t('openRomToSee')}</div>;
  }

  const player = team.players[selectedPlayer];

  const handleNameChange = (playerIndex, value) => {
    // Limit to 8 chars, allow letters, digits, and supported special chars
    const sanitized = value.slice(0, 8).replace(/[^A-Za-z0-9 .'"/]/g, '');
    onPlayerChange(teamIndex, playerIndex, 'name', sanitized);
  };

  const handleNumberChange = (playerIndex, value) => {
    const num = Math.max(1, Math.min(16, parseInt(value) || 1));
    onPlayerChange(teamIndex, playerIndex, 'number', num);
  };

  const handleStatChange = (playerIndex, field, value) => {
    const val = parseInt(value);
    if (field === 'shootingIndex' || field === 'techniqueIndex') {
      onPlayerChange(teamIndex, playerIndex, field, Math.max(0, Math.min(7, val)));
    } else if (field === 'stamina') {
      onPlayerChange(teamIndex, playerIndex, field, Math.max(1, Math.min(16, val)));
    } else if (field === 'speed') {
      onPlayerChange(teamIndex, playerIndex, field, Math.max(1, Math.min(16, val)));
    }
  };

  const handleHairChange = (playerIndex, value) => {
    onPlayerChange(teamIndex, playerIndex, 'hairStyle', parseInt(value));
  };

  const handleColorChange = (playerIndex, value) => {
    onPlayerChange(teamIndex, playerIndex, 'isSpecial', value === 'true');
  };

  const getPositionLabel = (idx) => {
    if (idx >= 11) return 'SUB';
    const teamFormation = TEAM_FORMATIONS[teamIndex];
    if (teamFormation && teamFormation.positions[idx]) {
      return teamFormation.positions[idx];
    }
    // Fallback
    if (idx === 0) return 'GK';
    if (idx <= 4) return 'DEF';
    if (idx <= 9) return 'MID';
    return 'FWD';
  };

  const getPositionCategory = (pos) => {
    if (pos === 'GK') return 'gk';
    if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(pos)) return 'def';
    if (['CM', 'DM', 'AM', 'LM', 'RM'].includes(pos)) return 'mid';
    if (['ST', 'CF', 'LW', 'RW'].includes(pos)) return 'fwd';
    if (pos === 'SUB') return 'sub';
    return 'mid';
  };

  return (
    <div className="editor-panel player-editor">
      {/* Team Header */}
      <div className="editor-header">
        <div className="editor-header-title">
          <span className="editor-icon"><IconPlayers size={18} /></span>
          <h2>{team.name}</h2>
          <span className="editor-subtitle">
            - {t('squad')} ({team.players.length} {t('players')}) &middot;{' '}
            {TEAM_FORMATIONS[teamIndex]?.formation || '4-4-2'}
          </span>
        </div>
      </div>

      <div className="player-editor-body">
        {/* Player List Table */}
        <div className="player-table-container">
          <table className="player-table">
            <thead>
              <tr>
                <th className="col-idx">#</th>
                <th className="col-pos">
                  {t('pos')}
                  <HelpTooltip text={t('helpPos')} />
                </th>
                <th className="col-num">
                  {t('num')}
                  <HelpTooltip text={t('helpNum')} />
                </th>
                <th className="col-name">
                  {t('name')}
                  <HelpTooltip text={t('helpName')} />
                </th>
                <th className="col-stat">
                  {t('shooting')}
                  <HelpTooltip text={t('helpShooting')} />
                </th>
                <th className="col-stat">
                  {t('speed')}
                  <HelpTooltip text={t('helpSpeed')} />
                </th>
                <th className="col-stat">
                  {t('stamina')}
                  <HelpTooltip text={t('helpStamina')} />
                </th>
                <th className="col-stat">
                  {t('technique')}
                  <HelpTooltip text={t('helpTechnique')} />
                </th>
                <th className="col-hair">
                  {t('hair')}
                  <HelpTooltip text={t('helpHair')} />
                </th>
                <th className="col-color">
                  {t('type')}
                  <HelpTooltip text={t('helpType')} />
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="player-table-divider">
                <td colSpan={10}>
                  <div className="divider-label">{t('starting')}</div>
                </td>
              </tr>
              {team.players.map((p, idx) => (
                <React.Fragment key={idx}>
                  {idx === 11 && (
                    <tr className="player-table-divider">
                      <td colSpan={10}>
                        <div className="divider-label">{t('substitutes')}</div>
                      </td>
                    </tr>
                  )}
                  <tr
                    className={`player-row ${idx === selectedPlayer ? 'selected' : ''}`}
                    onClick={() => setSelectedPlayer(idx)}
                  >
                    <td className="col-idx">{idx + 1}</td>
                    <td className="col-pos">
                      <span
                        className={`pos-badge pos-${getPositionCategory(getPositionLabel(idx))}`}
                      >
                        {getPositionLabel(idx)}
                      </span>
                    </td>
                    <td className="col-num">
                      <input
                        type="number"
                        className="input-mini"
                        value={p.number}
                        min={1}
                        max={16}
                        onChange={(e) => handleNumberChange(idx, e.target.value)}
                      />
                    </td>
                    <td className="col-name">
                      <input
                        type="text"
                        className="input-name"
                        value={p.name}
                        maxLength={8}
                        onChange={(e) => handleNameChange(idx, e.target.value)}
                      />
                    </td>
                    <td className="col-stat">
                      <select
                        className="input-stat"
                        value={p.shootingIndex}
                        onChange={(e) => handleStatChange(idx, 'shootingIndex', e.target.value)}
                      >
                        {SHOOTING_VALUES.map((val, i) => (
                          <option key={i} value={i}>
                            {val}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="col-stat">
                      <input
                        type="number"
                        className="input-mini"
                        value={p.speed}
                        min={1}
                        max={16}
                        onChange={(e) => handleStatChange(idx, 'speed', e.target.value)}
                      />
                    </td>
                    <td className="col-stat">
                      <input
                        type="number"
                        className="input-mini"
                        value={p.stamina}
                        min={1}
                        max={16}
                        onChange={(e) => handleStatChange(idx, 'stamina', e.target.value)}
                      />
                    </td>
                    <td className="col-stat">
                      <select
                        className="input-stat"
                        value={p.techniqueIndex}
                        onChange={(e) => handleStatChange(idx, 'techniqueIndex', e.target.value)}
                      >
                        {SHOOTING_VALUES.map((val, i) => (
                          <option key={i} value={i}>
                            {val}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="col-hair">
                      <select
                        className="input-hair"
                        value={p.hairStyle}
                        onChange={(e) => handleHairChange(idx, e.target.value)}
                      >
                        {HAIR_STYLES.map((h) => (
                          <option key={h.id} value={h.id}>
                            {lang === 'en' ? h.nameEn : h.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="col-color">
                      <select
                        className="input-color-type"
                        value={String(p.isSpecial)}
                        onChange={(e) => handleColorChange(idx, e.target.value)}
                      >
                        <option value="false">{t('normal')}</option>
                        <option value="true">{t('special')}</option>
                      </select>
                    </td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Player Detail Panel */}
        <div className="player-detail-panel">
          <div className="detail-header">
            <h3>{t('playerDetails')}</h3>
          </div>
          {player && (
            <div className="detail-content">
              <div className="detail-card">
                <div className="detail-player-name">{player.name || '---'}</div>
                <div className="detail-player-number">#{player.number}</div>
              </div>

              <div className="detail-section">
                <div className="detail-section-title-row">
                  {t('attributes')}
                  <HelpTooltip text={t('helpAttributes')} />
                </div>
                <div className="stat-bars">
                  <StatBar label={t('shooting')} value={player.shooting} max={15} color="#4fc3f7" />
                  <StatBar label={t('speed')} value={player.speed} max={16} color="#81c784" />
                  <StatBar label={t('stamina')} value={player.stamina} max={16} color="#ffb74d" />
                  <StatBar
                    label={t('technique')}
                    value={player.technique}
                    max={15}
                    color="#ce93d8"
                  />
                </div>
              </div>

              <div className="detail-section">
                <div className="detail-section-title-row">
                  {t('appearance')}
                  <HelpTooltip text={t('helpAppearance')} />
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t('hairColor')}:</span>
                  <span className="detail-value">
                    {HAIR_STYLES[player.hairStyle]
                      ? lang === 'en'
                        ? HAIR_STYLES[player.hairStyle].nameEn
                        : HAIR_STYLES[player.hairStyle].name
                      : t('unknown')}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t('type')}:</span>
                  <span className={`detail-value badge ${player.isSpecial ? 'special' : 'normal'}`}>
                    {player.isSpecial ? t('special') : t('normal')}
                  </span>
                </div>
              </div>

              <div className="detail-section">
                <div className="detail-section-title-row">
                  {t('listPosition')}
                  <HelpTooltip text={t('helpListPosition')} />
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t('pos')}:</span>
                  <span className="detail-value">
                    <span
                      className={`pos-badge pos-${getPositionCategory(getPositionLabel(selectedPlayer))}`}
                    >
                      {getPositionLabel(selectedPlayer)}
                    </span>
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t('formation')}:</span>
                  <span className="detail-value">
                    {TEAM_FORMATIONS[teamIndex]?.formation || '4-4-2'}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t('index')}:</span>
                  <span className="detail-value">
                    {selectedPlayer + 1} {t('of')} 15
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatBar({ label, value, max, color }) {
  const percentage = (value / max) * 100;
  return (
    <div className="stat-bar-row">
      <span className="stat-bar-label">{label}</span>
      <div className="stat-bar-track">
        <div
          className="stat-bar-fill"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
      <span className="stat-bar-value">{value}</span>
    </div>
  );
}
