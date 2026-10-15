import { describe, it, expect } from 'vitest';
import { createHistoryStack } from '../useHistory';

describe('history stack', () => {
  it('undo/redo restore snapshots in order', () => {
    const h = createHistoryStack();
    h.push({ v: 1 });
    h.push({ v: 2 });
    expect(h.undo({ v: 3 })).toEqual({ v: 2 });
    expect(h.undo({ v: 2 })).toEqual({ v: 1 });
    expect(h.undo({ v: 1 })).toBeNull();
    expect(h.redo({ v: 1 })).toEqual({ v: 2 });
    expect(h.redo({ v: 2 })).toEqual({ v: 3 });
    expect(h.canRedo).toBe(false);
  });

  it('copies snapshots (later mutations do not leak in)', () => {
    const h = createHistoryStack();
    const state = { list: [1] };
    h.push(state);
    state.list.push(2);
    expect(h.undo(state)).toEqual({ list: [1] });
  });

  it('keeps at most `max` steps', () => {
    const h = createHistoryStack({ max: 3 });
    for (let i = 0; i < 5; i++) h.push({ i });
    const got = [];
    let s;
    while ((s = h.undo({}))) got.push(s.i);
    expect(got).toEqual([4, 3, 2]);
  });

  describe('saved point (modified flag)', () => {
    it('does not mark edits made during a save as persisted', () => {
      const h = createHistoryStack();
      h.push({ v: 0 });
      const point = h.captureSavePoint();
      h.push({ v: 1 });
      expect(h.markSaved(point)).toBe(false);
      expect(h.modified).toBe(true);
      h.undo({ v: 2 });
      expect(h.modified).toBe(false);
    });

    it('ignores a save response from a previously opened session', () => {
      const h = createHistoryStack();
      const point = h.captureSavePoint();
      h.reset({ saved: false });
      expect(h.markSaved(point)).toBe(false);
      expect(h.modified).toBe(true);
    });

    it('tracks unsnapshotted edits made while an already modified revision is saving', () => {
      const h = createHistoryStack();
      h.touch();
      const point = h.captureSavePoint();
      h.touch();
      expect(h.markSaved(point)).toBe(false);
      expect(h.modified).toBe(true);
    });
    it('undoing back to the saved state clears modified, redo sets it again', () => {
      const h = createHistoryStack();
      h.reset();
      expect(h.modified).toBe(false);
      h.push({ v: 0 });
      expect(h.modified).toBe(true);
      h.undo({ v: 1 });
      expect(h.modified).toBe(false);
      h.redo({ v: 0 });
      expect(h.modified).toBe(true);
    });

    it('follows a save in the middle of the history', () => {
      const h = createHistoryStack();
      h.reset();
      h.push({ v: 0 });
      h.push({ v: 1 });
      h.markSaved(); // state 2 on disk
      h.undo({ v: 2 });
      expect(h.modified).toBe(true); // state 1 differs from the file
      h.redo({ v: 1 });
      expect(h.modified).toBe(false);
      h.undo({ v: 2 });
      h.undo({ v: 1 });
      expect(h.modified).toBe(true); // the loaded state is not the saved one anymore
    });

    it('a restored backup is modified until saved, even after undoing everything', () => {
      const h = createHistoryStack();
      h.reset({ saved: false });
      expect(h.modified).toBe(true);
      h.push({ v: 0 });
      h.undo({ v: 1 });
      expect(h.modified).toBe(true);
      h.markSaved();
      expect(h.modified).toBe(false);
    });

    it('touch marks an edit made without a snapshot', () => {
      const h = createHistoryStack();
      h.reset();
      h.touch();
      expect(h.modified).toBe(true);
    });
  });

  describe('cancelLast (rejected edits leave no step)', () => {
    it('drops the last push and restores the modified flag', () => {
      const h = createHistoryStack();
      h.reset();
      h.push({ v: 0 });
      expect(h.cancelLast()).toEqual({ v: 0 });
      expect(h.canUndo).toBe(false);
      expect(h.modified).toBe(false);
    });

    it('brings back the redo stack the push cleared', () => {
      const h = createHistoryStack();
      h.reset();
      h.push({ v: 0 });
      h.undo({ v: 1 });
      expect(h.canRedo).toBe(true);
      h.push({ v: 0 }); // a new edit clears redo...
      expect(h.canRedo).toBe(false);
      h.cancelLast(); // ...but it was rejected
      expect(h.canRedo).toBe(true);
      expect(h.redo({ v: 0 })).toEqual({ v: 1 });
    });

    it('only cancels a push that was just made', () => {
      const h = createHistoryStack();
      h.push({ v: 0 });
      h.undo({ v: 1 });
      expect(h.cancelLast()).toBeNull();
      expect(h.canRedo).toBe(true);
    });
  });
});
