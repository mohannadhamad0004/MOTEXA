import {fail, digest, Vehicle3DError} from "./vehicle3d-validation.js";

export const MAX_SOURCE_BYTES = 128 * 1024 * 1024;
/** Every Creative Commons license the classifier recognises (what the model says it is). */
export type CcLicense = "CC0" | "CC BY" | "CC BY-SA" | "CC BY-ND" | "CC BY-NC" | "CC BY-NC-SA" | "CC BY-NC-ND";
/** The ones MOTEXA may use: it simplifies the model (a derivative) and shows it in a commercial app, so NonCommercial (NC) and
 *  NoDerivatives (ND) are refused. CC BY / CC BY-SA keep the creator credit (and BY-SA its license) on the simplified copy. */
export type AcceptedLicense = "CC0" | "CC BY" | "CC BY-SA";
export const ACCEPTED_LICENSES: readonly AcceptedLicense[] = ["CC0", "CC BY", "CC BY-SA"];
export const isAcceptedLicense = (c: string | null | undefined): c is AcceptedLicense => !!c && (ACCEPTED_LICENSES as readonly string[]).includes(c);
export const LICENSE_RESTRICTED_TEXT = "This license doesn't allow MOTEXA to simplify or show the model commercially. Choose a model with a CC0, CC BY or CC BY-SA license.";
export type SketchfabInspection = {
  uid: string; title: string; author: string; authorUrl: string | null; url: string;
  thumbnail: string | null; license: string; licenseUrl: string | null;
  /** the license as classified (also a refused NC / ND one, so the screen can name it); allowed only for ACCEPTED_LICENSES */
  licenseClass: CcLicense | null; downloadable: boolean; allowed: boolean;
  refusalCode: "NOT_DOWNLOADABLE" | "LICENSE_NOT_ALLOWED" | "LICENSE_RESTRICTED" | null; inspectedAt: string;
  /** Sketchfab's face count: shown as info only, never a reason to refuse (heavy models are simplified for phones). */
  triangles: number | null;
  /** the model's Sketchfab tags (plain text, at most 30): the app suggests the car's brand / model / generation from them and the title */
  tags: string[];
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
/** Which Creative Commons license (CC0 and every CC BY variant) from complete identifiers, never permissive prefix matches.
 *  Sketchfab Standard / Editorial, unknown and contradictory evidence are null. Whether MOTEXA may use it: isAcceptedLicense. */
const CC_SLUG = /^(?:cc-)?(by(?:-nc)?(?:-sa|-nd)?)(?:-(?:1[.]0|2[.][05]|3[.]0|4[.]0))?$/;
const CC_PATH = /^\/licenses\/(by(?:-nc)?(?:-sa|-nd)?)\/(?:1\.0|2\.[05]|3\.0|4\.0)\/?$/;
export function classifyLicense(license: unknown): CcLicense | null {
  if (!license || typeof license !== "object") return null;
  const l = license as Record<string, unknown>;
  const slug = text(l.slug).toLowerCase().replace(/_/g,"-"), bySlug = CC_SLUG.exec(slug);
  const fromSlug: CcLicense | null = /^(?:cc0|cc-zero)(?:-1[.]0)?$/.test(slug) ? "CC0" : bySlug ? `CC ${bySlug[1]!.toUpperCase()}` as CcLicense : null;
  const url = text(l.url,1000);
  let fromUrl: CcLicense | null = null;
  if (url) {
    try { const u = new URL(url); if (!["http:","https:"].includes(u.protocol) || u.hostname !== "creativecommons.org" || u.username || u.password || u.port || u.search || u.hash) return null;
      const byUrl = CC_PATH.exec(u.pathname);
      fromUrl = /^\/publicdomain\/zero\/1\.0\/?$/.test(u.pathname) ? "CC0" : byUrl ? `CC ${byUrl[1]!.toUpperCase()}` as CcLicense : null;
    } catch { return null; }
    if (!fromUrl) return null;
  }
  // Contradictory evidence is refused, including an explicitly unsupported slug with an allowed URL.
  if (slug && !fromSlug || fromSlug && fromUrl && fromSlug !== fromUrl) return null;
  const found = fromSlug ?? fromUrl, label = text(l.label).toLowerCase();
  if (/editorial|proprietary|standard|all.rights/.test(label)) return null;
  // a label that claims NonCommercial / NoDerivatives the identifier does not have is a contradiction too
  if (found && (/non.?commercial|\bnc\b/.test(label) && !found.includes("NC") || /no.?deriv|\bnd\b/.test(label) && !found.includes("ND"))) return null;
  return found;
}
export function inspectMetadata(m: any, uid: string, now = new Date()): SketchfabInspection {
  if (m?.uid !== uid || !text(m.name) || !text(m.user?.displayName ?? m.user?.username))
    return fail("SKETCHFAB_UNAVAILABLE", "Sketchfab returned invalid model metadata.",502);
  const licenseClass = classifyLicense(m.license), downloadable = m.isDownloadable === true;
  const paid = typeof m.price === "number" && m.price > 0 || m.isPurchasable === true;
  const refusalCode = !downloadable ? "NOT_DOWNLOADABLE" : !licenseClass || paid ? "LICENSE_NOT_ALLOWED" : !isAcceptedLicense(licenseClass) ? "LICENSE_RESTRICTED" : null;
  const licenseUrl = text(m.license?.url,1000);
  const thumbnail = (Array.isArray(m.thumbnails?.images) ? [...m.thumbnails.images] : [])
    .sort((a,b)=>Math.abs((a.width??0)-640)-Math.abs((b.width??0)-640))
    .map(i=>safeUrl(i.url,["media.sketchfab.com","media.sketchfab.com.cdn.cloudflare.net"])).find(Boolean) ?? null;
  return {uid,title:text(m.name),author:text(m.user.displayName ?? m.user.username),
    authorUrl:safeUrl(m.user.profileUrl,["sketchfab.com","www.sketchfab.com"]),
    url:safeUrl(m.viewerUrl,["sketchfab.com","www.sketchfab.com"]) ?? `https://sketchfab.com/3d-models/${uid}`,
    thumbnail,license:text(m.license?.label) || text(m.license?.slug) || "Unknown",
    licenseUrl:/^https?:\/\/creativecommons\.org\//.test(licenseUrl)?licenseUrl:null,
    licenseClass,downloadable,allowed:!refusalCode,refusalCode,inspectedAt:now.toISOString(),
    triangles:Number.isSafeInteger(m.faceCount)&&m.faceCount>0?m.faceCount:null,
    tags:[...new Set<string>((Array.isArray(m.tags)?m.tags:[]).map((x:any)=>text(typeof x==="string"?x:x?.name??x?.slug,60)).filter(Boolean))].slice(0,30)};
}
export function assertImportAllowed(m: SketchfabInspection) {
  if (!m.downloadable) return fail("MODEL_NOT_DOWNLOADABLE", "The creator has not allowed downloads of this model on Sketchfab, so MOTEXA cannot import it.",409);
  if (m.licenseClass && !isAcceptedLicense(m.licenseClass)) return fail("LICENSE_RESTRICTED", LICENSE_RESTRICTED_TEXT, 409);
  if (!m.allowed || !isAcceptedLicense(m.licenseClass)) return fail("LICENSE_NOT_ALLOWED", "This model does not have a Creative Commons license, so MOTEXA cannot use it. Choose a model with a CC0, CC BY or CC BY-SA license.",409);
}
/** The credit written into the simplified copy (glTF asset.copyright): creator, source, license; CC BY-SA also states that the adaptation
 *  keeps the same license. */
export function attributionText(c: {title: string; author: string; url: string; license: string; licenseClass?: string | null; licenseUrl?: string | null}): string {
  const license = c.licenseClass ?? c.license, link = c.licenseUrl ? ` (${c.licenseUrl})` : "";
  const sa = c.licenseClass === "CC BY-SA" ? " This adapted copy (simplified for phones by MOTEXA) is licensed under the same CC BY-SA license." : " Simplified for phones by MOTEXA.";
  return `"${c.title}" by ${c.author} (${c.url}), licensed under ${license}${link}.${sa}`.slice(0, 1000);
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
/** The Authorization values to try, in order (never logged). A personal API token (SKETCHFAB_API_TOKEN) always uses the "Token" scheme:
 *  Sketchfab answers 401 to it as "Bearer", downloads included. "Bearer" only for a real OAuth access token (SKETCHFAB_ACCESS_TOKEN), never
 *  for the personal token copied into it; after a Bearer 401 the personal token is tried once. */
export function sketchfabAuthorizations(creds: {apiToken?: string | null; accessToken?: string | null}): string[] {
  const personal = creds.apiToken?.trim() || null, access = creds.accessToken?.trim() || null;
  // ponytail: "is a personal token" = the same value as the API token, or its shape (32 hex characters); the 401 retry covers a wrong guess
  const oauth = access && access !== personal && !/^[a-f0-9]{32}$/i.test(access) ? access : null;
  const token = personal ?? (access && !oauth ? access : null);
  return [...(oauth ? [`Bearer ${oauth}`] : []), ...(token ? [`Token ${token}`] : [])];
}
export function createSketchfabClient(options: {token?: string; accessToken?: string; fetcher?: typeof fetch} = {}) {
  const fetcher=options.fetcher??fetch;
  const api=async(endpoint:string)=>{
    const auths=sketchfabAuthorizations({apiToken:options.token??process.env.SKETCHFAB_API_TOKEN,accessToken:options.accessToken??(options.token===undefined?process.env.SKETCHFAB_ACCESS_TOKEN:undefined)});
    const download=endpoint.endsWith('/download');
    if (!auths.length) return fail("SKETCHFAB_TOKEN_MISSING","Sketchfab credentials are missing from the backend.",503);
    try {
      let r!: Response;
      for (const [i,auth] of auths.entries()) {
        r=await fetcher(`https://api.sketchfab.com/v3/${endpoint}`,{headers:{Authorization:auth},redirect:"error",signal:AbortSignal.timeout(20000)});
        if (r.status!==401 || i===auths.length-1) break;
        await r.body?.cancel().catch(()=>{}); // Bearer refused: once more with the personal token (Token scheme)
      }
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
