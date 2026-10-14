import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { useRom } from '../context/RomContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import useAiSettings from '../hooks/useAiSettings';
import { aiErrorKey, aiErrorDetail } from '../services/aiProviders';
import {
  LEAGUE_LIMITS,
  LEAGUE_SLOTS,
  applyLeague,
  checkLeaguePlan,
  defaultConcurrency,
  generateLeaguePlan,
  generateLeagueTeam,
  leagueBudgets,
  loadLeagueDraft,
  runQueue,
  saveLeagueDraft,
  settleDraftResults,
} from '../services/aiLeague';
import { TEAMS } from '../rom/constants';
import { positionText } from '../rom/formation';
import { wrapDescriptionBody } from '../rom/teamDescription';
import FlagCanvas from './FlagCanvas';
import { IconTrophy } from './Icons';
import '../styles/AIGeneratorPanel.css';
import '../styles/LeagueGeneratorPanel.css';

const rgb = (c) => (c ? `rgb(${c.r},${c.g},${c.b})` : 'transparent');
const average = (list) =>
  list?.length
    ? {
        r: list.reduce((n, c) => n + c.r, 0) / list.length,
        g: list.reduce((n, c) => n + c.g, 0) / list.length,
        b: list.reduce((n, c) => n + c.b, 0) / list.length,
      }
    : null;
const nameChars = (value) => value.toUpperCase().replace(/[^A-Z0-9. ]/g, '');
const PART_LABEL_KEYS = { squad: 'aiPartSquad', look: 'aiPartLook', flag: 'aiPartFlag' };

/**
 * Championship generator: plan of the clubs (reviewed and editable), generation of
 * every team in a queue, and one "apply" for all of them (one undo step).
 * The draft is kept per ROM / project, so a long run can be continued later.
 */
