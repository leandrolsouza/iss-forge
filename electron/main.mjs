import { app, BrowserWindow, ipcMain, dialog, Menu, shell, safeStorage } from 'electron';
import electronUpdater from 'electron-updater';
const { autoUpdater } = electronUpdater;
import Store from 'electron-store';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import {
  DEFAULT_MAX_TOKENS,
  fetchErrorToAi,
  responseErrorToAi,
  getProvider,
  getEffectiveEndpoint,
  buildHeaders,
  buildRequestBody,
  isTruncatedStop,
  parseResponse,
  readSseStream,
  readBedrockEventStream,
} from './aiProviders.mjs';
import * as projects from './projects.mjs';
import { writeAtomic } from './atomicFile.mjs';
import * as backups from './backups.mjs';
import { createCredentialSettings } from './credentials.mjs';
import { secureIpc, rendererEntryUrl } from './ipcSecurity.mjs';
import { rendererCsp } from './contentSecurity.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- App Settings (electron-store) ---
const settingsStore = new Store({
  name: 'app-settings',
  defaults: {
    confirmBeforeSave: true,
    autoBackupBeforeSave: true,
    defaultExportPath: '',
    emulatorPath: '',
    emulatorArgs: '{rom}',
    aiEnabled: true,
    aiProvider: 'openai-compatible',
    aiEndpoint: 'http://localhost:1234/v1/chat/completions',
    aiModel: '',
    aiTemperature: 0.7,
    aiMaxTokens: DEFAULT_MAX_TOKENS,
    aiRegion: 'us-east-1',
  },
});

let mainWindow;
const entryUrl = rendererEntryUrl(app.isPackaged, __dirname);
const ipc = secureIpc(ipcMain, () => mainWindow, entryUrl);
const credentialSettings = createCredentialSettings(settingsStore, safeStorage);
let currentRomPath = null;
let lastOpenDialogPath = null;
let isRomModified = false;
let forceQuit = false;
let waitingForCloseSave = false;
// What the editor has open, sent by the renderer ('app:setSession'):
// { kind: 'project' | 'rom' | null, name?: string, ext?: string }. Menu labels follow it.
let session = { kind: null };
// UI language, sent by the renderer ('app:setLocale') and kept for the next start
let currentLocale = settingsStore.get('language') || 'pt-BR';

// Strings of the native menus and dialogs (the main process has no access to React i18n)
const MAIN_I18N = {
  'pt-BR': {
    file: 'Arquivo',
    newProject: 'Novo Projeto...',
    openProject: 'Abrir Projeto...',
    closeProject: 'Fechar Projeto',
    closeRom: 'Fechar ROM',
    saveProject: 'Salvar Projeto',
    exportRom: 'Exportar ROM (.sfc/.smc)...',
    exportRomTitle: 'Exportar ROM do projeto',
    openRom: 'Abrir ROM...',
    saveRom: 'Salvar ROM',
    saveRomAs: 'Salvar ROM Como...',
    exportPatch: 'Exportar Patch (BPS/IPS)...',
    testEmulator: 'Testar no Emulador',
    quit: 'Sair',
    edit: 'Editar',
    undo: 'Desfazer',
    redo: 'Refazer',
    cut: 'Recortar',
    copy: 'Copiar',
    paste: 'Colar',
    selectAll: 'Selecionar tudo',
    view: 'Visualizar',
    reload: 'Recarregar',
    zoomReset: 'Zoom normal',
    help: 'Ajuda',
    about: 'Sobre o ISS Forge',
    checkForUpdates: 'Verificar Atualizações',
    openRomTitle: 'Abrir ROM do ISS',
    saveRomAsTitle: 'Salvar ROM Como',
    snesRom: 'ROM SNES',
    allFiles: 'Todos os Arquivos',
    programs: 'Programas',
    chooseEmulator: 'Escolher emulador',
    exportPatchTitle: 'Exportar Patch {format}',
    patchFiles: 'Patch {format}',
    openRomError: 'Erro ao abrir ROM',
    chooseFolder: 'Escolher pasta',
    exportProjectTitle: 'Exportar projeto',
    projectFiles: 'Projeto do ISS Forge',
  },
  en: {
    file: 'File',
    newProject: 'New Project...',
    openProject: 'Open Project...',
    closeProject: 'Close Project',
    closeRom: 'Close ROM',
    saveProject: 'Save Project',
    exportRom: 'Export ROM (.sfc/.smc)...',
    exportRomTitle: 'Export the project ROM',
    openRom: 'Open ROM...',
    saveRom: 'Save ROM',
    saveRomAs: 'Save ROM As...',
    exportPatch: 'Export Patch (BPS/IPS)...',
    testEmulator: 'Test in Emulator',
    quit: 'Quit',
    edit: 'Edit',
    undo: 'Undo',
    redo: 'Redo',
    cut: 'Cut',
    copy: 'Copy',
    paste: 'Paste',
    selectAll: 'Select All',
    view: 'View',
    reload: 'Reload',
    zoomReset: 'Reset Zoom',
    help: 'Help',
    about: 'About ISS Forge',
    checkForUpdates: 'Check for Updates',
    openRomTitle: 'Open ISS ROM',
    saveRomAsTitle: 'Save ROM As',
    snesRom: 'SNES ROM',
    allFiles: 'All Files',
    programs: 'Programs',
    chooseEmulator: 'Choose emulator',
    exportPatchTitle: 'Export {format} Patch',
    patchFiles: '{format} Patch',
    openRomError: 'Could not open the ROM',
    chooseFolder: 'Choose folder',
    exportProjectTitle: 'Export project',
    projectFiles: 'ISS Forge project',
  },
};

