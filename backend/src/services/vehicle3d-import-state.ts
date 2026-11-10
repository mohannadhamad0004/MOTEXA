import {readManifest} from "./vehicle3d-catalog.js";
import type {Prisma} from "../generated/prisma/client.js";
import {parseSketchfabUrl} from "./sketchfab-client.js";
import {existsSync} from "node:fs";
import {privatePath} from "./vehicle3d-private-assets.js";

export const IMPORT_PROGRESS:Record<string,number>={INSPECTED:0,QUEUED:5,DOWNLOADING:15,CONVERTING:30,OPTIMIZING:55,VALIDATING:75,GENERATING_PART_MAP:90,READY:100,PUBLISHED:100};
export const IMPORT_RUNNING=["QUEUED","DOWNLOADING","CONVERTING","OPTIMIZING","VALIDATING","GENERATING_PART_MAP"];
export const IMPORT_ERRORS:Record<string,string>={
 INVALID_SKETCHFAB_URL:"Enter a valid Sketchfab model URL.",SKETCHFAB_TOKEN_MISSING:"Sketchfab credentials are missing from the backend; downloads require an OAuth access token.",
 SKETCHFAB_UNAUTHORIZED:"Sketchfab rejected the backend credential. Check its type, expiry and download access.",SKETCHFAB_RATE_LIMITED:"Sketchfab is rate limiting requests. Try again later.",SKETCHFAB_UNAVAILABLE:"Sketchfab is temporarily unavailable.",
 MODEL_NOT_DOWNLOADABLE:"This model is not downloadable through Sketchfab.",DUPLICATE_MODEL:"This Sketchfab model has already been imported.",NETWORK_ERROR:"The backend could not connect to Sketchfab.",FORBIDDEN:"Parts Admin access is required.",
 BAD_LINK:"Enter a valid Sketchfab model URL.",SKETCHFAB_NOT_FOUND:"Unable to read this Sketchfab model.",SKETCHFAB_API_FAILED:"Unable to read this Sketchfab model.",
 NOT_DOWNLOADABLE:"This model is not downloadable through Sketchfab.",LICENSE_NOT_ALLOWED:"This model cannot be imported because its license does not allow the required use.",
 DUPLICATE_IMPORT:"This Sketchfab model has already been imported.",DOWNLOAD_FAILED:"The Sketchfab download failed.",DOWNLOAD_TOO_LARGE:"The Sketchfab download exceeds the source size limit.",
 ARCHIVE_INVALID:"The model archive is invalid or exceeds safe extraction limits.",CONVERSION_FAILED:"The model could not be converted to a supported GLB.",OPTIMIZATION_FAILED:"The model could not be optimized safely.",
 FINAL_ASSET_TOO_LARGE:"The optimized model is larger than 8 MiB.",VALIDATION_REJECTED:"The model did not pass the required technical or quality validation.",PUBLICATION_CONFLICT:"The current model changed. Reload before confirming replacement.",
 IMPORT_DISCARDED:"This import has been discarded.",IMPORT_BUSY:"This import is still being prepared.",GENERATION_YEARS:"Use the selected generation's production years, or edit it in the managed catalog.",
};
export const importInclude={generation:{include:{vehicle:true}}} as const;
export function importShape(r:any){
 const s=r.sourceMetadata??{},v=r.validation??null;
 // Only allowlisted, backend-derived source evidence is serialized. No paths, leases, provider bodies or signed URLs.
 const provenance=r.sourceProvider==="SKETCHFAB"?{uid:r.sourceUid,title:s.title,author:r.author,authorUrl:s.authorUrl??null,url:r.sourceUrl,license:r.license,
   licenseUrl:s.licenseUrl??null,licenseClass:s.licenseClass,downloadable:s.downloadable,inspectedAt:s.inspectedAt,downloadedAt:s.downloadedAt??null,
   downloadSource:s.downloadSource??null,sourceSha256:s.sourceSha256??null,originalDownloadedBytes:s.originalDownloadedBytes??null,
   preparedSha256:v?.sha256??null,thumbnail:s.thumbnail??null,optimization:s.optimization??null}:null;
 const validation=v?{...v,partMap:v.partMap?{sha256:v.partMap.sha256,proposal:v.partMap.proposal,segmentedAt:v.partMap.segmentedAt,pieces:v.partMap.pieces?.length??0}:null}:null;
 return {id:r.id,generationId:r.generationId,status:r.importStage??r.status,progress:IMPORT_PROGRESS[r.importStage??r.status]??null,errorCode:r.errorCode??null,
   failureReason:r.errorCode?IMPORT_ERRORS[r.errorCode]??IMPORT_ERRORS.VALIDATION_REJECTED:null,
   source:r.source,author:r.author,license:r.license,sourceUrl:r.sourceUrl,provenance,reviewNotes:r.reviewNotes,viewerConfig:r.viewerConfig,validation,
   hasModel:!!r.privateModelPath&&r.importStage!=="DISCARDED",hasRawModel:r.importStage!=="DISCARDED"&&existsSync(privatePath(r.rawModelPath)),publishedModel3dKey:r.publishedModel3dKey,existingModel3dKey:r.generation.model3dKey,
   make:r.generation.vehicle.make,model:r.generation.vehicle.model,code:r.generation.code,yearFrom:r.generation.yearFrom,yearTo:r.generation.yearTo,
   createdAt:r.createdAt,finishedAt:r.finishedAt??null};
}
const uidFor=(url:unknown)=>{try{return parseSketchfabUrl(url).uid;}catch{return null;}};
/** Include legacy imports and every manifest version (including intentionally removed sources). */
export async function existingSketchfab(tx:Prisma.TransactionClient,uid:string,excludeId?:string){
 const rows=await tx.vehicle3DImport.findMany({where:excludeId?{id:{not:excludeId}}:{},include:importInclude});
 const r=rows.find(r=>r.sourceUid===uid||uidFor(r.sourceUrl)===uid);
 if(r)return {importId:r.id,generationId:r.generationId,name:`${r.generation.vehicle.make} ${r.generation.vehicle.model} ${r.generation.code}`,model3dKey:r.publishedModel3dKey,status:r.importStage??r.status};
 for(const current of Object.values(readManifest())){
   let e:any=current;
   while(e){if(uidFor(e.url)===uid)return {importId:null,generationId:null,name:`${e.make} ${e.model} ${e.code}`,model3dKey:e.file,status:e.finalStatus??"CATALOG"};e=e.previousCatalogMetadata;}
 }
 return null;
}
