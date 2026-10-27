/* ATT&CK matrisi: taktik sütunları, teknik ve alt teknik hücreleri. */
(function () {
  'use strict';

  const TTP = window.TTP;
  const { data, store, esc } = TTP;

  const root = document.getElementById('matrix');
  const statsEl = document.getElementById('matrix-stats');

  const CHEVRON = '<svg viewBox="0 0 12 12"><path d="M4 2l4 4-4 4" /></svg>';

  function matches(t, q) {
    return TTP.fold(t.name).includes(q) || t.id.toLowerCase().includes(q);
  }

  function cellStyle(color) {
    return `--c:${color};--fg:${TTP.contrastText(color)}`;
  }

  function cellHtml(t, tactic, opts) {
    const { doc, ui } = store.state;
    const it = doc.items[t.id];
    const selected = store.isSelected(t.id, tactic);
    const subs = t.sub ? [] : data.children.get(t.id) || [];
    const selectedSub = subs.find((s) => store.isSelected(s.id, tactic));
    // Seçili alt tekniği olan teknikler, kullanıcı kapatmadıkça açık gösterilir
    const open =
      subs.length && (opts.forceOpen || (!ui.closed.has(t.id) && (ui.showSubs || ui.open.has(t.id) || !!selectedSub)));
    const procs = it ? it.procedures.length : 0;

    const cls = ['tcell'];
    if (t.sub) cls.push('tcell--sub');
    if (selected) cls.push('is-selected');
    if (ui.focus === t.id) cls.push('is-focused');
    if (subs.length) cls.push('has-subs');
    if (open) cls.push('is-open');
    if (selectedSub) cls.push('has-selected-sub');
    if (opts.query) cls.push(opts.hit ? 'is-match' : 'is-dim');

    let style = selected ? cellStyle(it.color) : '';
    if (selectedSub) style += `;--sc:${doc.items[selectedSub.id].color}`;

    const toggle = subs.length
      ? `<button class="tcell__toggle" data-act="expand" title="${subs.length} alt teknik">${CHEVRON}</button>`
      : '';
    const badge = procs && selected ? `<span class="tcell__badge" title="${procs} prosedür">${procs}</span>` : '';

    let html =
      `<div class="${cls.join(' ')}" style="${style}" data-tid="${t.id}" data-tactic="${tactic}" title="${esc(t.id + ' — ' + t.name)}">` +
      toggle +
      `<div class="tcell__main" data-act="toggle"><span class="tcell__name">${esc(t.name)}</span>` +
      `<span class="tcell__id">${t.id}${subs.length ? ` · ${subs.length} alt` : ''}</span></div>` +
      badge +
      `<button class="tcell__info" data-act="info" title="Ayrıntılar">i</button></div>`;

    if (open && opts.subs.length) {
      html += `<div class="tsubs">${opts.subs.map((s) => cellHtml(s.t, tactic, { query: opts.query, hit: s.hit, subs: [] })).join('')}</div>`;
    }
    return html;
  }

  function render() {
    const { doc, ui } = store.state;
    const q = TTP.fold(ui.search.trim());
    const columns = [];

    for (const tactic of data.tactics) {
      const techs = data.byTactic.get(tactic.short) || [];
      const rows = [];
      let selectedCount = 0;

      for (const t of techs) {
        const subs = (data.children.get(t.id) || []).map((s) => ({
          t: s,
          hit: !!q && matches(s, q),
          sel: store.isSelected(s.id, tactic.short),
        }));
        const sel = store.isSelected(t.id, tactic.short);
        const anySubSel = subs.some((s) => s.sel);
        if (sel || anySubSel) selectedCount++;

        if (ui.onlySelected && !sel && !anySubSel) continue;
        const hit = !!q && matches(t, q);
        const subHit = subs.some((s) => s.hit);
        // Sadece seçilenler görünümünde, seçili alt teknikler gösterilir
        const visibleSubs = ui.onlySelected ? subs.filter((s) => s.sel) : subs;
        rows.push(
          cellHtml(t, tactic.short, {
            query: q,
            hit: hit || subHit,
            forceOpen: subHit || (ui.onlySelected && anySubSel),
            subs: visibleSubs,
          })
        );
      }

      const tSel = doc.tactics[tactic.short];
      if (ui.onlySelected && !rows.length && !tSel) continue;

      columns.push(
        `<section class="tcol" data-tactic="${tactic.short}">` +
          `<header class="tcol__head${tSel ? ' is-selected' : ''}" style="${tSel ? cellStyle(tSel.color) : ''}" data-act="tactic" ` +
          `title="Taktiği görsele dahil et / renklendir">` +
          `<div class="tcol__name">${esc(tactic.name)}</div>` +
          `<div class="tcol__meta"><span>${tactic.id}</span><span>${selectedCount} / ${techs.length}</span></div>` +
          `</header><div class="tcol__list">${rows.join('')}</div></section>`
      );
    }

    root.innerHTML = columns.length
      ? columns.join('')
      : `<div class="matrix-empty">Henüz seçim yok. "Tümü" görünümüne geçip tekniklere tıklayarak seçim yapın ` +
        `ya da soldan bir tehdit profili içe aktarın.</div>`;

    const s = store.stats();
    statsEl.innerHTML = `<b>${s.tactics}</b> taktik · <b>${s.techniques}</b> teknik · <b>${s.subs}</b> alt teknik · <b>${s.procedures}</b> prosedür`;
  }

  /* --------------------------------------------------------------- events */

  root.addEventListener('click', (e) => {
    const head = e.target.closest('[data-act="tactic"]');
    if (head) {
      store.toggleTactic(head.closest('.tcol').dataset.tactic);
      return;
    }
    const cell = e.target.closest('.tcell');
    if (!cell) return;
    const { tid, tactic } = cell.dataset;
    const act = e.target.closest('[data-act]');
    const action = act ? act.dataset.act : 'toggle';

    if (action === 'expand') {
      const { ui } = store.state;
      const open = new Set(ui.open);
      const closed = new Set(ui.closed);
      if (cell.classList.contains('is-open')) {
        open.delete(tid);
        closed.add(tid);
      } else {
        closed.delete(tid);
        open.add(tid);
      }
      store.setUi({ open, closed }, 'matrix');
      return;
    }
    if (action === 'info' || e.shiftKey) {
      store.setUi({ focus: tid, focusTactic: tactic });
      return;
    }
    store.setUi({ focus: tid, focusTactic: tactic }, 'matrix');
    store.toggleTechnique(tid, tactic);
  });

  // Sağ tık: seçimi değiştirmeden ayrıntıları aç
  root.addEventListener('contextmenu', (e) => {
    const cell = e.target.closest('.tcell');
    if (!cell) return;
    e.preventDefault();
    store.setUi({ focus: cell.dataset.tid, focusTactic: cell.dataset.tactic });
  });

  /** Odaktaki hücreyi görünür alana kaydırır */
  function reveal(tid) {
    const cell = root.querySelector(`.tcell[data-tid="${CSS.escape(tid)}"]`);
    if (cell) cell.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }

  TTP.matrix = { render, reveal };
})();
