// Feature 2 API: shop accessories in 3D on the customer's car (backend/src/routes/accessory3d.routes.ts).
import { api } from "../../core/config/api";
import { authenticatedBase64 } from "../vehicle3d/api";
import type { AccessoryType, AccessoryZone, PartLabel, PartMap } from "../car3d/modelConfig";
import type { FitAdjust } from "../car3d/car3d";
import type { AccessoryReview } from "./reviewState";
import type { CarModel } from "../car3d/models";

/** MAIN = a single-part product; FRONT / REAR = a body kit's bumpers (one product, two 3D parts). */
export type KitPart = "MAIN" | "FRONT" | "REAR";
export const KIT_PART_TYPE: Record<"FRONT" | "REAR", AccessoryType> = { FRONT: "FRONT_BUMPER", REAR: "REAR_BUMPER" };
/** Bumpers replace the car's own bumper: car-specific (exact generations, never Universal) and only on cars whose confirmed part map has that bumper. */
export const isBumper = (t: AccessoryType) => t === "FRONT_BUMPER" || t === "REAR_BUMPER";
export const bumperLabel = (t: AccessoryType) => t === "FRONT_BUMPER" ? "FRONT_BUMPER" as const : "REAR_BUMPER" as const;
export type AccessoryStatus = "DRAFT" | "PENDING_REVIEW" | "APPROVED_FOR_GENERATION" | "GENERATING" | "READY_FOR_FINAL_REVIEW" | "PUBLISHED" | "REJECTED";
/** A rim's finish, chosen by the shop (the 3D rim uses it; rims never take "paint to match"). */
export type RimFinish = "SILVER" | "BLACK" | "GUNMETAL" | "CHROME";
export const RIM_FINISHES: RimFinish[] = ["SILVER", "BLACK", "GUNMETAL", "CHROME"];
export const RIM_FINISH_LABELS: Record<RimFinish, [string, string]> = { SILVER: ["Silver", "فضي"], BLACK: ["Black", "أسود"], GUNMETAL: ["Gunmetal", "رمادي معدني"], CHROME: ["Chrome", "كروم"] };
/** Rim specs (all optional, shown on the product page). */
export type RimSpecs = { inches: number | null; widthIn: number | null; pcd: string | null; offsetMm: number | null; finish: RimFinish | null };
export type Size = { widthMm: number | null; heightMm: number | null; depthMm: number | null; lengthMm: number | null; rimInches: number | null };
export const PREVIEW_VIEWS = ["front-three-quarter", "front", "left-side", "rear-three-quarter", "rear", "top-three-quarter"] as const;
export type Preview = { generationId: string; generationName: string; model3dKey: string; modelRevision: string; renderedAt?: string; fitSnapshot?: { fitVersion: number; updatedAt: string }; views: Record<string, string>; fit: Record<string, unknown> | null } | null;
export type Accessory = {
  lifecycleState?:string;fitmentNotes?:string|null;deactivatedAt?:string|null;
  id: string; productId: string; kitPart: KitPart; accessoryType: AccessoryType; status: AccessoryStatus; revision: number; creditsUsed: number; size: Size; rim: RimSpecs | null;
  fitsGenerationIds: string[]; installedGenerationId: string | null; installed360: boolean; installedApproved: boolean;
  partPhotos: { id: string }[]; installedPhotos: { id: string }[]; reviewNotes: string | null; submittedAt: string | null;
  generationMode: string | null; provider: string | null; providerTaskId?: string | null; providerState: string | null; providerProgress: number | null; generationStage: string;
  generationErrorCode: string | null; failureReason: string | null; hasModel: boolean; validation: Record<string, unknown> | null; processing?: Record<string,unknown>|null;
  preview: Preview; modelRevision: string; mock: boolean; published: boolean; updatedAt: string;
  /** a provider task already exists and only a free step failed: Start resumes it (no new charge) */
  resumable: boolean;
};
export type AdminAccessory = Accessory & {
  review: AccessoryReview;
  product: { name: string; brand: string; partNumber: string; category: string | null; shop: { id: string; shopName: string } } | null;
  creditsThisMonth: number; monthlyCredits: number; mode: "real" | "mock"; paidEnabled: boolean; estimatedProviderCredits?: number;
  fits: { id: string; name: string; nameAr: string; years: [number, number]; has3d: boolean; partSizes?: PartSizes | null;fit?:{allowed:boolean;code:string|null;autoFit:{fit:unknown;adj:FitAdjust|null}|null} }[];
};
export type ListedAccessory = Accessory & { productName: string; productBrand: string; shopName: string; shopId: string; productImageId: string | null; firstPartPhotoId: string | null; cars: { id: string; name: string; nameAr: string }[] };
/** One published (or not yet published: model null) 3D part of a product, for the customer. */
/** universal = a "Universal by size" rim: shown on any car with a 3D model. */
export type CustomerPart = { part: KitPart; type: AccessoryType; fitsIds: string[]; universal?: boolean; model: { file: string; size: { widthMm: number | null; lengthMm: number | null; rimInches: number | null }; finish?: RimFinish | null } | null; autoFit: { fit: unknown; adj: FitAdjust | null } | null;allowed?:boolean;reason?:string|null };
export type CustomerAccessory = {
  /** a body kit: parts = its front and / or rear bumper */
  kit?: boolean; parts?: CustomerPart[];
  type: AccessoryType;
  model: { file: string; size: { widthMm: number | null; lengthMm: number | null; rimInches: number | null } } | null;
  fits: { id: string; nameEn: string; nameAr: string }[];
  /** a "Universal by size" rim; rim = its specs (rims only) */
  universal?: boolean; rim?: RimSpecs | null;
  installed: { photoIds: string[]; spin: boolean; generation: { id: string; nameEn: string; nameAr: string } | null } | null;
  /** the stored auto-fit on the customer's generation (replayed by the viewer) + the Parts Admin's correction; null = fitted live */
  autoFit?: { fit: unknown; adj: FitAdjust | null } | null;
} | null;
/** One accessory x generation on a car model, for the Parts Admin's auto-fit review. fit = null while it is being computed. */
export type AutoFitRow = { accessoryId: string; productId: string; productName: string; type: AccessoryType; status: AccessoryStatus; file: string | null;
  hasModel: boolean; modelRevision: string | null;
  size: { widthMm: number | null; lengthMm: number | null; rimInches: number | null }; generation: { id: string; name: string }; finish?: RimFinish | null;
  fit: { fit: { info?: Record<string, unknown>; failed?: string } & Record<string, unknown>; adj: FitAdjust | null; approvedAt: string | null } | null; computing: boolean; kitPart?: KitPart };
