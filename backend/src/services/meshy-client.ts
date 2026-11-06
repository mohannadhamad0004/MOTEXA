// Official contract: https://docs.meshy.ai/en/api/multi-image-to-3d (1-4 images: vehicles send 4 views, accessories 2-4 part photos)
// No raw provider errors, signed URLs, image data or credentials leave this module via exceptions.
export type MeshyState = "PENDING" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | "CANCELED";
export type MeshyTask = { id: string; status: MeshyState; progress: number | null; glb?: string;
  createdAt: Date | null; startedAt: Date | null; finishedAt: Date | null; errorCode?: string };
export class MeshyError extends Error {
  constructor(public code: string, public retryable = false, public retryAfterSeconds = 15) { super(code); }
}
const date = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n > 0 && n < 8.64e15 ? new Date(n) : null;
const taskId = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 150 && !/[\x00-\x20]/.test(v);
export function parseMeshyTask(v: any, expectedId: string): MeshyTask {
  if (!v || !taskId(v.id) || v.id !== expectedId || !["PENDING","IN_PROGRESS","SUCCEEDED","FAILED","CANCELED"].includes(v.status)) throw new MeshyError("PROVIDER_MALFORMED_RESPONSE");
  const progress = typeof v.progress === "number" && Number.isInteger(v.progress) && v.progress >= 0 && v.progress <= 100 ? v.progress : null;
  return { id: v.id, status: v.status, progress, glb: typeof v.model_urls?.glb === "string" ? v.model_urls.glb : undefined,
    createdAt: date(v.created_at), startedAt: date(v.started_at), finishedAt: date(v.finished_at),
    errorCode: typeof v.task_error?.type === "string" && /^[a-z0-9_]{1,80}$/i.test(v.task_error.type) ? v.task_error.type : undefined };
}
export function createMeshyClient(options: { key?: string; fetcher?: typeof fetch; maxBytes: number }) {
  const fetcher = options.fetcher ?? fetch;
  async function request(method: string, suffix = "", body?: unknown): Promise<any> {
    if (!options.key) throw new MeshyError("PROVIDER_KEY_MISSING");
    let response: Response;
    try {
      response = await fetcher(`https://api.meshy.ai/openapi/v1/multi-image-to-3d${suffix}`, {
        method, redirect: "error", signal: AbortSignal.timeout(30_000), headers: { Authorization: `Bearer ${options.key}`, "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch { throw new MeshyError("PROVIDER_TIMEOUT", method === "GET"); }
    if (!response.ok) {
      const codes: Record<number,string> = { 400:"PROVIDER_INVALID_INPUT",401:"PROVIDER_AUTH",402:"PROVIDER_CREDITS",403:"PROVIDER_FORBIDDEN",404:"PROVIDER_TASK_NOT_FOUND",429:"PROVIDER_RATE_LIMIT" };
      const retry = response.headers.get("retry-after");
      const seconds = retry && /^\d+$/.test(retry) ? Number(retry) : retry ? Math.ceil((Date.parse(retry)-Date.now())/1000) : 15;
      throw new MeshyError(codes[response.status] ?? "PROVIDER_UNAVAILABLE", method === "GET" && (response.status === 429 || response.status >= 500), Math.min(3600,Math.max(5,Number.isFinite(seconds)?seconds:15)));
    }
    try {
      const text = await response.text(); if (text.length > 256_000) throw new Error(); return JSON.parse(text);
    } catch { throw new MeshyError("PROVIDER_MALFORMED_RESPONSE"); }
  }
  return {
    async create(images: string[]) {
      if (images.length < 1 || images.length > 4 || images.some(i=>!i.startsWith("data:image/jpeg;base64,"))) throw new MeshyError("PROVIDER_INVALID_INPUT");
      let data:any;
      try {data=await request("POST", "", { image_urls: images, ai_model: "meshy-7.1", target_formats: ["glb"], should_texture: true, enable_pbr: true, target_polycount: 50_000 });}
      catch(error){if(error instanceof MeshyError&&["PROVIDER_TIMEOUT","PROVIDER_UNAVAILABLE","PROVIDER_MALFORMED_RESPONSE"].includes(error.code))throw new MeshyError("PROVIDER_REQUEST_UNCONFIRMED");throw error;}
      if (!taskId(data?.result)) throw new MeshyError("PROVIDER_REQUEST_UNCONFIRMED");
      return data.result as string;
    },
    async get(id: string) { if (!taskId(id)) throw new MeshyError("PROVIDER_TASK_NOT_FOUND"); return parseMeshyTask(await request("GET",`/${encodeURIComponent(id)}`),id); },
    async download(value: unknown): Promise<Buffer> {
      let url: URL;
      try { url = new URL(String(value)); } catch { throw new MeshyError("PROVIDER_DOWNLOAD_UNAVAILABLE",true); }
      if (url.protocol !== "https:" || url.hostname !== "assets.meshy.ai" || url.username || url.password || (url.port && url.port !== "443")) throw new MeshyError("PROVIDER_ASSET_HOST_REJECTED");
      let response: Response;
      try { response = await fetcher(url, { redirect:"error",signal:AbortSignal.timeout(30_000) }); }
      catch { throw new MeshyError("PROVIDER_DOWNLOAD_UNAVAILABLE",true); }
      if (!response.ok || !response.body) throw new MeshyError("PROVIDER_DOWNLOAD_UNAVAILABLE",true);
      if (Number(response.headers.get("content-length")) > options.maxBytes) throw new MeshyError("PROVIDER_ASSET_TOO_LARGE");
      const reader = response.body.getReader(), chunks: Buffer[]=[]; let size=0;
      try {
        while (true) { const part=await reader.read(); if(part.done)break; size+=part.value.length;
          if(size>options.maxBytes)throw new MeshyError("PROVIDER_ASSET_TOO_LARGE"); chunks.push(Buffer.from(part.value)); }
      } catch(error) { if(error instanceof MeshyError)throw error;throw new MeshyError("PROVIDER_DOWNLOAD_UNAVAILABLE",true); }
      finally { await reader.cancel().catch(()=>{}); }
      return Buffer.concat(chunks);
    },
  };
}
