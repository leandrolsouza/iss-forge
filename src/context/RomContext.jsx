/**
 * RomContext - Global state provider for ROM data
 * Eliminates prop drilling of teams, handlers, and ROM state through component tree
 */
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import useRomState from '../hooks/useRomState';
import useRomHandlers from '../hooks/useRomHandlers';
import useAutoSave from '../hooks/useAutoSave';
import { useToast } from './ToastContext';
import { useSettings } from './SettingsContext';
import { useConfirm } from './ConfirmContext';
import { useI18n } from '../i18n';

const RomContext = createContext(null);

export function RomProvider({ children }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const toast = useToast();
  const { t } = useI18n();
  const { settings } = useSettings();
  const confirm = useConfirm();

  const state = useRomState({ toast, t });
  const handlers = useRomHandlers({
    toast,
    t,
    settings,
    confirm,
    romParser: state.romParser,
    romInfo: state.romInfo,
    teams: state.teams,
    setTeams: state.setTeams,
    markModified: state.markModified,
    markSaved: state.markSaved,
    setStatusMessage: state.setStatusMessage,
    requestLoadRom: state.requestLoadRom,
    setLoading: state.setLoading,
    pushSnapshot: state.pushSnapshot,
    cancelSnapshot: state.cancelSnapshot,
    setScenarios: state.setScenarios,
    setMatchPalettes: state.setMatchPalettes,
    setTournamentDraws: state.setTournamentDraws,
    setGameTexts: state.setGameTexts,
    setMenuScreens: state.setMenuScreens,
    setScreenTexts: state.setScreenTexts,
    setTitleScreen: state.setTitleScreen,
  });

  const autoSave = useAutoSave({
    romParser: state.romParser,
    romInfo: state.romInfo,
    modified: state.modified,
    teams: state.teams,
  });

  // Clear the backup once the session matches the file on disk again (saved, or undone
  // back to the last save). A restored backup never matches until it is saved.
  const prevModifiedRef = useRef(state.modified);
  useEffect(() => {
    if (prevModifiedRef.current && !state.modified && state.romParser) {
      autoSave.clearBackup();
    }
    prevModifiedRef.current = state.modified;
  }, [state.modified, state.romParser, autoSave]);

  const value = {
    // State
    ...state,
    sidebarCollapsed,
    setSidebarCollapsed,

    // Handlers
    ...handlers,

    // Auto-save
    ...autoSave,
  };

  return <RomContext.Provider value={value}>{children}</RomContext.Provider>;
}

/**
 * Hook to access ROM context from any component
 */
export function useRom() {
  const context = useContext(RomContext);
  if (!context) {
    throw new Error('useRom must be used within a RomProvider');
  }
  return context;
}
