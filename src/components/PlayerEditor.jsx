import React, { useState } from 'react';
import { HAIR_STYLES, SHOOTING_VALUES } from '../rom/constants';
import { getPositionLabel as slotPositionLabel, getLineCategory } from '../rom/formation';
import { NIBBLE_STATS, INDEX_STATS, clampStat, clampIndex } from '../rom/playerStats';
import { useI18n } from '../i18n';
import { IconPlayers } from './Icons';
import DraftInput from './DraftInput';

/**
 * Editable attribute columns, in table order.
 * kind 'index': 3-bit value (0-7) shown as SHOOTING_VALUES; kind 'nibble': 1-16.
 */
const STAT_COLUMNS = [
  { field: 'shootingIndex', kind: 'index', label: 'shooting', help: 'helpShooting' },
  { field: 'techniqueIndex', kind: 'index', label: 'technique', help: 'helpTechnique' },
  { field: 'stamina', kind: 'nibble', label: 'stamina', help: 'helpStamina' },
  { field: 'acceleration', kind: 'nibble', label: 'statAcceleration', help: 'helpAcceleration' },
  { field: 'topSpeed', kind: 'nibble', label: 'statTopSpeed', help: 'helpTopSpeed' },
  { field: 'dribbleSpeed', kind: 'nibble', label: 'statDribbleSpeed', help: 'helpDribbleSpeed' },
  { field: 'attack', kind: 'nibble', label: 'statAttack', help: 'helpAttack' },
  { field: 'defense', kind: 'nibble', label: 'statDefense', help: 'helpDefense' },
  { field: 'gkKickIndex', kind: 'index', label: 'statGkKick', help: 'helpGkKick' },
];
// #, pos, num, name + stats + hair, type
const TABLE_COLUMNS = 4 + STAT_COLUMNS.length + 2;

function HelpTooltip({ text }) {
  return (
    <span className="help-tooltip-wrapper">
      <span className="help-icon">?</span>
      <span className="help-tooltip">{text}</span>
    </span>
  );
}

const DETAIL_PANEL_KEY = 'iss-forge-player-detail-open';

