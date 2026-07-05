/**
 * SettingsContext - Global state provider for app settings
 * Loads settings from electron-store on mount and provides
 * update functions to persist changes.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { isElectron } from '../utils/fileHelpers';

const SettingsContext = createContext(null);

const DEFAULT_SETTINGS = {
  confirmBeforeSave: true,
  autoBackupBeforeSave: true,
  defaultExportPath: '',
  aiEnabled: true,
  aiProvider: 'openai-compatible',
  aiEndpoint: 'http://localhost:1234/v1/chat/completions',
  aiModel: '',
  aiApiKey: '',
  aiTemperature: 0.7,
  aiMaxTokens: 4096,
  aiRegion: 'us-east-1',
};

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  // Load settings on mount
  useEffect(() => {
    async function load() {
      if (isElectron()) {
        try {
          const stored = await window.electronAPI.settingsGetAll();
          setSettings((prev) => ({ ...prev, ...stored }));
        } catch (err) {
          console.error('Failed to load settings:', err);
        }
      }
      setLoaded(true);
    }
    load();
  }, []);

  // Update a single setting and persist
  const updateSetting = useCallback(async (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    if (isElectron()) {
      await window.electronAPI.settingsSet(key, value);
    }
  }, []);

  // Update multiple settings at once and persist
  const updateSettings = useCallback(async (partial) => {
    setSettings((prev) => ({ ...prev, ...partial }));
    if (isElectron()) {
      await window.electronAPI.settingsSetAll(partial);
    }
  }, []);

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
