import React, { useState } from 'react';
import { HAIR_STYLES, SHOOTING_VALUES } from '../rom/constants';
import { useI18n } from '../i18n';

export default function PlayerEditor({ team, teamIndex, onPlayerChange }) {
  const [selectedPlayer, setSelectedPlayer] = useState(0);
  const { t } = useI18n();

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

  return (
    <div className="editor-panel player-editor">
      {/* Team Header */}
      <div className="editor-header">
        <div className="editor-header-title">
          <span className="editor-icon">&#9917;</span>
          <h2>{team.name}</h2>
          <span className="editor-subtitle">- {t('squad')} ({team.players.length} {t('players')})</span>
        </div>
      </div>

      <div className="player-editor-body">
        {/* Player List Table */}
        <div className="player-table-container">
          <table className="player-table">
            <thead>
              <tr>
                <th className="col-idx">#</th>
                <th className="col-num">{t('num')}</th>
                <th className="col-name">{t('name')}</th>
                <th className="col-stat">{t('shooting')}</th>
                <th className="col-stat">{t('speed')}</th>
                <th className="col-stat">{t('stamina')}</th>
                <th className="col-stat">{t('technique')}</th>
                <th className="col-hair">{t('hair')}</th>
                <th className="col-color">{t('type')}</th>
              </tr>
            </thead>
            <tbody>
              {team.players.map((p, idx) => (
                <tr
                  key={idx}
                  className={`player-row ${idx === selectedPlayer ? 'selected' : ''}`}
                  onClick={() => setSelectedPlayer(idx)}
                >
                  <td className="col-idx">{idx + 1}</td>
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
                        <option key={i} value={i}>{val}</option>
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
                        <option key={i} value={i}>{val}</option>
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
                        <option key={h.id} value={h.id}>{h.name}</option>
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
                <div className="detail-section-title">{t('attributes')}</div>
                <div className="stat-bars">
                  <StatBar label={t('shooting')} value={player.shooting} max={15} color="#4fc3f7" />
                  <StatBar label={t('speed')} value={player.speed} max={16} color="#81c784" />
                  <StatBar label={t('stamina')} value={player.stamina} max={16} color="#ffb74d" />
                  <StatBar label={t('technique')} value={player.technique} max={15} color="#ce93d8" />
                </div>
              </div>

              <div className="detail-section">
                <div className="detail-section-title">{t('appearance')}</div>
                <div className="detail-row">
                  <span className="detail-label">{t('hairColor')}:</span>
                  <span className="detail-value">
                    {HAIR_STYLES[player.hairStyle]?.name || 'Desconhecido'}
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
                <div className="detail-section-title">{t('listPosition')}</div>
                <div className="detail-row">
                  <span className="detail-label">{t('index')}:</span>
                  <span className="detail-value">{selectedPlayer + 1} {t('of')} 15</span>
                </div>
                <div className="detail-hint">
                  {selectedPlayer === 0
                    ? t('goalkeeper')
                    : selectedPlayer <= 4
                      ? t('defender')
                      : selectedPlayer <= 9
                        ? t('midfielder')
                        : t('forward')}
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
