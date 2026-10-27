'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadRenderer, plain } = require('./load-renderer');

const { data } = loadRenderer(['data/attack-data.js', 'js/util.js', 'js/data.js']);

test('paketlenmiş veri ATT&CK v20 Enterprise içerir', () => {
  assert.equal(data.domain, 'enterprise-attack');
  assert.match(String(data.version), /^20\./);
  assert.equal(data.tactics.length, 15);
});

test('her tekniğin taktikleri matristeki taktiklerdir', () => {
  for (const t of data.techniques) {
    assert.ok(t.tactics.length > 0, `${t.id} taktiksiz`);
    for (const s of t.tactics) assert.ok(data.tacticByShort.has(s), `${t.id}: bilinmeyen taktik ${s}`);
  }
});

test('her alt tekniğin ana tekniği vardır ve aynı taktiklerdedir', () => {
  for (const t of data.techniques.filter((x) => x.sub)) {
    const parent = data.techById.get(t.parent);
    assert.ok(parent, `${t.id}: ana teknik yok`);
    for (const s of t.tactics) assert.ok(parent.tactics.includes(s), `${t.id}: ${s} ana teknikte yok`);
  }
});

test('tehdit profilleri yalnızca mevcut tekniklere başvurur', () => {
  for (const a of data.actors) {
    for (const [tid] of a.uses) assert.ok(data.techById.has(tid), `${a.id}: ${tid}`);
  }
  const apt29 = data.actorById.get('G0016');
  assert.equal(apt29.name, 'APT29');
  assert.ok(data.examplesFor('T1059.001').some((e) => e.actor.id === 'G0016'));
});

test('attackUrl doğru ATT&CK sayfalarını üretir', () => {
  assert.equal(data.attackUrl('T1059.001'), 'https://attack.mitre.org/techniques/T1059/001/');
  assert.equal(data.attackUrl('TA0002'), 'https://attack.mitre.org/tactics/TA0002/');
  assert.equal(data.attackUrl('G0016'), 'https://attack.mitre.org/groups/G0016/');
});
