const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let currentRomPath = null;

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
        { label: 'Desfazer', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Refazer', accelerator: 'CmdOrCtrl+Y', role: 'redo' },
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

// App lifecycle
app.whenReady().then(createWindow);

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
