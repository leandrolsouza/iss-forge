import React, { useState, useEffect } from 'react';
import { isElectron } from '../utils/fileHelpers';
import { useI18n } from '../i18n';

export default function UpdateNotification() {
  const { t } = useI18n();
  const [updateState, setUpdateState] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isElectron()) return;

    window.electronAPI.onUpdaterStatus((data) => {
      setUpdateState(data);
      // Show notification again when status changes meaningfully
      if (data.status === 'available' || data.status === 'downloaded') {
        setDismissed(false);
      }
    });

    return () => {
      window.electronAPI.removeAllListeners('updater:status');
    };
  }, []);

  if (!updateState || dismissed) return null;

  const handleDownload = () => {
    window.electronAPI.updaterDownload();
  };

  const handleInstall = () => {
    window.electronAPI.updaterInstall();
  };

  const handleDismiss = () => {
    setDismissed(true);
  };

  // Only show for actionable states
  if (
    updateState.status !== 'available' &&
    updateState.status !== 'downloading' &&
    updateState.status !== 'downloaded'
  ) {
    return null;
  }

  return (
    <div className="update-notification" role="alert" aria-live="polite">
      <div className="update-notification-content">
        {updateState.status === 'available' && (
          <>
            <span className="update-notification-text">
              {t('updateAvailable').replace('{version}', updateState.version)}
            </span>
            <button className="update-notification-btn primary" onClick={handleDownload}>
              {t('updateDownload')}
            </button>
            <button className="update-notification-btn" onClick={handleDismiss}>
              {t('updateDismiss')}
            </button>
          </>
        )}

        {updateState.status === 'downloading' && (
          <>
            <span className="update-notification-text">
              {t('updateDownloading')} {Math.round(updateState.percent || 0)}%
            </span>
            <div className="update-notification-progress">
              <div
                className="update-notification-progress-bar"
                style={{ width: `${updateState.percent || 0}%` }}
              />
            </div>
          </>
        )}

        {updateState.status === 'downloaded' && (
          <>
            <span className="update-notification-text">{t('updateReady')}</span>
            <button className="update-notification-btn primary" onClick={handleInstall}>
              {t('updateInstallRestart')}
            </button>
            <button className="update-notification-btn" onClick={handleDismiss}>
              {t('updateLater')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
