/*
 * Proje dosyası ve MITRE ATT&CK Navigator katmanı (layer format 4.5)
 * dönüştürmeleri. Navigator ile çift yönlü uyumluluk sağlar.
 */
(function () {
  'use strict';

  const TTP = window.TTP;
  const { data } = TTP;

  /* ---------------------------------------------------------------- project */

  function serializeProject(doc) {
    return JSON.stringify({ ...doc, attackVersion: data.version, savedAt: new Date().toISOString() }, null, 2);
  }

  /** JSON metnini tanır: panel projesi mi, Navigator katmanı mı? */
  function detect(json) {
    if (json && json.format === 'attack-ttp-panel') return 'project';
    if (json && Array.isArray(json.techniques) && (json.versions || json.domain || json.name !== undefined)) return 'layer';
    return null;
  }

  /* -------------------------------------------------------------- navigator */

  function toLayer(doc) {
    const techniques = [];
    for (const [tid, it] of Object.entries(doc.items)) {
      if (!it.tactics.length) continue;
      const comment = it.procedures.map((p) => (p.source ? `${p.text} [${p.source}]` : p.text)).join('\n\n');
      const metadata = it.procedures.map((p) => ({ name: 'procedure', value: p.source ? `${p.text} [${p.source}]` : p.text }));
      for (const tactic of it.tactics) {
        techniques.push({
          techniqueID: tid,
          tactic,
          color: it.color,
          comment,
          enabled: true,
          metadata,
          links: [],
          showSubtechniques: true,
        });
      }
    }
    // Navigator alt teknikleri ancak ana teknik açıkken gösterir
    const parentsWithSubs = new Set(techniques.filter((t) => t.techniqueID.includes('.')).map((t) => t.techniqueID.split('.')[0]));
    for (const pid of parentsWithSubs) {
      for (const tactic of data.tacticsOf(pid)) {
        if (!techniques.some((t) => t.techniqueID === pid && t.tactic === tactic)) {
          techniques.push({ techniqueID: pid, tactic, enabled: true, metadata: [], links: [], showSubtechniques: true });
        }
      }
    }

    const usedColors = new Set(Object.values(doc.items).filter((i) => i.tactics.length).map((i) => i.color));
    return {
      name: doc.meta.title || 'ATT&CK TTP Panel',
      versions: { attack: String(data.version).split('.')[0], navigator: '5.1.0', layer: '4.5' },
      domain: data.domain,
      description: [doc.meta.subtitle, doc.meta.description].filter(Boolean).join('\n\n'),
      filters: {},
      sorting: 0,
      layout: {
        layout: 'side',
        aggregateFunction: 'average',
        showID: true,
        showName: true,
        showAggregateScores: false,
        countUnscored: false,
        expandedSubtechniques: 'annotated',
      },
      hideDisabled: false,
      techniques,
      gradient: { colors: ['#ff6666ff', '#ffe766ff', '#8ec843ff'], minValue: 0, maxValue: 100 },
      legendItems: doc.legend.filter((l) => l.label && usedColors.has(l.color)).map((l) => ({ label: l.label, color: l.color })),
      metadata: doc.meta.author ? [{ name: 'author', value: doc.meta.author }] : [],
      links: [],
      showTacticRowBackground: false,
      tacticRowBackground: '#dddddd',
      selectTechniquesAcrossTactics: false,
      selectSubtechniquesWithParent: false,
      selectVisibleTechniques: false,
    };
  }

  function stripAlpha(color) {
    const m = /^#?([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(String(color || '').trim());
    return m ? '#' + m[1] : null;
  }

  /**
   * Navigator katmanını panel projesine dönüştürür.
   * @returns {{doc: object, imported: number, skipped: string[]}}
   */
  function fromLayer(layer, fallbackColor) {
    const doc = TTP.store.normalizeDoc({});
    doc.meta.title = layer.name || '';
    doc.meta.description = layer.description || '';
    doc.legend = (layer.legendItems || [])
      .map((l) => ({ id: TTP.uid(), color: stripAlpha(l.color), label: l.label || '' }))
      .filter((l) => l.color);
    if (!doc.legend.length) doc.legend = TTP.store.normalizeDoc({}).legend;
    doc.activeColor = (doc.legend[0] && doc.legend[0].color) || fallbackColor || doc.activeColor;

    const skipped = new Set();
    let imported = 0;
    for (const t of layer.techniques || []) {
      const tid = t.techniqueID;
      if (!data.techById.has(tid)) {
        if (tid) skipped.add(tid);
        continue;
      }
      const hasScore = t.score !== undefined && t.score !== null && t.score !== '';
      const annotated = !!(stripAlpha(t.color) || hasScore || (t.comment && t.comment.trim()));
      if (!annotated || t.enabled === false) continue;

      const valid = data.tacticsOf(tid);
      const tactics = t.tactic && valid.includes(t.tactic) ? [t.tactic] : valid;
      let it = doc.items[tid];
      if (!it) {
        it = doc.items[tid] = { color: stripAlpha(t.color) || doc.activeColor, tactics: [], procedures: [] };
        imported++;
      }
      it.tactics = valid.filter((s) => it.tactics.includes(s) || tactics.includes(s));

      const procs = (t.metadata || []).filter((m) => m && /^procedure$/i.test(m.name) && m.value).map((m) => m.value);
      const texts = procs.length ? procs : t.comment && t.comment.trim() ? [t.comment.trim()] : [];
      for (const raw of texts) {
        const m = /^([\s\S]*?)\s*\[([^\]]+)\]$/.exec(raw);
        const text = m ? m[1] : raw;
        const source = m ? m[2] : '';
        if (!it.procedures.some((p) => p.text === text)) it.procedures.push({ id: TTP.uid(), text, source });
      }
    }
    return { doc, imported, skipped: [...skipped] };
  }

  TTP.layerIO = { serializeProject, detect, toLayer, fromLayer };
})();
