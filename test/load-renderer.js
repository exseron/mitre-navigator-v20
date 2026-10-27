'use strict';

/*
 * Renderer betiklerini (tarayıcı için yazılmış klasik scriptler) Node'da
 * çalıştırmak için küçük bir vm ortamı. DOM gerektirmeyen modüller yüklenir.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RENDERER = path.join(__dirname, '..', 'src', 'renderer');

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

function loadRenderer(scripts = ['data/attack-data.js', 'js/util.js', 'js/data.js', 'js/store.js', 'js/layer-io.js']) {
  const context = {
    console,
    setTimeout,
    clearTimeout,
    navigator: { platform: 'Test' },
    document: { getElementById: () => null },
    localStorage: memoryStorage(),
  };
  context.window = context;
  vm.createContext(context);
  for (const rel of scripts) {
    const file = path.join(RENDERER, rel);
    vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  }
  return context.TTP;
}

/** vm bağlamındaki nesneleri (farklı realm) assert.deepEqual için düz nesneye çevirir */
const plain = (value) => JSON.parse(JSON.stringify(value));

module.exports = { loadRenderer, plain };
