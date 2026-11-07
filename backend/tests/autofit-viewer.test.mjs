// Accessory auto-fit in the REAL viewer code (sceneHtml.ts via scripts/accessory-fit-check.mjs, headless Chrome, local Three.js), with the
// published E36 wing as the part: every body type gets the right mount, both feet touch (0-2 mm), never wider than the body; a stored fit
// replays to exactly the same place; a lip touches the bumper's bottom edge.
// FIT-QA (visible clipping / floating gaps, refusal) has its own suite (fit-qa-viewer.test.mjs): here the parts run in evidence mode, so
// this file keeps testing its own mechanism with the E36 demo parts the QA refuses.
import { test } from 'node:test'; import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process'; import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'; import { resolve } from 'node:path';
import { ROOT, loadTS } from '../scripts/vehicle-audit-lib.mjs';

const { CAR_MODELS } = loadTS(resolve(ROOT, 'mobile/src/features/car3d/models.ts'));
const WING = resolve(ROOT, 'backend/public/3d/accessories/acc-7e40b463d76777b8.glb');
const BUMPER = resolve(ROOT, '3d-source/accessory-photos/test/free_bmw_e36_m3_front_bumper.glb'); // CC BY test part, not in git (stand-in lip)
const TMP = resolve(ROOT, 'backend/.private/autofit-test');
const skip = !existsSync(WING) || !existsSync(resolve(ROOT, '.private/three-r160/package')) ? 'wing model or local Three.js missing' : false;
test.after(() => rmSync(TMP, { recursive: true, force: true }));

function run(key, views, kit, part = WING, partMap) {
  const dir = resolve(TMP, `${key}-${views}-${kit.type}-${kit.fit ? 'replay' : 'live'}`); mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'config.json'), JSON.stringify({ ...CAR_MODELS.find(m => m.key === key), ...(partMap ? { partMap } : {}) }));
  writeFileSync(resolve(dir, 'kit.json'), JSON.stringify({ ...kit, qaEvidence: true }));
  const args = [resolve(ROOT, 'backend/scripts/accessory-fit-check.mjs'), `--car=${resolve(ROOT, 'backend/public/3d', key + '.glb')}`, `--config=${resolve(dir, 'config.json')}`, `--out=${dir}`, `--views=${views}`, `--kit=${resolve(dir, 'kit.json')}`];
  if (views !== 'segment') args.push(`--part=${part}`);
  const out = JSON.parse(execFileSync(process.execPath, args, { encoding: 'utf8', timeout: 180_000, windowsHide: true, maxBuffer: 32 * 1024 * 1024 }).trim().split('\n').pop());
  return views === 'segment' ? JSON.parse(readFileSync(resolve(dir, 'pieces.json'), 'utf8')) : out;
}
const touches = gaps => gaps.every(g => g !== null && g >= 0 && g <= 2);
let e36Map, e36Fit;

test('E36 (sedan, stock spoiler hidden by its part map): wing on the boot lid, both feet touch, inside the body width', { skip }, () => {
  e36Map = Object.fromEntries(Object.entries(run('bmw-3-series-e36', 'segment', { type: 'WING' }).proposal).map(([k, v]) => [k, v.ids]));
  const r = run('bmw-3-series-e36', 'fit', { type: 'WING', size: { widthMm: 1300 } }, WING, e36Map); const f = r.fit; e36Fit = r.autofit;
  assert.equal(f.mount.body, 'sedan'); assert.equal(f.feet, 2); assert.ok(touches(f.feetGapMm), JSON.stringify(f.feetGapMm));
  assert.ok(f.spanM <= f.mount.bodyWidthM && f.spanM <= 0.95 * f.mount.widthM, `span ${f.spanM} vs lid ${f.mount.widthM} / body ${f.mount.bodyWidthM}`);
  assert.ok(f.heightAboveM > 0 && f.heightAboveM <= 0.45); assert.ok(Math.abs(f.pitchDeg) <= 10);
  assert.ok(f.overhangM <= 0.001, `a boot-lid wing never hangs behind the car (${f.overhangM} m)`);
});

test('a stored fit replays to exactly the same place (computed once)', { skip }, () => {
  const r = run('bmw-3-series-e36', 'fit', { type: 'WING', size: { widthMm: 1300 }, fit: e36Fit }, WING, e36Map);
  assert.equal(r.fit.stored, true); assert.deepEqual(r.fit.partBox, run('bmw-3-series-e36', 'fit', { type: 'WING', size: { widthMm: 1300 } }, WING, e36Map).fit.partBox);
  const stale = run('bmw-3-series-e36', 'fit', { type: 'WING', size: { widthMm: 1300 }, fit: { ...e36Fit, version: -1 } }, WING, e36Map);
  assert.equal(stale.fit.stored, false, 'a fit from another viewer version is ignored and fitted live');
});

for (const [key, body] of [['mercedes-e-class-w212', 'sedan'], ['audi-a4-b5', 'sedan'], ['peugeot-208-2nd-gen-p21', 'hatch'], ['audi-q3-8u', 'hatch'], ['mercedes-vito-w447', 'hatch']])
  test(`${key}: ${body === 'sedan' ? 'boot lid' : 'top of the tailgate'}, both feet touch, inside the body`, { skip }, () => {
    const f = run(key, 'fit', { type: 'WING', size: { widthMm: 1300 } }).fit;
    assert.equal(f.mount.body, body); assert.ok(touches(f.feetGapMm), JSON.stringify(f.feetGapMm));
    assert.ok(f.spanM <= f.mount.bodyWidthM); assert.ok(f.heightAboveM <= 0.45); assert.ok(Math.abs(f.pitchDeg) <= 10);
  });

test('other types through the same fitAccessory: roof rack on the roof, lip spoiler on the lid, front lip under the bumper', { skip }, () => {
  let f = run('audi-q3-8u', 'fit', { type: 'ROOF_RACK' }).fit; assert.equal(f.mount.body, 'roof'); assert.ok(touches(f.feetGapMm));
  f = run('audi-a4-b5', 'fit', { type: 'SPOILER' }).fit; assert.equal(f.mount.body, 'sedan'); assert.ok(touches(f.feetGapMm)); assert.ok(f.heightAboveM <= 0.15 + 1e-6);
  if (existsSync(BUMPER)) { f = run('bmw-3-series-e36', 'fit', { type: 'FRONT_LIP' }, BUMPER).fit; assert.ok(f.topGapMm.every(g => g !== null && g >= 0 && g <= 2), JSON.stringify(f.topGapMm)); }
});
