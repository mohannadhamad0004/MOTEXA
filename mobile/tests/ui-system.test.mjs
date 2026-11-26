// docs/guide/10-ui-system.md: every provider / admin screen is built on the new templates (components/manage/* + the Garage kit).
// Walks the import graph from every provider / admin route (the two "Preview" screens keep the customer look on purpose) and fails
// when a reachable file still imports an old page frame or the old kits (by import text and by resolved file). PENDING lists the
// files not migrated yet: it only shrinks, and it is empty since the UI-system run finished (2026-11-26).
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { test } from "node:test";

const SRC = resolve("src");
const AREAS = ["app/dept", "app/admin", "app/provider", "app/driver", "app/mechanic"];
const CUSTOMER_LOOK = new Set(["app/provider/parts/preview.tsx", "app/provider/tow/preview.tsx"]);
/** old frames by name, old kits by path */
const OLD_NAMES = ["DeptPage", "DeptHero", "DeptHead", "GaragePage", "GarageHero", "DashboardLayout", "ProviderLayout", "MechanicPage"];
const OLD_PATHS = [/components\/blueprint/, /components\/MotexaVisual/, /components\/BrandSurfaces/, /components\/EditorialUI/, /components\/InteractiveButton/,
  /components\/LoadingState/, /components\/PremiumUI/, /components\/MechanicUI/, /components\/layout\/(DashboardLayout|ProviderLayout|ProviderHeader)/,
  // components/ui + useTheme = the "Blueprint Editorial" kit (docs/guide/04-mobile.md §4): provider / admin screens use the Garage kit instead
  /components\/ui\//, /theme\/useTheme/];
/** the new system itself (its own files may name the customer frame) */
/** the same old kits as resolved files: also catches relative imports inside components/ (e.g. "./MotexaVisual") */
const OLD_FILES = [/^components\/(blueprint\/|ui\/|MotexaVisual|BrandSurfaces|EditorialUI|InteractiveButton|LoadingState|PremiumUI|MechanicUI)/,
  /^components\/layout\/(DashboardLayout|ProviderLayout|ProviderHeader)/, /^theme\/useTheme/];
const KIT = [/^components\/garage\//, /^components\/manage\//, /^theme\//,
  // the old kits themselves: forbidden destinations, flagged where they are imported
  ...OLD_FILES];

export const PENDING = new Set([

]);

const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) ? [p] : []; });
const resolveImport = (from, spec) => {
  if (!spec.startsWith(".")) return null;
  const base = resolve(dirname(from), spec);
  for (const c of [base, `${base}.tsx`, `${base}.ts`, join(base, "index.tsx"), join(base, "index.ts")]) if (existsSync(c) && statSync(c).isFile()) return c;
  return null;
};
const rel = p => relative(SRC, p).replaceAll("\\", "/");

export function offenders() {
  const entries = AREAS.flatMap(a => walk(join(SRC, a))).filter(p => !CUSTOMER_LOOK.has(rel(p)));
  const seen = new Set(), queue = [...entries], bad = new Map();
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const r = rel(file);
    if (KIT.some(k => k.test(r))) continue;
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/import\s+(?:type\s+)?([\s\S]*?)\s+from\s+["']([^"']+)["']|export\s+(?:\{[^}]*\}|\*)\s+from\s+["']([^"']+)["']/g)) {
      const names = m[1] ?? "", spec = m[2] ?? m[3];
      const next = resolveImport(file, spec);
      const hit = OLD_NAMES.filter(n => new RegExp(`\\b${n}\\b`).test(names)).concat(OLD_PATHS.filter(p => p.test(spec)).map(p => spec))
        .concat(next && OLD_FILES.some(p => p.test(rel(next))) ? [rel(next)] : []);
      if (hit.length) bad.set(r, [...new Set([...(bad.get(r) ?? []), ...hit])]);
      if (next && !(CUSTOMER_LOOK.has(rel(next)))) queue.push(next);
    }
  }
  return bad;
}

test("provider / admin screens use only the new templates (old frames and kits are gone)", () => {
  const bad = offenders();
  const unexpected = [...bad].filter(([f]) => !PENDING.has(f)).map(([f, h]) => `${f}: ${h.join(", ")}`);
  assert.deepEqual(unexpected, [], `old frames in migrated screens:\n${unexpected.join("\n")}`);
  const stale = [...PENDING].filter(f => !bad.has(f));
  assert.deepEqual(stale, [], `remove from PENDING (already migrated): ${stale.join(", ")}`);
});
