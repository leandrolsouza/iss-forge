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
import { useEffect, useRef, useCallback } from 'react';
import { isElectron } from '../utils/fileHelpers';
import * as electronBridge from '../services/electronBridge';

const AUTO_SAVE_INTERVAL = 60_000; // 1 minute

export default function useAutoSave({ romParser, romInfo, modified, teams, currentProject }) {
  const lastSavedRef = useRef(0);
  const intervalRef = useRef(null);
  // Parser whose unedited ROM is already in the backup folder (sent once per session)
  const originalSentForRef = useRef(null);
  const projectId = currentProject?.id || null;

  const performBackup = useCallback(async () => {
    if (!romParser || !modified || !isElectron()) return;

    try {
      // Every edit is written to the buffer right away, so it is the full state
      if (projectId) {
        // the project folder already holds the unedited ROM
        const result = await electronBridge.projectAutosaveSave(projectId, romParser.getRomData());
        if (result.success) lastSavedRef.current = result.timestamp;
        return;
      }
      const data = Array.from(romParser.getRomData());
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
        sendOriginal ? Array.from(romParser.getOriginalData()) : undefined,
      );
      if (result.success) {
        lastSavedRef.current = result.timestamp;
        originalSentForRef.current = romParser;
      }
    } catch (_err) {
      // Silently fail — backup is best-effort
    }
  }, [romParser, romInfo, modified, teams, projectId]);

  // Start/stop interval based on ROM state
  useEffect(() => {
    if (!isElectron() || !romParser) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      performBackup();
    }, AUTO_SAVE_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [romParser, performBackup]);

  // Clear backup when ROM is saved explicitly
  const clearBackup = useCallback(async () => {
    if (!isElectron()) return;
    // the unedited ROM is deleted too: send it again with the next backup
    originalSentForRef.current = null;
    try {
      await electronBridge.backupClear();
    } catch (_err) {
      // Silently fail
    }
  }, []);

  /** Drop the auto-save of a project (its edits were saved or discarded) */
  const clearProjectAutosave = useCallback(async (id) => {
    if (!isElectron() || !id) return;
    try {
      await electronBridge.projectAutosaveClear(id);
    } catch (_err) {
      // Silently fail (the project may have been deleted)
    }
  }, []);

  // Check for existing backup on startup
  const checkBackup = useCallback(async () => {
    if (!isElectron()) return null;
    try {
      const result = await electronBridge.backupLoad();
      if (result.exists) {
        return result;
      }
    } catch (_err) {
      // Silently fail
    }
    return null;
  }, []);

  return {
    performBackup,
    clearBackup,
    clearProjectAutosave,
    checkBackup,
    lastSaved: lastSavedRef.current,
  };
}
