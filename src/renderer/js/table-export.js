/* Seçili TTP'leri rapora yapıştırılabilir tablo olarak dışa aktarır (Markdown / CSV). */
(function () {
  'use strict';

  const TTP = window.TTP;
  const { data } = TTP;

  /** Kill chain sırasında, taktik başına bir satır: [{tactic, tech, item}] */
  function rows(doc) {
    const out = [];
    for (const tactic of data.tactics) {
      const list = Object.entries(doc.items)
        .filter(([, it]) => it.tactics.includes(tactic.short))
        .map(([tid, item]) => ({ tactic, tech: data.techById.get(tid), item }))
        .sort((a, b) => TTP.compareIds(a.tech.id, b.tech.id));
      out.push(...list);
    }
    return out;
  }

  function legendLabel(doc, color) {
    const l = doc.legend.find((x) => x.color === color);
    return l && l.label ? l.label : color;
  }

  function techName(t) {
    return t.sub ? `${data.techById.get(t.parent).name}: ${t.name}` : t.name;
  }

  function procedureText(p) {
    return p.source ? `${p.text} (${p.source})` : p.text;
  }

  function toMarkdown(doc) {
    const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');
    const lines = [];
    if (doc.meta.title) lines.push(`# ${doc.meta.title}`, '');
    if (doc.meta.subtitle) lines.push(`_${doc.meta.subtitle}_`, '');
    if (doc.meta.description) lines.push(doc.meta.description, '');
    lines.push('| Taktik | ID | Teknik | Değerlendirme | Prosedürler |', '| --- | --- | --- | --- | --- |');
    for (const r of rows(doc)) {
      const procs = r.item.procedures.map((p) => '• ' + cell(procedureText(p))).join('<br>');
      lines.push(
        `| ${cell(r.tactic.name)} | [${r.tech.id}](${data.attackUrl(r.tech.id)}) | ${cell(techName(r.tech))} | ` +
          `${cell(legendLabel(doc, r.item.color))} | ${procs || '—'} |`
      );
    }
    lines.push('', `_MITRE ATT&CK® Enterprise v${data.version} · ${TTP.formatDate()}_`, '');
    return lines.join('\n');
  }

  function toCsv(doc) {
    const q = (s) => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
    const header = ['Taktik ID', 'Taktik', 'Teknik ID', 'Teknik', 'Renk', 'Değerlendirme', 'Prosedür', 'Kaynak', 'URL'];
    const lines = [header.map(q).join(',')];
    for (const r of rows(doc)) {
      const base = [r.tactic.id, r.tactic.name, r.tech.id, techName(r.tech), r.item.color, legendLabel(doc, r.item.color)];
      const procs = r.item.procedures.length ? r.item.procedures : [{ text: '', source: '' }];
      for (const p of procs) lines.push([...base, p.text, p.source, data.attackUrl(r.tech.id)].map(q).join(','));
    }
    // UTF-8 BOM: Excel'in Türkçe karakterleri doğru okuması için
    return '﻿' + lines.join('\r\n') + '\r\n';
  }

  TTP.tableExport = { rows, toMarkdown, toCsv };
})();
