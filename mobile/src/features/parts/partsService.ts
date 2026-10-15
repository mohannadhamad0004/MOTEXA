// TEMPORARY DEVELOPMENT IMPLEMENTATION (in-memory mock, no backend models exist yet).
// Parts feature: types + MOCK data layer + the two service facades used by the screens.
// Screens only call `partsShopService` (provider) and `partsAdminService` (admin).
// To go real: re-implement those two objects with fetch() calls to the REST API.
// Everything below `// ---- MOCK ----` is throwaway development data (in memory, resets on reload).
// SECURITY: the ownership/permission checks in the mock mimic what the backend MUST enforce.

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
  ownerEmail: string; // links the mock shop to a real seeded login
  name: string;
  ownerName: string;
  phone: string;
  city: string;
  address: string;
  verification: Verification;
  rejectionReason?: string | null;
  documents: { kind: string; fileName: string }[]; // private to admin + owner
  history: HistoryEntry[];
};

export type Actor = { id: string; email: string; fullName: string };
export type ProductInput = Omit<Product, "id" | "shopId" | "hidden" | "hiddenReason">;

export const LOW_STOCK_AT = 5;
export const stockState = (stock: number) =>
  stock <= 0 ? "OUT" : stock <= LOW_STOCK_AT ? "LOW" : "IN";

// ---- MOCK ----
const iso = (d: string) => new Date(d).toISOString();
const sub = (at: string, actor: string): HistoryEntry => ({ at: iso(at), actor, action: "SUBMITTED" });

const shops: Shop[] = [
  {
    id: "shop-a", ownerEmail: "shop@motexa.test", name: "Al-Mahaba Genuine & Aftermarket Auto Parts Trading Est.",
    ownerName: "Test Parts Shop", phone: "+962 79 100 0001", city: "Amman", address: "Wasfi Al-Tal St., Building 14",
    verification: "APPROVED",
    documents: [{ kind: "Commercial registration", fileName: "cr-mahaba.pdf" }, { kind: "Owner ID", fileName: "id-mahaba.jpg" }],
    history: [sub("2026-02-01", "Test Parts Shop"), { at: iso("2026-02-03"), actor: "Test Super Admin", action: "APPROVED" }],
  },
  {
    id: "shop-b", ownerEmail: "shop.b@motexa.test", name: "Speedy Spares",
    ownerName: "Rana Odeh", phone: "+962 79 100 0002", city: "Zarqa", address: "Industrial Area, Block 3",
    verification: "PENDING",
    documents: [{ kind: "Commercial registration", fileName: "cr-speedy.pdf" }, { kind: "Owner ID", fileName: "id-speedy.jpg" }],
    history: [sub("2026-10-06", "Rana Odeh")],
  },
  {
    id: "shop-c", ownerEmail: "shop.c@motexa.test", name: "City Brake Center",
    ownerName: "Fadi Saleh", phone: "+962 79 100 0003", city: "Irbid", address: "King Abdullah St.",
    verification: "REJECTED", rejectionReason: "Commercial registration has expired.",
    documents: [{ kind: "Commercial registration", fileName: "cr-citybrake.pdf" }],
    history: [sub("2026-09-10", "Fadi Saleh"), { at: iso("2026-09-12"), actor: "Test Admin Parts", action: "REJECTED", reason: "Commercial registration has expired." }],
  },
  {
    id: "shop-d", ownerEmail: "shop.d@motexa.test", name: "Gulf Oil & Filters",
    ownerName: "Mona Yousef", phone: "+962 79 100 0004", city: "Aqaba", address: "Port Road 22",
    verification: "PENDING",
    documents: [{ kind: "Commercial registration", fileName: "cr-gulf.pdf" }],
    history: [sub("2026-10-10", "Mona Yousef")],
  },
];

const products: Product[] = [
  {
    id: "p-a1", shopId: "shop-a", name: "Front Brake Pads Set", brand: "Bosch", partNumber: "BP-0986-424",
    description: "Ceramic front brake pads, low dust.", price: 32.5, stock: 24,
    fitments: [{ make: "Toyota", model: "Corolla", yearFrom: 2014, yearTo: 2019 }, { make: "Toyota", model: "Camry", yearFrom: 2012, yearTo: 2017, trim: "2.5L" }],
    hidden: false,
  },
  {
    id: "p-a2", shopId: "shop-a", name: "Engine Oil Filter", brand: "Mann", partNumber: "W 712/95",
    description: "Spin-on oil filter.", price: 6.9, stock: 3,
    fitments: [{ make: "Hyundai", model: "Elantra", yearFrom: 2011, yearTo: 2020 }],
    hidden: false,
  },
  {
    id: "p-a3", shopId: "shop-a", name: "Alternator 120A", brand: "Denso", partNumber: "DAN-1211",
    description: "Remanufactured alternator, 12V 120A.", price: 145, stock: 0,
    fitments: [{ make: "Kia", model: "Sportage", yearFrom: 2016, yearTo: 2021 }],
    hidden: false,
  },
  {
    id: "p-a4", shopId: "shop-a", name: "Universal LED Headlight Bulb Kit (H4/H7/H11 compatible, extra long title for testing)",
    brand: "NoName", partNumber: "LED-UNIV-9999-EXTRA-LONG-PART-NUMBER",
    description: "Listing under review.", price: 18, stock: 40, fitments: [],
    hidden: true, hiddenReason: "Claims of OEM equivalence cannot be verified. Please provide certification.",
  },
  {
    id: "p-b1", shopId: "shop-b", name: "Air Filter", brand: "Mahle", partNumber: "LX-1780",
    description: "Panel air filter.", price: 9, stock: 12,
    fitments: [{ make: "Nissan", model: "Sunny", yearFrom: 2010, yearTo: 2018 }],
    hidden: false,
  },
];

