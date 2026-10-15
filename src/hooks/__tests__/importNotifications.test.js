import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal()),
  useCallback: (fn) => fn,
}));
vi.mock('../../utils/teamExport', async (importOriginal) => ({
  ...(await importOriginal()),
  readJsonFile: vi.fn(),
}));

import renderRomHandlers from '../useRomHandlers';
import { readJsonFile } from '../../utils/teamExport';

beforeEach(() => vi.clearAllMocks());

function fixture() {
  const toast = { success: vi.fn(), error: vi.fn() };
  const pushSnapshot = vi.fn();
  const markModified = vi.fn();
  const setStatusMessage = vi.fn();
  const handlers = renderRomHandlers({
    romParser: {},
    teams: [],
    toast,
    t: (key) => key,
    pushSnapshot,
    markModified,
    setStatusMessage,
  });
  return { handlers, toast, pushSnapshot, markModified, setStatusMessage };
}

describe.each(['handleImportTeam', 'handleImportTexts'])('%s notifications', (handler) => {
  it.each(['importJsonInvalid', 'importFileReadFailed'])(
    'notifies %s without modifying the ROM or its history',
    async (error) => {
      readJsonFile.mockRejectedValue(new Error(error));
      const { handlers, toast, pushSnapshot, markModified, setStatusMessage } = fixture();
      await handlers[handler](0);
      expect(toast.error).toHaveBeenCalledExactlyOnceWith('toastImportFailed', { detail: error });
      expect(setStatusMessage).toHaveBeenCalledWith({
        key: 'statusImportError',
        params: { error: { key: error } },
      });
      expect(pushSnapshot).not.toHaveBeenCalled();
      expect(markModified).not.toHaveBeenCalled();
    },
  );

  it('keeps cancellation silent and leaves history untouched', async () => {
    readJsonFile.mockResolvedValue(null);
    const { handlers, toast, pushSnapshot, markModified } = fixture();
    await handlers[handler](0);
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(pushSnapshot).not.toHaveBeenCalled();
    expect(markModified).not.toHaveBeenCalled();
  });

  it('validates false JSON contents instead of treating them as cancellation', async () => {
    readJsonFile.mockResolvedValue(false);
    const { handlers, toast, pushSnapshot, markModified } = fixture();
    const result = await handlers[handler](0);
    if (handler === 'handleImportTexts') {
      expect(result.ok).toBe(false);
      expect(result.errors).not.toHaveLength(0);
    } else {
      expect(toast.error).toHaveBeenCalledOnce();
    }
    expect(pushSnapshot).not.toHaveBeenCalled();
    expect(markModified).not.toHaveBeenCalled();
  });
});
