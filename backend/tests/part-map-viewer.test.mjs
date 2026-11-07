// Part maps in the REAL viewer code (sceneHtml.ts via scripts/accessory-fit-check.mjs, headless Chrome, local Three.js), on the E36:
// stable piece ids, the stock part hidden while an accessory is on and back when off, and the zone fallback without a confirmed map.
// FIT-QA (visible clipping / floating gaps, refusal) has its own suite (fit-qa-viewer.test.mjs): here the parts run in evidence mode, so
// this file keeps testing its own mechanism with the E36 demo parts the QA refuses.
import { test } from 'node:test'; import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process'; import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'; import { resolve } from 'node:path';
import { ROOT, loadTS } from '../scripts/vehicle-audit-lib.mjs';

const { CAR_MODELS } = loadTS(resolve(ROOT, 'mobile/src/features/car3d/models.ts'));
const E36 = CAR_MODELS.find(m => m.key === 'bmw-3-series-e36');
const CAR = resolve(ROOT, 'backend/public/3d/bmw-3-series-e36.glb');
const WING = resolve(ROOT, 'backend/public/3d/accessories/acc-7e40b463d76777b8.glb');
const TMP = resolve(ROOT, 'backend/.private/part-map-test');
const E36_WING_ZONE = { box: { x: [0, 1], y: [0, 1], z: [0.04, 0.1] }, replace: { box: { x: [0.16, 0.84], y: [0.735, 0.9], z: [0, 0.075] } } };
const skip = !existsSync(CAR) || !existsSync(WING) || !existsSync(resolve(ROOT, '.private/three-r160/package')) ? 'E36 / wing model or local Three.js missing' : false;
test.after(() => rmSync(TMP, { recursive: true, force: true }));

function run(name, args, { zones = {}, partMap, kit } = {}) {
  const dir = resolve(TMP, name); mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'config.json'), JSON.stringify({ ...E36, zones }));
  const extra = [];
  if (partMap) { writeFileSync(resolve(dir, 'map.json'), JSON.stringify(partMap)); extra.push(`--partmap=${resolve(dir, 'map.json')}`); }
  if (kit) { writeFileSync(resolve(dir, 'kit.json'), JSON.stringify({ ...kit, qaEvidence: true })); extra.push(`--kit=${resolve(dir, 'kit.json')}`); }
  const out = execFileSync(process.execPath, [resolve(ROOT, 'backend/scripts/accessory-fit-check.mjs'), `--car=${CAR}`, `--config=${resolve(dir, 'config.json')}`, `--out=${dir}`, ...extra, ...args],
    { encoding: 'utf8', timeout: 180_000, windowsHide: true });
  return { fit: JSON.parse(out.trim().split('\n').pop()).fit, dir };
}
let seg;
const segment = name => { const r = run(name, ['--views=segment']); return JSON.parse(readFileSync(resolve(r.dir, 'pieces.json'), 'utf8')); };
const mapOf = proposal => Object.fromEntries(Object.entries(proposal).map(([k, v]) => [k, v.ids]));

test('segmentation: the same file always gives the same pieces, ids and bounds; the stock spoiler is one piece', { skip }, () => {
  seg = segment('seg-a'); const again = segment('seg-b');
  assert.deepEqual(again.pieces, seg.pieces); assert.deepEqual(again.proposal, seg.proposal);
  assert.equal(new Set(seg.pieces.map(p => p.id)).size, seg.pieces.length);
  const spoiler = seg.pieces.find(p => p.id === 'm109c1');
  assert.equal(spoiler.name, 'E36_coupe_bumper_R_trim_BMWE36_paint_0'); assert.equal(spoiler.tris, 4576);
  // ROOT CAUSE of the old zone failure: the spoiler is wider, lower and longer than the saved replace box, so a box cut left its edges
  const r = E36_WING_ZONE.replace.box;
  assert.ok(spoiler.b[0] < r.x[0] && spoiler.b[3] > r.x[1] && spoiler.b[1] < r.y[0] && spoiler.b[5] > r.z[1]);
  assert.ok(seg.proposal.SPOILER.ids.includes('m109c1'));
});

test('wing ON hides every triangle of the mapped stock spoiler and sits on the lid where it was; OFF brings it back', { skip }, () => {
  const { fit } = run('wing', ['--views=check', `--part=${WING}`], { zones: { WING: E36_WING_ZONE }, partMap: mapOf(seg.proposal), kit: { type: 'WING', size: { widthMm: 1300 } } });
  assert.deepEqual(fit.replaces, { how: 'part map', hidden: 2 }); assert.equal(fit.mount.body, 'sedan'); // placed by the auto-fit on the lid under it
  assert.ok(fit.feetGapMm.every(g => g >= 0 && g <= 2));
  assert.equal(fit.check.on.parts.SPOILER, 0); assert.ok(fit.check.on.allHidden);
  assert.ok(fit.check.off.parts.SPOILER > 4000, 'the stock spoiler must come back');
  for (const L of ['FRONT_BUMPER', 'REAR_BUMPER', 'MIRRORS', 'WHEELS']) assert.equal(fit.check.on.parts[L], fit.check.off.parts[L], `${L} untouched by a wing`);
});

test('front bumper ON: only one bumper (the stock one fully hidden), fitted to its bounds; OFF: back', { skip }, () => {
  const M3 = resolve(ROOT, '3d-source/accessory-photos/test/free_bmw_e36_m3_front_bumper.glb'); if (!existsSync(M3)) return; // a real E36 bumper (CC BY test part)
  const { fit } = run('bumper', ['--views=check', `--part=${M3}`], { partMap: mapOf(seg.proposal), kit: { type: 'FRONT_BUMPER' } });
  assert.equal(fit.zone.how, 'part map');
  assert.equal(fit.check.on.parts.FRONT_BUMPER, 0); assert.ok(fit.check.off.parts.FRONT_BUMPER > 10000);
  assert.equal(fit.check.on.parts.SPOILER, fit.check.off.parts.SPOILER);
});

test('fallback: no confirmed map, or a map without that label, uses the zone cut', { skip }, () => {
  let { fit } = run('fallback-none', ['--views=check', `--part=${WING}`], { zones: { WING: E36_WING_ZONE }, kit: { type: 'WING', size: { widthMm: 1300 } } });
  assert.equal(fit.replaces.how, 'tuned box'); assert.deepEqual(fit.check.on.parts, {});
  const { SPOILER: _, ...noSpoiler } = mapOf(seg.proposal);
  ({ fit } = run('fallback-label', ['--views=check', `--part=${WING}`], { zones: { WING: E36_WING_ZONE }, partMap: noSpoiler, kit: { type: 'WING', size: { widthMm: 1300 } } }));
  assert.equal(fit.replaces.how, 'tuned box'); assert.equal(fit.check.on.parts.SPOILER, undefined);
});
