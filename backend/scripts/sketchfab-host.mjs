// Run in normal HOST PowerShell. Credentials are read only from the process environment.
// node backend/scripts/sketchfab-host.mjs --auth
// node backend/scripts/sketchfab-host.mjs --search
// node backend/scripts/sketchfab-host.mjs --download --target=<pilot key> --uid=<searched UID>
import { existsSync, mkdirSync, readFileSync, writeFileSync, createWriteStream } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const STAGING = resolve(ROOT, '3d-source/sketchfab-candidates');
const PILOT = ['mercedes-c-class-w204','bmw-1-series-f20-f21','volkswagen-golf-mk7'];
export function authorization(env) {
  if (!env.SKETCHFAB_ACCESS_TOKEN?.trim()) throw new Error('MISSING_SKETCHFAB_ACCESS_TOKEN');
  return { Authorization: 'Bearer ' + env.SKETCHFAB_ACCESS_TOKEN.trim() };
}
export async function api(path, env=process.env, fetcher=fetch) {
  let response;
  try { response=await fetcher('https://api.sketchfab.com/v3/'+path,{headers:authorization(env),redirect:'error',signal:AbortSignal.timeout(20000)}); }
  catch(error) {
    if(error.message==='MISSING_SKETCHFAB_ACCESS_TOKEN') throw error;
    const code=error.cause?.code || error.code;
    throw new Error('NO_HTTP_RESPONSE: '+(['EACCES','ENOTFOUND','ECONNREFUSED','ETIMEDOUT'].includes(code)?code:'NETWORK_FAILURE'));
  }
  if(!response.ok) throw new Error(response.status===401?'HTTP_401_INVALID_OR_EXPIRED_TOKEN':response.status===403?'HTTP_403_AUTHORIZATION_DENIED':'HTTP_'+response.status);
  return response.json();
}
export function metadata(m) {
  return {uid:m.uid,title:m.name,creator:m.user?.username,creatorDisplayName:m.user?.displayName,creatorProfile:m.user?.profileUrl,
    sourceUrl:m.viewerUrl || `https://sketchfab.com/3d-models/${m.uid}`,license:m.license?.label,licenseSlug:m.license?.slug,
    downloadable:m.isDownloadable,triangles:m.faceCount,vertices:m.vertexCount,views:m.viewCount,likes:m.likeCount,publishedAt:m.publishedAt,
    generationVerified:false,bodyStyleVerified:false,visualReview:'PENDING',accessoryReadiness:'PENDING_RENDER'};
}
async function main() {
  const args=process.argv.slice(2), arg=name=>args.find(a=>a.startsWith('--'+name+'='))?.slice(name.length+3);
  const mode=args.includes('--auth')?'auth':args.includes('--search')?'search':args.includes('--download')?'download':null;
  if(!mode) throw new Error('Choose --auth, --search or --download');
  const audit=JSON.parse(readFileSync(resolve(ROOT,'3d-source/audit/vehicle-model-audit.json'),'utf8'));
  if(!audit.stageA?.complete) throw new Error('STAGE_A_NOT_COMPLETE');
  // Every invocation checks identity first. No profile data is logged or saved.
  await api('me');
  mkdirSync(STAGING,{recursive:true});
  writeFileSync(resolve(STAGING,'host-auth.json'),JSON.stringify({checkedAt:new Date().toISOString(),identity:'HTTP_200',downloadAuthorization:'NOT_YET_TESTED'})+'\n');
  console.log('Host identity authentication: HTTP 200.');
  if(mode==='auth') return;
  if(mode==='search') {
    for(const key of PILOT) {
      const e=audit.entries.find(e=>e.key===key);if(e?.status!=='REPLACE')throw new Error('TARGET_NOT_CONFIRMED_REPLACE');
      const body=key.startsWith('mercedes')?'sedan':'hatchback';
      const query=`${e.make} ${e.model} ${e.code} ${e.yearRange.replace(/[^0-9]+/g,' ')} ${body}`;
      const result=await api('search?'+new URLSearchParams({type:'models',q:query,downloadable:'true',count:'100'}));
      const considered=(result.results||[]).filter(m=>m.isDownloadable && ['cc0','by','by-sa'].includes(m.license?.slug) && m.uid !== e.source?.match(/[a-f0-9]{32}/)?.[0]).map(metadata);
      // Preserve all matching metadata; human generation review precedes choosing 3–5 serious candidates.
      const dir=resolve(STAGING,key);mkdirSync(dir,{recursive:true});
      writeFileSync(resolve(dir,'search.json'),JSON.stringify({query,searchedAt:new Date().toISOString(),results:considered},null,2)+'\n');
      console.log(key+': '+considered.length+' downloadable license-compatible results saved; generation review required.');
    }
    return;
  }
  const key=arg('target'),uid=arg('uid');
  if(!PILOT.includes(key)||!/^[a-f0-9]{32}$/.test(uid||''))throw new Error('INVALID_PILOT_TARGET_OR_UID');
  const search=JSON.parse(readFileSync(resolve(STAGING,key,'search.json'),'utf8'));
  if(!search.results.some(m=>m.uid===uid))throw new Error('UID_NOT_IN_LICENSE_FILTERED_SEARCH');
  const detail=await api('models/'+uid);
  if(!detail.isDownloadable||!['cc0','by','by-sa'].includes(detail.license?.slug))throw new Error('DOWNLOAD_OR_LICENSE_NOT_ALLOWED');
  // Signed links remain in memory and are never persisted or logged.
  const links=await api('models/'+uid+'/download');
  const format=links.glb?'glb':links.gltf?'gltf':null;
  if(!format)throw new Error('NO_SUPPORTED_GLTF_DOWNLOAD');
  const dir=resolve(STAGING,key,uid);mkdirSync(dir,{recursive:true});
  const file=resolve(dir,format==='glb'?'source.glb':'source-gltf.zip');
  if(existsSync(file))throw new Error('SOURCE_ALREADY_EXISTS_PRESERVED');
  const url=new URL(links[format].url);if(url.protocol!=='https:')throw new Error('NON_HTTPS_DOWNLOAD_REJECTED');
  let res;try{res=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(300000)});}catch{throw new Error('DOWNLOAD_NETWORK_FAILURE');}
  if(!res.ok||!res.body)throw new Error('DOWNLOAD_HTTP_'+res.status);
  // Exclusive create: existing source archives can never be overwritten.
  await pipeline(Readable.fromWeb(res.body),createWriteStream(file,{flags:'wx'}));
  writeFileSync(resolve(dir,'source.json'),JSON.stringify({...metadata(detail),format,downloadedAt:new Date().toISOString()},null,2)+'\n');
  console.log(key+' / '+uid+': source staged; preparation and visual comparison pending.');
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(/^(MISSING_SKETCHFAB_ACCESS_TOKEN|NO_HTTP_RESPONSE:|HTTP_[0-9]|STAGE_A_NOT_COMPLETE|Choose --|TARGET_NOT_CONFIRMED_REPLACE|INVALID_PILOT_TARGET_OR_UID|UID_NOT_IN_LICENSE_FILTERED_SEARCH|DOWNLOAD_OR_LICENSE_NOT_ALLOWED|NO_SUPPORTED_GLTF_DOWNLOAD|SOURCE_ALREADY_EXISTS_PRESERVED|NON_HTTPS_DOWNLOAD_REJECTED|DOWNLOAD_NETWORK_FAILURE|DOWNLOAD_HTTP_)/.test(error.message) ? error.message : 'HOST_OPERATION_FAILED: inspect local staging and retry after resolving the cause.');process.exitCode=1;});
