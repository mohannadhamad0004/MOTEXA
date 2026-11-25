import {test} from "node:test";
import assert from "node:assert/strict";
import {crc32,deflateRawSync} from "node:zlib";
import {createSketchfabClient,parseSketchfabUrl,classifyLicense,inspectMetadata,allowedDownloadUrl,MAX_SOURCE_BYTES,sketchfabAuthorizations} from "../src/services/sketchfab-client.js";
import {readModelArchive,convertSketchfabAsset} from "../src/services/vehicle3d-archive.js";
import {importShape,failureDetail} from "../src/services/vehicle3d-import-state.js";
import {readSafeGLB,Vehicle3DError} from "../src/services/vehicle3d-validation.js";
import {simplifyForPhones,fitForPhones} from "../src/services/vehicle3d-preparation.js";
import {viewerFailure} from "../src/services/vehicle3d-imports.js";
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
test("license gate accepts any Creative Commons license (CC0 and every CC BY variant); refuses Standard / Editorial, unknown and contradictions; triangles are info only",()=>{
 for(const [slug,cls] of [["cc0","CC0"],["by","CC BY"],["by-sa","CC BY-SA"],["cc-by-4.0","CC BY"],["by-sa-3.0","CC BY-SA"],["by-nc","CC BY-NC"],["by-nc-sa","CC BY-NC-SA"],["by-nd","CC BY-ND"],["by-nc-nd","CC BY-NC-ND"],["cc-by-nc-4.0","CC BY-NC"]])assert.equal(classifyLicense({slug}),cls,slug);
 for(const slug of ["editorial","standard","st","ed","proprietary","all-rights-reserved","unknown","by-something","by-sa-nc","by-nd-sa"])assert.equal(classifyLicense({slug}),null,slug);
 assert.equal(classifyLicense({url:"https://creativecommons.org/licenses/by-sa/4.0/"}),"CC BY-SA");
 assert.equal(classifyLicense({url:"https://creativecommons.org/licenses/by-nc-nd/4.0/"}),"CC BY-NC-ND");
 assert.equal(classifyLicense({slug:"by",url:"https://creativecommons.org/licenses/by-nc/4.0/"}),null);
 assert.equal(classifyLicense({slug:"by-nc",url:"https://creativecommons.org/licenses/by/4.0/"}),null);
 assert.equal(classifyLicense({slug:"by",label:"NonCommercial"}),null,"a label claiming NC that the identifier lacks");
 assert.equal(classifyLicense({slug:"by-nc",label:"CC Attribution-NonCommercial"}),"CC BY-NC");
 assert.equal(classifyLicense({slug:"by",label:"Standard"}),null);
 assert.equal(classifyLicense({label:"CC BY 4.0"}),null,"unverified label alone is insufficient");
 assert.equal(inspectMetadata(model({isDownloadable:false}),uid).refusalCode,"NOT_DOWNLOADABLE");
 assert.equal(inspectMetadata(model({price:100}),uid).refusalCode,"LICENSE_NOT_ALLOWED");
 assert.equal(inspectMetadata(model({isPurchasable:true}),uid).refusalCode,"LICENSE_NOT_ALLOWED");
 assert.equal(inspectMetadata(model({license:{slug:"st",label:"Standard"}}),uid).refusalCode,"LICENSE_NOT_ALLOWED");
 assert.equal(classifyLicense({slug:"cc-by-2.5"}),"CC BY");
 for(const slug of ["cc0","by","by-sa","by-nc","by-nd","by-nc-sa","by-nc-nd"])assert.equal(inspectMetadata(model({license:{slug}}),uid).allowed,true,slug);
 for(const faceCount of [1_186_481,2_000_000,25_000_000]){const heavy=inspectMetadata(model({faceCount}),uid);assert.equal(heavy.allowed,true);assert.equal(heavy.refusalCode,null);assert.equal(heavy.triangles,faceCount);}
 assert.equal(inspectMetadata(model(),uid).triangles,null);
});
test("inspection makes no download request; credentials/signed URLs never enter the safe DTO",async()=>{
 let requests=0;const client=createSketchfabClient({token:"test-secret-only",fetcher:(async(request,options)=>{requests++;assert.equal(String(request),`https://api.sketchfab.com/v3/models/${uid}`);assert.equal((options?.headers as any).Authorization,"Token test-secret-only");return Response.json(model({token:"test-secret-only",download:{url:"https://example.test/?secret=signed"}}));})as typeof fetch});
 const m=await client.inspect(url);assert.equal(requests,1);assert.equal(m.allowed,true);assert.doesNotMatch(JSON.stringify(m),/test-secret|signed|download\/|Authorization/);
});
test("safe errors and not-found; download URL/size/type restrictions and license recheck",async()=>{
 for(const status of [401,403,404,429,500]){const client=createSketchfabClient({token:"test",fetcher:(async()=>new Response("private-upstream-body",{status}))as typeof fetch});await assert.rejects(client.inspect(url),{code:status===404?"SKETCHFAB_NOT_FOUND":status===429?"SKETCHFAB_RATE_LIMITED":status===401||status===403?"SKETCHFAB_UNAUTHORIZED":"SKETCHFAB_UNAVAILABLE"});}
 for(const unsafe of ["http://media.sketchfab.com/archives/x","https://127.0.0.1/archives/x","https://evil.s3.amazonaws.com/archives/x","https://sketchfab-prod-media.s3.amazonaws.com/not-archives/x"])assert.throws(()=>allowedDownloadUrl(unsafe),{code:"DOWNLOAD_FAILED"});
 for(const scenario of ["license","size","html","stream"]){let count=0;const client=createSketchfabClient({accessToken:"test",fetcher:(async()=>{count++;if(count===1)return Response.json(model(scenario==="license"?{license:{slug:"st",label:"Standard"}}:{}));if(count===2)return Response.json({glb:{url:"https://sketchfab-prod-media.s3.amazonaws.com/archives/x?signature=private",size:scenario==="size"?MAX_SOURCE_BYTES+1:100}});return new Response("<html>upstream error</html>",{headers:scenario==="stream"?{"content-length":String(MAX_SOURCE_BYTES+1),"content-type":"application/octet-stream"}:{"content-type":"text/html"}});})as typeof fetch});
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
 await assert.rejects(createSketchfabClient({token:"",accessToken:"",fetcher:(async()=>{assert.fail("missing credentials must not call provider");})as typeof fetch}).download(inspectMetadata(model(),uid)),{code:"SKETCHFAB_TOKEN_MISSING"});
});
test("Sketchfab Authorization header: personal API token as Token (downloads too), Bearer only for a real OAuth token, one Token retry after a Bearer 401",async()=>{
 const P="0123456789abcdef0123456789abcdef",O="oauthFixtureToken01"; // test-only values; P is shaped like a personal API token
 assert.deepEqual(sketchfabAuthorizations({apiToken:P}),[`Token ${P}`]);
 assert.deepEqual(sketchfabAuthorizations({apiToken:P,accessToken:P}),[`Token ${P}`],"the personal token copied into SKETCHFAB_ACCESS_TOKEN is never sent as Bearer");
 assert.deepEqual(sketchfabAuthorizations({accessToken:P}),[`Token ${P}`],"a personal-token-shaped value alone still uses Token");
 assert.deepEqual(sketchfabAuthorizations({accessToken:O}),[`Bearer ${O}`]);
 assert.deepEqual(sketchfabAuthorizations({apiToken:P,accessToken:O}),[`Bearer ${O}`,`Token ${P}`]);
 assert.deepEqual(sketchfabAuthorizations({apiToken:" ",accessToken:""}),[]);
 // a download with the personal token only: metadata and download link both as Token; the signed file URL gets no credential
 const seen:string[]=[];
 const client=createSketchfabClient({token:P,accessToken:"",fetcher:(async(request,options)=>{const u=String(request);
  if(u.startsWith("https://api.sketchfab.com/")){seen.push((options?.headers as any).Authorization);return u.endsWith("/download")?Response.json({glb:{url:"https://sketchfab-prod-media.s3.amazonaws.com/archives/x.glb",size:16}}):Response.json(model());}
  assert.equal((options?.headers as any)?.Authorization,undefined);return new Response(Buffer.from("glTF-fixture-bytes"),{headers:{"content-type":"application/octet-stream"}});})as typeof fetch});
 const d=await client.download(inspectMetadata(model(),uid));
 assert.equal(d.format,"glb");assert.deepEqual(seen,[`Token ${P}`,`Token ${P}`]);
 assert.equal(d.metadata.author,"Fixture artist");assert.equal(d.metadata.licenseClass,"CC BY","creator + licence kept for the attribution");
 // Bearer refused: the same call once more with the personal token
 const tries:string[]=[];
 const retry=createSketchfabClient({token:P,accessToken:O,fetcher:(async(_r,o)=>{const a=(o?.headers as any).Authorization;tries.push(a);return a.startsWith("Bearer")?new Response("refused",{status:401}):Response.json(model());})as typeof fetch});
 assert.equal((await retry.inspect(url)).uid,uid);assert.deepEqual(tries,[`Bearer ${O}`,`Token ${P}`]);
 // both refused: exactly one retry, then the safe error (no token in it)
 let n=0;const err=await createSketchfabClient({token:P,accessToken:O,fetcher:(async()=>{n++;return new Response("private",{status:401});})as typeof fetch}).inspect(url).catch(e=>e);
 assert.equal(err.code,"SKETCHFAB_UNAUTHORIZED");assert.equal(n,2);assert.doesNotMatch(String(err.message),new RegExp(`${P}|${O}`));
 // a Bearer 403 (no download access) is not retried
 let m=0;await assert.rejects(createSketchfabClient({token:P,accessToken:O,fetcher:(async()=>{m++;return new Response("x",{status:403});})as typeof fetch}).inspect(url),{code:"SKETCHFAB_UNAUTHORIZED"});assert.equal(m,1);
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
test("import DTO always sends paint lists and optimization warnings as arrays (a config saved before validation has no paintNodes)",()=>{
 const row=(patch:any)=>({id:"i",generationId:"g",importStage:"FAILED",errorCode:"VALIDATION_REJECTED",sourceProvider:"SKETCHFAB",sourceUid:uid,sourceMetadata:{optimization:{removed:3}},
   rawModelPath:`${"0".repeat(36)}.glb`,privateModelPath:null,generation:{model3dKey:null,code:"W202",yearFrom:1993,yearTo:2000,vehicle:{make:"Mercedes-Benz",model:"C-Class"}},...patch});
 const r=importShape(row({viewerConfig:{lengthM:4.5,rotateY:-Math.PI/2,rimsSwappable:false,paintMaterials:["carpaint"]}}));
 assert.deepEqual(r.viewerConfig.paintNodes,[]);assert.deepEqual(r.viewerConfig.paintMaterials,["carpaint"]);assert.equal(r.viewerConfig.lengthM,4.5);
 assert.deepEqual(r.provenance!.optimization.warnings,[]);
 assert.deepEqual(importShape(row({viewerConfig:{paintNodes:"x"}})).viewerConfig.paintMaterials,[]);
 assert.equal(importShape(row({viewerConfig:null,sourceMetadata:{}})).viewerConfig,null);
 assert.equal(importShape(row({viewerConfig:null,sourceMetadata:{}})).provenance!.optimization,null);
});
test("a failed import keeps a safe reason: our own text and numbers only; the viewer check keeps only its known reasons; shown only while FAILED",async()=>{
 const d=new Document(),b=d.createBuffer();
 d.createScene().addChild(d.createNode().setMesh(d.createMesh().addPrimitive(d.createPrimitive().setAttribute("POSITION",d.createAccessor().setType("VEC3").setArray(new Float32Array([0,0,0,1,0,0,0,1,1])).setBuffer(b)))));
 const tooMany=await readSafeGLB(Buffer.from(await new NodeIO().writeBinary(d)),0).catch(e=>e);
 assert.deepEqual(failureDetail("VALIDATING",tooMany),{stage:"VALIDATING",message:"Model needs nonzero geometry and at most 0 triangles.",triangles:1,limit:0});
 assert.deepEqual(failureDetail("CONVERTING",new Error("C:/private/stack")),{stage:"CONVERTING",message:null});
 assert.deepEqual(failureDetail("VALIDATING",new Vehicle3DError(422,"X","Plain text.",undefined,{triangles:5,path:"C:/private/a.glb",bad:NaN})),{stage:"VALIDATING",message:"Plain text.",triangles:5});
 assert.equal(viewerFailure({stderr:"file:///C:/repo/x.mjs:30\nError: Protected surfaces were selected for body paint\n    at C:/repo/x.mjs"}),"Protected surfaces were selected for body paint");
 assert.equal(viewerFailure({killed:true,stderr:""}),"The 3D viewer check timed out.");
 assert.equal(viewerFailure({stderr:"Error: ENOENT C:/private/x.glb"}),"The production viewer could not render this asset.");
 const row=(importStage:string)=>({id:"i",generationId:"g",importStage,errorCode:"VALIDATION_REJECTED",sourceProvider:null,rawModelPath:`${"0".repeat(36)}.glb`,failureDetail:{stage:"VALIDATING",message:"m"},generation:{model3dKey:null,code:"W202",yearFrom:1993,yearTo:2000,vehicle:{make:"M",model:"C"}}});
 assert.deepEqual(importShape(row("FAILED")).failureDetail,{stage:"VALIDATING",message:"m"});
 assert.deepEqual(importShape(row("DRAFT")).failureDetail,{stage:"VALIDATING",message:"m"});
 assert.equal(importShape(row("QUEUED")).failureDetail,null);
});
test("heavy models are simplified for phones: the budget is reached, small parts and materials are kept, light models are untouched",async()=>{
 const car=()=>{
  const d=new Document(),b=d.createBuffer();
  const sheet=(n:number,mat:string)=>{const pos:number[]=[],idx:number[]=[];
   for(let y=0;y<=n;y++)for(let x=0;x<=n;x++)pos.push(x/n,Math.sin(x/n*6)*0.1+Math.cos(y/n*5)*0.1,y/n);
   for(let y=0;y<n;y++)for(let x=0;x<n;x++){const a=y*(n+1)+x;idx.push(a,a+1,a+n+1,a+1,a+n+2,a+n+1);}
   const up=new Float32Array(pos.length);for(let i=1;i<up.length;i+=3)up[i]=1; // normals: the normal-aware path
   return d.createPrimitive().setMaterial(d.createMaterial(mat)).setAttribute("POSITION",d.createAccessor().setType("VEC3").setArray(new Float32Array(pos)).setBuffer(b)).setAttribute("NORMAL",d.createAccessor().setType("VEC3").setArray(up).setBuffer(b)).setIndices(d.createAccessor().setType("SCALAR").setArray(new Uint32Array(idx)).setBuffer(b));};
  const body=d.createMesh("body").addPrimitive(sheet(150,"carpaint")),badge=d.createMesh("badge").addPrimitive(sheet(7,"chrome"));
  d.createScene().addChild(d.createNode("body").setMesh(body)).addChild(d.createNode("badge").setMesh(badge));
  return {d,badge};
 };
 const {d,badge}=car(),r=await simplifyForPhones(d,10_000);
 assert.equal(r!.before,150*150*2+7*7*2);assert.ok(r!.after<=10_000,`after ${r!.after}`);
 assert.equal(badge.listPrimitives()[0]!.getIndices()!.getCount()/3,98,"small parts stay as they are");
 assert.deepEqual(d.getRoot().listMaterials().map(m=>m.getName()).sort(),["carpaint","chrome"]);
 assert.equal(await simplifyForPhones(d,1_000_000),null,"a model within the budget is untouched");
 const glb=Buffer.from(await new NodeIO().writeBinary(car().d)),fit=await fitForPhones(glb,10_000);
 assert.ok(fit.simplified&&fit.simplified.after<=10_000);assert.ok((await readSafeGLB(fit.bytes,10_000)).triangles<=10_000,"the simplified GLB is valid and within the budget");
 assert.equal((await fitForPhones(glb,1_000_000)).bytes,glb,"the same bytes when it already fits");
});
