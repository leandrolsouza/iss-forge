/**
 * useHistory - Undo/Redo history stack for ROM state
 *
 * Stores snapshots of the teams array. Each mutation pushes
 * the current state onto the past stack before applying the change.
 * Max history depth prevents unbounded memory growth.
 */
import { useState, useCallback, useRef } from 'react';

const MAX_HISTORY = 50;

export default function useHistory() {
  const pastRef = useRef([]);
  const futureRef = useRef([]);
  const [revision, setRevision] = useState(0);

  /**
   * Push current teams snapshot onto the past stack.
   * Call this BEFORE applying a mutation.
   * @param {Array} teams - current teams array (will be deep-copied)
   */
  const pushSnapshot = useCallback((teams) => {
    const snapshot = structuredClone(teams);
    pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY - 1)), snapshot];
    futureRef.current = [];
    setRevision((r) => r + 1);
  }, []);

  /**
   * Undo: pop from past, push current onto future, return restored teams.
   * @param {Array} currentTeams - current teams state
   * @returns {Array|null} restored teams or null if nothing to undo
   */
  const undo = useCallback((currentTeams) => {
    if (pastRef.current.length === 0) return null;

    const previous = pastRef.current[pastRef.current.length - 1];
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [...futureRef.current, structuredClone(currentTeams)];
    setRevision((r) => r + 1);
    return previous;
  }, []);

  /**
   * Redo: pop from future, push current onto past, return restored teams.
   * @param {Array} currentTeams - current teams state
   * @returns {Array|null} restored teams or null if nothing to redo
   */
  const redo = useCallback((currentTeams) => {
    if (futureRef.current.length === 0) return null;

    const next = futureRef.current[futureRef.current.length - 1];
    futureRef.current = futureRef.current.slice(0, -1);
    pastRef.current = [...pastRef.current, structuredClone(currentTeams)];
    setRevision((r) => r + 1);
    return next;
  }, []);

  /**
   * Clear all history (e.g. on ROM load)
   */
  const clearHistory = useCallback(() => {
    pastRef.current = [];
    futureRef.current = [];
    setRevision((r) => r + 1);
  }, []);

  const canUndo = pastRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;

  return {
    pushSnapshot,
    undo,
    redo,
    clearHistory,
    canUndo,
    canRedo,
    // revision is used to force re-renders when refs change
    _revision: revision,
  };
}
