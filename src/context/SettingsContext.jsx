/**
 * SettingsContext - Global state provider for app settings
 * Loads settings from electron-store on mount and provides
 * update functions to persist changes.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { isElectron } from '../utils/fileHelpers';
import { useToast } from './ToastContext';
import { useI18n } from '../i18n';

const SettingsContext = createContext(null);

const DEFAULT_SETTINGS = {
  confirmBeforeSave: true,
  autoBackupBeforeSave: true,
  defaultExportPath: '',
  emulatorPath: '',
  emulatorArgs: '{rom}',
  aiEnabled: true,
  aiProvider: 'openai-compatible',
  aiEndpoint: 'http://localhost:1234/v1/chat/completions',
  aiModel: '',
  aiApiKey: '',
  aiTemperature: 0.7,
  aiMaxTokens: 8192, // the full team JSON is ~3k tokens; reasoning models need room to think
  aiRegion: 'us-east-1',
};

export function SettingsProvider({ children }) {
  const toast = useToast();
  const { t } = useI18n();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // Load settings on mount
  useEffect(() => {
    let active = true;
    async function load() {
      if (isElectron()) {
        try {
          const stored = await window.electronAPI.settingsGetAll();
          if (active) setSettings((prev) => ({ ...prev, ...stored }));
        } catch (err) {
          console.error('Failed to load settings:', err);
          if (active) setLoadError(err);
        }
      }
      if (active) setLoaded(true);
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!loadError) return;
    toast.error(t('settingsLoadFailed'), { detail: loadError.message });
    setLoadError(null);
  }, [loadError, toast, t]);

  // Update a single setting and persist
  const updateSettings = useCallback(
    async (partial) => {
      if (!isElectron()) {
        setSettings((prev) => ({ ...prev, ...partial }));
        return true;
      }
      try {
        const result = await window.electronAPI.settingsSetAll(partial);
        if (!result.success) throw new Error(result.error);
        setSettings((prev) => ({ ...prev, ...result.settings }));
        return true;
      } catch (err) {
        toast.error(t('settingsSaveFailed'), { detail: err.message });
        return false;
      }
    },
    [toast, t],
  );

  const updateSetting = useCallback(
    (key, value) => updateSettings({ [key]: value }),
    [updateSettings],
  );

  // Open native folder picker for export path
  const selectExportPath = useCallback(async () => {
    if (!isElectron()) return null;
    const result = await window.electronAPI.settingsSelectExportPath();
    if (result.success) {
      await updateSetting('defaultExportPath', result.path);
      return result.path;
    }
    return null;
  }, [updateSetting]);

  const value = {
    settings,
    loaded,
    updateSetting,
    updateSettings,
    selectExportPath,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

/**
 * Hook to access settings from any component
 */
export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
