import { useState } from 'react';
import { useI18n } from '../i18n';
import { useSettings } from '../context/SettingsContext';
import { getProvider, getProviderIds, buildBedrockEndpoint } from '../services/aiProviders';
import { isElectron } from '../services/electronBridge';
import * as electronBridge from '../services/electronBridge';
import '../styles/settings.css';

export default function SettingsPage() {
  const { t } = useI18n();
  const { settings, updateSetting, selectExportPath } = useSettings();
  const [showApiKey, setShowApiKey] = useState(false);
  const [activeSection, setActiveSection] = useState('editor');
  const [testStatus, setTestStatus] = useState(null); // null | 'testing' | 'success' | 'error'
  const [testError, setTestError] = useState('');

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
                  updateSetting('aiProvider', newProvider);
                  // Auto-set endpoint based on provider type
                  if (providerConfig.format === 'bedrock') {
                    updateSetting(
                      'aiEndpoint',
                      buildBedrockEndpoint(settings.aiRegion || 'us-east-1'),
                    );
                  } else if (!providerConfig.endpointEditable) {
                    updateSetting('aiEndpoint', providerConfig.endpoint);
                  }
                  // Auto-set default model if user has no model set
                  if (providerConfig.defaultModel && !settings.aiModel) {
                    updateSetting('aiModel', providerConfig.defaultModel);
                  }
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
                    updateSetting('aiRegion', region);
                    updateSetting('aiEndpoint', buildBedrockEndpoint(region));
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
                  value={settings.aiEndpoint}
                  onChange={(e) => updateSetting('aiEndpoint', e.target.value)}
                />
                <p className="settings-hint">{t('settingsAiEndpointHint')}</p>
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
                  value={settings.aiApiKey}
                  onChange={(e) => updateSetting('aiApiKey', e.target.value)}
                />
                <button
                  className="settings-btn settings-btn-secondary"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? t('settingsAiApiKeyHide') : t('settingsAiApiKeyShow')}
                </button>
              </div>
              <p className="settings-hint">{t('settingsAiApiKeyHint')}</p>
              {getProvider(settings.aiProvider).requiresApiKey && !settings.aiApiKey && (
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
                    onChange={(e) =>
                      updateSetting('aiTemperature', parseFloat(e.target.value) || 0.7)
                    }
                  />
                </div>
                <div className="settings-inline-field">
                  <label className="settings-label">{t('settingsAiMaxTokens')}</label>
                  <input
                    className="settings-input settings-input-small"
                    type="number"
                    min="1024"
                    max="16384"
                    step="512"
                    value={settings.aiMaxTokens}
                    onChange={(e) => updateSetting('aiMaxTokens', parseInt(e.target.value) || 4096)}
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
                    setTestError('');
                    try {
                      const payload = {
                        settings: {
                          provider: settings.aiProvider,
                          endpoint: settings.aiEndpoint,
                          model: settings.aiModel,
                          apiKey: settings.aiApiKey,
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
                        const body =
                          provider.format === 'anthropic'
                            ? {
                                model: settings.aiModel || 'claude-sonnet-4-6',
                                max_tokens: 32,
                                temperature: 0.1,
                                system: 'You are a helpful assistant.',
                                messages: [{ role: 'user', content: 'Say "OK" and nothing else.' }],
                              }
                            : {
                                messages: [
                                  { role: 'system', content: 'You are a helpful assistant.' },
                                  { role: 'user', content: 'Say "OK" and nothing else.' },
                                ],
                                temperature: 0.1,
                                max_tokens: 32,
                                ...(settings.aiModel ? { model: settings.aiModel } : {}),
                              };
                        const resp = await fetch(settings.aiEndpoint, {
                          method: 'POST',
                          headers,
                          body: JSON.stringify(body),
                        });
                        if (!resp.ok) {
                          const errText = await resp.text().catch(() => '');
                          result = {
                            success: false,
                            error: `API error ${resp.status}: ${errText || resp.statusText}`,
                          };
                        } else {
                          result = { success: true };
                        }
                      }
                      if (result.success) {
                        setTestStatus('success');
                      } else {
                        setTestStatus('error');
                        setTestError(result.error || 'Unknown error');
                      }
                    } catch (err) {
                      setTestStatus('error');
                      setTestError(err.message || 'Connection failed');
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
                  {t('settingsAiTestFailed')} {testError}
                </p>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
