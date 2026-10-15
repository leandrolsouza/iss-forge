import React from 'react';
import { useI18n } from '../i18n';
import { isElectron } from '../utils/fileHelpers';

/**
 * `message`: an i18n key (or plain text such as a file path), or `{ key, params }` so
 * the text follows a language change (a param may itself be `{ key, params }`).
 */
export default function StatusBar({
  message,
  modified,
  teamCount,
  selectedTeam,
  // updater
  updateState,
  onCheckForUpdates,
  onShowNotification,
}) {
  const { t } = useI18n();
  const tr = (m) => {
    if (!m) return '';
    if (typeof m !== 'object') return t(String(m));
    const params = Object.fromEntries(
      Object.entries(m.params || {}).map(([k, v]) => [k, v && typeof v === 'object' ? tr(v) : v]),
    );
    return t(m.key, params);
  };
  const text = tr(message);

  // Build the compact update chip for the right side of the bar
  const getUpdateChip = () => {
    const status = updateState?.status;

    if (!status) {
      return {
        label: t('statusCheckUpdates'),
        cls: 'status-update status-update--idle',
        onClick: onCheckForUpdates,
        title: t('statusCheckUpdates'),
      };
    }

    switch (status) {
      case 'checking':
        return {
          label: t('updateChecking'),
          cls: 'status-update status-update--checking',
          onClick: null,
          title: t('updateChecking'),
        };
      case 'not-available':
        return {
          label: `✓ ${t('statusUpToDate')}`,
          cls: 'status-update status-update--ok',
          onClick: null,
          title: t('updateNotAvailable'),
        };
      case 'available':
        return {
          label: `↓ v${updateState.version}`,
          cls: 'status-update status-update--available',
          onClick: onShowNotification,
          title: t('updateAvailable').replace('{version}', updateState.version),
        };
      case 'downloading':
        return {
          label: `↓ ${Math.round(updateState.percent || 0)}%`,
          cls: 'status-update status-update--downloading',
          onClick: null,
          title: t('updateDownloading'),
        };
      case 'downloaded':
        return {
          label: `↑ ${t('statusUpdateInstall')}`,
          cls: 'status-update status-update--downloaded',
          onClick: onShowNotification,
          title: t('updateInstallRestart'),
        };
      case 'error':
        return {
          label: `⚠ ${t('error')}`,
          cls: 'status-update status-update--error',
          onClick: onCheckForUpdates,
          title: t('updateError'),
        };
      default:
        return null;
    }
  };

  const chip = isElectron() ? getUpdateChip() : null;

  return (
    <div className="status-bar">
      <div className="status-bar-left">
        {modified && <span className="status-modified">&#9679; {t('modified')}</span>}
        <span className="status-message">{text}</span>
      </div>
      <div className="status-bar-right">
        {selectedTeam && (
          <span className="status-item">
            {t('team')}: {selectedTeam}
          </span>
        )}
        {teamCount > 0 && (
          <span className="status-item">
            {t('teams')}: {teamCount}
          </span>
        )}
        <span className="status-item">ISS Forge v{__APP_VERSION__}</span>
        {chip &&
          (chip.onClick ? (
            <button
              className={chip.cls}
              onClick={chip.onClick}
              title={chip.title}
              aria-label={chip.title}
            >
              {chip.label}
            </button>
          ) : (
            <span className={chip.cls} title={chip.title}>
              {chip.label}
            </span>
          ))}
      </div>
    </div>
  );
}
