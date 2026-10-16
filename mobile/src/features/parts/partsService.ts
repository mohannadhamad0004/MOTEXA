// Parts feature: types + REST client for the two service facades used by the screens.
// Screens only call `partsShopService` (provider) and `partsAdminService` (admin).
// The backend (backend/src/routes/parts.routes.ts) enforces roles and ownership; the screen gates are UX only.
// The product image is stored by the server (ProviderFile) and only uploaded when the user picked a new one.
// NOT persisted yet (later step): vehicle fitment (returned empty, form rows are not sent).

import type { PartCondition, PartType } from "../catalog/partAttrs";
import { api } from "../shared/api";
import { fileNameOf, isServerFile, localFileToBase64, publicImageUrl } from "../shared/files";

export type Verification = "PENDING" | "APPROVED" | "REJECTED";

export type Fitment = { make: string; model: string; yearFrom: number; yearTo: number; trim?: string };

export type Product = {
  id: string;
  shopId: string;
  imageUri?: string | null;
  name: string;
  brand: string;
  partNumber: string;
  description: string;
  price: number;
  stock: number;
  condition: PartCondition;
  partType: PartType | null; // null = not specified
  category: string | null; // key from shared/categories.ts; null on products made before categories existed
  fitments: Fitment[];
  // Moderation is owned by MOTEXA admins; providers can read it but never write it.
  hidden: boolean;
  hiddenReason?: string | null;
};

export type HistoryEntry = {
  at: string;
  actor: string;
  action: "SUBMITTED" | "APPROVED" | "REJECTED";
  reason?: string;
};

export type Shop = {
  id: string;
  ownerEmail: string;
  name: string;
  ownerName: string;
  phone: string;
  city: string;
  address: string;
  verification: Verification;
  rejectionReason?: string | null;
  documents: { kind: string; fileName: string; uri?: string | null }[]; // private to admin + owner
  history: HistoryEntry[];
};

export type ShopDetail = Shop & { products: Product[] };

export type Actor = { id: string; email: string; fullName: string };
export type ProductInput = Omit<Product, "id" | "shopId" | "hidden" | "hiddenReason">;

export const LOW_STOCK_AT = 5;
export const stockState = (stock: number) =>
  stock <= 0 ? "OUT" : stock <= LOW_STOCK_AT ? "LOW" : "IN";

// ---- API shapes -> screen shapes ----

type ApiProduct = {
  id: string;
  shopId: string;
  name: string;
  brand: string;
  partNumber: string;
  description: string | null;
  price: string; // exact decimal string
  stock: number;
  category: string | null;
  condition: PartCondition;
  partType: PartType | null;
  isHidden: boolean;
  hiddenReason: string | null;
  imageUri: string | null;
  fitments: Fitment[];
};

type ApiShop = {
  id: string;
  shopName: string;
  ownerName: string;
  ownerEmail: string;
  phone: string;
  city: string;
  address: string | null;
  verificationStatus: Verification;
  rejectionReason: string | null;
  documents: { kind: string; fileName: string; uri?: string | null }[];
  history: HistoryEntry[];
};

const toProduct = (p: ApiProduct): Product => ({
  id: p.id,
  shopId: p.shopId,
  imageUri: publicImageUrl(p.imageUri),
  name: p.name,
  brand: p.brand,
  partNumber: p.partNumber,
  description: p.description ?? "",
  price: Number(p.price),
  stock: p.stock,
  category: p.category ?? null,
  condition: p.condition ?? "NEW",
  partType: p.partType ?? null,
  fitments: p.fitments,
  hidden: p.isHidden,
  hiddenReason: p.hiddenReason,
});

const toShop = (s: ApiShop): Shop => ({
  id: s.id,
  ownerEmail: s.ownerEmail,
  name: s.shopName,
  ownerName: s.ownerName,
  phone: s.phone,
  city: s.city,
  address: s.address ?? "",
  verification: s.verificationStatus,
  rejectionReason: s.rejectionReason,
  documents: s.documents,
  history: s.history,
});

