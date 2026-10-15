import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { EventEmitter } from 'node:events';
import { runInNewContext } from 'node:vm';

describe('ROM read failure subscription', () => {
  it('forwards only the failure data and removes its listener on cleanup', () => {
    const ipcRenderer = new EventEmitter();
    let api;
    const contextBridge = {
      exposeInMainWorld: (_name, exposed) => {
        api = exposed;
      },
    };
    const source = fs.readFileSync(
      new URL('../../../electron/preload.js', import.meta.url),
      'utf8',
    );
    runInNewContext(source, { require: () => ({ ipcRenderer, contextBridge }) });

    const notify = vi.fn();
    const cleanup = api.onRomLoadFailed(notify);
    const failure = { name: 'missing.sfc', error: 'File is not readable' };
    ipcRenderer.emit('rom:loadFailed', { sender: 'privileged event' }, failure);
    expect(notify).toHaveBeenCalledExactlyOnceWith(failure);

    cleanup();
    ipcRenderer.emit('rom:loadFailed', {}, failure);
    expect(notify).toHaveBeenCalledOnce();
    expect(ipcRenderer.listenerCount('rom:loadFailed')).toBe(0);
  });
});
