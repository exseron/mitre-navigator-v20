/* Sağ panel: odaktaki tekniğin ayrıntıları, renk, taktikler ve prosedürler. */
(function () {
  'use strict';

  const TTP = window.TTP;
  const { data, store, esc } = TTP;

  const root = document.getElementById('details');
  let exampleQuery = '';
  let lastFocus = null;

  function emptyState() {
    return `
      <div class="details-empty">
        <svg viewBox="0 0 48 48"><rect x="6" y="8" width="10" height="32" rx="2"/><rect x="19" y="8" width="10" height="22" rx="2"/><rect x="32" y="8" width="10" height="28" rx="2"/></svg>
        <p><strong>Bir teknik seçin</strong></p>
        <p>Matristeki bir hücreye tıklamak onu aktif renkle seçer ve ayrıntılarını burada açar.</p>
        <p class="hint"><span class="kbd">Shift</span> + tık veya sağ tık yalnızca ayrıntıları açar.</p>
      </div>`;
  }

  function autosize(el) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }

  function render(change = {}) {
    const { ui, doc } = store.state;
    const tid = ui.focus;
    const t = tid && data.techById.get(tid);
    if (!t) {
      root.innerHTML = emptyState();
      lastFocus = null;
      return;
    }
    // Prosedür yazılırken paneli yeniden çizme (imleç kaybolmasın)
    if (change.source === 'details' && lastFocus === tid) return;
    if (lastFocus !== tid) exampleQuery = '';
    const scroll = lastFocus === tid ? root.scrollTop : 0;
    lastFocus = tid;

    const it = doc.items[tid];
    const selected = store.isSelected(tid);
    const color = selected ? it.color : null;
    const parent = t.sub ? data.techById.get(t.parent) : null;
    const tactics = data.tacticsOf(tid);
    const subs = t.sub ? [] : data.children.get(tid) || [];
    const procs = it ? it.procedures : [];

    const tacticChips = tactics
      .map((s) => {
        const on = store.isSelected(tid, s);
        return `<label class="chip${on ? ' is-on' : ''}"><input type="checkbox" data-tactic-toggle="${s}" ${on ? 'checked' : ''}/>${esc(
          data.tacticByShort.get(s).name
        )}</label>`;
      })
      .join('');

    const colorChoices = [...new Set([...doc.legend.map((l) => l.color), ...store.PALETTE])]
      .map(
        (c) =>
          `<button class="swatch${c === color ? ' is-active' : ''}" style="background:${c}" data-item-color="${c}" title="${esc(
            (doc.legend.find((l) => l.color === c) || {}).label || c
          )}"></button>`
      )
      .join('');

    const procHtml = procs.length
      ? procs
          .map(
            (p) => `
        <div class="proc" data-pid="${p.id}" style="--c:${color || 'var(--border-strong)'}">
          <textarea class="proc__text" rows="1" data-proc-text>${esc(p.text)}</textarea>
          <div class="proc__source"><span>Kaynak:</span><input data-proc-source value="${esc(p.source)}" placeholder="rapor, aktör, URL…" /></div>
          <button class="icon-btn" data-proc-del title="Prosedürü sil">✕</button>
        </div>`
          )
          .join('')
      : '<p class="hint" style="margin:0">Henüz prosedür yok. Tehdit aktörünün bu tekniği nasıl uyguladığını yazın veya aşağıdaki MITRE örneklerinden ekleyin.</p>';

    const subHtml = subs.length
      ? `<section class="panel-section">
          <h3 class="panel-title">Alt Teknikler <span class="muted">${subs.filter((s) => store.isSelected(s.id)).length}/${subs.length}</span></h3>
          <div class="sub-list">${subs
            .map((s) => {
              const si = doc.items[s.id];
              const on = store.isSelected(s.id);
              return `<div class="sub-row" data-sub="${s.id}">
                <input type="checkbox" data-sub-toggle ${on ? 'checked' : ''} title="Seç / kaldır" />
                <span class="sub-row__dot" style="${on ? `background:${si.color};border-color:${si.color}` : ''}"></span>
                <span class="sub-row__name">${esc(s.name)}</span><span class="mono muted" style="font-size:11px">${s.id}</span>
              </div>`;
            })
            .join('')}</div>
        </section>`
      : '';

    root.innerHTML = `
      <section class="panel-section">
        <div class="tech-head">
          <div class="tech-head__color" style="${color ? `background:${color}` : ''}"></div>
          <div class="tech-head__body">
            <div class="row row--between">
              <a class="tech-id" href="${data.attackUrl(tid)}" target="_blank" title="attack.mitre.org üzerinde aç">${tid} ↗</a>
              <button class="icon-btn" data-close title="Kapat">✕</button>
            </div>
            <h2 class="tech-name">${esc(t.name)}</h2>
            ${parent ? `<div class="tech-parent" data-goto="${parent.id}">↳ ${esc(parent.name)} <span class="mono muted">${parent.id}</span></div>` : ''}
            ${t.platforms.length ? `<div class="hint">${esc(t.platforms.join(' · '))}</div>` : ''}
          </div>
        </div>
      </section>

      <section class="panel-section">
        <h3 class="panel-title">Seçim
          <span class="row" style="gap:4px">
            ${
              selected
                ? '<button class="btn btn--sm btn--danger" data-deselect>Seçimi kaldır</button>'
                : '<button class="btn btn--sm btn--primary" data-select-all>Tüm taktiklerde seç</button>'
            }
          </span>
        </h3>
        <label class="label">Görselde gösterileceği taktikler</label>
        <div class="chips">${tacticChips}</div>
        ${
          selected
            ? `<label class="label" style="margin-top:12px">Renk</label>
               <div class="palette" style="margin-bottom:0">${colorChoices}
                 <label class="swatch custom-color" title="Özel renk"><input type="color" data-item-custom value="${color}" /></label>
               </div>`
            : ''
        }
      </section>

      <section class="panel-section">
        <h3 class="panel-title">Prosedürler <span class="muted">${procs.length}</span></h3>
        <div class="proc-list">${procHtml}</div>
        <div class="field" style="margin-top:10px">
          <textarea class="textarea" id="proc-new" rows="2" placeholder="ör. APT29, ilk erişim için ISO içinde LNK dosyası barındıran spear-phishing e-postaları gönderdi."></textarea>
          <div class="row row--between" style="margin-top:6px">
            <input class="input" id="proc-new-source" placeholder="Kaynak (opsiyonel)" style="height:28px" />
            <button class="btn btn--sm btn--primary" id="proc-add">Ekle</button>
          </div>
          <p class="hint">${TTP.shortcut('Mod+Enter')} ile hızlı ekleme</p>
        </div>
      </section>

      ${subHtml}

      <section class="panel-section">
        <h3 class="panel-title">Açıklama</h3>
        <p class="tech-desc">${esc(t.desc)}</p>
      </section>

      ${examplesSection(tid, procs)}
    `;

    root.querySelectorAll('[data-proc-text]').forEach(autosize);
    root.scrollTop = scroll;
  }

  function examplesSection(tid, procs) {
    const all = data.examplesFor(tid);
    if (!all.length) return '';
    const q = TTP.fold(exampleQuery.trim());
    const list = q
      ? all.filter((e) => TTP.fold(e.actor.name).includes(q) || e.actor.id.toLowerCase() === q || TTP.fold(e.text).includes(q))
      : all;
    const existing = new Set(procs.map((p) => p.text));
    const rows = list
      .slice(0, 150)
      .map((e, i) => {
        const added = existing.has(e.text);
        return `<div class="example${added ? ' is-added' : ''}">
          <div class="example__head">
            <span><span class="example__actor">${esc(e.actor.name)}</span>
              <span class="tag tag--${e.actor.type}">${data.ACTOR_TYPE_LABEL[e.actor.type]}</span></span>
            <button class="btn btn--sm" data-example="${all.indexOf(e)}" ${added ? 'disabled' : ''}>${added ? 'Eklendi' : '+ Ekle'}</button>
          </div>
          <div class="example__text">${esc(e.text)}</div>
        </div>`;
      })
      .join('');
    return `
      <section class="panel-section">
        <h3 class="panel-title">MITRE Prosedür Örnekleri <span class="muted">${all.length}</span></h3>
        <input class="input" id="example-search" type="search" value="${esc(exampleQuery)}" placeholder="Aktör veya metin ile filtrele…" />
        <div class="example-list">${rows || '<p class="hint">Eşleşen örnek yok.</p>'}</div>
        ${list.length > 150 ? `<p class="hint">İlk 150 sonuç gösteriliyor (${list.length}).</p>` : ''}
      </section>`;
  }

  /* --------------------------------------------------------------- events */

  function focusId() {
    return store.state.ui.focus;
  }

  function addNewProcedure() {
    const text = root.querySelector('#proc-new');
    const source = root.querySelector('#proc-new-source');
    if (!text || !text.value.trim()) return;
    store.addProcedure(focusId(), text.value, source.value);
    const fresh = root.querySelector('#proc-new');
    if (fresh) fresh.focus();
  }

  root.addEventListener('click', (e) => {
    const tid = focusId();
    const el = e.target;
    if (el.closest('[data-close]')) return store.setUi({ focus: null });
    if (el.closest('[data-deselect]')) return store.setTechniqueTactics(tid, []);
    if (el.closest('[data-select-all]')) return store.setTechniqueTactics(tid, data.tacticsOf(tid));
    if (el.closest('#proc-add')) return addNewProcedure();

    const goto = el.closest('[data-goto]');
    if (goto) {
      store.setUi({ focus: goto.dataset.goto });
      return TTP.matrix.reveal(goto.dataset.goto);
    }
    const swatch = el.closest('[data-item-color]');
    if (swatch) return store.setItemColor(tid, swatch.dataset.itemColor);

    const del = el.closest('[data-proc-del]');
    if (del) return store.removeProcedure(tid, del.closest('.proc').dataset.pid);

    const ex = el.closest('[data-example]');
    if (ex) {
      const sample = data.examplesFor(tid)[Number(ex.dataset.example)];
      if (sample) store.addProcedure(tid, sample.text, sample.actor.name);
      return;
    }

    const sub = el.closest('[data-sub]');
    if (sub) {
      const sid = sub.dataset.sub;
      if (el.matches('[data-sub-toggle]')) {
        if (store.isSelected(sid)) store.setTechniqueTactics(sid, []);
        else store.selectTechnique(sid, store.state.ui.focusTactic);
      } else {
        store.setUi({ focus: sid, open: new Set([...store.state.ui.open, tid]) });
        TTP.matrix.reveal(sid);
      }
    }
  });

  root.addEventListener('change', (e) => {
    const tid = focusId();
    const tg = e.target.closest('[data-tactic-toggle]');
    if (tg) {
      const current = store.item(tid) ? store.item(tid).tactics : [];
      const s = tg.dataset.tacticToggle;
      store.setTechniqueTactics(tid, tg.checked ? [...current, s] : current.filter((x) => x !== s));
      return;
    }
    if (e.target.matches('[data-item-custom]')) store.setItemColor(tid, e.target.value);
  });

  root.addEventListener('input', (e) => {
    const tid = focusId();
    const proc = e.target.closest('.proc');
    if (proc && e.target.matches('[data-proc-text]')) {
      autosize(e.target);
      store.updateProcedure(tid, proc.dataset.pid, { text: e.target.value });
    } else if (proc && e.target.matches('[data-proc-source]')) {
      store.updateProcedure(tid, proc.dataset.pid, { source: e.target.value });
    } else if (e.target.id === 'example-search') {
      exampleQuery = e.target.value;
      const pos = e.target.selectionStart;
      lastFocus = null; // yeniden çizime zorla
      render();
      const input = root.querySelector('#example-search');
      input.focus();
      input.setSelectionRange(pos, pos);
    }
  });

  // Boşaltılan prosedür, alandan çıkınca silinir
  root.addEventListener(
    'blur',
    (e) => {
      if (!e.target.matches || !e.target.matches('[data-proc-text]')) return;
      const proc = e.target.closest('.proc');
      if (proc && !e.target.value.trim()) store.removeProcedure(focusId(), proc.dataset.pid);
    },
    true
  );

  root.addEventListener('keydown', (e) => {
    if (e.target.id === 'proc-new' && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      addNewProcedure();
    }
  });

  TTP.details = { render };
})();
