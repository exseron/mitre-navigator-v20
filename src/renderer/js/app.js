/* Uygulama başlatma: render döngüsü, araç çubuğu, menü komutları ve kısayollar. */
(function () {
  'use strict';

  const TTP = window.TTP;
  const { data, store, files, layerIO } = TTP;
  const desktop = window.desktop || null;

  const platform = desktop ? desktop.platform : /Mac/.test(navigator.platform) ? 'darwin' : /Win/.test(navigator.platform) ? 'win32' : 'linux';
  document.body.classList.add('platform-' + platform);
  if (desktop) document.body.classList.add('is-desktop');
  document.getElementById('attack-version').textContent = 'v' + data.version;

  store.restore();

  /* --------------------------------------------------------------- render */

  const searchInput = document.getElementById('search');
  const optSubs = document.getElementById('opt-subs');
  const optAcross = document.getElementById('opt-across');

  function applyTheme() {
    const theme = store.state.ui.theme;
    if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
  }

  function syncChrome() {
    const { ui, file } = store.state;
    document.querySelectorAll('[data-view]').forEach((b) => {
      b.classList.toggle('is-active', (b.dataset.view === 'selected') === ui.onlySelected);
    });
    optSubs.checked = ui.showSubs;
    optAcross.checked = ui.across;
    if (searchInput.value !== ui.search && document.activeElement !== searchInput) searchInput.value = ui.search;
    document.querySelector('[data-action="undo"]').disabled = !store.canUndo();
    document.querySelector('[data-action="redo"]').disabled = !store.canRedo();

    const name = file.name || 'Adsız proje';
    document.getElementById('doc-name').textContent = name;
    document.getElementById('doc-dirty').classList.toggle('is-visible', file.dirty);
    const title = `${file.dirty && platform !== 'darwin' ? '• ' : ''}${name} — ATT&CK TTP Panel`;
    document.title = title;
    if (desktop) desktop.setWindowState({ title, edited: file.dirty, filePath: file.path });
  }

  function renderAll(change = {}) {
    TTP.matrix.render();
    TTP.sidebar.render(change);
    TTP.details.render(change);
    syncChrome();
  }

  store.subscribe((change) => {
    if (change.kind === 'export') return syncChrome();
    if (change.kind === 'file') return syncChrome();
    if (change.kind === 'ui') {
      if (change.keys && change.keys.includes('theme')) applyTheme();
      TTP.matrix.render();
      if (change.keys && change.keys.some((k) => k === 'focus' || k === 'focusTactic')) TTP.details.render(change);
      return syncChrome();
    }
    renderAll(change);
  });

  /* ------------------------------------------------------------- commands */

  function confirmDiscard() {
    const { file } = store.state;
    const s = store.stats();
    if (!file.dirty || (!s.techniques && !s.subs && !s.tactics)) return true;
    return confirm('Kaydedilmemiş değişiklikler var. Devam ederseniz kaybolacak. Devam edilsin mi?');
  }

  function newProject() {
    if (!confirmDiscard()) return;
    store.reset();
    TTP.toast('Yeni proje oluşturuldu.');
  }

  async function saveProject(saveAs = false) {
    const text = layerIO.serializeProject(store.state.doc);
    const { file } = store.state;
    let saved = null;
    if (!saveAs && file.path) {
      try {
        saved = await files.overwrite(file.path, text);
      } catch (_) {
        saved = null; // izin süresi dolmuş olabilir: Farklı Kaydet'e düş
      }
    }
    if (!saved) {
      const name = (file.name && file.name.replace(/\.json$/i, '')) || TTP.slugify(store.state.doc.meta.title || 'ttp-projesi');
      saved = await files.saveText(name + '.json', text, files.FILTERS.project);
    }
    if (!saved) return;
    store.setFile({ path: files.isDesktop ? saved : null, name: files.basename(saved), dirty: false });
    TTP.toast(`Proje kaydedildi: ${files.basename(saved)}`);
  }

  function loadJson(result) {
    let json;
    try {
      json = JSON.parse(result.content);
    } catch (err) {
      TTP.toast('Dosya okunamadı: geçerli bir JSON değil.', { type: 'error' });
      return;
    }
    const kind = layerIO.detect(json);
    if (kind === 'project') {
      store.load(json, { path: result.path, name: result.name });
      const s = store.stats();
      TTP.toast(`Proje açıldı: ${s.techniques + s.subs} teknik, ${s.procedures} prosedür.`);
      if (json.attackVersion && json.attackVersion !== data.version) {
        TTP.toast(`Not: proje ATT&CK v${json.attackVersion} ile kaydedilmiş, panel v${data.version} kullanıyor.`);
      }
    } else if (kind === 'layer') {
      importLayerJson(json, result.name);
    } else {
      TTP.toast('Tanınmayan dosya biçimi. TTP Panel projesi veya ATT&CK Navigator katmanı seçin.', { type: 'error' });
    }
  }

  function importLayerJson(json, name) {
    const { doc, imported, skipped } = layerIO.fromLayer(json, store.state.doc.activeColor);
    store.load(doc, { name: name ? name.replace(/\.json$/i, '') + ' (katman)' : null, dirty: true });
    store.setUi({ onlySelected: imported > 0 });
    TTP.toast(
      `Navigator katmanı içe aktarıldı: ${imported} teknik.` +
        (skipped.length ? ` ${skipped.length} tanınmayan/eskimiş ID atlandı (${skipped.slice(0, 4).join(', ')}${skipped.length > 4 ? '…' : ''}).` : ''),
      { timeout: 6000 }
    );
  }

  async function openProject() {
    if (!confirmDiscard()) return;
    const result = await files.openText(files.FILTERS.project);
    if (result) loadJson(result);
  }

  async function importLayer() {
    if (!confirmDiscard()) return;
    const result = await files.openText(files.FILTERS.layer);
    if (result) loadJson(result);
  }

  async function exportLayer() {
    const s = store.stats();
    if (!s.techniques && !s.subs) return TTP.toast('Dışa aktarılacak seçim yok.', { type: 'error' });
    const layer = layerIO.toLayer(store.state.doc);
    const name = TTP.slugify(store.state.doc.meta.title || 'attack-layer') + '-layer.json';
    const saved = await files.saveText(name, JSON.stringify(layer, null, 2), files.FILTERS.layer);
    if (saved) TTP.toast('Navigator katmanı kaydedildi. mitre-attack.github.io/attack-navigator üzerinde açabilirsiniz.');
  }

  function cycleTheme() {
    const order = ['auto', 'light', 'dark'];
    const next = order[(order.indexOf(store.state.ui.theme) + 1) % order.length];
    store.setUi({ theme: next });
    TTP.toast(`Tema: ${{ auto: 'Sistem', light: 'Açık', dark: 'Koyu' }[next]}`, { timeout: 1500 });
  }

  function isEditable(el) {
    return el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  }

  function undo() {
    if (isEditable(document.activeElement) && document.activeElement.type !== 'checkbox') document.execCommand('undo');
    else if (!store.undo()) TTP.toast('Geri alınacak işlem yok.', { timeout: 1200 });
  }

  function redo() {
    if (isEditable(document.activeElement) && document.activeElement.type !== 'checkbox') document.execCommand('redo');
    else store.redo();
  }

  const actions = {
    new: newProject,
    open: openProject,
    save: () => saveProject(false),
    saveAs: () => saveProject(true),
    importLayer,
    exportLayer,
    preview: () => TTP.exportModal.open(),
    exportPng: () => TTP.exportModal.exportPng(),
    exportSvg: () => TTP.exportModal.exportSvg(),
    undo,
    redo,
    theme: cycleTheme,
    find: () => {
      if (TTP.exportModal.isOpen()) TTP.exportModal.close();
      searchInput.focus();
      searchInput.select();
    },
    clearSelection: () => {
      store.clearSelection();
      TTP.toast('Tüm seçimler temizlendi.', { action: { label: 'Geri al', run: () => store.undo() } });
    },
    toggleOnlySelected: () => store.setUi({ onlySelected: !store.state.ui.onlySelected }),
    toggleSubs: () => store.setUi({ showSubs: !store.state.ui.showSubs, open: new Set(), closed: new Set() }),
  };

  function run(action) {
    const fn = actions[action];
    if (!fn) return;
    Promise.resolve(fn()).catch((err) => {
      console.error(err);
      TTP.toast('İşlem başarısız: ' + err.message, { type: 'error' });
    });
  }

  /* --------------------------------------------------------------- events */

  document.getElementById('titlebar').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (btn) run(btn.dataset.action);
  });

  document.querySelectorAll('[data-view]').forEach((b) =>
    b.addEventListener('click', () => store.setUi({ onlySelected: b.dataset.view === 'selected' }))
  );
  optSubs.addEventListener('change', () => store.setUi({ showSubs: optSubs.checked, open: new Set(), closed: new Set() }));
  optAcross.addEventListener('change', () => store.setUi({ across: optAcross.checked }));

  const applySearch = TTP.debounce(() => store.setUi({ search: searchInput.value }, 'search'), 120);
  searchInput.addEventListener('input', applySearch);
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      store.setUi({ search: '' });
      searchInput.blur();
    }
  });

  if (desktop) {
    desktop.onMenuAction(run);
    // Finder'da "Birlikte Aç", Dock'a sürükleme ya da Windows'ta "Birlikte aç" ile gelen dosyalar
    desktop.onFileOpened((file) => {
      if (confirmDiscard()) loadJson(file);
    });
  }

  // Tarayıcıda menü yoktur; kısayollar burada yakalanır
  const SHORTCUTS = {
    n: 'new',
    o: 'open',
    s: 'save',
    S: 'saveAs',
    i: 'importLayer',
    e: 'preview',
    E: 'exportSvg',
    P: 'exportPng',
    f: 'find',
    l: 'toggleOnlySelected',
    b: 'toggleSubs',
    z: 'undo',
    Z: 'redo',
    y: 'redo',
  };

  document.addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && !desktop) {
      const key = e.shiftKey ? e.key.toUpperCase() : e.key.toLowerCase();
      const action = SHORTCUTS[key];
      if (action) {
        e.preventDefault();
        run(action);
        return;
      }
    }
    if (e.key === 'Escape') {
      if (TTP.exportModal.isOpen()) TTP.exportModal.close();
      else if (store.state.ui.focus && !isEditable(document.activeElement)) store.setUi({ focus: null });
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && !mod && !isEditable(document.activeElement)) {
      const tid = store.state.ui.focus;
      if (tid && store.isSelected(tid) && !TTP.exportModal.isOpen()) {
        e.preventDefault();
        store.setTechniqueTactics(tid, []);
      }
    }
  });

  // Dosyayı pencereye sürükleyip bırakarak açma (proje veya Navigator katmanı)
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer && e.dataTransfer.files[0];
    if (!file || !/\.json$/i.test(file.name)) return;
    if (!confirmDiscard()) return;
    const reader = new FileReader();
    reader.onload = () => loadJson({ path: null, name: file.name, content: String(reader.result) });
    reader.readAsText(file);
  });

  /* ---------------------------------------------------------------- start */

  applyTheme();
  renderAll();
  if (desktop) desktop.ready();

  TTP.app = { run, platform };
})();
