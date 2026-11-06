// Read-only catalog/DB audit using the production viewer. No asset downloads or fit writes.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { activeModels, REPO_ROOT } from '../src/services/vehicle3d-catalog.js';
import { modelWithZones } from '../src/services/accessory3d.js';
import { fitVersion } from '../src/services/accessory-autofit.js';
import { prisma } from '../src/prisma.js';
const hash = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
const out = path.join(REPO_ROOT, 'docs/3d/rims-general');
const part = path.join(REPO_ROOT, 'backend/public/3d/accessories/acc-512a47b76cd1b556.glb');
const selected = process.argv.find(a => a.startsWith('--cars='))?.slice(7).split(',');
const shots = new Set(['bmw-3-series-e36', 'mercedes-e-class-w212', 'audi-a4-b5', 'peugeot-208-2nd-gen-p21', 'peugeot-308-2nd-gen-t9', 'toyota-corolla-e210']);
const results: unknown[] = [];
try {
  for (const car of activeModels().filter(m => !selected || selected.includes(m.key))) {
    const model = await modelWithZones(car.key); if (!model) throw Error('Missing active model');
    const zones = { ...model.zones } as Record<string, Record<string, unknown>>;
    const legacyOverride = zones.RIMS?.wheelInsetMm ?? null;
    if (zones.RIMS) { zones.RIMS = { ...zones.RIMS }; delete zones.RIMS.wheelInsetMm; if (!Object.keys(zones.RIMS).length) delete zones.RIMS; }
    const dir = path.join(out, car.key); mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ ...model, zones }));
    writeFileSync(path.join(dir, 'kit.json'), JSON.stringify({ type: 'RIMS', finish: 'SILVER', size: { rimInches: 17 } }));
    const asset = path.join(REPO_ROOT, 'backend/public/3d', car.key + '.glb');
    let result;
    try {
      execFileSync(process.execPath, [path.join(REPO_ROOT, 'backend/scripts/accessory-fit-check.mjs'), `--car=${asset}`, `--config=${path.join(dir, 'config.json')}`, `--part=${part}`, `--kit=${path.join(dir, 'kit.json')}`, `--out=${dir}`, `--views=${shots.has(car.key) && !process.argv.includes('--fit-only') ? 'rims' : 'fit'}`], { timeout: 240000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      result = JSON.parse(readFileSync(path.join(dir, 'fit-evidence.json'), 'utf8'));
    } catch (error) { result = { refusal: String((error as { stderr?: unknown }).stderr ?? error).slice(-3000) }; }
    const row = { key: car.key, assetSha256: hash(asset), legacyOverride, ...result }; results.push(row);
    console.log(JSON.stringify({ key: car.key, refusal: result.refusal ?? null, wheels: result.fit?.wheels ?? [] }));
  }
  writeFileSync(path.join(REPO_ROOT, 'docs/3d/rims-general-audit.json'), JSON.stringify({ algorithmVersion: fitVersion('RIMS'), partial: !!selected, testRim: { file: path.relative(REPO_ROOT, part), sha256: hash(part), diameterInches: 17 }, results }, null, 2) + '\n');
} finally { await prisma.$disconnect(); }
