import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useI18n } from '../i18n';
import { isElectron } from '../utils/fileHelpers';
import { IconOpen } from './Icons';

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
      // File not found, refresh the list
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
      // Check file type from DataTransferItem when possible
      const name = item.type || '';
      const hasValidType =
        name === '' || // type not available during dragenter in some browsers
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

  return (
    <div
      className="welcome-panel"
      onDrop={handleDropZone}
      onDragOver={handleDragOverZone}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      <div className="welcome-content">
        <h1 className="welcome-title">
          {t('welcomeTitle')} <span className="beta-badge">BETA</span>
        </h1>
        <p className="welcome-subtitle">{t('welcomeSubtitle')}</p>

        <div className="welcome-beta-notice">
          <span className="beta-notice-icon">⚠</span>
          <span>{t('welcomeBetaNotice')}</span>
        </div>

        <div className="welcome-actions">
          <button className="welcome-btn" onClick={onOpenRom}>
            <IconOpen size={20} />
            {t('welcomeOpenBtn')}
          </button>
        </div>

        <div className={dropZoneClasses}>
          <div className="welcome-drop-zone-icon">📁</div>
          <p className="welcome-drop-zone-text">
            {dragActive && !dragInvalid && t('welcomeDropRelease')}
            {dragInvalid && t('welcomeDropInvalid')}
            {!dragActive && t('welcomeDrop')}
          </p>
          <p className="welcome-drop-zone-hint">{t('welcomeDropHint')}</p>
        </div>

        {isElectron() && (
          <div className="welcome-recent">
            <div className="welcome-recent-header">
              <h3>{t('recentRoms')}</h3>
              {recentRoms.length > 0 && (
                <button className="welcome-recent-clear" onClick={handleClearRecents}>
                  {t('recentRomsClear')}
                </button>
              )}
            </div>

            {recentRoms.length === 0 ? (
              <p className="welcome-recent-empty">{t('recentRomsEmpty')}</p>
            ) : (
              <ul className="welcome-recent-list">
                {recentRoms.map((rom) => (
                  <li
                    key={rom.path}
                    className="welcome-recent-item"
                    onClick={() => handleOpenRecent(rom.path)}
                  >
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
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

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

        <div className="welcome-credits">
          <p>
            Based on the work of Rodrigo M. Guerra (ISS Studio), Esteban Fuentealba (Web ISS
            Studio), Equipe Puma & Equipe Falcon Brasil.
          </p>
        </div>
      </div>
    </div>
  );
}
