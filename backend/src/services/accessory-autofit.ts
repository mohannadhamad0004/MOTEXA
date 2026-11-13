// Accessory auto-fit per (accessory x vehicle generation): computed ONCE by the real viewer (sceneHtml fitAccessory, headless via
// scripts/accessory-fit-check.mjs --views=fit), stored, replayed by the app as kit.fit. It stays current while the part file, the car file +
// its runtime config (zones, confirmed part map) and the viewer's fit version for its type's group (FIT_VERSIONS: rims / wings / bumpers /
// other) are unchanged; otherwise it is computed again. Bumping one group never touches the stored (approved, corrected) fits of another.
// The Parts Admin approves it or stores a correction (adj); customers' own Adjust goes on top.
import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../prisma.js";
import { modelFileSha, bumperSpace } from "./car-part-map.js";
import { REPO_ROOT } from "./vehicle3d-catalog.js";
import { PRIVATE_3D_DIR, privatePath } from "./vehicle3d-private-assets.js";
import { digest, fail } from "./vehicle3d-validation.js";
import { activeAncestry } from "./vehicle-taxonomy.js";
import { testProviderRuntime } from "./generation-runtime.js";

type Adj = { x: number; y: number; z: number; rx: number; ry: number; s: number };
/** The viewer's fit version for an accessory type (sceneHtml.ts FIT_VERSIONS + FIT_GROUPS are the single source; the server only compares). */
export function fitVersion(type: string): number {
  const src = readFileSync(path.join(REPO_ROOT, "mobile/src/features/car3d/sceneHtml.ts"), "utf8");
  const obj = (name: string) => JSON.parse(new RegExp(`var ${name} = (\\{[^}]*\\});`).exec(src)?.[1] ?? "{}") as Record<string, unknown>;
  const v = obj("FIT_VERSIONS")[String(obj("FIT_GROUPS")[type] ?? "other")];
  return typeof v === "number" ? v : 0;
}
const typeOf = (fit: unknown) => String((fit as { type?: unknown } | null)?.type ?? "");
const partRevision = (key: string | null) => digest(key && existsSync(privatePath(key)) ? readFileSync(privatePath(key)) : Buffer.alloc(0)).slice(0, 16);
/** The car as the app sees it: file + runtime config (zones, confirmed part map). */
async function carRevision(key: string, type: string): Promise<string | null> {
  const { modelWithZones } = await import("./accessory3d.js"); // lazy: accessory3d imports this module
  const sha = modelFileSha(key), m = await modelWithZones(key);
  return sha && m ? revisionOf(sha, m, type) : null;
}
/** The car as a fitter of this type sees it: file + runtime config. The RIMS zone (wheel inset) only counts for rims, so setting it
 *  never makes another type's stored (approved, corrected) fit on that car stale. */
