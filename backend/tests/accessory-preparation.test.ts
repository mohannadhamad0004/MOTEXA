// Procedural assets exist only in automated tests. The actual preparation/optimization code runs unchanged.
import {test} from "node:test";
import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {mkdirSync,mkdtempSync,writeFileSync,rmSync} from "node:fs";
import {resolve,join,sep} from "node:path";
import {pathToFileURL} from "node:url";
import sharp from "sharp";
import {NodeIO} from "@gltf-transform/core";
import {mockAccessoryGLB} from "../src/services/accessory3d.js";
import {normalizeAccessory,MAX_MODEL_BYTES} from "../src/services/vehicle3d-validation.js";
import {createMeshyClient,PROVIDER_DOWNLOAD_MAX_BYTES} from "../src/services/meshy-client.js";

async function source(textureCount=1){
 const io=new NodeIO(),doc=await io.readBinary(await mockAccessoryGLB("REAR_BUMPER")),root=doc.getRoot(),mesh=root.listMeshes()[0]!,primitive=mesh.listPrimitives()[0]!,buffer=root.listBuffers()[0]!;
 const uv=new Float32Array(primitive.getAttribute("POSITION")!.getCount()*2);for(let i=0;i<uv.length;i++)uv[i]=i%2;
 primitive.setAttribute("TEXCOORD_0",doc.createAccessor().setType("VEC2").setArray(uv).setBuffer(buffer));
 for(let i=0;i<textureCount;i++){
  const image=await sharp(randomBytes(2048*2048*3),{raw:{width:2048,height:2048,channels:3}}).png({compressionLevel:0}).toBuffer();
  const texture=doc.createTexture("test-only noisy texture").setMimeType("image/png").setImage(image);
  const material=doc.createMaterial().setBaseColorTexture(texture);
  if(!i)primitive.setMaterial(material);else mesh.addPrimitive(primitive.clone().setMaterial(material));
 }
 return Buffer.from(await io.writeBinary(doc));
}

test("raw provider GLB above the runtime limit is optimized, validated and kept below the final limit",async()=>{
 const raw=await source();assert.ok(raw.length>MAX_MODEL_BYTES);assert.ok(raw.length<=PROVIDER_DOWNLOAD_MAX_BYTES);
 const result=await normalizeAccessory(raw);
 assert.ok(result.bytes.length<=MAX_MODEL_BYTES);assert.equal(result.report.valid,true);assert.equal(result.report.triangles,12);
 assert.equal(result.report.processing.rawBytes,raw.length);assert.equal(result.report.processing.geometrySimplified,false);assert.equal(result.report.processing.qualityGate,"PASS");
 assert.deepEqual(result.report.processing.largestTexture,[2048,2048]);assert.ok(result.report.processing.compressionRatio<1);
});

test("provider sources beyond the download safety ceiling are refused before buffering",async()=>{
 let cancelled=false;const client=createMeshyClient({key:"test",maxBytes:PROVIDER_DOWNLOAD_MAX_BYTES,fetcher:(async()=>new Response(new ReadableStream({cancel(){cancelled=true;}}),{headers:{"content-length":String(PROVIDER_DOWNLOAD_MAX_BYTES+1)}}))as typeof fetch});
 await assert.rejects(client.download("https://assets.meshy.ai/oversized.glb"),{code:"PROVIDER_DOWNLOAD_TOO_LARGE"});assert.equal(cancelled,true);
});

test("an optimized candidate above the configured final limit reports actual bytes and PROVIDER_ASSET_TOO_LARGE",async()=>{
 const base=resolve(".private");mkdirSync(base,{recursive:true});const directory=mkdtempSync(join(base,"oversize-accessory-"));
 try{
  const file=join(directory,"source.glb");writeFileSync(file,await source(2));
  // Use the existing 1 MiB test configuration, keeping the normal development limit unchanged.
  const script=`import {readFileSync} from 'node:fs';import {normalizeAccessory,MAX_MODEL_BYTES} from ${JSON.stringify(pathToFileURL(resolve("src/services/vehicle3d-validation.ts")).href)};try{const r=await normalizeAccessory(readFileSync(process.argv[1]));console.log(JSON.stringify({valid:r.report.valid,bytes:r.bytes.length}));}catch(e){console.log(JSON.stringify({code:e.code,...e.diagnostics,configuredLimit:MAX_MODEL_BYTES}));}`;
  const {stdout}=await promisify(execFile)(process.execPath,["--import",pathToFileURL(resolve("scripts/register-typescript.mjs")).href,"--input-type=module","--eval",script,file],{env:{...process.env,VEHICLE3D_MAX_MB:"1"},windowsHide:true,timeout:180000,maxBuffer:1024*1024});
  const result=JSON.parse(stdout.trim().split("\n").pop()!);
  assert.equal(result.code,"PROVIDER_ASSET_TOO_LARGE");assert.equal(result.configuredLimit,1024*1024);assert.ok(result.optimizedBytes>result.configuredLimit);assert.equal(result.geometrySimplified,false);assert.equal(result.qualityGate,"REJECTED_SIZE");
 }finally{assert.ok(directory.startsWith(base+sep));rmSync(directory,{recursive:true,force:true});}
});