const wait = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 250));
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
let seq = 100;

function myShop(actor: Actor) {
  const s = shops.find((x) => x.ownerEmail === actor.email);
  if (!s) throw new Error("No parts shop is linked to this account.");
  return s;
}
/** Ownership check: the server must do this for every provider mutation. */
function ownProduct(actor: Actor, id: string) {
  const s = myShop(actor);
  const p = products.find((x) => x.id === id);
  if (!p || p.shopId !== s.id) throw new Error("Forbidden: this product belongs to another shop.");
  return p;
}
function validate(i: ProductInput) {
  if (!i.name.trim() || !i.brand.trim() || !i.partNumber.trim()) throw new Error("Name, brand and part number are required.");
  if (!(i.price >= 0) || !(i.stock >= 0) || !Number.isInteger(i.stock)) throw new Error("Price and stock must be valid numbers.");
}

const pick = (i: ProductInput): ProductInput => ({
  name: i.name.trim(), brand: i.brand.trim(), partNumber: i.partNumber.trim(), description: i.description,
  price: i.price, stock: i.stock, imageUri: i.imageUri, fitments: i.fitments,
}); // whitelist: never trust extra fields (e.g. hidden/shopId)

// ---- Provider (PARTS_PROVIDER) ----
export const partsShopService = {
  async getMyInventory(actor: Actor) {
    const shop = myShop(actor);
    return wait(clone({ shop, products: products.filter((p) => p.shopId === shop.id) }));
  },
  async getMyProduct(actor: Actor, id: string) {
    return wait(clone(ownProduct(actor, id)));
  },
  async addProduct(actor: Actor, input: ProductInput) {
    const s = myShop(actor);
    validate(input);
    const p: Product = { ...pick(input), id: `p-new-${++seq}`, shopId: s.id, hidden: false, hiddenReason: null };
    products.push(p);
    return wait(clone(p));
  },
  /** Moderation fields are deliberately not part of ProductInput: shops cannot unhide a listing. */
  async updateProduct(actor: Actor, id: string, input: ProductInput) {
    const p = ownProduct(actor, id);
    validate(input);
    Object.assign(p, pick(input));
    return wait(clone(p));
  },
};

// ---- Admin (SUPER_ADMIN or ADMIN + MANAGE_SPARE_PARTS): provider approval only, never products ----
type AdminActor = Actor & { role: string; permissions: string[] };
function assertPartsAdmin(a: AdminActor) {
  const ok = a.role === "SUPER_ADMIN" || (a.role === "ADMIN" && a.permissions.includes("MANAGE_SPARE_PARTS"));
  if (!ok) throw new Error("Forbidden: MANAGE_SPARE_PARTS permission required.");
}

export const partsAdminService = {
  async listShops(a: AdminActor) {
    assertPartsAdmin(a);
    return wait(clone(shops));
  },
  async getShop(a: AdminActor, id: string) {
    assertPartsAdmin(a);
    const s = shops.find((x) => x.id === id);
    if (!s) throw new Error("Shop not found.");
    return wait(clone(s));
  },
  async decideShop(a: AdminActor, id: string, decision: { approve: true } | { approve: false; reason: string }) {
    assertPartsAdmin(a);
    const s = shops.find((x) => x.id === id);
    if (!s) throw new Error("Shop not found.");
    if (!decision.approve && !decision.reason.trim()) throw new Error("A rejection reason is required.");
    s.verification = decision.approve ? "APPROVED" : "REJECTED";
    s.rejectionReason = decision.approve ? null : decision.reason.trim();
    s.history.push({
      at: new Date().toISOString(),
      actor: a.fullName,
      action: decision.approve ? "APPROVED" : "REJECTED",
      reason: decision.approve ? undefined : decision.reason.trim(),
    });
    return wait(clone(s));
  },
};
