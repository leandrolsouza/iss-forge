/** Own updater state in the main process so reloads and repeated clicks are safe. */
export function createUpdater({
  autoUpdater,
  isPackaged,
  manualInstall = false,
  openExternal,
  send,
}) {
  let state = { status: isPackaged ? 'idle' : 'dev-mode' };
  let operation = null;
  let available = null;
  let ready = null;
  let installing = false;
  const setState = (status, data = {}) => {
    state = { status, ...data };
    send(state);
    return state;
  };
  const fail = (error) => {
    installing = false;
    return setState('error', { message: error?.message || String(error) });
  };
  const run = (fn) => {
    // Defer invocation so the lock is held even if the updater throws synchronously.
    operation = Promise.resolve()
      .then(fn)
      .catch(fail)
      .finally(() => {
        operation = null;
      });
    return operation.then(() => state);
  };

  if (isPackaged) {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowDowngrade = false;
    autoUpdater.on('checking-for-update', () => setState('checking'));
    autoUpdater.on('update-available', (info) => {
      available = { version: info.version, releaseDate: info.releaseDate, manualInstall };
      setState('available', available);
    });
    autoUpdater.on('update-not-available', () => {
      available = null;
      setState('not-available');
    });
    autoUpdater.on('download-progress', (progress) =>
      setState('downloading', {
        version: available?.version,
        percent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total,
      }),
    );
    autoUpdater.on('update-downloaded', (info) => {
      ready = { version: info.version };
      setState('downloaded', ready);
    });
    autoUpdater.on('error', fail);
  }

  return {
    getState: () => state,
    check() {
      if (!isPackaged) return Promise.resolve(state);
      if (operation) return operation.then(() => state);
      if (ready) return Promise.resolve(setState('downloaded', ready));
      setState('checking');
      return run(async () => {
        const result = await autoUpdater.checkForUpdates();
        if (result === null) setState('unsupported');
      });
    },
    download() {
      if (!isPackaged) return Promise.resolve(state);
      if (operation) return operation.then(() => state);
      if (ready) return Promise.resolve(setState('downloaded', ready));
      if (!available) return Promise.resolve(state);
      if (manualInstall) {
        return run(() =>
          openExternal(
            `https://github.com/leandrolsouza/iss-forge/releases/tag/${encodeURIComponent(`v${available.version}`)}`,
          ),
        );
      }
      setState('downloading', { ...available, percent: 0 });
      return run(() => autoUpdater.downloadUpdate());
    },
    canInstall: () => isPackaged && !!ready && !installing,
    install() {
      if (!isPackaged || !ready || installing) return false;
      installing = true;
      // Reply to IPC before Electron tears down the renderer.
      setImmediate(() => {
        try {
          autoUpdater.quitAndInstall(false, true);
        } catch (error) {
          installing = false;
          fail(error);
        }
      });
      return true;
    },
  };
}
