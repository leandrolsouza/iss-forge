import React, { useEffect, useState, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import TabBar from './components/TabBar';
import PlayerEditor from './components/PlayerEditor';
import FormationEditor from './components/FormationEditor';
import ScenarioEditor from './components/ScenarioEditor';
import TournamentEditor from './components/TournamentEditor';
import GameTextEditor from './components/GameTextEditor';
import MatchPaletteEditor from './components/MatchPaletteEditor';
import TitleScreenEditor from './components/TitleScreenEditor';
import UniformEditor from './components/UniformEditor';
import HairSkinEditor from './components/HairSkinEditor';
import FlagColorEditor from './components/FlagColorEditor';
import FlagDesignEditor from './components/FlagDesignEditor';
import TeamNameEditor from './components/TeamNameEditor';
import TeamPreview from './components/TeamPreview';
import TeamCompare from './components/TeamCompare';
import AboutPanel from './components/AboutPanel';
import AIGeneratorPanel from './components/AIGeneratorPanel';
import SettingsPage from './components/SettingsPage';
import StatusBar from './components/StatusBar';
import UpdateNotification from './components/UpdateNotification';
import WelcomePanel from './components/WelcomePanel';
import LoadingOverlay from './components/LoadingOverlay';
import UnsavedModal from './components/UnsavedModal';
import BackupBanner from './components/BackupBanner';
import TeamSelector from './components/TeamSelector';
import ExportPatchModal from './components/ExportPatchModal';
import { TEAMS } from './rom/constants';
import { isElectron } from './utils/fileHelpers';
import {
  IconOpen,
  IconSave,
  IconPatch,
  IconPlay,
  IconUndo,
  IconRedo,
  IconSettings,
} from './components/Icons';
import { useRom } from './context/RomContext';
import { useGuardDrafts } from './context/ConfirmContext';
import { useI18n } from './i18n';

/** Editors that are not tied to the selected team */
const GLOBAL_TABS = new Set([
  'scenarios',
  'tournaments',
  'gameTexts',
  'matchPalettes',
  'titleScreen',
  'settings',
  'about',
  'compare',
]);

const TEXT_INPUT_TYPES = new Set(['text', 'number', 'search', 'url', 'email', 'password', '']);

/** True when keyboard focus is in a field with its own text undo/redo */
function isEditableFocused() {
  const el = document.activeElement;
  if (!el) return false;
  if (el.isContentEditable || el.tagName === 'TEXTAREA') return true;
  return (
    el.tagName === 'INPUT' && TEXT_INPUT_TYPES.has((el.getAttribute('type') || '').toLowerCase())
  );
}

export default function App() {
  const { t, lang } = useI18n();
  const {
    romParser,
    romInfo,
    teams,
    selectedTeamIndex,
    activeTab,
    openTabs,
    modified,
    statusMessage,
    loading,
    setLoading,
    sidebarCollapsed,
    setSidebarCollapsed,
    requestLoadRom,
    pendingLoad,
    confirmPendingLoad,
    cancelPendingLoad,
    setStatusMessage,
    selectTeam,
    openTab,
    closeTab,
    setActiveTab,
    handleOpenRom,
    handleSave,
    handleSaveToPath,
    handleTestInEmulator,
    handlePlayerChange,
    handleUniformChange,
    handleHairSkinChange,
    handleHairSkinTemplateApply,
    handleSpecialHairSkinChange,
    handleFlagColorChange,
    handleFlagColorBulkChange,
    handleFlagDesignChange,
    handleFlagDesignBulkChange,
    handleTeamNameGenerate,
    handleTeamNameMenuSave,
    handleTeamNameInGameGenerate,
    handleFormationChange,
    handleSwapPlayers,
    handleDrop,
    handleDragOver,
    performUndo,
    performRedo,
    canUndo,
    canRedo,
  } = useRom();

  // Export patch modal
  const [showPatchModal, setShowPatchModal] = useState(false);
  const openPatchModal = useCallback(() => {
    if (romParser) setShowPatchModal(true);
  }, [romParser]);
  const closePatchModal = useCallback(() => setShowPatchModal(false), []);

  // Navigation that unmounts the current editor asks before dropping an unapplied draft
  const guardDrafts = useGuardDrafts();
  const goToTab = useCallback(
    async (tabId) => {
      if (tabId !== activeTab && !(await guardDrafts())) return;
      setActiveTab(tabId);
    },
    [activeTab, guardDrafts, setActiveTab],
  );
  const openTabGuarded = useCallback(
    async (tabId, label) => {
      if (tabId !== activeTab && !(await guardDrafts())) return;
      openTab(tabId, label);
    },
    [activeTab, guardDrafts, openTab],
  );
  const closeTabGuarded = useCallback(
    async (tabId) => {
      // only the active tab is mounted, so only it can hold a draft
      if (tabId === activeTab && !(await guardDrafts())) return;
      closeTab(tabId);
    },
    [activeTab, guardDrafts, closeTab],
  );
  const selectTeamGuarded = useCallback(
    async (index) => {
      // global editors keep their drafts across team changes
      if (index !== selectedTeamIndex && !GLOBAL_TABS.has(activeTab) && !(await guardDrafts()))
        return;
      selectTeam(index);
    },
    [activeTab, selectedTeamIndex, guardDrafts, selectTeam],
  );

  useEffect(() => {
    if (!isElectron()) return;
    window.electronAPI.onMenuExportPatch?.(() => openPatchModal());
    return () => window.electronAPI.removeAllListeners('menu:exportPatch');
  }, [openPatchModal]);

  useEffect(() => {
    if (!isElectron()) return;
    window.electronAPI.onMenuTestEmulator?.(() => {
      if (romParser) handleTestInEmulator();
    });
    return () => window.electronAPI.removeAllListeners('menu:testEmulator');
  }, [romParser, handleTestInEmulator]);

  // IPC listeners and keyboard shortcuts
  useEffect(() => {
    // Inside a text field Ctrl+Z / Ctrl+Y belong to the field (native text undo),
    // not to the ROM history
    const undo = () => (isEditableFocused() ? document.execCommand('undo') : performUndo());
    const redo = () => (isEditableFocused() ? document.execCommand('redo') : performRedo());

    if (isElectron()) {
      window.electronAPI.onRomLoaded((data) =>
        requestLoadRom(new Uint8Array(data.data), data.name, data.path || null),
      );
      window.electronAPI.onMenuSave(() => handleSave());
      window.electronAPI.onSaveAsPath((filePath) => handleSaveToPath(filePath));
      window.electronAPI.onMenuUndo(undo);
      window.electronAPI.onMenuRedo(redo);
      window.electronAPI.onMenuAbout?.(() => openTabGuarded('about', t('aboutTitle')));

      // Cancel loading if dialog was dismissed without selecting a file
      window.electronAPI.onRomLoadCancelled?.(() => setLoading(false));
    }

    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        handleOpenRom();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      // Export patch: Ctrl+E (web fallback; Electron uses the menu accelerator)
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        openPatchModal();
      }
      // Undo / redo (web fallback): leave text fields to the browser's own undo
      if (isEditableFocused()) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        performUndo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        performRedo();
      }
    };

    if (!isElectron()) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }

    // Electron: drop the listeners registered above before the next run, otherwise
    // every re-render with new handlers stacks another copy (one Ctrl+S = N saves)
    return () => {
      [
        'rom:loaded',
        'menu:save',
        'rom:save-as-path',
        'menu:undo',
        'menu:redo',
        'menu:about',
        'rom:loadCancelled',
      ].forEach((channel) => window.electronAPI.removeAllListeners(channel));
    };
  }, [
    requestLoadRom,
    handleSave,
    handleSaveToPath,
    handleOpenRom,
    setLoading,
    performUndo,
    performRedo,
    openPatchModal,
    openTabGuarded,
    t,
  ]);

  // Sync modified state to main process (for close guard)
  useEffect(() => {
    if (isElectron()) {
      window.electronAPI.setModifiedState(modified);
    }
  }, [modified]);

  // Sync locale to main process (for native dialog i18n)
  useEffect(() => {
    if (isElectron()) {
      window.electronAPI.setLocale(lang);
    }
  }, [lang]);

  // Web fallback: warn on tab/window close with unsaved changes
  useEffect(() => {
    if (isElectron()) return;

    const handleBeforeUnload = (e) => {
      if (modified) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [modified]);

  // Unsaved changes modal state
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);

  useEffect(() => {
    if (isElectron()) {
      window.electronAPI.onConfirmClose(() => setShowUnsavedModal(true));
    }
  }, []);

  const handleCloseModalSave = useCallback(() => {
    setShowUnsavedModal(false);
    window.electronAPI.sendCloseResponse('save');
  }, []);

  const handleCloseModalDiscard = useCallback(() => {
    setShowUnsavedModal(false);
    window.electronAPI.sendCloseResponse('discard');
  }, []);

  const handleCloseModalCancel = useCallback(() => {
    setShowUnsavedModal(false);
    window.electronAPI.sendCloseResponse('cancel');
  }, []);

  // Opening another ROM while the current one has unsaved changes
  const handleOpenModalSave = useCallback(async () => {
    const saved = await handleSave();
    if (saved) {
      confirmPendingLoad();
    } else {
      // Save needs a "Save As" dialog (or failed): keep the current ROM untouched
      cancelPendingLoad();
      setStatusMessage('unsavedSaveNeedsPath');
    }
  }, [handleSave, confirmPendingLoad, cancelPendingLoad, setStatusMessage]);

  // Editor renderer
  const renderEditor = () => {
    if (activeTab === 'about') return <AboutPanel />;
    if (activeTab === 'settings') return <SettingsPage />;
    if (activeTab === 'compare' && teams.length > 0) return <TeamCompare teams={teams} />;
    if (activeTab === 'scenarios' && romParser) return <ScenarioEditor />;
    if (activeTab === 'tournaments' && romParser) return <TournamentEditor />;
    if (activeTab === 'gameTexts' && romParser) return <GameTextEditor />;
    if (activeTab === 'matchPalettes' && romParser) return <MatchPaletteEditor />;
    if (activeTab === 'titleScreen' && romParser) return <TitleScreenEditor />;

    // ROM loaded but every tab was closed: don't fall back to the "Open ROM" screen
    if (romParser && !openTabs.some((tab) => tab.id === activeTab)) {
      return (
        <div className="editor-panel empty editor-empty-state">
          <h2>{t('noEditorOpenTitle')}</h2>
          <p>{t('noEditorOpenHint')}</p>
          <button className="welcome-btn" onClick={() => openTab('players', t('editorPlayers'))}>
            {t('noEditorOpenPlayers')}
          </button>
        </div>
      );
    }

    if (!romParser || selectedTeamIndex === null) {
      return (
        <WelcomePanel onOpenRom={handleOpenRom} onDrop={handleDrop} onDragOver={handleDragOver} />
      );
    }

    const team = teams[selectedTeamIndex];
    const props = { team, teamIndex: selectedTeamIndex };

    switch (activeTab) {
      case 'players':
        return <PlayerEditor {...props} onPlayerChange={handlePlayerChange} />;
      case 'formation':
        return (
          <FormationEditor
            {...props}
            onFormationChange={handleFormationChange}
            onSwapPlayers={handleSwapPlayers}
          />
        );
      case 'uniforms':
        return <UniformEditor {...props} onUniformChange={handleUniformChange} />;
      case 'hairskin':
        return (
          <HairSkinEditor
            {...props}
            onHairSkinChange={handleHairSkinChange}
            onHairSkinTemplateApply={handleHairSkinTemplateApply}
            onSpecialHairSkinChange={handleSpecialHairSkinChange}
          />
        );
      case 'flagcolors':
        return <FlagColorEditor {...props} onFlagColorChange={handleFlagColorChange} />;
      case 'flagdesign':
        return (
          <FlagDesignEditor
            {...props}
            onFlagDesignChange={handleFlagDesignChange}
            onFlagDesignBulkChange={handleFlagDesignBulkChange}
            onFlagColorChange={handleFlagColorChange}
            onFlagColorBulkChange={handleFlagColorBulkChange}
          />
        );
      case 'teamname':
        return (
          <TeamNameEditor
            {...props}
            onTeamNameMenuSave={handleTeamNameMenuSave}
            onTeamNameInGameGenerate={handleTeamNameInGameGenerate}
          />
        );
      case 'preview':
        return <TeamPreview {...props} />;
      case 'ai':
        return <AIGeneratorPanel teamIndex={selectedTeamIndex} />;
      default:
        return (
          <WelcomePanel onOpenRom={handleOpenRom} onDrop={handleDrop} onDragOver={handleDragOver} />
        );
    }
  };

  return (
    <div className="app" onDrop={handleDrop} onDragOver={handleDragOver}>
      <div className="app-titlebar">
        <div className="app-titlebar-actions">
          <button className="titlebar-btn" onClick={handleOpenRom} title="Open ROM (Ctrl+O)">
            <IconOpen size={16} />
          </button>
          <button
            className="titlebar-btn"
            onClick={handleSave}
            title="Save ROM (Ctrl+S)"
            disabled={!romParser}
          >
            <IconSave size={16} />
          </button>
          <button
            className="titlebar-btn"
            onClick={openPatchModal}
            title={t('toolbarExportPatch')}
            disabled={!romParser}
          >
            <IconPatch size={16} />
          </button>
          <button
            className="titlebar-btn"
            onClick={handleTestInEmulator}
            title={isElectron() ? t('toolbarTestEmulator') : t('emulatorDesktopOnly')}
            disabled={!romParser || !isElectron()}
          >
            <IconPlay size={16} />
          </button>
          <button
            className="titlebar-btn"
            onClick={performUndo}
            title={t('toolbarUndo')}
            disabled={!canUndo}
          >
            <IconUndo size={16} />
          </button>
          <button
            className="titlebar-btn"
            onClick={performRedo}
            title={t('toolbarRedo')}
            disabled={!canRedo}
          >
            <IconRedo size={16} />
          </button>
          <button
            className="titlebar-btn"
            onClick={() => openTabGuarded('settings', t('settingsTitle'))}
            title={t('settingsTitle')}
          >
            <IconSettings size={16} />
          </button>
        </div>
        <span className="app-titlebar-title">
          ISS Forge <span className="beta-badge">BETA</span>{' '}
          {romInfo ? `- ${romInfo.fileName}${modified ? ' *' : ''}` : ''}
        </span>
        <div className="app-titlebar-spacer"></div>
      </div>

      <BackupBanner />

      <div className="app-body">
        <Sidebar
          onOpenTab={openTabGuarded}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <div className="main-content">
          {openTabs.length > 0 && (
            <TabBar
              tabs={openTabs}
              activeTab={activeTab}
              onSelectTab={goToTab}
              onCloseTab={closeTabGuarded}
            />
          )}
          {teams.length > 0 && selectedTeamIndex !== null && (
            <TeamSelector
              teams={teams}
              selectedTeamIndex={selectedTeamIndex}
              onSelectTeam={selectTeamGuarded}
            />
          )}
          <div className="editor-area">{renderEditor()}</div>
        </div>
      </div>

      <StatusBar
        message={statusMessage}
        modified={modified}
        teamCount={teams.length}
        selectedTeam={selectedTeamIndex !== null ? TEAMS[selectedTeamIndex]?.name : null}
      />

      <UpdateNotification />

      {loading && <LoadingOverlay />}

      <UnsavedModal
        visible={showUnsavedModal}
        onSave={handleCloseModalSave}
        onDiscard={handleCloseModalDiscard}
        onCancel={handleCloseModalCancel}
      />

      <UnsavedModal
        visible={!!pendingLoad && !showUnsavedModal}
        message={t('unsavedOpenMessage', { file: pendingLoad?.fileName || '' })}
        saveLabel={t('unsavedSaveAndOpen')}
        discardLabel={t('unsavedOpenWithoutSaving')}
        onSave={handleOpenModalSave}
        onDiscard={confirmPendingLoad}
        onCancel={cancelPendingLoad}
      />

      <ExportPatchModal visible={showPatchModal} onClose={closePatchModal} />
    </div>
  );
}
