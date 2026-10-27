'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { build, cleanText, summarize } = require('../scripts/build-attack-data');

test('cleanText citation, markdown bağlantısı ve HTML etiketlerini temizler', () => {
  const raw =
    'Adversaries may use [PowerShell](https://attack.mitre.org/techniques/T1059/001) to run <code>Invoke-Expression</code>.(Citation: Example 2020)';
  assert.equal(cleanText(raw), 'Adversaries may use PowerShell to run `Invoke-Expression`.');
});

test('summarize ilk paragrafı alır ve uzun metni cümle sınırında keser', () => {
  assert.equal(summarize('Birinci paragraf.\n\nİkinci paragraf.'), 'Birinci paragraf.');
  const long = 'Bu bir cümle. '.repeat(60);
  const out = summarize(long, 100);
  assert.ok(out.length <= 100);
  assert.ok(out.endsWith('.'));
});

test('build küçük bir STIX paketinden taktik, teknik ve prosedür üretir', () => {
  const ref = (id) => [{ source_name: 'mitre-attack', external_id: id }];
  const bundle = {
    objects: [
      { type: 'x-mitre-collection', x_mitre_version: '99.0' },
      { type: 'x-mitre-matrix', id: 'm', tactic_refs: ['ta1', 'ta2'] },
      { type: 'x-mitre-tactic', id: 'ta1', name: 'Execution', x_mitre_shortname: 'execution', external_references: ref('TA0002') },
      { type: 'x-mitre-tactic', id: 'ta2', name: 'Impact', x_mitre_shortname: 'impact', external_references: ref('TA0040') },
      {
        type: 'attack-pattern',
        id: 'ap1',
        name: 'Command and Scripting Interpreter',
        kill_chain_phases: [{ kill_chain_name: 'mitre-attack', phase_name: 'execution' }],
        external_references: ref('T1059'),
      },
      {
        type: 'attack-pattern',
        id: 'ap2',
        name: 'PowerShell',
        x_mitre_is_subtechnique: true,
        kill_chain_phases: [{ kill_chain_name: 'mitre-attack', phase_name: 'execution' }],
        external_references: ref('T1059.001'),
      },
      { type: 'attack-pattern', id: 'old', name: 'Revoked', revoked: true, external_references: ref('T9999') },
      { type: 'intrusion-set', id: 'g1', name: 'APT-TEST', aliases: ['APT-TEST', 'Test Bear'], external_references: ref('G9001') },
      { type: 'relationship', relationship_type: 'uses', source_ref: 'g1', target_ref: 'ap2', description: 'APT-TEST used PowerShell.(Citation: X)' },
      { type: 'relationship', relationship_type: 'uses', source_ref: 'g1', target_ref: 'old', description: 'ignored' },
    ],
  };
  const data = build(bundle);
  assert.equal(data.version, '99.0');
  assert.deepEqual(data.tactics.map((t) => t.short), ['execution', 'impact']);
  assert.deepEqual(data.techniques.map((t) => t.id), ['T1059', 'T1059.001']);
  assert.equal(data.techniques[1].parent, 'T1059');
  assert.equal(data.actors.length, 1);
  assert.deepEqual(data.actors[0].aliases, ['Test Bear']);
  assert.deepEqual(data.actors[0].uses, [['T1059.001', 'APT-TEST used PowerShell.']]);
});
