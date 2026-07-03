/**
 * RomContext - Global state provider for ROM data
 * Eliminates prop drilling of teams, handlers, and ROM state through component tree
 */
import React, { createContext, useContext, useState } from 'react';
import useRomState from '../hooks/useRomState';
import useRomHandlers from '../hooks/useRomHandlers';

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
  });

  const value = {
    // State
    ...state,
    sidebarCollapsed,
    setSidebarCollapsed,

    // Handlers
    ...handlers,
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
