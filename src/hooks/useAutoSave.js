/**
 * useAutoSave — periodically saves ROM state to a backup file
 *
 * Saves every INTERVAL ms when:
 * - A ROM is loaded (romParser exists)
 * - The ROM has been modified since last save
 *
 * A loose ROM file uses the single global backup (offered by BackupBanner on startup);
 * a project keeps its own auto-save inside its folder (offered when the project is opened).
 * Clears the backup when the user explicitly saves the ROM.
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import { isElectron } from '../utils/fileHelpers';
import * as electronBridge from '../services/electronBridge';

const AUTO_SAVE_INTERVAL = 60_000; // 1 minute

export default function useAutoSave({
  romParser,
  romInfo,
  modified,
  teams,
  currentProject,
  onError,
}) {
  const [lastSaved, setLastSaved] = useState(0);
  const latest = useRef(null);
  latest.current = { romParser, romInfo, modified, teams, currentProject, onError };
  const inFlight = useRef(null);
  const clearing = useRef(false);
  const errorReported = useRef(false);
  // Parser whose unedited ROM is already in the backup folder (sent once per session)
  const originalSentForRef = useRef(null);
  const projectId = currentProject?.id || null;

  const performBackup = useCallback(async () => {
    const { romParser, romInfo, modified, teams, currentProject } = latest.current;
    const projectId = currentProject?.id || null;
    if (!romParser || !modified || !isElectron() || clearing.current) return;
    if (inFlight.current) return inFlight.current;

    const pending = (async () => {
      try {
        // Every edit is written to the buffer right away, so it is the full state
        if (projectId) {
          // the project folder already holds the unedited ROM
          const result = await electronBridge.projectAutosaveSave(
            projectId,
            romParser.getRomData(),
          );
          if (!result.success) throw new Error(result.error || 'backupFailed');
          if (
            latest.current.romParser === romParser &&
            latest.current.currentProject?.id === projectId
          ) {
            setLastSaved(result.timestamp);
          }
          errorReported.current = false;
          return;
        }
        const data = romParser.getRomData();
        const sendOriginal = originalSentForRef.current !== romParser;
        const meta = {
          fileName: romInfo?.fileName || 'unknown.smc',
          timestamp: Date.now(),
          teamCount: teams?.length || 0,
          hasOriginal: true,
        };
        const result = await electronBridge.backupSave(
          data,
          meta,
          sendOriginal ? romParser.getOriginalData() : undefined,
        );
        if (!result.success) throw new Error(result.error || 'backupFailed');
        if (latest.current.romParser === romParser) {
          setLastSaved(result.timestamp);
          originalSentForRef.current = romParser;
        }
        errorReported.current = false;
      } catch (err) {
        if (!errorReported.current) latest.current.onError?.(err);
        errorReported.current = true;
      }
    })();
    inFlight.current = pending;
    try {
      await pending;
    } finally {
      inFlight.current = null;
    }
  }, []);

  // Start/stop interval based on ROM state
  useEffect(() => {
    errorReported.current = false;
    setLastSaved(0);
    if (!isElectron() || !romParser) return;
    const interval = setInterval(() => {
      performBackup();
    }, AUTO_SAVE_INTERVAL);

    return () => {
      clearInterval(interval);
    };
  }, [romParser, projectId, performBackup]);

  // Clear backup when ROM is saved explicitly
  const clearBackup = useCallback(async () => {
    if (!isElectron()) return;
    // the unedited ROM is deleted too: send it again with the next backup
    clearing.current = true;
    try {
      await inFlight.current;
      const result = await electronBridge.backupClear();
      if (!result.success) throw new Error(result.error || 'backupFailed');
    } catch (err) {
      latest.current.onError?.(err);
    } finally {
      originalSentForRef.current = null;
      clearing.current = false;
    }
  }, []);

  /** Drop the auto-save of a project (its edits were saved or discarded) */
  const clearProjectAutosave = useCallback(async (id) => {
    if (!isElectron() || !id) return;
    clearing.current = true;
    try {
      await inFlight.current;
      await electronBridge.projectAutosaveClear(id);
    } catch (_err) {
      // Silently fail (the project may have been deleted)
    } finally {
      clearing.current = false;
    }
  }, []);

  // Check for existing backup on startup
  const checkBackup = useCallback(async () => {
    if (!isElectron()) return null;
    try {
      const result = await electronBridge.backupLoad();
      if (result.error) throw new Error(result.error);
      if (result.exists) {
        return result;
      }
    } catch (err) {
      latest.current.onError?.(err);
    }
    return null;
  }, []);

  return {
    performBackup,
    clearBackup,
    clearProjectAutosave,
    checkBackup,
    lastSaved,
  };
}
