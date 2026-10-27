'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell, nativeTheme } = require('electron');
const fs = require('fs');
const path = require('path');
const { buildMenu } = require('./menu');

const IS_MAC = process.platform === 'darwin';
const IS_WIN = process.platform === 'win32';

if (IS_WIN) app.setAppUserModelId('com.exseron.attack-ttp-panel');

/** @type {BrowserWindow | null} */
let mainWindow = null;

function platformWindowOptions() {
  if (IS_MAC) {
    // macOS: entegre başlık çubuğu, trafik ışıkları araç çubuğunun içinde
    return {
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 16, y: 17 },
    };
  }
  if (IS_WIN) {
    // Windows 10/11: özel başlık çubuğu + yerel pencere düğmeleri (overlay)
    return {
      titleBarStyle: 'hidden',
      titleBarOverlay: overlayColors(),
    };
  }
  return {};
}

function overlayColors() {
  const dark = nativeTheme.shouldUseDarkColors;
  return {
    color: dark ? '#141821' : '#f4f6fa',
    symbolColor: dark ? '#e6e9f0' : '#1c2333',
    height: 52,
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1520,
    height: 940,
    minWidth: 1080,
    minHeight: 680,
    show: false,
    title: 'ATT&CK TTP Panel',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0f1218' : '#f4f6fa',
    icon: path.join(__dirname, '..', '..', 'build', IS_WIN ? 'icon.ico' : 'icon.png'),
    ...platformWindowOptions(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Uygulama içinden dış bağlantılar varsayılan tarayıcıda açılır
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow.webContents.getURL()) {
      event.preventDefault();
      if (/^https?:\/\//.test(url)) shell.openExternal(url);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function sendMenuAction(action) {
  const win = BrowserWindow.getFocusedWindow() || mainWindow;
  if (win) win.webContents.send('menu:action', action);
}

/* ------------------------------------------------------------------ IPC */

// Yalnızca kullanıcının diyalogla seçtiği yollara doğrudan yazılabilir
const approvedPaths = new Set();

ipcMain.handle('app:info', () => ({
  platform: process.platform,
  version: app.getVersion(),
  electron: process.versions.electron,
}));

ipcMain.handle('file:save', async (event, { defaultPath, filters, data, encoding }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    defaultPath: path.join(app.getPath('documents'), defaultPath || 'export'),
    filters,
  });
  if (canceled || !filePath) return null;
  const buffer = encoding === 'base64' ? Buffer.from(data, 'base64') : Buffer.from(data, 'utf8');
  await fs.promises.writeFile(filePath, buffer);
  approvedPaths.add(filePath);
  return filePath;
});

ipcMain.handle('file:write', async (_event, { filePath, data }) => {
  if (!approvedPaths.has(filePath)) throw new Error('Bu dosyaya yazma izni yok');
  await fs.promises.writeFile(filePath, data, 'utf8');
  return filePath;
});

ipcMain.handle('file:open', async (event, { filters }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters,
  });
  if (canceled || !filePaths.length) return null;
  const content = await fs.promises.readFile(filePaths[0], 'utf8');
  approvedPaths.add(filePaths[0]);
  return { path: filePaths[0], name: path.basename(filePaths[0]), content };
});

ipcMain.handle('file:reveal', (_event, filePath) => {
  if (filePath) shell.showItemInFolder(filePath);
});

ipcMain.on('window:state', (event, { title, edited, filePath }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  if (title) win.setTitle(title);
  if (IS_MAC) {
    win.setDocumentEdited(!!edited);
    win.setRepresentedFilename(filePath || '');
  }
});

nativeTheme.on('updated', () => {
  if (IS_WIN && mainWindow) mainWindow.setTitleBarOverlay(overlayColors());
});

/* ------------------------------------------------------------ lifecycle */

app.whenReady().then(() => {
  buildMenu({ isMac: IS_MAC, send: sendMenuAction });
  createWindow();

  app.on('activate', () => {
    // macOS: Dock simgesine tıklanınca pencereyi yeniden aç
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // macOS'ta uygulama Cmd+Q ile kapanana kadar açık kalır
  if (!IS_MAC) app.quit();
});
