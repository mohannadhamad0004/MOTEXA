// Tow feature: types + REST client for the two service facades used by the screens.
// Screens only call `towFleetService` (provider) and `towAdminService` (admin).
// The backend (backend/src/routes/tow.routes.ts) enforces roles and ownership; the screen gates are UX only.
// Photos and documents are stored by the server (ProviderFile). Only files the user just picked are uploaded;
// files that already live on the server are never re-sent. Private document uris stay relative ("/files/private/<id>")
// and are opened with the bearer token by the PrivateDocs viewer.

import { api } from "../shared/api";
import { fileNameOf, isServerFile, localFileToBase64, publicImageUrl } from "../shared/files";

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
  ownerEmail: string;
  name: string;
  contactName: string;
  phone: string;
  city: string;
  verification: Verification;
  documents: { kind: string; fileName: string; uri?: string | null }[]; // private to admin + owner
};

export type Actor = { id: string; email: string; fullName: string };
export type TruckInput = Pick<Truck, "type" | "plate" | "make" | "model" | "year" | "photoUri" | "documents">;

export type CompanyRow = TowCompany & { truckCount: number; pendingTruckCount: number };

// ---- API shapes -> screen shapes ----

type ApiTruck = {
  id: string;
  companyId: string;
  plateNumber: string;
  make: string;
  model: string;
  year: number | null;
  truckType: TruckType;
  verificationStatus: Verification;
  operationalStatus: Operational;
  rejectionReason: string | null;
  photoUri: string | null;
  documents: (TruckDocument & { expired?: boolean })[];
  missingForApproval?: string[];
  history: HistoryEntry[];
};

type ApiCompany = {
  id: string;
  companyName: string;
  contactName: string;
  ownerEmail: string;
  phone: string;
  city: string;
  verificationStatus: Verification;
  documents: { kind: string; fileName: string; uri?: string | null }[];
};

const toTruck = (t: ApiTruck): Truck => ({
  id: t.id,
  companyId: t.companyId,
  photoUri: publicImageUrl(t.photoUri),
  type: t.truckType,
  plate: t.plateNumber,
  make: t.make,
  model: t.model,
  year: t.year,
  verification: t.verificationStatus,
  operational: t.operationalStatus,
  hasActiveJob: false, // no jobs yet
  documents: t.documents,
  rejectionReason: t.rejectionReason,
  history: t.history,
});

const toCompany = (c: ApiCompany): TowCompany => ({
  id: c.id,
  ownerEmail: c.ownerEmail,
  name: c.companyName,
  contactName: c.contactName,
  phone: c.phone,
  city: c.city,
  verification: c.verificationStatus,
  documents: c.documents,
});

/**
 * Vehicle fields plus files. Status/moderation fields can never be sent from here.
 * A photo or document is uploaded only when it is a newly picked local file; documents that already exist on the
 * server are sent without data (just their expiry date), so editing never forces a re-pick.
 */
async function toVehicleBody(i: TruckInput) {
  const body: Record<string, unknown> = {
    truckType: i.type,
    plateNumber: i.plate.trim(),
    make: i.make,
    model: i.model,
    year: i.year,
  };
  if (i.photoUri && !isServerFile(i.photoUri) && !i.photoUri.startsWith("http")) {
    body.photo = { name: fileNameOf(i.photoUri, "truck-photo.jpg"), dataBase64: await localFileToBase64(i.photoUri) };
  }
  body.documents = await Promise.all(
    i.documents.map(async (d) => {
      const expiresAt = d.expiresAt ? d.expiresAt.slice(0, 10) : null;
      return d.uri && !isServerFile(d.uri)
        ? { kind: d.kind, name: d.fileName || fileNameOf(d.uri, `${d.kind.toLowerCase()}.jpg`), dataBase64: await localFileToBase64(d.uri), expiresAt }
        : { kind: d.kind, expiresAt };
    })
  );
  return body;
}

// ---- Provider (TOW_PROVIDER). The actor argument is kept for the screens; the server uses the token. ----
export const towFleetService = {
  async getMyFleet(_actor: Actor) {
    const [c, t] = await Promise.all([
      api<{ company: ApiCompany }>("GET", "/tow/me/company"),
      api<{ trucks: ApiTruck[] }>("GET", "/tow/me/trucks"),
    ]);
    return { company: toCompany(c.company), trucks: t.trucks.map(toTruck) };
  },
  async getMyTruck(_actor: Actor, id: string) {
    const r = await api<{ truck: ApiTruck }>("GET", `/tow/me/trucks/${id}`);
    return toTruck(r.truck);
  },
  async addTruck(_actor: Actor, input: TruckInput) {
    const r = await api<{ truck: ApiTruck }>("POST", "/tow/me/trucks", await toVehicleBody(input));
    return toTruck(r.truck);
  },
  async updateTruck(_actor: Actor, id: string, input: TruckInput) {
    const r = await api<{ truck: ApiTruck }>("PATCH", `/tow/me/trucks/${id}`, await toVehicleBody(input));
    return toTruck(r.truck);
  },
  async removeTruck(_actor: Actor, id: string) {
    await api("DELETE", `/tow/me/trucks/${id}`);
    return true;
  },
};

// ---- Admin (SUPER_ADMIN or ADMIN + MANAGE_TOWING) ----
type AdminActor = Actor & { role: string; permissions: string[] };

export const towAdminService = {
  async listCompanies(_a: AdminActor): Promise<CompanyRow[]> {
    const r = await api<{ companies: (ApiCompany & { truckCount: number; pendingTruckCount: number })[] }>("GET", "/admin/tow/companies");
    return r.companies.map((c) => ({ ...toCompany(c), truckCount: c.truckCount, pendingTruckCount: c.pendingTruckCount }));
  },
  /** Also returns trucks so the list screen can search by plate / type. */
  async listTrucks(_a: AdminActor) {
    const r = await api<{ trucks: ApiTruck[] }>("GET", "/admin/tow/trucks");
    return r.trucks.map(toTruck);
  },
  async getCompany(_a: AdminActor, id: string) {
    const r = await api<{ company: ApiCompany; trucks: ApiTruck[] }>("GET", `/admin/tow/companies/${id}`);
    return { company: toCompany(r.company), trucks: r.trucks.map(toTruck) };
  },
  /** Admin may only decide. No field of the truck itself is editable here. */
  async decideTruck(_a: AdminActor, truckId: string, decision: { approve: true } | { approve: false; reason: string }) {
    const body = decision.approve ? { decision: "APPROVED" } : { decision: "REJECTED", reason: decision.reason.trim() };
    const r = await api<{ truck: ApiTruck }>("PATCH", `/admin/tow/trucks/${truckId}/decision`, body);
    return toTruck(r.truck);
  },
};
