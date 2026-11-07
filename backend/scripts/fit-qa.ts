// STEP FIT-QA: every published accessory + the QA stand-ins (3d-source/qa-standins, TEST ONLY) on every active car, through the real viewer
// (accessory-fit-check.mjs --views=qa, the car's runtime config from the DB). Read-only: no fits stored, nothing published.
//   npx tsx scripts/fit-qa.ts [--cars=a,b] [--parts=RIMS,WING]   -> docs/3d/fit-qa/results.json + <car>/<part>.jpg
import { execFile } from 'node:child_process'; import { promisify } from 'node:util';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, renameSync } from 'node:fs'; import path from 'node:path';
import { activeModels, REPO_ROOT } from '../src/services/vehicle3d-catalog.js';
import { modelWithZones } from '../src/services/accessory3d.js';
import { fitVersion } from '../src/services/accessory-autofit.js';
import { prisma } from '../src/prisma.js';

const OUT = path.join(REPO_ROOT, 'docs/3d/fit-qa'), arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3).split(',');
type Part = { id: string; type: string; name: string; file: string; standIn: boolean; forCars: string[] | null; size: Record<string, number | null>; finish?: string | null };
const published = await prisma.productAccessory3D.findMany({ where: { status: 'PUBLISHED', product: { isHidden: false } }, include: { product: { select: { name: true, isUniversal: true } }, fits: { include: { generation: true } } } });
const parts: Part[] = published.map(a => ({ id: a.accessoryType + (a.kitPart !== 'MAIN' ? '-' + a.kitPart : '') + '-' + a.publishedFile!.slice(4, 10), type: a.accessoryType, name: a.product.name,
  file: path.join(REPO_ROOT, 'backend/public/3d/accessories', a.publishedFile + '.glb'), standIn: false,
  forCars: a.accessoryType === 'RIMS' && a.product.isUniversal ? null : a.fits.map(f => f.generation.model3dKey).filter((k): k is string => !!k),
  size: { widthMm: a.widthMm, lengthMm: a.lengthMm, rimInches: a.rimInches }, finish: a.rimFinish }));
for (const [type, f] of [['REAR_BUMPER', 'rear-bumper'], ['FRONT_LIP', 'front-lip'], ['REAR_DIFFUSER', 'rear-diffuser'], ['SIDE_SKIRTS', 'side-skirt'], ['ROOF_RACK', 'roof-rack']] as const)
  parts.push({ id: type + '-standin', type, name: `QA stand-in ${f} (test only)`, file: path.join(REPO_ROOT, '3d-source/qa-standins', f + '.glb'), standIn: true, forCars: null, size: {} });
const cars = activeModels().filter(m => !arg('cars') || arg('cars')!.includes(m.key)), todo = parts.filter(p => !arg('parts') || arg('parts')!.includes(p.type));
const confirmed = new Set((await prisma.carPartMap.findMany({ where: { confirmedAt: { not: null } }, select: { model3dKey: true } })).map(r => r.model3dKey));

