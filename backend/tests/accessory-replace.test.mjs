// Replaced zones in the REAL viewer code (sceneHtml.ts via scripts/accessory-fit-check.mjs, headless Chrome, local Three.js):
// a front bumper never shows two bumpers (the car's own bumper surface is fully hidden while the part is on), and an add-on's
// replace zone hides the stock part while on and brings it back when off (E36 + the published wing).
import { test } from 'node:test'; import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process'; import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'; import { resolve } from 'node:path';
import { ROOT, loadTS } from '../scripts/vehicle-audit-lib.mjs';

const { CAR_MODELS } = loadTS(resolve(ROOT, 'mobile/src/features/car3d/models.ts'));
const E36 = CAR_MODELS.find(m => m.key === 'bmw-3-series-e36');
const CAR = resolve(ROOT, 'backend/public/3d/bmw-3-series-e36.glb');
const WING = resolve(ROOT, 'backend/public/3d/accessories/acc-7e40b463d76777b8.glb');
const M3_BUMPER = resolve(ROOT, '3d-source/accessory-photos/test/free_bmw_e36_m3_front_bumper.glb'); // CC BY test part, not in git
const TMP = resolve(ROOT, 'backend/.private/accessory-replace-test');
const E36_WING = { box: { x: [0, 1], y: [0, 1], z: [0.04, 0.1] }, replace: { box: { x: [0.16, 0.84], y: [0.735, 0.9], z: [0, 0.075] } } };
const E36_BUMPER = { box: { x: [0, 1], y: [0, 0.34], z: [0.905, 1] } };

function check(name, zones, part, kit) {
  const dir = resolve(TMP, name); mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'config.json'), JSON.stringify({ ...E36, zones })); writeFileSync(resolve(dir, 'kit.json'), JSON.stringify(kit));
  const out = execFileSync(process.execPath, [resolve(ROOT, 'backend/scripts/accessory-fit-check.mjs'), `--car=${CAR}`, `--config=${resolve(dir, 'config.json')}`,
    `--part=${part}`, `--kit=${resolve(dir, 'kit.json')}`, `--out=${dir}`, '--views=check'], { encoding: 'utf8', timeout: 180_000, windowsHide: true });
  return JSON.parse(out.trim().split('\n').pop()).fit;
}
const skip = !existsSync(CAR) || !existsSync(WING) || !existsSync(resolve(ROOT, '.private/three-r160/package')) ? 'E36 / wing model or local Three.js missing' : false;
test.after(() => rmSync(TMP, { recursive: true, force: true }));

// Bumpers replace the car's own bumper only from a CONFIRMED part map (tests/bumper-viewer.test.mjs); a zone is no longer enough.
for (const [label, zones] of [['tuned E36 zone', { FRONT_BUMPER: E36_BUMPER }], ['default zone', {}]])
  test(`front bumper with only a ${label} (no part map): refused, no second bumper is ever drawn`, { skip: skip || (!existsSync(M3_BUMPER) && 'test part not present') }, () => {
    assert.throws(() => check(`bumper-${label}`.replace(/\W+/g, '-'), zones, M3_BUMPER, { type: 'FRONT_BUMPER' }), /3D preview not available for this car/);
  });

test('E36 wing zone fallback: everything of the body INSIDE the replace box is hidden while on, and comes back when off', { skip }, () => {
  const fit = check('wing-replace', { WING: E36_WING }, WING, { type: 'WING', size: { widthMm: 1300 } });
  assert.equal(fit.replaces.how, 'tuned box');
  assert.equal(fit.check.on.visibleBodyVerticesInZone, 0, 'stock spoiler still visible under the wing');
  assert.ok(fit.check.on.allHidden);
  assert.ok(fit.check.off.visibleBodyVerticesInZone > 1000, 'stock spoiler must come back');
});

test('E36 wing without a replace zone hides nothing (the E36 spoiler is part of the body shell, so it needs a tuned zone)', { skip }, () => {
  const fit = check('wing-plain', { WING: { box: E36_WING.box } }, WING, { type: 'WING', size: { widthMm: 1300 } });
  assert.equal(fit.replaces, undefined); assert.equal(fit.check.on, null);
});
