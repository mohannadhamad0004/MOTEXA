// Rims in the REAL viewer code (sceneHtml.ts via scripts/accessory-fit-check.mjs, headless Chrome, local Three.js): one rim part x4 on
// cars with different wheel builds: E36 / W212 (separate tyres, kept), Octavia Mk2 (no separate tyre: tyre built in code), Peugeot 308
// (front wheels steered in the model: refused). Rims face outward (mirrored left / right), sit at the stock rim's face, the stock rim
// comes back when off; another size builds a tyre with the stock outer size; too big = fit error.
import { test } from 'node:test'; import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process'; import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'; import { resolve } from 'node:path';
import { ROOT, loadTS } from '../scripts/vehicle-audit-lib.mjs';

const { CAR_MODELS } = loadTS(resolve(ROOT, 'mobile/src/features/car3d/models.ts'));
const RIM = resolve(ROOT, '3d-source/rims/bbs-rs16/rim.glb'); // CC BY "BBS RS16 Tuner Car Wheel" (test part, not in git)
const TMP = resolve(ROOT, 'backend/.private/rims-test');
const skip = !existsSync(RIM) || !existsSync(resolve(ROOT, '.private/three-r160/package')) ? 'test rim or local Three.js missing' : false;
test.after(() => rmSync(TMP, { recursive: true, force: true }));
function run(key, views, kit = { type: 'RIMS', finish: 'SILVER' }, zones = null) {
  const dir = resolve(TMP, key + '-' + views + '-' + (kit.size?.rimInches ?? 0) + (zones ? '-z' : '')); mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'config.json'), JSON.stringify({ ...CAR_MODELS.find(m => m.key === key), ...(zones ? { zones } : {}) })); writeFileSync(resolve(dir, 'kit.json'), JSON.stringify(kit));
  try {
    const out = execFileSync(process.execPath, [resolve(ROOT, 'backend/scripts/accessory-fit-check.mjs'), `--car=${resolve(ROOT, 'backend/public/3d', key + '.glb')}`, `--config=${resolve(dir, 'config.json')}`,
      `--part=${RIM}`, `--kit=${resolve(dir, 'kit.json')}`, `--out=${dir}`, `--views=${views}`], { encoding: 'utf8', timeout: 240_000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    return JSON.parse(out.trim().split('\n').pop());
  } catch (e) { return { error: String(e.stderr ?? e).match(/Error: ([^\n]*)/)?.[1] ?? String(e) }; }
}
const placedRight = r => {
  assert.equal(r.error, undefined, r.error);
  const { fit, autofit } = r; assert.equal(fit.wheels.length, 4); assert.equal(autofit.placements.length, 4);
  for (const p of autofit.placements) assert.equal(Math.sign(p.sc[0]) * fit.faceSign, p.side, 'mirrored: the face points outward on both sides');
  for (const w of fit.wheels) { assert.ok(w.faceInsetMm >= 0 && w.faceInsetMm <= 20, `rim face inside the tyre face: ${w.faceInsetMm}`); assert.ok(w.sidewallMm >= 20); }
  return fit.wheels;
};

for (const key of ['bmw-3-series-e36', 'mercedes-e-class-w212']) test(`${key}: stock rims replaced, stock tyres kept, rims mirrored and flush, all back when off`, { skip }, () => {
  const r = run(key, 'check'), w = placedRight(r);
  assert.ok(w.every(x => x.tyre === 'stock' && x.stockRimMm === x.rimMm && Math.abs(x.gapToTyreMm) <= 15), JSON.stringify(w));
  assert.equal(r.fit.check.on.allHidden, true, 'the stock rims are hidden while on'); assert.equal(r.fit.check.off.allHidden, false, 'and come back when off');
});

test('a car without a separate tyre: the whole wheel is replaced and a tyre is built with the stock outer size', { skip }, () => {
  const w = placedRight(run('skoda-octavia-mk2-1z', 'fit'));
  assert.ok(w.every(x => x.tyre.startsWith('built') && x.gapToTyreMm === 0), JSON.stringify(w));
});

test('another rim size: same tyre outer size, thinner sidewall, built tyre; far too big = fit error', { skip }, () => {
  const stock = placedRight(run('bmw-3-series-e36', 'fit')), w = placedRight(run('bmw-3-series-e36', 'fit', { type: 'RIMS', size: { rimInches: 19 } }));
  assert.ok(w.every((x, i) => x.tyre.startsWith('built') && x.rimMm > x.stockRimMm && x.tyreOuterMm === stock[i].tyreOuterMm && x.sidewallMm < stock[i].sidewallMm), JSON.stringify(w));
  assert.match(run('bmw-3-series-e36', 'fit', { type: 'RIMS', size: { rimInches: 24 } }).error ?? '', /does not fit this car cleanly \(.*sidewall/);
});

test('a model with steered front wheels gets no rims (3D preview not available) instead of a wrong fit', { skip }, () => {
  assert.match(run('peugeot-308-2nd-gen-t9', 'fit').error ?? '', /no wheels found on this car model/);
});

test('wheel inset: the E36 wheels (stock tyre + rim) move inward per axle while rims are on, flush with the fender; suggested from the measurement', { skip }, () => {
  const plain = placedRight(run('bmw-3-series-e36', 'fit')), sug = run('bmw-3-series-e36', 'fit').fit.wheelInset.suggested;
  assert.ok(plain.some(w => w.tyreToFenderMm < 0) && sug.front > 0 && sug.rear > 0, JSON.stringify({ plain, sug }));
  const r = run('bmw-3-series-e36', 'check', undefined, { RIMS: { wheelInsetMm: sug } }), w = placedRight(r);
  assert.ok(w.every(x => x.tyre === 'stock' && x.tyreToFenderMm + x.insetMm >= 0 && x.tyreToFenderMm + x.insetMm <= 8), JSON.stringify(w));
  assert.equal(r.autofit.shift.length, 4, 'the four stock tyres move with the wheels');
  assert.ok(r.autofit.shift.every(([, dx]) => Math.abs(dx) * 1000 === sug.front || Math.abs(dx) * 1000 === sug.rear), JSON.stringify(r.autofit.shift));
  assert.equal(r.fit.check.off.allHidden, false, 'rims off: stock wheels back');
});
