// Rims in the REAL viewer code (sceneHtml.ts via scripts/accessory-fit-check.mjs, headless Chrome, local Three.js): one rim part x4 placed
// automatically on cars with different wheel builds, no per-car settings: E36 (separate tyres, cambered), W212 (brakes in front of the deep
// test rim's spokes), Octavia Mk2 (one-piece wheels: tyre built in code), Peugeot 308, and the E36 with its front wheels steered 15 deg.
// Each wheel: rim turned so its face points out along that wheel's own axle, the whole wheel moved along the axle so the tyre face sits
// 3-8 mm inside the arch line (at most 40 mm), or a warning says why not; OFF = the stock car unchanged.
import { test } from 'node:test'; import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process'; import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'; import { resolve } from 'node:path';
import { ROOT, loadTS } from '../scripts/vehicle-audit-lib.mjs';

const { CAR_MODELS } = loadTS(resolve(ROOT, 'mobile/src/features/car3d/models.ts'));
const RIM = resolve(ROOT, '3d-source/rims/bbs-rs16/rim.glb'); // CC BY "BBS RS16 Tuner Car Wheel" (test part, not in git)
const TMP = resolve(ROOT, 'backend/.private/rims-test');
const skip = !existsSync(RIM) || !existsSync(resolve(ROOT, '.private/three-r160/package')) ? 'test rim or local Three.js missing' : false;
test.after(() => rmSync(TMP, { recursive: true, force: true }));
function run(key, views, kit = { type: 'RIMS', finish: 'SILVER' }, zones = null, extra = []) {
  const dir = resolve(TMP, [key, views, kit.size?.rimInches ?? 0, zones ? 'z' : '', ...extra].join('-').replace(/[^a-z0-9-]/gi, '')); mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'config.json'), JSON.stringify({ ...CAR_MODELS.find(m => m.key === key), ...(zones ? { zones } : {}) })); writeFileSync(resolve(dir, 'kit.json'), JSON.stringify(kit));
  try {
    const out = execFileSync(process.execPath, [resolve(ROOT, 'backend/scripts/accessory-fit-check.mjs'), `--car=${resolve(ROOT, 'backend/public/3d', key + '.glb')}`, `--config=${resolve(dir, 'config.json')}`,
      `--part=${RIM}`, `--kit=${resolve(dir, 'kit.json')}`, `--out=${dir}`, `--views=${views}`, ...extra], { encoding: 'utf8', timeout: 240_000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    return JSON.parse(out.trim().split('\n').pop());
  } catch (e) { return { error: String(e.stderr ?? e).match(/Error: ([^\n]*)/)?.[1] ?? String(e) }; }
}
// a wheel that did not reach the 3-8 mm target says why
const EXPLAINED = ['LIMITED_BY_CLEARANCE', 'KEPT_STOCK_POSITION', 'ARCH_NOT_MEASURED', 'MOVE_CLAMPED_40MM', 'ADMIN_OVERRIDE'];
const placedRight = r => {
  assert.equal(r.error, undefined, r.error);
  const { fit, autofit } = r; assert.equal(fit.wheels.length, 4); assert.equal(autofit.placements.length, 4); assert.equal(autofit.rimRuntime.active.length, 4);
  for (const w of fit.wheels) {
    assert.equal(w.refusal, null, w.wheel);
    assert.ok(w.faceInsetMm >= 0 && w.faceInsetMm <= 20, `rim face inside the tyre face: ${w.faceInsetMm}`); assert.ok(w.sidewallMm >= 20);
    assert.ok(Math.abs(w.movedMm) <= 40.05, `moved at most 40 mm: ${w.movedMm}`);
    assert.ok((w.archGapAfterMm >= 3 && w.archGapAfterMm <= 8) || w.warnings.some(x => EXPLAINED.includes(x)), `${w.wheel}: flush or explained ${JSON.stringify(w)}`);
  }
  for (const o of autofit.rimRuntime.offsets) assert.ok(Math.hypot(...o.delta) <= 0.0401, 'stored move <= 40 mm');
  return fit.wheels;
};

for (const key of ['bmw-3-series-e36', 'mercedes-e-class-w212']) test(`${key}: four rims placed per wheel, all back when off`, { skip }, () => {
  const r = run(key, 'check'); placedRight(r);
  assert.equal(r.fit.check.on.allHidden, true, 'the stock wheels are hidden while on'); assert.equal(r.fit.check.off.allHidden, false, 'and come back when off');
});

test('the rim turns (not mirrors) so its face points out along each wheel\'s axle, on both sides', { skip }, () => {
  const r = run('bmw-3-series-e36', 'fit'); placedRight(r);
  for (const [i, p] of r.autofit.placements.entries()) {
    const [x, y, z] = p.rot, w = r.fit.wheels[i]; // the face direction = the part's +x after the turn (XYZ euler)
    const out = [Math.cos(y) * Math.cos(z), Math.cos(x) * Math.sin(z) + Math.sin(x) * Math.sin(y) * Math.cos(z), Math.sin(x) * Math.sin(z) - Math.cos(x) * Math.sin(y) * Math.cos(z)];
    assert.equal(Math.sign(out[0]), p.side, `${w.wheel} faces out of the car`);
  }
  assert.equal(new Set(r.autofit.placements.map(p => Math.sign(p.sc[0]))).size, 1, 'the same part on both sides: turned, never mirrored left vs right');
});

test('W212: brake parts that would stand in front of the deep rim\'s spokes are hidden while on', { skip }, () => {
  const r = run('mercedes-e-class-w212', 'fit'); placedRight(r);
  assert.ok(r.autofit.hideMore.length + (r.autofit.rimRuntime.hideBrakes ?? []).length > 0, JSON.stringify(r.fit.wheels.map(w => w.hiddenBrakeParts)));
});

test('Octavia Mk2 (wheels split from shared meshes): its tyre is found and kept at the stock size, the wheels end 3-8 mm inside', { skip }, () => {
  const w = placedRight(run('skoda-octavia-mk2-1z', 'fit'));
  assert.ok(w.every(x => x.tyre === 'stock' && Math.abs(x.gapToTyreMm) <= 15 && x.archGapAfterMm >= 3 && x.archGapAfterMm <= 8), JSON.stringify(w));
});

test('Peugeot 308 (refused before): rims on all four wheels', { skip }, () => { placedRight(run('peugeot-308-2nd-gen-t9', 'fit')); });

test('steered front wheels: the axle is read from the geometry and the rims follow it', { skip }, () => {
  const r = run('bmw-3-series-e36', 'fit', undefined, null, ['--steer=15']), w = placedRight(r);
  for (const x of w) assert.ok(x.wheel.startsWith('F') ? Math.abs(x.steerDeg - 15) <= 1 : x.steerDeg <= 1, `${x.wheel} ${x.steerDeg}`);
});

test('another rim size: same tyre outer size, thinner sidewall, built tyre; far too big = fit error', { skip }, () => {
  const stock = placedRight(run('bmw-3-series-e36', 'fit')), w = placedRight(run('bmw-3-series-e36', 'fit', { type: 'RIMS', size: { rimInches: 19 } }));
  assert.ok(w.every((x, i) => x.tyre === 'built' && x.rimMm > x.stockRimMm && x.tyreOuterMm === stock[i].tyreOuterMm && x.sidewallMm < stock[i].sidewallMm), JSON.stringify(w));
  assert.match(run('bmw-3-series-e36', 'fit', { type: 'RIMS', size: { rimInches: 24 } }).error ?? '', /does not fit this car cleanly \(.*sidewall/);
});

test('a Parts Admin inset overrides the automatic move per axle (still never into the car)', { skip }, () => {
  const auto = placedRight(run('skoda-octavia-mk2-1z', 'fit')), w = placedRight(run('skoda-octavia-mk2-1z', 'fit', undefined, { RIMS: { wheelInsetMm: { front: 2, rear: 3 } } }));
  assert.ok(w.every(x => x.warnings.includes('ADMIN_OVERRIDE')), JSON.stringify(w));
  assert.ok(w.every((x, i) => x.archGapBeforeMm === auto[i].archGapBeforeMm && (Math.abs(x.movedMm + (x.wheel.startsWith('F') ? 2 : 3)) < 0.6 || x.warnings.includes('LIMITED_BY_CLEARANCE'))), JSON.stringify(w));
});
