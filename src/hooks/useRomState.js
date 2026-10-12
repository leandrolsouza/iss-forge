/**
 * Core ROM state management hook
 * Manages: romParser, teams, selection, tabs, modified status, undo/redo history
 */
import { useState, useCallback, useRef } from 'react';
import RomParser from '../rom/RomParser';
import useHistory from './useHistory';
import { restoreSnapshot, snapshotGlobals } from './snapshotRestore';
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

  // `modified` follows the history's saved point (see useHistory); these are stable
  const { isModified, touch: touchHistory, markSaved: markHistorySaved } = history;
  const syncModified = useCallback(() => setModified(isModified()), [isModified]);

  // ROM waiting for the user to confirm discarding unsaved changes
  const [pendingLoad, setPendingLoad] = useState(null);

  /**
   * Parse and load a ROM, replacing the current session.
   * @param {Uint8Array} data
   * @param {string} fileName
   * @param {string|null} [filePath] - absolute path on disk (Electron); becomes the "Save" target
   * @param {{ originalData?: Uint8Array, restored?: boolean }} [options]
   *   restored: `data` is an auto-save backup (unsaved edits): the session starts as
   *   modified and `originalData` (the unedited ROM) stays the base for patches/restores
   */
  const loadRomData = useCallback(
    (data, fileName, filePath = null, { originalData = null, restored = false } = {}) => {
      setLoading(true);

      // Use setTimeout to allow the loading UI to render before synchronous parsing
      setTimeout(() => {
        try {
          const parser = new RomParser(data, originalData);
          const validation = parser.validate();

          if (!validation.isValid) {
            setStatusMessage({ key: validation.messageKey });
            toast?.error(t('toastRomInvalid', { file: fileName }), {
              detail: t(validation.messageKey),
            });
            setLoading(false);
            return;
          }

          if (isElectron()) electronBridge.setCurrentRomPath(filePath);

          setRomParser(parser);
          romParserRef.current = parser;
          setRomInfo({ fileName, ...validation, restored });
          setStatusMessage({
            key: 'statusRomLoaded',
            params: {
              status: { key: validation.messageKey, params: validation.messageParams },
              file: fileName,
            },
          });
          // a restored backup holds unsaved edits: it matches no file on disk
          history.clearHistory({ saved: !restored });
          setModified(restored);

          const allTeams = parser.readAllTeams();
          setTeams(allTeams);
          setScenarios(parser.readScenarios());
          setMatchPalettes(parser.readMatchPalettes());
          setTournamentDraws(parser.readTournamentDraws());
          setGameTexts(parser.readTrainingTexts());
          setMenuScreens(parser.readMenuScreens());
          setScreenTexts(parser.readScreenTexts());
          setTitleScreen(parser.readTitleScreen());

          if (allTeams.length > 0) {
            setSelectedTeamIndex(0);
            setOpenTabs([{ id: 'players', label: 'editorPlayers' }]);
            setActiveTab('players');
          }
        } catch (err) {
          console.error('[ROM] Failed to load:', err);
          setStatusMessage({ key: 'statusError', params: { error: err.message } });
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
    // Edits normally get a new state from pushSnapshot; this covers any that don't
    touchHistory();
    setModified(true);
    setStatusMessage(romInfo?.fileName || '');
  }, [romInfo, touchHistory]);

  const markSaved = useCallback(
    (path) => {
      markHistorySaved();
      setModified(false);
      setStatusMessage(path || '');
    },
    [markHistorySaved],
  );

  // Undo/Redo operations
  // Snapshots hold { teams, scenarios, matchPalettes, ...raw ROM byte sections }.
  // Callers keep passing `teams`; the global data is added here so every edit is
  // undoable as one unit (see snapshotRestore.js).
  const currentGlobals = () =>
    snapshotGlobals(romParserRef.current, {
      scenarios: scenariosRef.current,
      matchPalettes: matchPalettesRef.current,
    });

  const pushSnapshot = useCallback(
    (teamsSnapshot) => {
      history.pushSnapshot({ teams: teamsSnapshot, ...currentGlobals() });
    },
    [history],
  );

  const applySnapshot = useCallback(
    (restored) => {
      if (!romParser) return;
      // Only what differs is written and re-read: editors holding an unapplied draft
      // keep it when the undo is about something else
      const { teams: nextTeams, changed } = restoreSnapshot(romParser, restored, teams);
      setTeams(nextTeams);
      if (changed.has('scenarios')) setScenarios(romParser.readScenarios());
      if (changed.has('matchPalettes')) setMatchPalettes(romParser.readMatchPalettes());
      if (changed.has('tournamentDraws')) setTournamentDraws(romParser.readTournamentDraws());
      if (changed.has('gameTexts')) setGameTexts(romParser.readTrainingTexts());
      if (changed.has('menuScreens')) setMenuScreens(romParser.readMenuScreens());
      if (changed.has('screenTexts')) setScreenTexts(romParser.readScreenTexts());
      if (changed.has('titleScreen')) setTitleScreen(romParser.readTitleScreen());
    },
    [romParser, teams, setScenarios, setMatchPalettes],
  );

  /**
   * Drop the snapshot taken by the last pushSnapshot, when the edit it guarded was
   * rejected or changed nothing (no empty undo steps). Whatever a failed write may
   * have touched in the ROM (moved blocks, partial data) is put back from that
   * snapshot; only the sections that really differ are re-read.
   */
  const cancelSnapshot = useCallback(() => {
    const dropped = history.cancelLast();
    if (!dropped) return;
    applySnapshot(dropped);
    syncModified();
  }, [history, applySnapshot, syncModified]);

  const performUndo = useCallback(() => {
    const restored = history.undo({ teams, ...currentGlobals() });
    if (restored) {
      applySnapshot(restored);
      syncModified();
    }
  }, [history, teams, applySnapshot, syncModified]);

  const performRedo = useCallback(() => {
    const restored = history.redo({ teams, ...currentGlobals() });
    if (restored) {
      applySnapshot(restored);
      syncModified();
    }
  }, [history, teams, applySnapshot, syncModified]);

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
    cancelSnapshot,
    performUndo,
    performRedo,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
  };
}
