// Segment + auto-label every active catalog car (the same service as publish / the Parts Admin list) and print the proposal table.
//   npx tsx scripts/part-maps.ts [--force]     (--force re-segments files that already have a current segmentation)
// Never confirms anything: the Parts Admin confirms each map in /dept/accessory-zones.
import { prisma } from "../src/prisma.js";
import { activeModels } from "../src/services/vehicle3d-catalog.js";
import { modelFileSha, saveSegmentation } from "../src/services/car-part-map.js";

type P = Record<string, { ids: string[]; confidence: number; by: string }>;
const rows: string[] = ["| Model | Pieces | Labels proposed (pieces · confidence · evidence) | Status |", "|---|---|---|---|"];
for (const m of activeModels()) {
  try {
    await saveSegmentation(m.key, null, process.argv.includes("--force"));
    const r = (await prisma.carPartMap.findUnique({ where: { model3dKey: m.key } }))!;
    const pieces = (r.pieces as { tris: number }[]), total = pieces.reduce((a, p) => a + p.tris, 0), blob = Math.max(...pieces.map(p => p.tris)) > 0.85 * total;
    const labels = Object.entries(r.proposal as P).map(([k, v]) => `${k} ${v.ids.length} · ${v.confidence} · ${v.by}`).join("<br>") || "—";
    rows.push(`| ${m.generation} | ${pieces.length} | ${labels} | ${r.confirmedAt && r.modelSha256 === modelFileSha(m.key) ? "confirmed" : blob ? "single piece: zones only" : "proposed"} |`);
  } catch (e) { rows.push(`| ${m.generation} | — | segmentation failed: ${(e as Error).message} | — |`); }
}
console.log(rows.join("\n"));
await prisma.$disconnect();