export function revisionOf(sha: string, model: unknown, type: string): string {
  const m = model as { zones?: Record<string, unknown>; rimProposal?: unknown };
  const { rimProposal: _proposal, ...base } = m;
  const view = type === "RIMS" ? m : !base.zones?.RIMS ? base : { ...base, zones: Object.fromEntries(Object.entries(base.zones).filter(([k]) => k !== "RIMS")) };
  return createHash("sha256").update(sha + JSON.stringify(view)).digest("hex");
}
const num = (v: unknown, lim: number) => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= lim;
const triple = (a: unknown) => Array.isArray(a) && a.length === 3 && a.every(n => num(n, 50));
/** Exact shape of a viewer fit (it is replayed into the viewer, so nothing else gets through). */
export function validFit(f: unknown, version = fitVersion(typeOf(f))): boolean {
  const x = f as Record<string, unknown>;
  // a part that does not fit this car is stored too (computed once), with the viewer's reason
  if (x && typeof x === "object" && x.version === version && typeof x.type === "string" && typeof x.failed === "string") return x.failed.length <= 500 && JSON.stringify(f).length <= 20_000;
  return !!x && typeof x === "object" && x.version === version && typeof x.type === "string" && Array.isArray(x.orient) && x.orient.length === 3
    && Array.isArray(x.placements) && x.placements.length >= 1 && x.placements.length <= 4
    && x.placements.every((p: Record<string, unknown>) => triple(p.pos) && triple(p.sc) && triple(p.rot) && (p.side === 1 || p.side === -1)
      && (p.warp === undefined || (Array.isArray(p.warp) && p.warp.length === 2 && p.warp.every(e => Array.isArray(e) && e.length === 3 && e.every(n => num(n, 0.016)))))) // bumper corners (fitQA)
    && Array.isArray(x.shadows) && x.shadows.length <= 4 && x.shadows.every((s: Record<string, unknown>) => ["x", "y", "z", "w", "d"].every(k => num(s[k], 50)))
    && (x.shift === undefined || (Array.isArray(x.shift) && x.shift.length <= 40 && x.shift.every((e: unknown) => Array.isArray(e) && typeof e[0] === "string" && num(e[1], 0.05))))
    && (x.hideMore === undefined || (Array.isArray(x.hideMore) && x.hideMore.length <= 60 && x.hideMore.every(n => typeof n === "string" && n.length <= 200)))
    && (x.rimRuntime === undefined || validRimRuntime(x.rimRuntime))
    && JSON.stringify(f).length <= 20_000;
}
/** = sceneHtml validRimRuntime: which wheels take the rim, which stock tyre pieces stay / brake pieces hide, each wheel's move (<= 5 cm). */
function validRimRuntime(v: unknown): boolean {
  const r = v as Record<string, unknown>, names = (a: unknown, max: number) => Array.isArray(a) && a.length <= max && a.every(n => typeof n === "string" && n.length <= 40);
  return !!r && typeof r === "object" && names(r.active, 4) && names(r.kept, 400) && (r.hideBrakes === undefined || names(r.hideBrakes, 200))
    && Array.isArray(r.offsets) && r.offsets.length <= 4
    && r.offsets.every((o: Record<string, unknown>) => !!o && typeof o.wheel === "string" && o.wheel.length <= 40 && Array.isArray(o.delta) && o.delta.length === 3 && o.delta.every(n => num(n, 0.05)));
}
export function parseAdj(v: unknown): Adj | null {
  const a = v as Record<string, unknown>;
  if (!a || typeof a !== "object" || !num(a.x, 0.5) || !num(a.y, 0.5) || !num(a.z, 0.5) || !num(a.rx, 0.8) || !num(a.ry, 0.8) || !(typeof a.s === "number" && a.s >= 0.8 && a.s <= 1.25)) return null;
  return { x: a.x as number, y: a.y as number, z: a.z as number, rx: a.rx as number, ry: a.ry as number, s: a.s as number };
}

