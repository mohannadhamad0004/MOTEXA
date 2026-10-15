// TEMPORARY DEVELOPMENT IMPLEMENTATION (in-memory mock, no backend models exist yet).
// Tow feature: types + MOCK data layer + the two service facades used by the screens.
// Screens only call `towFleetService` (provider) and `towAdminService` (admin).
// To go real: re-implement those two objects with fetch() calls to the REST API.
// Everything below `// ---- MOCK ----` is throwaway development data (in memory, resets on reload).
// SECURITY: the ownership/permission checks in the mock mimic what the backend MUST enforce.

export type Verification = "PENDING" | "APPROVED" | "REJECTED";
export type Operational = "AVAILABLE" | "BUSY" | "OUT_OF_SERVICE";
export type TruckType = "FLATBED" | "HOOK_CHAIN" | "WHEEL_LIFT" | "HEAVY_DUTY";
export const TRUCK_TYPES: TruckType[] = ["FLATBED", "HOOK_CHAIN", "WHEEL_LIFT", "HEAVY_DUTY"];

export type DocKind = "REGISTRATION" | "INSURANCE";
export type TruckDocument = {
  kind: DocKind;
  fileName: string;
  uri?: string | null;
  expiresAt?: string | null; // ISO date
};

export type HistoryEntry = {
  at: string; // ISO
  actor: string;
  action: "SUBMITTED" | "APPROVED" | "REJECTED";
  reason?: string;
};

export type Truck = {
  id: string;
  companyId: string;
  photoUri?: string | null;
  type: TruckType;
  plate: string;
  make: string;
  model: string;
  year: number | null;
  verification: Verification;
  operational: Operational;
  hasActiveJob: boolean;
  documents: TruckDocument[];
  rejectionReason?: string | null;
  history: HistoryEntry[];
};

export type TowCompany = {
  id: string;
  ownerEmail: string; // links the mock company to a real seeded login
  name: string;
  contactName: string;
  phone: string;
  city: string;
  verification: Verification;
  documents: { kind: string; fileName: string }[]; // private to admin + owner
};

export type Actor = { id: string; email: string; fullName: string };
export type TruckInput = Pick<Truck, "type" | "plate" | "make" | "model" | "year" | "photoUri" | "documents">;

export type CompanyRow = TowCompany & { truckCount: number; pendingTruckCount: number };

// ---- MOCK ----
const iso = (d: string) => new Date(d).toISOString();
const doc = (kind: DocKind, exp?: string): TruckDocument => ({
  kind,
  fileName: `${kind.toLowerCase()}.jpg`,
  expiresAt: exp ?? null,
});
const submitted = (at: string, actor: string): HistoryEntry => ({ at: iso(at), actor, action: "SUBMITTED" });

const companies: TowCompany[] = [
  {
    id: "co-a", ownerEmail: "tow@motexa.test", name: "Al-Noor Recovery & Towing Services Company",
    contactName: "Test Tow Company", phone: "+962 79 000 0001", city: "Amman", verification: "APPROVED",
    documents: [{ kind: "Commercial registration", fileName: "cr-alnoor.pdf" }, { kind: "Operating licence", fileName: "licence-alnoor.pdf" }],
  },
  {
    id: "co-b", ownerEmail: "tow.b@motexa.test", name: "Desert Hook Towing",
    contactName: "Khaled Nasser", phone: "+962 79 000 0002", city: "Zarqa", verification: "PENDING",
    documents: [{ kind: "Commercial registration", fileName: "cr-desert.pdf" }],
  },
  {
    id: "co-c", ownerEmail: "tow.c@motexa.test", name: "Quick Lift",
    contactName: "Sami Haddad", phone: "+962 79 000 0003", city: "Irbid", verification: "REJECTED",
    documents: [{ kind: "Commercial registration", fileName: "cr-quick.pdf" }],
  },
];

