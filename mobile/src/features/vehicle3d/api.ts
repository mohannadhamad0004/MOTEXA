import { api, apiUrl } from "../../core/config/api";
import * as SessionStore from "../../components/SessionStore";
import type { CarModel } from "../car3d/models";

export const views = ["front", "rear", "left", "right"] as const;
export type ViewName = typeof views[number];
export type Submission = {
  id: string; garageCarId: string | null; make: string; model: string; generationName: string; generationId: string | null;
  initialApprovedAt?:string|null;
  year: number; updatedAt: string; status: "DRAFT" | "PROCESSING" | "READY" | "SUBMITTED" | "APPROVED" | "REJECTED" | "FAILED";
  submittedAt: string | null; createdAt: string; hasModel: boolean; generationMode: string | null; lengthM: number;
  photos: Record<ViewName, boolean>; reviewNotes: string | null; failureReason: string | null;
  validation: Record<string, unknown> | null; existingModel3dKey?: string | null; approvedModel3dKey: string | null;
  provider: "MESHY"|"MOCK"|null;providerState:string|null;providerProgress:number|null;generationStage:string;
  generationRevision:number;generationErrorCode:string|null;hasRawModel:boolean;photoRevision:string;modelRevision:string;
  preparationConfig:{preRotateX?:number;rotateY?:number}|null;
};
export const submissionBase = (admin = false) => admin ? "/admin/parts/vehicle-3d-submissions" : "/catalog/vehicle-3d-submissions";
export const submissionApi = {
  list: async (admin = false) => (await api<{submissions: Submission[]}>("GET", submissionBase(admin))).submissions,
  get: async (id: string, admin = false) => (await api<{submission: Submission}>("GET", `${submissionBase(admin)}/${id}`)).submission,
  create: async (garageCarId: string) => (await api<{submission: Submission}>("POST", submissionBase(), { garageCarId })).submission,
  photo: (id: string, view: ViewName, dataBase64: string) => api("PUT", `${submissionBase()}/${id}/photos/${view}`, { dataBase64 }),
  generate: (id: string) => api<{submission:{id:string}}>("POST", `${submissionBase()}/${id}/generate`, { processingConsent: true,redistributionConsent:true }),
  submit: (id: string) => api("POST", `${submissionBase()}/${id}/submit`, { redistributionConsent: true }),
  remove: (id: string) => api("DELETE", `${submissionBase()}/${id}`),
  regenerate: (id:string)=>api("POST",`${submissionBase()}/${id}/regenerate`),
  validate: (id:string,config?:{preRotateX?:number;rotateY?:number})=>api("POST",`${submissionBase(true)}/${id}/validate`,config?{config}:{}),
  requestRegeneration: (id:string,notes:string)=>api("POST",`${submissionBase(true)}/${id}/request-regeneration`,{notes}),
  review: (id: string, action: "approve" | "reject", body: unknown) => api("POST", `${submissionBase(true)}/${id}/${action}`, body),
};
/** Authenticated binary fetch, kept only in this screen's memory. No query tokens or public/private disk cache. */
export async function privateAssetBase64(id: string, asset: string, admin: boolean) {
  return authenticatedBase64(`${submissionBase(admin)}/${id}/assets/${asset}`);
}
export async function authenticatedBase64(path:string){
  const token = await SessionStore.getItemAsync("motexa_access_token");
  const response = await fetch(apiUrl(path), { headers: { Authorization: `Bearer ${token ?? ""}` }, cache: "no-store" });
  if (!response.ok) throw new Error("Private asset unavailable");
  const bytes = new Uint8Array(await response.arrayBuffer()); let raw = "";
  for (let i = 0; i < bytes.length; i += 0x8000) raw += String.fromCharCode(...bytes.subarray(i,i+0x8000));
  return btoa(raw);
}
export function submissionModel(s: Pick<Submission,"id"|"make"|"model"|"generationName"|"lengthM">): CarModel {
  const none = { x: 0, y: 0, z: 0, scale: 1 };
  return { key: `private-${s.id}`, generation: `${s.make} ${s.model} ${s.generationName}`, lengthM: s.lengthM,
    rotateY: 0, groundOffset: 0, paintNodes: [], paintMaterials: [], rimsSwappable: false, wing: none, rack: none,
    credit: { title: "", author: "", url: "", license: "Private" } };
}
