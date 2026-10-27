/*
 * Dosya işlemleri. Masaüstünde (Electron) yerel kaydet/aç diyalogları,
 * tarayıcıda indirme ve <input type="file"> kullanılır.
 */
(function () {
  'use strict';

  const TTP = window.TTP;
  const desktop = window.desktop || null;

  const FILTERS = {
    project: [{ name: 'TTP Panel Projesi', extensions: ['json'] }],
    layer: [{ name: 'ATT&CK Navigator Katmanı', extensions: ['json'] }],
    png: [{ name: 'PNG Görseli', extensions: ['png'] }],
    svg: [{ name: 'SVG Vektörel Görsel', extensions: ['svg'] }],
    markdown: [{ name: 'Markdown Tablosu', extensions: ['md'] }],
    csv: [{ name: 'CSV (Excel)', extensions: ['csv'] }],
  };

  function downloadBlob(name, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return name;
  }

  function base64ToBlob(base64, type) {
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type });
  }

  /**
   * Metin dosyası kaydeder.
   * @returns {Promise<string|null>} kaydedilen yol/ad, iptalde null
   */
  async function saveText(defaultName, text, filters, mime = 'application/json') {
    if (desktop) return desktop.saveFile({ defaultPath: defaultName, filters, data: text, encoding: 'utf8' });
    return downloadBlob(defaultName, new Blob([text], { type: mime + ';charset=utf-8' }));
  }

  /** Daha önce kaydedilmiş/açılmış bir yola doğrudan yazar (yalnızca masaüstü). */
  async function overwrite(filePath, text) {
    if (!desktop || !filePath) return null;
    return desktop.writeFile(filePath, text);
  }

  async function saveBase64(defaultName, base64, filters, mime) {
    if (desktop) return desktop.saveFile({ defaultPath: defaultName, filters, data: base64, encoding: 'base64' });
    return downloadBlob(defaultName, base64ToBlob(base64, mime));
  }

  /** @returns {Promise<{path: string|null, name: string, content: string}|null>} */
  function openText(filters) {
    if (desktop) return desktop.openFile({ filters });
    return new Promise((resolve) => {
      const input = document.getElementById('file-input');
      input.value = '';
      input.accept = filters.flatMap((f) => f.extensions.map((e) => '.' + e)).join(',');
      input.onchange = () => {
        const file = input.files && input.files[0];
        if (!file) return resolve(null);
        const reader = new FileReader();
        reader.onload = () => resolve({ path: null, name: file.name, content: String(reader.result) });
        reader.onerror = () => resolve(null);
        reader.readAsText(file);
      };
      input.click();
    });
  }

  function basename(p) {
    return p ? String(p).split(/[\\/]/).pop() : p;
  }

  TTP.files = { FILTERS, saveText, overwrite, saveBase64, openText, basename, isDesktop: !!desktop };
})();
