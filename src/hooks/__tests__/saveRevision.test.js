import { beforeEach, describe, it, expect, vi } from 'vitest';
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal()),
  useCallback: (fn) => fn,
}));
vi.mock('../../utils/fileHelpers', () => ({ isElectron: () => true }));
vi.mock('../../services/electronBridge', () => ({
  projectSave: vi.fn(),
  saveRom: vi.fn(),
  getCurrentPath: vi.fn(),
  notifySaveComplete: vi.fn(),
}));
import renderRomHandlers from '../useRomHandlers';
import { createHistoryStack } from '../useHistory';
import * as bridge from '../../services/electronBridge';

beforeEach(() => vi.clearAllMocks());
function fixture(project = true) {
  const h = createHistoryStack();
  h.push({ version: 0 });
  const parser = { fixChecksum: vi.fn(), getRomData: () => new Uint8Array([2]) };
  let currentParser = parser;
  const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
  const setRomFile = vi.fn();
  const args = {
    romParser: parser,
    currentProject: project ? { id: 'test', name: 'Test' } : null,
    teams: [],
    toast,
    t: (key) => key,
    setStatusMessage: vi.fn(),
    setRomFile,
    captureSavePoint: () => ({ ...h.captureSavePoint(), parser: currentParser }),
    markSaved: (_path, point) => (point.parser === currentParser ? h.markSaved(point) : null),
  };
  return {
    h,
    toast,
    setRomFile,
    handlers: renderRomHandlers(args),
    replaceSession: () => {
      currentParser = {};
      h.reset();
    },
  };
}

describe('asynchronous save revisions', () => {
  it('keeps newer edits dirty and does not close the app after saving an older revision', async () => {
    let finish;
    bridge.projectSave.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { h, handlers, toast } = fixture();
    const saving = handlers.handleSave({ fromClose: true });
    h.push({ version: 1 });
    finish({ success: true, project: { name: 'Test' } });
    expect(await saving).toBe(false);
    expect(h.modified).toBe(true);
    expect(bridge.notifySaveComplete).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith('saveNewerEdits');
    h.undo({ version: 2 });
    expect(h.modified).toBe(false);
  });

  it('does not mark a newly opened session as saved when an old request completes', async () => {
    let finish;
    bridge.projectSave.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { handlers, replaceSession } = fixture();
    const saving = handlers.handleSave({ fromClose: true });
    replaceSession();
    finish({ success: true, project: { name: 'Old' } });
    expect(await saving).toBe(false);
    expect(bridge.notifySaveComplete).not.toHaveBeenCalled();
  });

  it('confirms closure only when the written revision is still current', async () => {
    bridge.projectSave.mockResolvedValue({ success: true, project: { name: 'Test' } });
    const { h, handlers } = fixture();
    expect(await handlers.handleSave({ fromClose: true })).toBe(true);
    expect(h.modified).toBe(false);
    expect(bridge.notifySaveComplete).toHaveBeenCalledWith(true);
  });

  it('keeps a Save As target when newer edits arrive, without treating them as saved', async () => {
    let finish;
    bridge.saveRom.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { h, handlers, setRomFile } = fixture(false);
    const saving = handlers.handleSaveToPath('new.sfc');
    h.push({ version: 1 });
    finish({ success: true, path: 'new.sfc' });
    await saving;
    expect(setRomFile).toHaveBeenCalledWith('new.sfc');
    expect(h.modified).toBe(true);
    expect(bridge.notifySaveComplete).not.toHaveBeenCalled();
  });
});
