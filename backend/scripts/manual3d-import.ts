// Repository-local curator tool. Default is prepare/render only; publishing requires explicit review/evidence.
// No customer/garage record is invented for a curated vehicle.
import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import path from "node:path";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {prisma} from "../src/prisma.js";
import {normalizeVehicle,digest} from "../src/services/vehicle3d-validation.js";
import {REPO_ROOT,readManifest,type ModelMetadata,type ViewerConfig} from "../src/services/vehicle3d-catalog.js";
import {stageCatalogPromotion,recoverCatalogJournal} from "../src/services/vehicle3d-promotion.js";
import {genKey,listMake} from "../src/generations.js";
const arg=(key:string)=>process.argv.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3);
async function main(){
  const source=arg("file"),make=arg("make"),model=arg("model"),generation=arg("generation");
  if(!source||!make||!model||!generation)throw new Error("Use --file=<GLB> --make=<make> --model=<model> --generation=<code>. Default: prepare/render only.");
  const absolute=path.resolve(source);
  if(!absolute.startsWith(path.resolve(REPO_ROOT)+path.sep))throw new Error("Source must be inside this repository.");
  if(/[/\\]backup-old[/\\]/i.test(absolute))throw new Error("Archived/retired backups cannot be imported as current candidates.");
  const canonical=listMake(make),gen=await prisma.vehicleGeneration.findFirst({where:{code:generation,vehicle:{make:canonical,model}},include:{vehicle:true}});
  if(!gen)throw new Error("Choose an existing make/model/generation.");
  const bytes=readFileSync(absolute),sourceHash=digest(bytes),manifestKey=genKey(canonical,model,generation),previous=readManifest()[manifestKey];
  const lengthM=Number(arg("length")??previous?.viewerConfig?.lengthM??previous?.lengthM??4.5);
  const prepared=await normalizeVehicle(bytes,lengthM,{preRotateX:Number(arg("up-degrees")??0)*Math.PI/180,rotateY:Number(arg("heading-degrees")??0)*Math.PI/180});
  const key=`manual-${manifestKey}-${prepared.report.sha256.slice(0,16)}`;
  const dir=path.join(REPO_ROOT,".private/vehicle3d-imports",sourceHash);mkdirSync(dir,{recursive:true});
  const preparedPath=path.join(dir,"prepared.glb"),configPath=path.join(dir,"viewer-config.json");
  writeFileSync(preparedPath,prepared.bytes);
  const none={x:0,y:0,z:0,scale:1};
  const config:ViewerConfig={key,generation:`${canonical} ${model} ${generation}`,lengthM,rotateY:0,groundOffset:0,paintNodes:[],paintMaterials:arg("paint")?.split(",").filter(Boolean)??[],rimsSwappable:false,wing:none,rack:none,
    credit:{title:arg("title")??`${canonical} ${model} ${generation}`,author:"Pending source verification",url:"",license:"Pending source verification"}};
  writeFileSync(configPath,JSON.stringify(config,null,2));
  await promisify(execFile)(process.execPath,[path.join(REPO_ROOT,"backend/scripts/vehicle3d-viewer-check.mjs"),preparedPath,String(lengthM),`--config=${configPath}`,`--out=${path.join(dir,"renders")}`],{timeout:65000,windowsHide:true});
  const report={sourceSha256:sourceHash,preparedSha256:prepared.report.sha256,technical:prepared.report,provenanceVerified:false,visualVerified:false,status:"PENDING_REVIEW"};
  writeFileSync(path.join(dir,"review.json"),JSON.stringify(report,null,2));
  if(!process.argv.includes("--publish")){console.log(JSON.stringify({status:"PREPARED_NOT_PUBLISHED",sourceSha256:sourceHash,preparedSha256:prepared.report.sha256,views:6}));return;}
  const reviewer=arg("reviewer-id"),evidenceFile=arg("source-api-metadata"),ownershipFile=arg("ownership-evidence"),status=arg("status");
  if(!reviewer||(!evidenceFile&&!ownershipFile)||(!!evidenceFile&&!!ownershipFile)||!process.argv.includes("--visual-verified")||!["PASS","PASS_AFTER_FIX","PASS_VARIANT"].includes(status??""))throw new Error("Publishing requires --reviewer-id, exactly one of --source-api-metadata/--ownership-evidence, --visual-verified and an accepted --status.");
  const user=await prisma.user.findUnique({where:{id:reviewer},include:{adminPermissions:true}});
  if(!user||user.status!=="ACTIVE"||!(user.role==="SUPER_ADMIN"||user.role==="ADMIN"&&user.adminPermissions.some(p=>p.permission==="MANAGE_SPARE_PARTS")))throw new Error("An active Parts Admin reviewer is required.");
  const sourceJson=JSON.parse(bytes.toString("utf8",20,20+bytes.readUInt32LE(12))),origin=sourceJson.asset?.extras??{};
  let evidenceSha256:string;
  if(evidenceFile){
  const evidenceBytes=readFileSync(path.resolve(evidenceFile));evidenceSha256=digest(evidenceBytes);
  const metadata=JSON.parse(evidenceBytes.toString("utf8"));
  const uid=String(origin.source??"").match(/[a-f0-9]{32}/i)?.[0];
  if(!uid||metadata.uid!==uid||!metadata.isDownloadable||!["cc0","by","by-sa"].includes(metadata.license?.slug)||!metadata.user?.displayName||!metadata.viewerUrl?.startsWith("https://sketchfab.com/"))throw new Error("External source metadata must match the embedded source UID, author, downloadable status and compatible license. Unverified assets stay inactive.");
  config.credit={title:String(metadata.name),author:String(metadata.user.displayName),url:String(metadata.viewerUrl),license:String(metadata.license.label??metadata.license.slug)};
  }else{
    const evidenceBytes=readFileSync(path.resolve(ownershipFile!));evidenceSha256=digest(evidenceBytes);
    const rights=JSON.parse(evidenceBytes.toString("utf8"));
    if(rights.sourceSha256!==sourceHash||rights.rightsHolder!=="MOTEXA"||rights.permission!=="redistribution-and-use"||rights.verifiedByUserId!==reviewer||typeof rights.description!=="string"||rights.description.trim().length<20)throw new Error("Ownership evidence must identify this exact asset, MOTEXA rights, redistribution permission and the verifying reviewer.");
    config.credit={title:arg("title")??`${canonical} ${model} ${generation}`,author:"MOTEXA",url:"",license:"MOTEXA-owned; shared with permission"};
  }
  writeFileSync(configPath,JSON.stringify(config,null,2));
  await promisify(execFile)(process.execPath,[path.join(REPO_ROOT,"backend/scripts/vehicle3d-viewer-check.mjs"),preparedPath,String(lengthM),`--config=${configPath}`,`--out=${path.join(dir,"renders")}`],{timeout:65000,windowsHide:true});
  const entry:ModelMetadata={key,file:key,make:canonical,model,code:gen.code,...config.credit,inApp:true,finalStatus:status,viewerConfig:config,sourceSha256:sourceHash,preparedSha256:prepared.report.sha256,sourceVerifiedAt:new Date().toISOString()};
  try{
    await prisma.$transaction(async tx=>{await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(762493031)`;await recoverCatalogJournal(tx);
      await stageCatalogPromotion(tx,{generationId:gen.id,entry,bytes:prepared.bytes,expectedExistingKey:arg("replace-existing-key"),actorId:reviewer});},{timeout:90000});
  }finally{await prisma.$transaction(async tx=>{await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(762493031)`;await recoverCatalogJournal(tx);});}
  writeFileSync(path.join(dir,"review.json"),JSON.stringify({...report,provenanceVerified:true,visualVerified:true,status,evidenceSha256,reviewerId:reviewer,reviewedAt:new Date().toISOString()},null,2));
  console.log(JSON.stringify({status:"PUBLISHED",model3dKey:key,sourceSha256:sourceHash}));
}
try{await main();}catch{console.error("Manual import stopped. Check required arguments, technical validation, source evidence and replacement permissions. No unverified candidate is published.");process.exitCode=1;}
finally{await prisma.$disconnect();}
