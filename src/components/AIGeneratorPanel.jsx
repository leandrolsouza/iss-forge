import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useI18n } from '../i18n';
import { useRom } from '../context/RomContext';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import {
  AI_PARTS,
  buildAiContext,
  cleanOptimizedPrompt,
  generateTeam,
  optimizePrompt,
} from '../services/aiService';
import { SPECIAL_HAIR_KEYS, SPECIAL_SKIN_KEYS } from '../services/aiTeamSchema';
import { aiErrorKey, aiErrorDetail, getProvider, modelForProvider } from '../services/aiProviders';
import { positionText } from '../rom/formation';
import { wrapDescriptionBody } from '../rom/teamDescription';
import { applyImportedTeam } from '../utils/teamExport';
import { sharedKeeperTeams } from '../rom/readers/UniformReader';
import { IconSparkle } from './Icons';
import FlagCanvas from './FlagCanvas';
import '../styles/AIGeneratorPanel.css';

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

/** i18n key of each generation step */
const PART_LABEL_KEYS = { squad: 'aiPartSquad', look: 'aiPartLook' };

const EXAMPLE_KEYS = [
  'aiExample1',
  'aiExample2',
  'aiExample3',
  'aiExample4',
  'aiExample5',
  'aiExample6',
];

const TEMPLATE_CATEGORIES = [
  {
    labelKey: 'aiTemplateCatNational',
    templates: [
      'aiTpl.brazil94',
      'aiTpl.argentina86',
      'aiTpl.holland74',
      'aiTpl.italy06',
      'aiTpl.france98',
    ],
  },
  {
    labelKey: 'aiTemplateCatAllstars',
    templates: ['aiTpl.allstarsSA', 'aiTpl.allstarsEU', 'aiTpl.allstarsAF'],
  },
  {
    labelKey: 'aiTemplateCatFiction',
    templates: [
      'aiTpl.marvel',
      'aiTpl.cyberpunk',
      'aiTpl.anime',
      'aiTpl.medieval',
      'aiTpl.pirates',
    ],
  },
  {
    labelKey: 'aiTemplateCatStyle',
    templates: ['aiTpl.offensive', 'aiTpl.defensive', 'aiTpl.technical'],
  },
  {
    labelKey: 'aiTemplateCatFun',
    templates: ['aiTpl.coders', 'aiTpl.food'],
  },
];

