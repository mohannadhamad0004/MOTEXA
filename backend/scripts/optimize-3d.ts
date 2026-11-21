import {optimizeVehicleSource,vehicleLength} from "../src/services/vehicle3d-preparation.js";
// Optimises every downloaded model in 3d-source/<key>/model.glb (scripts/sketchfab-batch.ts) like docs/3d/optimize-corolla.mjs:
// strip the interior (and show-room floors / backdrops), webp textures <= 1024, meshopt; target <= 8 MB (else textures 512).
// Output: backend/public/3d/<key>.glb. Then it guesses what the app needs (paint material, separate wheels, which way is the
// front) and writes docs/3d/models.json, the generated block of mobile/src/features/car3d/models.ts and docs/3d/CREDITS.md.
// Guesses it is not sure of are marked "check" (in models.json and as a comment in models.ts).
//
//   npx tsx scripts/optimize-3d.ts [--force]      (already optimised keys are skipped unless --force)
//   then: npm run seed:generations                 (sets VehicleGeneration.model3dKey from docs/3d/models.json)
import { existsSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Logger, NodeIO, getBounds, type Document, type Node } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, meshopt, prune, simplify, textureCompress, weld } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";
import { writeCatalog, type ViewerConfig } from "../src/services/vehicle3d-catalog.js";
import type { BatchRecord } from "./sketchfab-batch.js";

const ROOT = new URL("../../", import.meta.url);
const SRC = new URL("3d-source/", ROOT);
const OUT = new URL("backend/public/3d/", ROOT);
const MANIFEST = new URL("docs/3d/models.json", ROOT);
const MAX = 8 * 1024 * 1024;
const FORCE = process.argv.includes("--force");
const ONLY_KEY = process.argv.find(a => a.startsWith("--key="))?.slice(6);
if (FORCE && !ONLY_KEY) throw new Error("--force requires --key=<model-key>");
/** only re-sort into app / review and rewrite models.ts, CREDITS.md and the file locations (no re-optimising) */
const WRITE_ONLY = process.argv.includes("--write-only");

// ponytail: one approximate length per model line (generations differ by a few %); per-generation lengths if it ever shows
export type ModelEntry = {
  finalStatus?: string; viewerConfig?: ViewerConfig;
  key: string; file: string; make: string; model: string; code: string;
  title: string; author: string; authorUrl?: string; url: string; license: string;
  bytesBefore: number; bytesAfter: number; textures: number;
  lengthM: number; rotateY: number; paintMaterials: string[]; rimsSwappable: boolean;
  removed: number; flags: string[]; check: string[]; manual?: boolean;
  /** false: kept out of the app (AI / scan / game-derived / low-poly need a human look, or still over 8 MB); file in 3d-source/<key>/optimized.glb */
  inApp?: boolean; review?: string[];
};

async function optimise(_io: NodeIO, rec: BatchRecord): Promise<ModelEntry> {
  const src=fileURLToPath(new URL(`${rec.key}/model.glb`,SRC)),out=fileURLToPath(new URL(`${rec.key}.glb`,OUT));
  const result=await optimizeVehicleSource(readFileSync(src),rec.key);writeFileSync(out,result.bytes);
  return {key:rec.key,file:rec.key,make:rec.make,model:rec.model,code:rec.code,title:rec.title??"",author:rec.author??"",authorUrl:rec.authorUrl,url:rec.url,license:rec.license??"",
    bytesBefore:result.report.bytesBefore,bytesAfter:result.report.bytesAfter,textures:result.report.textures,lengthM:vehicleLength(rec.make,rec.model),rotateY:result.rotateY,
    paintMaterials:result.paintCertain?result.paintMaterials:[],rimsSwappable:result.rimsSwappable,removed:result.report.removed,flags:rec.flags??[],check:result.report.warnings};
}

async function main() {
  if (!ONLY_KEY && !WRITE_ONLY) throw new Error("Optimization requires --key=<model-key>. Use --write-only to regenerate metadata.");
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  await MeshoptSimplifier.ready;
  const io = new NodeIO().setLogger(new Logger(Logger.Verbosity.ERROR)).registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });
  const log: Record<string, BatchRecord> = JSON.parse(readFileSync(new URL("_batch.json", SRC), "utf8"));
  const manifest: Record<string, ModelEntry> = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};
  const keys = readdirSync(SRC, { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(new URL(`${d.name}/model.glb`, SRC))).map((d) => d.name);
  const failed: string[] = [];
  for (const key of keys) {
    const rec = log[key];
    if (!rec || rec.state !== "downloaded" || (ONLY_KEY && key !== ONLY_KEY) || manifest[key]?.finalStatus === "REMOVED") continue;
    if (WRITE_ONLY || (manifest[key] && !FORCE)) continue;
    try {
      const e = await optimise(io, rec);
      const offset = { x: 0, y: 0, z: 0, scale: 1 };
      e.viewerConfig = manifest[key]?.viewerConfig ?? { key: e.file, generation: `${e.make} ${e.model} ${e.code}`,
        lengthM: e.lengthM, rotateY: e.rotateY, groundOffset: 0, paintNodes: [], paintMaterials: e.paintMaterials,
        rimsSwappable: e.rimsSwappable, wing: offset, rack: offset,
        credit: { title: e.title, author: e.author, url: e.url, license: e.license } };
      manifest[key] = e;
      console.log(`${key}: ${(e.bytesBefore / 1e6).toFixed(1)} -> ${(e.bytesAfter / 1e6).toFixed(2)} MB, removed ${e.removed}, paint ${e.paintMaterials.join("/") || "-"}${e.check.length ? ", check: " + e.check.join(", ") : ""}`);
    } catch (err) {
      failed.push(`${key}: ${(err as Error).message}`);
      console.log(`FAILED ${key}: ${(err as Error).message}`);
    }
    writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  }
  // app or review: flagged models and anything still over 8 MB stay out of the app (and out of backend/public/3d)
  for (const e of Object.values(manifest)) {
    if (e.manual || e.finalStatus === "REMOVED" || !ONLY_KEY || e.key !== ONLY_KEY) continue;
    e.paintMaterials = e.paintMaterials.filter((n) => !/^edge[_ ]?colou?r/i.test(n)); // SketchUp edge colours are not paint
    e.review = [...e.flags, ...(e.bytesAfter > MAX ? ["over 8 MB"] : [])];
    e.inApp = e.review.length === 0;
    const pub = new URL(`${e.key}.glb`, OUT);
    const kept = new URL(`${e.key}/optimized.glb`, SRC);
    if (!e.inApp && existsSync(pub)) renameSync(pub, kept);
    if (e.inApp && !existsSync(pub) && existsSync(kept)) renameSync(kept, pub);
  }
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  writeCatalog(manifest as any);
  if (failed.length) console.log(`\nFailed (${failed.length}):\n  ${failed.join("\n  ")}`);
}

if (process.argv[1]?.endsWith("optimize-3d.ts")) await main();