export default function PlayerEditor({ team, teamIndex, onPlayerChange }) {
  const [selectedPlayer, setSelectedPlayer] = useState(0);
  const [detailOpen, setDetailOpen] = useState(
    () => localStorage.getItem(DETAIL_PANEL_KEY) !== 'false',
  );
  const { t, lang } = useI18n();

  const toggleDetail = (open) => {
    setDetailOpen(open);
    localStorage.setItem(DETAIL_PANEL_KEY, String(open));
  };

  if (!team || !team.players) {
    return <div className="editor-panel empty">{t('openRomToSee')}</div>;
  }

  const player = team.players[selectedPlayer];

  // Text/number fields commit on Enter/blur (see DraftInput): one undo step per edit
  const sanitizeName = (value) => value.slice(0, 8).replace(/[^A-Za-z0-9 .'"/]/g, '');

  const handleNameChange = (playerIndex, value) => {
    onPlayerChange(teamIndex, playerIndex, 'name', sanitizeName(value));
  };

  const handleNumberChange = (playerIndex, value) => {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) return; // emptied field: keep the stored number
    onPlayerChange(teamIndex, playerIndex, 'number', Math.max(1, Math.min(16, parsed)));
  };

  const handleStatChange = (playerIndex, field, value) => {
    if (INDEX_STATS.includes(field)) {
      onPlayerChange(teamIndex, playerIndex, field, clampIndex(value));
    } else if (field === 'stamina' || NIBBLE_STATS.includes(field)) {
      if (value === '' || Number.isNaN(parseInt(value, 10))) return;
      onPlayerChange(teamIndex, playerIndex, field, clampStat(value));
    }
  };

  const handleHairChange = (playerIndex, value) => {
    onPlayerChange(teamIndex, playerIndex, 'hairStyle', parseInt(value));
  };

  const handleColorChange = (playerIndex, value) => {
    onPlayerChange(teamIndex, playerIndex, 'isSpecial', value === 'true');
  };

  // Positions come from the team's formation record in the ROM (slots 1-11)
  const formationSlots = team.formation?.slots || [];
  const formationName = team.formation?.name || '-';

  const getPositionLabel = (idx) => {
    if (idx >= 11) return 'SUB';
    const slot = formationSlots[idx];
    if (slot) return slotPositionLabel(slot);
    return idx === 0 ? 'GK' : '?';
  };

  const getPositionCategory = (idx) => {
    if (idx >= 11) return 'sub';
    const slot = formationSlots[idx];
    return slot ? getLineCategory(slot.line) : 'mid';
  };

  return (
    <div className="editor-panel player-editor">
      {/* Team Header */}
      <div className="editor-header">
        <div className="editor-header-title">
          <span className="editor-icon">
            <IconPlayers size={18} />
          </span>
          <h2>{team.name}</h2>
          <span className="editor-subtitle">
            - {t('squad')} ({team.players.length} {t('players')}) &middot; {formationName}
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
                {STAT_COLUMNS.map((c) => (
                  <th key={c.field} className="col-stat">
                    {t(c.label)}
                    <HelpTooltip text={t(c.help)} />
                  </th>
                ))}
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
                <td colSpan={TABLE_COLUMNS}>
                  <div className="divider-label">{t('starting')}</div>
                </td>
              </tr>
              {team.players.map((p, idx) => (
                <React.Fragment key={idx}>
                  {idx === 11 && (
                    <tr className="player-table-divider">
                      <td colSpan={TABLE_COLUMNS}>
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
                      <span className={`pos-badge pos-${getPositionCategory(idx)}`}>
                        {getPositionLabel(idx)}
                      </span>
                    </td>
                    <td className="col-num">
                      <DraftInput
                        type="number"
                        className="input-mini"
                        value={p.number}
                        min={1}
                        max={16}
                        aria-label={`${t('num')} - ${p.name || idx + 1}`}
                        onCommit={(v) => handleNumberChange(idx, v)}
                      />
                    </td>
                    <td className="col-name">
                      <DraftInput
                        type="text"
                        className="input-name"
                        value={p.name}
                        maxLength={8}
                        spellCheck={false}
                        aria-label={`${t('name')} - ${idx + 1}`}
                        sanitize={sanitizeName}
                        onCommit={(v) => handleNameChange(idx, v)}
                      />
                    </td>
                    {STAT_COLUMNS.map((c) => (
                      <td key={c.field} className="col-stat">
                        {c.kind === 'index' ? (
                          <select
                            className="input-stat"
                            value={p[c.field] ?? 0}
                            aria-label={`${t(c.label)} - ${p.name || idx + 1}`}
                            onChange={(e) => handleStatChange(idx, c.field, e.target.value)}
                          >
                            {SHOOTING_VALUES.map((val, i) => (
                              <option key={i} value={i}>
                                {val}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <DraftInput
                            type="number"
                            className="input-mini"
                            value={p[c.field] ?? 1}
                            min={1}
                            max={16}
                            aria-label={`${t(c.label)} - ${p.name || idx + 1}`}
                            onCommit={(v) => handleStatChange(idx, c.field, v)}
                          />
                        )}
                      </td>
                    ))}
                    <td className="col-hair">
                      <select
                        className="input-hair"
                        value={p.hairStyle}
                        aria-label={`${t('hair')} - ${p.name || idx + 1}`}
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

        {/* Player Detail Panel (collapsible: gives the table room on smaller windows) */}
        {!detailOpen && (
          <button
            className="player-detail-reopen"
            onClick={() => toggleDetail(true)}
            title={t('playerDetailsShow')}
            aria-label={t('playerDetailsShow')}
          >
            <span aria-hidden="true">‹</span>
            <span className="player-detail-reopen-label">{t('playerDetails')}</span>
          </button>
        )}
        {detailOpen && (
          <div className="player-detail-panel">
            <div className="detail-header">
              <h3>{t('playerDetails')}</h3>
              <button
                className="detail-collapse-btn"
                onClick={() => toggleDetail(false)}
                title={t('playerDetailsHide')}
                aria-label={t('playerDetailsHide')}
              >
                ›
              </button>
            </div>
            {player && (
              <div className="detail-content">
                <div className="detail-card">
                  <div className="detail-player-name">{player.name || '---'}</div>
                  <div className="detail-player-number">#{player.number}</div>
                </div>

                <div className="detail-section">
                  <div className="detail-section-title-row">
                    {t('gameDataBars')}
                    <HelpTooltip text={t('helpAttributes')} />
                  </div>
                  <div className="stat-bars">
                    <StatBar
                      label={t('technique')}
                      value={player.technique}
                      max={15}
                      color="var(--stat-technique)"
                    />
                    <StatBar
                      label={t('shooting')}
                      value={player.shooting}
                      max={15}
                      color="var(--stat-shooting)"
                    />
                    <StatBar
                      label={t('speed')}
                      value={player.speed}
                      max={16}
                      color="var(--stat-speed)"
                      title={t('helpSpeed')}
                    />
                    <StatBar
                      label={t('stamina')}
                      value={player.stamina}
                      max={16}
                      color="var(--stat-stamina)"
                    />
                  </div>
                </div>

                <div className="detail-section">
                  <div className="detail-section-title-row">{t('detailedAttributes')}</div>
                  <div className="stat-bars">
                    {NIBBLE_STATS.map((k) => (
                      <StatBar
                        key={k}
                        label={t(`stat${k[0].toUpperCase()}${k.slice(1)}Long`)}
                        value={player[k]}
                        max={16}
                        color={
                          k === 'attack'
                            ? 'var(--stat-attack)'
                            : k === 'defense'
                              ? 'var(--stat-defense)'
                              : 'var(--stat-speed)'
                        }
                      />
                    ))}
                    <StatBar
                      label={t('statGkKickLong')}
                      value={player.gkKick}
                      max={15}
                      color="var(--stat-stamina)"
                      title={t('helpGkKick')}
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
                    <span
                      className={`detail-value badge ${player.isSpecial ? 'special' : 'normal'}`}
                    >
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
                      <span className={`pos-badge pos-${getPositionCategory(selectedPlayer)}`}>
                        {getPositionLabel(selectedPlayer)}
                      </span>
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">{t('formation')}:</span>
                    <span className="detail-value">{formationName}</span>
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
        )}
      </div>
    </div>
  );
}

function StatBar({ label, value, max, color, title }) {
  const percentage = ((value || 0) / max) * 100;
  return (
    <div className="stat-bar-row" title={title}>
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
