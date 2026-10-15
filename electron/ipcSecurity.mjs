import path from 'node:path';
import { pathToFileURL } from 'node:url';

const text = (v, max = 4096) => typeof v === 'string' && v.length <= max && !v.includes('\0');
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const optional = (v, check) => v === undefined || v === null || check(v);
const filePath = (v) => text(v, 32768) && path.isAbsolute(v);
const id = (v) => text(v, 64) && /^[a-z0-9][a-z0-9-]{0,63}$/.test(v);
const bytes = (v, max = 0x1000200) =>
  (v instanceof Uint8Array ||
    (Array.isArray(v) && v.every((x) => Number.isInteger(x) && x >= 0 && x <= 255))) &&
  v.length > 0 &&
  v.length <= max;
const romBytes = (v) => bytes(v, 0x100200) && (v.length === 0x100000 || v.length === 0x100200);
const bool = (v) => typeof v === 'boolean';
const oneOf =
  (...values) =>
  (v) =>
    values.includes(v);
const number = (min, max) => (v) => Number.isFinite(v) && v >= min && v <= max;

export function validEndpoint(value) {
  if (!text(value)) return false;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `http://${value}`);
    return (
      !url.username &&
      !url.password &&
      !url.hash &&
      (url.protocol === 'https:' ||
        (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))
    );
  } catch {
    return false;
  }
}

const SETTINGS = {
  confirmBeforeSave: bool,
  autoBackupBeforeSave: bool,
  aiEnabled: bool,
  defaultExportPath: (v) => v === '' || filePath(v),
  emulatorPath: (v) => v === '' || filePath(v),
  emulatorArgs: text,
  aiProvider: oneOf('openai-compatible', 'openai', 'claude', 'gemini', 'grok', 'bedrock'),
  aiEndpoint: validEndpoint,
  aiModel: (v) => text(v, 512),
  aiApiKey: (v) => text(v, 8192),
  aiTemperature: number(0, 2),
  aiMaxTokens: number(1, 1000000),
  aiRegion: (v) => text(v, 64),
  language: oneOf('en', 'pt-BR'),
};
export function validSettings(settings) {
  return (
    object(settings) &&
    Object.entries(settings).every(
      ([key, value]) => Object.hasOwn(SETTINGS, key) && SETTINGS[key](value),
    )
  );
}
const aiSettings = (v) =>
  object(v) &&
  Object.entries(v).every(([key, value]) => {
    const mapped = {
      provider: 'aiProvider',
      endpoint: 'aiEndpoint',
      model: 'aiModel',
      apiKey: 'aiApiKey',
      temperature: 'aiTemperature',
      maxTokens: 'aiMaxTokens',
    }[key];
    return mapped && SETTINGS[mapped](value);
  });
const changes = (v) =>
  optional(
    v,
    (x) =>
      object(x) &&
      Object.entries(x).every(
        ([k, value]) =>
          (k === 'name' && text(value, 80)) || (k === 'description' && text(value, 1000)),
      ),
  );
const generation = (v) =>
  object(v) &&
  text(v.prompt, 200000) &&
  text(v.systemPrompt, 200000) &&
  optional(v.settings, aiSettings) &&
  optional(v.requestId, (x) => text(x, 128)) &&
  optional(v.schema, (x) => object(x) && JSON.stringify(x).length <= 1000000);
const noArgs = (...args) => args.length === 0;

