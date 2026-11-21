// Downloads the 3D car models of docs/3d/generations-master.tsv from Sketchfab into 3d-source/<key>/ (git-ignored).
// Only rows marked ✅ / 🟡 with a real sketchfab.com/3d-models/... URL. The REAL license comes from the Sketchfab API, never the
// TSV: only CC0, CC BY and CC BY-SA are downloaded; NC / ND / Standard / Editorial / unknown are skipped.
// Resumable (a folder with model.glb is done), batches of 10, stops at a total size limit.
//
//   npx tsx --env-file=.env scripts/sketchfab-batch.ts [--limit-gb=3] [--batches=99]
//
// Needs SKETCHFAB_API_TOKEN in backend/.env (never printed). Writes 3d-source/_batch.json (one record per row) for the report.
import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync, readdirSync } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { genKey, parseTsv, sketchfabUid, type TsvRow } from "../src/generations.js";

const ROOT = new URL("../../", import.meta.url);
const SRC = new URL("3d-source/", ROOT);
const LOG = new URL("_batch.json", SRC);
const arg = (k: string, d: number) => Number(process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1] ?? d);
const LIMIT = arg("limit-gb", 3) * 1024 ** 3;
const BATCHES = arg("batches", 99);
const TOKEN = process.env.SKETCHFAB_API_TOKEN;
if (!TOKEN) throw new Error("SKETCHFAB_API_TOKEN is missing in backend/.env");

export const PRIORITY = ["Toyota", "Hyundai", "Kia", "Volkswagen", "Skoda", "Mercedes-Benz"];
const ACCEPT: Record<string, string> = { cc0: "CC0", by: "CC BY 4.0", "by-sa": "CC BY-SA 4.0" };

export type BatchRecord = {
  key: string; make: string; model: string; code: string; url: string; uid: string | null;
  state: "downloaded" | "skipped-license" | "not-downloadable" | "no-url" | "existing" | "over-limit" | "failed";
  license?: string; licenseSlug?: string; author?: string; authorUrl?: string; title?: string; faces?: number;
  flags?: string[]; bytes?: number; error?: string;
};

