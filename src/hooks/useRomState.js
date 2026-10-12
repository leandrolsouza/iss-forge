/**
 * Core ROM state management hook
 * Manages: romParser, teams, selection, tabs, modified status, undo/redo history
 */
import { useState, useCallback, useRef } from 'react';
import RomParser from '../rom/RomParser';
import useHistory from './useHistory';
import { isElectron } from '../utils/fileHelpers';
import * as electronBridge from '../services/electronBridge';

export default function useRomState({ toast, t } = {}) {
  const [romParser, setRomParser] = useState(null);
  const romParserRef = useRef(null);
  const [romInfo, setRomInfo] = useState(null);
  const [teams, setTeams] = useState([]);
  // Global (non-team) data: Scenario mode situations
  const [scenarios, setScenariosState] = useState([]);
  const scenariosRef = useRef([]);
  const setScenarios = useCallback((value) => {
    scenariosRef.current = value;
    setScenariosState(value);
  }, []);
  // Global (non-team) data: pitch / ball / referee palettes
  const [matchPalettes, setMatchPalettesState] = useState(null);
  const matchPalettesRef = useRef(null);
  const setMatchPalettes = useCallback((value) => {
    matchPalettesRef.current = value;
    setMatchPalettesState(value);
  }, []);
  // Global (non-team) data: International Cup / World Series draws
  const [tournamentDraws, setTournamentDraws] = useState([]);
  // Global (non-team) data: training mode texts
  const [gameTexts, setGameTexts] = useState(null);
  const [menuScreens, setMenuScreens] = useState([]);
  const [screenTexts, setScreenTexts] = useState(null);
  // Global (non-team) data: title screen colours / teams
  const [titleScreen, setTitleScreen] = useState(null);
  const [selectedTeamIndex, setSelectedTeamIndex] = useState(null);
  const history = useHistory();
  const [activeTab, setActiveTab] = useState('players');
  const [openTabs, setOpenTabs] = useState([]);
  const [modified, setModified] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Mirror of `modified` for callbacks registered once (IPC listeners, drop handlers)
  const modifiedRef = useRef(false);
  modifiedRef.current = modified;

  // ROM waiting for the user to confirm discarding unsaved changes
  const [pendingLoad, setPendingLoad] = useState(null);

  /**
   * Parse and load a ROM, replacing the current session.
   * @param {Uint8Array} data
   * @param {string} fileName
   * @param {string|null} [filePath] - absolute path on disk (Electron); becomes the "Save" target
   */
  const loadRomData = useCallback(
    (data, fileName, filePath = null) => {
      setLoading(true);

      // Use setTimeout to allow the loading UI to render before synchronous parsing
      setTimeout(() => {
        try {
          const parser = new RomParser(data);
          const validation = parser.validate();

          if (!validation.isValid) {
            setStatusMessage(`Error: ${validation.message}`);
            toast?.error(t('toastRomInvalid', { file: fileName }), { detail: validation.message });
            setLoading(false);
            return;
          }

          if (isElectron()) electronBridge.setCurrentRomPath(filePath);

          setRomParser(parser);
          romParserRef.current = parser;
          setRomInfo({ fileName, ...validation });
          setStatusMessage(validation.message + ` - ${fileName}`);
          setModified(false);

          const allTeams = parser.readAllTeams();
          setTeams(allTeams);
          setScenarios(parser.readScenarios());
          setMatchPalettes(parser.readMatchPalettes());
          setTournamentDraws(parser.readTournamentDraws());
          setGameTexts(parser.readTrainingTexts());
          setMenuScreens(parser.readMenuScreens());
          setScreenTexts(parser.readScreenTexts());
          setTitleScreen(parser.readTitleScreen());
          history.clearHistory();

          if (allTeams.length > 0) {
            setSelectedTeamIndex(0);
            setOpenTabs([{ id: 'players', label: 'editorPlayers' }]);
            setActiveTab('players');
          }
        } catch (err) {
          console.error('[ROM] Failed to load:', err);
          setStatusMessage(`Error: ${err.message}`);
          toast?.error(t('toastRomLoadFailed', { file: fileName }), { detail: err.message });
        } finally {
          setLoading(false);
        }
      }, 50);
    },
    [history, setScenarios, setMatchPalettes, toast, t],
  );

  /**
   * Load a ROM, but ask first when the current one has unsaved changes.
   * Every "open" path (dialog, recents, drag-and-drop) should go through here.
   */
  const requestLoadRom = useCallback(
    (data, fileName, filePath = null) => {
      if (modifiedRef.current) {
        setLoading(false);
        setPendingLoad({ data, fileName, filePath });
        return;
      }
      loadRomData(data, fileName, filePath);
    },
    [loadRomData],
  );

  const confirmPendingLoad = useCallback(() => {
    if (pendingLoad) loadRomData(pendingLoad.data, pendingLoad.fileName, pendingLoad.filePath);
    setPendingLoad(null);
  }, [pendingLoad, loadRomData]);

  const cancelPendingLoad = useCallback(() => setPendingLoad(null), []);

  const markModified = useCallback(() => {
    setModified(true);
    setStatusMessage(romInfo?.fileName || '');
  }, [romInfo]);

  const markSaved = useCallback((path) => {
    setModified(false);
    setStatusMessage(path || '');
  }, []);

  // Undo/Redo operations
  // Snapshots hold { teams, scenarios, matchPalettes }. Callers keep passing
  // `teams`; the global data is added here so every edit is undoable as one unit.
  const currentGlobals = () => ({
    scenarios: scenariosRef.current,
    matchPalettes: matchPalettesRef.current,
    // Raw bytes of the team-name regions: name writes shift data around and are not
    // reversible by re-encoding, so undo restores the exact bytes
    teamNameBytes: romParserRef.current ? romParserRef.current.readTeamNameBytes() : null,
    // Same for the selection-screen descriptions (re-packed on every edit)
    teamDescBytes: romParserRef.current ? romParserRef.current.readTeamDescriptionBytes() : null,
    // ...and the flag designs (recompression is not byte-identical either)
    flagBytes: romParserRef.current ? romParserRef.current.readFlagDesignBytes() : null,
    // Tournament draws (768 bytes, restored as-is)
    drawBytes: romParserRef.current ? romParserRef.current.readTournamentDrawBytes() : null,
    // Training texts (re-packed on every edit)
    gameTextBytes: romParserRef.current ? romParserRef.current.readTrainingTextBytes() : null,
    menuBytes: romParserRef.current ? romParserRef.current.readMenuScreenBytes() : null,
    screenTextBytes: romParserRef.current ? romParserRef.current.readScreenTextBytes() : null,
    titleScreenBytes: romParserRef.current ? romParserRef.current.readTitleScreenBytes() : null,
  });

  const pushSnapshot = useCallback(
    (teamsSnapshot) => history.pushSnapshot({ teams: teamsSnapshot, ...currentGlobals() }),
    [history],
  );

  const applySnapshot = useCallback(
    (restored) => {
      const restoredTeams = Array.isArray(restored) ? restored : restored.teams;
      setTeams(restoredTeams);
      // Re-sync ROM buffer from restored state (only what changed)
      if (romParser) {
        romParser.reloadTeams(restoredTeams, teams);
        if (!Array.isArray(restored) && restored.scenarios) {
          romParser.restoreScenarios(restored.scenarios);
          setScenarios(romParser.readScenarios());
        }
        if (!Array.isArray(restored) && restored.teamNameBytes) {
          romParser.restoreTeamNameBytes(restored.teamNameBytes);
        }
        if (!Array.isArray(restored) && restored.flagBytes) {
          romParser.restoreFlagDesignBytes(restored.flagBytes);
        }
        if (!Array.isArray(restored) && restored.teamDescBytes) {
          romParser.restoreTeamDescriptionBytes(restored.teamDescBytes);
        }
        if (!Array.isArray(restored) && restored.matchPalettes) {
          romParser.restoreMatchPalettes(restored.matchPalettes);
          setMatchPalettes(romParser.readMatchPalettes());
        }
        if (!Array.isArray(restored) && restored.drawBytes) {
          romParser.restoreTournamentDrawBytes(restored.drawBytes);
          setTournamentDraws(romParser.readTournamentDraws());
        }
        if (!Array.isArray(restored) && restored.gameTextBytes) {
          romParser.restoreTrainingTextBytes(restored.gameTextBytes);
          setGameTexts(romParser.readTrainingTexts());
        }
        if (!Array.isArray(restored) && restored.menuBytes) {
          romParser.restoreMenuScreenBytes(restored.menuBytes);
          setMenuScreens(romParser.readMenuScreens());
        }
        if (!Array.isArray(restored) && restored.screenTextBytes) {
          romParser.restoreScreenTextBytes(restored.screenTextBytes);
          setScreenTexts(romParser.readScreenTexts());
        }
        if (!Array.isArray(restored) && restored.titleScreenBytes) {
          romParser.restoreTitleScreenBytes(restored.titleScreenBytes);
          setTitleScreen(romParser.readTitleScreen());
        }
      }
    },
    [romParser, teams, setScenarios, setMatchPalettes],
  );

  const performUndo = useCallback(() => {
    const restored = history.undo({ teams, ...currentGlobals() });
    if (restored) {
      applySnapshot(restored);
      setModified(history.canUndo);
    }
  }, [history, teams, applySnapshot]);

  const performRedo = useCallback(() => {
    const restored = history.redo({ teams, ...currentGlobals() });
    if (restored) {
      applySnapshot(restored);
      setModified(true);
    }
  }, [history, teams, applySnapshot]);

  // Tab management
  const selectTeam = useCallback(
    (teamIndex) => {
      setSelectedTeamIndex(teamIndex);
      if (!openTabs.find((t) => t.id === 'players')) {
        setOpenTabs((prev) => [...prev, { id: 'players', label: 'editorPlayers' }]);
      }
      if (!activeTab || !openTabs.find((t) => t.id === activeTab)) {
        setActiveTab('players');
      }
    },
    [openTabs, activeTab],
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
    scenarios,
    setScenarios,
    matchPalettes,
    setMatchPalettes,
    tournamentDraws,
    setTournamentDraws,
    gameTexts,
    setGameTexts,
    menuScreens,
    setMenuScreens,
    screenTexts,
    setScreenTexts,
    titleScreen,
    setTitleScreen,
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
    requestLoadRom,
    pendingLoad,
    confirmPendingLoad,
    cancelPendingLoad,
    markModified,
    markSaved,
    selectTeam,
    openTab,
    closeTab,
    setActiveTab,

    // Undo/Redo
    pushSnapshot,
    performUndo,
    performRedo,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
  };
}