const CHECKS = {
  'dialog:saveRomAs': (v) => optional(v, (x) => object(x) && optional(x.fromClose, bool)),
  'rom:saveComplete': (v) => object(v) && bool(v.fromClose),
  'rom:save': (v) => object(v) && romBytes(v.data) && optional(v.filePath, filePath),
  'rom:setCurrentPath': (v) => optional(v, filePath),
  'rom:modifiedState': bool,
  'app:setLocale': oneOf('en', 'pt-BR'),
  'app:setTheme': oneOf('light', 'dark'),
  'app:closeResponse': oneOf('save', 'discard', 'cancel'),
  'app:setSession': (v) =>
    object(v) &&
    optional(v.kind, oneOf('rom', 'project')) &&
    optional(v.name, text) &&
    optional(v.ext, oneOf('.smc', '.sfc')),
  'recent:open': filePath,
  'recent:remove': filePath,
  'shell:showInFolder': filePath,
  'emulator:test': (v) => object(v) && romBytes(v.data) && oneOf('.smc', '.sfc')(v.extension),
  'patch:save': (v) =>
    object(v) && bytes(v.data) && text(v.defaultName, 255) && oneOf('ips', 'bps')(v.format),
  'backup:save': (v) =>
    object(v) &&
    romBytes(v.data) &&
    optional(v.original, romBytes) &&
    object(v.meta) &&
    text(v.meta.fileName, 255) &&
    number(0, Number.MAX_SAFE_INTEGER)(v.meta.timestamp) &&
    number(0, 27)(v.meta.teamCount) &&
    v.meta.hasOriginal === true,
  'projects:create': (v) =>
    object(v) &&
    text(v.name, 80) &&
    optional(v.description, (x) => text(x, 1000)) &&
    romBytes(v.original) &&
    optional(v.data, romBytes) &&
    optional(v.romFileName, (x) => text(x, 255)) &&
    optional(v.baseCrc, (x) => /^[0-9a-f]{8}$/i.test(x)),
  'projects:load': id,
  'projects:markOpened': id,
  'projects:delete': id,
  'projects:autosaveClear': id,
  'projects:save': (v) => object(v) && id(v.id) && romBytes(v.data),
  'projects:autosaveSave': (v) => object(v) && id(v.id) && romBytes(v.data),
  'projects:update': (v) => object(v) && id(v.id) && changes(v.changes),
  'projects:duplicate': (v) => object(v) && id(v.id) && changes(v.changes),
  'projects:findOriginal': (v) => text(v, 8) && /^[0-9a-f]{8}$/i.test(v),
  'projects:saveArchive': (v) => object(v) && bytes(v.data) && text(v.defaultName, 255),
  'settings:get': (v) => Object.hasOwn(SETTINGS, v) && v !== 'aiApiKey',
  'settings:set': (v) => object(v) && validSettings({ [v.key]: v.value }),
  'settings:setAll': validSettings,
  'ai:saveSettings': aiSettings,
  'ai:testConnection': (v) => object(v) && optional(v.settings, aiSettings),
  'ai:generate': generation,
  'ai:generate-stream': generation,
  'ai:cancel-stream': (v) => text(v, 128),
};
for (const channel of [
  'dialog:openRom',
  'rom:getCurrentPath',
  'emulator:select',
  'recent:getAll',
  'recent:clear',
  'backup:load',
  'backup:clear',
  'projects:list',
  'settings:getAll',
  'settings:selectExportPath',
  'ai:getSettings',
  'updater:check',
  'updater:download',
  'updater:install',
])
  CHECKS[channel] = noArgs;

export function trustedSender(event, window, entryUrl) {
  return (
    !!window &&
    !window.isDestroyed() &&
    event.sender === window.webContents &&
    event.senderFrame === window.webContents.mainFrame &&
    event.senderFrame?.url === entryUrl
  );
}

export function validateIpcPayload(channel, args) {
  return hasIpcChannel(channel) && args.length <= 1 && CHECKS[channel](...args);
}

export function hasIpcChannel(channel) {
  return Object.hasOwn(CHECKS, channel);
}

/** Every registration passes through the same sender and payload boundary. */
export function secureIpc(ipcMain, getWindow, entryUrl) {
  const valid = (channel, event, args) =>
    trustedSender(event, getWindow(), entryUrl) && validateIpcPayload(channel, args);
  return {
    handle(channel, handler) {
      ipcMain.handle(channel, (event, ...args) => {
        if (!valid(channel, event, args)) throw new Error('Invalid IPC request');
        return handler(event, ...args);
      });
    },
    on(channel, handler) {
      ipcMain.on(channel, (event, ...args) => {
        if (valid(channel, event, args)) handler(event, ...args);
      });
    },
  };
}

export function rendererEntryUrl(packaged, directory) {
  return packaged
    ? pathToFileURL(path.join(directory, '..', 'dist', 'index.html')).href
    : 'http://localhost:5173/';
}
