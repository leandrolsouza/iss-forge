import React, { useState } from 'react';
import { useI18n } from '../i18n';
import { useSettings } from '../context/SettingsContext';
import '../styles/settings.css';

export default function SettingsPage() {
  const { t } = useI18n();
  const { settings, updateSetting, selectExportPath } = useSettings();
  const [showApiKey, setShowApiKey] = useState(false);
  const [activeSection, setActiveSection] = useState('editor');

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
                onChange={(e) => updateSetting('aiProvider', e.target.value)}
              >
                <option value="openai-compatible">{t('settingsAiProviderOpenai')}</option>
              </select>
            </div>

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

            <div className="settings-item">
              <label className="settings-label">{t('settingsAiModel')}</label>
              <input
                className="settings-input"
                type="text"
                value={settings.aiModel}
                onChange={(e) => updateSetting('aiModel', e.target.value)}
              />
              <p className="settings-hint">{t('settingsAiModelHint')}</p>
            </div>

            <div className="settings-item">
              <label className="settings-label">{t('settingsAiApiKey')}</label>
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
                    onChange={(e) =>
                      updateSetting('aiMaxTokens', parseInt(e.target.value) || 4096)
                    }
                  />
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
