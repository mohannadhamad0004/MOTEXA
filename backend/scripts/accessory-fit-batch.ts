// Fit one accessory part on several catalog cars with the REAL viewer (scripts/accessory-fit-check.mjs), using each car's runtime config
// (file config + admin zones + confirmed part map, exactly what the app gets). Screenshots + fit evidence per car into --out/<key>/.
//   npx tsx scripts/accessory-fit-batch.ts --part=<glb> --kit=<kit.json> --out=<dir> --cars=key1,key2 [--views=six]
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../src/prisma.js";
import { modelWithZones } from "../src/services/accessory3d.js";
import { REPO_ROOT } from "../src/services/vehicle3d-catalog.js";

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const out = path.resolve(arg("out")!), cars = arg("cars")!.split(",");
for (const key of cars) {
  const model = await modelWithZones(key); if (!model) { console.log(JSON.stringify({ key, error: "not an active model" })); continue; }
  const dir = path.join(out, key); mkdirSync(dir, { recursive: true }); writeFileSync(path.join(dir, "config.json"), JSON.stringify(model));
  try {
    const r = execFileSync(process.execPath, [path.join(REPO_ROOT, "backend/scripts/accessory-fit-check.mjs"), `--car=${path.join(REPO_ROOT, "backend/public/3d", key + ".glb")}`,
      `--config=${path.join(dir, "config.json")}`, `--part=${path.resolve(arg("part")!)}`, `--kit=${path.resolve(arg("kit")!)}`, `--out=${dir}`, `--views=${arg("views") ?? "six"}`],
      { encoding: "utf8", timeout: 240_000, windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
    console.log(JSON.stringify({ key, ...JSON.parse(r.trim().split("\n").pop()!) }));
  } catch (e) { console.log(JSON.stringify({ key, error: String((e as { stderr?: string }).stderr ?? e).slice(-400) })); }
}
await prisma.$disconnect();