/** Content fields (+ a newly picked image). Moderation fields can never be sent from here. */
async function toBody(i: ProductInput) {
  const body: Record<string, unknown> = {
    name: i.name,
    brand: i.brand,
    partNumber: i.partNumber,
    description: i.description,
    price: i.price,
    stock: i.stock,
    ...(i.category ? { category: i.category } : {}),
    condition: i.condition,
    partType: i.partType, // null clears it ("not specified")
    // Always sent: the server replaces the stored set with this one.
    fitments: i.fitments.map((f) => ({ make: f.make, model: f.model, yearFrom: f.yearFrom, yearTo: f.yearTo, trim: f.trim?.trim() || null })),
  };
  if (i.imageUri && !isServerFile(i.imageUri) && !i.imageUri.startsWith("http")) {
    body.image = { name: fileNameOf(i.imageUri, "product-image.jpg"), dataBase64: await localFileToBase64(i.imageUri) };
  }
  return body;
}

// ---- Provider (PARTS_PROVIDER). The actor argument is kept for the screens; the server uses the token. ----
export const partsShopService = {
  async getMyInventory(_actor: Actor) {
    const [s, p] = await Promise.all([
      api<{ shop: ApiShop }>("GET", "/parts/me/shop"),
      api<{ products: ApiProduct[] }>("GET", "/parts/me/products"),
    ]);
    return { shop: toShop(s.shop), products: p.products.map(toProduct) };
  },
  async getMyProduct(_actor: Actor, id: string) {
    const r = await api<{ product: ApiProduct }>("GET", `/parts/me/products/${id}`);
    return toProduct(r.product);
  },
  async addProduct(_actor: Actor, input: ProductInput) {
    const r = await api<{ product: ApiProduct }>("POST", "/parts/me/products", await toBody(input));
    return toProduct(r.product);
  },
  /** Moderation fields are deliberately not part of ProductInput: shops cannot unhide a listing. */
  async updateProduct(_actor: Actor, id: string, input: ProductInput) {
    const r = await api<{ product: ApiProduct }>("PATCH", `/parts/me/products/${id}`, await toBody(input));
    return toProduct(r.product);
  },
};

// ---- Admin (SUPER_ADMIN or ADMIN + MANAGE_SPARE_PARTS): provider approval only, never products ----
type AdminActor = Actor & { role: string; permissions: string[] };

export const partsAdminService = {
  async listShops(_a: AdminActor) {
    const r = await api<{ shops: ApiShop[] }>("GET", "/admin/parts/shops");
    return r.shops.map(toShop);
  },
  /** The shop plus its products (read-only for admins, apart from hiding/showing). */
  async getShop(_a: AdminActor, id: string): Promise<ShopDetail> {
    const r = await api<{ shop: ApiShop; products: ApiProduct[] }>("GET", `/admin/parts/shops/${id}`);
    return { ...toShop(r.shop), products: r.products.map(toProduct) };
  },
  /** MOTEXA moderation: hiding needs a reason; showing again clears it. Product content is never editable here. */
  async setProductVisibility(_a: AdminActor, productId: string, change: { hidden: true; reason: string } | { hidden: false }) {
    const body = change.hidden ? { hidden: true, reason: change.reason.trim() } : { hidden: false };
    const r = await api<{ product: ApiProduct }>("PATCH", `/admin/parts/products/${productId}/visibility`, body);
    return toProduct(r.product);
  },
  async decideShop(_a: AdminActor, id: string, decision: { approve: true } | { approve: false; reason: string }) {
    const body = decision.approve ? { decision: "APPROVED" } : { decision: "REJECTED", reason: decision.reason.trim() };
    const r = await api<{ shop: ApiShop }>("PATCH", `/admin/parts/shops/${id}/decision`, body);
    return toShop(r.shop);
  },
};