export type { ZoneBox } from "../car3d/modelConfig";
/** none = not split yet (running in the background), stale = the model file changed, single = one piece (zones only). */
export type PartMapStatus = "none" | "stale" | "single" | "proposed" | "confirmed";
export type PartMapSummary = Partial<Record<PartLabel, { n: number; confidence?: number; by?: string }>>;
/** The accessory quality gate of a car model (backend car-part-map accessoryGate): codes, translated in gate.tsx. */
type GateProblem = { code: "LENGTH" | "WIDTH" | "HEIGHT" | "SHAPE" | "WHEEL_SIZE" | "WHEELS_IN_AIR"; value: number; range?: [number, number] };
export type ModelGate = { verdict: "FULL" | "LIMITED" | "REJECTED"; problems: GateProblem[]; warnings?: GateProblem[];
  limited: Partial<Record<AccessoryType, "NOT_SEPARATE" | "WHEELS_NOT_FOUND" | "NEEDS_WHEELS" | "SINGLE_PIECE">>; text: string[] };
export type PartMapListItem = { key: string; name: string; status: PartMapStatus; pieces: number; confirmedAt: string | null; proposalSummary: PartMapSummary; mapSummary: PartMapSummary; gate: ModelGate | null };
/** Measured in the part-map editor (8-point shape on the car model, real scale), per label. */
export type PartSize = { widthMm: number; heightMm: number; depthMm: number; at?: string };
export type PartSizes = Partial<Record<PartLabel, PartSize>>;
export type PartMapDetail = PartMapListItem & { sizes?: PartSizes | null; cuts?: Partial<Record<"FRONT_BUMPER" | "REAR_BUMPER", { pts: number[][]; sideGrow?: number }>>; viewerConfig?: CarModel; privateReview?: boolean; modelSha256: string | null; proposal: Partial<Record<PartLabel, { ids: string[]; confidence: number; by: string }>> | null; map: PartMap | null };
export type ZoneModel = { key: string; name: string; fileZones: Partial<Record<AccessoryType, AccessoryZone>>; zones: Partial<Record<AccessoryType, AccessoryZone>> };
/** Add-ons that hide the car's own part while on (mirrors backend REPLACES_STOCK). */
export const REPLACES_STOCK: AccessoryType[] = ["WING", "SPOILER", "ROOF_RACK", "MIRROR_COVERS", "RIMS"];

