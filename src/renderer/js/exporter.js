/*
 * Görsel dışa aktarıcı: yalnızca seçilen taktik/teknik/prosedürleri içeren
 * bağımsız bir SVG üretir; PNG bu SVG'nin rasterleştirilmesiyle elde edilir.
 * Metin ölçümü canvas ile yapılır, böylece satır kaydırma her iki çıktıda aynıdır.
 */
(function () {
  'use strict';

  const TTP = window.TTP;
  const { data } = TTP;

  const FONT = "'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Roboto, Arial, sans-serif";
  const MONO = "'Cascadia Mono', 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace";

  const THEMES = {
    light: {
      bg: '#ffffff',
      text: '#111827',
      text2: '#4b5563',
      text3: '#8b93a1',
      accent: '#3e63dd',
      card: '#ffffff',
      cardBorder: '#e3e7ee',
      neutral: '#eef1f6',
      neutralText: '#1f2937',
      header: '#1c2333',
      headerText: '#ffffff',
      emptyHeader: '#f1f3f7',
      emptyHeaderText: '#a0a7b4',
      kcIdle: '#f1f3f7',
      kcIdleText: '#a3aab6',
      rule: '#e5e7eb',
      shadow: 'rgba(17,24,39,0.06)',
    },
    dark: {
      bg: '#0f1218',
      text: '#e8ebf2',
      text2: '#aab2c3',
      text3: '#6c7588',
      accent: '#7b96f7',
      card: '#171b24',
      cardBorder: '#2a3140',
      neutral: '#222836',
      neutralText: '#e8ebf2',
      header: '#2b3346',
      headerText: '#ffffff',
      emptyHeader: '#181c25',
      emptyHeaderText: '#556075',
      kcIdle: '#191e28',
      kcIdleText: '#566073',
      rule: '#262d3b',
      shadow: 'rgba(0,0,0,0.35)',
    },
  };

  /* ----------------------------------------------------------- text tools */

  const ctx = document.createElement('canvas').getContext('2d');
  const widthCache = new Map();

  function font(size, weight = 400, family = FONT, style = 'normal') {
    return { size, weight, family, style, css: `${style} ${weight} ${size}px ${family}` };
  }

  function measure(text, f) {
    const key = f.css + '\u0000' + text;
    let w = widthCache.get(key);
    if (w === undefined) {
      ctx.font = f.css;
      w = ctx.measureText(text).width;
      if (widthCache.size > 20000) widthCache.clear();
      widthCache.set(key, w);
    }
    return w;
  }

  /** Metni verilen genişliğe sığacak satırlara böler (çok uzun kelimeleri de keser). */
  function wrap(text, f, maxWidth, maxLines = Infinity) {
    const lines = [];
    for (const para of String(text || '').split(/\n+/)) {
      const words = para.split(/\s+/).filter(Boolean);
      let line = '';
      for (let word of words) {
        const candidate = line ? line + ' ' + word : word;
        if (measure(candidate, f) <= maxWidth) {
          line = candidate;
          continue;
        }
        if (line) lines.push(line);
        // Tek başına sığmayan kelimeyi karakter bazında böl
        while (measure(word, f) > maxWidth && word.length > 1) {
          let i = word.length - 1;
          while (i > 1 && measure(word.slice(0, i), f) > maxWidth) i--;
          lines.push(word.slice(0, i));
          word = word.slice(i);
        }
        line = word;
      }
      if (line) lines.push(line);
    }
    if (lines.length > maxLines) {
      const kept = lines.slice(0, maxLines);
      let last = kept[maxLines - 1];
      while (last && measure(last + '…', f) > maxWidth) last = last.slice(0, -1);
      kept[maxLines - 1] = last.replace(/\s+$/, '') + '…';
      return kept;
    }
    return lines;
  }

  const xml = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);

  function textEl(x, y, str, f, fill, extra = '') {
    const attrs =
      `x="${r(x)}" y="${r(y)}" font-size="${f.size}" fill="${fill}"` +
      (f.weight !== 400 ? ` font-weight="${f.weight}"` : '') +
      (f.family !== FONT ? ` font-family="${f.family.replace(/"/g, "'")}"` : '') +
      (f.style !== 'normal' ? ` font-style="${f.style}"` : '');
    return `<text ${attrs}${extra}>${xml(str)}</text>`;
  }

  /** Satır listesi çizer; y ilk satırın üst kenarıdır. */
  function lines(x, y, list, f, lineHeight, fill, extra = '') {
    const baseline = (lineHeight + f.size * 0.72) / 2;
    return list.map((l, i) => textEl(x, y + i * lineHeight + baseline, l, f, fill, extra)).join('');
  }

  const r = (n) => Math.round(n * 100) / 100;

  function rect(x, y, w, h, rx, fill, extra = '') {
    return `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" rx="${rx}" fill="${fill}"${extra}/>`;
  }

  /** Yalnızca üst köşeleri yuvarlatılmış dikdörtgen */
  function topRounded(x, y, w, h, rad, fill) {
    return (
      `<path d="M${r(x)},${r(y + h)} V${r(y + rad)} A${rad},${rad} 0 0 1 ${r(x + rad)},${r(y)} ` +
      `H${r(x + w - rad)} A${rad},${rad} 0 0 1 ${r(x + w)},${r(y + rad)} V${r(y + h)} Z" fill="${fill}"/>`
    );
  }

  /* ---------------------------------------------------------- selection */

  /**
   * Seçimleri görsel modeline dönüştürür:
   * [{tactic, color|null, groups: [{tech, item|null, subs: [{tech, item}]}]}]
   */
  function collect(doc, opts) {
    const result = [];
    for (const tactic of data.tactics) {
      const groups = new Map();
      for (const [tid, it] of Object.entries(doc.items)) {
        if (!it.tactics.includes(tactic.short)) continue;
        const t = data.techById.get(tid);
        const pid = t.sub ? t.parent : t.id;
        if (!groups.has(pid)) groups.set(pid, { tech: data.techById.get(pid), item: null, subs: [] });
        const g = groups.get(pid);
        if (t.sub) g.subs.push({ tech: t, item: it });
        else g.item = it;
      }
      const tSel = doc.tactics[tactic.short];
      if (!groups.size && !tSel && !opts.showEmptyTactics) continue;
      const list = [...groups.values()].sort((a, b) => a.tech.name.localeCompare(b.tech.name));
      list.forEach((g) => g.subs.sort((a, b) => TTP.compareIds(a.tech.id, b.tech.id)));
      result.push({ tactic, color: tSel ? tSel.color : null, groups: list, selected: !!(groups.size || tSel) });
    }
    return result;
  }

  /* --------------------------------------------------------------- cards */

  const F = {
    eyebrow: font(11, 700),
    title: font(30, 700),
    subtitle: font(16, 500),
    desc: font(13),
    stat: font(20, 700),
    statLabel: font(11, 600),
    colHead: font(14, 700),
    colMeta: font(11, 500),
    techId: font(10.5, 600, MONO),
    techName: font(13, 700),
    subName: font(12, 600),
    subId: font(10, 600, MONO),
    proc: font(11.5),
    procSource: font(10.5, 400, FONT, 'italic'),
    techDesc: font(11, 400, FONT, 'italic'),
    legendTitle: font(11, 700),
    legend: font(12, 500),
    footer: font(11),
  };

  /** Bir teknik kartını ölçer; draw(x, y) SVG döndürür. */
  function buildCard(group, width, opts, theme) {
    const pad = 12;
    const inner = width - pad * 2;
    const parts = [];
    const parentSel = !!group.item;
    const titleFill = parentSel ? group.item.color : theme.neutral;
    const titleText = parentSel ? TTP.contrastText(group.item.color) : theme.neutralText;

    // Başlık
    const idH = opts.showIds ? 15 : 0;
    const nameLines = wrap(group.tech.name, F.techName, inner);
    const titleH = 10 + idH + nameLines.length * 17 + 9;

    // Gövde öğeleri sırayla ölçülür
    const body = [];
    const procBlock = (procs, indent, bullet) => {
      for (const p of procs) {
        const tl = wrap(p.text, F.proc, inner - indent - 11);
        const sl = opts.showProcedureSource && p.source ? wrap('— ' + p.source, F.procSource, inner - indent - 11) : [];
        const h = tl.length * 16 + sl.length * 14;
        body.push({
          h,
          gap: 7,
          draw: (x, y) =>
            `<circle cx="${r(x + indent + 3)}" cy="${r(y + 8)}" r="2.6" fill="${bullet}"/>` +
            lines(x + indent + 11, y, tl, F.proc, 16, theme.text) +
            lines(x + indent + 11, y + tl.length * 16, sl, F.procSource, 14, theme.text3),
        });
      }
    };

    if (opts.showDescriptions && group.tech.desc) {
      const dl = wrap(group.tech.desc, F.techDesc, inner, 4);
      body.push({ h: dl.length * 15, gap: 8, draw: (x, y) => lines(x, y, dl, F.techDesc, 15, theme.text2) });
    }
    if (opts.showProcedures && parentSel) procBlock(group.item.procedures, 0, group.item.color);

    for (const s of group.subs) {
      const idW = opts.showIds ? measure(s.tech.id, F.subId) + 10 : 0;
      const nl = wrap(s.tech.name, F.subName, inner - 18 - idW);
      const ph = 7 + nl.length * 16 + 6;
      const fill = s.item.color;
      const fg = TTP.contrastText(fill);
      body.push({
        h: ph,
        gap: 8,
        draw: (x, y) =>
          rect(x, y, inner, ph, 6, fill) +
          lines(x + 9, y + 7, nl, F.subName, 16, fg) +
          (opts.showIds ? textEl(x + inner - 9, y + 7 + 12, s.tech.id, F.subId, fg, ' text-anchor="end" opacity="0.8"') : ''),
      });
      if (opts.showProcedures) procBlock(s.item.procedures, 10, fill);
    }

    const bodyH = body.length ? 11 + body.reduce((sum, b, i) => sum + b.h + (i ? b.gap : 0), 0) + 12 : 0;
    const height = titleH + bodyH;

    function draw(x, y) {
      parts.length = 0;
      if (bodyH) {
        parts.push(rect(x, y, width, height, 10, theme.card, ` stroke="${theme.cardBorder}"`));
        parts.push(topRounded(x, y, width, titleH, 10, titleFill));
      } else {
        parts.push(rect(x, y, width, height, 10, titleFill, parentSel ? '' : ` stroke="${theme.cardBorder}"`));
      }
      if (!parentSel) {
        // Ana teknik seçili değil: yalnızca alt teknikleri gruplayan kapsayıcı
        parts.push(rect(x + 0.5, y + 0.5, width - 1, titleH - 0.5, 10, 'none', ` stroke="${theme.cardBorder}" stroke-dasharray="3 3"`));
      }
      let cy = y + 10;
      if (opts.showIds) {
        parts.push(textEl(x + pad, cy + 10.5, group.tech.id, F.techId, titleText, ' opacity="0.78"'));
        cy += idH;
      }
      parts.push(lines(x + pad, cy, nameLines, F.techName, 17, titleText));
      cy = y + titleH + 11;
      body.forEach((b, i) => {
        if (i) cy += b.gap;
        parts.push(b.draw(x + pad, cy));
        cy += b.h;
      });
      return parts.join('');
    }

    return { height, draw };
  }

  function tacticHeader(col, width, theme, opts) {
    const fill = col.color || (col.selected ? theme.header : theme.emptyHeader);
    const fg = col.color ? TTP.contrastText(col.color) : col.selected ? theme.headerText : theme.emptyHeaderText;
    const nl = wrap(col.tactic.name, F.colHead, width - 24, 2);
    const count = col.groups.reduce((n, g) => n + (g.item ? 1 : 0) + g.subs.length, 0);
    const meta = `${opts.showIds ? col.tactic.id + ' · ' : ''}${count} teknik`;
    const height = 11 + nl.length * 18 + 16 + 9;
    return {
      height,
      fill,
      draw: (x, y) =>
        rect(x, y, width, height, 10, fill) +
        lines(x + 12, y + 11, nl, F.colHead, 18, fg) +
        textEl(x + 12, y + 11 + nl.length * 18 + 12, meta, F.colMeta, fg, ' opacity="0.72"'),
    };
  }

  /* ------------------------------------------------------- page sections */

  function headerSection(doc, opts, theme, width, stats) {
    const out = [];
    let h = 0;
    const meta = doc.meta;
    out.push((x, y) => textEl(x, y + 11, 'MITRE ATT&CK® · TTP PROFİLİ', F.eyebrow, theme.accent, ' letter-spacing="1.6"'));
    h += 24;
    const tl = wrap(meta.title || 'Tehdit Aktörü TTP Profili', F.title, width, 3);
    const th = h;
    out.push((x, y) => lines(x, y + th, tl, F.title, 38, theme.text));
    h += tl.length * 38;
    if (meta.subtitle) {
      const sl = wrap(meta.subtitle, F.subtitle, width, 3);
      const sh = h + 2;
      out.push((x, y) => lines(x, y + sh, sl, F.subtitle, 22, theme.text2));
      h += 2 + sl.length * 22;
    }
    if (meta.description) {
      const dl = wrap(meta.description, F.desc, Math.min(width, 980));
      const dh = h + 8;
      out.push((x, y) => lines(x, y + dh, dl, F.desc, 19, theme.text2));
      h += 8 + dl.length * 19;
    }
    // İstatistikler
    const items = [
      [stats.tactics, 'TAKTİK'],
      [stats.techniques, 'TEKNİK'],
      [stats.subs, 'ALT TEKNİK'],
      [stats.procedures, 'PROSEDÜR'],
    ];
    const sh = h + 16;
    out.push((x, y) => {
      let cx = x;
      return items
        .map(([n, label]) => {
          const w = Math.max(measure(String(n), F.stat), measure(label, F.statLabel)) + 28;
          const svg =
            rect(cx, y + sh, w, 50, 8, theme.neutral) +
            textEl(cx + 14, y + sh + 24, String(n), F.stat, theme.text) +
            textEl(cx + 14, y + sh + 40, label, F.statLabel, theme.text3, ' letter-spacing="0.8"');
          cx += w + 8;
          return svg;
        })
        .join('');
    });
    h += 16 + 50;
    return { height: h, draw: (x, y) => out.map((fn) => fn(x, y)).join('') };
  }

  /** Taktik adını kelime bölmeden en fazla 2 satıra sığdırmak için yazı boyutunu küçültür. */
  function fitLabel(text, maxWidth) {
    for (const size of [10.5, 9.5, 8.5, 7.5]) {
      const f = font(size, 700);
      const fits = text.split(/\s+/).every((w) => measure(w, f) <= maxWidth);
      const list = wrap(text, f, maxWidth, 2);
      if (fits && !list[list.length - 1].endsWith('…')) return { list, f };
    }
    return { list: wrap(text, font(7.5, 700), maxWidth, 2), f: font(7.5, 700) };
  }

  function killChainSection(columns, theme, width) {
    const used = new Map(columns.filter((c) => c.selected).map((c) => [c.tactic.short, c]));
    const n = data.tactics.length;
    const gap = 3;
    const segW = (width - gap * (n - 1)) / n;
    const h = 44;
    const tip = 9;
    const draw = (x, y) =>
      data.tactics
        .map((t, i) => {
          const sx = x + i * (segW + gap);
          const col = used.get(t.short);
          const fill = col ? col.color || theme.header : theme.kcIdle;
          const fg = col ? (col.color ? TTP.contrastText(col.color) : theme.headerText) : theme.kcIdleText;
          const left = i === 0 ? `M${r(sx)},${r(y)}` : `M${r(sx - tip + gap)},${r(y)}`;
          const notch = i === 0 ? '' : ` L${r(sx + gap)},${r(y + h / 2)}`;
          const tipPts = i === n - 1 ? `L${r(sx + segW)},${r(y)} L${r(sx + segW)},${r(y + h)}` : `L${r(sx + segW - tip)},${r(y)} L${r(sx + segW)},${r(y + h / 2)} L${r(sx + segW - tip)},${r(y + h)}`;
          const start = i === 0 ? `L${r(sx)},${r(y + h)} Z` : `L${r(sx - tip + gap)},${r(y + h)}${notch} Z`;
          const path = `<path d="${left} ${tipPts} ${start}" fill="${fill}"/>`;
          const { list: tl, f } = fitLabel(t.name, segW - (i === 0 ? 10 : 16) - tip);
          const cx = sx + (i === 0 ? segW / 2 - tip / 2 : segW / 2);
          const lh = f.size + 2.5;
          const ty = y + (h - tl.length * lh) / 2;
          return path + lines(cx, ty, tl, f, lh, fg, ' text-anchor="middle"');
        })
        .join('');
    return { height: h, draw };
  }

  function legendSection(doc, theme, width) {
    const usage = new Set();
    for (const it of Object.values(doc.items)) if (it.tactics.length) usage.add(it.color);
    for (const t of Object.values(doc.tactics)) usage.add(t.color);
    const entries = doc.legend.filter((l) => l.label && usage.has(l.color));
    if (!entries.length) return null;

    const rows = [[]];
    const label = 'LEJANT';
    let cx = measure(label, F.legendTitle) + 24;
    for (const e of entries) {
      const w = 16 + 8 + measure(e.label, F.legend) + 26;
      if (cx + w > width && rows[rows.length - 1].length) {
        rows.push([]);
        cx = measure(label, F.legendTitle) + 24;
      }
      rows[rows.length - 1].push({ e, x: cx });
      cx += w;
    }
    const height = rows.length * 26;
    return {
      height,
      draw: (x, y) =>
        textEl(x, y + 17, label, F.legendTitle, theme.text3, ' letter-spacing="1.2"') +
        rows
          .map((row, ri) =>
            row
              .map(
                ({ e, x: lx }) =>
                  rect(x + lx, y + ri * 26 + 5, 16, 16, 4, e.color) +
                  textEl(x + lx + 24, y + ri * 26 + 17.5, e.label, F.legend, theme.text2)
              )
              .join('')
          )
          .join(''),
    };
  }

  function footerSection(doc, theme, width) {
    const left = `MITRE ATT&CK® Enterprise v${data.version} · attack.mitre.org`;
    const right = [doc.meta.author ? 'Hazırlayan: ' + doc.meta.author : '', TTP.formatDate()].filter(Boolean).join(' · ');
    return {
      height: 36,
      draw: (x, y) =>
        `<line x1="${r(x)}" y1="${r(y + 0.5)}" x2="${r(x + width)}" y2="${r(y + 0.5)}" stroke="${theme.rule}"/>` +
        textEl(x, y + 24, left, F.footer, theme.text3) +
        textEl(x + width, y + 24, right, F.footer, theme.text3, ' text-anchor="end"'),
    };
  }

  /* ------------------------------------------------------------- layouts */

  function matrixBody(columns, opts, theme, contentW) {
    const gap = 14;
    const n = columns.length;
    const colW = Math.max(opts.columnWidth, Math.min(440, (contentW - gap * (n - 1)) / n));
    const cols = columns.map((col) => {
      const head = tacticHeader(col, colW, theme, opts);
      const cards = col.groups.map((g) => buildCard(g, colW, opts, theme));
      const h = head.height + cards.reduce((s, c) => s + 10 + c.height, 0);
      return { col, head, cards, h: cards.length ? h : head.height + 10 + 44 };
    });
    const width = n * colW + (n - 1) * gap;
    const height = Math.max(...cols.map((c) => c.h));
    return {
      width,
      height,
      draw: (x, y) =>
        cols
          .map((c, i) => {
            const cx = x + i * (colW + gap);
            let out = c.head.draw(cx, y);
            let cy = y + c.head.height + 10;
            if (!c.cards.length) {
              out += rect(cx + 0.5, cy + 0.5, colW - 1, 43, 10, 'none', ` stroke="${theme.cardBorder}" stroke-dasharray="4 4"`);
              out += textEl(cx + colW / 2, cy + 26, 'Teknik seçilmedi', F.proc, theme.text3, ' text-anchor="middle"');
            }
            for (const card of c.cards) {
              out += card.draw(cx, cy);
              cy += card.height + 10;
            }
            return out;
          })
          .join(''),
    };
  }

  function flowBody(columns, opts, theme, contentW) {
    const labelW = 200;
    const gap = 12;
    const area = contentW - labelW - 18;
    const perRow = Math.max(1, Math.floor((area + gap) / (opts.columnWidth + gap)));
    const cardW = (area - gap * (perRow - 1)) / perRow;

    const rows = columns.map((col) => {
      const head = tacticHeader(col, labelW, theme, opts);
      // Kartları en kısa sütuna yerleştir (masonry)
      const heights = new Array(perRow).fill(0);
      const placed = col.groups.map((g) => {
        const card = buildCard(g, cardW, opts, theme);
        const i = heights.indexOf(Math.min(...heights));
        const pos = { card, col: i, y: heights[i] };
        heights[i] += card.height + gap;
        return pos;
      });
      const h = Math.max(head.height, Math.max(...heights) - gap, col.groups.length ? 0 : 44);
      return { col, head, placed, h };
    });

    const height = rows.reduce((s, row, i) => s + row.h + (i ? 22 : 0), 0);
    return {
      width: contentW,
      height,
      draw: (x, y) => {
        let cy = y;
        return rows
          .map((row, i) => {
            if (i) {
              cy += 11;
              const line = `<line x1="${r(x)}" y1="${r(cy)}" x2="${r(x + contentW)}" y2="${r(cy)}" stroke="${theme.rule}"/>`;
              cy += 11;
              row.svgPrefix = line;
            }
            let out = (row.svgPrefix || '') + rect(x, cy, labelW, row.h, 10, row.head.fill) + row.head.draw(x, cy);
            const ax = x + labelW + 18;
            if (!row.placed.length) {
              out += textEl(ax, cy + 26, 'Teknik seçilmedi', F.proc, theme.text3);
            }
            for (const p of row.placed) out += p.card.draw(ax + p.col * (cardW + gap), cy + p.y);
            cy += row.h;
            return out;
          })
          .join('');
      },
    };
  }

  /* ---------------------------------------------------------------- build */

  /**
   * @returns {{svg: string, width: number, height: number, empty: boolean}}
   */
  function buildSvg(doc, options) {
    const opts = { ...TTP.store.DEFAULT_EXPORT, ...(options || {}) };
    const theme = THEMES[opts.theme] || THEMES.light;
    const columns = collect(doc, opts);
    const hasSelection = columns.some((c) => c.selected);
    const stats = TTP.store.stats();

    const pad = 44;
    const n = Math.max(1, columns.length);
    const minW = opts.showKillChain ? data.tactics.length * 86 : 720;
    let contentW;
    if (opts.layout === 'flow') contentW = Math.max(minW, 1400);
    else contentW = Math.max(minW, n * opts.columnWidth + (n - 1) * 14);

    const sections = [];
    if (opts.showHeader) sections.push({ ...headerSection(doc, opts, theme, contentW, stats), gap: 26 });
    if (opts.showKillChain) sections.push({ ...killChainSection(columns, theme, contentW), gap: 26 });
    if (columns.length) {
      const body = opts.layout === 'flow' ? flowBody(columns, opts, theme, contentW) : matrixBody(columns, opts, theme, contentW);
      contentW = Math.max(contentW, body.width);
      sections.push({ ...body, gap: 28 });
    }
    if (opts.showLegend) {
      const legend = legendSection(doc, theme, contentW);
      if (legend) sections.push({ ...legend, gap: 18 });
    }
    if (opts.showFooter) sections.push({ ...footerSection(doc, theme, contentW), gap: 0 });

    // Kill chain ve alt bilgi son genişliğe göre yeniden ölçülür
    const final = sections.map((s) => s);
    if (opts.showKillChain) {
      const i = opts.showHeader ? 1 : 0;
      final[i] = { ...killChainSection(columns, theme, contentW), gap: 26 };
    }
    if (opts.showFooter) final[final.length - 1] = { ...footerSection(doc, theme, contentW), gap: 0 };

    const width = Math.ceil(contentW + pad * 2);
    let y = pad;
    const body = final
      .map((s, i) => {
        const svg = s.draw(pad, y);
        y += s.height + (i < final.length - 1 ? s.gap : 0);
        return svg;
      })
      .join('\n');
    const height = Math.ceil(y + pad - (opts.showFooter ? 14 : 0));

    const bg = opts.transparent ? '' : rect(0, 0, width, height, 0, theme.bg);
    const title = xml(doc.meta.title || 'ATT&CK TTP Profili');
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" ` +
      `font-family="${FONT.replace(/"/g, "'")}" text-rendering="geometricPrecision">\n` +
      `<title>${title}</title>\n` +
      `<desc>MITRE ATT&amp;CK Enterprise v${xml(data.version)} — ATT&amp;CK TTP Panel ile oluşturuldu</desc>\n` +
      `${bg}\n${body}\n</svg>\n`;
    return { svg, width, height, empty: !hasSelection };
  }

  const MAX_CANVAS = 16000;
  const MAX_AREA = 260e6;

  /**
   * SVG'yi PNG'ye dönüştürür.
   * @returns {Promise<{base64: string, blob: Blob, scale: number}>}
   */
  function toPng(svg, width, height, scale = 2) {
    let s = scale;
    // Tarayıcı canvas sınırlarını aşmamak için ölçeği gerekirse düşür
    while (s > 0.5 && (width * s > MAX_CANVAS || height * s > MAX_CANVAS || width * height * s * s > MAX_AREA)) s -= 0.25;
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(width * s);
        canvas.height = Math.round(height * s);
        const c = canvas.getContext('2d');
        c.scale(s, s);
        c.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error('PNG oluşturulamadı'));
          const reader = new FileReader();
          reader.onload = () => resolve({ base64: String(reader.result).split(',')[1], blob, scale: s });
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        }, 'image/png');
      };
      img.onerror = () => reject(new Error('SVG görüntüye dönüştürülemedi'));
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }

  TTP.exporter = { buildSvg, toPng, collect, wrap, THEMES };
})();
