/* ATT&CK veri dizinleri: window.ATTACK_DATA üzerinden hızlı erişim yapıları. */
(function () {
  'use strict';

  const TTP = window.TTP;
  const raw = window.ATTACK_DATA;
  if (!raw) throw new Error('ATT&CK verisi yüklenemedi (data/attack-data.js).');

  const tactics = raw.tactics;
  const tacticByShort = new Map(tactics.map((t) => [t.short, t]));
  const tacticById = new Map(tactics.map((t) => [t.id, t]));

  const techniques = raw.techniques;
  const techById = new Map(techniques.map((t) => [t.id, t]));

  /** Ana teknik ID -> alt teknikleri (ID sırasında) */
  const children = new Map();
  for (const t of techniques) {
    if (!t.sub) continue;
    if (!children.has(t.parent)) children.set(t.parent, []);
    children.get(t.parent).push(t);
  }

  /** Taktik kısa adı -> o taktikteki ana teknikler (ada göre sıralı) */
  const byTactic = new Map(tactics.map((t) => [t.short, []]));
  for (const t of techniques) {
    if (t.sub) continue;
    for (const short of t.tactics) {
      if (byTactic.has(short)) byTactic.get(short).push(t);
    }
  }
  for (const list of byTactic.values()) list.sort((a, b) => a.name.localeCompare(b.name));

  const actors = raw.actors;
  const actorById = new Map(actors.map((a) => [a.id, a]));

  let examplesIndex = null;
  /** Teknik ID -> MITRE prosedür örnekleri [{actor, text}] (ilk kullanımda oluşturulur) */
  function examplesFor(techId) {
    if (!examplesIndex) {
      examplesIndex = new Map();
      for (const actor of actors) {
        for (const [tid, text] of actor.uses) {
          if (!text) continue;
          if (!examplesIndex.has(tid)) examplesIndex.set(tid, []);
          examplesIndex.get(tid).push({ actor, text });
        }
      }
      const order = { group: 0, campaign: 1, software: 2 };
      for (const list of examplesIndex.values()) {
        list.sort((a, b) => order[a.actor.type] - order[b.actor.type] || a.actor.name.localeCompare(b.actor.name));
      }
    }
    return examplesIndex.get(techId) || [];
  }

  /** Bir tekniğin geçerli taktikleri (alt teknikler ana teknikle aynı taktiklerde) */
  function tacticsOf(techId) {
    const t = techById.get(techId);
    return t ? t.tactics.filter((s) => tacticByShort.has(s)) : [];
  }

  function attackUrl(id) {
    if (/^TA\d+/.test(id)) return `https://attack.mitre.org/tactics/${id}/`;
    if (/^G\d+/.test(id)) return `https://attack.mitre.org/groups/${id}/`;
    if (/^C\d+/.test(id)) return `https://attack.mitre.org/campaigns/${id}/`;
    if (/^S\d+/.test(id)) return `https://attack.mitre.org/software/${id}/`;
    return `https://attack.mitre.org/techniques/${id.replace('.', '/')}/`;
  }

  const ACTOR_TYPE_LABEL = { group: 'Grup', campaign: 'Kampanya', software: 'Yazılım' };

  TTP.data = {
    version: raw.version,
    domain: raw.domain,
    tactics,
    tacticByShort,
    tacticById,
    techniques,
    techById,
    children,
    byTactic,
    actors,
    actorById,
    examplesFor,
    tacticsOf,
    attackUrl,
    ACTOR_TYPE_LABEL,
  };
})();
