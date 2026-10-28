// In-memory draft of the tow company signup. The account is NOT created yet: POST /auth/provider/register creates the user and the
// company profile in one call, so the last step of the flow sends it once, with everything collected here. Never persisted to disk
// (it holds a password); gone when the app closes.
import type { TruckType } from "../tow/towService";

export type TowSignupDraft = { businessName: string; fullName: string; phone: string; email: string; password: string; city: string; address: string };

/** A confirmed place: latitude + longitude are the source of truth, the address text is only a readable label. */
export type TowSignupPlace = { baseLat: number; baseLng: number; locationAddress: string | null; locationSource: "current_location" | "manual" };

/** Step 3: one truck. `localId` is its stable identity (Step 4 attaches documents to it); never use the array index. */
export type TowSignupTruck = TowSignupPlace & { localId: string; photoUri: string; plateNumber: string; truckType: TruckType; make: string; model: string };

/** Step 4: a file picked on this device (a local reference only, uploaded by the final step) and, where it expires, its date as YYYY-MM-DD. */
export type StagedDoc = { uri: string; fileName: string; mimeType?: string | null; expiresAt?: string };
/** Company documents the backend already requires for a tow company (COMPANY_DOC_KINDS.TOW). */
export type CompanyDocKind = "COMMERCIAL_REGISTRATION" | "OWNER_ID" | "DRIVER_LICENCE";
export type TruckDocKind = "registration" | "license";
export type TowSignupTruckDocs = Partial<Record<TruckDocKind, StagedDoc>>;

export type TowSignupFull = TowSignupDraft &
  Partial<TowSignupPlace> & {
    trucks: TowSignupTruck[];
    companyDocuments: Partial<Record<CompanyDocKind, StagedDoc>>;
    /** keyed by the truck's localId, never by position */
    truckDocuments: Record<string, TowSignupTruckDocs>;
  };

let draft: TowSignupFull | null = null;
export const getTowSignupDraft = () => draft;

/** Step 1 saves its fields and keeps the location and trucks chosen later. */
export const setTowSignupDraft = (d: TowSignupDraft | null) => {
  draft = d ? { ...d, baseLat: draft?.baseLat, baseLng: draft?.baseLng, locationAddress: draft?.locationAddress, locationSource: draft?.locationSource, trucks: draft?.trucks ?? [], companyDocuments: draft?.companyDocuments ?? {}, truckDocuments: draft?.truckDocuments ?? {} } : null;
};
/** Step 2: the company base. */
export const setTowSignupLocation = (l: TowSignupPlace) => {
  if (draft) draft = { ...draft, ...l };
};

let seq = 0;
export const newTruckId = () => `truck-${Date.now().toString(36)}-${(seq++).toString(36)}`;

/** Step 3: add a truck, or replace the one with the same localId. */
export const saveTowSignupTruck = (t: TowSignupTruck) => {
  if (!draft) return;
  const has = draft.trucks.some((x) => x.localId === t.localId);
  draft = { ...draft, trucks: has ? draft.trucks.map((x) => (x.localId === t.localId ? t : x)) : [...draft.trucks, t] };
};
export const removeTowSignupTruck = (localId: string) => {
  if (!draft) return;
  const { [localId]: _gone, ...rest } = draft.truckDocuments; // a removed truck takes its documents with it
  draft = { ...draft, trucks: draft.trucks.filter((x) => x.localId !== localId), truckDocuments: rest };
};

/** Step 4: set (or clear, with null) one company document. */
export const setTowCompanyDoc = (kind: CompanyDocKind, doc: StagedDoc | null) => {
  if (!draft) return;
  const { [kind]: _old, ...rest } = draft.companyDocuments;
  draft = { ...draft, companyDocuments: doc ? { ...rest, [kind]: doc } : rest };
};
/** Step 4: set (or clear, with null) one document of one truck. */
export const setTowTruckDoc = (localId: string, kind: TruckDocKind, doc: StagedDoc | null) => {
  if (!draft) return;
  const { [kind]: _old, ...rest } = draft.truckDocuments[localId] ?? {};
  draft = { ...draft, truckDocuments: { ...draft.truckDocuments, [localId]: doc ? { ...rest, [kind]: doc } : rest } };
};

/** YYYY-MM-DD that is a real calendar date, and whether it is already in the past (today still counts as valid). */
export const parseExpiry = (v: string): { ok: boolean; expired: boolean } => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return { ok: false, expired: false };
  const [y, mo, da] = v.split("-").map(Number);
  const d = new Date(y, mo - 1, da);
  if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== da) return { ok: false, expired: false };
  const now = new Date();
  return { ok: true, expired: d.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() };
};
