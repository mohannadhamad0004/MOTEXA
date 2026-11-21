// Merge hash-bound render evidence and explicit visual decisions into the EXISTING inventory.
// Does not inspect geometry, access the database, change assets, or infer PASS from render success.
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, AUDIT, hash, json } from './vehicle-audit-lib.mjs';

const path = resolve(AUDIT, 'vehicle-model-audit.json');
const report = json(path);
if (report.stageA?.complete) throw new Error('Stage A history exists: do not reset its statuses with the baseline report merger. Update stage-specific evidence instead.');
const decisionPath = resolve(AUDIT, 'visual-decisions.json');
const decisions = existsSync(decisionPath) ? json(decisionPath) : {};
const runPath = resolve(AUDIT, 'local-render-run.json');
const run = existsSync(runPath) ? json(runPath) : null;
const allowed = ['PASS', 'FIX_CONFIG', 'FIX_PIPELINE', 'REPLACE', 'UNCERTAIN'];
const counts = Object.fromEntries(allowed.map(k => [k, 0]));
const viewerHash = hash(resolve(ROOT, 'mobile/src/features/car3d/sceneHtml.ts'));
const compatibleHashes = existsSync(resolve(AUDIT,'compatible-renderer-hashes.json')) ? json(resolve(AUDIT,'compatible-renderer-hashes.json')) : [];
const rendererHash = hash(resolve(ROOT, 'backend/scripts/vehicle-audit-render.mjs'));
let fullyRendered = 0, preparedRendered = 0, originalRendered = 0, reviewed = 0, heavy = 0;
const expectedViews = ['front','front-three-quarter','left-side','rear-three-quarter','rear','top-three-quarter'];
for (const entry of report.entries.filter(e => e.scope === 'model-library')) {
  const evidence = {};
  for (const variant of ['prepared', 'original']) {
    const file = resolve(AUDIT, 'renders', entry.key, variant, 'evidence.json');
    if (!existsSync(file)) {
      const failureFile=resolve(AUDIT,'renders',entry.key,variant,'failure.json');
      if(existsSync(failureFile)){const f=json(failureFile);const asset=resolve(ROOT,variant==='prepared'?entry.currentAsset:entry.originalAsset);if(f.sha256===hash(asset)&&f.error)evidence[variant]={file:'renders/'+entry.key+'/'+variant+'/failure.json',sha256:hash(failureFile),failed:true};}
      continue;
    }
    const e = json(file);
    const asset = resolve(ROOT, variant === 'prepared' ? entry.currentAsset : entry.originalAsset);
    const complete = e.key === entry.key && e.variant === variant && e.screenshots?.length === 6 && expectedViews.every(v => e.screenshots.some(s => s.name === v && existsSync(resolve(AUDIT,s.path)) && s.sha256 === hash(resolve(AUDIT,s.path))));
    if (complete && e.sha256 === hash(asset) && e.viewerSha256 === viewerHash && (e.rendererSha256 === rendererHash || compatibleHashes.includes(e.rendererSha256))) evidence[variant] = { file:`renders/${entry.key}/${variant}/evidence.json`, sha256:hash(file) };
  }
  if (evidence.prepared && !evidence.prepared.failed) preparedRendered++;
  if (evidence.original && !evidence.original.failed) originalRendered++;
  if (evidence.prepared && evidence.original && !evidence.prepared.failed && !evidence.original.failed) fullyRendered++;
  const d = decisions[entry.key];
  const validated = evidence.prepared && evidence.original && d && allowed.includes(d.classification) && d.reason?.trim() && d.reviewer?.trim()
    && d.preparedEvidenceSha256 === evidence.prepared.sha256 && d.originalEvidenceSha256 === evidence.original.sha256;
  entry.status = validated ? d.classification : 'UNCERTAIN';
  entry.reason = validated ? d.reason : 'VISUAL_AUDIT_PENDING';
  entry.visualNotes = validated ? d.visualNotes ?? d.reason : 'No completed original/prepared visual review. Technical signals are not a classification.';
  entry.visualAudit = { reviewed:!!validated, evidence, ...(validated ? {reviewer:d.reviewer} : {}), staleDecision:!!d && !validated };
  if (validated) { reviewed++; if (d.accessoryReadiness) entry.accessoryReadiness = d.accessoryReadiness; }
  entry.performance = { heavy:entry.current.triangles > 1_000_000, triangles:entry.current.triangles, bytes:entry.current.bytes,
    note:'HEAVY flags prepared geometry above 1M triangles for device measurement, independently of visual classification; no decimation or rejection.', deviceVerified:false };
  if (entry.performance.heavy) heavy++;
  counts[entry.status]++;
}
report.visualUpdatedAt = new Date().toISOString();
report.phase = reviewed === report.summary.totalMapped ? 'VISUAL_CLASSIFICATION_COMPLETE_STOP_BEFORE_SKETCHFAB' : run?.blocker ? 'BLOCKED_LOCAL_THREE_MISSING' : 'VISUAL_REVIEW_PENDING';
Object.assign(report.summary, counts, {rendered:fullyRendered,preparedRendered,originalRendered,modelsRendered:Math.max(preparedRendered,originalRendered),bothVariantsRendered:fullyRendered,renderFailures:run?.results.filter(r=>r.error).length ?? 0,visuallyAudited:reviewed,HEAVY:heavy});
report.localRenderRun = run;
report.localRenderer = {requiredVersion:'0.160.1',source:run?.threeSource ?? null,cdnRequestsAllowed:false,securityWeakened:false};
report.limitations = [
  ...(run?.blocker ? [run.blocker] : []),
  'No geometry inventory rerun. Prior technical measurements and database references preserved.',
  'Visual decisions require both variant evidence hashes (six screenshots per successful variant; recorded errors for failed variants).',
  'Headless desktop rendering does not verify Expo Go or mobile performance.',
  'Accessory name signals are not confirmed physical separability.',
];
writeFileSync(path,JSON.stringify(report,null,2)+'\n');
const clean = s => String(s ?? '').replaceAll('|','\\|').replaceAll('\n',' ');
const lines = ['# MOTEXA vehicle model audit','',`Visual-stage update: ${report.visualUpdatedAt}. Phase: ${report.phase}.`,'',
  reviewed ? 'Classifications below are based on explicit review where marked.' : '**No models have been visually classified. UNCERTAIN means awaiting evidence, not a visual failure.**','',
  '```json',JSON.stringify(report.summary,null,2),'```','','## Local renderer','',
  'Audit-only local import map, exact Three.js 0.160.1, local modules and selected GLB served by Playwright routes. All remote resource requests are blocked; browser security is unchanged. No credentials used. Both versions captured at 900 × 650 with six fixed camera directions. Production viewer source is read but never rewritten.','',
  ...report.limitations.map(s=>'- '+s),'','## Vehicle library','',
  '| Generation | Years | model3dKey | Current asset | Source / author / license | Classification | Reason / visual notes | Triangles / bytes / risk | Accessory notes |',
  '|---|---|---|---|---|---|---|---|---|---|'];