/** Why a refusal happened: the car model, a part made for another car, no part map, or the fitting itself (code / part shape). */
function category(reason: string, qa: { clipMm?: number; gapMm?: number; limitMm?: number; stock?: { clipMm: number } } | undefined): string {
  if (/part map/i.test(reason)) return 'NO_PART_MAP';
  if (/no rear deck|no roof|no mount surface|no wheels found|no mirrors|pickup|feet are not over|under glass|AXLE|NO_WHEEL|TYRE_NOT/i.test(reason)) return 'CAR_MODEL';
  // the clip is the only failure and the car's own stock part clips as deep there: the model is the cause (a gap is never the model's)
  const lim = qa?.limitMm ?? 6;
  if (/does not look fitted/.test(reason) && qa?.stock && qa.clipMm !== undefined && (qa.gapMm ?? 0) <= lim && qa.stock.clipMm >= qa.clipMm - 2 && qa.clipMm > lim) return 'CAR_MODEL';
  return 'FIT_CODE_OR_PART';
}
const results: unknown[] = existsSync(path.join(OUT, 'results.json')) && (arg('cars') || arg('parts')) ? JSON.parse(readFileSync(path.join(OUT, 'results.json'), 'utf8')).results : [];
const jobs = cars.flatMap(c => todo.map(p => ({ c, p })));
async function run({ c, p }: (typeof jobs)[number]) {
  const model = await modelWithZones(c.key); if (!model) throw Error('missing model ' + c.key);
  const dir = path.join(OUT, '_work', c.key + '-' + p.id); mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'config.json'), JSON.stringify(model));
  writeFileSync(path.join(dir, 'kit.json'), JSON.stringify({ type: p.type, size: p.size, finish: p.finish ?? undefined, qaEvidence: true }));
  let fit: Record<string, any>, error: string | null = null;
  try {
    const { stdout } = await promisify(execFile)(process.execPath, [path.join(REPO_ROOT, 'backend/scripts/accessory-fit-check.mjs'), `--car=${path.join(REPO_ROOT, 'backend/public/3d', c.key + '.glb')}`,
      `--config=${path.join(dir, 'config.json')}`, `--part=${p.file}`, `--kit=${path.join(dir, 'kit.json')}`, `--out=${dir}`, '--views=qa', ...(process.argv.includes('--close') ? ['--qa-close'] : [])], { timeout: 300_000, windowsHide: true, maxBuffer: 16 << 20 });
    fit = JSON.parse(stdout.trim().split('\n').pop()!).fit;
  } catch (e) { error = (/Error: ([^\n\r]*)/.exec(String((e as { stderr?: string }).stderr ?? e))?.[1] ?? String(e)).slice(0, 400); fit = {}; }
  const qa = fit.qa, forOther = p.forCars !== null && !p.forCars.includes(c.key);
  const fitReason = error ?? fit.refused ?? qa?.wouldRefuse ?? null;
  const status = fitReason ? 'refused' : qa?.corrected ? 'auto-corrected' : 'shown';
  const shot = path.join(OUT, c.key, p.id + '.jpg');
  if (existsSync(path.join(dir, 'qa.jpg'))) { mkdirSync(path.dirname(shot), { recursive: true }); renameSync(path.join(dir, 'qa.jpg'), shot); }
  for (const k of ['qa-clip', 'qa-gap', 'qa-clip2', 'qa-clip3']) if (existsSync(path.join(dir, k + '.jpg'))) renameSync(path.join(dir, k + '.jpg'), path.join(OUT, c.key, `${p.id}.${k.slice(3)}.jpg`)); // --close: worst-point close-ups
  rmSync(dir, { recursive: true, force: true });
  const row = { car: c.key, part: p.id, type: p.type, partName: p.name, standIn: p.standIn, madeForOtherCar: forOther, partMap: confirmed.has(c.key) ? 'confirmed' : 'proposal, not confirmed',
    // what a customer gets: a part made for another car is never offered there (fitment), whatever the fit says
    status: forOther ? 'refused' : status, fitStatus: status, reason: forOther ? `part made for another car (${p.forCars!.join(', ')})` + (fitReason ? `; the fit itself: ${fitReason}` : '') : fitReason,
    category: forOther ? 'PART_FOR_OTHER_CAR' : fitReason ? category(fitReason, qa) : null,
    tier: fitReason ? 'REFUSED' : qa?.tier ?? null, limitMm: qa?.limitMm ?? null, clipMm: qa?.clipMm ?? null, gapMm: qa?.gapMm ?? null, stockClipMm: qa?.stock?.clipMm ?? null, before: qa?.before ?? null, corrected: qa?.corrected ?? null,
    clipAt: qa?.clipAt ?? null, gapAt: qa?.gapAt ?? null, screenshot: existsSync(shot) ? path.relative(path.join(REPO_ROOT, 'docs/3d'), shot).replace(/\\/g, '/') : null };
  const i = results.findIndex(r => (r as { car: string; part: string }).car === c.key && (r as { part: string }).part === p.id); if (i >= 0) results[i] = row; else results.push(row);
  console.log(`${c.key} ${p.id}: ${row.status}${row.status !== row.fitStatus ? ' (fit: ' + row.fitStatus + ')' : ''} ${row.tier ?? ''} clip ${row.clipMm} gap ${row.gapMm} / ${row.limitMm}${row.reason ? ' — ' + row.reason.slice(0, 120) : ''}`);
}
try {
  let next = 0; await Promise.all([0, 1, 2].map(async () => { while (next < jobs.length) await run(jobs[next++]!); }));
  writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ fitVersions: Object.fromEntries(['RIMS', 'WING', 'FRONT_BUMPER', 'FRONT_LIP'].map(t => [t, fitVersion(t)])), thresholds: { perfect: { clipMm: 2, gapMm: 3 }, good: 'clip and gap <= 6 mm, or <= 0.5 % of the part size when larger (limitMm per row)' }, results }, null, 1) + '\n');
  rmSync(path.join(OUT, '_work'), { recursive: true, force: true });
} finally { await prisma.$disconnect(); }
