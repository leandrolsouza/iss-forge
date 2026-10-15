import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { useRom } from '../context/RomContext';
import { useToast } from '../context/ToastContext';
import { useGuardDrafts, DraftGuard } from '../context/ConfirmContext';
import RomParser from '../rom/RomParser';
import { TEAMS, SCENARIO_DATA } from '../rom/constants';
import {
  decodeClock,
  encodeClock,
  clockToSeconds,
  secondsToClock,
  wrapScenarioText,
  findInvalidChars,
  validateScenario,
  measureScenarioTexts,
  TEXT_CAPACITY,
} from '../rom/scenario';
import { IconScenario } from './Icons';
import GameTextPreview from './GameTextPreview';
import '../styles/scenario.css';

const DEFAULT_GAP = 10; // seconds between the displayed clock and the final whistle in the originals

const fmtClock = (word) => {
  const { minutes, seconds } = decodeClock(word);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const clamp = (v, min, max) => Math.max(min, Math.min(max, Number.isFinite(v) ? v : min));

export default function ScenarioEditor() {
  const { t } = useI18n();
  const toast = useToast();
  const guardDrafts = useGuardDrafts();
  const { romParser, scenarios, teams, handleScenarioChange } = useRom();
  const [selected, setSelected] = useState(0);
  const [draft, setDraft] = useState(null);
  const [linkClocks, setLinkClocks] = useState(true);

  const originals = useMemo(
    () => (romParser ? new RomParser(romParser.getOriginalData()).readScenarios() : []),
    [romParser],
  );

  // Reset the draft when switching scenario or when ROM state changes (apply, undo/redo)
  useEffect(() => {
    const sc = scenarios[selected];
    if (!sc) return;
    setDraft({ ...sc });
    setLinkClocks(
      sc.displayClock !== 0 &&
        clockToSeconds(sc.matchClock) - clockToSeconds(sc.displayClock) === DEFAULT_GAP,
    );
  }, [scenarios, selected]);

  const warnings = useMemo(() => (draft ? validateScenario(draft) : []), [draft]);
  const textUsage = useMemo(() => {
    if (!draft) return 0;
    const texts = scenarios.map((s, i) => (i === selected ? draft.text : s.text));
    return measureScenarioTexts(texts);
  }, [draft, scenarios, selected]);

  if (!romParser || !scenarios.length || !draft) {
    return <div className="editor-panel empty">{t('openRomToSee')}</div>;
  }

  const teamName = (index) => teams[index]?.name || TEAMS[index]?.name || '?';
  const current = scenarios[selected];
  const dirty = JSON.stringify(draft) !== JSON.stringify(current);
  const previewLines = wrapScenarioText(draft.text).slice(0, SCENARIO_DATA.TEXT_LINES + 2);
  const invalidChars = findInvalidChars(draft.text);
  const overCapacity = textUsage > TEXT_CAPACITY;

  const update = (patch) => {
    setDraft((d) => ({ ...d, ...patch }));
  };

  const setDisplayClock = (minutes, seconds) => {
    const displayClock = encodeClock(minutes, seconds);
    const patch = { displayClock };
    if (linkClocks) patch.matchClock = secondsToClock(clockToSeconds(displayClock) + DEFAULT_GAP);
    update(patch);
  };

  const apply = () => {
    const res = handleScenarioChange(selected, draft);
    toast[res.ok ? 'success' : 'error'](t(res.ok ? 'scenarioApplied' : res.error));
  };

  const restoreOriginal = () => {
    const o = originals[selected];
    if (o) update({ ...o, index: selected });
  };

  const copySituation = (fromIndex) => {
    const o = originals[fromIndex];
    if (o) update({ state: o.state, flag: o.flag, ballX: o.ballX, ballY: o.ballY });
  };

  const display = decodeClock(draft.displayClock);
  const match = decodeClock(draft.matchClock);

  return (
    <div className="editor-panel scenario-editor">
      <DraftGuard dirty={dirty} />
      <div className="editor-header">
        <div className="editor-header-title">
          <span className="editor-icon">
            <IconScenario size={18} />
          </span>
          <h2>{t('editorScenarios')}</h2>
          <span className="editor-subtitle">- {t('scenarioSubtitle')}</span>
        </div>
      </div>

      <div className="scenario-body">
        <div className="scenario-list">
          {scenarios.map((sc, i) => (
            <button
              key={i}
              className={`scenario-card ${i === selected ? 'active' : ''}`}
              onClick={async () => {
                if (i === selected) return;
                if (dirty && !(await guardDrafts())) return;
                setSelected(i);
              }}
            >
              <span className="scenario-card-num">#{i + 1}</span>
              <span className="scenario-card-match">
                {teamName(sc.team1)} <strong>{sc.goals1}</strong> x <strong>{sc.goals2}</strong>{' '}
                {teamName(sc.team2)}
              </span>
              <span className="scenario-card-clock">
                {sc.displayClock ? fmtClock(sc.displayClock) : t('scenarioNoClock')}
              </span>
            </button>
          ))}
          <div className={`scenario-capacity ${overCapacity ? 'over' : ''}`}>
            {t('scenarioTextSpace')}: {textUsage} / {TEXT_CAPACITY} bytes
          </div>
        </div>

        <div className="scenario-form">
          <div className="detail-section">
            <div className="detail-section-title">
              {t('scenarioLabel')} #{selected + 1}
            </div>

            <div className="scenario-teams">
              <div className="scenario-team">
                <label className="scenario-field">
                  <span>{t('scenarioTeam1')}</span>
                  <select
                    className="input-stat"
                    value={draft.team1}
                    onChange={(e) => update({ team1: parseInt(e.target.value, 10) })}
                  >
                    {TEAMS.map((tm, i) => (
                      <option key={tm.id} value={i}>
                        {teamName(i)}
                      </option>
                    ))}
                  </select>
                </label>
                <input
                  type="number"
                  className="scenario-goals"
                  min={0}
                  max={SCENARIO_DATA.MAX_GOALS}
                  value={draft.goals1}
                  aria-label={t('scenarioGoals1')}
                  onChange={(e) =>
                    update({
                      goals1: clamp(parseInt(e.target.value, 10), 0, SCENARIO_DATA.MAX_GOALS),
                    })
                  }
                />
              </div>
              <span className="scenario-x">x</span>
              <div className="scenario-team">
                <input
                  type="number"
                  className="scenario-goals"
                  min={0}
                  max={SCENARIO_DATA.MAX_GOALS}
                  value={draft.goals2}
                  aria-label={t('scenarioGoals2')}
                  onChange={(e) =>
                    update({
                      goals2: clamp(parseInt(e.target.value, 10), 0, SCENARIO_DATA.MAX_GOALS),
                    })
                  }
                />
                <label className="scenario-field">
                  <span>{t('scenarioTeam2')}</span>
                  <select
                    className="input-stat"
                    value={draft.team2}
                    onChange={(e) => update({ team2: parseInt(e.target.value, 10) })}
                  >
                    {TEAMS.map((tm, i) => (
                      <option key={tm.id} value={i}>
                        {teamName(i)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <p className="scenario-hint">{t('scenarioTeam1Help')}</p>

            <div className="scenario-clocks">
              <div className="scenario-field">
                <span>{t('scenarioDisplayClock')}</span>
                <ClockInput
                  minutes={display.minutes}
                  seconds={display.seconds}
                  onChange={setDisplayClock}
                />
              </div>
              <div className="scenario-field">
                <span>{t('scenarioMatchClock')}</span>
                <ClockInput
                  minutes={match.minutes}
                  seconds={match.seconds}
                  disabled={linkClocks}
                  onChange={(m, s) => update({ matchClock: encodeClock(m, s) })}
                />
              </div>
              <label className="scenario-check">
                <input
                  type="checkbox"
                  checked={linkClocks}
                  onChange={(e) => {
                    setLinkClocks(e.target.checked);
                    if (e.target.checked) {
                      update({
                        matchClock: secondsToClock(
                          clockToSeconds(draft.displayClock) + DEFAULT_GAP,
                        ),
                      });
                    }
                  }}
                />
                {t('scenarioLinkClocks')}
              </label>
            </div>
            <p className="scenario-hint">{t('scenarioClockHelp')}</p>
          </div>

          <div className="detail-section">
            <div className="detail-section-title">{t('scenarioText')}</div>
            <div className="scenario-text-row">
              <textarea
                className="scenario-textarea"
                rows={8}
                value={draft.text}
                onChange={(e) => update({ text: e.target.value })}
                spellCheck={false}
              />
              <div className="scenario-preview" aria-label={t('scenarioPreview')}>
                <GameTextPreview
                  kind="box"
                  text={draft.text}
                  box={{ lines: SCENARIO_DATA.TEXT_LINES, columns: SCENARIO_DATA.TEXT_COLUMNS }}
                  label={t('scenarioPreview')}
                />
                {previewLines.length > SCENARIO_DATA.TEXT_LINES && (
                  <div className="scenario-preview-overflow">{t('scenarioTooManyLines')}</div>
                )}
              </div>
            </div>
            <p className="scenario-hint">{t('scenarioTextHelp')}</p>
            {invalidChars.length > 0 && (
              <p className="scenario-warning">
                {t('scenarioInvalidChars')}: {invalidChars.join(' ')}
              </p>
            )}
          </div>

          <details className="detail-section scenario-advanced">
            <summary>{t('scenarioAdvanced')}</summary>
            <p className="scenario-hint">{t('scenarioAdvancedHelp')}</p>
            <label className="scenario-field">
              <span>{t('scenarioCopySituation')}</span>
              <select
                className="input-stat"
                value=""
                onChange={(e) =>
                  e.target.value !== '' && copySituation(parseInt(e.target.value, 10))
                }
              >
                <option value="">—</option>
                {originals.map((o, i) => (
                  <option key={i} value={i}>
                    #{i + 1} {TEAMS[o.team1]?.name} x {TEAMS[o.team2]?.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="scenario-grid4">
              {[
                ['state', t('scenarioState'), 0xff],
                ['flag', t('scenarioFlag'), 0xff],
                ['ballX', t('scenarioBallX'), 0xffff],
                ['ballY', t('scenarioBallY'), 0xffff],
              ].map(([key, label, max]) => (
                <label key={key} className="scenario-field">
                  <span>{label}</span>
                  <input
                    type="number"
                    className="input-mini"
                    min={0}
                    max={max}
                    value={draft[key]}
                    onChange={(e) => update({ [key]: clamp(parseInt(e.target.value, 10), 0, max) })}
                  />
                </label>
              ))}
            </div>
          </details>

          {warnings.length > 0 && (
            <div className="scenario-warnings">
              {warnings.map((w) => (
                <div key={w}>{t(w)}</div>
              ))}
            </div>
          )}

          <div className="scenario-actions">
            <button
              className="kit-btn active"
              onClick={apply}
              disabled={!dirty || overCapacity || warnings.includes('scenarioTooManyLines')}
            >
              {t('scenarioApply')}
            </button>
            <button className="kit-btn" onClick={() => setDraft({ ...current })} disabled={!dirty}>
              {t('scenarioDiscard')}
            </button>
            <button className="kit-btn" onClick={restoreOriginal}>
              {t('scenarioRestore')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ClockInput({ minutes, seconds, onChange, disabled }) {
  return (
    <div className="scenario-clock">
      <input
        type="number"
        className="input-mini"
        min={0}
        max={SCENARIO_DATA.MAX_MINUTES}
        value={minutes}
        disabled={disabled}
        onChange={(e) =>
          onChange(clamp(parseInt(e.target.value, 10), 0, SCENARIO_DATA.MAX_MINUTES), seconds)
        }
      />
      <span>:</span>
      <input
        type="number"
        className="input-mini"
        min={0}
        max={59}
        value={String(seconds).padStart(2, '0')}
        disabled={disabled}
        onChange={(e) => onChange(minutes, clamp(parseInt(e.target.value, 10), 0, 59))}
      />
    </div>
  );
}
