'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadRenderer, plain } = require('./load-renderer');

test('Navigator katmanına dışa ve geri içe aktarma seçimleri korur', () => {
  const TTP = loadRenderer();
  const { store, layerIO } = TTP;
  store.reset();
  store.toggleTechnique('T1078', 'initial-access');
  store.toggleTechnique('T1059.001', 'execution');
  store.addProcedure('T1059.001', 'Kodlanmış PowerShell komutları', 'IR-2026-14');

  const layer = layerIO.toLayer(store.state.doc);
  assert.equal(layer.versions.layer, '4.5');
  assert.equal(layer.domain, 'enterprise-attack');
  // alt tekniğin görünmesi için ana teknik de katmanda yer alır
  assert.ok(layer.techniques.some((t) => t.techniqueID === 'T1059' && t.tactic === 'execution'));
  assert.equal(layerIO.detect(layer), 'layer');

  const { doc, imported, skipped } = layerIO.fromLayer(JSON.parse(JSON.stringify(layer)));
  assert.equal(imported, 2);
  assert.deepEqual(plain(skipped), []);
  assert.deepEqual(plain(doc.items.T1078.tactics), ['initial-access']);
  assert.deepEqual(plain(doc.items['T1059.001'].procedures.map((p) => [p.text, p.source])), [
    ['Kodlanmış PowerShell komutları', 'IR-2026-14'],
  ]);
  assert.equal(doc.items.T1059, undefined, 'renksiz ana teknik seçim sayılmaz');
});

test('dış Navigator katmanı: skor, yorum ve eskimiş ID işlenir', () => {
  const { layerIO } = loadRenderer();
  const layer = {
    name: 'Dış katman',
    versions: { layer: '4.5' },
    domain: 'enterprise-attack',
    techniques: [
      { techniqueID: 'T1566', score: 50 },
      { techniqueID: 'T1003', color: '#ff6666ff', comment: 'LSASS dökümü' },
      { techniqueID: 'T1105', color: '#00ff00', enabled: false },
      { techniqueID: 'T1086', color: '#ff0000' },
    ],
    legendItems: [{ label: 'Gözlemlendi', color: '#ff6666' }],
  };
  const { doc, imported, skipped } = layerIO.fromLayer(layer);
  assert.equal(doc.meta.title, 'Dış katman');
  assert.equal(imported, 2);
  assert.deepEqual(plain(skipped), ['T1086']);
  assert.equal(doc.items.T1003.color, '#ff6666');
  assert.equal(doc.items.T1003.procedures[0].text, 'LSASS dökümü');
  assert.ok(doc.items.T1566.tactics.length > 0);
  assert.equal(doc.items.T1105, undefined);
  assert.equal(doc.legend[0].label, 'Gözlemlendi');
});

test('proje dosyası tanınır ve aynı içerikle geri yüklenir', () => {
  const { store, layerIO } = loadRenderer();
  store.reset();
  store.applyActor('G0046', { withProcedures: true });
  const json = JSON.parse(layerIO.serializeProject(store.state.doc));
  assert.equal(layerIO.detect(json), 'project');
  assert.deepEqual(plain(store.normalizeDoc(json).items), JSON.parse(JSON.stringify(store.state.doc.items)));
});
