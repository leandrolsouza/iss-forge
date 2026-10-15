import React, { useState, useEffect, useRef } from 'react';
import { isElectron } from '../utils/fileHelpers';
import { useI18n } from '../i18n';

export default function UpdateNotification() {
  const { t } = useI18n();
  const [updateState, setUpdateState] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  // menuTriggered gates the low-noise states (checking / not-available)
  // so they only appear when the user explicitly clicked "Check for Updates"
  const [menuTriggered, setMenuTriggered] = useState(false);
  const autoHideRef = useRef(null);

  useEffect(() => {
    if (!isElectron()) return;

    const cleanupStatus = window.electronAPI.onUpdaterStatus((data) => {
      clearTimeout(autoHideRef.current);

      setUpdateState(data);

      // Always re-show for actionable transitions
      if (data.status === 'available' || data.status === 'downloaded') {
        setDismissed(false);
        setMenuTriggered(false);
      }

      // Auto-dismiss "up to date" after 3 s
      if (data.status === 'not-available') {
        autoHideRef.current = setTimeout(() => {
          setDismissed(true);
          setMenuTriggered(false);
        }, 3000);
      }
    });

    const cleanupMenu = window.electronAPI.onMenuCheckForUpdates?.(() => {
      setMenuTriggered(true);
      setDismissed(false);
    });

    return () => {
      cleanupStatus?.();
      cleanupMenu?.();
      clearTimeout(autoHideRef.current);
    };
  }, []);

  if (!updateState || dismissed) return null;

  const { status } = updateState;

  // checking / not-available only show on explicit user action
  if ((status === 'checking' || status === 'not-available') && !menuTriggered) {
    return null;
  }

  // Only render known, user-visible states
  const VISIBLE = ['checking', 'not-available', 'available', 'downloading', 'downloaded', 'error'];
  if (!VISIBLE.includes(status)) return null;

  const handleDownload = () => window.electronAPI.updaterDownload();
  const handleInstall = () => window.electronAPI.updaterInstall();
  const handleDismiss = () => {
    setDismissed(true);
    setMenuTriggered(false);
  };

  return (
    <div
      className={`update-notification${status === 'error' ? ' update-notification--error' : ''}`}
      role="alert"
      aria-live="polite"
    >
      <div className="update-notification-content">
        {status === 'checking' && (
          <span className="update-notification-text">{t('updateChecking')}</span>
        )}

        {status === 'not-available' && (
          <span className="update-notification-text">{t('updateNotAvailable')}</span>
        )}

        {status === 'available' && (
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

        {status === 'downloading' && (
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

        {status === 'downloaded' && (
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

        {status === 'error' && (
          <>
            <span className="update-notification-text">{t('updateError')}</span>
            <button className="update-notification-btn" onClick={handleDismiss}>
              {t('updateDismiss')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
