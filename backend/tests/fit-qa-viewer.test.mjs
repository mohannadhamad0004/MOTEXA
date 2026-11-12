// FIT QA in the REAL viewer code (sceneHtml.ts via scripts/accessory-fit-check.mjs --views=qa, headless Chrome, local Three.js): every
// shown part is measured (GOOD = visible clipping and contact gaps <= 6 mm or 0.5 % of the part's size; PERFECT = 2 / 3 mm), corrected a
// little (bumpers: each corner on its own too) or refused with the reason, gets soft seams,
// and an admin correction is checked too. Uses the QA stand-ins (3d-source/qa-standins, made by scripts/qa-standins.mjs) and the
// published demo parts.
import { test } from 'node:test'; import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process'; import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'; import { resolve } from 'node:path';
import { ROOT, loadTS } from '../scripts/vehicle-audit-lib.mjs';

const { CAR_MODELS } = loadTS(resolve(ROOT, 'mobile/src/features/car3d/models.ts'));
const TMP = resolve(ROOT, 'backend/.private/fit-qa-test'), LIP = resolve(ROOT, '3d-source/qa-standins/front-lip.glb');
const BUMPER = resolve(ROOT, '3d-source/accessory-photos/test/free_bmw_e36_m3_front_bumper.glb'), RIM = resolve(ROOT, '3d-source/rims/bbs-rs16/rim.glb');
const skip = [LIP, BUMPER, RIM, resolve(ROOT, '.private/three-r160/package')].some(f => !existsSync(f)) ? 'stand-ins, demo parts or local Three.js missing' : false;
const E36_MAP = resolve(ROOT, 'docs/3d/rims-general/bmw-3-series-e36/config.json'); // the E36 with its confirmed part map (bumpers need it)
test.after(() => rmSync(TMP, { recursive: true, force: true }));
function run(name, key, part, kit, config = null) {
  const dir = resolve(TMP, name); mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'config.json'), JSON.stringify(config ?? CAR_MODELS.find(m => m.key === key))); writeFileSync(resolve(dir, 'kit.json'), JSON.stringify(kit));
  const out = execFileSync(process.execPath, [resolve(ROOT, 'backend/scripts/accessory-fit-check.mjs'), `--car=${resolve(ROOT, 'backend/public/3d', key + '.glb')}`, `--config=${resolve(dir, 'config.json')}`,
    `--part=${part}`, `--kit=${resolve(dir, 'kit.json')}`, `--out=${dir}`, '--views=qa'], { encoding: 'utf8', timeout: 240_000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  return JSON.parse(out.trim().split('\n').pop());
}

test('a front lip under the E36 bumper: shown, no visible clipping, every contact slice touching, soft seams along the join', { skip }, () => {
  const r = run('lip', 'bmw-3-series-e36', LIP, { type: 'FRONT_LIP' }), qa = r.fit.qa;
  assert.equal(r.fit.refused, undefined, r.fit.refused); assert.equal(qa.ok, true); assert.ok(qa.limitMm >= 6 && qa.limitMm <= 10, 'limit = max(6 mm, 0.5 % of the part size): ' + qa.limitMm);
  assert.ok(qa.clipMm <= qa.limitMm && qa.gapMm <= qa.limitMm && qa.contacts >= 1, JSON.stringify(qa)); assert.ok(['PERFECT', 'GOOD'].includes(qa.tier), qa.tier);
  assert.ok(r.autofit.placements[0].seam.length > 0 && r.autofit.placements[0].seam.every(q => q.length === 12), 'seam quads on the part');
});

test('an admin correction is checked too: the lip pushed 50 mm back into the car fails with its numbers', { skip }, () => {
  const qa = run('lip-adj', 'bmw-3-series-e36', LIP, { type: 'FRONT_LIP', baseAdj: { x: 0, y: 0, z: -0.05, rx: 0, ry: 0, s: 1 } }).fit.qa;
  assert.equal(qa.ok, true, 'the auto-fit itself passes'); assert.equal(qa.correction.ok, false);
  assert.ok(qa.correction.clipMm > qa.limitMm, JSON.stringify(qa.correction)); assert.equal(qa.correction.tier, 'REFUSED');
});

const E36 = () => existsSync(E36_MAP) ? JSON.parse(readJson(E36_MAP)) : null;
test('E36 bumper: the bonnet-line seam (above 10 mm) is inside its 25 mm limit, so the seam gate no longer refuses it', { skip }, () => {
  const r = run('bumper-raw', 'bmw-3-series-e36', BUMPER, { type: 'FRONT_BUMPER', size: { qaRaw: true } }, E36());
  assert.doesNotMatch(r.fit.refused ?? '', /does not fit this car cleanly \(.*gap/);
  assert.ok(Object.values(r.fit.gapsMm).every(g=>Number.isFinite(g.p90)&&Number.isFinite(g.max)));
  const line = r.fit.gapsMm.bonnetBootLine; assert.ok(line && line.p90 > 10 && line.p90 <= 25, JSON.stringify(r.fit.gapsMm));
});

test('E36 bumper with the covered stock pieces hidden: shown (FIT-QA GOOD) and stored for replay', { skip }, () => {
  const r = run('bumper', 'bmw-3-series-e36', BUMPER, { type: 'FRONT_BUMPER' }, E36());
  assert.equal(r.fit.refused, undefined, r.fit.refused); assert.equal(r.fit.qa.ok, true, JSON.stringify(r.fit.qa));
  assert.ok(r.fit.hidesWithStock.includes('E36_coupe_washers_BMWE36_black_0'), JSON.stringify(r.fit.hidesWithStock));
  assert.ok(r.autofit, 'a fit to store and replay');
});

test('rims: measured (never moved by the QA), with a soft ring at each rim lip and an arch shadow per wheel', { skip }, () => {
  const r = run('rims', 'mercedes-e-class-w212', RIM, { type: 'RIMS', size: { rimInches: 17 } });
  assert.equal(r.fit.refused, undefined, r.fit.refused); assert.equal(r.fit.qa.ok, true); assert.equal(r.fit.qa.corrected, undefined);
  assert.equal(r.autofit.rings.length, 8); assert.ok(r.autofit.tyres.every(t => t.prof?.length === 12), 'built tyres follow the stock tyre outline');
});
function readJson(f) { return execFileSync(process.execPath, ['-e', `process.stdout.write(require('fs').readFileSync(${JSON.stringify(f)},'utf8'))`], { encoding: 'utf8' }); }
