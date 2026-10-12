/**
 * useHistory - Undo/Redo history stack for ROM state
 *
 * Each mutation pushes the current state onto the past stack before applying the
 * change. Max history depth prevents unbounded memory growth.
 *
 * The stack also tracks which state is the one saved on disk: every edit gives the
 * session a new state id, undo/redo bring the ids back, so `modified` is exact
 * (undoing back to the last save clears it, redoing past it sets it again).
 */
import { useState, useMemo } from 'react';

export const MAX_HISTORY = 50;

/** Plain (React-free) history stack; see useHistory */
export function createHistoryStack({ max = MAX_HISTORY } = {}) {
  let past = []; // { snapshot, id }
  let future = [];
  // Redo stack as it was before the last push, so cancelLast can bring it back
  let futureBeforePush = null;
  let nextId = 0;
  let id = 0;
  let savedId = 0;

  return {
    /** Store `snapshot` (deep-copied) as the state before an edit. Call BEFORE the edit. */
    push(snapshot) {
      past = [...past.slice(-(max - 1)), { snapshot: structuredClone(snapshot), id }];
      futureBeforePush = future;
      future = [];
      id = ++nextId;
    },
    /**
     * Drop the entry added by the last push (the edit it guarded was rejected or
     * changed nothing), restoring the redo stack it cleared.
     * @returns {object|null} the dropped snapshot
     */
    cancelLast() {
      if (!past.length || futureBeforePush === null) return null;
      const entry = past[past.length - 1];
      past = past.slice(0, -1);
      future = futureBeforePush;
      futureBeforePush = null;
      id = entry.id;
      return entry.snapshot;
    },
    /** @returns {object|null} the state to restore */
    undo(current) {
      if (!past.length) return null;
      const entry = past[past.length - 1];
      past = past.slice(0, -1);
      future = [...future, { snapshot: structuredClone(current), id }];
      futureBeforePush = null;
      id = entry.id;
      return entry.snapshot;
    },
    /** @returns {object|null} the state to restore */
    redo(current) {
      if (!future.length) return null;
      const entry = future[future.length - 1];
      future = future.slice(0, -1);
      past = [...past, { snapshot: structuredClone(current), id }];
      futureBeforePush = null;
      id = entry.id;
      return entry.snapshot;
    },
    /** New session: empty history. `saved` = false when it differs from every file (restored backup). */
    reset({ saved = true } = {}) {
      past = [];
      future = [];
      futureBeforePush = null;
      id = ++nextId;
      savedId = saved ? id : null;
    },
    /** The current state is now the one on disk */
    markSaved() {
      savedId = id;
    },
    /** An edit that did not push a snapshot: still a new state */
    touch() {
      if (id === savedId) id = ++nextId;
    },
    get modified() {
      return id !== savedId;
    },
    get canUndo() {
      return past.length > 0;
    },
    get canRedo() {
      return future.length > 0;
    },
  };
}

export default function useHistory() {
  const [stack] = useState(() => createHistoryStack());
  const [revision, setRevision] = useState(0);

  // Stable functions; each one re-renders so canUndo/canRedo are fresh
  const api = useMemo(() => {
    const wrap =
      (fn) =>
      (...args) => {
        const result = fn(...args);
        setRevision((r) => r + 1);
        return result;
      };
    return {
      pushSnapshot: wrap(stack.push),
      cancelLast: wrap(stack.cancelLast),
      undo: wrap(stack.undo),
      redo: wrap(stack.redo),
      /** Reset for a new session; `{ saved: false }` for a restored backup */
      clearHistory: wrap(stack.reset),
      markSaved: wrap(stack.markSaved),
      touch: wrap(stack.touch),
      isModified: () => stack.modified,
    };
  }, [stack]);

  return {
    ...api,
    canUndo: stack.canUndo,
    canRedo: stack.canRedo,
    // revision is used to force re-renders when the stack changes
    _revision: revision,
  };
}
