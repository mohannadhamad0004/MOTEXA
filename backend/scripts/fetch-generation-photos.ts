// One photo per car generation from Wikimedia Commons, for the "Is this your car?" step. Only CC0, CC BY and CC BY-SA files
// (read from the file's own license metadata; public-domain marks, NC / ND and anything else are skipped). Each photo is
// resized to at most 800 px and saved as webp in backend/public/cars/<key>.webp (served at /api/cars/); the credit, license and
// source page go to backend/public/cars/photos.json, which the seed copies onto VehicleGeneration. Resumable.
//
//   npx tsx scripts/fetch-generation-photos.ts      then: npm run seed:generations
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { genKey, parseTsv } from "../src/generations.js";

const ROOT = new URL("../../", import.meta.url);
const OUT = new URL("backend/public/cars/", ROOT);
const MANIFEST = new URL("photos.json", OUT);
const UA = { "User-Agent": "MOTEXA-generation-photos/1.0 (car app; one credited photo per car generation)" };
type Photo = { url: string; credit: string; license: string; source: string };

/** CC0, CC BY x.y, CC BY-SA x.y only. */
export const okLicense = (s: string) => /^CC0\b/i.test(s) || /^CC[ -]BY(-SA)?[ -]\d/i.test(s);
const BAD_TITLE = /\b(interior|engine|motor|dashboard|cockpit|badge|logo|emblem|wheels?|trunk|boot|details?|model ?car|toy|diecast|scale|crash|wreck|race|racing|rally|police|taxi)\b/i;
const plain = (html: string) => html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, 120);

async function get(u: URL | string) {
  for (let i = 0; ; i++) {
    const r = await fetch(u, { headers: UA });
    if (r.status !== 429 || i >= 5) return r;
    await new Promise((res) => setTimeout(res, (Number(r.headers.get("retry-after")) || 15 * (i + 1)) * 1000)); // Commons rate limit
  }
}

async function search(q: string) {
  const u = new URL("https://commons.wikimedia.org/w/api.php");
  Object.entries({ action: "query", format: "json", generator: "search", gsrnamespace: "6", gsrlimit: "20", gsrsearch: q, prop: "imageinfo", iiprop: "url|extmetadata|mime", iiurlwidth: "800" }).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await get(u);
  if (!r.ok) throw new Error(`search HTTP ${r.status}`);
  const pages = Object.values(((await r.json()) as any).query?.pages ?? {}) as any[];
  return pages.sort((a, b) => a.index - b.index);
}

async function pick(make: string, model: string, code: string, years: string) {
  const codes = code.split("/").map((c) => c.trim()).filter(Boolean);
  const queries = [...codes.map((c) => `${make} ${model} ${c}`), `${make} ${model} ${years.slice(0, 4)}`];
  for (const q of queries) {
    const ok = [];
    for (const p of await search(q)) {
      const ii = p.imageinfo?.[0];
      const lic: string = ii?.extmetadata?.LicenseShortName?.value ?? "";
      if (!ii?.thumburl || !/image\/(jpeg|png|webp)/.test(ii.mime) || !okLicense(lic) || BAD_TITLE.test(p.title)) continue;
      if (!p.title.toLowerCase().includes(model.toLowerCase().split(" ")[0])) continue;
      ok.push({ title: p.title as string, thumb: ii.thumburl as string, license: lic, credit: plain(ii.extmetadata?.Artist?.value ?? "") || "Wikimedia Commons", source: ii.descriptionurl as string });
    }
    // a title naming the generation ("(E210)") beats the search order
    const best = ok.find((x) => codes.some((c) => x.title.toLowerCase().split(/[^a-z0-9]+/).includes(c.toLowerCase()))) ?? ok[0];
    if (best) return best;
  }
  return null;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const rows = parseTsv(readFileSync(new URL("docs/3d/generations-master.tsv", ROOT), "utf8"));
  const manifest: Record<string, Photo> = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};
  const missing: string[] = [];
  for (const r of rows) {
    const key = genKey(r.make, r.model, r.code);
    if (manifest[key] && existsSync(new URL(`${key}.webp`, OUT))) continue;
    try {
      const hit = await pick(r.make, r.model, r.code, r.years);
      if (!hit) {
        missing.push(`${r.make} ${r.model} ${r.code}`);
        continue;
      }
      const img = await get(hit.thumb);
      if (!img.ok) throw new Error(`image HTTP ${img.status}`);
      await sharp(Buffer.from(await img.arrayBuffer())).resize(800, 800, { fit: "inside", withoutEnlargement: true }).webp({ quality: 78 }).toFile(fileURLToPath(new URL(`${key}.webp`, OUT)));
      manifest[key] = { url: `/api/cars/${key}.webp`, credit: hit.credit, license: hit.license, source: hit.source };
      writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
      console.log(`ok ${key}  ${hit.license}  ${hit.credit}`);
    } catch (e) {
      missing.push(`${r.make} ${r.model} ${r.code} (${(e as Error).message})`);
    }
    await new Promise((res) => setTimeout(res, 1000)); // be polite to the Commons API
  }
  console.log(`\nPhotos: ${Object.keys(manifest).length} of ${rows.length}. Without a photo (${missing.length}):\n  ${missing.join("\n  ")}`);
}

if (process.argv[1]?.endsWith("fetch-generation-photos.ts")) await main();
