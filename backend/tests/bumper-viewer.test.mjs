// Bumper "replace" fit in the REAL viewer code (sceneHtml.ts via scripts/accessory-fit-check.mjs, headless Chrome, local Three.js) on the
// E36: a bumper made for the car fits with small visible edge gaps; a bumper of another car / a wrong shape is refused; no confirmed part
// map = refused; a body kit's two bumpers are switched on and off separately and each brings its own stock bumper back.
// FIT-QA (visible clipping / floating gaps, refusal) has its own suite (fit-qa-viewer.test.mjs): here the parts run in evidence mode, so
// this file keeps testing its own mechanism with the E36 demo parts the QA refuses.
import { test } from 'node:test'; import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process'; import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'; import { resolve } from 'node:path';
import { ROOT, loadTS } from '../scripts/vehicle-audit-lib.mjs';

const { CAR_MODELS } = loadTS(resolve(ROOT, 'mobile/src/features/car3d/models.ts'));
const E36 = CAR_MODELS.find(m => m.key === 'bmw-3-series-e36'), CAR = resolve(ROOT, 'backend/public/3d/bmw-3-series-e36.glb');
const M3 = resolve(ROOT, '3d-source/accessory-photos/test/free_bmw_e36_m3_front_bumper.glb'); // CC BY E36 M3 front bumper (test part, not in git)
const E46 = resolve(ROOT, '3d-source/accessory-photos/test/bmw_e46_bumper.glb');
const TMP = resolve(ROOT, 'backend/.private/bumper-test');
const skip = !existsSync(M3) || !existsSync(resolve(ROOT, '.private/three-r160/package')) ? 'test bumper or local Three.js missing' : false;
test.after(() => rmSync(TMP, { recursive: true, force: true }));
function run(name, args, { partMap, kit, kit2 } = {}) {
  const dir = resolve(TMP, name); mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'config.json'), JSON.stringify({ ...E36, ...(partMap ? { partMap } : {}) }));
  const extra = [];
  if (kit) { writeFileSync(resolve(dir, 'kit.json'), JSON.stringify({ ...kit, qaEvidence: true })); extra.push(`--kit=${resolve(dir, 'kit.json')}`); }
  if (kit2) { writeFileSync(resolve(dir, 'kit2.json'), JSON.stringify({ ...kit2, qaEvidence: true })); extra.push(`--kit2=${resolve(dir, 'kit2.json')}`); }
  try {
    const out = execFileSync(process.execPath, [resolve(ROOT, 'backend/scripts/accessory-fit-check.mjs'), `--car=${CAR}`, `--config=${resolve(dir, 'config.json')}`, `--out=${dir}`, ...extra, ...args],
      { encoding: 'utf8', timeout: 240_000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    return name.startsWith('seg') ? JSON.parse(readFileSync(resolve(dir, 'pieces.json'), 'utf8')) : JSON.parse(out.trim().split('\n').pop()).fit;
  } catch (e) { return { error: String(e.stderr ?? e).match(/Error: ([^\n]*)/)?.[1] ?? String(e) }; }
}
let map;
test('E46 bumper (wrong car): finite seam distances reject its gap above the limit and leave stock visible; the E36 M3 bumper is accepted', { skip: skip || (!existsSync(E46) && 'E46 test part missing') }, () => {
  map = Object.fromEntries(Object.entries(run('seg', ['--views=segment']).proposal).map(([k, v]) => [k, v.ids]));
  const f = run('e46', ['--views=refusalcheck', `--part=${E46}`], { partMap: map, kit: { type: 'FRONT_BUMPER' } });
  assert.equal(f.error, undefined, f.error);assert.match(f.refused,/does not fit this car cleanly \(.*gap/);assert.equal(f.zone.how, 'part map');
  assert.ok(f.stretch.every(x => x >= 0.95 && x <= 1.05), JSON.stringify(f.stretch));
  assert.ok(Object.values(f.gapsMm).every(g=>Number.isFinite(g.p90)&&Number.isFinite(g.max)));
  assert.ok(Object.values(f.gapsMm).some(g=>g.n>=5&&g.p90>10),JSON.stringify(f.gapsMm));
  assert.deepEqual(f.after,f.before);assert.ok(f.after.FRONT_BUMPER>10000);assert.deepEqual(f.accessories,[]);
  // the E36 M3 bumper: bonnet-line seam p90 16.6 mm is above 10 but inside the 25 mm bonnet / boot-line limit (the car's panel overlaps its top edge)
  assert.equal(run('m3ok', ['--views=fit', `--part=${M3}`], { partMap: map, kit: { type: 'FRONT_BUMPER' } })?.error, undefined);
});

test('a bumper of another car or the wrong shape gets a fit error instead of something broken', { skip: skip || (!existsSync(E46) && 'E46 test part missing') }, () => {
  assert.match(run('e46', ['--views=fit', `--part=${E46}`], { partMap: map, kit: { type: 'FRONT_BUMPER' } }).error ?? '', /does not fit this car cleanly \(.*gap/);
  assert.match(run('wrong', ['--views=fit', `--part=${resolve(ROOT, 'backend/public/3d/accessories/acc-7e40b463d76777b8.glb')}`], { partMap: map, kit: { type: 'FRONT_BUMPER' } }).error ?? '', /does not fit this car cleanly/);
});

test('without a confirmed part-map bumper there is no bumper preview on that car', { skip }, () => {
  assert.match(run('nomap', ['--views=fit', `--part=${M3}`], { kit: { type: 'FRONT_BUMPER' } }).error ?? '', /3D preview not available for this car/);
});

test("a refused bumper alongside a wing keeps stock intact; OFF restores only the wing's stock spoiler", { skip: skip || (!existsSync(E46) && 'E46 test part missing') }, () => {
  const wing=resolve(ROOT,'backend/public/3d/accessories/acc-7e40b463d76777b8.glb');
  const k = run('kit', ['--views=kit', `--part=${E46}`, `--part2=${wing}`], { partMap: map, kit: { type: 'FRONT_BUMPER' }, kit2: { type: 'WING', size: { widthMm:1300 } } }).kit;
  assert.equal(k.both.on.length,1);assert.ok(k.both.parts.FRONT_BUMPER>0);assert.equal(k.both.parts.SPOILER,0);
  assert.deepEqual(k.firstOff.parts,k.both.parts);
  assert.equal(k.allOff.parts.FRONT_BUMPER,k.both.parts.FRONT_BUMPER);assert.ok(k.allOff.parts.SPOILER>0);
});
