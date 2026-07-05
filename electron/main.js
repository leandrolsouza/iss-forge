const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const { autoUpdater } = require('electron-updater');
const Store = require('electron-store');
const path = require('path');
const fs = require('fs');
const {
  getProvider,
  getEffectiveEndpoint,
  buildHeaders,
  buildRequestBody,
  parseResponse,
  parseStreamChunk,
} = require('./aiProviders');

// --- App Settings (electron-store) ---
const settingsStore = new Store({
  name: 'app-settings',
  defaults: {
    confirmBeforeSave: true,
    autoBackupBeforeSave: true,
    defaultExportPath: '',
    aiEnabled: true,
    aiProvider: 'openai-compatible',
    aiEndpoint: 'http://localhost:1234/v1/chat/completions',
    aiModel: '',
    aiApiKey: '',
    aiTemperature: 0.7,
    aiMaxTokens: 4096,
    aiRegion: 'us-east-1',
  },
});

let mainWindow;
let currentRomPath = null;
let isRomModified = false;
let forceQuit = false;
let currentLocale = 'pt-BR';

// Translations for native dialogs (main process has no access to React i18n)
const dialogI18n = {
  'pt-BR': {
    title: 'Alteracoes nao salvas',
    message: 'A ROM possui alteracoes nao salvas. Deseja salvar antes de sair?',
    buttons: ['Salvar', 'Nao Salvar', 'Cancelar'],
  },
  en: {
    title: 'Unsaved Changes',
    message: 'The ROM has unsaved changes. Do you want to save before quitting?',
    buttons: ['Save', "Don't Save", 'Cancel'],
  },
};

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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: '#1e1e1e',
    icon: path.join(__dirname, '..', 'public', 'icon.ico'),
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#323233',
      symbolColor: '#cccccc',
      height: 32,
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
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
  const template = [
    {
      label: 'Arquivo',
      submenu: [
        {
          label: 'Abrir ROM...',
          accelerator: 'CmdOrCtrl+O',
          click: () => handleOpenRom(),
        },
        {
          label: 'Salvar ROM',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow.webContents.send('menu:save'),
        },
        {
          label: 'Salvar ROM Como...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => handleSaveRomAs(),
        },
        { type: 'separator' },
        {
          label: 'Sair',
          accelerator: 'CmdOrCtrl+Q',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: 'Editar',
      submenu: [
        {
          label: 'Desfazer',
          accelerator: 'CmdOrCtrl+Z',
          click: () => mainWindow.webContents.send('menu:undo'),
        },
        {
          label: 'Refazer',
          accelerator: 'CmdOrCtrl+Y',
          click: () => mainWindow.webContents.send('menu:redo'),
        },
        { type: 'separator' },
        { label: 'Copiar', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Colar', accelerator: 'CmdOrCtrl+V', role: 'paste' },
      ],
    },
    {
      label: 'Visualizar',
      submenu: [
        { label: 'Recarregar', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: 'DevTools', accelerator: 'F12', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: 'Zoom +', accelerator: 'CmdOrCtrl+=', role: 'zoomIn' },
        { label: 'Zoom -', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { label: 'Zoom Reset', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
      ],
    },
    {
      label: 'Ajuda',
      submenu: [
        {
          label: 'Sobre ISS Forge',
          click: () => {
            mainWindow.webContents.send('menu:about');
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
    title: 'Abrir ROM do ISS',
    filters: [
      { name: 'ROM SNES', extensions: ['smc', 'sfc', 'bin'] },
      { name: 'Todos os Arquivos', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    loadAndSendRom(filePath);
  } else {
    mainWindow.webContents.send('rom:loadCancelled');
  }
}

function loadAndSendRom(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    currentRomPath = filePath;
    addRecentRom(filePath);
    mainWindow.webContents.send('rom:loaded', {
      path: filePath,
      name: path.basename(filePath),
      data: Array.from(buffer),
    });
  } catch (err) {
    dialog.showErrorBox('Erro ao abrir ROM', err.message);
  }
}

async function handleSaveRomAs() {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Salvar ROM Como',
    defaultPath: currentRomPath || 'ISS_Modified.smc',
    filters: [
      { name: 'ROM SNES', extensions: ['smc', 'sfc'] },
      { name: 'Todos os Arquivos', extensions: ['*'] },
    ],
  });

  if (!result.canceled && result.filePath) {
    mainWindow.webContents.send('rom:save-as-path', result.filePath);
  }
}

// IPC Handlers
ipcMain.handle('dialog:openRom', handleOpenRom);

ipcMain.handle('dialog:saveRomAs', handleSaveRomAs);

ipcMain.handle('rom:save', async (event, { data, filePath }) => {
  try {
    const savePath = filePath || currentRomPath;
    if (!savePath) {
      return { success: false, error: 'Nenhum caminho definido para salvar.' };
    }
    const buffer = Buffer.from(data);
    fs.writeFileSync(savePath, buffer);
    currentRomPath = savePath;
    return { success: true, path: savePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('rom:getCurrentPath', () => currentRomPath);

// Track modified state from renderer (for close guard)
ipcMain.on('rom:modifiedState', (event, isModified) => {
  isRomModified = isModified;
});

// Track locale from renderer (for native dialog i18n)
ipcMain.on('app:setLocale', (event, locale) => {
  currentLocale = locale;
});

// Handle close response from renderer custom modal
// choice: 'save' | 'discard' | 'cancel'
ipcMain.on('app:closeResponse', (event, choice) => {
  if (choice === 'save') {
    mainWindow.webContents.send('menu:save');
    ipcMain.once('rom:saveComplete', () => {
      forceQuit = true;
      mainWindow.close();
    });
  } else if (choice === 'discard') {
    forceQuit = true;
    mainWindow.close();
  }
  // 'cancel': do nothing, window stays open
});

ipcMain.handle('recent:getAll', () => {
  return loadRecentRoms();
});

ipcMain.handle('recent:clear', () => {
  saveRecentRoms([]);
  return { success: true };
});

ipcMain.handle('recent:remove', (event, filePath) => {
  const recents = loadRecentRoms().filter((r) => r.path !== filePath);
  saveRecentRoms(recents);
  return { success: true };
});

ipcMain.handle('recent:open', (event, filePath) => {
  if (fs.existsSync(filePath)) {
    loadAndSendRom(filePath);
    return { success: true };
  }
  // File no longer exists — remove from recents
  const recents = loadRecentRoms().filter((r) => r.path !== filePath);
  saveRecentRoms(recents);
  return { success: false, error: 'Arquivo nao encontrado.' };
});

// --- Auto-Save / Backup ---
const BACKUP_FILENAME = 'autosave-backup.bin';
const BACKUP_META_FILENAME = 'autosave-meta.json';

function getBackupPath() {
  return path.join(app.getPath('userData'), BACKUP_FILENAME);
}

function getBackupMetaPath() {
  return path.join(app.getPath('userData'), BACKUP_META_FILENAME);
}

ipcMain.handle('backup:save', (event, { data, meta }) => {
  try {
    const buffer = Buffer.from(data);
    fs.writeFileSync(getBackupPath(), buffer);
    fs.writeFileSync(getBackupMetaPath(), JSON.stringify(meta, null, 2), 'utf-8');
    return { success: true, timestamp: Date.now() };
  } catch (err) {
    console.error('Auto-save backup failed:', err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('backup:load', () => {
  try {
    const backupPath = getBackupPath();
    const metaPath = getBackupMetaPath();
    if (!fs.existsSync(backupPath) || !fs.existsSync(metaPath)) {
      return { exists: false };
    }
    const buffer = fs.readFileSync(backupPath);
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    return {
      exists: true,
      data: Array.from(buffer),
      meta,
    };
  } catch (err) {
    console.error('Failed to load backup:', err.message);
    return { exists: false, error: err.message };
  }
});

ipcMain.handle('backup:clear', () => {
  try {
    const backupPath = getBackupPath();
    const metaPath = getBackupMetaPath();
    if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
    if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
    return { success: true };
  } catch (err) {
    console.error('Failed to clear backup:', err.message);
    return { success: false, error: err.message };
  }
});

// --- App Settings ---
ipcMain.handle('settings:getAll', () => {
  return settingsStore.store;
});

ipcMain.handle('settings:get', (event, key) => {
  return settingsStore.get(key);
});

ipcMain.handle('settings:set', (event, { key, value }) => {
  try {
    settingsStore.set(key, value);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('settings:setAll', (event, settings) => {
  try {
    Object.entries(settings).forEach(([key, value]) => {
      settingsStore.set(key, value);
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('settings:selectExportPath', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return { success: true, path: result.filePaths[0] };
  }
  return { success: false };
});

// --- AI Team Generator ---
const AI_SETTINGS_FILENAME = 'ai-settings.json';

function getAiSettingsPath() {
  return path.join(app.getPath('userData'), AI_SETTINGS_FILENAME);
}

function loadAiSettings() {
  // Read from unified settings store
  return {
    provider: settingsStore.get('aiProvider'),
    endpoint: settingsStore.get('aiEndpoint'),
    model: settingsStore.get('aiModel'),
    apiKey: settingsStore.get('aiApiKey'),
    temperature: settingsStore.get('aiTemperature'),
    maxTokens: settingsStore.get('aiMaxTokens'),
  };
}

function saveAiSettings(settings) {
  try {
    // Write to unified settings store
    if (settings.provider !== undefined) settingsStore.set('aiProvider', settings.provider);
    if (settings.endpoint !== undefined) settingsStore.set('aiEndpoint', settings.endpoint);
    if (settings.model !== undefined) settingsStore.set('aiModel', settings.model);
    if (settings.apiKey !== undefined) settingsStore.set('aiApiKey', settings.apiKey);
    if (settings.temperature !== undefined) settingsStore.set('aiTemperature', settings.temperature);
    if (settings.maxTokens !== undefined) settingsStore.set('aiMaxTokens', settings.maxTokens);
    return { success: true };
  } catch (err) {
    console.error('Failed to save AI settings:', err.message);
    return { success: false, error: err.message };
  }
}

ipcMain.handle('ai:getSettings', () => {
  return loadAiSettings();
});

ipcMain.handle('ai:saveSettings', (event, settings) => {
  return saveAiSettings(settings);
});

ipcMain.handle('ai:testConnection', async (event, { settings }) => {
  const config = settings || loadAiSettings();
  const providerId = config.provider || settingsStore.get('aiProvider') || 'openai-compatible';
  const provider = getProvider(providerId);
  const endpoint = getEffectiveEndpoint(provider, config.endpoint, config.model);

  const headers = buildHeaders(provider, config.apiKey);
  const body = buildRequestBody({
    format: provider.format,
    systemPrompt: 'You are a helpful assistant.',
    userPrompt: 'Say "OK" and nothing else.',
    model: config.model,
    temperature: 0.1,
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
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      return {
        success: false,
        error: `API error ${response.status}: ${errorText || response.statusText}`,
      };
    }

    const data = await response.json();
    const result = parseResponse(data, provider.format);

    if (result.error) {
      return { success: false, error: result.error };
    }

    return { success: true, content: result.content };
  } catch (err) {
    if (err.name === 'TimeoutError') {
      return { success: false, error: `Connection timed out (30s). Is ${endpoint} reachable?` };
    }
    if (err.code === 'ECONNREFUSED') {
      return { success: false, error: `Connection refused at ${endpoint}.` };
    }
    return { success: false, error: err.message };
  }
});

ipcMain.handle('ai:generate', async (event, { prompt, systemPrompt, settings }) => {
  const config = settings || loadAiSettings();
  const providerId = config.provider || settingsStore.get('aiProvider') || 'openai-compatible';
  const provider = getProvider(providerId);
  const endpoint = getEffectiveEndpoint(provider, config.endpoint, config.model);

  const headers = buildHeaders(provider, config.apiKey);
  const body = buildRequestBody({
    format: provider.format,
    systemPrompt,
    userPrompt: prompt,
    model: config.model,
    temperature: config.temperature || 0.7,
    maxTokens: config.maxTokens || 4096,
    stream: false,
  });

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000), // 2 minute timeout for LLM
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      return {
        success: false,
        error: `API error ${response.status}: ${errorText || response.statusText}`,
      };
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
    };
  } catch (err) {
    if (err.name === 'TimeoutError') {
      return { success: false, error: `Request timed out (2 min). Is the ${provider.id} API reachable?` };
    }
    if (err.code === 'ECONNREFUSED') {
      return {
        success: false,
        error: `Connection refused at ${endpoint}. Check your settings.`,
      };
    }
    return { success: false, error: err.message };
  }
});

// AI streaming generation — sends chunks back to renderer via events
ipcMain.handle('ai:generate-stream', async (event, { prompt, systemPrompt, settings }) => {
  const config = settings || loadAiSettings();
  const sender = event.sender;
  const providerId = config.provider || settingsStore.get('aiProvider') || 'openai-compatible';
  const provider = getProvider(providerId);

  // Bedrock Converse API uses AWS Event Stream binary protocol for streaming
  if (provider.format === 'bedrock') {
    const endpoint = getEffectiveEndpoint(provider, config.endpoint, config.model, true);
    const headers = buildHeaders(provider, config.apiKey);
    const body = buildRequestBody({
      format: provider.format,
      systemPrompt,
      userPrompt: prompt,
      model: config.model,
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 4096,
      stream: false,
    });

    try {
      console.log('[Bedrock Stream] Requesting:', endpoint);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(180000),
      });

      console.log('[Bedrock Stream] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.log('[Bedrock Stream] Error:', errorText);
        sender.send('ai:stream-error', `API error ${response.status}: ${errorText || response.statusText}`);
        return { success: false };
      }

      // Parse AWS Event Stream binary protocol
      const reader = response.body.getReader();
      let eventBuffer = Buffer.alloc(0);
      let chunkCount = 0;
      let parsedCount = 0;
      let errorCount = 0;
      let sentChunks = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('[Bedrock Stream] Done. chunks:', chunkCount, 'parsed:', parsedCount, 'errors:', errorCount, 'sent:', sentChunks);
          break;
        }

        chunkCount++;
        eventBuffer = Buffer.concat([eventBuffer, Buffer.from(value)]);

        // Process complete messages from the buffer
        // AWS Event Stream: each message starts with [4B total_len][4B header_len][4B prelude_crc]
        while (eventBuffer.length >= 12) {
          const totalLength = eventBuffer.readUInt32BE(0);
          if (totalLength < 16 || totalLength > 1048576) {
            eventBuffer = eventBuffer.slice(1);
            continue;
          }
          if (eventBuffer.length < totalLength) break;

          const frame = eventBuffer.slice(0, totalLength);
          eventBuffer = eventBuffer.slice(totalLength);

          // Extract payload using header length from prelude
          const headerLength = frame.readUInt32BE(4);
          const payloadStart = 12 + headerLength;
          const payloadEnd = totalLength - 4;

          if (payloadStart >= payloadEnd) continue;

          const payloadBytes = frame.slice(payloadStart, payloadEnd);
          let jsonStr = payloadBytes.toString('utf-8');

          // Trim any trailing null bytes or garbage
          const lastBrace = jsonStr.lastIndexOf('}');
          if (lastBrace >= 0) {
            jsonStr = jsonStr.substring(0, lastBrace + 1);
          }

          try {
            const evt = JSON.parse(jsonStr);
            parsedCount++;
            if (parsedCount <= 3) {
              console.log('[Bedrock Stream] Event keys:', Object.keys(evt), 'sample:', JSON.stringify(evt).substring(0, 150));
            }

            // Bedrock HTTP stream: flat structure {delta:{text}, contentBlockIndex} or {stopReason}
            if (evt.delta && evt.delta.text) {
              sentChunks++;
              sender.send('ai:stream-chunk', evt.delta.text);
            } else if (evt.stopReason || evt.messageStop) {
              console.log('[Bedrock Stream] messageStop. parsed:', parsedCount, 'sent:', sentChunks);
              sender.send('ai:stream-done');
              return { success: true };
            }
          } catch (_e) {
            errorCount++;
            if (errorCount <= 3) {
              console.log('[Bedrock Stream] Parse error on frame, payload preview:', jsonStr.substring(0, 80));
            }
          }
        }
      }

      sender.send('ai:stream-done');
      return { success: true };
    } catch (err) {
      sender.send('ai:stream-error', err.message || 'Bedrock stream failed');
      return { success: false };
    }
  }

  const endpoint = getEffectiveEndpoint(provider, config.endpoint, config.model, true);

  const headers = buildHeaders(provider, config.apiKey);
  const body = buildRequestBody({
    format: provider.format,
    systemPrompt,
    userPrompt: prompt,
    model: config.model,
    temperature: config.temperature || 0.7,
    maxTokens: config.maxTokens || 4096,
    stream: true,
  });

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(180000), // 3 min timeout for streaming
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      sender.send(
        'ai:stream-error',
        `API error ${response.status}: ${errorText || response.statusText}`,
      );
      return { success: false };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      // Keep last incomplete line in buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Handle SSE "event:" lines for Anthropic
        if (trimmed.startsWith('event:')) continue;

        if (!trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();

        const chunk = parseStreamChunk(data, provider.format);
        if (chunk.done) {
          sender.send('ai:stream-done');
          return { success: true };
        }
        if (chunk.content) {
          sender.send('ai:stream-chunk', chunk.content);
        }
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      const trimmed = buffer.trim();
      if (trimmed.startsWith('data:')) {
        const data = trimmed.slice(5).trim();
        const chunk = parseStreamChunk(data, provider.format);
        if (chunk.content) {
          sender.send('ai:stream-chunk', chunk.content);
        }
      }
    }

    sender.send('ai:stream-done');
    return { success: true };
  } catch (err) {
    let errorMsg = err.message;
    if (err.name === 'TimeoutError') {
      errorMsg = `Request timed out (3 min). Is the ${provider.id} API reachable?`;
    } else if (err.code === 'ECONNREFUSED') {
      errorMsg = `Connection refused at ${endpoint}. Check your settings.`;
    }
    sender.send('ai:stream-error', errorMsg);
    return { success: false };
  }
});

// --- Auto-Updater ---
function setupAutoUpdater() {
  // Don't check for updates in development
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

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
ipcMain.handle('updater:check', () => {
  if (!app.isPackaged) {
    return { status: 'dev-mode' };
  }
  autoUpdater.checkForUpdates().catch((err) => {
    console.error('Manual update check failed:', err.message);
  });
  return { status: 'checking' };
});

ipcMain.handle('updater:download', () => {
  autoUpdater.downloadUpdate().catch((err) => {
    console.error('Download update failed:', err.message);
  });
  return { status: 'downloading' };
});

ipcMain.handle('updater:install', () => {
  autoUpdater.quitAndInstall(false, true);
});

// App lifecycle
app.whenReady().then(() => {
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
