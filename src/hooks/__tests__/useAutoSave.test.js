import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

// Minimal hook host: retain refs/callbacks and run effect cleanup on dependency
// changes. The actual hook and timers run unchanged, without needing a DOM.
const host = vi.hoisted(() => {
  let cursor = 0;
  const slots = [];
  const same = (a, b) => a?.length === b?.length && a.every((v, i) => Object.is(v, b[i]));
  return {
    begin: () => {
      cursor = 0;
    },
    reset: () => {
      slots.forEach((s) => s?.cleanup?.());
      slots.length = 0;
      cursor = 0;
    },
    useRef: (value) => (slots[cursor++] ??= { current: value }),
    useState(value) {
      const i = cursor++;
      slots[i] ??= { value };
      return [
        slots[i].value,
        (next) => {
          slots[i].value = next;
        },
      ];
    },
    useCallback(fn, deps) {
      const i = cursor++;
      if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { fn, deps };
      return slots[i].fn;
    },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!slots[i] || !same(slots[i].deps, deps)) {
        slots[i]?.cleanup?.();
        slots[i] = { deps, cleanup: fn() };
      }
    },
  };
});
vi.mock('react', () => host);
vi.mock('../../utils/fileHelpers', () => ({ isElectron: () => true }));
vi.mock('../../services/electronBridge', () => ({
  projectAutosaveSave: vi.fn(),
  backupSave: vi.fn(),
  backupClear: vi.fn(),
  projectAutosaveClear: vi.fn(),
}));
import renderAutoSave from '../useAutoSave';
import * as bridge from '../../services/electronBridge';

let state;
const render = () => {
  host.begin();
  return renderAutoSave(state);
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  state = {
    romParser: {
      getRomData: () => new Uint8Array([2]),
      getOriginalData: () => new Uint8Array([1]),
    },
    romInfo: { fileName: 'test.sfc' },
    teams: [],
    modified: true,
    currentProject: null,
    onError: vi.fn(),
  };
  bridge.backupSave.mockResolvedValue({ success: true, timestamp: 123 });
  bridge.projectAutosaveSave.mockResolvedValue({ success: true, timestamp: 123 });
  bridge.backupClear.mockResolvedValue({ success: true });
});
afterEach(() => {
  host.reset();
  vi.useRealTimers();
});

describe('automatic backups', () => {
  it('backs up every minute while the user continuously edits teams', async () => {
    render();
    for (let i = 0; i < 18; i++) {
      await vi.advanceTimersByTimeAsync(10000);
      state = { ...state, teams: [{ edit: i }] };
      render();
    }
    expect(bridge.backupSave).toHaveBeenCalledTimes(3);
    expect(bridge.backupSave.mock.calls[0][2]).toEqual(new Uint8Array([1]));
    expect(bridge.backupSave.mock.calls[1][2]).toBeUndefined();
    expect(render().lastSaved).toBe(123);
  });

  it('uses the latest dirty state without resetting the timer', async () => {
    state.modified = false;
    render();
    await vi.advanceTimersByTimeAsync(30000);
    state = { ...state, modified: true };
    render();
    await vi.advanceTimersByTimeAsync(30000);
    expect(bridge.backupSave).toHaveBeenCalledOnce();
    state = { ...state, modified: false };
    render();
    await vi.advanceTimersByTimeAsync(60000);
    expect(bridge.backupSave).toHaveBeenCalledOnce();
  });

  it('uses the correct project after switching sessions', async () => {
    render();
    state = { ...state, currentProject: { id: 'project-b' } };
    render();
    await vi.advanceTimersByTimeAsync(60000);
    expect(bridge.projectAutosaveSave).toHaveBeenCalledWith('project-b', new Uint8Array([2]));
    expect(bridge.backupSave).not.toHaveBeenCalled();
  });

  it('reports a failed backup once, retries and reports a new failure after recovery', async () => {
    bridge.backupSave.mockResolvedValue({ success: false, error: 'disk full' });
    render();
    await vi.advanceTimersByTimeAsync(120000);
    expect(state.onError).toHaveBeenCalledOnce();
    bridge.backupSave.mockResolvedValue({ success: true, timestamp: 123 });
    await vi.advanceTimersByTimeAsync(60000);
    bridge.backupSave.mockResolvedValue({ success: false, error: 'disk full' });
    await vi.advanceTimersByTimeAsync(60000);
    expect(state.onError).toHaveBeenCalledTimes(2);
  });

  it('waits for a pending backup before clearing it and sends the original again', async () => {
    let finish;
    bridge.backupSave.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const api = render();
    const pending = api.performBackup();
    const clearing = api.clearBackup();
    expect(bridge.backupClear).not.toHaveBeenCalled();
    finish({ success: true, timestamp: 123 });
    await Promise.all([pending, clearing]);
    expect(bridge.backupClear).toHaveBeenCalledOnce();
    await api.performBackup();
    expect(bridge.backupSave.mock.calls[1][2]).toEqual(new Uint8Array([1]));
  });
});