/** Run the real viewer's fit for this accessory file on this car (headless, no screenshots). */
export async function computeFit(type: string, size: Record<string, number | null>, privateModelPath: string, key: string, baseAdj: Adj | null = null) {
  const { modelWithZones } = await import("./accessory3d.js");
  const model = await modelWithZones(key); if (!model) return fail("NO_3D_CAR", "That generation has no published 3D car model.", 409);
  const dir = path.join(PRIVATE_3D_DIR, `tmp-fit-${randomUUID()}`); mkdirSync(dir, { recursive: true });
  try {
    writeFileSync(path.join(dir, "config.json"), JSON.stringify(model)); writeFileSync(path.join(dir, "kit.json"), JSON.stringify({ type, size, ...(baseAdj ? { baseAdj } : {}) })); // the approved correction is checked too
    const { stdout } = await promisify(execFile)(process.execPath, [fileURLToPath(new URL("../../scripts/accessory-fit-check.mjs", import.meta.url)),
      `--car=${path.join(REPO_ROOT, "backend/public/3d", key + ".glb")}`, `--config=${path.join(dir, "config.json")}`, `--part=${privatePath(privateModelPath)}`,
      `--kit=${path.join(dir, "kit.json")}`, `--out=${dir}`, "--views=fit"], { timeout: 120_000, windowsHide: true, maxBuffer: 1024 * 1024 });
    return JSON.parse(stdout.trim().split("\n").pop()!).autofit as unknown;
  } catch (e) { // the viewer refused the fit (a bumper that does not fit this car cleanly, a pickup, no mount surface...)
    const why = /Error: ([^\n\r]*)/.exec(String((e as { stderr?: string }).stderr ?? ""))?.[1];
    if (why && !/ENOENT|Timeout|browser/i.test(why)) return { version: fitVersion(type), type, failed: why.slice(0, 500) };
    throw e;
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

type Acc = { id: string; accessoryType: string; privateModelPath: string | null; widthMm: number | null; lengthMm: number | null; rimInches: number | null };
/** Store a computed fit. Already current = kept as is (computed once, the admin's correction stays). Else replaced: an approved correction
 *  that still passes the fit check (the viewer checked fit + correction: info.qa.correction) stays approved; one that fails is not dropped
 *  silently: it is taken off (customers never get it) and kept in fit.previousCorrection with its numbers, and audited. */
export async function saveFit(a: Acc, generationId: string, key: string, fit: unknown) {
  const version = fitVersion(a.accessoryType); if (!validFit(fit, version)) return fail("INVALID_FIT", "The viewer returned an invalid fit.", 500);
  const carRev = await carRevision(key, a.accessoryType); if (!carRev) return fail("NO_3D_CAR", "That generation has no published 3D car model.", 409);
  const data = { model3dKey: key, carRevision: carRev, partRevision: partRevision(a.privateModelPath), fitVersion: version, fit: fit as Prisma.InputJsonValue };
  const old = await prisma.accessoryAutoFit.findUnique({ where: { accessoryId_generationId: { accessoryId: a.id, generationId } } });
  if (old && old.carRevision === data.carRevision && old.partRevision === data.partRevision && old.fitVersion === version) return old;
  const f = fit as { failed?: string; info?: { qa?: { correction?: { ok: boolean; clipMm: number; gapMm: number } } } };
  // An approval only carries over when the car and the part are byte-for-byte the same (only the fitter version changed) and the
  // recomputed fit still passes. A new car model/config or part file always goes back to the Parts Admin for approval.
  const sameGeometry = !!old && old.carRevision === data.carRevision && old.partRevision === data.partRevision;
  const check = old?.approvedAt && old.adj ? (f.failed ? { ok: false, reason: f.failed } : !sameGeometry ? { ok: false, reason: "car or part changed" } : f.info?.qa?.correction ?? null) : null;
  if (old?.approvedAt && old.adj && check?.ok) // still passes on the recomputed fit: stays approved as it was
    return prisma.accessoryAutoFit.update({ where: { accessoryId_generationId: { accessoryId: a.id, generationId } }, data });
  if (old?.approvedAt && !old.adj && sameGeometry && !f.failed && (fit as { info?: { qa?: { ok?: boolean } } }).info?.qa?.ok === true)
    return prisma.accessoryAutoFit.update({ where: { accessoryId_generationId: { accessoryId: a.id, generationId } }, data });
  if (old?.approvedAt && old.adj) {
    const previousCorrection = { adj: old.adj, approvedAt: old.approvedAt.toISOString(), approvedByUserId: old.approvedByUserId, result: "fails", ...(check ?? { reason: "not checked" }) };
    data.fit = { ...(fit as object), previousCorrection } as Prisma.InputJsonValue;
    await prisma.auditLog.create({ data: { actorId: old.approvedByUserId ?? null, action: "ACCESSORY3D_FIT_CORRECTION_FAILED", targetId: a.id, details: { generationId, ...previousCorrection } as Prisma.InputJsonValue } });
  }
  return prisma.accessoryAutoFit.upsert({ where: { accessoryId_generationId: { accessoryId: a.id, generationId } }, create: { accessoryId: a.id, generationId, ...data },
    update: { ...data, adj: Prisma.DbNull, approvedAt: null, approvedByUserId: null } });
}
/** Is this stored fit still the one the app would compute? */
export async function currentFit(r: { carRevision: string; partRevision: string; fitVersion: number; model3dKey: string; fit: unknown }, privateModelPath: string | null) {
  return r.fitVersion === fitVersion(typeOf(r.fit)) && r.partRevision === partRevision(privateModelPath) && r.carRevision === await carRevision(r.model3dKey, typeOf(r.fit));
}
const current=currentFit;
/** All supported targets, including Universal-by-size rims. Private previews and publication use exactly this same resolution. */
export async function accessoryTargets(accessoryId:string,tx:Prisma.TransactionClient|typeof prisma=prisma){
  const a=await tx.productAccessory3D.findUnique({where:{id:accessoryId},include:{product:{select:{isUniversal:true}},fits:true}});
  if(!a)return [];
  return tx.vehicleGeneration.findMany({where:{...activeAncestry,...(a.accessoryType==="RIMS"&&a.product.isUniversal?{isPublished:true,model3dKey:{not:null}}:{id:{in:a.fits.map(f=>f.generationId)}})},include:{vehicle:true}});
}
export async function fitEligibility(accessoryId:string,generationId:string,privateModelPath:string|null,tx:Prisma.TransactionClient|typeof prisma=prisma){
  const no=(code:string)=>({allowed:false,code,autoFit:null as {fit:unknown;adj:unknown}|null});
  const g=await tx.vehicleGeneration.findFirst({where:{id:generationId,...activeAncestry,isPublished:true}});
  if(!g?.model3dKey||!modelFileSha(g.model3dKey))return no("NO_VEHICLE_3D");
  const a=await tx.productAccessory3D.findUnique({where:{id:accessoryId},select:{accessoryType:true}});
  if(!a)return no("NO_ACCESSORY_3D");
  if(a.accessoryType==="FRONT_BUMPER"||a.accessoryType==="REAR_BUMPER"){
    const map=await tx.carPartMap.findUnique({where:{model3dKey:g.model3dKey}});
    const space=bumperSpace(map,g.model3dKey,a.accessoryType);if(space!=="PART_MAP"&&space!=="CUT")return no("PART_MAP_STALE"); // cut mode = usable on this car only
  }
  const r=await tx.accessoryAutoFit.findUnique({where:{accessoryId_generationId:{accessoryId,generationId}}});
  if(!r||r.model3dKey!==g.model3dKey||typeOf(r.fit)!==a.accessoryType||!validFit(r.fit)||!await currentFit(r,privateModelPath))return no("FIT_NOT_READY");
  const f=r.fit as {failed?:string;previousCorrection?:unknown};
  if(f.failed)return no("FIT_FAILED");
  if(!r.approvedAt)return no("FIT_REVIEW_REQUIRED");
  return {allowed:true,code:null,autoFit:{fit:r.fit,adj:r.adj}};
}

/** The generations an accessory is fitted on: its chosen ones, or for a "Universal by size" rim every published generation with a 3D car. */
type Gen = { model3dKey: string | null; isPublished: boolean; nameEn: string; vehicle?: { make: string } };
async function fittedOn<G extends Gen>(a: { accessoryType: string; product: { isUniversal: boolean }; fits: { generationId: string; generation: G }[] }, key?: string): Promise<{ generationId: string; generation: G }[]> {
  if (a.accessoryType !== "RIMS" || !a.product.isUniversal) return a.fits.filter(f => !key || f.generation.model3dKey === key);
  const gens = await prisma.vehicleGeneration.findMany({ where: { model3dKey: key ?? { not: null }, isPublished: true }, include: { vehicle: true } });
  return gens.map(g => ({ generationId: g.id, generation: g as unknown as G })); // findMany includes vehicle: a superset of every G used here
}

const running = new Map<string, Promise<unknown>>();
export const isAccessoryFitRunning = (accessoryId: string) => running.has(accessoryId);
/** Reads only schedule work when a published fit really is stale; current approvals stay editable. */
export async function refreshPublishedAccessory(accessoryId: string) {
  if (running.has(accessoryId)) return;
  const a = await prisma.productAccessory3D.findUnique({ where: { id: accessoryId }, include: { product: { select: { isUniversal: true } }, fits: { include: { generation: true } }, autoFits: true } });
  if (!a || a.status !== "PUBLISHED" || a.generationMode === "mock" || a.provider === "MOCK") return;
  for (const target of await fittedOn(a)) {
    if (!target.generation.isPublished || !target.generation.model3dKey) continue;
    const fit = a.autoFits.find(f => f.generationId === target.generationId);
    if (!fit || !await currentFit(fit, a.privateModelPath)) { void autoFitAccessory(accessoryId); return; }
  }
}
/** After a car's model was replaced or restored: schedule recomputation of every published accessory whose stored fit is now stale. New fits wait unapproved in "Accessory fits". */
export async function refitPublishedAccessories() {
  const rows = await prisma.productAccessory3D.findMany({ where: { status: "PUBLISHED" }, select: { id: true } });
  for (const a of rows) void refreshPublishedAccessory(a.id).catch(() => undefined);
}
/** Background: fit this accessory on every generation it fits that has a published 3D car (missing or stale fits only). */
export function autoFitAccessory(accessoryId: string) {
  if (!running.has(accessoryId)) running.set(accessoryId, (async () => {
    const a = await prisma.productAccessory3D.findUnique({ where: { id: accessoryId }, include: { product: { select: { isUniversal: true } }, fits: { include: { generation: true } }, autoFits: true } });
    if (!a?.privateModelPath || (!testProviderRuntime() && (a.generationMode === "mock" || a.provider === "MOCK"))) return;
    for (const f of await fittedOn(a)) {
      const key = f.generation.model3dKey; if (!key || !f.generation.isPublished) continue;
      const row = a.autoFits.find(r => r.generationId === f.generationId);
      if (row && await current(row, a.privateModelPath)) continue;
      const corr = row?.approvedAt && row.adj ? parseAdj(row.adj) : null; // an approved correction is re-checked on the new fit
      try {
        const partBefore = partRevision(a.privateModelPath), carBefore = await carRevision(key, a.accessoryType);
        const computed = await computeFit(a.accessoryType, { widthMm: a.widthMm, lengthMm: a.lengthMm, rimInches: a.rimInches }, a.privateModelPath, key, corr);
        if (partBefore !== partRevision(a.privateModelPath) || carBefore !== await carRevision(key, a.accessoryType)) continue;
        await saveFit(a, f.generationId, key, computed);
        await prisma.auditLog.create({ data: { action: "ACCESSORY3D_FIT_REFRESHED", targetId: a.id, details: { generationId: f.generationId, previousVersion: row?.fitVersion ?? null, fitVersion: fitVersion(a.accessoryType) } } });
      }
      catch { console.error(`Accessory auto-fit failed for ${accessoryId} on ${key}.`); }
    }
  })().catch(() => console.error(`Accessory auto-fit refresh failed for ${accessoryId}.`)).finally(() => running.delete(accessoryId)));
  return running.get(accessoryId)!;
}

export function createAutoFitService(options:{compute?:typeof computeFit}={}) {
  return {
    /** Published and private review candidates on this car, with stored fits. Explicit rerun owns fit computation. */
    list: async (key: string) => {
      const rows = await prisma.productAccessory3D.findMany({ where: { ...(!testProviderRuntime()?{NOT:[{generationMode:"mock"},{provider:"MOCK"}]}:{}), status: { in: ["PUBLISHED", "READY_FOR_FINAL_REVIEW"] }, OR: [{ fits: { some: { generation: { model3dKey: key, isPublished: true } } } }, { accessoryType: "RIMS", product: { isUniversal: true } }] },
        include: { product: { select: { name: true, isUniversal: true } }, fits: { where: { generation: { model3dKey: key } }, include: { generation: { include: { vehicle: true } } } }, autoFits: true } });
      const out = [];
      for (const a of rows) for (const f of await fittedOn(a, key)) {
        const r = a.autoFits.find(x => x.generationId === f.generationId), ok = !!r && await current(r, a.privateModelPath);
        if (!ok && a.status === "PUBLISHED") void autoFitAccessory(a.id);
        out.push({ accessoryId: a.id, productId: a.productId, productName: a.product?.name ?? "", kitPart: a.kitPart, type: a.accessoryType, status: a.status,
          hasModel: !!a.privateModelPath && existsSync(privatePath(a.privateModelPath)), modelRevision: partRevision(a.privateModelPath),
          // the public file only while it is actually served (isPublic3DAsset: verified + active); otherwise the admin screen loads the
          // private model, instead of a 404 that showed "Couldn't load the 3D view" over the loaded car (unpublished rims)
          file: a.status === "PUBLISHED" && a.publishedFile && a.visualVerifiedAt && !a.deactivatedAt ? `accessories/${a.publishedFile}.glb` : null, size: { widthMm: a.widthMm, lengthMm: a.lengthMm, rimInches: a.rimInches },
          generation: { id: f.generationId, name: `${f.generation.vehicle.make} ${f.generation.nameEn}` }, finish: a.rimFinish,
          fit: ok && r ? { fit: r.fit, adj: r.adj, approvedAt: r.approvedAt } : null, computing: running.has(a.id) });
      }
      return out;
    },
    /** The Parts Admin approves the fit, with an optional correction (adj null = the pure auto-fit, "Reset to auto-fit"). */
    approve: async (uid: string, accessoryId: string, generationId: string, body: { adj?: unknown; needsCorrection?: unknown }) => {
      if(running.has(accessoryId))return fail("FIT_NOT_READY","Wait for the running fit to finish before reviewing it.",409);
      const r = await prisma.accessoryAutoFit.findUnique({ where: { accessoryId_generationId: { accessoryId, generationId } }, include: { accessory: { select: { privateModelPath: true } } } });
      if (!r || !await current(r, r.accessory.privateModelPath)) return fail("FIT_NOT_READY", "The fit is being computed. Try again in a moment.", 409);
      if((r.fit as {failed?:string}).failed)return fail("FIT_FAILED","A failed fit cannot be approved. Rerun the fit after correcting its source.",409);
      if(body.needsCorrection!==undefined&&body.needsCorrection!==true)return fail("INVALID_ADJUST","Needs correction must be true when supplied.");
      const eligibility=await fitEligibility(accessoryId,generationId,r.accessory.privateModelPath);
      if(eligibility.code==="PART_MAP_STALE"||eligibility.code==="NO_VEHICLE_3D")return fail(eligibility.code,"Confirm the current vehicle stock-part map before reviewing this fit.",409);
      const adj = body.adj === null || body.adj === undefined ? null : parseAdj(body.adj);
      if (body.adj && !adj) return fail("INVALID_ADJUST", "Adjustments are limited to ±0.5 m, ±45° and 80-125 % scale.");
      if(adj){const a=await prisma.productAccessory3D.findUniqueOrThrow({where:{id:accessoryId}});if(!a.privateModelPath)return fail("FIT_NOT_READY","No current accessory model.",409);
        const checked=await(options.compute??computeFit)(a.accessoryType,{widthMm:a.widthMm,lengthMm:a.lengthMm,rimInches:a.rimInches},a.privateModelPath,r.model3dKey,adj);
        if((checked as {failed?:string})?.failed||!(checked as {info?:{qa?:{correction?:{ok?:boolean}}}})?.info?.qa?.correction?.ok)return fail("FIT_FAILED","This correction failed the viewer clearance check.",409);
      }
      const u = await prisma.$transaction(async tx=>{
        await tx.$queryRaw`SELECT "id" FROM "ProductAccessory3D" WHERE "id"=${accessoryId} FOR UPDATE`;
        const accessory=await tx.productAccessory3D.findUnique({where:{id:accessoryId},select:{privateModelPath:true}});
        const now=await tx.accessoryAutoFit.findUnique({where:{accessoryId_generationId:{accessoryId,generationId}}});
        if(!now||!accessory||now.updatedAt.getTime()!==r.updatedAt.getTime()||!await current(now,accessory.privateModelPath))return fail("FIT_NOT_READY","The model or fit changed during review. Reload.",409);
        await tx.auditLog.create({ data: { actorId: uid, action: body.needsCorrection ? "ACCESSORY3D_FIT_NEEDS_CORRECTION" : "ACCESSORY3D_FIT_APPROVED", targetId: accessoryId, details: { generationId, adj } } });
        const {needsCorrection:_old,...fit}=now.fit as Record<string,Prisma.JsonValue>;
        return tx.accessoryAutoFit.update({ where: { accessoryId_generationId: { accessoryId, generationId } }, data: body.needsCorrection ? {fit:{...fit,needsCorrection:true},approvedAt:null,approvedByUserId:null} : { fit, adj: adj ?? Prisma.DbNull, approvedAt: new Date(), approvedByUserId: uid } });
      });
      return { fit: u.fit, adj: u.adj, approvedAt: u.approvedAt };
    },
    /** For a customer's generation: the current stored fit + the admin's correction, or null (the app fits live). */
    forCustomer: async (accessoryId: string, generationId: string, privateModelPath: string | null) => {
      return (await fitEligibility(accessoryId,generationId,privateModelPath)).autoFit;
    },
    rerun:async(uid:string,accessoryId:string)=>{
      if(running.has(accessoryId)){await running.get(accessoryId);return {success:true};}
      const job=(async()=>{
      const a=await prisma.productAccessory3D.findUnique({where:{id:accessoryId},include:{autoFits:true}});
      if(!a?.privateModelPath||!["PUBLISHED","READY_FOR_FINAL_REVIEW"].includes(a.status))return fail("FIT_NOT_READY","A generated model is required.",409);
      for(const g of await accessoryTargets(accessoryId)){if(!g.isPublished||!g.model3dKey)continue;
        const previous=a.autoFits.find(f=>f.generationId===g.id), correction=previous?.approvedAt&&previous.adj?parseAdj(previous.adj):null;
        const fit=await(options.compute??computeFit)(a.accessoryType,{widthMm:a.widthMm,lengthMm:a.lengthMm,rimInches:a.rimInches},a.privateModelPath,g.model3dKey,correction);
        // Explicit rerun makes the previous review stale; it never carries a correction to unverified geometry.
        await prisma.accessoryAutoFit.updateMany({where:{accessoryId,generationId:g.id},data:{fitVersion:-1}});await saveFit(a,g.id,g.model3dKey,fit);
        await prisma.accessoryAutoFit.updateMany({where:{accessoryId,generationId:g.id},data:{approvedAt:null,approvedByUserId:null}}); // the admin reviews every explicit rerun again (a kept correction stays as the suggestion)
      }
      await prisma.auditLog.create({data:{actorId:uid,action:"ACCESSORY3D_REFIT",targetId:accessoryId}});
      })();running.set(accessoryId,job);
      try{await job;return {success:true};}finally{running.delete(accessoryId);}
    },
  };
}
