// Maintenance helper for the UI-system run: removes from PENDING (tests/ui-system.test.mjs) every file that no longer uses an old
// frame. It never adds a file. Usage: node tests/ui-system-prune.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { offenders, PENDING } from "./ui-system.test.mjs";

const bad = offenders();
const keep = [...PENDING].filter(f => bad.has(f)).sort();
const file = new URL("./ui-system.test.mjs", import.meta.url);
const text = readFileSync(file, "utf8").replace(/export const PENDING = new Set\(\[[\s\S]*?\n\]\);/, `export const PENDING = new Set([\n${keep.map(f => `  ${JSON.stringify(f)},`).join("\n")}\n]);`);
writeFileSync(file, text);
const unexpected = [...bad.keys()].filter(f => !PENDING.has(f));
console.log(`PENDING ${PENDING.size} -> ${keep.length}`, unexpected.length ? `\nNOT ALLOWED (fix these): ${unexpected.join(", ")}` : "");
