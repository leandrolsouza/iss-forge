import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { useSettings } from '../context/SettingsContext';
import {
  getProvider,
  getProviderIds,
  buildBedrockEndpoint,
  buildRequestBody,
  aiErrorKey,
  aiErrorDetail,
  fetchErrorToAi,
  responseErrorToAi,
  DEFAULT_MAX_TOKENS,
  modelForProvider,
  getEffectiveEndpoint,
  parseResponse,
} from '../services/aiProviders';
import { isElectron } from '../services/electronBridge';
import * as electronBridge from '../services/electronBridge';
import '../styles/settings.css';

export default function SettingsPage() {
  const { t } = useI18n();
  const { settings, loaded, updateSetting, updateSettings, selectExportPath } = useSettings();
  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [endpointDraft, setEndpointDraft] = useState(settings.aiEndpoint);
  useEffect(() => setEndpointDraft(settings.aiEndpoint), [settings.aiEndpoint]);
  useEffect(() => setApiKeyDraft(''), [settings.aiProvider, settings.aiEndpoint]);
  const [showApiKey, setShowApiKey] = useState(false);
  const [activeSection, setActiveSection] = useState('editor');
  const [testStatus, setTestStatus] = useState(null); // null | 'testing' | 'success' | 'error'
  const [testError, setTestError] = useState(null); // { code, detail } (see aiErrorKey)

  // Settings saved by older versions may keep a model of another provider (the list
  // shows nothing selected but the model is still sent): fix it once loaded
  useEffect(() => {
    if (!loaded || !settings.aiModel) return;
    const fixed = modelForProvider(getProvider(settings.aiProvider), settings.aiModel);
    if (fixed !== settings.aiModel) updateSetting('aiModel', fixed);
  }, [loaded, settings.aiProvider, settings.aiModel, updateSetting]);

  const tabs = [
    { id: 'editor', label: t('settingsEditor') },
    { id: 'ai', label: t('settingsAi') },
  ];

  return (
    <div className="settings-page">
      <div className="settings-sidebar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`settings-sidebar-item ${activeSection === tab.id ? 'active' : ''}`}
            onClick={() => setActiveSection(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="settings-content">
        {activeSection === 'editor' && (
          <section className="settings-section">
            <h3 className="settings-section-title">{t('settingsEditor')}</h3>

            <div className="settings-item">
              <label className="settings-toggle-label">
                <input
                  type="checkbox"
                  checked={settings.confirmBeforeSave}
                  onChange={(e) => updateSetting('confirmBeforeSave', e.target.checked)}
                />
                <span className="settings-toggle-text">{t('settingsConfirmBeforeSave')}</span>
              </label>
              <p className="settings-hint">{t('settingsConfirmBeforeSaveHint')}</p>
            </div>

            <div className="settings-item">
              <label className="settings-toggle-label">
                <input
                  type="checkbox"
                  checked={settings.autoBackupBeforeSave}
                  onChange={(e) => updateSetting('autoBackupBeforeSave', e.target.checked)}
                />
                <span className="settings-toggle-text">{t('settingsAutoBackup')}</span>
              </label>
              <p className="settings-hint">{t('settingsAutoBackupHint')}</p>
            </div>

            <div className="settings-item">
              <label className="settings-label">{t('settingsDefaultExportPath')}</label>
              <p className="settings-hint">{t('settingsDefaultExportPathHint')}</p>
              <div className="settings-path-row">
                <span className="settings-path-value">
                  {settings.defaultExportPath || t('settingsNoFolderSelected')}
                </span>
                <button className="settings-btn" onClick={selectExportPath}>
                  {t('settingsSelectFolder')}
                </button>
                {settings.defaultExportPath && (
                  <button
                    className="settings-btn settings-btn-secondary"
                    onClick={() => updateSetting('defaultExportPath', '')}
                  >
                    {t('settingsClearPath')}
                  </button>
                )}
              </div>
            </div>

            <div className="settings-item">
              <label className="settings-label">{t('settingsEmulator')}</label>
              <p className="settings-hint">{t('settingsEmulatorHint')}</p>
              <div className="settings-path-row">
                <span className="settings-path-value">
                  {settings.emulatorPath || t('settingsNoEmulator')}
                </span>
                {isElectron() && (
                  <button
                    className="settings-btn"
                    onClick={async () => {
                      const res = await electronBridge.selectEmulator();
                      if (res?.success) updateSetting('emulatorPath', res.path);
                    }}
                  >
                    {t('settingsSelectEmulator')}
                  </button>
                )}
              </div>
            </div>

            <div className="settings-item">
              <label className="settings-label">{t('settingsEmulatorArgs')}</label>
              <p className="settings-hint">{t('settingsEmulatorArgsHint')}</p>
              <input
                type="text"
                className="settings-input"
                value={settings.emulatorArgs ?? '{rom}'}
                onChange={(e) => updateSetting('emulatorArgs', e.target.value)}
                spellCheck={false}
              />
            </div>
          </section>
        )}

        {activeSection === 'ai' && (
          <section className="settings-section">
            <h3 className="settings-section-title">{t('settingsAi')}</h3>

            <div className="settings-item">
              <label className="settings-toggle-label">
                <input
                  type="checkbox"
                  checked={settings.aiEnabled}
                  onChange={(e) => updateSetting('aiEnabled', e.target.checked)}
                />
                <span className="settings-toggle-text">{t('settingsAiEnabled')}</span>
              </label>
              <p className="settings-hint">{t('settingsAiEnabledHint')}</p>
            </div>

            <div className="settings-item">
              <label className="settings-label">{t('settingsAiProvider')}</label>
              <select
                className="settings-input"
                value={settings.aiProvider}
                onChange={(e) => {
                  const newProvider = e.target.value;
                  const providerConfig = getProvider(newProvider);
                  updateSettings({
                    aiProvider: newProvider,
                    aiEndpoint:
                      providerConfig.format === 'bedrock'
                        ? buildBedrockEndpoint(settings.aiRegion || 'us-east-1')
                        : providerConfig.endpoint,
                    aiModel: modelForProvider(
                      providerConfig,
                      settings.aiModel,
                      settings.aiProvider,
                    ),
                  });
                }}
              >
                {getProviderIds().map((id) => {
                  const i18nKey =
                    id === 'openai-compatible'
                      ? 'settingsAiProviderCompatible'
                      : `settingsAiProvider${id.charAt(0).toUpperCase() + id.slice(1)}`;
                  return (
                    <option key={id} value={id}>
                      {t(i18nKey)}
                    </option>
                  );
                })}
              </select>
              <p className="settings-hint">{t('settingsAiProviderHint')}</p>
            </div>

            {getProvider(settings.aiProvider).regions && (
              <div className="settings-item">
                <label className="settings-label">{t('settingsAiBedrockRegion')}</label>
                <select
                  className="settings-input"
                  value={settings.aiRegion || 'us-east-1'}
                  onChange={(e) => {
                    const region = e.target.value;
                    updateSettings({ aiRegion: region, aiEndpoint: buildBedrockEndpoint(region) });
                  }}
                >
                  {getProvider(settings.aiProvider).regions.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </select>
                <p className="settings-hint">{t('settingsAiBedrockRegionHint')}</p>
              </div>
            )}

            {getProvider(settings.aiProvider).endpointEditable && (
              <div className="settings-item">
                <label className="settings-label">{t('settingsAiEndpoint')}</label>
                <input
                  className="settings-input"
                  type="text"
                  value={endpointDraft}
                  onChange={(e) => setEndpointDraft(e.target.value)}
                  onBlur={() => {
                    if (endpointDraft !== settings.aiEndpoint)
                      updateSetting('aiEndpoint', endpointDraft);
                  }}
                />
                <p className="settings-hint">{t('settingsAiEndpointHint')}</p>
                {(() => {
                  // what the requests really go to (a bare host gets /v1/chat/completions)
                  const resolved = getEffectiveEndpoint(
                    getProvider(settings.aiProvider),
                    settings.aiEndpoint,
                    settings.aiModel,
                  );
                  return resolved && resolved !== settings.aiEndpoint ? (
                    <p className="settings-hint">
                      {t('settingsAiEndpointResolved', { url: resolved })}
                    </p>
                  ) : null;
                })()}
              </div>
            )}

            <div className="settings-item">
              <label className="settings-label">{t('settingsAiModel')}</label>
              {getProvider(settings.aiProvider).models.length > 0 ? (
                <>
                  <select
                    className="settings-input"
                    value={settings.aiModel}
                    onChange={(e) => updateSetting('aiModel', e.target.value)}
                  >
                    <option value="">{t('settingsAiModelPlaceholder')}</option>
                    {getProvider(settings.aiProvider).models.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                  <p className="settings-hint">{t('settingsAiModelHint')}</p>
                </>
              ) : (
                <>
                  <input
                    className="settings-input"
                    type="text"
                    value={settings.aiModel}
                    onChange={(e) => updateSetting('aiModel', e.target.value)}
                    placeholder={t('settingsAiModelPlaceholder')}
                  />
                  <p className="settings-hint">{t('settingsAiModelHint')}</p>
                </>
              )}
            </div>

            <div className="settings-item">
              <div className="settings-label-row">
                <label className="settings-label">{t('settingsAiApiKey')}</label>
                {getProvider(settings.aiProvider).apiKeyUrl && (
                  <a
                    className="settings-link"
                    href={getProvider(settings.aiProvider).apiKeyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t('settingsAiGetApiKey')} ↗
                  </a>
                )}
              </div>
              <div className="settings-path-row">
                <input
                  className="settings-input settings-input-flex"
                  type={showApiKey ? 'text' : 'password'}
                  value={isElectron() ? apiKeyDraft : settings.aiApiKey}
                  placeholder={settings.aiHasApiKey ? t('settingsAiApiKeyStored') : ''}
                  onChange={(e) =>
                    isElectron()
                      ? setApiKeyDraft(e.target.value)
                      : updateSetting('aiApiKey', e.target.value)
                  }
                />
                <button
                  className="settings-btn settings-btn-secondary"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? t('settingsAiApiKeyHide') : t('settingsAiApiKeyShow')}
                </button>
                {isElectron() && (
                  <>
                    <button
                      className="settings-btn"
                      disabled={!apiKeyDraft}
                      onClick={async () => {
                        if (await updateSetting('aiApiKey', apiKeyDraft)) setApiKeyDraft('');
                      }}
                    >
                      {t('unsavedSave')}
                    </button>
                    {settings.aiHasApiKey && (
                      <button
                        className="settings-btn settings-btn-secondary"
                        onClick={() => updateSetting('aiApiKey', '')}
                      >
                        {t('settingsClearPath')}
                      </button>
                    )}
                  </>
                )}
              </div>
              <p className="settings-hint">{t('settingsAiApiKeyHint')}</p>
              {settings.aiKeyStorage === 'session' && (
                <p className="settings-hint settings-hint-warning">
                  {t('settingsAiKeySessionOnly')}
                </p>
              )}
              {getProvider(settings.aiProvider).requiresApiKey &&
                !settings.aiApiKey &&
                !settings.aiHasApiKey &&
                !apiKeyDraft && (
                  <p className="settings-hint settings-hint-warning">
                    {t('settingsAiApiKeyRequired')}
                  </p>
                )}
            </div>

            <div className="settings-item">
              <div className="settings-inline-row">
                <div className="settings-inline-field">
                  <label className="settings-label">{t('settingsAiTemperature')}</label>
                  <input
                    className="settings-input settings-input-small"
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
                    value={settings.aiTemperature}
                    onChange={(e) => {
                      // 0 is a valid temperature (most deterministic)
                      const value = parseFloat(e.target.value);
                      updateSetting('aiTemperature', Number.isFinite(value) ? value : 0.7);
                    }}
                  />
                </div>
                <div className="settings-inline-field">
                  <label className="settings-label">{t('settingsAiMaxTokens')}</label>
                  <input
                    className="settings-input settings-input-small"
                    type="number"
                    min="1024"
                    max="65536"
                    step="512"
                    value={settings.aiMaxTokens}
                    onChange={(e) =>
                      updateSetting('aiMaxTokens', parseInt(e.target.value) || DEFAULT_MAX_TOKENS)
                    }
                  />
                </div>
              </div>
            </div>

            <div className="settings-item">
              <div className="settings-test-row">
                <button
                  className="settings-btn settings-btn-test"
                  disabled={testStatus === 'testing'}
                  onClick={async () => {
                    setTestStatus('testing');
                    setTestError(null);
                    try {
                      const payload = {
                        settings: {
                          provider: settings.aiProvider,
                          endpoint: settings.aiEndpoint,
                          model: settings.aiModel,
                          apiKey: isElectron() ? apiKeyDraft : settings.aiApiKey,
                          temperature: settings.aiTemperature,
                          maxTokens: 32,
                        },
                      };
                      let result;
                      if (isElectron()) {
                        result = await electronBridge.aiTestConnection(payload);
                      } else {
                        // Web fallback: quick non-streaming request
                        const provider = getProvider(settings.aiProvider);
                        const headers = { 'Content-Type': 'application/json' };
                        if (provider.authType === 'x-api-key' && settings.aiApiKey) {
                          headers['x-api-key'] = settings.aiApiKey;
                          headers['anthropic-version'] = '2023-06-01';
                        } else if (settings.aiApiKey) {
                          headers['Authorization'] = `Bearer ${settings.aiApiKey}`;
                        }
                        const body = buildRequestBody({
                          format: provider.format,
                          systemPrompt: 'You are a helpful assistant.',
                          userPrompt: 'Say "OK" and nothing else.',
                          model: settings.aiModel,
                          temperature: undefined,
                          maxTokens: 32,
                          stream: false,
                        });
                        const resp = await fetch(
                          getEffectiveEndpoint(provider, settings.aiEndpoint, settings.aiModel),
                          { method: 'POST', headers, body: JSON.stringify(body) },
                        );
                        if (!resp.ok) {
                          result = { success: false, error: await responseErrorToAi(resp) };
                        } else {
                          // a 200 is not enough: some servers answer unknown paths with it
                          const parsed = parseResponse(
                            await resp.json().catch(() => ({})),
                            provider.format,
                          );
                          result = parsed.error
                            ? { success: false, error: parsed.error }
                            : { success: true };
                        }
                      }
                      if (result.success) {
                        setTestStatus('success');
                      } else {
                        setTestStatus('error');
                        setTestError(result.error || { code: 'generic' });
                      }
                    } catch (err) {
                      setTestStatus('error');
                      setTestError(fetchErrorToAi(err, settings.aiEndpoint));
                    }
                  }}
                >
                  {testStatus === 'testing'
                    ? t('settingsAiTestTesting')
                    : t('settingsAiTestConnection')}
                </button>
                <span
                  className={`settings-status-badge ${testStatus === 'success' ? 'status-connected' : testStatus === 'error' ? 'status-failed' : 'status-idle'}`}
                >
                  <span className="settings-status-dot" />
                  {testStatus === 'success'
                    ? t('settingsAiStatusConnected')
                    : testStatus === 'error'
                      ? t('settingsAiStatusFailed')
                      : t('settingsAiStatusNotTested')}
                </span>
              </div>
              {testStatus === 'success' && (
                <p className="settings-hint settings-hint-success">{t('settingsAiTestSuccess')}</p>
              )}
              {testStatus === 'error' && (
                <p className="settings-hint settings-hint-warning">
                  {t('settingsAiTestFailed')} {t(aiErrorKey(testError))}
                  {aiErrorDetail(testError) && (
                    <>
                      <br />
                      <code>{aiErrorDetail(testError)}</code>
                    </>
                  )}
                </p>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
