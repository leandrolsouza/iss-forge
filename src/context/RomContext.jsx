/**
 * RomContext - Global state provider for ROM data
 * Eliminates prop drilling of teams, handlers, and ROM state through component tree
 */
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import useRomState from '../hooks/useRomState';
import useRomHandlers from '../hooks/useRomHandlers';
import useAutoSave from '../hooks/useAutoSave';
import useProjects from '../hooks/useProjects';
import { useToast } from './ToastContext';
import { useSettings } from './SettingsContext';
import { useConfirm, useGuardDrafts } from './ConfirmContext';
import { useI18n } from '../i18n';

const RomContext = createContext(null);

export function RomProvider({ children }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const toast = useToast();
  const { t } = useI18n();
  const { settings } = useSettings();
  const confirm = useConfirm();
  const guardDrafts = useGuardDrafts();

  const state = useRomState({ toast, t });
  const handlers = useRomHandlers({
    toast,
    t,
    settings,
    confirm,
    romParser: state.romParser,
    romInfo: state.romInfo,
    currentProject: state.currentProject,
    setCurrentProject: state.setCurrentProject,
    setRomFile: state.setRomFile,
    teams: state.teams,
    setTeams: state.setTeams,
    markModified: state.markModified,
    markSaved: state.markSaved,
    captureSavePoint: state.captureSavePoint,
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
    currentProject: state.currentProject,
    onError: (err) => toast.error(t('backupFailed'), { detail: err.message, duration: 0 }),
  });

  const projects = useProjects({
    toast,
    t,
    confirm,
    guardDrafts,
    romParser: state.romParser,
    romInfo: state.romInfo,
    modified: state.modified,
    currentProject: state.currentProject,
    setCurrentProject: state.setCurrentProject,
    requestLoadRom: state.requestLoadRom,
    unloadRom: state.unloadRom,
    markSaved: state.markSaved,
    captureSavePoint: state.captureSavePoint,
    setLoading: state.setLoading,
    clearBackup: autoSave.clearBackup,
    clearProjectAutosave: autoSave.clearProjectAutosave,
  });

  // Clear the backup once a session matches what is saved again (saved, or undone back
  // to the last save, or its edits discarded to open something else). A restored backup
  // never matches until it is saved. The backup cleared is the one of the session that
  // had the edits: the global one for a ROM file, the project's own for a project.
  const projectId = state.currentProject?.id || null;
  const prevRef = useRef({ modified: state.modified, projectId });
  useEffect(() => {
    const prev = prevRef.current;
    if (prev.modified && !state.modified && state.romParser) {
      if (prev.projectId) autoSave.clearProjectAutosave(prev.projectId);
      else autoSave.clearBackup();
    }
    prevRef.current = { modified: state.modified, projectId };
  }, [state.modified, state.romParser, projectId, autoSave]);

  const value = {
    // State
    ...state,
    sidebarCollapsed,
    setSidebarCollapsed,

    // Handlers
    ...handlers,

    // Auto-save
    ...autoSave,

    // Projects
    ...projects,
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
