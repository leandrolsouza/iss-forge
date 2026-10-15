import React from 'react';
import { useI18n } from '../i18n';

/**
 * Floating toast for auto-updater states.
 * All state and callbacks come from the useUpdater hook (via App).
 */
export default function UpdateNotification({
  updateState,
  dismissed,
  menuTriggered,
  onDownload,
  onInstall,
  onDismiss,
}) {
  const { t } = useI18n();

  if (!updateState || dismissed) return null;

  const { status } = updateState;

  // checking / not-available only show on explicit user action (menu or status bar button)
  if ((status === 'checking' || status === 'not-available') && !menuTriggered) {
    return null;
  }

  // Only render known, user-visible states
  const VISIBLE = [
    'checking',
    'not-available',
    'available',
    'downloading',
    'downloaded',
    'error',
    'dev-mode',
    'unsupported',
  ];
  if (!VISIBLE.includes(status)) return null;

  return (
    <div
      className={`update-notification${status === 'error' ? ' update-notification--error' : ''}`}
      role="alert"
      aria-live="polite"
    >
      <div className="update-notification-content">
        {['dev-mode', 'unsupported'].includes(status) && menuTriggered && (
          <>
            <span className="update-notification-text">
              {t(status === 'dev-mode' ? 'updateDevMode' : 'updateUnsupported')}
            </span>
            <button className="update-notification-btn" onClick={onDismiss}>
              {t('updateDismiss')}
            </button>
          </>
        )}
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
            <button className="update-notification-btn primary" onClick={onDownload}>
              {t(updateState.manualInstall ? 'updateDownloadManual' : 'updateDownload')}
            </button>
            <button className="update-notification-btn" onClick={onDismiss}>
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
            <button className="update-notification-btn primary" onClick={onInstall}>
              {t('updateInstallRestart')}
            </button>
            <button className="update-notification-btn" onClick={onDismiss}>
              {t('updateLater')}
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <span className="update-notification-text">
              {t('updateError')}
              {updateState.message ? ` — ${updateState.message}` : ''}
            </span>
            <button className="update-notification-btn" onClick={onDismiss}>
              {t('updateDismiss')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
