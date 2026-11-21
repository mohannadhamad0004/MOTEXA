import {test} from "node:test";
import assert from "node:assert/strict";
import {crc32,deflateRawSync} from "node:zlib";
import {createSketchfabClient,parseSketchfabUrl,classifyLicense,inspectMetadata,allowedDownloadUrl,MAX_SOURCE_BYTES} from "../src/services/sketchfab-client.js";
import {readModelArchive,convertSketchfabAsset} from "../src/services/vehicle3d-archive.js";
import {Document,NodeIO} from "@gltf-transform/core";
const uid="e".repeat(32),url=`https://sketchfab.com/3d-models/example-car-${uid}`;
const model=(patch:any={})=>({uid,name:"Test car",viewerUrl:url,user:{displayName:"Fixture artist",profileUrl:"https://sketchfab.com/fixture"},isDownloadable:true,license:{slug:"by",label:"CC Attribution",url:"http://creativecommons.org/licenses/by/4.0/"},...patch});
export function zip(entries:[string,Buffer][],patch:{mode?:number;size?:number;crc?:number}={}){
 const locals:Buffer[]=[],central:Buffer[]=[];let offset=0;
 for(const[name,data]of entries){const n=Buffer.from(name),packed=deflateRawSync(data),crc=patch.crc??crc32(data),local=Buffer.alloc(30),c=Buffer.alloc(46);
  local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(8,8);local.writeUInt32LE(crc,14);local.writeUInt32LE(packed.length,18);local.writeUInt32LE(patch.size??data.length,22);local.writeUInt16LE(n.length,26);
  c.writeUInt32LE(0x02014b50);c.writeUInt16LE(0x0314,4);c.writeUInt16LE(20,6);c.writeUInt16LE(8,10);c.writeUInt32LE(crc,16);c.writeUInt32LE(packed.length,20);c.writeUInt32LE(patch.size??data.length,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(((patch.mode??0x8000)<<16)>>>0,38);c.writeUInt32LE(offset,42);
  locals.push(local,n,packed);central.push(c,n);offset+=local.length+n.length+packed.length;
 }
 const cd=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...locals,cd,end]);
}
test("Sketchfab parser accepts model pages and query strings; rejects unsupported URLs",()=>{
 for(const value of [url,url+"/?utm_source=fixture#view",`https://www.sketchfab.com/3d-models/${uid}/`,`https://sketchfab.com/3d-models/mercedes_benz-s600-${uid}`,` https://sketchfab.com/3d-models/${uid.toUpperCase()} `])assert.equal(parseSketchfabUrl(value).uid,uid);
 for(const value of ["https://other.example/3d-models/car-"+uid,"https://sketchfab.com/3d-models/no-uid","https://sketchfab.com/users/"+uid,"https://sketchfab.com.evil.test/3d-models/"+uid,`https://x@sketchfab.com/3d-models/${uid}`,`http://sketchfab.com/3d-models/${uid}`,`https://sketchfab.com:8443/3d-models/${uid}`,`https://sketchfab.com/3d-models/${uid}/embed`,`https://sketchfab.com/3d-models/x-${uid}e`,`https://sketchfab.com/3d-models/x-${uid.slice(1)}`,null])assert.throws(()=>parseSketchfabUrl(value),{code:"INVALID_SKETCHFAB_URL"});
});
test("license gate recognizes exact/versioned CC0, BY, BY-SA; refuses NC/ND, proprietary, unknown and contradictions",()=>{
 for(const slug of ["cc0","by","by-sa","cc-by-4.0","by-sa-3.0"])assert.ok(classifyLicense({slug}));
 for(const slug of ["by-nc","by-nc-sa","by-nd","by-nc-nd","editorial","standard","proprietary","all-rights-reserved","unknown","by-something","cc-by-nc-4.0"])assert.equal(classifyLicense({slug}),null);
 assert.equal(classifyLicense({url:"https://creativecommons.org/licenses/by-sa/4.0/"}),"CC BY-SA");
 assert.equal(classifyLicense({slug:"by",url:"https://creativecommons.org/licenses/by-nc/4.0/"}),null);
 assert.equal(classifyLicense({slug:"by-nc",url:"https://creativecommons.org/licenses/by/4.0/"}),null);
 assert.equal(classifyLicense({slug:"by",label:"NonCommercial"}),null);
 assert.equal(classifyLicense({label:"CC BY 4.0"}),null,"unverified label alone is insufficient");
 assert.equal(inspectMetadata(model({isDownloadable:false}),uid).refusalCode,"NOT_DOWNLOADABLE");
 assert.equal(inspectMetadata(model({price:100}),uid).refusalCode,"LICENSE_NOT_ALLOWED");
 assert.equal(inspectMetadata(model({isPurchasable:true}),uid).refusalCode,"LICENSE_NOT_ALLOWED");
 assert.equal(classifyLicense({slug:"cc-by-2.5"}),"CC BY");
 for(const slug of ["cc0","by","by-sa"])assert.equal(inspectMetadata(model({license:{slug}}),uid).allowed,true);
});
test("inspection makes no download request; credentials/signed URLs never enter the safe DTO",async()=>{
 let requests=0;const client=createSketchfabClient({token:"test-secret-only",fetcher:(async(request,options)=>{requests++;assert.equal(String(request),`https://api.sketchfab.com/v3/models/${uid}`);assert.equal((options?.headers as any).Authorization,"Token test-secret-only");return Response.json(model({token:"test-secret-only",download:{url:"https://example.test/?secret=signed"}}));})as typeof fetch});
 const m=await client.inspect(url);assert.equal(requests,1);assert.equal(m.allowed,true);assert.doesNotMatch(JSON.stringify(m),/test-secret|signed|download\/|Authorization/);
});
test("safe errors and not-found; download URL/size/type restrictions and license recheck",async()=>{
 for(const status of [401,403,404,429,500]){const client=createSketchfabClient({token:"test",fetcher:(async()=>new Response("private-upstream-body",{status}))as typeof fetch});await assert.rejects(client.inspect(url),{code:status===404?"SKETCHFAB_NOT_FOUND":status===429?"SKETCHFAB_RATE_LIMITED":status===401||status===403?"SKETCHFAB_UNAUTHORIZED":"SKETCHFAB_UNAVAILABLE"});}
 for(const unsafe of ["http://media.sketchfab.com/archives/x","https://127.0.0.1/archives/x","https://evil.s3.amazonaws.com/archives/x","https://sketchfab-prod-media.s3.amazonaws.com/not-archives/x"])assert.throws(()=>allowedDownloadUrl(unsafe),{code:"DOWNLOAD_FAILED"});
 for(const scenario of ["license","size","html","stream"]){let count=0;const client=createSketchfabClient({accessToken:"test",fetcher:(async()=>{count++;if(count===1)return Response.json(model(scenario==="license"?{license:{slug:"by-nc"}}:{}));if(count===2)return Response.json({glb:{url:"https://sketchfab-prod-media.s3.amazonaws.com/archives/x?signature=private",size:scenario==="size"?MAX_SOURCE_BYTES+1:100}});return new Response("<html>upstream error</html>",{headers:scenario==="stream"?{"content-length":String(MAX_SOURCE_BYTES+1),"content-type":"application/octet-stream"}:{"content-type":"text/html"}});})as typeof fetch});
  await assert.rejects(client.download(inspectMetadata(model(),uid)),{code:scenario==="license"?"LICENSE_NOT_ALLOWED":scenario==="html"?"DOWNLOAD_FAILED":"DOWNLOAD_TOO_LARGE"});
  if(scenario==="license")assert.equal(count,1);
 }
});
test("OAuth metadata/download auth and missing/network/malformed failures are explicit and safe",async()=>{
 let calls=0;
 const client=createSketchfabClient({accessToken:"private-oauth-fixture",fetcher:(async(_url,options)=>{calls++;assert.equal((options?.headers as any).Authorization,"Bearer private-oauth-fixture");return Response.json(model());})as typeof fetch});
 assert.equal((await client.inspect(url)).uid,uid);assert.equal(calls,1);
 await assert.rejects(createSketchfabClient({token:"",accessToken:"",fetcher:(async()=>{assert.fail("missing credentials must not call provider");})as typeof fetch}).inspect(url),{code:"SKETCHFAB_TOKEN_MISSING"});
 await assert.rejects(createSketchfabClient({token:"test",fetcher:(async()=>{throw Object.assign(Error("private diagnostic"),{code:"ENOTFOUND"});})as typeof fetch}).inspect(url),{code:"NETWORK_ERROR"});
 await assert.rejects(createSketchfabClient({token:"test",fetcher:(async()=>new Response("private invalid JSON"))as typeof fetch}).inspect(url),{code:"SKETCHFAB_UNAVAILABLE"});
 await assert.rejects(createSketchfabClient({token:"personal",accessToken:"",fetcher:(async()=>Response.json(model()))as typeof fetch}).download(inspectMetadata(model(),uid)),{code:"SKETCHFAB_TOKEN_MISSING"});
});
test("ZIP refuses traversal, symlinks, corrupt data, ambiguous source, bombs and external glTF resources",async()=>{
 assert.equal(readModelArchive(zip([["textures/one.png",Buffer.from("data")]])).get("textures/one.png")?.toString(),"data");
 for(const name of ["../escape","/absolute","x\\escape","C:/escape","a/../escape"] )assert.throws(()=>readModelArchive(zip([[name,Buffer.from("x")]])),{code:"ARCHIVE_INVALID"});
 for(const patch of [{mode:0xa000},{crc:123},{size:MAX_SOURCE_BYTES+1}])assert.throws(()=>readModelArchive(zip([["scene.gltf",Buffer.from("data")]],patch)),{code:"ARCHIVE_INVALID"});
 assert.throws(()=>readModelArchive(zip([["a",Buffer.from("x")],["A",Buffer.from("y")]])),{code:"ARCHIVE_INVALID"});
 await assert.rejects(convertSketchfabAsset(zip([["scene.gltf",Buffer.from(JSON.stringify({asset:{version:"2.0"},buffers:[{uri:"https://127.0.0.1/private",byteLength:10}]}))]])),{code:"CONVERSION_FAILED"});
 await assert.rejects(convertSketchfabAsset(zip([["source.fbx",Buffer.from("unsupported")]])),{code:"CONVERSION_FAILED"});
});
test("glTF plus external local buffer converts to a self-contained GLB",async()=>{
 const d=new Document(),b=d.createBuffer(),p=d.createPrimitive().setAttribute("POSITION",d.createAccessor().setType("VEC3").setArray(new Float32Array([0,0,0,1,0,0,0,1,1])).setBuffer(b));d.createScene().addChild(d.createNode().setMesh(d.createMesh().addPrimitive(p)));
 const io=new NodeIO(),gltf=await io.writeJSON(d),entries:[string,Buffer][]=[["scene.gltf",Buffer.from(JSON.stringify(gltf.json))],...Object.entries(gltf.resources).map(([k,v])=>[k,Buffer.from(v)] as [string,Buffer])];
 assert.equal((await convertSketchfabAsset(zip(entries))).subarray(0,4).toString(),"glTF");
});