const trucks: Truck[] = [
  {
    id: "tr-a1", companyId: "co-a", type: "FLATBED", plate: "10-12345", make: "Isuzu", model: "NPR", year: 2021,
    verification: "APPROVED", operational: "AVAILABLE", hasActiveJob: false,
    documents: [doc("REGISTRATION", "2027-05-01"), doc("INSURANCE", "2027-02-01")],
    history: [submitted("2026-03-01", "Test Tow Company"), { at: iso("2026-03-03"), actor: "Test Super Admin", action: "APPROVED" }],
  },
  {
    id: "tr-a2", companyId: "co-a", type: "HOOK_CHAIN", plate: "20-67890", make: "Mitsubishi", model: "Canter", year: 2019,
    verification: "APPROVED", operational: "BUSY", hasActiveJob: true,
    documents: [doc("REGISTRATION", "2027-01-01"), doc("INSURANCE", "2027-01-01")],
    history: [submitted("2026-03-01", "Test Tow Company"), { at: iso("2026-03-03"), actor: "Test Super Admin", action: "APPROVED" }],
  },
  {
    id: "tr-a3", companyId: "co-a", type: "WHEEL_LIFT", plate: "30-11122", make: "Hino", model: "300", year: 2023,
    verification: "PENDING", operational: "AVAILABLE", hasActiveJob: false,
    documents: [doc("REGISTRATION", "2028-01-01"), doc("INSURANCE", "2027-09-01")],
    history: [submitted("2026-10-01", "Test Tow Company")],
  },
  {
    id: "tr-a4", companyId: "co-a", type: "HEAVY_DUTY", plate: "40-99887", make: "Volvo", model: "FM", year: 2016,
    verification: "APPROVED", operational: "OUT_OF_SERVICE", hasActiveJob: false,
    documents: [doc("REGISTRATION", "2027-03-01"), doc("INSURANCE", "2025-12-31")], // insurance expired
    history: [submitted("2026-02-01", "Test Tow Company"), { at: iso("2026-02-04"), actor: "Test Super Admin", action: "APPROVED" }],
  },
  {
    id: "tr-a5", companyId: "co-a", type: "FLATBED", plate: "50-00001", make: "Ford", model: "F-650", year: 2012,
    verification: "REJECTED", operational: "OUT_OF_SERVICE", hasActiveJob: false, rejectionReason: "Registration photo is unreadable. Please upload a clear copy.",
    documents: [doc("REGISTRATION"), doc("INSURANCE", "2027-01-01")],
    history: [submitted("2026-08-01", "Test Tow Company"), { at: iso("2026-08-02"), actor: "Test Admin Towing", action: "REJECTED", reason: "Registration photo is unreadable. Please upload a clear copy." }],
  },
  {
    id: "tr-b1", companyId: "co-b", type: "FLATBED", plate: "11-22233", make: "Isuzu", model: "NQR", year: 2020,
    verification: "PENDING", operational: "AVAILABLE", hasActiveJob: false,
    documents: [doc("REGISTRATION", "2027-06-01"), doc("INSURANCE", "2027-06-01")],
    history: [submitted("2026-10-05", "Khaled Nasser")],
  },
  {
    id: "tr-c1", companyId: "co-c", type: "WHEEL_LIFT", plate: "12-44455", make: "Hyundai", model: "HD65", year: 2018,
    verification: "REJECTED", operational: "OUT_OF_SERVICE", hasActiveJob: false, rejectionReason: "Company licence not valid.",
    documents: [doc("REGISTRATION", "2027-06-01"), doc("INSURANCE", "2027-06-01")],
    history: [submitted("2026-09-01", "Sami Haddad"), { at: iso("2026-09-02"), actor: "Test Admin Towing", action: "REJECTED", reason: "Company licence not valid." }],
  },
];

const wait = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 250));
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
let seq = 100;

function myCompany(actor: Actor) {
  const c = companies.find((x) => x.ownerEmail === actor.email);
  if (!c) throw new Error("No tow company is linked to this account.");
  return c;
}
/** Ownership check: the server must do this for every provider mutation. */
function ownTruck(actor: Actor, id: string) {
  const co = myCompany(actor);
  const t = trucks.find((x) => x.id === id);
  if (!t || t.companyId !== co.id) throw new Error("Forbidden: this truck belongs to another company.");
  return t;
}

