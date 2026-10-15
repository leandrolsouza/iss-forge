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
  const receiveRef = useRef(null);
  const eventVersionRef = useRef(0);

  useEffect(() => {
    if (!isElectron()) return;

    let active = true;
    let receivedStatus = false;
    const receive = (data) => {
      if (!active || !data) return;
      clearTimeout(autoHideRef.current);
      setUpdateState(data);

      // Always re-show the toast for actionable transitions
      if (['available', 'downloaded', 'error'].includes(data.status)) {
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
    };
    receiveRef.current = receive;
    const cleanupStatus = window.electronAPI.onUpdaterStatus((data) => {
      receivedStatus = true;
      eventVersionRef.current += 1;
      receive(data);
    });
    // Subscribe first, then recover state after reload without overwriting newer events.
    window.electronAPI
      .updaterGetState?.()
      .then((data) => {
        if (!receivedStatus) receive(data);
      })
      .catch((error) => {
        if (!receivedStatus) receive({ status: 'error', message: error.message });
      });

    const cleanupMenu = window.electronAPI.onMenuCheckForUpdates?.(() => {
      setMenuTriggered(true);
      setDismissed(false);
    });

    return () => {
      active = false;
      receiveRef.current = null;
      cleanupStatus?.();
      cleanupMenu?.();
      clearTimeout(autoHideRef.current);
    };
  }, []);

  /** Trigger an update check (e.g. from the status bar button) */
  const invoke = useCallback(async (method) => {
    const eventVersion = eventVersionRef.current;
    try {
      const result = await window.electronAPI[method]?.();
      if (eventVersion === eventVersionRef.current) receiveRef.current?.(result);
    } catch (error) {
      if (eventVersion === eventVersionRef.current) {
        receiveRef.current?.({ status: 'error', message: error.message });
      }
    }
  }, []);

  const check = useCallback(() => {
    if (!isElectron()) return;
    setMenuTriggered(true);
    setDismissed(false);
    void invoke('updaterCheck');
  }, [invoke]);

  const download = useCallback(() => {
    if (!isElectron()) return;
    void invoke('updaterDownload');
  }, [invoke]);

  const install = useCallback(() => {
    if (!isElectron()) return;
    void invoke('updaterInstall');
  }, [invoke]);

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
