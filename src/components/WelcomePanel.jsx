import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useI18n } from '../i18n';
import { isElectron } from '../utils/fileHelpers';
import { IconOpen, IconCartridge, IconUpload } from './Icons';

const VALID_ROM_EXTENSIONS = ['.smc', '.sfc', '.bin'];

function isValidRomFile(file) {
  if (!file) return false;
  const name = file.name.toLowerCase();
  return VALID_ROM_EXTENSIONS.some((ext) => name.endsWith(ext));
}

export default function WelcomePanel({ onOpenRom, onDrop, onDragOver }) {
  const { t } = useI18n();
  const [recentRoms, setRecentRoms] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [dragInvalid, setDragInvalid] = useState(false);
  const dragCounter = useRef(0);

  const loadRecents = useCallback(async () => {
    if (isElectron() && window.electronAPI.getRecentRoms) {
      const recents = await window.electronAPI.getRecentRoms();
      setRecentRoms(recents || []);
    }
  }, []);

  useEffect(() => {
    loadRecents();
  }, [loadRecents]);

  const handleOpenRecent = async (filePath) => {
    if (!isElectron()) return;
    const result = await window.electronAPI.openRecentRom(filePath);
    if (!result.success) {
      loadRecents();
    }
  };

  const handleRemoveRecent = async (e, filePath) => {
    e.stopPropagation();
    if (!isElectron()) return;
    await window.electronAPI.removeRecentRom(filePath);
    loadRecents();
  };

  const handleClearRecents = async () => {
    if (!isElectron()) return;
    await window.electronAPI.clearRecentRoms();
    setRecentRoms([]);
  };

  // --- Drag & Drop visual feedback ---

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;

    if (e.dataTransfer?.items?.length) {
      const item = e.dataTransfer.items[0];
      const name = item.type || '';
      const hasValidType =
        name === '' ||
        VALID_ROM_EXTENSIONS.some((ext) => name.includes(ext.slice(1)));
      setDragActive(true);
      setDragInvalid(!hasValidType && name !== '');
    }
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setDragActive(false);
      setDragInvalid(false);
    }
  }, []);

  const handleDropZone = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setDragActive(false);
      setDragInvalid(false);

      const file = e.dataTransfer?.files[0];
      if (file && isValidRomFile(file)) {
        onDrop(e);
      }
    },
    [onDrop],
  );

  const handleDragOverZone = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (onDragOver) onDragOver(e);
    },
    [onDragOver],
  );

  const dropZoneClasses = [
    'welcome-drop-zone',
    dragActive && !dragInvalid && 'welcome-drop-zone--active',
    dragInvalid && 'welcome-drop-zone--invalid',
  ]
    .filter(Boolean)
    .join(' ');

  const hasRecents = recentRoms.length > 0;

  return (
    <div
      className="welcome-panel"
      onDrop={handleDropZone}
      onDragOver={handleDragOverZone}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      <div className="welcome-content welcome-fade-in">
        {/* Hero Section */}
        <div className="welcome-hero">
          <div className="welcome-logo">
            <img src="/logo.png" alt="ISS Forge" className="welcome-logo-img" />
          </div>
          <h1 className="welcome-title">
            <span className="welcome-title-main">{t('welcomeTitle')}</span>
            <span className="beta-badge">BETA</span>
          </h1>
          <p className="welcome-subtitle">{t('welcomeSubtitle')}</p>
        </div>

        {/* Primary Action */}
        <div className="welcome-actions">
          <button className="welcome-btn" onClick={onOpenRom}>
            <IconOpen size={20} />
            {t('welcomeOpenBtn')}
          </button>
        </div>

        {/* Drop Zone */}
        <div className={dropZoneClasses}>
          <IconUpload size={24} />
          <p className="welcome-drop-zone-text">
            {dragActive && !dragInvalid && t('welcomeDropRelease')}
            {dragInvalid && t('welcomeDropInvalid')}
            {!dragActive && t('welcomeDrop')}
          </p>
          <p className="welcome-drop-zone-hint">{t('welcomeDropHint')}</p>
        </div>

        {/* Two-column bottom section */}
        <div className="welcome-grid">
          {/* Recent ROMs */}
          {isElectron() && (
            <div className="welcome-recent">
              <div className="welcome-recent-header">
                <h3>{t('recentRoms')}</h3>
                {hasRecents && (
                  <button className="welcome-recent-clear" onClick={handleClearRecents}>
                    {t('recentRomsClear')}
                  </button>
                )}
              </div>

              {!hasRecents ? (
                <p className="welcome-recent-empty">{t('recentRomsEmpty')}</p>
              ) : (
                <ul className="welcome-recent-list">
                  {recentRoms.map((rom) => (
                    <li
                      key={rom.path}
                      className="welcome-recent-item"
                      onClick={() => handleOpenRecent(rom.path)}
                    >
                      <IconCartridge size={16} />
                      <div className="welcome-recent-item-info">
                        <span className="welcome-recent-item-name">{rom.name}</span>
                        <span className="welcome-recent-item-path">{rom.path}</span>
                      </div>
                      <button
                        className="welcome-recent-item-remove"
                        onClick={(e) => handleRemoveRecent(e, rom.path)}
                        title={t('recentRomsRemove')}
                        aria-label={t('recentRomsRemove')}
                      >
                        &times;
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Features */}
          <div className="welcome-info">
            <h3>{t('welcomeFeatures')}</h3>
            <ul>
              <li>{t('welcomePlayerNames')}</li>
              <li>{t('welcomeShirtNumbers')}</li>
              <li>{t('welcomeAttributes')}</li>
              <li>{t('welcomeHairStyle')}</li>
              <li>{t('welcomeUniformColors')}</li>
            </ul>

            <h3>{t('welcomeCompatible')}</h3>
            <p>{t('welcomeCompatibleDesc')}</p>
          </div>
        </div>

      </div>
    </div>
  );
}