export const ACCESSORY_TYPE_LABELS: Record<AccessoryType, [string, string]> = {
  FRONT_BUMPER: ["Front bumper", "مصد أمامي"], REAR_BUMPER: ["Rear bumper", "مصد خلفي"], SIDE_SKIRTS: ["Side skirts", "تنانير جانبية"],
  FRONT_LIP: ["Front lip", "شفة أمامية"], REAR_DIFFUSER: ["Rear diffuser", "ناشر خلفي"], FENDER_FLARES: ["Fender flares", "توسعات الرفارف"],
  WING: ["Rear wing", "جناح خلفي"], SPOILER: ["Spoiler", "سبويلر"], ROOF_RACK: ["Roof rack", "حامل سقف"], RIMS: ["Rims", "جنوط"], MIRROR_COVERS: ["Mirror covers", "أغطية المرايا"],
};
export const STATUS_LABELS: Record<AccessoryStatus, [string, string]> = {
  DRAFT: ["Draft", "مسودة"], PENDING_REVIEW: ["Waiting for Parts Admin review", "بانتظار مراجعة إدارة القطع"],
  APPROVED_FOR_GENERATION: ["Photos approved · waiting for 3D generation", "الصور معتمدة · بانتظار إنشاء النموذج"], GENERATING: ["Creating the 3D model…", "جارٍ إنشاء النموذج…"],
  READY_FOR_FINAL_REVIEW: ["3D model ready · final review", "النموذج جاهز · المراجعة النهائية"], PUBLISHED: ["Published: customers can see it on their car", "منشور: يراه العملاء على سياراتهم"],
  REJECTED: ["Changes requested", "مطلوب تعديلات"],
};
/** Which real size the fitter needs (mirrors backend sizeField). */
export const sizeField = (type: AccessoryType): "rimInches" | "lengthMm" | "widthMm" => type === "RIMS" ? "rimInches" : type === "SIDE_SKIRTS" || type === "FENDER_FLARES" ? "lengthMm" : "widthMm";
/** Product categories that may carry each type (mirrors backend accessoryCategoriesFor). */
export const typesForCategory = (category: string | null | undefined): AccessoryType[] =>
  category === "WHEELS" ? ["RIMS"] : category === "BODY" || category === "EXTERIOR_ACCESSORIES" ? (Object.keys(ACCESSORY_TYPE_LABELS) as AccessoryType[]).filter(k => k !== "RIMS") : [];

