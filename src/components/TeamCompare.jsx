import React, { useState } from 'react';
import { TEAMS, SHOOTING_VALUES } from '../rom/constants';
import { useI18n } from '../i18n';

export default function TeamCompare({ teams }) {
  const { t } = useI18n();
  const [teamAIndex, setTeamAIndex] = useState(0);
  const [teamBIndex, setTeamBIndex] = useState(1);

  if (!teams || teams.length === 0) {
    return <div className="editor-panel empty">{t('noRomLoaded')}</div>;
  }

  const teamA = teams[teamAIndex];
  const teamB = teams[teamBIndex];

  const calcAvg = (team, field) => {
    if (!team?.players) return 0;
    return (team.players.reduce((s, p) => s + (p[field] || 0), 0) / 15);
  };

  const stats = [
    { key: 'shooting', label: t('avgShooting'), max: 15, color: '#4fc3f7' },
    { key: 'speed', label: t('avgSpeed'), max: 16, color: '#81c784' },
    { key: 'stamina', label: t('avgStamina'), max: 16, color: '#ffb74d' },
    { key: 'technique', label: t('avgTechnique'), max: 15, color: '#ce93d8' },
  ];

  return (
    <div className="editor-panel team-compare-panel">
      <div className="editor-header">
        <div className="editor-header-title">
          <span className="editor-icon">&#9878;</span>
          <h2>{t('compare')}</h2>
        </div>
      </div>

      <div className="compare-body">
        {/* Team Selectors */}
        <div className="compare-selectors">
          <div className="compare-selector">
            <label>{t('selectTeamA')}</label>
            <select value={teamAIndex} onChange={(e) => setTeamAIndex(parseInt(e.target.value))}>
              {teams.map((team, i) => (
                <option key={i} value={i}>{String(i + 1).padStart(2, '0')}. {team.name}</option>
              ))}
            </select>
          </div>
          <div className="compare-vs">VS</div>
          <div className="compare-selector">
            <label>{t('selectTeamB')}</label>
            <select value={teamBIndex} onChange={(e) => setTeamBIndex(parseInt(e.target.value))}>
              {teams.map((team, i) => (
                <option key={i} value={i}>{String(i + 1).padStart(2, '0')}. {team.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Stats Comparison Bars */}
        <div className="compare-stats">
          {stats.map((stat) => {
            const avgA = calcAvg(teamA, stat.key);
            const avgB = calcAvg(teamB, stat.key);
            const diff = avgA - avgB;
            const pctA = (avgA / stat.max) * 100;
            const pctB = (avgB / stat.max) * 100;

            return (
              <div key={stat.key} className="compare-stat-row">
                <div className="compare-stat-value left">{avgA.toFixed(1)}</div>
                <div className="compare-stat-bar-container">
                  <div className="compare-stat-label">{stat.label}</div>
                  <div className="compare-bars">
                    <div className="compare-bar-wrapper left">
                      <div
                        className="compare-bar left"
                        style={{ width: `${pctA}%`, backgroundColor: stat.color }}
                      />
                    </div>
                    <div className="compare-bar-wrapper right">
                      <div
                        className="compare-bar right"
                        style={{ width: `${pctB}%`, backgroundColor: stat.color, opacity: 0.6 }}
                      />
                    </div>
                  </div>
                  <div className={`compare-diff ${diff > 0 ? 'positive' : diff < 0 ? 'negative' : ''}`}>
                    {diff > 0 ? '+' : ''}{diff.toFixed(1)}
                  </div>
                </div>
                <div className="compare-stat-value right">{avgB.toFixed(1)}</div>
              </div>
            );
          })}
        </div>

        {/* Player-by-player comparison table */}
        <div className="compare-players">
          <div className="compare-players-header">
            <span className="compare-team-name">{teamA?.name}</span>
            <span className="compare-pos-label">#</span>
            <span className="compare-team-name">{teamB?.name}</span>
          </div>
          {Array.from({ length: 15 }).map((_, idx) => {
            const pA = teamA?.players?.[idx];
            const pB = teamB?.players?.[idx];
            if (!pA || !pB) return null;
            const totalA = pA.shooting + pA.speed + pA.stamina + pA.technique;
            const totalB = pB.shooting + pB.speed + pB.stamina + pB.technique;

            return (
              <div key={idx} className="compare-player-row">
                <div className="compare-player left">
                  <span className="compare-player-name">{pA.name}</span>
                  <span className="compare-player-total">{totalA}</span>
                </div>
                <div className="compare-player-idx">{idx + 1}</div>
                <div className="compare-player right">
                  <span className="compare-player-total">{totalB}</span>
                  <span className="compare-player-name">{pB.name}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
