import React, { useEffect, useState, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import TabBar from './components/TabBar';
import PlayerEditor from './components/PlayerEditor';
import UniformEditor from './components/UniformEditor';
import HairSkinEditor from './components/HairSkinEditor';
import FlagColorEditor from './components/FlagColorEditor';
import FlagDesignEditor from './components/FlagDesignEditor';
import TeamNameEditor from './components/TeamNameEditor';
import TeamPreview from './components/TeamPreview';
import TeamCompare from './components/TeamCompare';
import AboutPanel from './components/AboutPanel';
import StatusBar from './components/StatusBar';
import UpdateNotification from './components/UpdateNotification';
import WelcomePanel from './components/WelcomePanel';
import LoadingOverlay from './components/LoadingOverlay';
import UnsavedModal from './components/UnsavedModal';
import BackupBanner from './components/BackupBanner';
import { TEAMS } from './rom/constants';
import { isElectron } from './utils/fileHelpers';
import { IconOpen, IconSave, IconUndo, IconRedo } from './components/Icons';
import { useRom } from './context/RomContext';
import { useI18n } from './i18n';

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
    loadRomData,
    selectTeam,
    openTab,
    closeTab,
    setActiveTab,
    handleOpenRom,
    handleSave,
    handleSaveToPath,
    handlePlayerChange,
    handleUniformChange,
    handleHairSkinChange,
    handleFlagColorChange,
    handleFlagDesignChange,
    handleTeamNameGenerate,
    handleTeamNameMenuSave,
    handleTeamNameInGameGenerate,
    handleDrop,
    handleDragOver,
    performUndo,
    performRedo,
    canUndo,
    canRedo,
  } = useRom();

  // IPC listeners and keyboard shortcuts
  useEffect(() => {
    if (isElectron()) {
      window.electronAPI.onRomLoaded((data) => loadRomData(new Uint8Array(data.data), data.name));
      window.electronAPI.onMenuSave(() => handleSave());
      window.electronAPI.onSaveAsPath((filePath) => handleSaveToPath(filePath));
      window.electronAPI.onMenuUndo(() => performUndo());
      window.electronAPI.onMenuRedo(() => performRedo());

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
      // Undo: Ctrl+Z (web fallback)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        performUndo();
      }
      // Redo: Ctrl+Shift+Z or Ctrl+Y (web fallback)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        performRedo();
      }
    };

    if (!isElectron()) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [
    loadRomData,
    handleSave,
    handleSaveToPath,
    handleOpenRom,
    setLoading,
    performUndo,
    performRedo,
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

  // Editor renderer
  const renderEditor = () => {
    if (activeTab === 'about') return <AboutPanel />;
    if (activeTab === 'compare' && teams.length > 0) return <TeamCompare teams={teams} />;

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
      case 'uniforms':
        return <UniformEditor {...props} onUniformChange={handleUniformChange} />;
      case 'hairskin':
        return <HairSkinEditor {...props} onHairSkinChange={handleHairSkinChange} />;
      case 'flagcolors':
        return <FlagColorEditor {...props} onFlagColorChange={handleFlagColorChange} />;
      case 'flagdesign':
        return <FlagDesignEditor {...props} onFlagDesignChange={handleFlagDesignChange} />;
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
          teams={teams}
          selectedTeamIndex={selectedTeamIndex}
          onSelectTeam={selectTeam}
          onOpenTab={openTab}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          romLoaded={!!romParser}
        />
        <div className="main-content">
          {openTabs.length > 0 && (
            <TabBar
              tabs={openTabs}
              activeTab={activeTab}
              onSelectTab={setActiveTab}
              onCloseTab={closeTab}
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
    </div>
  );
}
