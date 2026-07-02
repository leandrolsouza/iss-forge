import React, { useState, useEffect, useCallback } from 'react';
import { useI18n } from '../i18n';
import { isElectron } from '../utils/fileHelpers';
import { IconOpen } from './Icons';

export default function WelcomePanel({ onOpenRom, onDrop, onDragOver }) {
  const { t } = useI18n();
  const [recentRoms, setRecentRoms] = useState([]);

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

  return (
    <div className="welcome-panel" onDrop={onDrop} onDragOver={onDragOver}>
      <div className="welcome-content">
        <h1 className="welcome-title">{t('welcomeTitle')}</h1>
        <p className="welcome-subtitle">{t('welcomeSubtitle')}</p>

        <div className="welcome-actions">
          <button className="welcome-btn" onClick={onOpenRom}>
            <IconOpen size={20} />
            {t('welcomeOpenBtn')}
          </button>
        </div>

        <div className="welcome-drop-zone">
          <p>{t('welcomeDrop')}</p>
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
                  <li key={rom.path} className="welcome-recent-item" onClick={() => handleOpenRecent(rom.path)}>
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
            Based on the work of Rodrigo M. Guerra (ISS Studio),
            Esteban Fuentealba (Web ISS Studio), Equipe Puma & Equipe Falcon Brasil.
          </p>
        </div>
      </div>
    </div>
  );
}
