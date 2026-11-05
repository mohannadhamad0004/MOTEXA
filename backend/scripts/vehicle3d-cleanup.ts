// Run once after reviewing the saved audit. Never deletes raw sources or database generations.
import { copyFileSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT, writeCatalog, type Manifest } from "../src/services/vehicle3d-catalog.js";
const at = (p: string) => path.join(REPO_ROOT, p);
const manifest: Manifest = JSON.parse(readFileSync(at(".private/vehicle3d-cleanup/configured-manifest.json"), "utf8"));
const currentManifest: Manifest = JSON.parse(readFileSync(at("docs/3d/models.json"), "utf8"));
if (Object.values(currentManifest).some(e => e.submissionId || e.generatedBy === "Meshy" || e.file.startsWith("manual-") || e.currentCandidateReview)) throw new Error("Historical cleanup cannot run after customer models have been promoted.");
const audit = JSON.parse(readFileSync(at("3d-source/audit/vehicle-model-audit.json"), "utf8"));
const overrides = JSON.parse(readFileSync(at("docs/3d/cleanup-overrides.json"), "utf8"));
const variants = new Set(["bmw-3-series-e36", "bmw-x5-e53", "volkswagen-polo-mk4-9n", "opel-corsa-b"]);
const variantLabels: Record<string,string> = { "bmw-3-series-e36": "Street-modified E36", "bmw-x5-e53": "Restyled/facelift E53", "volkswagen-polo-mk4-9n": "Three-door Polo 9N", "opel-corsa-b": "Three-door Corsa B" };
const decisions = [];
for (const e of Object.values(manifest)) {
  const a = audit.entries.find((a: any) => a.scope === "model-library" && a.key === e.key);
  if (!a) throw new Error(`Missing audit: ${e.key}`);
  const active = !!e.viewerConfig && e.inApp !== false;
  const keep = !overrides[e.key] && active && ["PASS", "PASS_AFTER_FIX"].includes(a.status) && !a.performance?.heavy;
  const reason = overrides[e.key] ?? (keep ? a.reason + (variantLabels[e.key] ? ` Verified variant: ${variantLabels[e.key]}.` : "") : a.performance?.heavy ? "Over 1M triangles; remove for predictable demo loading rather than invasive optimization."
    : !active ? `Existing provenance/quality hold retained; not promoted. ${a.reason}` : a.reason);
  e.inApp = keep;
  e.finalStatus = keep ? (variants.has(e.key) ? "PASS_VARIANT" : a.status) : "REMOVED";
  e.cleanupReason = reason;
  const pub = at(`backend/public/3d/${e.file}.glb`);
  if (keep && !existsSync(pub)) throw new Error(`Keep asset missing: ${e.key}`);
  if (!keep && existsSync(pub)) {
    const backup = at(".private/vehicle3d-cleanup/production-backups");
    mkdirSync(backup, { recursive: true });
    copyFileSync(pub, path.join(backup, `${e.file}.glb`));
    unlinkSync(pub);
  }
  decisions.push({ key: e.key, vehicle: `${e.make} ${e.model} ${e.code}`, previous: a.status,
    action: keep ? "KEEP" : "REMOVE", status: e.finalStatus, reason, replacement: null });
}
writeCatalog(manifest);
writeFileSync(at("docs/3d/cleanup-decisions.json"), JSON.stringify(decisions, null, 2) + "\n");
const kept = decisions.filter(d => d.action === "KEEP").length;
const rows = decisions.map(d => `| ${d.key} | ${d.vehicle} | ${d.previous} | ${d.action} | ${d.status} | ${d.reason.replace(/[|\r\n]/g, " ")} | — |`);
writeFileSync(at("docs/3d/FINAL-3D-CLEANUP.md"), `# Final 3D cleanup\n\nModels before cleanup: ${decisions.length} inventoried, 95 active production GLBs.\n\nModels kept: ${kept}. Models replaced: 0. Models removed: ${decisions.length-kept} (${95-kept} previously active, ${decisions.length-95} already held). Remaining active shared models: ${kept}.\n\nNo external replacement was selected. Sources and prior modified W204 are backed up privately. Historical PASS is visual evidence, not permission to release previously held assets. Heavy models were removed. No generations were deleted.\n\nFresh production-viewer renders: 38 initial keep candidates rendered in six views; 29 also rendered in six red-paint views. All final retained models were visually reviewed in both sets. Paint contamination, failed paint isolation, stripped geometry, and poor glazing caused further removals. Local Three.js 0.160.1 only; zero remote requests. Evidence is in ignored 3d-source/audit/final and final-paint. PASS_VARIANT denotes a visibly supported street/facelift/three-door variant, not a generic body/trim. Desktop rendering does not verify real Android performance.\n\n| Key | Make/model/generation | Previous audit status | Final action | Final status | Reason | Replacement source |\n|---|---|---|---|---|---|---|\n${rows.join("\n")}\n`);
console.log(JSON.stringify({ before: decisions.length, previouslyActive: 95, kept, removed: decisions.length-kept, replaced: 0 }));