/** AI / scan / game-derived / low-poly hints, from the TSV notes and the model's own text. */
export function flagsFor(text: string, faces?: number) {
  const f: string[] = [];
  if (/\bAI[- ]?generated\b|\bmeshy\b|\btripo\b|\bAI\b/i.test(text)) f.push("AI");
  if (/\bscan(ned)?\b|photogramm/i.test(text)) f.push("scan");
  if (/\bGTA\b|assetto|forza|game[- ]?(derived|rip|ready|asset)|\brip\b|\bmod\b|gran turismo|need for speed|\bBeamNG\b/i.test(text)) f.push("game");
  if (faces != null && faces < 5000) f.push("low-poly");
  return f;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** GET with back-off on 429 (Sketchfab rate-limits the download endpoint): Retry-After or 30 s, 60 s, ... up to 6 tries. */
const api = async (path: string, auth = false): Promise<any> => {
  for (let i = 0; ; i++) {
    const r = await fetch(`https://api.sketchfab.com/v3/${path}`, auth ? { headers: { Authorization: `Token ${TOKEN}` } } : undefined);
    if (r.status === 429 && i < 5) {
      await wait((Number(r.headers.get("retry-after")) || 30 * (i + 1)) * 1000);
      continue;
    }
    if (!r.ok) throw new Error(`${path.split("/").pop()} -> HTTP ${r.status}`);
    return r.json();
  }
};

const dirBytes = () =>
  existsSync(SRC)
    ? readdirSync(SRC, { withFileTypes: true }).reduce((n, d) => {
        const f = new URL(`${d.name}/model.glb`, SRC);
        return n + (d.isDirectory() && existsSync(f) ? statSync(f).size : 0);
      }, 0)
    : 0;

async function one(row: TsvRow, used: number): Promise<BatchRecord> {
  const key = genKey(row.make, row.model, row.code);
  const base = { key, make: row.make, model: row.model, code: row.code, url: row.url, uid: sketchfabUid(row.url) };
  if (!base.uid) return { ...base, state: "no-url" };
  if (/already used in MOTEXA/i.test(row.notes)) return { ...base, state: "existing" };
  const m = await api(`models/${base.uid}`);
  const slug: string = m.license?.slug ?? "";
  const info = {
    license: ACCEPT[slug] ?? m.license?.label ?? "unknown",
    licenseSlug: slug,
    author: m.user?.displayName ?? m.user?.username,
    authorUrl: m.user?.profileUrl,
    title: m.name,
    faces: m.faceCount,
    flags: flagsFor([row.notes, m.name, m.description, ...(m.tags ?? []).map((t: any) => t.name)].join(" "), m.faceCount),
  };
  if (!ACCEPT[slug]) return { ...base, ...info, state: "skipped-license" };
  if (!m.isDownloadable) return { ...base, ...info, state: "not-downloadable" };
  const dir = new URL(`${key}/`, SRC);
  const file = new URL("model.glb", dir);
  if (existsSync(file)) return { ...base, ...info, state: "downloaded", bytes: statSync(file).size };
  const dl = await api(`models/${base.uid}/download`, true);
  const glb = dl.glb as { url: string; size: number } | undefined;
  if (!glb) throw new Error("no GLB offered");
  if (used + glb.size > LIMIT) return { ...base, ...info, state: "over-limit", bytes: glb.size };
  mkdirSync(dir, { recursive: true });
  const res = await fetch(glb.url);
  if (!res.ok || !res.body) throw new Error(`download HTTP ${res.status}`);
  const part = new URL("model.glb.part", dir);
  await pipeline(Readable.fromWeb(res.body as any), createWriteStream(part));
  renameSync(part, file); // only a complete download gets the real name
  writeFileSync(new URL("source.json", dir), JSON.stringify({ ...base, ...info, downloadedAt: new Date().toISOString() }, null, 2));
  return { ...base, ...info, state: "downloaded", bytes: statSync(file).size };
}

const rank = (make: string) => (PRIORITY.indexOf(make) + 1 || PRIORITY.length + 1);
async function main() {
  mkdirSync(SRC, { recursive: true });
  const rows = parseTsv(readFileSync(new URL("docs/3d/generations-master.tsv", ROOT), "utf8"))
    .filter((r) => /✅|🟡/.test(r.status))
    .map((r, i) => ({ r, i }))
    .sort((a, b) => rank(a.r.make) - rank(b.r.make) || a.i - b.i)
    .map((x) => x.r);
  const log: Record<string, BatchRecord> = existsSync(LOG) ? JSON.parse(readFileSync(LOG, "utf8")) : {};
  let used = dirBytes();
  for (let b = 0; b * 10 < rows.length && b < BATCHES; b++) {
    for (const row of rows.slice(b * 10, b * 10 + 10)) {
      const key = genKey(row.make, row.model, row.code);
      let rec: BatchRecord;
      try {
        rec = await one(row, used);
      } catch (e) {
        rec = { key, make: row.make, model: row.model, code: row.code, url: row.url, uid: sketchfabUid(row.url), state: "failed", error: String((e as Error).message ?? e) };
      }
      if (rec.state === "downloaded") used = dirBytes();
      log[key] = rec;
      writeFileSync(LOG, JSON.stringify(log, null, 2));
      console.log(`${rec.state.padEnd(16)} ${key}  ${rec.license ?? ""} ${rec.bytes ? (rec.bytes / 1e6).toFixed(1) + " MB" : ""} ${rec.flags?.length ? "[" + rec.flags.join(",") + "]" : ""}${rec.error ? " " + rec.error : ""}`);
    }
    console.log(`-- batch ${b + 1} done, ${(used / 1e9).toFixed(2)} GB of ${(LIMIT / 1e9).toFixed(2)} GB used`);
  }
}

if (process.argv[1]?.endsWith("sketchfab-batch.ts")) await main();
