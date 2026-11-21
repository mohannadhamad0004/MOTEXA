import { mkdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import path from "node:path";
import {stageCatalogPromotion,recoverCatalogJournal} from "./vehicle3d-promotion.js";
import { autoSegment } from "./car-part-map.js";
export {recoverCatalogJournal} from "./vehicle3d-promotion.js";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { Prisma, type Vehicle3DSubmission } from "../generated/prisma/client.js";
import { prisma } from "../prisma.js";
import {requirePartsActor} from "./vehicle-taxonomy.js";
import { genKey } from "../generations.js";
import { REPO_ROOT, atomicWrite, catalogFiles, readManifest, safeKey, type ModelMetadata, type ViewerConfig } from "./vehicle3d-catalog.js";
import { fail, digest, normalizeVehicle, verifyViewer } from "./vehicle3d-validation.js";
import { generationMode, paidGenerationEnabled, testProviderRuntime } from "./generation-runtime.js";

import {PRIVATE_3D_DIR,VIEWS,privatePath,storePrivate,removePrivate,type PhotoView} from "./vehicle3d-private-assets.js";
export {PRIVATE_3D_DIR,VIEWS,privatePath,storePrivate} from "./vehicle3d-private-assets.js";
type Tx=Prisma.TransactionClient;
export type Runner=<T>(fn:(tx:Tx)=>Promise<T>)=>Promise<T>;
const missing=():never=>fail("SUBMISSION_NOT_FOUND","Submission not found.",404);
export function submissionShape(s: Vehicle3DSubmission) {
  const blocked = !testProviderRuntime() && (s.generationMode === "mock" || s.provider === "MOCK");
  return { id: s.id, garageCarId: s.garageCarId, make: s.make, model: s.model, generationId: s.generationId,
    generationName: s.generationName, year: s.year, status: blocked ? "FAILED" : s.status, reviewNotes: s.reviewNotes,
    submittedAt: s.submittedAt, reviewedAt: s.reviewedAt, createdAt: s.createdAt, updatedAt: s.updatedAt,
    approvedModel3dKey: s.approvedModel3dKey, hasModel: !blocked && !!s.privateModelPath, generationMode: s.generationMode,
    failureReason: blocked ? "An old test result is unavailable. A real generation is required." : s.failureReason, validation: blocked ? null : s.validation, lengthM: s.lengthM,
    photos: Object.fromEntries(VIEWS.map(v => [v, !!s[`${v}PhotoPath`]])),
    initialApprovedAt:s.initialApprovedAt,provider:s.provider, providerState:s.providerState, providerProgress:s.providerProgress, generationStage:s.generationStage,
    generationRevision:s.generationRevision,generationErrorCode:s.generationErrorCode,catalogConsentAt:s.catalogConsentAt,
    preparationConfig:s.preparationConfig,hasRawModel:!!s.rawModelPath,
    photoRevision:digest(Buffer.from(VIEWS.map(v=>s[`${v}PhotoPath`]??"").join("|"))).slice(0,16),
    modelRevision:digest(Buffer.from(s.privateModelPath??"")).slice(0,16) };
}
export function privateViewerConfig(s: Pick<Vehicle3DSubmission, "id" | "make" | "model" | "generationName" | "lengthM">): ViewerConfig {
  const offset = { x: 0, y: 0, z: 0, scale: 1 };
  return { key: `private-${s.id}`, generation: `${s.make} ${s.model} ${s.generationName}`, lengthM: s.lengthM,
    rotateY: 0, groundOffset: 0, paintNodes: [], paintMaterials: [], rimsSwappable: false, wing: offset, rack: offset,
    credit: { title: "Private customer submission", author: "Customer", url: "", license: "Private; unpublished" } };
}
export function createSubmissionService(run: Runner = work => prisma.$transaction(work, { timeout: 90_000 })) {
  const owned = async (tx: Tx, uid: string, id: string, lock = false) => {
    if (lock) await tx.$queryRaw`SELECT "id" FROM "Vehicle3DSubmission" WHERE "id"=${id} AND "userId"=${uid} FOR UPDATE`;
    return await tx.vehicle3DSubmission.findFirst({ where: { id, userId: uid, deletedAt: null } }) ?? missing();
  };
  const reviewed = async (tx: Tx, id: string, lock = false) => {
    if (lock) await tx.$queryRaw`SELECT "id" FROM "Vehicle3DSubmission" WHERE "id"=${id} FOR UPDATE`;
    return await tx.vehicle3DSubmission.findFirst({ where: { id, deletedAt: null, status: { not: "DRAFT" } } }) ?? missing();
  };
  const audit = (tx: Tx, uid: string, action: string, id: string, details?: Prisma.InputJsonValue) => tx.auditLog.create({ data: { actorId: uid, action: `VEHICLE3D_${action}`, targetId: id, ...(details ? { details } : {}) } });
  const editable = (s: Vehicle3DSubmission) => { if (!["DRAFT", "FAILED"].includes(s.status)) fail("SUBMISSION_LOCKED", "Photos can only change before generation or after a failed attempt.", 409); };
  return {
    list: (uid: string) => run(async tx => (await tx.vehicle3DSubmission.findMany({ where: { userId: uid, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 100 })).map(submissionShape)),
    get: (uid: string, id: string) => run(async tx => submissionShape(await owned(tx, uid, id))),
    create: (uid: string, carId: string) => run(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${uid} FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "CustomerGarageCar" WHERE "id"=${carId} AND "userId"=${uid} FOR UPDATE`;
      const car = await tx.customerGarageCar.findFirst({ where: { id: carId, userId: uid }, include: { generation: true } });
      if (!car) return missing();
      const open = await tx.vehicle3DSubmission.findFirst({ where: { garageCarId: carId, deletedAt: null, status: { in: ["DRAFT", "PROCESSING", "READY", "SUBMITTED"] } } });
      if (open) return submissionShape(open);
      const recent = await tx.auditLog.count({ where: { actorId: uid, action: "VEHICLE3D_CREATE", createdAt: { gte: new Date(Date.now() - 86400_000) } } });
      if (recent >= 10) return fail("SUBMISSION_LIMIT", "Maximum 10 submissions per day.", 429);
      const entry = car.generation ? readManifest()[genKey(car.make, car.model, car.generation.code)] : null;
      const configuredLength = Number(entry?.viewerConfig?.lengthM ?? entry?.lengthM ?? 4.5);
      const lengthM = Number.isFinite(configuredLength) && configuredLength >= 2.5 && configuredLength <= 8 ? configuredLength : 4.5;
      const s = await tx.vehicle3DSubmission.create({ data: { userId: uid, garageCarId: car.id, make: car.make, model: car.model,
        year: car.year, generationId: car.generationId, generationName: car.generation?.nameEn ?? "", lengthM, status: "DRAFT" } });
      await audit(tx, uid, "CREATE", s.id); return submissionShape(s);
    }),
    photo: async (uid: string, id: string, view: string, base64: unknown) => {
      if (!(VIEWS as readonly string[]).includes(view) || typeof base64 !== "string" || !base64.length || base64.length > 7_000_000) return fail("INVALID_PHOTO", "Choose a JPEG or PNG image of at most 5 MB.");
      await run(tx => owned(tx, uid, id));
      const bytes = Buffer.from(base64, "base64");
      if (bytes.length > 5 * 1024 * 1024 || !bytes.length) return fail("INVALID_PHOTO", "Photo is too large.");
      let jpeg: Buffer;
      try {
        const image = sharp(bytes, { limitInputPixels: 25_000_000 }); const meta = await image.metadata();
        if (!["jpeg", "png"].includes(meta.format ?? "") || !meta.width || !meta.height || meta.width < 32 || meta.height < 32) throw new Error();
        // Re-encoding strips EXIF/GPS, normalizes orientation, and bounds the private upload size.
        jpeg = await image.rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
      } catch { return fail("INVALID_PHOTO", "Photo is not a supported, decodable JPEG or PNG."); }
      let key: string | null = null, previous: string | null = null;
      try {
        const result = await run(async tx => {
          const s = await owned(tx, uid, id, true); editable(s);
          const request=await tx.vehicleCatalogRequest.findUnique({where:{submissionId:id}});if(request&&request.reviewState!=="DRAFT")return fail("REQUEST_LOCKED","Photos are frozen during review. Start a revision first.",409);
          key = storePrivate(jpeg, "jpg"); previous = s[`${view as PhotoView}PhotoPath`];
          const updated = await tx.vehicle3DSubmission.update({ where: { id }, data: { [`${view}PhotoPath`]: key, status: "DRAFT", failureReason: null } });
          await audit(tx, uid, `PHOTO_${view.toUpperCase()}`, id); return submissionShape(updated);
        });
        removePrivate(previous); return result;
      } catch (error) { removePrivate(key); throw error; }
    },
    generate: (uid: string, id: string, consent: unknown,actorId:string) => run(async tx => {
      await requirePartsActor(tx,actorId);
      const s = await owned(tx, uid, id, true);
      if(!s.initialApprovedAt||!s.initialApprovedByUserId)return fail("INITIAL_REVIEW_REQUIRED","Parts Admin must approve this request before generation.",409);
      if(s.status==="PROCESSING")return submissionShape(s);
      if(s.generationId){
        await tx.$queryRaw`SELECT "id" FROM "VehicleGeneration" WHERE "id"=${s.generationId} FOR UPDATE`;
        const g=await tx.vehicleGeneration.findUniqueOrThrow({where:{id:s.generationId}}),request=await tx.vehicleCatalogRequest.findUnique({where:{submissionId:id}});
        if(g.isPublished&&g.model3dKey&&request){const approval=await tx.auditLog.findFirst({where:{action:"VEHICLE_REQUEST_INITIAL_APPROVE",targetId:request.id},orderBy:{createdAt:"desc"}});if((approval?.details as {existingModelKey?:string}|null)?.existingModelKey!==g.model3dKey)return fail("DUPLICATE_REQUEST","This generation now has a published model. Review that model before approving a replacement.",409);}
        if(await tx.vehicle3DSubmission.findFirst({where:{id:{not:id},generationId:s.generationId,deletedAt:null,status:{in:["PROCESSING","READY","SUBMITTED"]},initialApprovedAt:{not:null}},select:{id:true}}))return fail("DUPLICATE_REQUEST","Another reviewed request already has a running or reviewable model for this generation. Review that candidate first.",409);
      }
      editable(s);
      if (consent !== true) return fail("CONSENT_REQUIRED", "Confirm ownership and processing consent.");
      if (VIEWS.some(v => !s[`${v}PhotoPath`])) return fail("PHOTOS_REQUIRED", "Upload all four guided photos first.");
      const resumable=["PROVIDER_AUTH","PROVIDER_KEY_MISSING","PROVIDER_FORBIDDEN","PROVIDER_UNAVAILABLE","PROVIDER_TIMEOUT","PROVIDER_MALFORMED_RESPONSE","PROVIDER_JOB_TIMEOUT","PREPARATION_FAILED","VIEWER_VALIDATION_FAILED"];
      if(s.status==="FAILED"&&(s.rawModelPath||s.providerTaskId)&&resumable.includes(s.generationErrorCode??"")){
        const resumed=await tx.vehicle3DSubmission.update({where:{id},data:{status:"PROCESSING",generationStage:s.rawModelPath?"PREPARING":"GENERATING",generationErrorCode:null,failureReason:null,leaseToken:null,leaseUntil:null,nextPollAt:null,processingStartedAt:new Date()}});
        await audit(tx,uid,"GENERATION_RESUME",id);return submissionShape(resumed);
      }
      const mode=generationMode();
      if(mode==="meshy" && !process.env.MESHY_API_KEY)return fail("PROVIDER_KEY_MISSING","Real generation requires a backend Meshy key.",503);
      if(mode==="meshy" && !paidGenerationEnabled())return fail("LIVE_OPT_IN_REQUIRED","Paid generation is disabled on this server.",409);
      const history=Array.isArray(s.generationHistory)?s.generationHistory:[];
      if(s.generationRevision)history.push({revision:s.generationRevision,provider:s.provider,taskId:s.providerTaskId,state:s.providerState,raw:s.rawModelPath,prepared:s.privateModelPath,finishedAt:s.providerFinishedAt?.toISOString()??null});
      const updated=await tx.vehicle3DSubmission.update({where:{id},data:{status:"PROCESSING",generationMode:mode,provider:mode==="mock"?"MOCK":"MESHY",
        providerTaskId:null,providerState:null,providerProgress:null,providerCreatedAt:null,providerStartedAt:null,providerFinishedAt:null,lastProviderCheckAt:null,nextPollAt:null,
        generationStage:"QUEUED",generationRevision:{increment:1},generationErrorCode:null,generationHistory:history as Prisma.InputJsonValue,
        leaseToken:null,leaseUntil:null,liveAuthorizedAt:mode==="meshy"?new Date():null,
        privateModelPath:null,rawModelPath:null,failureReason:null,validation:Prisma.JsonNull,catalogConsentAt:null,catalogConsentVersion:null,
        processingStartedAt:new Date(),sourceMetadata:{origin:mode,mock:mode==="mock",photoProcessingConsent:true}}});
      await audit(tx, uid, "GENERATION_START", id); return submissionShape(updated);
    }),
    submit: (uid: string, id: string, consent: unknown) => run(async tx => {
      const s = await owned(tx, uid, id, true);
      if(!s.initialApprovedAt)return fail("INITIAL_REVIEW_REQUIRED","Parts Admin initial approval is required.",409);
      if (s.status !== "READY" || !s.privateModelPath) return fail("SUBMISSION_NOT_READY", "A ready private model is required.", 409);
      if (s.generationMode !== "meshy" || s.provider!=="MESHY" || (s.sourceMetadata as any)?.mock===true) return fail("MOCK_NOT_PUBLISHABLE", "Mock previews cannot be submitted to the catalog.", 409);
      if (!s.generationId) return fail("GENERATION_REQUIRED", "Choose a specific vehicle generation before creating a catalog submission.");
      if (consent !== true) return fail("RIGHTS_REQUIRED", "Confirm your rights and permission for MOTEXA to redistribute this model.");
      const metadata = { ...(s.sourceMetadata as Record<string, unknown> ?? {}), redistributionConsent: true };
      const updated = await tx.vehicle3DSubmission.update({ where: { id }, data: { status: "SUBMITTED", submittedAt: new Date(), catalogConsentAt:new Date(),catalogConsentVersion:"catalog-share-v2", sourceMetadata: metadata as Prisma.InputJsonValue } });
      await audit(tx, uid, "SUBMIT", id); return submissionShape(updated);
    }),
    delete: async (uid: string, id: string) => {
      const deleted = await run(async tx => {
        const s = await owned(tx, uid, id, true);
        if (s.status === "APPROVED") return fail("SUBMISSION_APPROVED", "Approved submissions are retained for catalog attribution.", 409);
        const request=await tx.vehicleCatalogRequest.findUnique({where:{submissionId:id}});if(request&&request.reviewState!=="DRAFT")return fail("REQUEST_HISTORY","Reviewed requests must be retained.",409);
        await tx.vehicleCatalogRequest.deleteMany({where:{submissionId:id}});
        await tx.vehicle3DSubmission.delete({ where: { id } });
        await audit(tx, uid, "DELETE", id);
        return s;
      });
      for (const view of VIEWS) removePrivate(deleted[`${view}PhotoPath`]);
      removePrivate(deleted.privateModelPath);removePrivate(deleted.rawModelPath);
      for(const item of Array.isArray(deleted.generationHistory)?deleted.generationHistory:[]){const h=item as {raw?:string;prepared?:string};if(h.raw)removePrivate(h.raw);if(h.prepared)removePrivate(h.prepared);}
    },
    asset: (uid: string, id: string, asset: string, admin = false) => run(async tx => {
      const s = admin ? await tx.vehicle3DSubmission.findFirst({where:{id,deletedAt:null}})??missing() : await owned(tx, uid, id);
      if(asset==="model"&&!testProviderRuntime()&&(s.generationMode==="mock"||s.provider==="MOCK"))return fail("TEST_FIXTURE_ONLY","Test results are unavailable outside automated tests.",409);
      const key = asset === "model" ? s.privateModelPath : (VIEWS as readonly string[]).includes(asset) ? s[`${asset as PhotoView}PhotoPath`] : null;
      if (!key || !existsSync(privatePath(key))) return missing();
      return { bytes: readFileSync(privatePath(key)), mime: asset === "model" ? "model/gltf-binary" : "image/jpeg" };
    }),
    adminList: () => run(async tx => (await tx.vehicle3DSubmission.findMany({ where: { deletedAt: null, status: { not: "DRAFT" } }, orderBy: { submittedAt: "desc" }, take: 200 })).map(submissionShape)),
    adminGet: (id: string) => run(async tx => {
      const s = await reviewed(tx, id); const gen = s.generationId ? await tx.vehicleGeneration.findUnique({ where: { id: s.generationId } }) : null;
      return { ...submissionShape(s), existingModel3dKey: gen?.model3dKey ?? null };
    }),
    regenerate: (uid: string,id: string) => run(async tx=>{
      const s=await owned(tx,uid,id,true);
      if(!["READY","REJECTED","FAILED"].includes(s.status))return fail("REGENERATION_BLOCKED","Only unapproved, non-processing models can be regenerated.",409);
      const history=Array.isArray(s.generationHistory)?s.generationHistory:[];
      history.push({revision:s.generationRevision,provider:s.provider,taskId:s.providerTaskId,state:s.providerState,raw:s.rawModelPath,prepared:s.privateModelPath});
      const updated=await tx.vehicle3DSubmission.update({where:{id},data:{status:"DRAFT",generationStage:"UPLOAD",generationHistory:history as Prisma.InputJsonValue,
        privateModelPath:null,rawModelPath:null,providerTaskId:null,providerState:null,providerProgress:null,validation:Prisma.JsonNull,
        initialApprovedAt:null,initialApprovedByUserId:null,catalogConsentAt:null,catalogConsentVersion:null,reviewedAt:null,visualVerifiedAt:null,failureReason:null,generationErrorCode:null}});
      await tx.vehicleCatalogRequest.updateMany({where:{submissionId:id},data:{reviewState:"DRAFT",reviewNotes:null,consentAt:null}});
      await audit(tx,uid,"REGENERATE_REQUEST",id);return submissionShape(updated);
    }),
    requestRegeneration: (uid:string,id:string,notes:unknown)=>run(async tx=>{
      const s=await reviewed(tx,id,true);
      if(s.status!=="SUBMITTED"||s.userId===uid)return fail("REVIEW_CONFLICT","Only another customer's submitted model can be returned.",409);
      if(typeof notes!=="string"||!notes.trim()||notes.length>2000)return fail("REVIEW_NOTES_REQUIRED","Explain what needs to be regenerated.");
      const updated=await tx.vehicle3DSubmission.update({where:{id},data:{status:"REJECTED",generationErrorCode:"REGENERATION_REQUESTED",reviewNotes:notes.trim(),reviewedAt:new Date(),reviewedByUserId:uid}});
      await audit(tx,uid,"REGENERATION_REQUESTED",id);return submissionShape(updated);
    }),
    validate: (uid:string,id:string,config?:unknown)=>run(async tx=>{
      const s=await reviewed(tx,id,true);
      if(s.status==="APPROVED")return fail("REVIEW_CONFLICT","Approved catalog assets cannot be edited here.",409);
      if(s.status==="PROCESSING"||s.status==="DRAFT")return fail("REVIEW_CONFLICT","Wait for generation to finish before validating.",409);
      if(!s.privateModelPath&&!s.rawModelPath)return fail("MODEL_REQUIRED","A generated model is required.",409);
      const input=(config??s.preparationConfig??{}) as {preRotateX?:unknown;rotateY?:unknown};
      if(typeof input!=="object"||input===null||Object.keys(input).some(k=>!["preRotateX","rotateY"].includes(k)))return fail("INVALID_ORIENTATION","Only explicit up-axis and heading corrections are accepted.");
      const correction={preRotateX:input.preRotateX===undefined?0:Number(input.preRotateX),rotateY:input.rotateY===undefined?0:Number(input.rotateY)};
      let key:string|null=null;
      try{
        const normalized=await normalizeVehicle(readFileSync(privatePath((s.rawModelPath??s.privateModelPath)!)),s.lengthM,{...correction,stripPrivateMetadata:true});
        key=storePrivate(normalized.bytes,"glb");const viewer=await verifyViewer(privatePath(key),s.lengthM);
        const report={...normalized.report,viewer,validatedAt:new Date().toISOString()};
        const history=Array.isArray(s.generationHistory)?s.generationHistory:[];
        if(s.privateModelPath)history.push({prepared:s.privateModelPath,revision:s.generationRevision});
        const updated=await tx.vehicle3DSubmission.update({where:{id},data:{privateModelPath:key,preparationConfig:correction,validation:report,visualVerifiedAt:null,
          status:s.status==="SUBMITTED"?"SUBMITTED":"READY",generationStage:"READY",failureReason:null,generationErrorCode:null,generationHistory:history as Prisma.InputJsonValue}});
        await audit(tx,uid,"VALIDATE",id);return submissionShape(updated);
      }catch(error){removePrivate(key);throw error;}
    }),
    reject: (uid: string, id: string, notes: unknown) => run(async tx => {
      const s = await reviewed(tx, id, true);
      if (s.status !== "SUBMITTED") return fail("REVIEW_CONFLICT", "Only a submitted model can be reviewed.", 409);
      if (s.userId === uid) return fail("SELF_REVIEW", "You cannot review your own submission.", 403);
      if (typeof notes !== "string" || !notes.trim() || notes.length > 2000) return fail("REVIEW_NOTES_REQUIRED", "Explain why the model was rejected (maximum 2000 characters).");
      const updated = await tx.vehicle3DSubmission.update({ where: { id }, data: { status: "REJECTED", reviewNotes: notes.trim(), reviewedByUserId: uid, reviewedAt: new Date() } });
      await audit(tx, uid, "REJECT", id); return submissionShape(updated);
    }),
    approve: async (uid: string, id: string, input: { notes?: unknown; replaceExistingKey?: unknown; visuallyVerified?: unknown; modelRevision?: unknown; attribution?: unknown }) => {
      // Serialize all filesystem/manifest writes across server processes via a DB advisory transaction lock.
      // Journal allows the next mutation to recover if the process exits between files and DB commit.
      let journalWritten = false;
      try {
        const result = await run(async tx => {
          await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(762493031)`;
          await recoverCatalogJournal(tx);
          const s = await reviewed(tx, id, true);
          if (s.status !== "SUBMITTED" || !s.privateModelPath || !s.generationId) return fail("REVIEW_CONFLICT", "Submission is not ready for approval.", 409);
          if(!s.initialApprovedAt)return fail("INITIAL_REVIEW_REQUIRED","Parts Admin initial approval is required.",409);
          if (s.userId === uid) return fail("SELF_REVIEW", "You cannot approve your own submission.", 403);
          if (s.generationMode !== "meshy" || s.provider !== "MESHY" || s.providerState !== "SUCCEEDED" || !s.providerTaskId || !s.catalogConsentAt || s.catalogConsentVersion!=="catalog-share-v2" || (s.sourceMetadata as any)?.mock === true) return fail("RIGHTS_REQUIRED", "Real generation and customer redistribution permission are required.");
          if (input.visuallyVerified !== true) return fail("VISUAL_REVIEW_REQUIRED", "Verify vehicle identity, front direction, upright orientation, grounding, materials and all four photos first.");
          if(input.modelRevision!==submissionShape(s).modelRevision)return fail("STALE_VISUAL_REVIEW","The model changed. Reload and visually verify the current preview.",409);
          if (typeof input.notes !== "string" || input.notes.length > 2000) return fail("INVALID_NOTES", "Review notes must be at most 2000 characters.");
          await tx.$queryRaw`SELECT "id" FROM "VehicleGeneration" WHERE "id"=${s.generationId} FOR UPDATE`;
          const gen = await tx.vehicleGeneration.findUnique({ where: { id: s.generationId }, include: { vehicle: true } });
          if (!gen || gen.vehicle.make !== s.make || gen.vehicle.model !== s.model || s.year < gen.yearFrom || s.year > gen.yearTo) return fail("GENERATION_MISMATCH", "Vehicle generation does not match this submission.");
          if (gen.model3dKey && input.replaceExistingKey !== gen.model3dKey) return fail("EXISTING_MODEL", "This generation already has a shared model. Explicit replacement is required.", 409);
          const normalized = await normalizeVehicle(readFileSync(privatePath(s.privateModelPath)), s.lengthM,{stripPrivateMetadata:true});
          const temp = storePrivate(normalized.bytes, "glb");
          let viewer;
          try { viewer = await verifyViewer(privatePath(temp), s.lengthM); } finally { removePrivate(temp); }
          const key = `generated-${gen.id}-${normalized.report.sha256.slice(0,16)}`;
          const publicCredit={title:`${s.make} ${s.model} ${s.generationName}`,author:"MOTEXA customer-generated model",url:"",license:"Shared with customer permission"};
          const metadata:ModelMetadata={key,file:key,make:s.make,model:s.model,code:gen.code,...publicCredit,
            inApp:true,finalStatus:"PASS_VARIANT",generatedBy:"Meshy",generatedAt:s.providerFinishedAt?.toISOString()??null,
            viewerConfig:{...privateViewerConfig(s),key,credit:publicCredit}};
          journalWritten=true;
          await stageCatalogPromotion(tx,{generationId:gen.id,entry:metadata,bytes:normalized.bytes,expectedExistingKey:input.replaceExistingKey,submissionId:id,actorId:uid});
          const updated = await tx.vehicle3DSubmission.update({ where: { id }, data: { status: "APPROVED", approvedModel3dKey: key,
            reviewedAt: new Date(), visualVerifiedAt:new Date(), reviewedByUserId: uid, reviewNotes: input.notes.trim(), validation: { ...normalized.report, viewer, validatedAt: new Date().toISOString() } } });
          await tx.customerGarageCar.update({where:{id:s.garageCarId},data:{make:s.make,model:s.model,year:s.year,generationId:gen.id}});
          await audit(tx, uid, gen.model3dKey ? "APPROVE_REPLACE" : "APPROVE", id,
            { generationId: gen.id, model3dKey: key, previousModel3dKey: gen.model3dKey, sha256: normalized.report.sha256 });
          return submissionShape(updated);
        });
        await run(async tx => { await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(762493031)`; await recoverCatalogJournal(tx); });
        if (result.approvedModel3dKey) void autoSegment(result.approvedModel3dKey); // split the new car into parts for the Parts Admin's part map
        return result;
      } catch (error) {
        if (journalWritten) await run(async tx => { await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(762493031)`; await recoverCatalogJournal(tx); });
        throw error;
      }
    },
  };
}
