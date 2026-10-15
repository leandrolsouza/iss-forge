import { EventEmitter } from 'node:events';
import { setImmediate } from 'node:timers';
import { describe, it, expect, vi } from 'vitest';
import { createUpdater } from '../../../electron/updater.mjs';

function setup(options = {}) {
  const autoUpdater = Object.assign(new EventEmitter(), {
    checkForUpdates: vi.fn(async () => {
      autoUpdater.emit('update-available', { version: '1.0.6' });
      return {};
    }),
    downloadUpdate: vi.fn(async () => {
      autoUpdater.emit('update-downloaded', { version: '1.0.6' });
    }),
    quitAndInstall: vi.fn(),
  });
  const send = vi.fn();
  const openExternal = vi.fn().mockResolvedValue(undefined);
  const updater = createUpdater({ autoUpdater, send, openExternal, isPackaged: true, ...options });
  return { updater, autoUpdater, send, openExternal };
}

describe('updater lifecycle', () => {
  it('disables every action in development', async () => {
    const { updater, autoUpdater } = setup({ isPackaged: false });
    expect((await updater.check()).status).toBe('dev-mode');
    await updater.download();
    expect(updater.install()).toBe(false);
    expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled();
    expect(autoUpdater.downloadUpdate).not.toHaveBeenCalled();
  });

  it('deduplicates checks/downloads and preserves a downloaded update on later checks', async () => {
    const { updater, autoUpdater } = setup();
    await updater.download();
    expect(autoUpdater.downloadUpdate).not.toHaveBeenCalled();
    expect(updater.install()).toBe(false);
    await Promise.all([updater.check(), updater.check()]);
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);
    await Promise.all([updater.download(), updater.download()]);
    expect(autoUpdater.downloadUpdate).toHaveBeenCalledTimes(1);
    expect(await updater.check()).toEqual({ status: 'downloaded', version: '1.0.6' });
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);
    expect(updater.canInstall()).toBe(true);
  });

  it('reports download start before network progress and allows retry after failure', async () => {
    const { updater, autoUpdater } = setup();
    await updater.check();
    autoUpdater.downloadUpdate.mockRejectedValueOnce(new Error('network unavailable'));
    const download = updater.download();
    expect(updater.getState()).toMatchObject({ status: 'downloading', percent: 0 });
    await download;
    expect(updater.getState()).toEqual({ status: 'error', message: 'network unavailable' });
    await updater.download();
    expect(updater.getState().status).toBe('downloaded');
  });

  it('recovers from synchronous check failures and inactive updater results', async () => {
    const { updater, autoUpdater } = setup();
    autoUpdater.checkForUpdates.mockImplementationOnce(() => {
      throw new Error('invalid config');
    });
    await updater.check();
    expect(updater.getState()).toEqual({ status: 'error', message: 'invalid config' });
    autoUpdater.checkForUpdates.mockResolvedValueOnce(null);
    expect((await updater.check()).status).toBe('unsupported');
  });

  it('opens the release for unsigned macOS builds without starting an impossible install', async () => {
    const { updater, autoUpdater, openExternal } = setup({ manualInstall: true });
    await updater.check();
    expect(updater.getState()).toMatchObject({ status: 'available', manualInstall: true });
    await updater.download();
    expect(openExternal).toHaveBeenCalledWith(
      'https://github.com/leandrolsouza/iss-forge/releases/tag/v1.0.6',
    );
    expect(autoUpdater.downloadUpdate).not.toHaveBeenCalled();
    expect(updater.canInstall()).toBe(false);
  });

  it('defers installation until IPC has replied and prevents duplicate installs', async () => {
    const { updater, autoUpdater } = setup();
    await updater.check();
    await updater.download();
    expect(updater.install()).toBe(true);
    expect(updater.install()).toBe(false);
    expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled();
    await new Promise((resolve) => setImmediate(resolve));
    expect(autoUpdater.quitAndInstall).toHaveBeenCalledExactlyOnceWith(false, true);
  });
});
