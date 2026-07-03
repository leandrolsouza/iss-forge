import React, { useState, useEffect, useCallback } from 'react';
import { useI18n } from '../i18n';
import { useRom } from '../context/RomContext';

/**
 * BackupBanner — shows a notification when an unsaved backup is found on startup.
 * Allows the user to restore or discard it.
 */
export default function BackupBanner() {
  const { t } = useI18n();
  const { checkBackup, clearBackup, loadRomData, romParser } = useRom();
  const [backup, setBackup] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Only check for backup when no ROM is loaded yet
    if (romParser) return;

    let cancelled = false;
    checkBackup().then((result) => {
      if (!cancelled && result) {
        setBackup(result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [checkBackup, romParser]);

  const handleRestore = useCallback(() => {
    if (!backup) return;
    const data = new Uint8Array(backup.data);
    const fileName = backup.meta?.fileName || 'backup.smc';
    loadRomData(data, fileName);
    clearBackup();
    setDismissed(true);
  }, [backup, loadRomData, clearBackup]);

  const handleDiscard = useCallback(() => {
    clearBackup();
    setDismissed(true);
  }, [clearBackup]);

  if (!backup || dismissed || romParser) return null;

  const date = backup.meta?.timestamp ? new Date(backup.meta.timestamp).toLocaleString() : '?';

  const message = t('backupFound').replace('{date}', date);

  return (
    <div className="backup-banner">
      <span className="backup-banner-message">{message}</span>
      <div className="backup-banner-actions">
        <button className="backup-banner-btn backup-banner-btn--restore" onClick={handleRestore}>
          {t('backupRestore')}
        </button>
        <button className="backup-banner-btn backup-banner-btn--discard" onClick={handleDiscard}>
          {t('backupDiscard')}
        </button>
      </div>
    </div>
  );
}
