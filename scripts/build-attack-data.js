#!/usr/bin/env node
/*
 * MITRE ATT&CK STIX 2.1 paketini panelin kullandığı sıkıştırılmış veri
 * dosyasına (src/renderer/data/attack-data.js) dönüştürür.
 *
 *   node scripts/build-attack-data.js              -> data/raw/enterprise-attack.json kullanır
 *   node scripts/build-attack-data.js --download   -> önce en güncel paketi indirir
 *   node scripts/build-attack-data.js --input x.json
 */
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const RAW_DIR = path.join(ROOT, 'data', 'raw');
const RAW_FILE = path.join(RAW_DIR, 'enterprise-attack.json');
const OUT_FILE = path.join(ROOT, 'src', 'renderer', 'data', 'attack-data.js');
const SOURCE_URL =
  'https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/enterprise-attack/enterprise-attack.json';

function download(url, dest) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return resolve(download(res.headers.location, dest));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`İndirme başarısız: HTTP ${res.statusCode}`));
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
        file.on('error', reject);
      })
      .on('error', reject);
  });
}

/** Citation, markdown link ve HTML etiketlerini temizler. */
function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/\(Citation:[^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\((?:[^()]|\([^)]*\))*\)/g, '$1')
    .replace(/<\/?code>/g, '`')
    .replace(/<[^>]+>/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ +([.,;:])/g, '$1')
    .trim();
}

/** İlk paragrafı alır ve gerekirse cümle sınırında kısaltır. */
function summarize(text, max = 420) {
  const first = cleanText(text).split(/\n\s*\n/)[0].replace(/\s+/g, ' ').trim();
  if (first.length <= max) return first;
  const cut = first.slice(0, max);
  const dot = cut.lastIndexOf('. ');
  return (dot > max * 0.5 ? cut.slice(0, dot + 1) : cut.replace(/\s+\S*$/, '') + '…');
}

function externalId(obj) {
  const ref = (obj.external_references || []).find((r) => r.source_name === 'mitre-attack');
  return ref ? ref.external_id : null;
}

const isActive = (o) => !o.revoked && !o.x_mitre_deprecated;

function build(bundle) {
  const objects = bundle.objects;
  const byId = new Map(objects.map((o) => [o.id, o]));

  const collection = objects.find((o) => o.type === 'x-mitre-collection');
  const matrix = objects.find((o) => o.type === 'x-mitre-matrix' && isActive(o));

  // Taktikler: matristeki sıraya göre (kill chain sırası)
  const tactics = matrix.tactic_refs
    .map((ref) => byId.get(ref))
    .filter((t) => t && isActive(t))
    .map((t) => ({
      id: externalId(t),
      short: t.x_mitre_shortname,
      name: t.name,
      desc: summarize(t.description, 300),
    }));

  const techniques = objects
    .filter((o) => o.type === 'attack-pattern' && isActive(o))
    .map((o) => {
      const id = externalId(o);
      const sub = !!o.x_mitre_is_subtechnique;
      return {
        id,
        name: o.name,
        tactics: (o.kill_chain_phases || [])
          .filter((k) => k.kill_chain_name === 'mitre-attack')
          .map((k) => k.phase_name),
        sub,
        parent: sub ? id.split('.')[0] : null,
        platforms: o.x_mitre_platforms || [],
        desc: summarize(o.description),
      };
    })
    .filter((t) => t.id)
    .sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));

  const techById = new Map(
    objects
      .filter((o) => o.type === 'attack-pattern' && isActive(o))
      .map((o) => [o.id, externalId(o)])
  );

  // Tehdit profilleri: gruplar, kampanyalar ve yazılımlar ("uses" ilişkileri = prosedür örnekleri)
  const actorTypes = { 'intrusion-set': 'group', campaign: 'campaign', malware: 'software', tool: 'software' };
  const actors = new Map();
  for (const o of objects) {
    if (!actorTypes[o.type] || !isActive(o)) continue;
    const id = externalId(o);
    if (!id) continue;
    actors.set(o.id, {
      id,
      name: o.name,
      type: actorTypes[o.type],
      aliases: (o.aliases || o.x_mitre_aliases || []).filter((a) => a !== o.name),
      uses: [],
    });
  }
  for (const r of objects) {
    if (r.type !== 'relationship' || r.relationship_type !== 'uses' || !isActive(r)) continue;
    const actor = actors.get(r.source_ref);
    const tid = techById.get(r.target_ref);
    if (!actor || !tid) continue;
    actor.uses.push([tid, cleanText(r.description).replace(/\s+/g, ' ')]);
  }
  const actorList = [...actors.values()]
    .filter((a) => a.uses.length)
    .map((a) => ({ ...a, uses: a.uses.sort((x, y) => x[0].localeCompare(y[0], 'en', { numeric: true })) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    domain: 'enterprise-attack',
    version: (collection && collection.x_mitre_version) || (matrix && matrix.x_mitre_version) || 'unknown',
    modified: (collection && collection.modified) || null,
    tactics,
    techniques,
    actors: actorList,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const inputIdx = args.indexOf('--input');
  let input = inputIdx >= 0 ? path.resolve(args[inputIdx + 1]) : RAW_FILE;

  if (args.includes('--download')) {
    console.log(`İndiriliyor: ${SOURCE_URL}`);
    await download(SOURCE_URL, RAW_FILE);
    input = RAW_FILE;
  }
  if (!fs.existsSync(input)) {
    console.error(`STIX dosyası bulunamadı: ${input}\n--download parametresi ile indirebilirsiniz.`);
    process.exit(1);
  }

  const data = build(JSON.parse(fs.readFileSync(input, 'utf8')));
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  const header =
    `/* MITRE ATT&CK® ${data.domain} v${data.version} — scripts/build-attack-data.js ile üretildi.\n` +
    ` * © The MITRE Corporation. https://attack.mitre.org/resources/legal-and-branding/terms-of-use/ */\n`;
  fs.writeFileSync(OUT_FILE, `${header}window.ATTACK_DATA = ${JSON.stringify(data)};\n`);

  const subs = data.techniques.filter((t) => t.sub).length;
  console.log(
    `ATT&CK v${data.version}: ${data.tactics.length} taktik, ${data.techniques.length - subs} teknik, ` +
      `${subs} alt teknik, ${data.actors.length} tehdit profili -> ${path.relative(ROOT, OUT_FILE)} ` +
      `(${(fs.statSync(OUT_FILE).size / 1048576).toFixed(1)} MB)`
  );
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { build, cleanText, summarize };
