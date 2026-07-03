/**
 * RomContext - Global state provider for ROM data
 * Eliminates prop drilling of teams, handlers, and ROM state through component tree
 */
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import useRomState from '../hooks/useRomState';
import useRomHandlers from '../hooks/useRomHandlers';
import useAutoSave from '../hooks/useAutoSave';

const RomContext = createContext(null);

export function RomProvider({ children }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const state = useRomState();
  const handlers = useRomHandlers({
    romParser: state.romParser,
    romInfo: state.romInfo,
    teams: state.teams,
    setTeams: state.setTeams,
    markModified: state.markModified,
    markSaved: state.markSaved,
    setStatusMessage: state.setStatusMessage,
    loadRomData: state.loadRomData,
    setLoading: state.setLoading,
    pushSnapshot: state.pushSnapshot,
  });

  const autoSave = useAutoSave({
    romParser: state.romParser,
    romInfo: state.romInfo,
    modified: state.modified,
    teams: state.teams,
  });

  // Clear backup when ROM is saved (modified transitions to false while ROM is loaded)
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
