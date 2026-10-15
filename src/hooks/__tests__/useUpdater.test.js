import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

const host = vi.hoisted(() => {
  let cursor = 0;
  const slots = [];
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
    useCallback: (fn) => fn,
    useEffect(fn) {
      const i = cursor++;
      slots[i] ??= { cleanup: fn() };
    },
  };
});
vi.mock('react', () => host);
vi.mock('../../utils/fileHelpers', () => ({ isElectron: () => true }));
import { useUpdater as renderUpdater } from '../useUpdater';
let status;
let api;
const render = () => {
  host.begin();
  return renderUpdater();
};
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};
beforeEach(() => {
  vi.useFakeTimers();
  api = {
    onUpdaterStatus: vi.fn((fn) => {
      status = fn;
      return vi.fn();
    }),
    onMenuCheckForUpdates: vi.fn(() => vi.fn()),
    updaterGetState: vi.fn().mockResolvedValue({ status: 'idle' }),
    updaterCheck: vi.fn().mockResolvedValue({ status: 'dev-mode' }),
    updaterDownload: vi.fn().mockResolvedValue({ status: 'downloading' }),
    updaterInstall: vi.fn().mockResolvedValue({ status: 'downloaded', version: '1.0.6' }),
  };
  vi.stubGlobal('window', { electronAPI: api });
});
afterEach(() => {
  host.reset();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('updater renderer synchronization', () => {
  it('restores downloaded state after a renderer reload', async () => {
    api.updaterGetState.mockResolvedValue({ status: 'downloaded', version: '1.0.6' });
    render();
    await flush();
    expect(render().updateState).toEqual({ status: 'downloaded', version: '1.0.6' });
  });

  it('does not replace a live event with a delayed initial snapshot', async () => {
    render();
    status({ status: 'available', version: '1.0.6' });
    await flush();
    expect(render().updateState.status).toBe('available');
  });

  it('handles IPC responses without events and exposes rejected downloads', async () => {
    render();
    await flush();
    render().check();
    await flush();
    expect(render().updateState.status).toBe('dev-mode');
    render().dismiss();
    api.updaterDownload.mockRejectedValue(new Error('IPC disconnected'));
    render().download();
    await flush();
    expect(render().updateState).toEqual({ status: 'error', message: 'IPC disconnected' });
    expect(render().dismissed).toBe(false);
  });

  it('does not overwrite newer progress with an old IPC response', async () => {
    render();
    await flush();
    render().check();
    status({ status: 'downloading', percent: 42 });
    await flush();
    expect(render().updateState).toEqual({ status: 'downloading', percent: 42 });
  });

  it('clears up-to-date feedback and cancels its timeout on actionable updates', async () => {
    render();
    await flush();
    status({ status: 'not-available' });
    vi.advanceTimersByTime(3000);
    expect(render().updateState).toBe(null);
    status({ status: 'not-available' });
    status({ status: 'available', version: '1.0.6' });
    vi.advanceTimersByTime(3000);
    expect(render().updateState.status).toBe('available');
  });
});
