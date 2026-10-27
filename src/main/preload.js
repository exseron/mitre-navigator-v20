'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Renderer'a güvenli, dar kapsamlı bir masaüstü API'si açar.
 * Tarayıcıda çalışırken window.desktop tanımsızdır ve panel indirme
 * tabanlı yedek yollara düşer.
 */
contextBridge.exposeInMainWorld('desktop', {
  platform: process.platform,
  info: () => ipcRenderer.invoke('app:info'),
  saveFile: (options) => ipcRenderer.invoke('file:save', options),
  openFile: (options) => ipcRenderer.invoke('file:open', options),
  writeFile: (filePath, data) => ipcRenderer.invoke('file:write', { filePath, data }),
  reveal: (filePath) => ipcRenderer.invoke('file:reveal', filePath),
  setWindowState: (state) => ipcRenderer.send('window:state', state),
  onMenuAction: (callback) => {
    const listener = (_event, action) => callback(action);
    ipcRenderer.on('menu:action', listener);
    return () => ipcRenderer.removeListener('menu:action', listener);
  },
});
