import { useState, useEffect, useRef, useCallback } from 'react';
import { isElectron } from '../utils/fileHelpers';

/**
 * Centralizes auto-updater state and actions.
 * Used by both StatusBar (compact indicator) and UpdateNotification (toast).
 */
export function useUpdater() {
  const [updateState, setUpdateState] = useState(null);
  // dismissed hides the toast but NOT the status bar indicator
  const [dismissed, setDismissed] = useState(false);
  // menuTriggered makes low-noise states (checking / not-available) visible in the toast
  const [menuTriggered, setMenuTriggered] = useState(false);
  const autoHideRef = useRef(null);

  useEffect(() => {
    if (!isElectron()) return;

    const cleanupStatus = window.electronAPI.onUpdaterStatus((data) => {
      clearTimeout(autoHideRef.current);
      setUpdateState(data);

      // Always re-show the toast for actionable transitions
      if (data.status === 'available' || data.status === 'downloaded') {
        setDismissed(false);
        setMenuTriggered(false);
      }

      // Auto-clear after 3 s so the status bar returns to "Check for updates"
      if (data.status === 'not-available') {
        autoHideRef.current = setTimeout(() => {
          setUpdateState(null);
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

  /** Trigger an update check (e.g. from the status bar button) */
  const check = useCallback(() => {
    if (!isElectron()) return;
    setMenuTriggered(true);
    setDismissed(false);
    window.electronAPI.updaterCheck?.();
  }, []);

  const download = useCallback(() => {
    if (!isElectron()) return;
    window.electronAPI.updaterDownload?.();
  }, []);

  const install = useCallback(() => {
    if (!isElectron()) return;
    window.electronAPI.updaterInstall?.();
  }, []);

  /** Hides the toast (user clicked "Later" / "Dismiss") */
  const dismiss = useCallback(() => {
    setDismissed(true);
    setMenuTriggered(false);
  }, []);

  /** Re-shows the toast (e.g. clicked an actionable chip in the status bar) */
  const show = useCallback(() => {
    setDismissed(false);
  }, []);

  return { updateState, dismissed, menuTriggered, check, download, install, dismiss, show };
}