/** Native UI string in the current language */
function tr(key, params = {}) {
  const s = (MAIN_I18N[currentLocale] || MAIN_I18N['pt-BR'])[key] || MAIN_I18N['pt-BR'][key] || key;
  return s.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? params[k] : m));
}

// --- Recent ROMs ---
const MAX_RECENT_ROMS = 10;

function getRecentRomsPath() {
  return path.join(app.getPath('userData'), 'recent-roms.json');
}

function loadRecentRoms() {
  try {
    const filePath = getRecentRomsPath();
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return Array.isArray(data) ? data : [];
    }
  } catch (err) {
    console.error('Failed to load recent ROMs:', err.message);
  }
  return [];
}

function saveRecentRoms(recents) {
  try {
    fs.writeFileSync(getRecentRomsPath(), JSON.stringify(recents, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save recent ROMs:', err.message);
  }
}

function addRecentRom(filePath) {
  const recents = loadRecentRoms();
  const entry = {
    path: filePath,
    name: path.basename(filePath),
    timestamp: Date.now(),
  };
  // Remove duplicate if already exists
  const filtered = recents.filter((r) => r.path !== filePath);
  filtered.unshift(entry);
  saveRecentRoms(filtered.slice(0, MAX_RECENT_ROMS));
}

/** Window controls overlay colours per theme (match --bg-titlebar / --text-primary) */
const TITLEBAR_COLORS = {
  dark: { color: '#1f1f1f', symbolColor: '#cccccc' },
  light: { color: '#f8f8f8', symbolColor: '#1e1e1e' },
};

function createWindow() {
  forceQuit = false;
  waitingForCloseSave = false;
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: '#1f1f1f',
    icon: path.join(__dirname, '..', 'public', 'icon.ico'),
    titleBarStyle: 'hidden',
    // Same colours as --bg-titlebar / --text-primary (dark); the renderer
    // updates them when the theme changes ('app:setTheme')
    titleBarOverlay: {
      color: TITLEBAR_COLORS.dark.color,
      symbolColor: TITLEBAR_COLORS.dark.symbolColor,
      height: 32,
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== entryUrl) event.preventDefault();
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Provider documentation links open in the browser, with no preload privileges.
    if (url.startsWith('https://')) shell.openExternal(url).catch(() => { });
    return { action: 'deny' };
  });
  mainWindow.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) =>
    callback(false),
  );
  mainWindow.webContents.session.setPermissionCheckHandler(() => false);
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const csp = rendererCsp(!app.isPackaged);
    callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [csp] } });
  });

  // In development, load from Vite dev server
  const isDev = !app.isPackaged;

  if (isDev) {
    const devUrl = 'http://localhost:5173';

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error(`Failed to load: ${errorDescription} (${errorCode})`);
      // Retry after a short delay
      setTimeout(() => {
        console.log('Retrying to load dev server...');
        mainWindow.loadURL(devUrl);
      }, 2000);
    });

    mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('close', (event) => {
    if (isRomModified && !forceQuit) {
      event.preventDefault();
      // Ask renderer to show custom modal
      mainWindow.webContents.send('app:confirmClose');
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  createMenu();
}

function createMenu() {
  const isProject = session.kind === 'project';
  const send = (channel) => () => mainWindow?.webContents.send(channel);
  const template = [
    {
      label: tr('file'),
      submenu: [
        { label: tr('newProject'), click: send('menu:newProject') },
        {
          label: tr('openProject'),
          accelerator: 'CmdOrCtrl+Shift+O',
          click: send('menu:openProject'),
        },
        {
          label: tr('openRom'),
          accelerator: 'CmdOrCtrl+O',
          click: () => handleOpenRom(),
        },
        { type: 'separator' },
        {
          label: isProject ? tr('saveProject') : tr('saveRom'),
          accelerator: 'CmdOrCtrl+S',
          enabled: !!session.kind,
          click: () => mainWindow.webContents.send('menu:save'),
        },
        {
          // in a project "Save As" writes a ROM file and the session stays in the project
          label: isProject ? tr('exportRom') : tr('saveRomAs'),
          accelerator: 'CmdOrCtrl+Shift+S',
          enabled: !!session.kind,
          click: () => handleSaveRomAs(),
        },
        {
          label: tr('exportPatch'),
          accelerator: 'CmdOrCtrl+E',
          enabled: !!session.kind,
          click: () => mainWindow.webContents.send('menu:exportPatch'),
        },
        {
          label: tr('testEmulator'),
          accelerator: 'F5',
          enabled: !!session.kind,
          click: () => mainWindow.webContents.send('menu:testEmulator'),
        },
        { type: 'separator' },
        {
          label: isProject ? tr('closeProject') : tr('closeRom'),
          enabled: !!session.kind,
          click: send('menu:closeSession'),
        },
        { type: 'separator' },
        {
          label: tr('quit'),
          accelerator: 'CmdOrCtrl+Q',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: tr('edit'),
      submenu: [
        {
          label: tr('undo'),
          accelerator: 'CmdOrCtrl+Z',
          click: () => mainWindow.webContents.send('menu:undo'),
        },
        {
          label: tr('redo'),
          accelerator: 'CmdOrCtrl+Y',
          click: () => mainWindow.webContents.send('menu:redo'),
        },
        { type: 'separator' },
        { label: tr('cut'), accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: tr('copy'), accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: tr('paste'), accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: tr('selectAll'), accelerator: 'CmdOrCtrl+A', role: 'selectAll' },
      ],
    },
    {
      label: tr('view'),
      submenu: [
        { label: tr('reload'), accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: 'DevTools', accelerator: 'F12', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: 'Zoom +', accelerator: 'CmdOrCtrl+=', role: 'zoomIn' },
        { label: 'Zoom -', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { label: tr('zoomReset'), accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
      ],
    },
    {
      label: tr('help'),
      submenu: [
        {
          label: tr('about'),
          click: () => {
            mainWindow.webContents.send('menu:about');
          },
        },
        { type: 'separator' },
        {
          label: tr('checkForUpdates'),
          click: () => {
            if (!app.isPackaged) {
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: tr('checkForUpdates'),
                message: 'Dev mode — auto-update is disabled.',
              });
              return;
            }
            mainWindow.webContents.send('menu:checkForUpdates');
            autoUpdater.checkForUpdates().catch((err) => {
              console.error('Menu update check failed:', err.message);
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

async function handleOpenRom() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: tr('openRomTitle'),
    defaultPath: lastOpenDialogPath || app.getPath('home'),
    filters: [
      { name: tr('snesRom'), extensions: ['smc', 'sfc', 'bin'] },
      { name: tr('allFiles'), extensions: ['*'] },
    ],
    properties: ['openFile'],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    lastOpenDialogPath = path.dirname(filePath);
    loadAndSendRom(filePath);
  } else {
    mainWindow.webContents.send('rom:loadCancelled');
  }
}

function loadAndSendRom(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    lastOpenDialogPath = path.dirname(filePath);
    // currentRomPath / recents are only updated once the renderer accepts and
    // parses the ROM (see 'rom:setCurrentPath'). Otherwise cancelling the
    // "unsaved changes" prompt, or an invalid file, would redirect the next
    // save to a file the user never actually opened.
    mainWindow.webContents.send('rom:loaded', {
      path: filePath,
      name: path.basename(filePath),
      data: Array.from(buffer),
    });
  } catch (err) {
    dialog.showErrorBox(tr('openRomError'), err.message);
  }
}

async function handleSaveRomAs(_event, options = {}) {
  // A project has no file of its own: suggest "<project name>.sfc" in the export folder
  let defaultPath = currentRomPath || 'ISS_Modified.smc';
  if (session.kind === 'project') {
    const exportDir = settingsStore.get('defaultExportPath');
    const dir = exportDir && fs.existsSync(exportDir) ? exportDir : app.getPath('documents');
    const stem = (session.name || 'ISS').replace(/[<>:"/\\|?*]/g, '').trim() || 'ISS';
    defaultPath = path.join(dir, `${stem}${session.ext === '.smc' ? '.smc' : '.sfc'}`);
  }
  const result = await dialog.showSaveDialog(mainWindow, {
    title: session.kind === 'project' ? tr('exportRomTitle') : tr('saveRomAsTitle'),
    defaultPath,
    filters: [
      { name: tr('snesRom'), extensions: ['smc', 'sfc'] },
      { name: tr('allFiles'), extensions: ['*'] },
    ],
  });

  if (!result.canceled && result.filePath) {
    mainWindow.webContents.send('rom:save-as-path', result.filePath, {
      fromClose: options.fromClose === true,
    });
  }
}

// IPC Handlers
ipc.handle('dialog:openRom', handleOpenRom);

ipc.handle('dialog:saveRomAs', handleSaveRomAs);

ipc.handle('rom:save', async (event, { data, filePath }) => {
  try {
    const savePath = filePath || currentRomPath;
    if (!savePath) {
      return { success: false, error: 'noSavePath' };
    }
    const buffer = Buffer.from(data);
    // Settings > Editor: keep the previous version of the file as <name>.bak
    if (settingsStore.get('autoBackupBeforeSave') && fs.existsSync(savePath)) {
      writeAtomic(`${savePath}.bak`, fs.readFileSync(savePath));
    }
    writeAtomic(savePath, buffer);
    currentRomPath = savePath;
    return { success: true, path: savePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipc.handle('rom:getCurrentPath', () => currentRomPath);

// Renderer confirms a ROM was accepted and parsed (dialog, recents or drag-and-drop)
ipc.on('rom:setCurrentPath', (event, filePath) => {
  currentRomPath = filePath || null;
  if (filePath) {
    lastOpenDialogPath = path.dirname(filePath);
    addRecentRom(filePath);
  }
});

// --- Test in emulator ---

/** Split an argument string, honouring double quotes ("C:\My Path\core.dll") */
function splitArgs(str) {
  const out = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m;
  while ((m = re.exec(str || ''))) out.push(m[1] !== undefined ? m[1] : m[2]);
  return out;
}

ipc.handle('emulator:test', async (event, { data, extension }) => {
  try {
    const exe = settingsStore.get('emulatorPath');
    if (!exe || !fs.existsSync(exe)) {
      return { success: false, error: 'noEmulator' };
    }
    // Fixed temp name: the emulator reloads the same file on every test
    const ext = extension === '.smc' ? '.smc' : '.sfc';
    const romPath = path.join(app.getPath('temp'), `iss-forge-test${ext}`);
    writeAtomic(romPath, Buffer.from(data));

    let args = splitArgs(settingsStore.get('emulatorArgs') || '{rom}');
    if (args.some((a) => a.includes('{rom}'))) args = args.map((a) => a.replace('{rom}', romPath));
    else args.push(romPath);

    const child = spawn(exe, args, { detached: true, stdio: 'ignore', cwd: path.dirname(exe) });
    child.on('error', () => { });
    child.unref();
    return { success: true, path: romPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipc.handle('emulator:select', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: tr('chooseEmulator'),
    properties: ['openFile'],
    filters:
      process.platform === 'win32'
        ? [
          { name: tr('programs'), extensions: ['exe'] },
          { name: tr('allFiles'), extensions: ['*'] },
        ]
        : [{ name: tr('allFiles'), extensions: ['*'] }],
  });
  if (result.canceled || !result.filePaths.length) return { success: false };
  settingsStore.set('emulatorPath', result.filePaths[0]);
  return { success: true, path: result.filePaths[0] };
});

ipc.handle('patch:save', async (event, { data, defaultName, format }) => {
  try {
    const ext = format === 'ips' ? 'ips' : 'bps';
    // Settings > Editor: default export folder, else next to the ROM
    const exportDir = settingsStore.get('defaultExportPath');
    const defaultDir =
      exportDir && fs.existsSync(exportDir)
        ? exportDir
        : currentRomPath
          ? path.dirname(currentRomPath)
          : app.getPath('documents');
    const result = await dialog.showSaveDialog(mainWindow, {
      title: tr('exportPatchTitle', { format: ext.toUpperCase() }),
      defaultPath: path.join(defaultDir, defaultName || `ISS_Forge.${ext}`),
      filters: [
        { name: tr('patchFiles', { format: ext.toUpperCase() }), extensions: [ext] },
        { name: tr('allFiles'), extensions: ['*'] },
      ],
    });
    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }
    writeAtomic(result.filePath, Buffer.from(data));
    return { success: true, path: result.filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Track modified state from renderer (for close guard)
ipc.on('rom:modifiedState', (event, isModified) => {
  isRomModified = isModified;
});

// Track locale from renderer (for native dialog i18n)
ipc.on('app:setLocale', (event, locale) => {
  if (!MAIN_I18N[locale] || locale === currentLocale) return;
  currentLocale = locale;
  settingsStore.set('language', locale);
  createMenu();
});

// What is open in the editor (menu labels / "Save As" suggestion)
ipc.on('app:setSession', (event, next) => {
  const value = {
    kind: next?.kind === 'project' || next?.kind === 'rom' ? next.kind : null,
    name: typeof next?.name === 'string' ? next.name : '',
    ext: typeof next?.ext === 'string' ? next.ext : '',
  };
  const relabel = value.kind !== session.kind;
  session = value;
  if (relabel) createMenu();
});

// "Show in folder": a project folder is opened, a file is selected in its folder
ipc.handle('shell:showInFolder', async (event, target) => {
  try {
    if (typeof target !== 'string' || !target || !fs.existsSync(target)) {
      return { success: false, error: 'fileNotFound' };
    }
    if (fs.statSync(target).isDirectory()) {
      const error = await shell.openPath(target);
      return error ? { success: false, error } : { success: true };
    }
    shell.showItemInFolder(target);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Keep the native window controls in the theme colours
ipc.on('app:setTheme', (event, theme) => {
  const colors = TITLEBAR_COLORS[theme] || TITLEBAR_COLORS.dark;
  try {
    mainWindow?.setTitleBarOverlay?.({ ...colors, height: 32 });
    mainWindow?.setBackgroundColor?.(colors.color);
  } catch {
    // setTitleBarOverlay is Windows/Linux only
  }
});

// Handle close response from renderer custom modal
// choice: 'save' | 'discard' | 'cancel'
ipc.on('app:closeResponse', (event, choice) => {
  waitingForCloseSave = choice === 'save';
  if (choice === 'save') {
    mainWindow.webContents.send('menu:save', { fromClose: true });
  } else if (choice === 'discard') {
    forceQuit = true;
    mainWindow.close();
  }
  // 'cancel': do nothing, window stays open
});

ipc.on('rom:saveComplete', (_event, { fromClose }) => {
  if (!fromClose || !waitingForCloseSave) return;
  waitingForCloseSave = false;
  forceQuit = true;
  mainWindow.close();
});

ipc.handle('recent:getAll', () => {
  return loadRecentRoms();
});

ipc.handle('recent:clear', () => {
  saveRecentRoms([]);
  return { success: true };
});

ipc.handle('recent:remove', (event, filePath) => {
  const recents = loadRecentRoms().filter((r) => r.path !== filePath);
  saveRecentRoms(recents);
  return { success: true };
});

ipc.handle('recent:open', (event, filePath) => {
  if (fs.existsSync(filePath)) {
    loadAndSendRom(filePath);
    return { success: true };
  }
  // File no longer exists — remove from recents
  const recents = loadRecentRoms().filter((r) => r.path !== filePath);
  saveRecentRoms(recents);
  return { success: false, error: 'fileNotFound' };
});

// --- Auto-Save / Backup ---
// `original` is only sent with the first backup of a session (it never changes)
ipc.handle('backup:save', (event, { data, meta, original }) => {
  try {
    backups.saveBackup(app.getPath('userData'), { data, meta, original });
    return { success: true, timestamp: Date.now() };
  } catch (err) {
    console.error('Auto-save backup failed:', err.message);
    return { success: false, error: err.message };
  }
});

ipc.handle('backup:load', () => {
  try {
    const backup = backups.loadBackup(app.getPath('userData'));
    if (!backup) return { exists: false };
    const { data: buffer, meta, original } = backup;
    return {
      exists: true,
      data: Array.from(buffer),
      original: original && original.length === buffer.length ? Array.from(original) : null,
      meta,
    };
  } catch (err) {
    console.error('Failed to load backup:', err.message);
    return { exists: false, error: err.message };
  }
});

ipc.handle('backup:clear', () => {
  try {
    backups.clearBackup(app.getPath('userData'));
    return { success: true };
  } catch (err) {
    console.error('Failed to clear backup:', err.message);
    return { success: false, error: err.message };
  }
});

// --- Projects ---
// One managed folder per project under userData/projects (see projects.mjs).
// ROM bytes travel as Uint8Array (structured clone), not as number arrays.

function getProjectsRoot() {
  return path.join(app.getPath('userData'), 'projects');
}

/** Run a projects.mjs call; errors become { success: false, error: <i18n key | message> } */
function projectCall(fn) {
  try {
    return { success: true, ...fn(getProjectsRoot()) };
  } catch (err) {
    if (!err.code?.startsWith('project')) console.error('[Projects]', err);
    return { success: false, error: err.code?.startsWith('project') ? err.code : err.message };
  }
}

ipc.handle('projects:list', () =>
  projectCall((root) => ({ projects: projects.listProjects(root) })),
);

ipc.handle('projects:create', (event, params) =>
  projectCall((root) => ({ project: projects.createProject(root, params) })),
);

ipc.handle('projects:load', (event, id) =>
  projectCall((root) => {
    const res = projects.loadProject(root, id);
    return { project: res.meta, data: res.data, original: res.original, autosave: res.autosave };
  }),
);

ipc.handle('projects:save', (event, { id, data }) =>
  projectCall((root) => ({ project: projects.saveProjectRom(root, id, data) })),
);

ipc.handle('projects:markOpened', (event, id) =>
  projectCall((root) => ({ project: projects.markProjectOpened(root, id) })),
);

ipc.handle('projects:update', (event, { id, changes }) =>
  projectCall((root) => ({ project: projects.updateProject(root, id, changes) })),
);

ipc.handle('projects:duplicate', (event, { id, changes }) =>
  projectCall((root) => ({ project: projects.duplicateProject(root, id, changes) })),
);

ipc.handle('projects:delete', (event, id) =>
  projectCall((root) => {
    projects.deleteProject(root, id);
    return {};
  }),
);

ipc.handle('projects:autosaveSave', (event, { id, data }) =>
  projectCall((root) => {
    projects.saveProjectAutosave(root, id, data);
    return { timestamp: Date.now() };
  }),
);

ipc.handle('projects:autosaveClear', (event, id) =>
  projectCall((root) => {
    projects.clearProjectAutosave(root, id);
    return {};
  }),
);

ipc.handle('projects:findOriginal', (event, crc) =>
  projectCall((root) => ({ original: projects.findOriginalByCrc(root, crc) })),
);

// Write an exported project (.issproj) where the user chooses
ipc.handle('projects:saveArchive', async (event, { data, defaultName }) => {
  try {
    const exportDir = settingsStore.get('defaultExportPath');
    const defaultDir = exportDir && fs.existsSync(exportDir) ? exportDir : app.getPath('documents');
    const result = await dialog.showSaveDialog(mainWindow, {
      title: tr('exportProjectTitle'),
      defaultPath: path.join(defaultDir, defaultName || 'projeto.issproj'),
      filters: [
        { name: tr('projectFiles'), extensions: ['issproj'] },
        { name: tr('allFiles'), extensions: ['*'] },
      ],
    });
    if (result.canceled || !result.filePath) return { success: false, canceled: true };
    writeAtomic(result.filePath, Buffer.from(data));
    return { success: true, path: result.filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// --- App Settings ---
ipc.handle('settings:getAll', () => {
  return credentialSettings.publicSettings();
});

ipc.handle('settings:get', (event, key) => {
  return credentialSettings.publicSettings()[key];
});

ipc.handle('settings:set', (event, { key, value }) => {
  try {
    return { success: true, settings: credentialSettings.update({ [key]: value }) };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipc.handle('settings:setAll', (event, settings) => {
  try {
    return { success: true, settings: credentialSettings.update(settings) };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipc.handle('settings:selectExportPath', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: tr('chooseFolder'),
    properties: ['openDirectory'],
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return { success: true, path: result.filePaths[0] };
  }
  return { success: false };
});

// --- AI Team Generator ---
function loadAiSettings() {
  return credentialSettings.publicAiSettings();
}

function saveAiSettings(settings) {
  const keys = {
    provider: 'aiProvider',
    endpoint: 'aiEndpoint',
    model: 'aiModel',
    apiKey: 'aiApiKey',
    temperature: 'aiTemperature',
    maxTokens: 'aiMaxTokens',
  };
  try {
    const updated = credentialSettings.update(
      Object.fromEntries(Object.entries(settings).map(([key, value]) => [keys[key], value])),
    );
    return { success: true, settings: updated };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

ipc.handle('ai:getSettings', () => {
  return loadAiSettings();
});

ipc.handle('ai:saveSettings', (event, settings) => {
  return saveAiSettings(settings);
});

ipc.handle('ai:testConnection', async (event, { settings }) => {
  const config = credentialSettings.resolveAiSettings(settings);
  const providerId = config.provider || settingsStore.get('aiProvider') || 'openai-compatible';
  const provider = getProvider(providerId);
  const endpoint = getEffectiveEndpoint(provider, config.endpoint, config.model);

  const headers = buildHeaders(provider, config.apiKey);
  const body = buildRequestBody({
    format: provider.format,
    systemPrompt: 'You are a helpful assistant.',
    userPrompt: 'Say "OK" and nothing else.',
    model: config.model,
    temperature: undefined,
    maxTokens: 32,
    stream: false,
  });

  console.log('[AI Test] Provider:', providerId);
  console.log('[AI Test] Endpoint:', endpoint);
  console.log('[AI Test] Config endpoint:', config.endpoint);
  console.log('[AI Test] Model:', config.model);
  console.log('[AI Test] Body:', JSON.stringify(body, null, 2));

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      redirect: 'error',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      return { success: false, error: await responseErrorToAi(response) };
    }

    const data = await response.json();
    const result = parseResponse(data, provider.format);

    if (result.error) {
      return { success: false, error: result.error };
    }

    return { success: true, content: result.content };
  } catch (err) {
    return { success: false, error: fetchErrorToAi(err, endpoint) };
  }
});

/** Request body of a generation, with the user's settings (0 is a valid temperature) */
function generationBody(provider, config, { prompt, systemPrompt, schema }, stream) {
  return buildRequestBody({
    format: provider.format,
    systemPrompt,
    userPrompt: prompt,
    model: config.model,
    temperature: config.temperature,
    maxTokens: config.maxTokens || DEFAULT_MAX_TOKENS,
    stream,
    schema: schema || null,
  });
}

ipc.handle('ai:generate', async (event, payload) => {
  const config = credentialSettings.resolveAiSettings(payload.settings);
  const providerId = config.provider || settingsStore.get('aiProvider') || 'openai-compatible';
  const provider = getProvider(providerId);
  const endpoint = getEffectiveEndpoint(provider, config.endpoint, config.model);

  const headers = buildHeaders(provider, config.apiKey);
  const body = generationBody(provider, config, payload, false);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      redirect: 'error',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000), // 2 minute timeout for LLM
    });

    if (!response.ok) {
      return { success: false, error: await responseErrorToAi(response) };
    }

    const data = await response.json();
    const result = parseResponse(data, provider.format);

    if (result.error) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      content: result.content,
      usage: result.usage,
      truncated: isTruncatedStop(result.stopReason),
    };
  } catch (err) {
    return { success: false, error: fetchErrorToAi(err, endpoint) };
  }
});

// Running streams by request id, so the renderer can cancel them ('ai:cancel-stream')
const aiStreams = new Map();

ipc.handle('ai:cancel-stream', (event, requestId) => {
  aiStreams.get(requestId)?.abort();
  aiStreams.delete(requestId);
  return { success: true };
});

/**
 * AI streaming generation — sends chunks back to renderer via events. Every event
 * carries the request id, so chunks of an old (cancelled) stream are never mixed
 * into a new one:
 *   ai:stream-chunk (text, requestId)
 *   ai:stream-done  ({ requestId, stopReason, truncated })
 *   ai:stream-error (error, requestId)
 */
ipc.handle('ai:generate-stream', async (event, payload) => {
  const requestId = payload.requestId ?? null;
  const config = credentialSettings.resolveAiSettings(payload.settings);
  const sender = event.sender;
  const providerId = config.provider || settingsStore.get('aiProvider') || 'openai-compatible';
  const provider = getProvider(providerId);
  const endpoint = getEffectiveEndpoint(provider, config.endpoint, config.model, true);
  const headers = buildHeaders(provider, config.apiKey);
  // Bedrock ConverseStream takes the same body as Converse (no "stream" flag)
  const body = generationBody(provider, config, payload, provider.format !== 'bedrock');

  const controller = new AbortController();
  if (requestId != null) aiStreams.set(requestId, controller);
  const send = (channel, ...args) => {
    if (!controller.signal.aborted && !sender.isDestroyed()) sender.send(channel, ...args);
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      redirect: 'error',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(180000)]),
    });

    if (!response.ok) {
      send('ai:stream-error', await responseErrorToAi(response), requestId);
      return { success: false };
    }

    const onContent = (text) => send('ai:stream-chunk', text, requestId);
    const { stopReason, error } =
      provider.format === 'bedrock'
        ? await readBedrockEventStream(response.body, onContent)
        : await readSseStream(response.body, provider.format, onContent);

    if (error) {
      send('ai:stream-error', error, requestId);
      return { success: false };
    }
    send('ai:stream-done', { requestId, stopReason, truncated: isTruncatedStop(stopReason) });
    return { success: true };
  } catch (err) {
    send('ai:stream-error', fetchErrorToAi(err, endpoint), requestId);
    return { success: false };
  } finally {
    if (requestId != null) aiStreams.delete(requestId);
  }
});

// --- Auto-Updater ---
function setupAutoUpdater() {
  // Don't check for updates in development
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  // Skip code-signature verification — the app is not code-signed, so the
  // default NSIS verifier would reject every downloaded update.
  autoUpdater.verifyUpdateCodeSignature = async () => null;

  autoUpdater.on('checking-for-update', () => {
    sendUpdaterStatus('checking');
  });

  autoUpdater.on('update-available', (info) => {
    sendUpdaterStatus('available', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
    });
  });

  autoUpdater.on('update-not-available', () => {
    sendUpdaterStatus('not-available');
  });

  autoUpdater.on('download-progress', (progress) => {
    sendUpdaterStatus('downloading', {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    sendUpdaterStatus('downloaded', { version: info.version });
  });

  autoUpdater.on('error', (err) => {
    sendUpdaterStatus('error', { message: err.message });
  });

  // Check for updates after a short delay to not block startup
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('Auto-update check failed:', err.message);
    });
  }, 3000);
}

function sendUpdaterStatus(status, data = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater:status', { status, ...data });
  }
}

// IPC handlers for updater
ipc.handle('updater:check', () => {
  if (!app.isPackaged) {
    return { status: 'dev-mode' };
  }
  autoUpdater.checkForUpdates().catch((err) => {
    console.error('Manual update check failed:', err.message);
  });
  return { status: 'checking' };
});

ipc.handle('updater:download', () => {
  autoUpdater.downloadUpdate().catch((err) => {
    console.error('Download update failed:', err.message);
  });
  return { status: 'downloading' };
});

ipc.handle('updater:install', () => {
  autoUpdater.quitAndInstall(false, true);
});

// App lifecycle
app.whenReady().then(() => {
  credentialSettings.migrate();
  createWindow();
  setupAutoUpdater();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
