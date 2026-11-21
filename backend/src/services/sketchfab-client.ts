import {fail, digest, Vehicle3DError} from "./vehicle3d-validation.js";

export const MAX_SOURCE_BYTES = 128 * 1024 * 1024;
export type AcceptedLicense = "CC0" | "CC BY" | "CC BY-SA";
export type SketchfabInspection = {
  uid: string; title: string; author: string; authorUrl: string | null; url: string;
  thumbnail: string | null; license: string; licenseUrl: string | null;
  licenseClass: AcceptedLicense | null; downloadable: boolean; allowed: boolean;
  refusalCode: "NOT_DOWNLOADABLE" | "LICENSE_NOT_ALLOWED" | null; inspectedAt: string;
};
/** Exact hosts and model-page paths only. Query/fragment are discarded, never fetched. */
export function parseSketchfabUrl(value: unknown): {uid: string; url: string} {
  if (typeof value !== "string" || value.length > 2000 || /[\x00-\x20\x7f\\]/.test(value.trim()))
    return fail("INVALID_SKETCHFAB_URL", "Enter a valid Sketchfab model URL.");
  let u: URL;
  try { u = new URL(value.trim()); } catch { return fail("INVALID_SKETCHFAB_URL", "Enter a valid Sketchfab model URL."); }
  if (u.protocol !== "https:" || !["sketchfab.com", "www.sketchfab.com"].includes(u.hostname) || u.port || u.username || u.password)
    return fail("INVALID_SKETCHFAB_URL", "Enter a valid Sketchfab model URL.");
  const segment = u.pathname.match(/^\/3d-models\/([^/]+)\/?$/)?.[1];
  let slug = "";
  try { slug = segment ? decodeURIComponent(segment) : ""; } catch { /* Invalid escaping is an invalid model URL. */ }
  const match = !/[\/\\\x00-\x20\x7f]/.test(slug) ? slug.match(/(?:^|-)([a-f0-9]{32})$/i) : null;
  if (!match) return fail("INVALID_SKETCHFAB_URL", "Enter a valid Sketchfab model URL.");
  const uid = match[1]!.toLowerCase();
  return {uid, url: `https://sketchfab.com/3d-models/${uid}`};
}
const text = (s: unknown, max = 200) => typeof s === "string" ? s.replace(/[\x00-\x1f\x7f]/g, " ").trim().slice(0,max) : "";
function safeUrl(value: unknown, hosts: readonly string[]): string | null {
  try { const u = new URL(String(value)); return u.protocol === "https:" && !u.username && !u.password && !u.port && !u.search && hosts.includes(u.hostname) ? u.href : null; } catch { return null; }
}
/** Recognize complete identifiers, never permissive prefix matches (BY-NC must not become BY). */
export function classifyLicense(license: unknown): AcceptedLicense | null {
  if (!license || typeof license !== "object") return null;
  const l = license as Record<string, unknown>;
  const slug = text(l.slug).toLowerCase().replace(/_/g,"-");
  const fromSlug: AcceptedLicense | null = /^(?:cc0|cc-zero)(?:-1[.]0)?$/.test(slug) ? "CC0"
    : /^(?:cc-)?by(?:-(?:1[.]0|2[.][05]|3[.]0|4[.]0))?$/.test(slug) ? "CC BY"
    : /^(?:cc-)?by-sa(?:-(?:1[.]0|2[.][05]|3[.]0|4[.]0))?$/.test(slug) ? "CC BY-SA" : null;
  const url = text(l.url,1000);
  let fromUrl: AcceptedLicense | null = null;
  if (url) {
    try { const u = new URL(url); if (!["http:","https:"].includes(u.protocol) || u.hostname !== "creativecommons.org" || u.username || u.password || u.port || u.search || u.hash) return null;
      fromUrl = /^\/publicdomain\/zero\/1\.0\/?$/.test(u.pathname) ? "CC0"
        : /^\/licenses\/by\/(?:1\.0|2\.[05]|3\.0|4\.0)\/?$/.test(u.pathname) ? "CC BY"
        : /^\/licenses\/by-sa\/(?:1\.0|2\.[05]|3\.0|4\.0)\/?$/.test(u.pathname) ? "CC BY-SA" : null;
    } catch { return null; }
    if (!fromUrl) return null;
  }
  // Contradictory evidence is refused, including an explicitly unsupported slug with an allowed URL.
  if (slug && !fromSlug || fromSlug && fromUrl && fromSlug !== fromUrl) return null;
  const label = text(l.label).toLowerCase();
  if (/non.?commercial|no.?deriv|\bnc\b|\bnd\b|editorial|proprietary|standard|all.rights/.test(label)) return null;
  return fromSlug ?? fromUrl;
}
export function inspectMetadata(m: any, uid: string, now = new Date()): SketchfabInspection {
  if (m?.uid !== uid || !text(m.name) || !text(m.user?.displayName ?? m.user?.username))
    return fail("SKETCHFAB_UNAVAILABLE", "Sketchfab returned invalid model metadata.",502);
  const licenseClass = classifyLicense(m.license), downloadable = m.isDownloadable === true;
  const paid = typeof m.price === "number" && m.price > 0 || m.isPurchasable === true;
  const refusalCode = !downloadable ? "NOT_DOWNLOADABLE" : !licenseClass || paid ? "LICENSE_NOT_ALLOWED" : null;
  const licenseUrl = text(m.license?.url,1000);
  const thumbnail = (Array.isArray(m.thumbnails?.images) ? [...m.thumbnails.images] : [])
    .sort((a,b)=>Math.abs((a.width??0)-640)-Math.abs((b.width??0)-640))
    .map(i=>safeUrl(i.url,["media.sketchfab.com","media.sketchfab.com.cdn.cloudflare.net"])).find(Boolean) ?? null;
  return {uid,title:text(m.name),author:text(m.user.displayName ?? m.user.username),
    authorUrl:safeUrl(m.user.profileUrl,["sketchfab.com","www.sketchfab.com"]),
    url:safeUrl(m.viewerUrl,["sketchfab.com","www.sketchfab.com"]) ?? `https://sketchfab.com/3d-models/${uid}`,
    thumbnail,license:text(m.license?.label) || text(m.license?.slug) || "Unknown",
    licenseUrl:/^https?:\/\/creativecommons\.org\//.test(licenseUrl)?licenseUrl:null,
    licenseClass,downloadable,allowed:!refusalCode,refusalCode,inspectedAt:now.toISOString()};
}
export function assertImportAllowed(m: SketchfabInspection) {
  if (!m.downloadable) return fail("MODEL_NOT_DOWNLOADABLE", "This model is not downloadable through Sketchfab.",409);
  if (!m.allowed || !m.licenseClass) return fail("LICENSE_NOT_ALLOWED", "This model cannot be imported because its license does not allow the required use.",409);
}
/** Only download hosts documented/used by Sketchfab. No arbitrary S3 bucket or user-supplied URL. */
export function allowedDownloadUrl(value: unknown): URL {
  let u: URL; try { u = new URL(String(value)); } catch { return fail("DOWNLOAD_FAILED","Sketchfab did not provide a supported download.",502); }
  if (u.protocol !== "https:" || u.username || u.password || u.port || u.hash ||
      !["sketchfab-prod-media.s3.amazonaws.com","sketchfab-prod-media.s3.eu-west-1.amazonaws.com","media.sketchfab.com"].includes(u.hostname) ||
      !u.pathname.startsWith("/archives/")) return fail("DOWNLOAD_FAILED","Sketchfab did not provide a supported download.",502);
  return u;
}
async function bounded(response: Response, max: number, code: string): Promise<Buffer> {
  if (Number(response.headers.get("content-length")) > max) { await response.body?.cancel(); return fail(code,"The Sketchfab response exceeds the permitted size.",413); }
  if (!response.body) return fail("DOWNLOAD_FAILED","The Sketchfab download failed.",502);
  const reader=response.body.getReader(), chunks:Uint8Array[]=[]; let size=0;
  try { for (;;) { const {done,value}=await reader.read(); if(done)break; size+=value.byteLength;
    if(size>max)return fail(code,"The Sketchfab response exceeds the permitted size.",413); chunks.push(value); }
  } finally { await reader.cancel().catch(()=>{}); reader.releaseLock(); }
  return Buffer.concat(chunks,size);
}
export function createSketchfabClient(options: {token?: string; accessToken?: string; fetcher?: typeof fetch} = {}) {
  const fetcher=options.fetcher??fetch;
  const api=async(endpoint:string)=>{
    const oauth=(options.accessToken??(options.token===undefined?process.env.SKETCHFAB_ACCESS_TOKEN:undefined))?.trim();
    const token=(options.token??process.env.SKETCHFAB_API_TOKEN)?.trim();
    // Sketchfab's Download API requires OAuth. A personal API token remains valid for metadata inspection.
    const download=endpoint.endsWith('/download');
    if (!oauth && (download || !token)) return fail("SKETCHFAB_TOKEN_MISSING",download?"Set the backend Sketchfab OAuth access token before downloading.":"Sketchfab credentials are missing from the backend.",503);
    try {
      const r=await fetcher(`https://api.sketchfab.com/v3/${endpoint}`,{headers:{Authorization:oauth?`Bearer ${oauth}`:`Token ${token}`},redirect:"error",signal:AbortSignal.timeout(20000)});
      if(r.status===404)return fail("SKETCHFAB_NOT_FOUND","Unable to read this Sketchfab model.",404);
      if(r.status===401||r.status===403)return fail("SKETCHFAB_UNAUTHORIZED","Sketchfab rejected the backend credential. Check its type, expiry and download access.",502);
      if(r.status===429)return fail("SKETCHFAB_RATE_LIMITED","Sketchfab is rate limiting requests. Try again later.",429);
      if(!r.ok)return fail("SKETCHFAB_UNAVAILABLE","Sketchfab is temporarily unavailable.",502);
      const body=await bounded(r,1024*1024,"SKETCHFAB_UNAVAILABLE");
      try{return JSON.parse(body.toString("utf8"));}catch{return fail("SKETCHFAB_UNAVAILABLE","Sketchfab returned an invalid response.",502);}
    } catch(e) {
      if (e instanceof Vehicle3DError) throw e;
      const cause=(e as {cause?:{code?:string};code?:string})?.cause?.code??(e as {code?:string})?.code;
      console.warn("Sketchfab transport failed.",{operation:download?"download-link":"metadata",cause:typeof cause==="string"&&/^[A-Z0-9_]{1,60}$/.test(cause)?cause:"timeout-or-network"});
      return fail("NETWORK_ERROR","The backend could not connect to Sketchfab.",502);
    }
  };
  return {
    inspect:async(value:unknown)=>{const {uid}=parseSketchfabUrl(value);return inspectMetadata(await api(`models/${uid}`),uid);},
    download:async(inspection:SketchfabInspection)=>{
      // Fresh evidence immediately before requesting any download. Signed URLs never leave this closure.
      const current=inspectMetadata(await api(`models/${inspection.uid}`),inspection.uid);assertImportAllowed(current);
      const links=await api(`models/${current.uid}/download`),format=links.glb?"glb":links.gltf?"gltf":null;
      if(!format)return fail("CONVERSION_FAILED","Sketchfab has no supported GLB or glTF download.",422);
      const link=links[format]; if (Number(link.size)>MAX_SOURCE_BYTES)return fail("DOWNLOAD_TOO_LARGE","The Sketchfab download exceeds the source size limit.",413);
      const url=allowedDownloadUrl(link.url);
      try {
        const response=await fetcher(url,{redirect:"error",signal:AbortSignal.timeout(120000)});
        if(!response.ok || /text\/|html|json/i.test(response.headers.get("content-type")??""))return fail("DOWNLOAD_FAILED","The Sketchfab download failed.",502);
        const bytes=await bounded(response,MAX_SOURCE_BYTES,"DOWNLOAD_TOO_LARGE");
        if (bytes.length<4 || bytes.subarray(0,4).toString()!=="glTF" && bytes.readUInt16LE(0)!==0x4b50)return fail("ARCHIVE_INVALID","The Sketchfab download is not a supported asset.",422);
        return {bytes,format,metadata:current,downloadedAt:new Date().toISOString(),downloadSource:`https://api.sketchfab.com/v3/models/${current.uid}/download`,sourceSha256:digest(bytes)};
      }catch(e){if(e instanceof Error&&"code" in e)throw e;return fail("DOWNLOAD_FAILED","The Sketchfab download failed.",502);}
    }
  };
}