export default function AIGeneratorPanel({ teamIndex }) {
  const { t } = useI18n();
  const { romParser, teams, setTeams, markModified, pushSnapshot, setStatusMessage } = useRom();
  const toast = useToast();

  const team = teams?.[teamIndex];

  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  // { team, raw, parts, errors, warnings, attempts } from generateTeam
  const [result, setResult] = useState(null);
  const generatedTeam = result?.team || null;
  const [error, setError] = useState(null); // { code, detail } (see aiErrorKey)
  // steps already done when a later one failed ({ raw, parts }): "continue" uses them
  const [partial, setPartial] = useState(null);
  const [showTips, setShowTips] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [streamText, setStreamText] = useState('');
  // { part, attempt, maxAttempts, problems } of the request running now
  const [attemptInfo, setAttemptInfo] = useState(null);
  // { part, index, total } of the step running now
  const [stageInfo, setStageInfo] = useState(null);
  // "improve my prompt": the suggestion being written/reviewed, and the user's text
  // before using one (can be restored)
  const [optimizing, setOptimizing] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [originalPrompt, setOriginalPrompt] = useState(null);
  const busy = generating || optimizing;

  const intervalRef = useRef(null);
  const streamContentRef = useRef(null);
  const abortRef = useRef(null); // AbortController of the running generation
  const optimizeAbortRef = useRef(null); // ... and of the running prompt improvement
  const keptRef = useRef(null); // result being regenerated in part
  const { settings: appSettings } = useSettings();

  const settings = useMemo(
    () => ({
      provider: appSettings.aiProvider,
      endpoint: appSettings.aiEndpoint,
      // never a model of another provider (old settings could keep one)
      model: modelForProvider(getProvider(appSettings.aiProvider), appSettings.aiModel),
      apiKey: appSettings.aiApiKey,
      temperature: appSettings.aiTemperature,
      maxTokens: appSettings.aiMaxTokens,
    }),
    [appSettings],
  );

  // Rotate placeholder examples every 5 seconds
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % EXAMPLE_KEYS.length);
    }, 5000);
    return () => clearInterval(intervalRef.current);
  }, []);

  // Auto-scroll stream output
  useEffect(() => {
    if (streamContentRef.current && generating) {
      streamContentRef.current.scrollTop = streamContentRef.current.scrollHeight;
    }
  }, [streamText, generating]);

  // Cancel the running generation when the panel closes
  useEffect(
    () => () => {
      abortRef.current?.abort();
      optimizeAbortRef.current?.abort();
    },
    [],
  );

  const handleGenerate = useCallback(
    // parts: steps to run; previous: a result (or the `partial` of a failed one) whose
    // other steps are kept; promptText: the request (default: the text box)
    async (parts = AI_PARTS, previous = null, promptText = prompt) => {
      if (!promptText.trim()) return;
      if (!romParser) {
        setError({ code: 'noRom' });
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      // shown again if this run is cancelled or fails
      keptRef.current = previous?.team ? previous : null;

      setGenerating(true);
      setError(null);
      setPartial(null);
      setResult(null);
      setStreamText('');
      setAttemptInfo(null);
      setStageInfo(null);

      try {
        const generated = await generateTeam({
          userPrompt: promptText.trim(),
          settings,
          parts,
          previous,
          // limits of this slot (menu name area, free description bytes...), read now
          context: buildAiContext(romParser, teamIndex),
          signal: controller.signal,
          onStage: (info) => {
            setStageInfo(info);
            setAttemptInfo(null);
            setStreamText('');
          },
          onAttempt: (info) => {
            setAttemptInfo(info);
            setStreamText('');
          },
          onChunk: (chunk) => setStreamText((prev) => prev + chunk),
        });
        if (!controller.signal.aborted) setResult(generated);
      } catch (err) {
        if (!controller.signal.aborted && err?.code !== 'cancelled') {
          setError(err);
          if (err?.partial) setPartial(err.partial);
          if (keptRef.current) setResult(keptRef.current);
        }
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          setGenerating(false);
          setAttemptInfo(null);
          setStageInfo(null);
        }
      }
    },
    [prompt, romParser, settings, teamIndex],
  );

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setGenerating(false);
    setAttemptInfo(null);
    setStageInfo(null);
    if (keptRef.current) setResult(keptRef.current);
    optimizeAbortRef.current?.abort();
    optimizeAbortRef.current = null;
    setOptimizing(false);
    setSuggestion(null);
  }, []);

  /** Ask the AI to rewrite the request into a complete brief (shown for review) */
  const handleOptimize = useCallback(async () => {
    if (!prompt.trim()) return;
    optimizeAbortRef.current?.abort();
    const controller = new AbortController();
    optimizeAbortRef.current = controller;
    setOptimizing(true);
    setError(null);
    setSuggestion('');
    let raw = '';
    try {
      const text = await optimizePrompt({
        userPrompt: prompt.trim(),
        settings,
        context: buildAiContext(romParser, teamIndex),
        signal: controller.signal,
        onChunk: (chunk) => {
          raw += chunk;
          setSuggestion(cleanOptimizedPrompt(raw));
        },
      });
      if (!controller.signal.aborted) setSuggestion(text);
    } catch (err) {
      if (!controller.signal.aborted && err?.code !== 'cancelled') {
        setError(err);
        setSuggestion(null);
      }
    } finally {
      if (optimizeAbortRef.current === controller) {
        optimizeAbortRef.current = null;
        setOptimizing(false);
      }
    }
  }, [prompt, romParser, settings, teamIndex]);

  /** Put the suggestion in the text box (the user's text can be restored) */
  const applySuggestion = useCallback(
    (thenGenerate = false) => {
      if (!suggestion) return;
      setOriginalPrompt(prompt);
      setPrompt(suggestion);
      setSuggestion(null);
      if (thenGenerate) handleGenerate(AI_PARTS, null, suggestion);
    },
    [suggestion, prompt, handleGenerate],
  );

  const handleApply = useCallback(() => {
    if (!generatedTeam || !romParser || teamIndex === null) return;

    // One undo step: applyImportedTeam writes everything, flag design included
    pushSnapshot(teams);
    const { warnings } = applyImportedTeam(romParser, teamIndex, generatedTeam);

    const updatedTeam = romParser.readTeam(teamIndex);
    // Super Star uses Belgium's goalkeeper: the partner's tab shows the new colours too
    const partners = sharedKeeperTeams(teamIndex);
    setTeams((prev) => {
      const newTeams = [...prev];
      newTeams[teamIndex] = updatedTeam;
      partners.forEach((i) => {
        newTeams[i] = {
          ...newTeams[i],
          uniforms: romParser.readUniformColors(i),
          hairSkin: romParser.readHairSkinColors(i),
        };
      });
      return newTeams;
    });

    markModified();
    setStatusMessage(t('aiApplied'));
    warnings.forEach((key) => toast.warning(t(key)));
    setResult(null);
    setStreamText('');
  }, [
    generatedTeam,
    romParser,
    teamIndex,
    teams,
    pushSnapshot,
    setTeams,
    markModified,
    setStatusMessage,
    toast,
    t,
  ]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !busy) {
      handleGenerate();
    }
  };

  if (!romParser) {
    return (
      <div className="editor-panel ai-generator-panel empty">
        <p>{t('aiNoRom')}</p>
      </div>
    );
  }

  return (
    <div className="editor-panel ai-generator-panel">
      <div className="editor-header">
        <div className="editor-header-title">
          <span className="editor-icon">
            <IconSparkle size={18} />
          </span>
          <h2>{team?.name || t('aiTitle')}</h2>
          <span className="editor-subtitle">- {t('aiTitle')}</span>
        </div>
      </div>

      <div className="ai-generator-body">
        <p className="ai-description">{t('aiDescription')}</p>

        {/* LEFT COLUMN: Prompt + controls */}
        <div className="ai-left-column">
          {/* Tips */}
          <div className="ai-tips-section">
            <button
              className="ai-tips-toggle"
              onClick={() => setShowTips(!showTips)}
              title={t('aiTipsToggle')}
            >
              {showTips ? '\u25BE' : '\u25B8'} {t('aiTipsTitle')}
            </button>
            {showTips && (
              <ul className="ai-tips-list">
                <li>{t('aiTip1')}</li>
                <li>{t('aiTip2')}</li>
                <li>{t('aiTip3')}</li>
                <li>{t('aiTip4')}</li>
                <li>{t('aiTip5')}</li>
              </ul>
            )}
          </div>

          {/* Templates */}
          <div className="ai-templates-section">
            <button
              className="ai-templates-btn"
              onClick={() => setShowTemplates(true)}
              title={t('aiTemplatesToggle')}
            >
              {t('aiTemplatesTitle')}
            </button>
          </div>

          {/* Prompt Input */}
          <div className="ai-prompt-section">
            <textarea
              className="ai-prompt-input"
              placeholder={t(EXAMPLE_KEYS[placeholderIndex])}
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                setOriginalPrompt(null);
              }}
              onKeyDown={handleKeyDown}
              rows={4}
              disabled={busy}
            />
            <div className="ai-prompt-actions">
              <button
                className="ai-btn ai-btn-primary"
                onClick={() => handleGenerate()}
                disabled={busy || !prompt.trim()}
              >
                {generating ? t('aiGenerating') : t('aiGenerate')}
              </button>
              <button
                className="ai-btn ai-btn-secondary"
                onClick={handleOptimize}
                disabled={busy || !prompt.trim()}
                title={t('aiOptimizeHint')}
              >
                {optimizing ? t('aiOptimizing') : t('aiOptimize')}
              </button>
              {busy && (
                <button className="ai-btn ai-btn-secondary" onClick={handleCancel}>
                  {t('aiCancel')}
                </button>
              )}
            </div>
            {originalPrompt != null && !busy && (
              <button
                className="ai-link-btn"
                onClick={() => {
                  setPrompt(originalPrompt);
                  setOriginalPrompt(null);
                }}
              >
                {t('aiRestorePrompt')}
              </button>
            )}
          </div>

          {/* Improved prompt, for review */}
          {suggestion != null && (
            <div className="ai-suggestion">
              <div className="ai-suggestion-header">
                <span className="ai-label">{t('aiOptimizedTitle')}</span>
                {optimizing && <span className="ai-stream-cursor" />}
              </div>
              <div className="ai-suggestion-text">
                {suggestion || (optimizing ? t('aiOptimizingWait') : '')}
              </div>
              {!optimizing && suggestion && (
                <div className="ai-suggestion-actions">
                  <button className="ai-btn ai-btn-primary" onClick={() => applySuggestion(true)}>
                    {t('aiUseOptimizedGenerate')}
                  </button>
                  <button className="ai-btn ai-btn-secondary" onClick={() => applySuggestion()}>
                    {t('aiUseOptimized')}
                  </button>
                  <button className="ai-btn ai-btn-secondary" onClick={() => setSuggestion(null)}>
                    {t('aiDiscardOptimized')}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="ai-error">
              <div className="ai-error-friendly">{t(aiErrorKey(error))}</div>
              {aiErrorDetail(error) && (
                <details className="ai-error-details">
                  <summary>{t('aiErrorDetails')}</summary>
                  <code>{aiErrorDetail(error)}</code>
                </details>
              )}
              {partial && !busy && (
                <button
                  className="ai-btn ai-btn-small"
                  onClick={() =>
                    handleGenerate(
                      AI_PARTS.filter((p) => !partial.raw[p]),
                      partial,
                    )
                  }
                  title={t('aiContinueHint')}
                >
                  {t('aiContinue')}
                </button>
              )}
              <button className="ai-btn ai-btn-small" onClick={() => setError(null)}>
                {t('aiClose')}
              </button>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Stream output + Preview */}
        <div className="ai-right-column">
          {/* Stream output panel */}
          {!generatedTeam && (
            <div className="ai-stream-panel">
              <div className="ai-stream-header">
                <span className="ai-stream-header-title">
                  {t('aiStreamOutput')}
                  {stageInfo &&
                    ` · ${t('aiStage')
                      .replace('{current}', stageInfo.index + 1)
                      .replace('{total}', stageInfo.total)
                      .replace('{part}', t(PART_LABEL_KEYS[stageInfo.part]))}`}
                </span>
                {attemptInfo && attemptInfo.attempt > 1 && (
                  <span
                    className="ai-stream-header-attempt"
                    title={attemptInfo.problems.join('\n')}
                  >
                    {t('aiAttempt')
                      .replace('{current}', attemptInfo.attempt)
                      .replace('{total}', attemptInfo.maxAttempts)}{' '}
                    {t('aiFixing').replace('{count}', attemptInfo.problems.length)}
                  </span>
                )}
                {streamText.length > 0 && (
                  <span className="ai-stream-header-meta">
                    {t('aiStreamTokens').replace('{count}', streamText.length)}
                  </span>
                )}
              </div>
              <div
                className={`ai-stream-content${!streamText && !generating ? ' waiting' : ''}`}
                ref={streamContentRef}
              >
                {!streamText && !generating && <span>{t('aiStreamWaiting')}</span>}
                {streamText}
                {generating && <span className="ai-stream-cursor" />}
              </div>
            </div>
          )}

          {/* Generated Preview */}
          {generatedTeam && (
            <div className="ai-preview">
              <h3>{t('aiPreviewTitle')}</h3>

              <div className="ai-preview-header">
                <span className="ai-team-name">{generatedTeam.name}</span>
                <span className="ai-team-id">[{generatedTeam.teamNameInGame}]</span>
                {result.attempts > 1 && (
                  <span className="ai-preview-attempts">
                    {t('aiAttemptsUsed').replace('{count}', result.attempts)}
                  </span>
                )}
              </div>

              {/* What the AI got wrong and the editor fixed */}
              {result.errors.length > 0 && (
                <details className="ai-preview-issues ai-preview-issues-error">
                  <summary>{t('aiUnresolved').replace('{count}', result.errors.length)}</summary>
                  <ul>
                    {result.errors.map((msg, i) => (
                      <li key={i}>{msg}</li>
                    ))}
                  </ul>
                </details>
              )}
              {result.warnings.length > 0 && (
                <details className="ai-preview-issues">
                  <summary>{t('aiAdjustments').replace('{count}', result.warnings.length)}</summary>
                  <ul>
                    {result.warnings.map((msg, i) => (
                      <li key={i}>{msg}</li>
                    ))}
                  </ul>
                </details>
              )}

              {/* Uniform color swatches */}
              <div className="ai-preview-uniforms">
                <span className="ai-label">{t('aiPreviewUniforms')}:</span>
                <div className="ai-color-swatches">
                  {generatedTeam.uniforms?.home?.shirt?.map((c, i) => (
                    <div
                      key={`h-${i}`}
                      className="ai-swatch"
                      style={{ backgroundColor: `rgb(${c.r},${c.g},${c.b})` }}
                    />
                  ))}
                  <span className="ai-swatch-divider">|</span>
                  {generatedTeam.uniforms?.away?.shirt?.map((c, i) => (
                    <div
                      key={`a-${i}`}
                      className="ai-swatch"
                      style={{ backgroundColor: `rgb(${c.r},${c.g},${c.b})` }}
                    />
                  ))}
                </div>
              </div>

              {/* Formation, special hair/skin, description */}
              <div className="ai-preview-setup">
                <div>
                  <span className="ai-label">{t('formation')}:</span>
                  <span>{generatedTeam.formationName || '—'}</span>
                </div>
                <div>
                  <span className="ai-label">{t('aiPreviewSpecial')}:</span>
                  <span>
                    {t(`specialHair${capitalize(SPECIAL_HAIR_KEYS[generatedTeam.specialHair])}`)}
                    {' / '}
                    {t(`specialSkin${capitalize(SPECIAL_SKIN_KEYS[generatedTeam.specialSkin])}`)}
                  </span>
                </div>
                {generatedTeam.flagDesign && (
                  <div>
                    <span className="ai-label">
                      {t('aiPreviewFlag')}
                      {generatedTeam.flagTemplate && generatedTeam.flagTemplate !== 'custom'
                        ? ` (${generatedTeam.flagTemplate})`
                        : ''}
                      :
                    </span>
                    <FlagCanvas
                      grid={generatedTeam.flagDesign.grid}
                      colors={generatedTeam.flagColors}
                      scale={3}
                      label={t('aiPreviewFlag')}
                    />
                  </div>
                )}
              </div>
              {generatedTeam.description && (
                <div className="ai-preview-description">
                  <span
                    className={`ai-preview-description-title${generatedTeam.description.titleColor === 0x24 ? ' defensive' : ''}`}
                  >
                    {generatedTeam.description.title}
                  </span>
                  <pre>{wrapDescriptionBody(generatedTeam.description.body).join('\n')}</pre>
                </div>
              )}

              {/* Players table */}
              <div className="ai-preview-players">
                <span className="ai-label">{t('aiPreviewPlayers')}:</span>
                <table className="ai-players-table">
                  <thead>
                    <tr>
                      <th>{t('formationSlot')}</th>
                      <th>#</th>
                      <th>{t('name')}</th>
                      <th>{t('shooting')}</th>
                      <th>{t('speed')}</th>
                      <th>{t('stamina')}</th>
                      <th>{t('technique')}</th>
                      <th>{t('statAttack')}</th>
                      <th>{t('statDefense')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {generatedTeam.players.map((p, i) => (
                      <tr key={i}>
                        <td>{p.position ? positionText(p.position, t) : '?'}</td>
                        <td>{p.number}</td>
                        <td>{p.name}</td>
                        <td>{p.shooting}</td>
                        <td>{p.speed}</td>
                        <td>{p.stamina}</td>
                        <td>{p.technique}</td>
                        <td>{p.attack ?? '—'}</td>
                        <td>{p.defense ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Actions */}
              <div className="ai-preview-actions">
                <button className="ai-btn ai-btn-primary" onClick={handleApply}>
                  {t('aiApply')}
                </button>
                {AI_PARTS.map((part) => (
                  <button
                    key={part}
                    className="ai-btn ai-btn-secondary"
                    onClick={() => handleGenerate([part], result)}
                    disabled={busy || !prompt.trim()}
                    title={t('aiRegenerateHint')}
                  >
                    {t('aiRegenerate').replace('{part}', t(PART_LABEL_KEYS[part]))}
                  </button>
                ))}
                <button
                  className="ai-btn ai-btn-secondary"
                  onClick={() => {
                    setResult(null);
                    setStreamText('');
                  }}
                >
                  {t('aiRetry')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Templates Modal */}
      {showTemplates && (
        <div
          className="ai-modal-overlay"
          onClick={() => setShowTemplates(false)}
          role="dialog"
          aria-modal="true"
        >
          <div className="ai-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ai-modal-header">
              <h3>{t('aiTemplatesTitle')}</h3>
              <button
                className="ai-modal-close"
                onClick={() => setShowTemplates(false)}
                aria-label={t('close')}
              >
                &times;
              </button>
            </div>
            <div className="ai-modal-body">
              {TEMPLATE_CATEGORIES.map((cat) => (
                <div key={cat.labelKey} className="ai-modal-category">
                  <span className="ai-template-category-label">{t(cat.labelKey)}</span>
                  <div className="ai-modal-templates">
                    {cat.templates.map((tplKey) => (
                      <button
                        key={tplKey}
                        className="ai-modal-template-item"
                        onClick={() => {
                          setPrompt(t(tplKey));
                          setShowTemplates(false);
                        }}
                      >
                        {t(tplKey)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
