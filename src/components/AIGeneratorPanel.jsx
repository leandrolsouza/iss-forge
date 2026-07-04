import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useI18n } from '../i18n';
import { useRom } from '../context/RomContext';
import { isElectron } from '../services/electronBridge';
import * as electronBridge from '../services/electronBridge';
import { buildSystemPrompt, parseLLMResponse, DEFAULT_AI_SETTINGS } from '../services/aiService';
import { applyImportedTeam } from '../utils/teamExport';
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

  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedTeam, setGeneratedTeam] = useState(null);
  const [error, setError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_AI_SETTINGS);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const intervalRef = useRef(null);

  // Rotate placeholder examples every 5 seconds
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % EXAMPLE_KEYS.length);
    }, 5000);
    return () => clearInterval(intervalRef.current);
  }, []);

  // Load settings on mount
  useEffect(() => {
    if (isElectron()) {
      electronBridge.aiGetSettings().then((s) => {
        if (s) setSettings(s);
      });
    }
  }, []);

  const MAX_RETRIES = 2;

  const callLLM = useCallback(
    async (systemPrompt, userPrompt) => {
      if (isElectron()) {
        return electronBridge.aiGenerate({
          prompt: userPrompt,
          systemPrompt,
          settings,
        });
      }
      // Web fallback: direct fetch (for dev mode without Electron)
      const response = await fetch(settings.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: settings.temperature || 0.7,
          max_tokens: settings.maxTokens || 4096,
          stream: false,
          ...(settings.model ? { model: settings.model } : {}),
        }),
      });

      if (!response.ok) {
        return { success: false, error: `API error ${response.status}` };
      }
      const data = await response.json();
      return {
        success: true,
        content: data.choices?.[0]?.message?.content || '',
      };
    },
    [settings],
  );

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;
    if (!romParser) {
      setError(t('aiNoRom'));
      return;
    }

    setGenerating(true);
    setError('');
    setGeneratedTeam(null);

    try {
      const systemPrompt = buildSystemPrompt();
      let lastError = '';
      let brokenJson = '';

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        setAttempt(attempt + 1);

        let result;
        if (attempt > 0 && brokenJson) {
          // Ask LLM to fix the broken JSON instead of regenerating from scratch
          const fixPrompt =
            'The following JSON has a syntax error. Fix it and return ONLY the corrected valid JSON. Do not add any explanation.\n\n' +
            brokenJson;
          result = await callLLM(systemPrompt, fixPrompt);
        } else {
          result = await callLLM(systemPrompt, prompt.trim());
        }

        if (!result.success) {
          lastError = result.error || 'Unknown error';
          // Connection errors: don't retry
          if (result.error?.includes('Connection refused') || result.error?.includes('timed out')) {
            break;
          }
          continue;
        }

        const parsed = parseLLMResponse(result.content);
        if (parsed.success) {
          setGeneratedTeam(parsed.team);
          return;
        }

        // JSON parse error: save broken content for fix attempt
        lastError = parsed.error;
        brokenJson = result.content;
      }

      setError(lastError);
    } catch (err) {
      setError(err.message || 'Connection failed');
    } finally {
      setGenerating(false);
    }
  }, [prompt, romParser, callLLM, t]);

  const handleApply = useCallback(() => {
    if (!generatedTeam || !romParser || teamIndex === null) return;

    pushSnapshot(teams);
    applyImportedTeam(romParser, teamIndex, generatedTeam);

    // Apply flag design if generated
    if (generatedTeam.flagDesign && generatedTeam.flagDesign.grid) {
      handleFlagDesignBulkChange(teamIndex, generatedTeam.flagDesign.grid);
    }

    // Reload team from ROM to get fresh state
    const updatedTeam = romParser.readTeam(teamIndex);
    setTeams((prev) => {
      const newTeams = [...prev];
      newTeams[teamIndex] = updatedTeam;
      return newTeams;
    });

    markModified();
    setStatusMessage(t('aiApplied'));
    setGeneratedTeam(null);
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

  const handleSaveSettings = useCallback(async () => {
    if (isElectron()) {
      await electronBridge.aiSaveSettings(settings);
    }
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  }, [settings]);

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
      <div className="ai-header">
        <h2>{t('aiTitle')}</h2>
        <button
          className="ai-settings-btn"
          onClick={() => setShowSettings(!showSettings)}
          title={t('aiSettings')}
        >
          {t('aiSettings')}
        </button>
      </div>

      <p className="ai-description">{t('aiDescription')}</p>

      {/* Settings Panel */}
      {showSettings && (
        <div className="ai-settings-panel">
          <h3>{t('aiSettingsTitle')}</h3>
          <div className="ai-setting-row">
            <label>{t('aiEndpoint')}</label>
            <input
              type="text"
              value={settings.endpoint}
              onChange={(e) => setSettings({ ...settings, endpoint: e.target.value })}
            />
            <span className="ai-hint">{t('aiEndpointHint')}</span>
          </div>
          <div className="ai-setting-row">
            <label>{t('aiModel')}</label>
            <input
              type="text"
              value={settings.model}
              onChange={(e) => setSettings({ ...settings, model: e.target.value })}
            />
            <span className="ai-hint">{t('aiModelHint')}</span>
          </div>
          <div className="ai-setting-row-inline">
            <div className="ai-setting-field">
              <label>{t('aiTemperature')}</label>
              <input
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={settings.temperature}
                onChange={(e) =>
                  setSettings({ ...settings, temperature: parseFloat(e.target.value) || 0.7 })
                }
              />
            </div>
            <div className="ai-setting-field">
              <label>{t('aiMaxTokens')}</label>
              <input
                type="number"
                min="1024"
                max="16384"
                step="512"
                value={settings.maxTokens}
                onChange={(e) =>
                  setSettings({ ...settings, maxTokens: parseInt(e.target.value) || 4096 })
                }
              />
            </div>
          </div>
          <div className="ai-setting-actions">
            <button className="ai-btn ai-btn-secondary" onClick={handleSaveSettings}>
              {settingsSaved ? t('aiSettingsSaved') : t('aiSaveSettings')}
            </button>
          </div>
        </div>
      )}

      {/* Prompt Tips */}
      <div className="ai-tips-section">
        <button
          className="ai-tips-toggle"
          onClick={() => setShowTips(!showTips)}
          title={t('aiTipsToggle')}
        >
          {showTips ? '▾' : '▸'} {t('aiTipsTitle')}
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

      {/* Prompt Templates */}
      <div className="ai-templates-section">
        <button
          className="ai-tips-toggle"
          onClick={() => setShowTemplates(!showTemplates)}
          title={t('aiTemplatesToggle')}
        >
          {showTemplates ? '▾' : '▸'} {t('aiTemplatesTitle')}
        </button>
        {showTemplates && (
          <div className="ai-templates-content">
            {TEMPLATE_CATEGORIES.map((cat) => (
              <div key={cat.labelKey} className="ai-template-category">
                <span className="ai-template-category-label">{t(cat.labelKey)}</span>
                <div className="ai-template-chips">
                  {cat.templates.map((tplKey) => (
                    <button
                      key={tplKey}
                      className="ai-template-chip"
                      onClick={() => setPrompt(t(tplKey))}
                    >
                      {t(tplKey)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Prompt Input */}
      <div className="ai-prompt-section">
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
          {generating
            ? attempt > 1
              ? t('aiAttempt')
                  .replace('{current}', attempt)
                  .replace('{total}', MAX_RETRIES + 1)
              : t('aiGenerating')
            : t('aiGenerate')}
        </button>
      </div>

      {/* Error */}
      {error && (
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
      )}

      {/* Generated Preview */}
      {generatedTeam && (
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
            <button className="ai-btn ai-btn-secondary" onClick={() => setGeneratedTeam(null)}>
              {t('aiRetry')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