export default function LeagueGeneratorPanel() {
  const { t } = useI18n();
  const {
    romParser,
    teams,
    setTeams,
    markModified,
    pushSnapshot,
    setStatusMessage,
    currentProject,
    romInfo,
  } = useRom();
  const toast = useToast();
  const confirm = useConfirm();
  const settings = useAiSettings();
  const draftKey = currentProject?.id || romInfo?.fileName || 'rom';

  const [request, setRequest] = useState('');
  // { key, request, plan, slots, results: { [index]: { status, team, errors, warnings, error } } }
  const [draft, setDraft] = useState(null);
  const [planning, setPlanning] = useState(false);
  const [planStream, setPlanStream] = useState('');
  const [planAttempt, setPlanAttempt] = useState(null);
  const [running, setRunning] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [live, setLive] = useState({}); // { [index]: { part, attempt, chars } }
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [concurrency, setConcurrency] = useState(() => defaultConcurrency(settings.provider));
  const busy = planning || running;

  const abortRef = useRef(null);
  const stopRef = useRef(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  // The championship being made for this ROM / project
  useEffect(() => {
    const saved = loadLeagueDraft(draftKey);
    setDraft(
      saved?.plan ? { ...saved, key: draftKey, results: settleDraftResults(saved.results) } : null,
    );
    setRequest(saved?.request || '');
    setExpanded(null);
  }, [draftKey]);

  useEffect(() => {
    if (draft && draft.key === draftKey) saveLeagueDraft(draftKey, draft);
  }, [draft, draftKey]);

  useEffect(() => setConcurrency(defaultConcurrency(settings.provider)), [settings.provider]);

  // Stop everything when the panel closes
  useEffect(
    () => () => {
      stopRef.current = true;
      abortRef.current?.abort();
    },
    [],
  );

  const plan = draft?.plan || null;
  const results = draft?.results || {};
  const total = plan?.teams.length || 0;
  const doneCount = plan ? plan.teams.filter((_, i) => results[i]?.team).length : 0;
  const pending = plan
    ? plan.teams.map((_, i) => i).filter((i) => results[i]?.status !== 'done')
    : [];

  // Names checked together against the shared name areas (and duplicates), on every edit
  const issues = useMemo(
    () => (plan && romParser ? checkLeaguePlan(romParser, draft.slots, plan) : null),
    [plan, draft?.slots, romParser],
  );

  const handlePlan = useCallback(async () => {
    if (!request.trim() || busy || !romParser) return;
    if (
      doneCount &&
      !(await confirm({ message: t('aiLeagueReplanConfirm'), confirmLabel: t('aiLeaguePlan') }))
    ) {
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setPlanning(true);
    setError(null);
    setPlanStream('');
    setPlanAttempt(null);
    try {
      const result = await generateLeaguePlan({
        userPrompt: request.trim(),
        settings,
        romParser,
        slots: LEAGUE_SLOTS,
        signal: controller.signal,
        onAttempt: (info) => {
          setPlanAttempt(info);
          setPlanStream('');
        },
        onChunk: (chunk) => setPlanStream((prev) => prev + chunk),
      });
      if (!controller.signal.aborted) {
        setDraft({
          key: draftKey,
          request: request.trim(),
          plan: result.plan,
          slots: [...LEAGUE_SLOTS],
          results: {},
        });
        setExpanded(null);
      }
    } catch (err) {
      if (!controller.signal.aborted && err?.code !== 'cancelled') setError(err);
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setPlanning(false);
      setPlanAttempt(null);
    }
  }, [request, busy, romParser, doneCount, confirm, t, settings, draftKey]);

  const updateTeam = (index, patch) =>
    setDraft((prev) => ({
      ...prev,
      plan: {
        ...prev.plan,
        teams: prev.plan.teams.map((tm, i) => (i === index ? { ...tm, ...patch } : tm)),
      },
    }));

  /** Put club `index` in `slot` (the club that had it takes the old slot) */
  const changeSlot = (index, slot) =>
    setDraft((prev) => {
      const slots = [...prev.slots];
      const other = slots.indexOf(slot);
      if (other >= 0) slots[other] = slots[index];
      slots[index] = slot;
      return { ...prev, slots };
    });

  /**
   * Generate the clubs `indexes`, `concurrency` at a time. `parts` redoes only those
   * steps of clubs already generated (e.g. ['flag'] for the crest).
   */
  const runTeams = useCallback(
    async (indexes, parts = null) => {
      const start = draftRef.current;
      if (!start || !indexes.length || !romParser) return;
      const controller = new AbortController();
      abortRef.current = controller;
      stopRef.current = false;
      setRunning(true);
      setPausing(false);
      setError(null);
      // shares of the shared ROM areas, for every club of the plan
      const budgets = leagueBudgets(romParser, start.slots);
      const setResult = (i, r) =>
        setDraft((prev) => (prev ? { ...prev, results: { ...prev.results, [i]: r } } : prev));
      const setLiveOf = (i, patch) =>
        setLive((prev) => ({ ...prev, [i]: { ...prev[i], ...patch } }));

      await runQueue(
        indexes,
        async (i) => {
          if (controller.signal.aborted) return;
          const current = draftRef.current;
          const previous = current.results[i];
          setResult(i, { ...previous, status: 'running' });
          setLiveOf(i, { part: null, attempt: 1, chars: 0 });
          try {
            const result = await generateLeagueTeam({
              romParser,
              plan: current.plan,
              slots: current.slots,
              index: i,
              userRequest: current.request,
              budgets,
              results: current.results,
              settings,
              ...(parts && previous?.raw
                ? { parts, previous: { raw: previous.raw, parts: previous.parts } }
                : {}),
              signal: controller.signal,
              onStage: ({ part }) => setLiveOf(i, { part, attempt: 1, chars: 0 }),
              onAttempt: ({ attempt }) => setLiveOf(i, { attempt, chars: 0 }),
              onChunk: (chunk) =>
                setLive((prev) => ({
                  ...prev,
                  [i]: { ...prev[i], chars: (prev[i]?.chars || 0) + chunk.length },
                })),
            });
            setResult(i, {
              status: 'done',
              team: result.team,
              // the answer of each step, so one of them can be redone later
              raw: result.raw,
              parts: result.parts,
              errors: result.errors,
              warnings: result.warnings,
              attempts: result.attempts,
            });
          } catch (err) {
            if (controller.signal.aborted || err?.code === 'cancelled') {
              setResult(
                i,
                previous?.team ? { ...previous, status: 'done' } : { status: 'pending' },
              );
            } else {
              setResult(i, {
                ...(previous?.team ? previous : {}),
                status: 'error',
                error: { code: err?.code || 'generic', detail: err?.detail || String(err) },
              });
            }
          } finally {
            setLive((prev) => {
              const next = { ...prev };
              delete next[i];
              return next;
            });
          }
        },
        { concurrency, shouldStop: () => stopRef.current || controller.signal.aborted },
      );

      if (abortRef.current === controller) abortRef.current = null;
      setRunning(false);
      setPausing(false);
    },
    [romParser, settings, concurrency],
  );

  const handlePause = () => {
    stopRef.current = true;
    setPausing(true);
  };

  const handleCancel = () => {
    stopRef.current = true;
    abortRef.current?.abort();
  };

  const handleApply = useCallback(async () => {
    const d = draftRef.current;
    if (!d || !romParser || busy) return;
    const items = d.plan.teams
      .map((entry, i) => ({ entry, i, r: d.results[i] }))
      .filter(({ r }) => r?.team)
      .map(({ entry, i, r }) => ({
        slot: d.slots[i],
        // the names of the plan (they may have been edited after generating)
        team: {
          ...r.team,
          name: entry.name,
          teamNameText: entry.menuName,
          teamNameInGame: entry.inGameName,
        },
      }));
    if (!items.length) return;
    if (
      items.length < d.plan.teams.length &&
      !(await confirm({
        message: t('aiLeagueApplyPartial', { done: items.length, total: d.plan.teams.length }),
        confirmLabel: t('aiLeagueApply'),
      }))
    ) {
      return;
    }
    pushSnapshot(teams); // one undo step for the whole championship
    const { warnings } = applyLeague(romParser, items);
    setTeams(romParser.readAllTeams());
    markModified();
    const message = t('aiLeagueApplied', { count: items.length });
    setStatusMessage(message);
    toast.success(message);
    warnings.forEach((w) => toast.warning(t(w)));
    setDraft((prev) => ({ ...prev, appliedAt: new Date().toISOString() }));
  }, [
    romParser,
    busy,
    confirm,
    t,
    pushSnapshot,
    teams,
    setTeams,
    markModified,
    setStatusMessage,
    toast,
  ]);

  const handleDiscard = useCallback(async () => {
    if (!(await confirm({ message: t('aiLeagueDiscardConfirm'), danger: true }))) return;
    setDraft(null);
    saveLeagueDraft(draftKey, null);
    setExpanded(null);
  }, [confirm, t, draftKey]);

  if (!romParser) {
    return (
      <div className="editor-panel ai-generator-panel empty">
        <p>{t('aiNoRom')}</p>
      </div>
    );
  }

  const competition = plan?.competition || {};
  const mainCount = plan ? plan.teams.filter((tm) => tm.division === 'main').length : 0;

  return (
    <div className="editor-panel league-panel">
      <div className="editor-header">
        <div className="editor-header-title">
          <span className="editor-icon">
            <IconTrophy size={18} />
          </span>
          <h2>{t('aiLeagueTitle')}</h2>
        </div>
      </div>

      <div className="league-body">
        <p className="ai-description">{t('aiLeagueDescription')}</p>

        {/* Request */}
        <div className="league-request">
          <textarea
            className="ai-prompt-input"
            value={request}
            placeholder={t('aiLeaguePlaceholder')}
            onChange={(e) => setRequest(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handlePlan();
            }}
            rows={2}
            disabled={busy}
          />
          <div className="ai-prompt-actions">
            <button
              className="ai-btn ai-btn-primary"
              onClick={handlePlan}
              disabled={busy || !request.trim()}
            >
              {planning ? t('aiLeaguePlanning') : plan ? t('aiLeagueReplan') : t('aiLeaguePlan')}
            </button>
            {planning && (
              <button className="ai-btn ai-btn-secondary" onClick={handleCancel}>
                {t('aiCancel')}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="ai-error">
            <div className="ai-error-friendly">{t(aiErrorKey(error))}</div>
            {aiErrorDetail(error) && (
              <details className="ai-error-details">
                <summary>{t('aiErrorDetails')}</summary>
                <code>{aiErrorDetail(error)}</code>
              </details>
            )}
            <button className="ai-btn ai-btn-small" onClick={() => setError(null)}>
              {t('aiClose')}
            </button>
          </div>
        )}

        {planning && (
          <div className="ai-stream-panel league-plan-stream">
            <div className="ai-stream-header">
              <span className="ai-stream-header-title">{t('aiStreamOutput')}</span>
              {planAttempt?.attempt > 1 && (
                <span className="ai-stream-header-attempt" title={planAttempt.problems.join('\n')}>
                  {t('aiAttempt')
                    .replace('{current}', planAttempt.attempt)
                    .replace('{total}', planAttempt.maxAttempts)}{' '}
                  {t('aiFixing').replace('{count}', planAttempt.problems.length)}
                </span>
              )}
              <span className="ai-stream-header-meta">
                {t('aiStreamTokens').replace('{count}', planStream.length)}
              </span>
            </div>
            <div className="ai-stream-content">
              {planStream}
              <span className="ai-stream-cursor" />
            </div>
          </div>
        )}

        {plan && !planning && (
          <>
            <div className="league-summary">
              <strong>
                {[competition.name, competition.season].filter(Boolean).join(' ') || draft.request}
              </strong>
              <span>
                {mainCount < total
                  ? t('aiLeagueSummary', {
                      total,
                      main: mainCount,
                      lower: total - mainCount,
                      lowerDivision: competition.lowerDivision || t('aiLeagueLower'),
                    })
                  : t('aiLeagueSummaryMain', { total })}
              </span>
              <span className="league-progress">
                {t('aiLeagueProgress', { done: doneCount, total })}
              </span>
            </div>
            <div className="league-progress-bar">
              <div style={{ width: `${total ? (doneCount / total) * 100 : 0}%` }} />
            </div>

            <p className="league-note">{t('aiLeagueUnverified')}</p>

            {issues && (issues.errors.length > 0 || issues.warnings.length > 0) && (
              <details
                className={`ai-preview-issues${issues.errors.length ? ' ai-preview-issues-error' : ''}`}
                open={issues.errors.length > 0}
              >
                <summary>
                  {t('aiLeagueIssues', { count: issues.errors.length + issues.warnings.length })}
                </summary>
                <ul>
                  {[...issues.errors, ...issues.warnings].map((msg, i) => (
                    <li key={i}>{msg}</li>
                  ))}
                </ul>
              </details>
            )}

            <div className="league-toolbar">
              <button
                className="ai-btn ai-btn-primary"
                onClick={() => runTeams(pending)}
                disabled={busy || !pending.length}
              >
                {pending.length
                  ? t('aiLeagueGenerate', { count: pending.length })
                  : t('aiLeagueAllGenerated')}
              </button>
              <label className="league-concurrency" title={t('aiLeagueConcurrencyHint')}>
                {t('aiLeagueConcurrency')}
                <select
                  value={concurrency}
                  onChange={(e) => setConcurrency(Number(e.target.value))}
                  disabled={running}
                >
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              {running && (
                <>
                  <button
                    className="ai-btn ai-btn-secondary"
                    onClick={handlePause}
                    disabled={pausing}
                  >
                    {pausing ? t('aiLeaguePausing') : t('aiLeaguePause')}
                  </button>
                  <button className="ai-btn ai-btn-secondary" onClick={handleCancel}>
                    {t('aiCancel')}
                  </button>
                </>
              )}
              <span className="league-toolbar-spacer" />
              <button
                className="ai-btn ai-btn-primary"
                onClick={handleApply}
                disabled={busy || !doneCount}
              >
                {t('aiLeagueApply')}
              </button>
              <button className="ai-btn ai-btn-secondary" onClick={handleDiscard} disabled={busy}>
                {t('aiLeagueDiscard')}
              </button>
            </div>

            <div className="league-table-wrap">
              <table className="ai-players-table league-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t('aiLeagueColSlot')}</th>
                    <th>{t('aiLeagueColClub')}</th>
                    <th>{t('aiLeagueColMenu')}</th>
                    <th>{t('aiLeagueColScore')}</th>
                    <th>{t('aiLeagueColPos')}</th>
                    <th>{t('aiLeagueColStrength')}</th>
                    <th>{t('aiLeagueColKits')}</th>
                    <th>{t('aiLeagueColStatus')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {plan.teams.map((entry, i) => {
                    const r = results[i];
                    const team = r?.team;
                    const status = r?.status || 'pending';
                    const progress = live[i];
                    const home = team ? average(team.uniforms.home.shirt) : entry.homeShirt;
                    const away = team ? average(team.uniforms.away.shirt) : entry.awayShirt;
                    const open = expanded === i;
                    return (
                      <LeagueRow
                        key={i}
                        t={t}
                        index={i}
                        entry={entry}
                        slot={draft.slots[i]}
                        competition={competition}
                        result={r}
                        team={team}
                        status={status}
                        progress={progress}
                        home={home}
                        away={away}
                        open={open}
                        busy={busy}
                        onToggle={() => setExpanded(open ? null : i)}
                        onChange={(patch) => updateTeam(i, patch)}
                        onSlot={(slot) => changeSlot(i, slot)}
                        onGenerate={() => runTeams([i])}
                        onRedoCrest={() => runTeams([i], ['flag'])}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function LeagueRow({
  t,
  index,
  entry,
  slot,
  competition,
  result,
  team,
  status,
  progress,
  home,
  away,
  open,
  busy,
  onToggle,
  onChange,
  onSlot,
  onGenerate,
  onRedoCrest,
}) {
  const problems = (result?.errors?.length || 0) + (result?.warnings?.length || 0);
  let statusText = t(`aiLeagueStatus_${status}`);
  if (status === 'running' && progress) {
    statusText = [
      progress.part ? t(PART_LABEL_KEYS[progress.part]) : statusText,
      progress.attempt > 1 ? `#${progress.attempt}` : '',
      progress.chars ? `${progress.chars}c` : '',
    ]
      .filter(Boolean)
      .join(' · ');
  }
  return (
    <>
      <tr className={`league-row league-row-${status}`}>
        <td>{index + 1}</td>
        <td>
          <select
            value={slot}
            onChange={(e) => onSlot(Number(e.target.value))}
            disabled={busy}
            title={t('aiLeagueSlotHint')}
          >
            {LEAGUE_SLOTS.map((s) => (
              <option key={s} value={s}>
                {s + 1}. {TEAMS[s].name}
              </option>
            ))}
          </select>
        </td>
        <td>
          <input
            value={entry.name}
            maxLength={LEAGUE_LIMITS.name}
            onChange={(e) => onChange({ name: e.target.value })}
            disabled={busy}
          />
        </td>
        <td>
          <input
            className="league-name-input"
            value={entry.menuName}
            maxLength={LEAGUE_LIMITS.menuName}
            onChange={(e) => onChange({ menuName: nameChars(e.target.value) })}
            disabled={busy}
          />
        </td>
        <td>
          <input
            className="league-name-input league-name-short"
            value={entry.inGameName}
            maxLength={LEAGUE_LIMITS.inGameName}
            onChange={(e) => onChange({ inGameName: nameChars(e.target.value) })}
            disabled={busy}
          />
        </td>
        <td>
          {entry.position}º
          {entry.division === 'lower' && (
            <span className="league-lower" title={competition.lowerDivision}>
              {competition.lowerDivision || t('aiLeagueLower')}
            </span>
          )}
        </td>
        <td>{entry.strength}</td>
        <td>
          <span className="league-kits">
            <span className="ai-swatch" style={{ backgroundColor: rgb(home) }} />
            <span className="ai-swatch" style={{ backgroundColor: rgb(away) }} />
          </span>
        </td>
        <td>
          <span
            className={`league-status league-status-${status}`}
            title={
              result?.error ? `${t(aiErrorKey(result.error))}\n${aiErrorDetail(result.error)}` : ''
            }
          >
            {statusText}
            {status === 'done' && problems > 0 && (
              <span className="league-problems"> ({problems})</span>
            )}
          </span>
        </td>
        <td className="league-actions">
          <button className="ai-btn ai-btn-small" onClick={onToggle} aria-expanded={open}>
            {open ? '▾' : '▸'}
          </button>
          <button className="ai-btn ai-btn-small" onClick={onGenerate} disabled={busy}>
            {team ? t('aiLeagueRedo') : t('aiLeagueGenerateOne')}
          </button>
        </td>
      </tr>
      {open && (
        <tr className="league-details-row">
          <td colSpan={10}>
            <div className="league-details">
              <label className="league-brief">
                <span className="ai-label">{t('aiLeagueBrief')}</span>
                <textarea
                  value={entry.brief}
                  rows={3}
                  maxLength={LEAGUE_LIMITS.brief}
                  onChange={(e) => onChange({ brief: e.target.value })}
                  disabled={busy}
                />
                {entry.stars.length > 0 && (
                  <span className="league-stars">
                    {t('aiLeagueStars')}: {entry.stars.join(', ')}
                  </span>
                )}
              </label>
              {result?.error && (
                <div className="ai-error">
                  <div className="ai-error-friendly">{t(aiErrorKey(result.error))}</div>
                  <code>{aiErrorDetail(result.error)}</code>
                </div>
              )}
              {team && (
                <div className="league-team">
                  <div className="league-team-side">
                    {team.flagDesign && (
                      <FlagCanvas grid={team.flagDesign.grid} colors={team.flagColors} scale={3} />
                    )}
                    {team.crestIdea && <p className="ai-crest-idea">{team.crestIdea}</p>}
                    {result?.raw && (
                      <button className="ai-btn ai-btn-small" onClick={onRedoCrest} disabled={busy}>
                        {t('aiLeagueRedoCrest')}
                      </button>
                    )}
                    <span>{team.formationName || '—'}</span>
                    {team.description && (
                      <div className="ai-preview-description">
                        <span
                          className={`ai-preview-description-title${team.description.titleColor === 0x24 ? ' defensive' : ''}`}
                        >
                          {team.description.title}
                        </span>
                        <pre>{wrapDescriptionBody(team.description.body).join('\n')}</pre>
                      </div>
                    )}
                  </div>
                  <ol className="league-players">
                    {team.players.map((p, k) => (
                      <li key={k}>
                        <span className="league-pos">
                          {p.position ? positionText(p.position, t) : '?'}
                        </span>
                        {p.number}. {p.name}
                      </li>
                    ))}
                  </ol>
                  {problems > 0 && (
                    <details className="ai-preview-issues league-team-issues">
                      <summary>{t('aiAdjustments', { count: problems })}</summary>
                      <ul>
                        {[...(result.errors || []), ...(result.warnings || [])].map((msg, k) => (
                          <li key={k}>{msg}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
