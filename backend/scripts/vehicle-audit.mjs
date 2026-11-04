// Run from repo root: node backend/scripts/vehicle-audit.mjs
import { mkdirSync, writeFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, AUDIT, inventory, inspectAsset, json, hash } from './vehicle-audit-lib.mjs';

mkdirSync(resolve(AUDIT, 'technical'), { recursive: true });
const data = inventory();
let database = { verified: false, reason: 'DATABASE_URL not provided to developer process; no database IDs inferred.' };
if (process.env.DATABASE_URL) {
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000, statement_timeout: 5000 });
  try {
    await client.connect();
    const result = await client.query('SELECT g.id, g.code, g."yearFrom", g."yearTo", g."model3dKey", g."modelSourceUrl", g."modelLicense", v.make, v.model FROM "VehicleGeneration" g JOIN "Vehicle" v ON v.id = g."vehicleId"');
    database = { verified: true, rows: result.rows };
  } catch (error) { database = { verified: false, reason: `Read-only database inspection unavailable (${error.code || 'CONNECTION_FAILED'}).` }; }
  finally { await client.end().catch(() => {}); }
}
const selected = process.argv.find(a => a.startsWith('--key='))?.slice(6);
const entries = selected ? data.entries.filter(e => e.key === selected) : data.entries;
if (selected && !entries.length) throw new Error('Unknown inventory key');
for (const entry of entries) {
  for (const [kind, path] of [['current', entry.currentAsset], ['original', entry.originalAsset]]) {
    if (!path) continue;
    const output = resolve(AUDIT, 'technical', `${entry.key}.${kind}.json`);
    const full = resolve(ROOT, path);
    let detail;
    if (existsSync(output) && existsSync(full)) {
      const cached = json(output);
      if (cached.sha256 === hash(full)) detail = cached;
    }
    detail ??= await inspectAsset(full);
    writeFileSync(output, JSON.stringify(detail, null, 2) + '\n');
    entry[kind] = { ...detail, hierarchy: undefined, rootTransforms: undefined, texturesInfo: undefined,
      wheelLike: detail.wheelLike?.map(n => n.name), bodyLike: detail.bodyLike?.map(n => n.name),
      bumperLike: detail.bumperLike?.map(n => n.name), roofLike: detail.roofLike?.map(n => n.name), rearLike: detail.rearLike?.map(n => n.name), detailFile: `technical/${entry.key}.${kind}.json` };
  }
  entry.issues = [];
  entry.databaseGenerations = database.verified ? database.rows.filter(r => (entry.model3dKey && r.model3dKey === entry.model3dKey) || (r.code === entry.code && r.model === entry.model && r.make.toLowerCase() === entry.make?.replace('Mercedes-Benz', 'Mercedes').toLowerCase())) : [];
  if (database.verified && entry.configuration && !entry.databaseGenerations.some(r => r.model3dKey === entry.model3dKey)) entry.issues.push('DATABASE_MAPPING_NOT_FOUND');
  if (!entry.generation) entry.issues.push('GENERATION_NOT_IN_MASTER');
  if (entry.scope === 'model-library' && entry.current?.missing) entry.issues.push('MISSING_CURRENT_ASSET');
  if (entry.current && !entry.current.loaded && !entry.current.missing) entry.issues.push('CURRENT_LOAD_FAILED');
  if (!entry.author || !entry.license || !entry.source) entry.issues.push('INCOMPLETE_ATTRIBUTION');
  if (entry.manifest && (entry.manifest.inApp !== false) !== !!entry.configuration) entry.issues.push('MANIFEST_CONFIG_MISMATCH');
  if (entry.configuration && entry.configuration.credit.url !== entry.source) entry.issues.push('CREDIT_SOURCE_MISMATCH');
  if (entry.current?.loaded) {
    entry.accessoryReadiness.signals = { wheelMeshes: entry.current.wheelLike.length, bodyMeshes: entry.current.bodyLike.length,
      bumperMeshes: entry.current.bumperLike.length, roofMeshes: entry.current.roofLike.length, rearMeshes: entry.current.rearLike.length };
  }
  console.log(`${entry.key}: current=${entry.current?.loaded ? 'inspected' : entry.current?.missing ? 'missing' : 'unavailable'}, source=${entry.original?.loaded ? 'inspected' : 'unavailable'}`);
}
// A partial run must never replace the complete inventory report.
if (selected) process.exit(0);
const library = entries.filter(e => e.scope === 'model-library');
const publicFiles = readdirSync(resolve(ROOT, 'backend/public/3d')).filter(f => f.endsWith('.glb'));
const expected = new Set(library.filter(e => e.configuration).map(e => `${e.manifest?.file ?? e.key}.glb`));
const report = {
  schemaVersion: 1, generatedAt: new Date().toISOString(), phase: 'LOCAL_TECHNICAL_COMPLETE_VISUAL_PENDING',
  limitations: ['No visual classification without six rendered views and explicit review.', ...(database.verified ? [] : [database.reason]), 'Node names are signals, not proof of accessory readiness or defects.'],
  database,
  summary: { generationRows: data.generationRows.length, totalDiscovered: entries.length, totalMapped: library.length,
    published: library.filter(e => e.configuration).length, heldForReview: library.filter(e => !e.configuration).length,
    technicallyTested: library.filter(e => e.current?.loaded).length, sourceAssetsInspected: entries.filter(e => e.original?.loaded).length,
    rendered: 0, visuallyAudited: 0, PASS: 0, FIXED: 0, REPLACED: 0, REPLACE: 0, UNCERTAIN: library.length,
    missing: library.filter(e => e.current?.missing).length, failed: library.filter(e => e.current && !e.current.loaded && !e.current.missing).length,
    sketchfabSearches: 0, candidatesDownloaded: 0 },
  duplicateConfigKeys: data.duplicateConfigKeys, duplicateAssetMappings: data.duplicateAssetMappings, duplicateSources: data.duplicateSources,
  unmappedPublicFiles: publicFiles.filter(f => !expected.has(f)), entries,
  brokenCreditPaths: [...new Set(readFileSync(resolve(ROOT,'docs/3d/CREDITS.md'),'utf8').match(/backend\/public\/3d\/[a-zA-Z0-9_./-]+\.glb/g) || [])].filter(path => !existsSync(resolve(ROOT,path))),
};
const renderPath = resolve(AUDIT, 'render-run.json');
if (existsSync(renderPath)) {
  report.renderRun = json(renderPath);
  report.summary.rendered = report.renderRun.viewerSha256 === hash(resolve(ROOT,'mobile/src/features/car3d/sceneHtml.ts')) ? report.renderRun.results.filter(r => {
    const e = entries.find(e => e.key === r.key);
    return e?.current?.sha256 === r.sha256 && r.screenshots?.length === 6 && r.screenshots.every(s => existsSync(resolve(AUDIT,s.path))) && (!e.configuration || JSON.stringify(e.configuration) === JSON.stringify(r.configuration));
  }).length : 0;
  if (report.renderRun.blocker) { report.phase = 'BLOCKED_VIEWER_DEPENDENCIES'; report.limitations.push(report.renderRun.blocker); }
}
report.complexityRanking = library.filter(e => e.current?.loaded).sort((a,b) => b.current.triangles - a.current.triangles).slice(0,12).map(e => ({key:e.key,triangles:e.current.triangles,vertices:e.current.vertices,bytes:e.current.bytes,notes:'Among the heaviest existing models; requires runtime/device measurement, not an automatic rejection.'}));
writeFileSync(resolve(AUDIT, 'vehicle-model-audit.json'), JSON.stringify(report, null, 2) + '\n');
const escape = s => String(s ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
const lines = ['# MOTEXA vehicle model audit', '', `Generated ${report.generatedAt}.`, '',
  '**Incomplete: technical inspection is not a visual PASS. Every model remains UNCERTAIN until rendered and reviewed.**', '',
  '```json', JSON.stringify(report.summary, null, 2), '```', '',
  'The 301-row vehicle catalogue includes generations with no model. The model-library count covers manifest/config entries; additional undownloaded candidate references are inventoried separately.', '',
  '## Current model inventory', '', '| Generation | Years | Key | Current asset | Source / author / license | Status | Technical notes | Accessory signals |', '|---|---|---|---|---|---|---|---|'];
for (const e of library) lines.push(`| ${escape(`${e.make} ${e.model} ${e.code}`)} | ${escape(e.yearRange)} | ${e.key} | ${escape(e.currentAsset)} | ${escape(`${e.source}; ${e.author}; ${e.license}`)} | UNCERTAIN — VISUAL AUDIT PENDING | ${escape([...(e.issues || []), ...(e.current?.flags || []), e.current?.loaded ? `${e.current.triangles} triangles; ${e.current.bytes} bytes` : 'not loaded'].join('; '))} | ${escape(JSON.stringify(e.accessoryReadiness.signals || {}))} |`);
lines.push('', '## Blockers / limitations', '', ...report.limitations.map(s => '- '+s), '', '## Highest-complexity models (device measurement pending)', '', ...report.complexityRanking.map(e=>`- ${e.key}: ${e.triangles.toLocaleString('en-US')} triangles, ${e.bytes} bytes.`), '', '## Interpretation', '', '- Full transforms, scene hierarchy, animations and bounds are in the per-asset technical JSON files.', '- Original and prepared files are inspected separately, identified by SHA-256; no asset is rewritten.', '- Counts are unique mesh geometry, not GPU draw calls. Scale warnings use source units and require review.', '- No universal triangle cutoff is used. Desktop/headless evidence cannot verify Expo Go performance.', '- No replacements, normalization fixes, or licensing approvals have been inferred from these measurements.', '- Search/download is gated on completing the local visual audit.', '');
writeFileSync(resolve(AUDIT, 'vehicle-model-audit.md'), lines.join('\n'));
console.log(JSON.stringify(report.summary));
