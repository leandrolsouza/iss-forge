import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import {
  secureIpc,
  trustedSender,
  validateIpcPayload,
  validSettings,
  validEndpoint,
  hasIpcChannel,
} from '../../../electron/ipcSecurity.mjs';
import { rendererCsp } from '../../../electron/contentSecurity.mjs';

const url = 'http://localhost:5173/';
function sender() {
  const frame = { url };
  const window = { isDestroyed: () => false, webContents: { mainFrame: frame } };
  return { window, event: { sender: window.webContents, senderFrame: frame } };
}

describe('IPC boundary', () => {
  it('accepts only the main frame of the application at its exact entry URL', () => {
    const { window, event } = sender();
    expect(trustedSender(event, window, url)).toBe(true);
    expect(trustedSender({ ...event, sender: {} }, window, url)).toBe(false);
    expect(trustedSender({ ...event, senderFrame: { url } }, window, url)).toBe(false);
    event.senderFrame.url = 'https://untrusted.example';
    expect(trustedSender(event, window, url)).toBe(false);
  });

  it('checks sender and arguments before invoking a privileged operation', () => {
    let invoke;
    const ipc = {
      handle: (_channel, handler) => {
        invoke = handler;
      },
    };
    const { window, event } = sender();
    const handler = vi.fn(() => 'ok');
    secureIpc(ipc, () => window, url).handle('projects:delete', handler);
    expect(() => invoke(event, '../other-folder')).toThrow('Invalid IPC');
    expect(handler).not.toHaveBeenCalled();
    expect(invoke(event, 'my-project')).toBe('ok');
  });

  it('drops untrusted fire-and-forget events', () => {
    let listener;
    const { window, event } = sender();
    const handler = vi.fn();
    secureIpc(
      {
        on: (_channel, fn) => {
          listener = fn;
        },
      },
      () => window,
      url,
    ).on('rom:modifiedState', handler);
    listener(event, 'false');
    expect(handler).not.toHaveBeenCalled();
    listener(event, true);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('rejects private settings, invalid values, oversized ROMs and path traversal', () => {
    expect(validSettings({ aiCredentials: {} })).toBe(false);
    expect(validSettings({ aiTemperature: 99 })).toBe(false);
    expect(validSettings({ autoBackupBeforeSave: true })).toBe(true);
    expect(validateIpcPayload('rom:save', [{ data: new Uint8Array(32) }])).toBe(false);
    expect(validateIpcPayload('rom:save', [{ data: new Uint8Array(0x100000) }])).toBe(true);
    expect(validateIpcPayload('settings:get', ['aiApiKey'])).toBe(false);
    expect(validateIpcPayload('settings:get', ['aiCredentials'])).toBe(false);
    expect(validateIpcPayload('not:registered', [])).toBe(false);
  });

  it('permits HTTPS and local HTTP without embedded credentials', () => {
    expect(validEndpoint('localhost:1234')).toBe(true);
    expect(validEndpoint('http://127.0.0.1:11434/v1')).toBe(true);
    expect(validEndpoint('https://api.example/v1')).toBe(true);
    expect(validEndpoint('http://api.example/v1')).toBe(false);
    expect(validEndpoint('https://user:password@api.example')).toBe(false);
    expect(validEndpoint('file:///secret')).toBe(false);
  });

  it('registers every app handler through the secure boundary', () => {
    const source = fs.readFileSync(new URL('../../../electron/main.mjs', import.meta.url), 'utf8');
    expect(source).not.toMatch(/ipcMain\.(handle|on|once)\(/);
    for (const match of source.matchAll(/ipc\.(?:handle|on)\('([^']+)'/g)) {
      expect(hasIpcChannel(match[1]), `Missing schema for ${match[1]}`).toBe(true);
    }
    // Unknown registrations are rejected even if a future handler forgets its schema.
    expect(validateIpcPayload('future:unsafe', [])).toBe(false);
  });

  it('blocks inline scripts, frames and external connections in the packaged renderer', () => {
    const csp = rendererCsp();
    expect(csp).toContain("script-src 'self';");
    expect(csp).toContain("connect-src 'self';");
    expect(csp).toContain("frame-src 'none'");
    expect(rendererCsp(true)).toContain('ws://localhost:5173');
  });
});
