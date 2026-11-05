// Seeds VehicleGeneration from docs/3d/generations-master.tsv, matched to the vehicle list (Mercedes-Benz -> Mercedes, SEAT -> Seat).
// Photo and 3D fields come from the manifests the scripts write: backend/public/cars/photos.json (fetch-generation-photos.ts)
// and docs/3d/models.json (optimize-3d.ts). Idempotent: upsert by (vehicle, code); rows are never deleted.
// Run: npm run seed:generations   (prints the rows that matched no vehicle or had unusual years)
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { prisma } from "../prisma.js";
import { genKey, listMake, parseTsv, parseYears } from "../generations.js";
import { normVehicle } from "../vehicleCatalog.js";
import { seedVehicles } from "./vehicles.js";

const ROOT = new URL("../../../", import.meta.url);
const json = <T>(rel: string): Record<string, T> => (existsSync(new URL(rel, ROOT)) ? JSON.parse(readFileSync(new URL(rel, ROOT), "utf8")) : {});
export type PhotoEntry = { url: string; credit: string; license: string; source: string };
export type ModelEntry = { file: string; url: string; license: string; inApp?: boolean };

export async function seedGenerations() {
  await seedVehicles();
  const rows = parseTsv(readFileSync(new URL("docs/3d/generations-master.tsv", ROOT), "utf8"));
  const existing=await prisma.vehicleGeneration.count();if(existing)return {n:existing,total:rows.length,noVehicle:[],badYears:[],guessedYears:[]}; // Never overwrite Parts Admin management.
  const photos = json<PhotoEntry>("backend/public/cars/photos.json");
  const models = json<ModelEntry>("docs/3d/models.json");
  const vehicles = await prisma.vehicle.findMany();
  const byName = new Map(vehicles.map((v) => [`${v.makeNormalized}|${v.modelNormalized}`, v]));
  const noVehicle: string[] = [];
  const badYears: string[] = [];
  const guessedYears: string[] = [];
  let n = 0;
  for (const r of rows) {
    const label = `${r.make} ${r.model} ${r.code} (${r.years})`;
    const v = byName.get(`${normVehicle(listMake(r.make))}|${normVehicle(r.model)}`);
    if (!v) {
      noVehicle.push(label);
      continue;
    }
    const y = parseYears(r.years);
    if (!y) {
      badYears.push(label);
      continue;
    }
    if (!y.exact) guessedYears.push(`${label} -> ${y.from}-${y.to}`);
    const key = genKey(r.make, r.model, r.code);
    const p = photos[key];
    const m = models[key]?.inApp === false ? undefined : models[key]; // review models are not shown in the app
    const data = {
      isPublished:!!m,catalogNormalizedCode:r.code.toLowerCase().replace(/[^a-z0-9]/g,""),
      nameEn: `${v.model} ${r.code}`,
      nameAr: `${v.modelAr} ${r.code}`,
      yearFrom: y.from,
      yearTo: y.to,
      bodyType: v.bodyType,
      photoUrl: p ? p.url : null,
      photoCredit: p?.credit ?? null,
      photoLicense: p?.license ?? null,
      photoSourceUrl: p?.source ?? null,
      model3dKey: m ? m.file : null,
      modelSourceUrl: m?.url ?? null,
      modelLicense: m?.license ?? null,
    };
    await prisma.vehicleGeneration.upsert({ where: { vehicleId_code: { vehicleId: v.id, code: r.code } }, update: data, create: { vehicleId: v.id, code: r.code, ...data } });
    n++;
  }
  return { n, total: rows.length, noVehicle, badYears, guessedYears };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  seedGenerations()
    .then((r) => {
      console.log(`Generations: ${r.n} of ${r.total} rows upserted.`);
      if (r.noVehicle.length) console.log(`No matching vehicle (${r.noVehicle.length}):\n  ${r.noVehicle.join("\n  ")}`);
      if (r.badYears.length) console.log(`Unparseable years (${r.badYears.length}):\n  ${r.badYears.join("\n  ")}`);
      if (r.guessedYears.length) console.log(`Years read with a best guess (${r.guessedYears.length}):\n  ${r.guessedYears.join("\n  ")}`);
    })
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
