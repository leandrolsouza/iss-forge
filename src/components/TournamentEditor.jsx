import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { useRom } from '../context/RomContext';
import RomParser from '../rom/RomParser';
import { TEAMS, TOURNAMENT_DRAWS } from '../rom/constants';
import { drawGroups, drawCoverage, validateDraws, SELECTABLE_TEAMS } from '../rom/tournament';
import { IconTrophy } from './Icons';
import '../styles/scenario.css';
import '../styles/tournament.css';

const GROUP_LETTERS = 'ABCDEF';

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function TournamentEditor() {
  const { t } = useI18n();
  const { romParser, teams, tournamentDraws, handleTournamentDrawsChange } = useRom();
  const [selected, setSelected] = useState(0);
  const [draft, setDraft] = useState(null);

  const originals = useMemo(
    () => (romParser ? new RomParser(romParser.getOriginalData()).readTournamentDraws() : []),
    [romParser],
  );

  // Reset the draft when switching draw or when ROM state changes (apply, undo/redo)
  useEffect(() => {
    const d = tournamentDraws[selected];
    if (d) setDraft([...d]);
  }, [tournamentDraws, selected]);

  const withDraft = useMemo(
    () => tournamentDraws.map((d, i) => (i === selected && draft ? draft : d)),
    [tournamentDraws, selected, draft],
  );
  const issues = useMemo(() => validateDraws(withDraft), [withDraft]);
  const coverage = useMemo(() => drawCoverage(withDraft), [withDraft]);

  if (!romParser || !tournamentDraws.length || !draft) {
    return <div className="editor-panel empty">{t('openRomToSee')}</div>;
  }

  const teamName = (index) => teams[index]?.name || TEAMS[index]?.name || '?';
  const current = tournamentDraws[selected];
  const dirty = draft.some((v, i) => v !== current[i]);
  const missing = issues.filter((i) => i.code === 'missing');
  const counts = draft.reduce((m, v) => m.set(v, (m.get(v) || 0) + 1), new Map());
  const drawHasIssue = (index) => issues.some((i) => i.draw === index);

  const setSlot = (slot, team) => setDraft((d) => d.map((v, i) => (i === slot ? team : v)));

  const apply = () => handleTournamentDrawsChange({ [selected]: draft });
  const restoreAll = () =>
    handleTournamentDrawsChange(Object.fromEntries(originals.map((d, i) => [i, d])));

  return (
    <div className="editor-panel scenario-editor tournament-editor">
      <div className="editor-header">
        <div className="editor-header-title">
          <span className="editor-icon">
            <IconTrophy size={18} />
          </span>
          <h2>{t('editorTournaments')}</h2>
          <span className="editor-subtitle">- {t('tournamentSubtitle')}</span>
        </div>
      </div>

      <div className="scenario-body">
        <div className="scenario-list tournament-list">
          {tournamentDraws.map((d, i) => (
            <button
              key={i}
              className={`scenario-card tournament-card ${i === selected ? 'active' : ''}`}
              onClick={() => setSelected(i)}
              title={drawGroups(d)
                .map((g, gi) => `${GROUP_LETTERS[gi]}: ${g.map(teamName).join(', ')}`)
                .join('\n')}
            >
              <span className="scenario-card-num">#{i + 1}</span>
              <span className="tournament-card-teams">
                {d.slice(0, 4).map(teamName).join(', ')}…
              </span>
              {drawHasIssue(i) && <span className="tournament-card-warn">!</span>}
            </button>
          ))}
        </div>

        <div className="scenario-form tournament-form">
          <div className="detail-section">
            <div className="detail-section-title">
              {t('tournamentDraw')} #{selected + 1}
            </div>
            <div className="tournament-groups">
              {drawGroups(draft).map((group, g) => (
                <div key={g} className="tournament-group">
                  <div className="tournament-group-title">
                    {t('tournamentGroup')} {GROUP_LETTERS[g]}
                  </div>
                  {group.map((team, k) => {
                    const slot = g * TOURNAMENT_DRAWS.GROUP_SIZE + k;
                    const dup = counts.get(team) > 1;
                    return (
                      <select
                        key={slot}
                        className={`input-stat tournament-slot ${dup ? 'dup' : ''}`}
                        value={team}
                        title={dup ? t('tournamentDuplicate') : undefined}
                        onChange={(e) => setSlot(slot, parseInt(e.target.value, 10))}
                      >
                        {team < 0 && <option value={-1}>?</option>}
                        {TEAMS.map((tm, i) => (
                          <option key={tm.id} value={i}>
                            {teamName(i)}
                          </option>
                        ))}
                      </select>
                    );
                  })}
                </div>
              ))}
            </div>
            <p className="scenario-hint">{t('tournamentHowItWorks')}</p>
          </div>

          {(missing.length > 0 || draft.some((v) => counts.get(v) > 1)) && (
            <div className={missing.length ? 'scenario-msg-error' : 'scenario-warnings'}>
              {missing.length > 0 && (
                <div>
                  {t('tournamentMissing')}: {missing.map((m) => teamName(m.team)).join(', ')}
                </div>
              )}
              {draft.some((v) => counts.get(v) > 1) && <div>{t('tournamentDuplicate')}</div>}
            </div>
          )}

          <div className="scenario-actions">
            <button
              className="kit-btn active"
              onClick={apply}
              disabled={!dirty || missing.length > 0 || draft.includes(-1)}
            >
              {t('scenarioApply')}
            </button>
            <button className="kit-btn" onClick={() => setDraft([...current])} disabled={!dirty}>
              {t('scenarioDiscard')}
            </button>
            <button className="kit-btn" onClick={() => setDraft(shuffle(draft))}>
              {t('tournamentShuffle')}
            </button>
            <button
              className="kit-btn"
              onClick={() => originals[selected] && setDraft([...originals[selected]])}
            >
              {t('scenarioRestore')}
            </button>
            <button className="kit-btn" onClick={restoreAll}>
              {t('tournamentRestoreAll')}
            </button>
          </div>

          <div className="detail-section">
            <div className="detail-section-title">{t('tournamentCoverage')}</div>
            <p className="scenario-hint">{t('tournamentCoverageHelp')}</p>
            <div className="tournament-coverage">
              {SELECTABLE_TEAMS.map((i) => (
                <span key={i} className={`tournament-cov ${coverage[i] === 0 ? 'zero' : ''}`}>
                  {teamName(i)} <strong>{coverage[i]}</strong>
                </span>
              ))}
            </div>
            <p className="scenario-hint">{t('tournamentOrderNote')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