for (const e of report.entries.filter(e=>e.scope === 'model-library')) lines.push(`| ${clean(`${e.make} ${e.model} ${e.code}`)} | ${clean(e.yearRange)} | ${clean(e.model3dKey || `${e.key} (held)`)} | ${e.currentAsset} | ${clean(`${e.source}; ${e.author}; ${e.license}`)} | ${e.status} | ${clean(`${e.reason}; ${e.visualNotes}`)} | ${e.current.triangles} / ${e.current.bytes} / ${e.performance.heavy?'HEAVY':'device unverified'} | ${clean(JSON.stringify(e.accessoryReadiness))} |`);
lines.push('','## Mercedes investigations','',
  '- W203: FIX_CONFIG. Separate proposed renders prove a -90 degree X rotation in a child wrapper before existing heading rotation restores an upright assembled car. Evidence: proposed-w203-minus/. No production change.',
  '- W204: REPLACE. Both original and prepared six-view renders show empty wheel arches, displaced central wheel and loose lower pieces. Source assembly defect; preparation is not the sole cause.','',
  '## Human review and accessory readiness','',
  `${report.summary.totalMapped-reviewed} models await completed visual review. Mesh separability remains unconfirmed. Per-model visual notes and technical node signals are attached.`, '',
  'No Sketchfab searches, downloads, replacements or production changes in this stage. The next phase must wait for all visual classifications and a report.','');
writeFileSync(resolve(AUDIT,'vehicle-model-audit.md'),lines.join('\n'));
console.log(JSON.stringify({phase:report.phase,...report.summary}));
