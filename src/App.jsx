import React, { useEffect } from 'react';
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
import { TEAMS } from './rom/constants';
import { isElectron } from './utils/fileHelpers';
import { IconOpen, IconSave } from './components/Icons';
import { useRom } from './context/RomContext';

export default function App() {
  const {
    romParser,
    romInfo,
    teams,
    selectedTeamIndex,
    activeTab,
    openTabs,
    modified,
    statusMessage,
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
  } = useRom();

  // IPC listeners and keyboard shortcuts
  useEffect(() => {
    if (isElectron()) {
      window.electronAPI.onRomLoaded((data) => loadRomData(new Uint8Array(data.data), data.name));
      window.electronAPI.onMenuSave(() => handleSave());
      window.electronAPI.onSaveAsPath((filePath) => handleSaveToPath(filePath));
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
    };

    if (!isElectron()) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [loadRomData, handleSave, handleSaveToPath, handleOpenRom]);

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
        </div>
        <span className="app-titlebar-title">
          ISS Forge <span className="beta-badge">BETA</span>{' '}
          {romInfo ? `- ${romInfo.fileName}${modified ? ' *' : ''}` : ''}
        </span>
        <div className="app-titlebar-spacer"></div>
      </div>

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
    </div>
  );
}
