/* Sol panel: proje bilgileri, renk paleti/lejant, tehdit profili içe aktarma. */
(function () {
  'use strict';

  const TTP = window.TTP;
  const { data, store, esc } = TTP;

  const root = document.getElementById('sidebar');
  let actorQuery = '';
  let actorId = null;

  root.innerHTML = `
    <section class="panel-section">
      <h3 class="panel-title">Proje / Rapor</h3>
      <div class="field">
        <label class="label" for="meta-title">Başlık</label>
        <input class="input" id="meta-title" data-meta="title" placeholder="ör. APT29 — TTP Profili" />
      </div>
      <div class="field">
        <label class="label" for="meta-subtitle">Alt başlık</label>
        <input class="input" id="meta-subtitle" data-meta="subtitle" placeholder="ör. Cozy Bear, Midnight Blizzard" />
      </div>
      <div class="field">
        <label class="label" for="meta-description">Açıklama</label>
        <textarea class="textarea" id="meta-description" data-meta="description" rows="2"
          placeholder="Kapsam, kaynak raporlar, tarih aralığı…"></textarea>
      </div>
      <div class="field">
        <label class="label" for="meta-author">Hazırlayan</label>
        <input class="input" id="meta-author" data-meta="author" placeholder="Analist / ekip" />
      </div>
    </section>

    <section class="panel-section">
      <h3 class="panel-title">Renk &amp; Lejant</h3>
      <div class="palette" id="palette"></div>
      <div class="legend-list" id="legend"></div>
      <button class="btn btn--sm btn--ghost" id="legend-add" style="margin-top:8px">
        <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg> Aktif rengi lejanta ekle
      </button>
      <p class="hint">Bir renk seçip matristeki tekniklere tıklayın. Odaktaki seçili tekniğe renk de uygulanır.</p>
    </section>

    <section class="panel-section">
      <h3 class="panel-title">Tehdit Profili İçe Aktar</h3>
      <input class="input" id="actor-search" type="search" placeholder="Grup, kampanya veya yazılım (ör. APT29, G0016)" autocomplete="off" />
      <div class="actor-results" id="actor-results"></div>
      <div id="actor-card"></div>
    </section>

    <section class="panel-section">
      <h3 class="panel-title">Seçim Özeti</h3>
      <div class="stats" id="stats"></div>
      <button class="btn btn--sm btn--block btn--danger" id="clear-all" style="margin-top:10px">Tüm seçimleri temizle</button>
    </section>
  `;

  const $ = (sel) => root.querySelector(sel);

  /* ------------------------------------------------------------------ meta */

  function renderMeta() {
    for (const input of root.querySelectorAll('[data-meta]')) {
      const value = store.state.doc.meta[input.dataset.meta] || '';
      if (input.value !== value && document.activeElement !== input) input.value = value;
    }
  }

  root.addEventListener('input', (e) => {
    const key = e.target.dataset && e.target.dataset.meta;
    if (key) store.setMeta({ [key]: e.target.value }, 'sidebar');
  });

  /* ---------------------------------------------------------------- colors */

  function renderPalette() {
    const active = store.state.doc.activeColor;
    const swatches = store.PALETTE.map(
      (c) =>
        `<button class="swatch${c === active ? ' is-active' : ''}" style="background:${c}" data-color="${c}" title="${c}"></button>`
    ).join('');
    const custom = !store.PALETTE.includes(active);
    $('#palette').innerHTML =
      swatches +
      `<label class="swatch custom-color${custom ? ' is-active' : ''}" title="Özel renk"` +
      `${custom ? ` style="background:${active}"` : ''}><input type="color" id="custom-color" value="${active}" /></label>`;
  }

  function renderLegend() {
    const { legend, activeColor } = store.state.doc;
    const usage = store.colorUsage();
    $('#legend').innerHTML = legend.length
      ? legend
          .map(
            (l, i) => `
        <div class="legend-item${l.color === activeColor ? ' is-active' : ''}" data-id="${l.id}">
          <button class="swatch" style="background:${l.color}" data-use="${l.color}" title="Bu rengi kullan"></button>
          <input type="text" value="${esc(l.label)}" data-legend-label placeholder="Etiket (ör. Gözlemlendi)" />
          <span class="count" title="Bu rengi kullanan seçim sayısı">${usage.get(l.color) || ''}</span>
          <label class="icon-btn" title="Rengi değiştir" style="position:relative;overflow:hidden">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a9 9 0 0 0 0 18c1.1 0 1.5-.9 1.2-1.7-.4-.9.2-1.9 1.2-1.9H17a4 4 0 0 0 4-4c0-5-4-10.4-9-10.4z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/></svg>
            <input type="color" value="${l.color}" data-legend-color style="position:absolute;inset:0;opacity:0;cursor:pointer" />
          </label>
          <button class="icon-btn" data-legend-up ${i === 0 ? 'disabled' : ''} title="Yukarı taşı">↑</button>
          <button class="icon-btn" data-legend-del title="Lejanttan kaldır">✕</button>
        </div>`
          )
          .join('')
      : '<p class="hint" style="margin:0">Lejant boş. Görselde renklerin anlamını göstermek için ekleyin.</p>';
  }

  root.addEventListener('click', (e) => {
    const sw = e.target.closest('[data-color], [data-use]');
    if (sw) {
      store.setActiveColor(sw.dataset.color || sw.dataset.use);
      return;
    }
    const row = e.target.closest('.legend-item');
    if (row && e.target.closest('[data-legend-del]')) store.removeLegend(row.dataset.id);
    else if (row && e.target.closest('[data-legend-up]')) store.moveLegend(row.dataset.id, -1);
  });

  root.addEventListener('change', (e) => {
    if (e.target.id === 'custom-color') store.setActiveColor(e.target.value);
    if (e.target.matches('[data-legend-color]')) {
      store.updateLegend(e.target.closest('.legend-item').dataset.id, { color: e.target.value });
    }
  });

  root.addEventListener('input', (e) => {
    if (e.target.matches('[data-legend-label]')) {
      store.updateLegend(e.target.closest('.legend-item').dataset.id, { label: e.target.value }, 'sidebar');
    }
  });

  $('#legend-add').addEventListener('click', () => {
    const { legend, activeColor } = store.state.doc;
    if (legend.some((l) => l.color === activeColor)) {
      TTP.toast('Bu renk zaten lejantta. Önce paletten farklı bir renk seçin.');
      return;
    }
    store.addLegend(activeColor, '');
    const inputs = root.querySelectorAll('[data-legend-label]');
    if (inputs.length) inputs[inputs.length - 1].focus();
  });

  /* ---------------------------------------------------------------- actors */

  function actorMatches(a, q) {
    if (!q) return true;
    return (
      a.id.toLowerCase() === q ||
      TTP.fold(a.name).includes(q) ||
      a.aliases.some((x) => TTP.fold(x).includes(q))
    );
  }

  function renderActorResults() {
    const q = TTP.fold(actorQuery.trim());
    if (!q) {
      $('#actor-results').innerHTML = '';
      return;
    }
    const list = data.actors.filter((a) => actorMatches(a, q));
    // Tam ad/ID eşleşmeleri ve gruplar önce
    const rank = (a) => (a.id.toLowerCase() === q || TTP.fold(a.name) === q ? 0 : 1) * 10 + { group: 0, campaign: 1, software: 2 }[a.type];
    list.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
    $('#actor-results').innerHTML = list.length
      ? list
          .slice(0, 60)
          .map(
            (a) => `
        <button class="actor-row${a.id === actorId ? ' is-active' : ''}" data-actor="${a.id}">
          <div class="actor-row__main">
            <div class="actor-row__name">${esc(a.name)} <span class="muted mono" style="font-size:11px">${a.id}</span></div>
            ${a.aliases.length ? `<div class="actor-row__aliases">${esc(a.aliases.join(', '))}</div>` : ''}
          </div>
          <span class="tag tag--${a.type}">${data.ACTOR_TYPE_LABEL[a.type]}</span>
        </button>`
          )
          .join('')
      : '<div class="actor-row muted" style="cursor:default">Sonuç bulunamadı</div>';
  }

  function renderActorCard() {
    const a = actorId && data.actorById.get(actorId);
    if (!a) {
      $('#actor-card').innerHTML = '';
      return;
    }
    const techCount = new Set(a.uses.map((u) => u[0])).size;
    const procCount = a.uses.filter((u) => u[1]).length;
    $('#actor-card').innerHTML = `
      <div class="actor-card">
        <div class="row row--between">
          <strong>${esc(a.name)}</strong>
          <span class="tag tag--${a.type}">${data.ACTOR_TYPE_LABEL[a.type]}</span>
        </div>
        <div style="margin:2px 0 8px"><a href="${data.attackUrl(a.id)}" target="_blank" class="mono">${a.id}</a>
          <span class="muted"> · ${techCount} teknik · ${procCount} prosedür örneği</span></div>
        ${a.aliases.length ? `<div class="hint" style="margin:0 0 8px">${esc(a.aliases.join(', '))}</div>` : ''}
        <div class="stack" style="gap:6px;margin-bottom:10px">
          <label class="check"><input type="checkbox" id="actor-procs" checked /> <span>MITRE prosedür örneklerini ekle</span></label>
          <label class="check"><input type="checkbox" id="actor-replace" /> <span>Mevcut seçimleri temizle</span></label>
        </div>
        <button class="btn btn--primary btn--block" id="actor-apply">
          <span class="swatch" style="width:14px;height:14px;border-radius:4px;background:${store.state.doc.activeColor}"></span>
          Teknikleri aktif renkle seç
        </button>
      </div>`;
  }

  $('#actor-search').addEventListener('input', (e) => {
    actorQuery = e.target.value;
    renderActorResults();
  });

  $('#actor-results').addEventListener('click', (e) => {
    const row = e.target.closest('[data-actor]');
    if (!row) return;
    actorId = row.dataset.actor;
    renderActorResults();
    renderActorCard();
  });

  $('#actor-card').addEventListener('click', (e) => {
    if (!e.target.closest('#actor-apply')) return;
    const replace = $('#actor-replace').checked;
    const withProcedures = $('#actor-procs').checked;
    if (replace && store.stats().techniques + store.stats().subs > 0 && !confirm('Mevcut tüm seçimler temizlenecek. Devam edilsin mi?')) return;
    const r = store.applyActor(actorId, { withProcedures, replace });
    store.setUi({ onlySelected: true });
    TTP.toast(`${data.actorById.get(actorId).name}: ${r.techniques} teknik seçildi, ${r.procedures} prosedür eklendi.`, {
      action: { label: 'Geri al', run: () => store.undo() },
    });
  });

  /* ----------------------------------------------------------------- stats */

  function renderStats() {
    const s = store.stats();
    $('#stats').innerHTML = `
      <div class="stat"><b>${s.tactics}</b><span>Taktik</span></div>
      <div class="stat"><b>${s.techniques + s.subs}</b><span>Teknik</span></div>
      <div class="stat"><b>${s.procedures}</b><span>Prosedür</span></div>`;
  }

  $('#clear-all').addEventListener('click', () => {
    if (!store.stats().techniques && !store.stats().subs && !store.stats().tactics) return;
    store.clearSelection();
    TTP.toast('Tüm seçimler temizlendi.', { action: { label: 'Geri al', run: () => store.undo() } });
  });

  /* ---------------------------------------------------------------- render */

  function render(change = {}) {
    renderMeta();
    renderPalette();
    // Etiket yazılırken listeyi yeniden çizmek imleci kaybettirir
    if (change.source !== 'sidebar') renderLegend();
    renderStats();
    if (actorId) renderActorCard();
  }

  function focusActorSearch() {
    $('#actor-search').focus();
  }

  TTP.sidebar = { render, focusActorSearch };
})();
