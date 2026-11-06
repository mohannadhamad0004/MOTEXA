import { createHash } from "node:crypto";
import { stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { prisma } from "../prisma.js";
import { PROVIDER_STORAGE_DIR, storeFile, removeStoredFile } from "../uploads/providerFiles.js";
import { Vehicle3DError } from "./vehicle3d-validation.js";
import { portalOwner, type PortalArea } from "./provider-portal.js";

const fail=(message:string,status=400):never=>{throw new Vehicle3DError(status,"INVALID_MEDIA",message);};
export const MEDIA_LIMIT=20*1024*1024;
/** A bounded, self-contained MP4 with a video track; never trust the supplied extension/MIME. */
export function isMp4(bytes:Buffer) {
  if(bytes.length<32||bytes.length>MEDIA_LIMIT)return false;
  let at=0,ftyp=false,mdat=false,moov=false;
  while(at<bytes.length){if(at+8>bytes.length)return false;const size=bytes.readUInt32BE(at),kind=bytes.toString("ascii",at+4,at+8);if(size<8||at+size>bytes.length)return false;
    if(kind==="ftyp")ftyp=size>=16&&/isom|iso2|mp41|mp42|avc1/.test(bytes.toString("ascii",at+8,at+size));
    if(kind==="mdat")mdat=size>8;
    if(kind==="moov"){const box=bytes.subarray(at+8,at+size);moov=box.includes(Buffer.from("vide"))&&box.includes(Buffer.from("avc1"));}
    at+=size;
  }return ftyp&&mdat&&moov;
}
export async function normalizeMedia(input:unknown,video:boolean){
  if(typeof input!=="string"||input.length>Math.ceil(MEDIA_LIMIT*4/3)+8||!/^[A-Za-z0-9+/]+={0,2}$/.test(input))return fail("Choose a valid file under 20 MB.");
  const bytes=Buffer.from(input,"base64");if(!bytes.length||bytes.length>MEDIA_LIMIT)return fail("Choose a valid file under 20 MB.");
  if(video){if(!isMp4(bytes))return fail("Choose a self-contained H.264 MP4 video under 20 MB.");return {buffer:bytes,mimeType:"video/mp4",ext:"mp4"};}
  if(bytes.length>5*1024*1024)return fail("Choose a photo under 5 MB.");
  try{const image=sharp(bytes,{limitInputPixels:25_000_000}),m=await image.metadata();if(!["jpeg","png","webp"].includes(m.format??"")||!m.width||!m.height||m.width<64||m.height<64)return fail("Choose a real JPEG, PNG or WebP photo.");const buffer=await image.rotate().resize({width:1800,height:1800,fit:"inside",withoutEnlargement:true}).jpeg({quality:86}).toBuffer();return {buffer,mimeType:"image/jpeg",ext:"jpg"};}catch{return fail("The photo could not be read.");}
}
export const mediaShape=(m:{id:string;slot:string;mimeType:string;truckId:string|null;createdAt:Date;sizeBytes:number})=>({id:m.id,slot:m.slot,mimeType:m.mimeType,truckId:m.truckId,sizeBytes:m.sizeBytes,createdAt:m.createdAt,uri:`/catalog/provider-media/${m.id}`});
export async function listMedia(uid:string,area:PortalArea){await portalOwner(uid,area);return prisma.providerMedia.findMany({where:{ownerUserId:uid,...(area==="tow"?{OR:[{towCompanyId:{not:null}},{truckId:{not:null}}]}:{partsShopId:{not:null}})},orderBy:[{createdAt:"desc"},{id:"desc"}],take:60}).then(rows=>rows.map(mediaShape));}
export async function uploadMedia(uid:string,area:PortalArea,body:Record<string,unknown>){
  const p=await portalOwner(uid,area),slot=String(body.slot??"GALLERY");
  if(!["PROFILE","COVER","GALLERY","VIDEO"].includes(slot)||slot==="VIDEO"&&area!=="tow")return fail("Unknown media type.");
  const truckId=typeof body.truckId==="string"?body.truckId:null;
  if(truckId&&(area!=="tow"||!await prisma.truck.findFirst({where:{id:truckId,companyId:p.id,archivedAt:null}})))return fail("Truck not found.",404);
  const target=truckId?{truckId}:area==="tow"?{towCompanyId:p.id}:{partsShopId:p.id};
  const file=await normalizeMedia(body.dataBase64,slot==="VIDEO");
  const sha256=createHash("sha256").update(file.buffer).digest("hex"),storageKey=await storeFile({...file,sha256,originalName:`media.${file.ext}`});
  try{return await prisma.$transaction(async tx=>{
    // Serialize uploads per owner so concurrent gallery/replacement requests cannot exceed the cap.
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${uid} FOR UPDATE`;
    const all=await tx.providerMedia.count({where:{ownerUserId:uid}});if(all>=60)return fail("Remove an unused image before uploading another.");
    const replaceId=typeof body.replaceId==="string"?body.replaceId:null;
    const old=replaceId?await tx.providerMedia.findFirst({where:{id:replaceId,ownerUserId:uid,...target,slot}}):null;
    if(replaceId&&!old)return fail("Media not found.",404);
    if(old)await tx.providerMedia.delete({where:{id:old.id}});
    const row=await tx.providerMedia.create({data:{ownerUserId:uid,...target,slot,mimeType:file.mimeType,sizeBytes:file.buffer.length,sha256,storageKey}});
    await tx.auditLog.create({data:{actorId:uid,action:old?"PROVIDER_MEDIA_REPLACED":"PROVIDER_MEDIA_UPLOADED",targetId:row.id,details:{slot,replacedId:old?.id??null}}});
    return mediaShape(row);
  });}catch(e){await removeStoredFile(storageKey);throw e;}
}
export async function deleteMedia(uid:string,area:PortalArea,id:string){await portalOwner(uid,area);const m=await prisma.providerMedia.findFirst({where:{id,ownerUserId:uid,...(area==="parts"?{partsShopId:{not:null}}:{OR:[{towCompanyId:{not:null}},{truckId:{not:null}}]})}});if(!m)return fail("Media not found.",404);await prisma.$transaction(async tx=>{await tx.providerMedia.delete({where:{id}});await tx.auditLog.create({data:{actorId:uid,action:"PROVIDER_MEDIA_REMOVED",targetId:id}});});/* Retain the stored bytes; obsolete ids are inaccessible and existing files are never discarded. */}
export async function mediaFile(id:string,uid?:string){const m=await prisma.providerMedia.findUnique({where:{id},include:{towCompany:{select:{verificationStatus:true}},partsShop:{select:{verificationStatus:true}},truck:{select:{verificationStatus:true,archivedAt:true,company:{select:{verificationStatus:true}}}}}});if(!m)return fail("Media not found.",404);
  const published=m.towCompany?.verificationStatus==="APPROVED"||m.partsShop?.verificationStatus==="APPROVED"||m.truck?.verificationStatus==="APPROVED"&&!m.truck.archivedAt&&m.truck.company.verificationStatus==="APPROVED";
  if(!published&&m.ownerUserId!==uid)return fail("Media not found.",404);
  const file=path.join(PROVIDER_STORAGE_DIR,path.basename(m.storageKey));return {file,size:(await stat(file)).size,mime:m.mimeType,published};
}