const shop = (productId: string, rest = "", part: KitPart = "MAIN") => `/parts/me/products/${productId}/accessory-3d${rest}${part === "MAIN" ? "" : `?part=${part}`}`;
export const shopAccessoryApi = {
  get: (productId: string, part: KitPart = "MAIN") => api<{ eligible: boolean; category: string | null; isUniversal: boolean; productName?: string; sizeRanges?: Partial<Record<AccessoryType, { field: "widthMm" | "lengthMm"; min: number; max: number }>>; accessory: Accessory | null; parts: { part: KitPart; type: AccessoryType; status: AccessoryStatus }[] }>("GET", shop(productId, "", part)),
  save: async (productId: string, body: Record<string, unknown>, part: KitPart = "MAIN") => (await api<{ accessory: Accessory }>("PUT", shop(productId, "", part), body)).accessory,
  photo: (productId: string, kind: "PART" | "INSTALLED", dataBase64: string, part: KitPart = "MAIN") => api("POST", shop(productId, `/photos/${kind}`, part), { dataBase64 }),
  removePhoto: (productId: string, photoId: string, part: KitPart = "MAIN") => api("DELETE", shop(productId, `/photos/${photoId}`, part)),
  submit: (productId: string, part: KitPart = "MAIN") => api("POST", shop(productId, "/submit", part), { consent: true }),
  revise: (productId: string, part: KitPart = "MAIN") => api("POST", shop(productId, "/revise", part)),
  remove: (productId: string, part: KitPart = "MAIN") => api("DELETE", shop(productId, "", part)),
  asset: (productId: string, asset: string, part: KitPart = "MAIN") => authenticatedBase64(shop(productId, `/assets/${asset}`, part)),
};
const adm = "/admin/parts/accessory-3d";
export const adminAccessoryApi = {
  list: async () => (await api<{ accessories: ListedAccessory[] }>("GET", adm)).accessories,
  get: async (id: string) => (await api<{ accessory: AdminAccessory }>("GET", `${adm}/${id}`)).accessory,
  act: (id: string, action: "approve" | "reject" | "start" | "preview" | "regenerate" | "publish"|"refit"|"unpublish"|"reactivate"|"discard-candidate"|"validate", body: Record<string, unknown> = {}) => api("POST", `${adm}/${id}/${action}`, body),
  asset: (id: string, asset: string) => authenticatedBase64(`${adm}/${id}/assets/${asset}`),
  setCredits: (shopId: string, monthlyCredits: number) => api("PUT", `/admin/parts/shops/${shopId}/accessory-3d-credits`, { monthlyCredits }),
  zones: async () => (await api<{ models: ZoneModel[] }>("GET", "/admin/parts/accessory-zones")).models,
  setZone: (key: string, type: AccessoryType, zone: AccessoryZone | null) => api("PUT", `/admin/parts/accessory-zones/${key}/${type}`, { zone }),
  partMaps: async () => (await api<{ models: PartMapListItem[] }>("GET", "/admin/parts/part-maps")).models,
  partMapAsset: (key: string) => authenticatedBase64(`/admin/parts/part-maps/${encodeURIComponent(key)}/model`),
  partMap: async (key: string) => (await api<{ partMap: PartMapDetail }>("GET", `/admin/parts/part-maps/${key}`)).partMap,
  /** map null = unconfirm (the car goes back to the zone cut) */
  confirmPartMap: async (key: string, modelSha256: string, map: PartMap | null) => (await api<{ partMap: PartMapDetail }>("PUT", `/admin/parts/part-maps/${key}`, { modelSha256, map })).partMap,
  /** cut mode for a bumper merged into the body: the 8 points, or null = off */
  /** body: { pts } (save, keeps no grow) | { pts: null } (off) | { sideGrowCm } (only the corner grow, whole cm 0-20) */
  savePartCut: async (key: string, label: "FRONT_BUMPER" | "REAR_BUMPER", body: { pts?: number[][] | null; sideGrowCm?: number }) => (await api<{ cuts: NonNullable<PartMapDetail["cuts"]> }>("PUT", `/admin/parts/part-maps/${key}/cuts/${label}`, body)).cuts,
  savePartSize: async (key: string, label: PartLabel, size: PartSize) => (await api<{ sizes: PartSizes }>("PUT", `/admin/parts/part-maps/${key}/sizes/${label}`, size)).sizes,
  autoFits: async (model3dKey: string) => (await api<{ fits: AutoFitRow[] }>("GET", `/admin/parts/auto-fits?model3dKey=${encodeURIComponent(model3dKey)}`)).fits,
  /** approve the fit with a correction (null = the pure auto-fit: "Reset to auto-fit") */
  approveFit: (accessoryId: string, generationId: string, adj: FitAdjust | null) => api("PUT", `/admin/parts/auto-fits/${accessoryId}/${generationId}`, { adj }),
  needsCorrection: (accessoryId: string, generationId: string) => api("PUT", `/admin/parts/auto-fits/${accessoryId}/${generationId}`, { needsCorrection: true }),
  segment: async (key: string) => (await api<{ partMap: PartMapDetail }>("POST", `/admin/parts/part-maps/${key}/segment`)).partMap,
};
export const customerAccessoryApi = {
  garage:async(productId:string)=>(await api<{cars:{carId:string;make:string;model:string;year:number;generationId:string|null;isActive:boolean;allowed:boolean;reason:string|null}[]}>("GET",`/catalog/products/${productId}/accessory-3d/garage`)).cars,
  get: async (productId: string, generationId?: string | null) => (await api<{ accessory: CustomerAccessory }>("GET", `/catalog/products/${productId}/accessory-3d${generationId ? `?generationId=${encodeURIComponent(generationId)}` : ""}`)).accessory,
  photo: (photoId: string) => authenticatedBase64(`/catalog/accessory-3d/photos/${photoId}`),
};
