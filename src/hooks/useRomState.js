/**
 * Core ROM state management hook
 * Manages: romParser, teams, selection, tabs, modified status, undo/redo history
 */
import { useState, useCallback } from 'react';
import RomParser from '../rom/RomParser';
import useHistory from './useHistory';

export default function useRomState() {
  const [romParser, setRomParser] = useState(null);
  const [romInfo, setRomInfo] = useState(null);
  const [teams, setTeams] = useState([]);
  const [selectedTeamIndex, setSelectedTeamIndex] = useState(null);
  const history = useHistory();
  const [activeTab, setActiveTab] = useState('players');
  const [openTabs, setOpenTabs] = useState([]);
  const [modified, setModified] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const loadRomData = useCallback((data, fileName) => {
    setLoading(true);

    // Use setTimeout to allow the loading UI to render before synchronous parsing
    setTimeout(() => {
      try {
        const parser = new RomParser(data);
        const validation = parser.validate();

        if (!validation.isValid) {
          setStatusMessage(`Error: ${validation.message}`);
          setLoading(false);
          return;
        }

        setRomParser(parser);
        setRomInfo({ fileName, ...validation });
        setStatusMessage(validation.message + ` - ${fileName}`);
        setModified(false);

        const allTeams = parser.readAllTeams();
        setTeams(allTeams);
        history.clearHistory();

        if (allTeams.length > 0) {
          setSelectedTeamIndex(0);
          setOpenTabs([{ id: 'players', label: 'Players' }]);
          setActiveTab('players');
        }
      } finally {
        setLoading(false);
      }
    }, 50);
  }, [history]);

  const markModified = useCallback(() => {
    setModified(true);
    setStatusMessage(romInfo?.fileName || '');
  }, [romInfo]);

  const markSaved = useCallback((path) => {
    setModified(false);
    setStatusMessage(path || '');
  }, []);

  // Undo/Redo operations
  const performUndo = useCallback(() => {
    const restored = history.undo(teams);
    if (restored) {
      setTeams(restored);
      // Re-sync ROM buffer from restored state
      if (romParser) {
        romParser.reloadTeams(restored);
      }
      setModified(history.canUndo);
    }
  }, [history, teams, romParser]);

  const performRedo = useCallback(() => {
    const restored = history.redo(teams);
    if (restored) {
      setTeams(restored);
      if (romParser) {
        romParser.reloadTeams(restored);
      }
      setModified(true);
    }
  }, [history, teams, romParser]);

  // Tab management
  const selectTeam = useCallback(
    (teamIndex) => {
      setSelectedTeamIndex(teamIndex);
      if (!openTabs.find((t) => t.id === 'players')) {
        setOpenTabs((prev) => [...prev, { id: 'players', label: 'Players' }]);
      }
      setActiveTab('players');
    },
    [openTabs],
  );

  const openTab = useCallback(
    (tabId, label) => {
      if (!openTabs.find((t) => t.id === tabId)) {
        setOpenTabs((prev) => [...prev, { id: tabId, label }]);
      }
      setActiveTab(tabId);
    },
    [openTabs],
  );

  const closeTab = useCallback(
    (tabId) => {
      setOpenTabs((prev) => {
        const newTabs = prev.filter((t) => t.id !== tabId);
        if (activeTab === tabId && newTabs.length > 0) {
          setActiveTab(newTabs[newTabs.length - 1].id);
        } else if (newTabs.length === 0) {
          setActiveTab(null);
        }
        return newTabs;
      });
    },
    [activeTab],
  );

  return {
    // State
    romParser,
    romInfo,
    teams,
    setTeams,
    selectedTeamIndex,
    activeTab,
    openTabs,
    modified,
    statusMessage,
    setStatusMessage,
    loading,
    setLoading,

    // Actions
    loadRomData,
    markModified,
    markSaved,
    selectTeam,
    openTab,
    closeTab,
    setActiveTab,

    // Undo/Redo
    pushSnapshot: history.pushSnapshot,
    performUndo,
    performRedo,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
  };
}
