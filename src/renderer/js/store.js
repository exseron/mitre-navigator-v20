/*
 * Uygulama durumu.
 *   doc: kaydedilen proje (meta, lejant, seçimler, prosedürler, dışa aktarma ayarları)
 *   ui : geçici görünüm durumu (odak, arama, filtreler)
 * Tüm doc değişiklikleri commit() üzerinden geçer: geri al/yinele geçmişi,
 * otomatik kayıt ve abonelere bildirim burada yönetilir.
 */
(function () {
  'use strict';

  const TTP = window.TTP;
  const { data } = TTP;

  const AUTOSAVE_KEY = 'ttp-panel:autosave:v1';
  const UI_KEY = 'ttp-panel:ui:v1';
  const HISTORY_LIMIT = 150;

  const PALETTE = [
    '#e5484d', '#f76b15', '#f5a524', '#ffe629', '#46a758', '#12a594', '#0090ff', '#3e63dd',
    '#8e4ec6', '#d6409f', '#a18072', '#687076', '#1c2333', '#b0b8c4', '#fbd5d5',
  ];

  const DEFAULT_EXPORT = {
    layout: 'matrix', // matrix | flow
    theme: 'light', // light | dark
    showProcedures: true,
    showProcedureSource: true,
    showIds: true,
    showKillChain: true,
    showLegend: true,
    showHeader: true,
    showFooter: true,
    showEmptyTactics: false,
    showDescriptions: false,
    columnWidth: 260,
    pngScale: 2,
    transparent: false,
  };

  function emptyDoc() {
    return {
      format: 'attack-ttp-panel',
      formatVersion: 1,
      attackVersion: data.version,
      meta: { title: '', subtitle: '', description: '', author: '' },
      legend: [
        { id: TTP.uid(), color: '#e5484d', label: 'Gözlemlendi (yüksek güven)' },
        { id: TTP.uid(), color: '#f5a524', label: 'Şüpheli (orta güven)' },
      ],
      activeColor: '#e5484d',
      tactics: {},
      items: {},
      exportOptions: { ...DEFAULT_EXPORT },
    };
  }

  const listeners = new Set();
  const state = {
    doc: emptyDoc(),
    ui: {
      focus: null, // odaktaki teknik ID
      focusTactic: null, // odağın tıklandığı taktik sütunu
      search: '',
      onlySelected: false,
      showSubs: false,
      across: false,
      open: new Set(), // elle açılmış alt teknik listeleri
      closed: new Set(), // elle kapatılmış alt teknik listeleri
      theme: 'auto',
    },
    file: { path: null, name: null, dirty: false },
  };

  const history = { past: [], future: [], lastKey: null, lastTime: 0 };

  /* ------------------------------------------------------------- plumbing */

  function emit(change) {
    for (const fn of listeners) {
      try {
        fn(change);
      } catch (err) {
        console.error(err);
      }
    }
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  const snapshot = () => JSON.stringify(state.doc);

  /**
   * Doc üzerinde değişiklik yapar.
   * @param {(doc) => void} mutate
   * @param {{source?: string, coalesce?: string, kind?: string}} opts
   *   coalesce: aynı anahtarla art arda gelen (ör. yazma) değişiklikler tek geri alma adımıdır
   */
  function commit(mutate, opts = {}) {
    const before = snapshot();
    mutate(state.doc);
    const after = snapshot();
    if (before === after) return false;

    const now = Date.now();
    const merge = opts.coalesce && opts.coalesce === history.lastKey && now - history.lastTime < 1200;
    if (!merge) {
      history.past.push(before);
      if (history.past.length > HISTORY_LIMIT) history.past.shift();
    }
    history.future = [];
    history.lastKey = opts.coalesce || null;
    history.lastTime = now;

    state.file.dirty = true;
    scheduleAutosave();
    emit({ kind: opts.kind || 'doc', source: opts.source || null });
    return true;
  }

  function undo() {
    if (!history.past.length) return false;
    history.future.push(snapshot());
    state.doc = JSON.parse(history.past.pop());
    history.lastKey = null;
    state.file.dirty = true;
    scheduleAutosave();
    emit({ kind: 'doc', source: 'history' });
    return true;
  }

  function redo() {
    if (!history.future.length) return false;
    history.past.push(snapshot());
    state.doc = JSON.parse(history.future.pop());
    history.lastKey = null;
    state.file.dirty = true;
    scheduleAutosave();
    emit({ kind: 'doc', source: 'history' });
    return true;
  }

  function setUi(patch, source) {
    Object.assign(state.ui, patch);
    persistUi();
    emit({ kind: 'ui', source: source || null, keys: Object.keys(patch) });
  }

  function setFile(patch) {
    Object.assign(state.file, patch);
    emit({ kind: 'file' });
  }

  /* ------------------------------------------------------------- autosave */

  const scheduleAutosave = TTP.debounce(() => {
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ doc: state.doc, file: state.file }));
    } catch (err) {
      console.warn('Otomatik kayıt başarısız', err);
    }
  }, 400);

  function persistUi() {
    try {
      const { onlySelected, showSubs, across, theme } = state.ui;
      localStorage.setItem(UI_KEY, JSON.stringify({ onlySelected, showSubs, across, theme }));
    } catch (_) {
      /* yoksay */
    }
  }

  function restore() {
    try {
      const ui = JSON.parse(localStorage.getItem(UI_KEY) || 'null');
      if (ui) Object.assign(state.ui, ui);
      const saved = JSON.parse(localStorage.getItem(AUTOSAVE_KEY) || 'null');
      if (saved && saved.doc) {
        state.doc = normalizeDoc(saved.doc);
        Object.assign(state.file, saved.file || {});
      }
    } catch (err) {
      console.warn('Otomatik kayıt geri yüklenemedi', err);
    }
  }

  /* -------------------------------------------------------- normalization */

  /** Dışarıdan gelen proje verisini doğrular ve eksik alanları tamamlar. */
  function normalizeDoc(input) {
    const doc = emptyDoc();
    if (!input || typeof input !== 'object') return doc;
    doc.meta = { ...doc.meta, ...(input.meta || {}) };
    if (Array.isArray(input.legend)) {
      doc.legend = input.legend
        .filter((l) => l && l.color)
        .map((l) => ({ id: l.id || TTP.uid(), color: TTP.normalizeHex(l.color), label: String(l.label || '') }));
    }
    doc.activeColor = TTP.normalizeHex(input.activeColor, doc.activeColor);
    doc.exportOptions = { ...DEFAULT_EXPORT, ...(input.exportOptions || {}) };

    for (const [short, t] of Object.entries(input.tactics || {})) {
      if (data.tacticByShort.has(short)) doc.tactics[short] = { color: TTP.normalizeHex(t && t.color) };
    }
    for (const [tid, item] of Object.entries(input.items || {})) {
      if (!data.techById.has(tid) || !item) continue;
      const valid = new Set(data.tacticsOf(tid));
      doc.items[tid] = {
        color: TTP.normalizeHex(item.color, doc.activeColor),
        tactics: (item.tactics || []).filter((s) => valid.has(s)),
        procedures: (item.procedures || [])
          .filter((p) => p && String(p.text || '').trim())
          .map((p) => ({ id: p.id || TTP.uid(), text: String(p.text), source: String(p.source || '') })),
      };
    }
    return doc;
  }

  /* --------------------------------------------------------------- queries */

  function item(tid) {
    return state.doc.items[tid] || null;
  }

  function isSelected(tid, tactic) {
    const it = state.doc.items[tid];
    if (!it || !it.tactics.length) return false;
    return tactic ? it.tactics.includes(tactic) : true;
  }

  /** Görselde yer alacak taktikler (kill chain sırasında) */
  function activeTactics() {
    const used = new Set(Object.keys(state.doc.tactics));
    for (const it of Object.values(state.doc.items)) it.tactics.forEach((s) => used.add(s));
    return data.tactics.filter((t) => used.has(t.short));
  }

  function stats() {
    let techniques = 0;
    let subs = 0;
    let procedures = 0;
    for (const [tid, it] of Object.entries(state.doc.items)) {
      if (!it.tactics.length) continue;
      if (data.techById.get(tid).sub) subs++;
      else techniques++;
      procedures += it.procedures.length;
    }
    return { tactics: activeTactics().length, techniques, subs, procedures };
  }

  /** Renk kullanım sayıları (lejantta gösterim için) */
  function colorUsage() {
    const usage = new Map();
    for (const it of Object.values(state.doc.items)) {
      if (!it.tactics.length) continue;
      usage.set(it.color, (usage.get(it.color) || 0) + 1);
    }
    for (const t of Object.values(state.doc.tactics)) usage.set(t.color, (usage.get(t.color) || 0) + 1);
    return usage;
  }

  /* --------------------------------------------------------------- actions */

  function ensureItem(doc, tid) {
    if (!doc.items[tid]) doc.items[tid] = { color: doc.activeColor, tactics: [], procedures: [] };
    return doc.items[tid];
  }

  function pruneItem(doc, tid) {
    const it = doc.items[tid];
    if (it && !it.tactics.length && !it.procedures.length) delete doc.items[tid];
  }

  /** Hücre tıklaması: tekniği verilen taktikte seçer ya da seçimi kaldırır. */
  function toggleTechnique(tid, tactic) {
    const across = state.ui.across;
    let selectedNow = false;
    commit((doc) => {
      const all = data.tacticsOf(tid);
      const it = ensureItem(doc, tid);
      const on = tactic ? it.tactics.includes(tactic) : it.tactics.length > 0;
      if (on) {
        it.tactics = across || !tactic ? [] : it.tactics.filter((s) => s !== tactic);
      } else {
        if (!it.tactics.length) it.color = doc.activeColor;
        const add = across || !tactic ? all : [tactic];
        it.tactics = all.filter((s) => it.tactics.includes(s) || add.includes(s));
        selectedNow = true;
      }
      pruneItem(doc, tid);
    });
    return selectedNow;
  }

  function setTechniqueTactics(tid, shorts) {
    commit((doc) => {
      const valid = data.tacticsOf(tid);
      const it = ensureItem(doc, tid);
      if (!it.tactics.length && shorts.length) it.color = doc.activeColor;
      it.tactics = valid.filter((s) => shorts.includes(s));
      pruneItem(doc, tid);
    });
  }

  function selectTechnique(tid, tactic) {
    if (isSelected(tid, tactic)) return;
    const all = data.tacticsOf(tid);
    const current = item(tid) ? item(tid).tactics : [];
    const add = tactic && !state.ui.across ? [tactic] : all;
    setTechniqueTactics(tid, [...new Set([...current, ...add])]);
  }

  function setItemColor(tid, color) {
    commit((doc) => {
      const it = doc.items[tid];
      if (it) it.color = TTP.normalizeHex(color);
    });
  }

  function addProcedure(tid, text, source = '') {
    const clean = String(text || '').trim();
    if (!clean) return;
    // Prosedür eklenen teknik henüz seçili değilse otomatik seçilir
    const shouldSelect = !isSelected(tid);
    commit((doc) => {
      const it = ensureItem(doc, tid);
      if (shouldSelect) {
        const all = data.tacticsOf(tid);
        const focusTactic = state.ui.focus === tid && state.ui.focusTactic;
        it.color = doc.activeColor;
        it.tactics = focusTactic && !state.ui.across && all.includes(focusTactic) ? [focusTactic] : all;
      }
      it.procedures.push({ id: TTP.uid(), text: clean, source: String(source || '') });
    });
  }

  function updateProcedure(tid, pid, patch) {
    commit(
      (doc) => {
        const p = doc.items[tid] && doc.items[tid].procedures.find((x) => x.id === pid);
        if (p) Object.assign(p, patch);
      },
      { source: 'details', coalesce: `proc:${pid}` }
    );
  }

  function removeProcedure(tid, pid) {
    commit((doc) => {
      const it = doc.items[tid];
      if (!it) return;
      it.procedures = it.procedures.filter((p) => p.id !== pid);
      pruneItem(doc, tid);
    });
  }

  function toggleTactic(short) {
    commit((doc) => {
      if (doc.tactics[short]) delete doc.tactics[short];
      else doc.tactics[short] = { color: doc.activeColor };
    });
  }

  function setTacticColor(short, color) {
    commit((doc) => {
      if (doc.tactics[short]) doc.tactics[short].color = TTP.normalizeHex(color);
    });
  }

  /** Aktif rengi değiştirir; odakta seçili bir teknik varsa ona da uygular. */
  function setActiveColor(color, { applyToFocus = true } = {}) {
    const hex = TTP.normalizeHex(color);
    commit(
      (doc) => {
        doc.activeColor = hex;
        const f = state.ui.focus;
        if (applyToFocus && f && doc.items[f] && doc.items[f].tactics.length) doc.items[f].color = hex;
      },
      { coalesce: 'active-color' }
    );
  }

  function addLegend(color, label = '') {
    commit((doc) => {
      doc.legend.push({ id: TTP.uid(), color: TTP.normalizeHex(color), label });
    });
  }

  function updateLegend(id, patch, source) {
    commit(
      (doc) => {
        const l = doc.legend.find((x) => x.id === id);
        if (!l) return;
        // Lejant rengi değişirse o rengi kullanan seçimler de güncellenir
        if (patch.color && patch.color !== l.color) {
          const from = l.color;
          const to = TTP.normalizeHex(patch.color);
          for (const it of Object.values(doc.items)) if (it.color === from) it.color = to;
          for (const t of Object.values(doc.tactics)) if (t.color === from) t.color = to;
          if (doc.activeColor === from) doc.activeColor = to;
          patch = { ...patch, color: to };
        }
        Object.assign(l, patch);
      },
      { source, coalesce: `legend:${id}:${Object.keys(patch).join()}` }
    );
  }

  function removeLegend(id) {
    commit((doc) => {
      doc.legend = doc.legend.filter((l) => l.id !== id);
    });
  }

  function moveLegend(id, delta) {
    commit((doc) => {
      const i = doc.legend.findIndex((l) => l.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= doc.legend.length) return;
      const [l] = doc.legend.splice(i, 1);
      doc.legend.splice(j, 0, l);
    });
  }

  function setMeta(patch, source) {
    commit(
      (doc) => {
        Object.assign(doc.meta, patch);
      },
      { source, coalesce: `meta:${Object.keys(patch).join()}` }
    );
  }

  function setExportOptions(patch) {
    commit(
      (doc) => {
        Object.assign(doc.exportOptions, patch);
      },
      { kind: 'export', source: 'export', coalesce: `export:${Object.keys(patch).join()}` }
    );
  }

  /**
   * Bir tehdit profilinin (grup/kampanya/yazılım) tüm tekniklerini seçer.
   * @returns {{techniques: number, procedures: number}}
   */
  function applyActor(actorId, { withProcedures = true, replace = false, color } = {}) {
    const actor = data.actorById.get(actorId);
    if (!actor) return { techniques: 0, procedures: 0 };
    const result = { techniques: 0, procedures: 0 };
    commit((doc) => {
      if (replace) {
        doc.items = {};
        doc.tactics = {};
      }
      const paint = TTP.normalizeHex(color || doc.activeColor);
      const seen = new Set();
      for (const [tid, text] of actor.uses) {
        if (!data.techById.has(tid)) continue;
        const it = ensureItem(doc, tid);
        if (!it.tactics.length) it.color = paint;
        it.tactics = data.tacticsOf(tid);
        if (!seen.has(tid)) {
          seen.add(tid);
          result.techniques++;
        }
        if (withProcedures && text && !it.procedures.some((p) => p.text === text)) {
          it.procedures.push({ id: TTP.uid(), text, source: actor.name });
          result.procedures++;
        }
      }
      if (!doc.meta.title) {
        doc.meta.title = actor.name;
        if (!doc.meta.subtitle && actor.aliases.length) doc.meta.subtitle = actor.aliases.slice(0, 6).join(', ');
      }
    });
    return result;
  }

  function clearSelection() {
    commit((doc) => {
      doc.items = {};
      doc.tactics = {};
    });
  }

  /** Yeni proje ya da dosyadan yükleme: geçmiş sıfırlanır. */
  function load(doc, file = {}) {
    state.doc = normalizeDoc(doc);
    history.past = [];
    history.future = [];
    history.lastKey = null;
    state.file = { path: file.path || null, name: file.name || null, dirty: !!file.dirty };
    state.ui.focus = null;
    scheduleAutosave();
    emit({ kind: 'load', source: 'load' });
  }

  function reset() {
    load(emptyDoc());
  }

  TTP.store = {
    state,
    PALETTE,
    DEFAULT_EXPORT,
    subscribe,
    commit,
    undo,
    redo,
    canUndo: () => history.past.length > 0,
    canRedo: () => history.future.length > 0,
    setUi,
    setFile,
    restore,
    normalizeDoc,
    item,
    isSelected,
    activeTactics,
    stats,
    colorUsage,
    toggleTechnique,
    setTechniqueTactics,
    selectTechnique,
    setItemColor,
    addProcedure,
    updateProcedure,
    removeProcedure,
    toggleTactic,
    setTacticColor,
    setActiveColor,
    addLegend,
    updateLegend,
    removeLegend,
    moveLegend,
    setMeta,
    setExportOptions,
    applyActor,
    clearSelection,
    load,
    reset,
  };
})();
