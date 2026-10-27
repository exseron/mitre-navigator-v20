/* Görsel önizleme ve dışa aktarma penceresi (PNG / SVG / panoya kopyala). */
(function () {
  'use strict';

  const TTP = window.TTP;
  const { store, files } = TTP;

  const modal = document.getElementById('export-modal');
  let zoom = 'fit';
  let current = null;

  const CHECKS = [
    ['showHeader', 'Başlık ve özet'],
    ['showKillChain', 'Kill chain şeridi'],
    ['showProcedures', 'Prosedürler'],
    ['showProcedureSource', 'Prosedür kaynakları'],
    ['showIds', "ATT&CK ID'leri"],
    ['showDescriptions', 'Teknik açıklamaları'],
    ['showLegend', 'Lejant'],
    ['showFooter', 'Alt bilgi'],
    ['showEmptyTactics', 'Boş taktikler'],
    ['transparent', 'Şeffaf arka plan'],
  ];

  function seg(name, value, options) {
    return `<div class="seg" data-seg="${name}">${options
      .map(([v, label]) => `<button class="seg__btn${String(value) === String(v) ? ' is-active' : ''}" data-value="${v}">${label}</button>`)
      .join('')}</div>`;
  }

  function optionsHtml() {
    const o = store.state.doc.exportOptions;
    return `
      <section class="panel-section">
        <h3 class="panel-title">Düzen</h3>
        ${seg('layout', o.layout, [
          ['matrix', 'Matris sütunları'],
          ['flow', 'Rapor akışı'],
        ])}
        <p class="hint">${o.layout === 'flow' ? 'Her taktik bir satır; teknik kartları yan yana dizilir.' : 'Her taktik bir sütun; ATT&amp;CK Navigator görünümüne benzer.'}</p>
      </section>
      <section class="panel-section">
        <h3 class="panel-title">Tema</h3>
        ${seg('theme', o.theme, [
          ['light', 'Açık'],
          ['dark', 'Koyu'],
        ])}
      </section>
      <section class="panel-section">
        <h3 class="panel-title">İçerik</h3>
        <div class="opt-grid">${CHECKS.map(
          ([key, label]) => `<label class="check"><input type="checkbox" data-opt="${key}" ${o[key] ? 'checked' : ''}/> <span>${label}</span></label>`
        ).join('')}</div>
      </section>
      <section class="panel-section">
        <h3 class="panel-title">Prosedür uzunluğu</h3>
        ${seg('procedureLines', o.procedureLines, [
          [0, 'Tam metin'],
          [4, '4 satır'],
          [2, '2 satır'],
          [1, '1 satır'],
        ])}
        <p class="hint">Uzun MITRE prosedürleri olan büyük profillerde görseli kompakt tutar.</p>
      </section>
      <section class="panel-section">
        <h3 class="panel-title">${o.layout === 'flow' ? 'Kart genişliği' : 'Sütun genişliği'}</h3>
        <div class="range-row">
          <input type="range" min="200" max="420" step="10" value="${o.columnWidth}" data-range="columnWidth" />
          <output>${o.columnWidth}px</output>
        </div>
      </section>
      <section class="panel-section">
        <h3 class="panel-title">PNG çözünürlüğü</h3>
        ${seg('pngScale', o.pngScale, [
          [1, '1×'],
          [2, '2×'],
          [3, '3×'],
          [4, '4×'],
        ])}
        <p class="hint" id="export-size"></p>
      </section>
      <section class="panel-section">
        <div class="export-actions">
          <button class="btn btn--primary" data-export="png">PNG olarak kaydet <span class="kbd" style="background:transparent;color:inherit;border-color:rgba(255,255,255,.4)">${TTP.shortcut('Mod+Shift+P')}</span></button>
          <button class="btn" data-export="svg">SVG (vektörel) olarak kaydet</button>
          <button class="btn" data-export="clipboard">PNG'yi panoya kopyala</button>
        </div>
        <p class="hint">SVG; PowerPoint, Word, Illustrator, Figma ve tarayıcılarda kayıpsız ölçeklenir.</p>
      </section>
      <section class="panel-section">
        <h3 class="panel-title">Rapor tablosu</h3>
        <div class="export-actions">
          <div class="row">
            <button class="btn btn--sm" style="flex:1" data-export="markdown">Markdown (.md)</button>
            <button class="btn btn--sm" style="flex:1" data-export="csv">CSV (Excel)</button>
          </div>
          <button class="btn btn--sm" data-export="copy-markdown">Markdown tablosunu kopyala</button>
        </div>
        <p class="hint">Taktik, teknik, değerlendirme (lejant) ve prosedürleri satır satır listeler.</p>
      </section>`;
  }

  function open() {
    modal.innerHTML = `
      <div class="modal__dialog" role="dialog" aria-modal="true" aria-labelledby="export-title">
        <div class="modal__head">
          <h2 class="modal__title" id="export-title">Görsel Önizleme</h2>
          <span class="muted" id="export-summary"></span>
          <button class="icon-btn" data-close title="Kapat (Esc)">✕</button>
        </div>
        <div class="modal__options" id="export-options">${optionsHtml()}</div>
        <div class="modal__preview">
          <div class="preview-bar">
            <span>Önizleme yalnızca seçtiğiniz taktik, teknik ve prosedürleri gösterir.</span>
            <span class="spacer"></span>
            ${seg('zoom', zoom, [
              ['fit', 'Sığdır'],
              ['1', '100%'],
            ])}
          </div>
          <div class="preview-scroll" id="preview-scroll"><div class="preview-canvas" id="preview-canvas"></div></div>
        </div>
      </div>`;
    modal.hidden = false;
    renderPreview();
    modal.querySelector('[data-close]').focus();
  }

  function close() {
    modal.hidden = true;
    modal.innerHTML = '';
    current = null;
  }

  const isOpen = () => !modal.hidden;

  function build() {
    return TTP.exporter.buildSvg(store.state.doc, store.state.doc.exportOptions);
  }

  function renderPreview() {
    if (!isOpen()) return;
    current = build();
    const canvas = modal.querySelector('#preview-canvas');
    const scroll = modal.querySelector('#preview-scroll');
    if (current.empty) {
      canvas.style.boxShadow = 'none';
      canvas.innerHTML = `<div class="preview-empty"><strong>Henüz seçim yok.</strong><br/>Matristen teknik seçin ya da bir tehdit profili içe aktarın; görsel burada oluşur.</div>`;
    } else {
      canvas.style.boxShadow = '';
      canvas.innerHTML = current.svg;
      const svg = canvas.querySelector('svg');
      const avail = scroll.clientWidth - 48;
      const factor = zoom === 'fit' ? Math.min(1, avail / current.width) : 1;
      svg.style.width = Math.round(current.width * factor) + 'px';
      svg.style.height = Math.round(current.height * factor) + 'px';
    }
    const scale = store.state.doc.exportOptions.pngScale;
    const sizeEl = modal.querySelector('#export-size');
    if (sizeEl) {
      sizeEl.textContent = `Görsel: ${current.width} × ${current.height} px · PNG: ${Math.round(current.width * scale)} × ${Math.round(
        current.height * scale
      )} px`;
    }
    const s = store.stats();
    modal.querySelector('#export-summary').textContent = `${s.tactics} taktik · ${s.techniques + s.subs} teknik · ${s.procedures} prosedür`;
  }

  const refreshPreview = TTP.debounce(renderPreview, 60);

  function refreshOptions() {
    const box = modal.querySelector('#export-options');
    if (!box) return;
    const scroll = box.scrollTop;
    box.innerHTML = optionsHtml();
    box.scrollTop = scroll;
  }

  /* -------------------------------------------------------------- exports */

  function baseName() {
    const title = store.state.doc.meta.title;
    return TTP.slugify(title || 'attack-ttp-profili');
  }

  async function exportSvg() {
    const out = build();
    if (out.empty) return TTP.toast('Dışa aktarmak için önce en az bir teknik seçin.', { type: 'error' });
    const saved = await files.saveText(baseName() + '.svg', out.svg, files.FILTERS.svg, 'image/svg+xml');
    if (saved) TTP.toast(`SVG kaydedildi: ${files.basename(saved)}`, revealAction(saved));
  }

  async function exportPng() {
    const out = build();
    if (out.empty) return TTP.toast('Dışa aktarmak için önce en az bir teknik seçin.', { type: 'error' });
    try {
      const png = await TTP.exporter.toPng(out.svg, out.width, out.height, store.state.doc.exportOptions.pngScale);
      const saved = await files.saveBase64(baseName() + '.png', png.base64, files.FILTERS.png, 'image/png');
      if (saved) {
        const note = png.scale !== store.state.doc.exportOptions.pngScale ? ` (boyut sınırı nedeniyle ${png.scale}×)` : '';
        TTP.toast(`PNG kaydedildi: ${files.basename(saved)}${note}`, revealAction(saved));
      }
    } catch (err) {
      TTP.toast('PNG oluşturulamadı: ' + err.message, { type: 'error' });
    }
  }

  async function copyPng() {
    const out = build();
    if (out.empty) return TTP.toast('Kopyalamak için önce en az bir teknik seçin.', { type: 'error' });
    try {
      const png = await TTP.exporter.toPng(out.svg, out.width, out.height, store.state.doc.exportOptions.pngScale);
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png.blob })]);
      TTP.toast('Görsel panoya kopyalandı — rapora yapıştırabilirsiniz.');
    } catch (err) {
      TTP.toast('Panoya kopyalanamadı: ' + err.message, { type: 'error' });
    }
  }

  function hasSelection() {
    const s = store.stats();
    if (s.techniques + s.subs) return true;
    TTP.toast('Tablo için önce en az bir teknik seçin.', { type: 'error' });
    return false;
  }

  async function exportTable(kind) {
    if (!hasSelection()) return;
    const doc = store.state.doc;
    if (kind === 'copy-markdown') {
      await navigator.clipboard.writeText(TTP.tableExport.toMarkdown(doc));
      return TTP.toast('Markdown tablosu panoya kopyalandı.');
    }
    const md = kind === 'markdown';
    const text = md ? TTP.tableExport.toMarkdown(doc) : TTP.tableExport.toCsv(doc);
    const name = baseName() + (md ? '.md' : '.csv');
    const saved = await files.saveText(name, text, md ? files.FILTERS.markdown : files.FILTERS.csv, md ? 'text/markdown' : 'text/csv');
    if (saved) TTP.toast(`Tablo kaydedildi: ${files.basename(saved)}`, revealAction(saved));
  }

  function revealAction(saved) {
    return window.desktop && saved && /[\\/]/.test(saved)
      ? { action: { label: 'Klasörde göster', run: () => window.desktop.reveal(saved) }, timeout: 5000 }
      : {};
  }

  /* --------------------------------------------------------------- events */

  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.closest('[data-close]')) return close();
    const segBtn = e.target.closest('.seg__btn');
    if (segBtn) {
      const name = segBtn.parentElement.dataset.seg;
      const raw = segBtn.dataset.value;
      if (name === 'zoom') {
        zoom = raw;
        segBtn.parentElement.querySelectorAll('.seg__btn').forEach((b) => b.classList.toggle('is-active', b === segBtn));
        return renderPreview();
      }
      const numeric = name === 'pngScale' || name === 'procedureLines';
      store.setExportOptions({ [name]: numeric ? Number(raw) : raw });
      return refreshOptions();
    }
    const exp = e.target.closest('[data-export]');
    if (exp) {
      const kind = exp.dataset.export;
      const run = { png: exportPng, svg: exportSvg, clipboard: copyPng }[kind] || (() => exportTable(kind));
      Promise.resolve(run()).catch((err) => TTP.toast('Dışa aktarma başarısız: ' + err.message, { type: 'error' }));
    }
  });

  modal.addEventListener('change', (e) => {
    const key = e.target.dataset.opt;
    if (key) store.setExportOptions({ [key]: e.target.checked });
  });

  modal.addEventListener('input', (e) => {
    const key = e.target.dataset.range;
    if (!key) return;
    e.target.nextElementSibling.textContent = e.target.value + 'px';
    store.setExportOptions({ [key]: Number(e.target.value) });
  });

  window.addEventListener('resize', () => {
    if (isOpen() && zoom === 'fit') refreshPreview();
  });

  store.subscribe((change) => {
    if (isOpen() && (change.kind === 'doc' || change.kind === 'export' || change.kind === 'load')) {
      if (change.source === 'history') refreshOptions();
      refreshPreview();
    }
  });

  TTP.exportModal = { open, close, isOpen, exportPng, exportSvg, copyPng };
})();
