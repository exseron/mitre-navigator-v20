'use strict';

const { Menu, app, shell } = require('electron');

/**
 * Platforma uygun uygulama menüsünü kurar. Menü komutları renderer'a
 * "menu:action" kanalıyla iletilir; kısayollar macOS'ta Cmd, Windows'ta Ctrl.
 */
function buildMenu({ isMac, send }) {
  const item = (label, action, accelerator) => ({ label, accelerator, click: () => send(action) });

  const fileMenu = {
    label: 'Dosya',
    submenu: [
      item('Yeni Proje', 'new', 'CmdOrCtrl+N'),
      item('Proje Aç…', 'open', 'CmdOrCtrl+O'),
      item('Kaydet', 'save', 'CmdOrCtrl+S'),
      item('Farklı Kaydet…', 'saveAs', 'CmdOrCtrl+Shift+S'),
      { type: 'separator' },
      item('ATT&CK Navigator Katmanı İçe Aktar…', 'importLayer', 'CmdOrCtrl+I'),
      item('ATT&CK Navigator Katmanı Dışa Aktar…', 'exportLayer'),
      { type: 'separator' },
      item('Görsel Önizleme / Dışa Aktar…', 'preview', 'CmdOrCtrl+E'),
      item('PNG Olarak Kaydet…', 'exportPng', 'CmdOrCtrl+Shift+P'),
      item('SVG (Vektörel) Olarak Kaydet…', 'exportSvg', 'CmdOrCtrl+Shift+E'),
      ...(isMac ? [] : [{ type: 'separator' }, { role: 'quit', label: 'Çıkış' }]),
    ],
  };

  const editMenu = {
    label: 'Düzen',
    submenu: [
      // Metin alanında metin geri alınır, aksi halde seçim geçmişi (renderer karar verir)
      item('Geri Al', 'undo', 'CmdOrCtrl+Z'),
      item('Yinele', 'redo', isMac ? 'Shift+Cmd+Z' : 'Ctrl+Y'),
      { type: 'separator' },
      { role: 'cut', label: 'Kes' },
      { role: 'copy', label: 'Kopyala' },
      { role: 'paste', label: 'Yapıştır' },
      { role: 'selectAll', label: 'Tümünü Seç' },
      { type: 'separator' },
      item('Ara', 'find', 'CmdOrCtrl+F'),
      item('Tüm Seçimleri Temizle', 'clearSelection', 'CmdOrCtrl+Shift+Backspace'),
    ],
  };

  const viewMenu = {
    label: 'Görünüm',
    submenu: [
      item('Sadece Seçilenleri Göster', 'toggleOnlySelected', 'CmdOrCtrl+L'),
      item('Alt Teknikleri Aç/Kapat', 'toggleSubs', 'CmdOrCtrl+B'),
      { type: 'separator' },
      { role: 'resetZoom', label: 'Gerçek Boyut' },
      { role: 'zoomIn', label: 'Yakınlaştır' },
      { role: 'zoomOut', label: 'Uzaklaştır' },
      { type: 'separator' },
      { role: 'togglefullscreen', label: 'Tam Ekran' },
      { role: 'toggleDevTools', label: 'Geliştirici Araçları' },
    ],
  };

  const windowMenu = isMac
    ? { role: 'windowMenu', label: 'Pencere' }
    : { label: 'Pencere', submenu: [{ role: 'minimize', label: 'Simge Durumuna Küçült' }, { role: 'close', label: 'Kapat' }] };

  const helpMenu = {
    role: 'help',
    label: 'Yardım',
    submenu: [
      { label: 'MITRE ATT&CK', click: () => shell.openExternal('https://attack.mitre.org/') },
      { label: 'ATT&CK Navigator', click: () => shell.openExternal('https://mitre-attack.github.io/attack-navigator/') },
      { label: 'Proje Sayfası (GitHub)', click: () => shell.openExternal('https://github.com/exseron/mitre-navigator-v20') },
    ],
  };

  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about', label: `${app.name} Hakkında` },
              { type: 'separator' },
              { role: 'services', label: 'Servisler' },
              { type: 'separator' },
              { role: 'hide', label: `${app.name} Gizle` },
              { role: 'hideOthers', label: 'Diğerlerini Gizle' },
              { role: 'unhide', label: 'Tümünü Göster' },
              { type: 'separator' },
              { role: 'quit', label: `${app.name} Çık` },
            ],
          },
        ]
      : []),
    fileMenu,
    editMenu,
    viewMenu,
    windowMenu,
    helpMenu,
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

module.exports = { buildMenu };
