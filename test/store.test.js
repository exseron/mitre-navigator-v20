'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadRenderer, plain } = require('./load-renderer');

function fresh() {
  const TTP = loadRenderer();
  TTP.store.reset();
  return TTP;
}

test('hücre tıklaması tekniği yalnızca o taktikte seçer, ikinci tık kaldırır', () => {
  const { store } = fresh();
  store.toggleTechnique('T1078', 'initial-access');
  assert.deepEqual(plain(store.item('T1078').tactics), ['initial-access']);
  assert.equal(store.isSelected('T1078', 'persistence'), false);
  store.toggleTechnique('T1078', 'initial-access');
  assert.equal(store.item('T1078'), null);
});

test('"tüm taktiklerde seç" modunda teknik bütün taktiklerinde seçilir', () => {
  const { store, data } = fresh();
  store.setUi({ across: true });
  store.toggleTechnique('T1078', 'initial-access');
  assert.deepEqual(plain(store.item('T1078').tactics), plain(data.tacticsOf('T1078')));
});

test('seçimi kaldırmak eklenmiş prosedürleri silmez', () => {
  const { store } = fresh();
  store.toggleTechnique('T1566', 'initial-access');
  store.addProcedure('T1566', 'Kimlik avı e-postası', 'Rapor');
  store.toggleTechnique('T1566', 'initial-access');
  assert.equal(store.isSelected('T1566'), false);
  assert.equal(store.item('T1566').procedures.length, 1);
  store.toggleTechnique('T1566', 'initial-access');
  assert.equal(store.item('T1566').procedures[0].text, 'Kimlik avı e-postası');
});

test('seçili olmayan tekniğe prosedür eklemek onu seçer', () => {
  const { store } = fresh();
  store.addProcedure('T1486', 'Dosyalar şifrelendi');
  assert.ok(store.isSelected('T1486', 'impact'));
});

test('yeni seçim aktif rengi alır, lejant rengi değişince seçimler de güncellenir', () => {
  const { store } = fresh();
  const legend = store.state.doc.legend[0];
  store.setActiveColor(legend.color);
  store.toggleTechnique('T1059', 'execution');
  assert.equal(store.item('T1059').color, legend.color);
  store.updateLegend(legend.id, { color: '#123456' });
  assert.equal(store.item('T1059').color, '#123456');
});

test('geri al / yinele seçim değişikliklerini izler', () => {
  const { store } = fresh();
  store.toggleTechnique('T1059', 'execution');
  store.toggleTechnique('T1105', 'command-and-control');
  store.undo();
  assert.equal(store.isSelected('T1105'), false);
  assert.equal(store.isSelected('T1059'), true);
  store.redo();
  assert.equal(store.isSelected('T1105'), true);
});

test('tehdit profili uygulanınca teknikler ve MITRE prosedürleri eklenir', () => {
  const { store, data } = fresh();
  const actor = data.actorById.get('G0016');
  const r = store.applyActor('G0016', { withProcedures: true });
  const unique = new Set(actor.uses.map((u) => u[0]));
  assert.equal(r.techniques, unique.size);
  assert.ok(r.procedures > 0);
  assert.equal(store.state.doc.meta.title, 'APT29');
  for (const tid of unique) assert.ok(store.isSelected(tid), tid);
});

test('normalizeDoc bilinmeyen teknikleri ve geçersiz taktikleri ayıklar', () => {
  const { store } = fresh();
  const doc = store.normalizeDoc({
    items: {
      T1059: { color: 'red', tactics: ['execution', 'impact'], procedures: [{ text: ' ' }, { text: 'ok' }] },
      T0000: { color: '#fff', tactics: ['execution'] },
    },
  });
  assert.deepEqual(plain(Object.keys(doc.items)), ['T1059']);
  assert.deepEqual(plain(doc.items.T1059.tactics), ['execution']);
  assert.equal(doc.items.T1059.procedures.length, 1);
  assert.match(doc.items.T1059.color, /^#[0-9a-f]{6}$/);
});
