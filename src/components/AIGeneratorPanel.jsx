import { useState, useEffect, useCallback, useRef } from 'react';
import { useI18n } from '../i18n';
import { useRom } from '../context/RomContext';
import { useSettings } from '../context/SettingsContext';
import { isElectron } from '../services/electronBridge';
import * as electronBridge from '../services/electronBridge';
import { buildSystemPrompt, parseLLMResponse, streamLLMWeb } from '../services/aiService';
import { applyImportedTeam } from '../utils/teamExport';
import { IconSparkle } from './Icons';
import '../styles/AIGeneratorPanel.css';

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
  const {
    romParser,
    teams,
    setTeams,
    markModified,
    pushSnapshot,
    setStatusMessage,
    handleFlagDesignBulkChange,
  } = useRom();

  const team = teams?.[teamIndex];

  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedTeam, setGeneratedTeam] = useState(null);
  const [error, setError] = useState('');
  const [showTips, setShowTips] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [streamText, setStreamText] = useState('');
  const [streamDone, setStreamDone] = useState(false);

  const intervalRef = useRef(null);
  const streamContentRef = useRef(null);
  const abortRef = useRef(null);
  const { settings: appSettings } = useSettings();

  const settings = {
    provider: appSettings.aiProvider,
    endpoint: appSettings.aiEndpoint,
    model: appSettings.aiModel,
    apiKey: appSettings.aiApiKey,
    temperature: appSettings.aiTemperature,
    maxTokens: appSettings.aiMaxTokens,
  };

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

  // Parse stream when done
  useEffect(() => {
    if (streamDone && streamText) {
      const parsed = parseLLMResponse(streamText);
      if (parsed.success) {
        setGeneratedTeam(parsed.team);
      } else {
        setError(parsed.error);
      }
      setGenerating(false);
      setStreamDone(false);
    }
  }, [streamDone, streamText]);

  // Cleanup stream listeners on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current();
        abortRef.current = null;
      }
      if (isElectron()) {
        electronBridge.removeAllListeners('ai:stream-chunk');
        electronBridge.removeAllListeners('ai:stream-done');
        electronBridge.removeAllListeners('ai:stream-error');
      }
    };
  }, []);

  const handleGenerate = useCallback(() => {
    if (!prompt.trim()) return;
    if (!romParser) {
      setError(t('aiNoRom'));
      return;
    }

    setGenerating(true);
    setError('');
    setGeneratedTeam(null);
    setStreamText('');
    setStreamDone(false);

    const systemPrompt = buildSystemPrompt();

    if (isElectron()) {
      // Clean up previous listeners
      electronBridge.removeAllListeners('ai:stream-chunk');
      electronBridge.removeAllListeners('ai:stream-done');
      electronBridge.removeAllListeners('ai:stream-error');

      electronBridge.onAiStreamChunk((chunk) => {
        setStreamText((prev) => prev + chunk);
      });

      electronBridge.onAiStreamDone(() => {
        setStreamDone(true);
      });

      electronBridge.onAiStreamError((errorMsg) => {
        setError(errorMsg);
        setGenerating(false);
      });

      electronBridge.aiGenerateStream({
        prompt: prompt.trim(),
        systemPrompt,
        settings,
      });
    } else {
      // Web fallback with streaming
      const abort = streamLLMWeb({
        systemPrompt,
        userPrompt: prompt.trim(),
        settings,
        onChunk: (chunk) => {
          setStreamText((prev) => prev + chunk);
        },
        onDone: () => {
          setStreamDone(true);
        },
        onError: (msg) => {
          setError(msg);
          setGenerating(false);
        },
      });
      abortRef.current = abort;
    }
  }, [prompt, romParser, settings, t]);

  const handleApply = useCallback(() => {
    if (!generatedTeam || !romParser || teamIndex === null) return;

    pushSnapshot(teams);
    applyImportedTeam(romParser, teamIndex, generatedTeam);

    if (generatedTeam.flagDesign && generatedTeam.flagDesign.grid) {
      handleFlagDesignBulkChange(teamIndex, generatedTeam.flagDesign.grid);
    }

    const updatedTeam = romParser.readTeam(teamIndex);
    setTeams((prev) => {
      const newTeams = [...prev];
      newTeams[teamIndex] = updatedTeam;
      return newTeams;
    });

    markModified();
    setStatusMessage(t('aiApplied'));
    setGeneratedTeam(null);
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
    handleFlagDesignBulkChange,
    t,
  ]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !generating) {
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
          <span className="editor-icon"><IconSparkle size={18} /></span>
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
          < div className="ai-prompt-section" >
            <textarea
              className="ai-prompt-input"
              placeholder={t(EXAMPLE_KEYS[placeholderIndex])}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={4}
              disabled={generating}
            />
            <button
              className="ai-btn ai-btn-primary"
              onClick={handleGenerate}
              disabled={generating || !prompt.trim()}
            >
              {generating ? t('aiGenerating') : t('aiGenerate')}
            </button>
          </div >

          {/* Error */}
          {
            error && (
              <div className="ai-error">
                <div className="ai-error-friendly">
                  {error.includes('Connection refused') || error.includes('fetch failed')
                    ? t('aiErrorConnection')
                    : error.includes('timed out')
                      ? t('aiErrorTimeout')
                      : error.includes('JSON parse')
                        ? t('aiErrorParse')
                        : error.includes('API error')
                          ? t('aiErrorApi')
                          : t('aiErrorGeneric')}
                </div>
                <details className="ai-error-details">
                  <summary>{t('aiErrorDetails')}</summary>
                  <code>{error}</code>
                </details>
                <button className="ai-btn ai-btn-small" onClick={() => setError('')}>
                  {t('aiClose')}
                </button>
              </div>
            )
          }
        </div >

        {/* RIGHT COLUMN: Stream output + Preview */}
        < div className="ai-right-column" >
          {/* Stream output panel */}
          {
            !generatedTeam && (
              <div className="ai-stream-panel">
                <div className="ai-stream-header">
                  <span className="ai-stream-header-title">{t('aiStreamOutput')}</span>
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
            )
          }

          {/* Generated Preview */}
          {
            generatedTeam && (
              <div className="ai-preview">
                <h3>{t('aiPreviewTitle')}</h3>

                <div className="ai-preview-header">
                  <span className="ai-team-name">{generatedTeam.name}</span>
                  <span className="ai-team-id">[{generatedTeam.teamNameInGame}]</span>
                </div>

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

                {/* Players table */}
                <div className="ai-preview-players">
                  <span className="ai-label">{t('aiPreviewPlayers')}:</span>
                  <table className="ai-players-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>{t('name')}</th>
                        <th>{t('shooting')}</th>
                        <th>{t('speed')}</th>
                        <th>{t('stamina')}</th>
                        <th>{t('technique')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {generatedTeam.players.map((p, i) => (
                        <tr key={i}>
                          <td>{p.number}</td>
                          <td>{p.name}</td>
                          <td>{p.shooting}</td>
                          <td>{p.speed}</td>
                          <td>{p.stamina}</td>
                          <td>{p.technique}</td>
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
                  <button
                    className="ai-btn ai-btn-secondary"
                    onClick={() => {
                      setGeneratedTeam(null);
                      setStreamText('');
                    }}
                  >
                    {t('aiRetry')}
                  </button>
                </div>
              </div>
            )
          }
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
