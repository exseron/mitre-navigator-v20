'use strict';

const { app, screen } = require('electron');
const fs = require('fs');
const path = require('path');

/**
 * Pencere boyutunu, konumunu ve büyütülmüş durumunu oturumlar arasında saklar.
 * Kayıtlı konum artık bağlı olmayan bir ekrandaysa varsayılan konuma dönülür.
 */
function windowState(defaults) {
  const file = path.join(app.getPath('userData'), 'window-state.json');
  let state = { ...defaults };
  try {
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (saved && saved.width && saved.height) state = { ...state, ...saved };
  } catch (_) {
    /* ilk çalıştırma */
  }

  if (state.x !== undefined && state.y !== undefined) {
    const area = screen.getDisplayMatching(state).workArea;
    const visible =
      state.x < area.x + area.width - 100 && state.x + state.width > area.x + 100 && state.y >= area.y - 10 && state.y < area.y + area.height - 100;
    if (!visible) {
      delete state.x;
      delete state.y;
    }
  }

  function track(win) {
    const save = () => {
      if (win.isDestroyed()) return;
      const maximized = win.isMaximized();
      const bounds = maximized || win.isFullScreen() ? win.getNormalBounds() : win.getBounds();
      state = { ...bounds, maximized };
      try {
        fs.writeFileSync(file, JSON.stringify(state));
      } catch (_) {
        /* kayıt yapılamazsa sessizce geç */
      }
    };
    win.on('close', save);
    if (state.maximized) win.maximize();
  }

  return {
    bounds: { x: state.x, y: state.y, width: state.width, height: state.height },
    track,
  };
}

module.exports = { windowState };
