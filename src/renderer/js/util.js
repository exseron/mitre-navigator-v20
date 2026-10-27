/* Ortak yardımcılar — tüm modüller window.TTP ad alanını paylaşır. */
(function () {
  'use strict';

  const TTP = (window.TTP = window.TTP || {});

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ESC[c]);

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function debounce(fn, wait) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* ---------------------------------------------------------------- colors */

  function parseHex(hex) {
    let h = String(hex || '').trim().replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    if (!/^[0-9a-f]{6}$/i.test(h)) return null;
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }

  function normalizeHex(hex, fallback = '#3e63dd') {
    const rgb = parseHex(hex);
    return rgb ? '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('') : fallback;
  }

  /** WCAG göreli parlaklık */
  function luminance(hex) {
    const rgb = parseHex(hex);
    if (!rgb) return 1;
    const [r, g, b] = rgb.map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  /** Arka plan rengine göre okunaklı metin rengi (siyah/beyaz) */
  function contrastText(hex) {
    const l = luminance(hex);
    const onWhite = 1.05 / (l + 0.05);
    const onDark = (l + 0.05) / (0.05 + 0.0116);
    return onWhite >= onDark * 0.82 ? '#ffffff' : '#141821';
  }

  /** Rengi beyaza (amount>0) ya da siyaha (amount<0) karıştırır */
  function mix(hex, amount) {
    const rgb = parseHex(hex);
    if (!rgb) return hex;
    const target = amount > 0 ? 255 : 0;
    const t = Math.abs(amount);
    return '#' + rgb.map((v) => Math.round(v + (target - v) * t).toString(16).padStart(2, '0')).join('');
  }

  function withAlpha(hex, alpha) {
    const rgb = parseHex(hex);
    return rgb ? `rgba(${rgb.join(',')},${alpha})` : hex;
  }

  /* ------------------------------------------------------------------ misc */

  function compareIds(a, b) {
    return a.localeCompare(b, 'en', { numeric: true });
  }

  function slugify(text) {
    return (
      String(text || '')
        .toLowerCase()
        .replace(/[ğ]/g, 'g')
        .replace(/[ü]/g, 'u')
        .replace(/[ş]/g, 's')
        .replace(/[ı]/g, 'i')
        .replace(/[ö]/g, 'o')
        .replace(/[ç]/g, 'c')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'attack-ttp'
    );
  }

  function formatDate(date = new Date()) {
    return date.toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  /** Normalleştirilmiş arama metni (büyük/küçük harf ve Türkçe karakter duyarsız) */
  function fold(text) {
    return String(text || '')
      .toLocaleLowerCase('tr-TR')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/ı/g, 'i');
  }

  function toast(message, { type = 'info', timeout = 3200, action } = {}) {
    const host = document.getElementById('toast-host');
    if (!host) return;
    const node = document.createElement('div');
    node.className = 'toast' + (type === 'error' ? ' toast--error' : '');
    node.innerHTML = `<span>${esc(message)}</span>`;
    if (action) {
      const btn = document.createElement('button');
      btn.textContent = action.label;
      btn.addEventListener('click', () => {
        action.run();
        node.remove();
      });
      node.appendChild(btn);
    }
    host.appendChild(node);
    setTimeout(() => node.remove(), timeout);
  }

  /** Platforma göre kısayol etiketi: macOS'ta ⌘, diğerlerinde Ctrl */
  function shortcut(keys) {
    const mac = /Mac|iPhone|iPad/.test(navigator.platform) || (window.desktop && window.desktop.platform === 'darwin');
    return mac ? keys.replace(/Mod\+/g, '⌘').replace(/Shift\+/g, '⇧') : keys.replace(/Mod\+/g, 'Ctrl+');
  }

  Object.assign(TTP, {
    esc,
    $,
    $$,
    debounce,
    uid,
    parseHex,
    normalizeHex,
    luminance,
    contrastText,
    mix,
    withAlpha,
    compareIds,
    slugify,
    formatDate,
    fold,
    toast,
    shortcut,
  });
})();
