'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadRenderer } = require('./load-renderer');

const scripts = ['data/attack-data.js', 'js/util.js', 'js/data.js', 'js/store.js', 'js/table-export.js'];

function setup() {
  const TTP = loadRenderer(scripts);
  TTP.store.reset();
  TTP.store.setMeta({ title: 'Test | Rapor' });
  TTP.store.toggleTechnique('T1486', 'impact');
  TTP.store.addProcedure('T1486', 'Dosyalar "şifrelendi"', 'IR|1');
  TTP.store.toggleTechnique('T1566.001', 'initial-access');
  return TTP;
}

test('satırlar kill chain sırasında gelir', () => {
  const { tableExport, store } = setup();
  const ids = tableExport.rows(store.state.doc).map((r) => r.tech.id);
  assert.equal(ids.join(), 'T1566.001,T1486');
});

test('Markdown tablosu boru karakterlerini kaçışlar ve lejant etiketini kullanır', () => {
  const { tableExport, store } = setup();
  const md = tableExport.toMarkdown(store.state.doc);
  assert.match(md, /^# Test \| Rapor/);
  assert.match(md, /\| Impact \| \[T1486\]\(https:\/\/attack\.mitre\.org\/techniques\/T1486\/\) \|/);
  assert.match(md, /Dosyalar "şifrelendi" \(IR\\\|1\)/);
  assert.match(md, /Phishing: Spearphishing Attachment/);
  assert.match(md, /Gözlemlendi \(yüksek güven\)/);
});

test('CSV BOM ile başlar, tırnakları çiftler ve prosedür başına satır üretir', () => {
  const { tableExport, store } = setup();
  const csv = tableExport.toCsv(store.state.doc);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  const lines = csv.trim().split('\r\n');
  assert.equal(lines.length, 3);
  assert.match(lines[2], /"Dosyalar ""şifrelendi"""/);
});