// ---- Provider (TOW_PROVIDER) ----
export const towFleetService = {
  async getMyFleet(actor: Actor) {
    const company = myCompany(actor);
    return wait(clone({ company, trucks: trucks.filter((t) => t.companyId === company.id) }));
  },
  async getMyTruck(actor: Actor, id: string) {
    return wait(clone(ownTruck(actor, id)));
  },
  async addTruck(actor: Actor, input: TruckInput) {
    const co = myCompany(actor);
    if (trucks.some((t) => t.plate.toLowerCase() === input.plate.trim().toLowerCase()))
      throw new Error("A truck with this plate already exists.");
    const { type, plate, make, model, year, photoUri, documents } = input;
    const t: Truck = {
      type, make, model, year, photoUri, documents,
      plate: plate.trim(),
      id: `tr-new-${++seq}`,
      companyId: co.id,
      verification: "PENDING", // never starts approved
      operational: "OUT_OF_SERVICE",
      hasActiveJob: false,
      history: [{ at: new Date().toISOString(), actor: actor.fullName, action: "SUBMITTED" }],
    };
    trucks.push(t);
    return wait(clone(t));
  },
  async updateTruck(actor: Actor, id: string, input: TruckInput) {
    const t = ownTruck(actor, id);
    // Provider can never change verification/operational/moderation fields through this call.
    const { type, plate, make, model, year, photoUri, documents } = input; // whitelist: never trust extra fields
    Object.assign(t, { type, plate: plate.trim(), make, model, year, photoUri, documents });
    return wait(clone(t));
  },
  async removeTruck(actor: Actor, id: string) {
    const t = ownTruck(actor, id);
    if (t.hasActiveJob) throw new Error("This truck is engaged in a service and cannot be removed.");
    trucks.splice(trucks.indexOf(t), 1);
    return wait(true);
  },
};

// ---- Admin (SUPER_ADMIN or ADMIN + MANAGE_TOWING) ----
type AdminActor = Actor & { role: string; permissions: string[] };
function assertTowAdmin(a: AdminActor) {
  const ok = a.role === "SUPER_ADMIN" || (a.role === "ADMIN" && a.permissions.includes("MANAGE_TOWING"));
  if (!ok) throw new Error("Forbidden: MANAGE_TOWING permission required.");
}

export const towAdminService = {
  async listCompanies(a: AdminActor): Promise<CompanyRow[]> {
    assertTowAdmin(a);
    return wait(
      clone(
        companies.map((c) => {
          const own = trucks.filter((t) => t.companyId === c.id);
          return { ...c, truckCount: own.length, pendingTruckCount: own.filter((t) => t.verification === "PENDING").length };
        })
      )
    );
  },
  /** Also returns trucks so the list screen can search by plate / type. */
  async listTrucks(a: AdminActor) {
    assertTowAdmin(a);
    return wait(clone(trucks));
  },
  async getCompany(a: AdminActor, id: string) {
    assertTowAdmin(a);
    const company = companies.find((c) => c.id === id);
    if (!company) throw new Error("Company not found.");
    return wait(clone({ company, trucks: trucks.filter((t) => t.companyId === id) }));
  },
  /** Admin may only decide. No field of the truck itself is editable here. */
  async decideTruck(a: AdminActor, truckId: string, decision: { approve: true } | { approve: false; reason: string }) {
    assertTowAdmin(a);
    const t = trucks.find((x) => x.id === truckId);
    if (!t) throw new Error("Truck not found.");
    if (!decision.approve && !decision.reason.trim()) throw new Error("A rejection reason is required.");
    t.verification = decision.approve ? "APPROVED" : "REJECTED";
    t.rejectionReason = decision.approve ? null : decision.reason.trim();
    t.history.push({
      at: new Date().toISOString(),
      actor: a.fullName,
      action: decision.approve ? "APPROVED" : "REJECTED",
      reason: decision.approve ? undefined : decision.reason.trim(),
    });
    return wait(clone(t));
  },
};
