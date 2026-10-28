// Final submission of the tow signup: reads every staged file, sends ONE request, and (only on success) clears the in-memory draft.
// The server validates everything again and creates the account, company, trucks and files in a single transaction, so a failure leaves
// nothing behind and the draft here stays intact for a retry.
import { api } from "../../core/config/api";
import { localFileToBase64 } from "../../core/constants/files";
import { CompanyDocKind, StagedDoc, TowSignupFull, parseExpiry, setTowSignupDraft } from "./towSignupDraft";

export const COMPANY_KINDS: CompanyDocKind[] = ["COMMERCIAL_REGISTRATION", "OWNER_ID", "DRIVER_LICENCE"];

/** What is still missing or wrong, in the order of the steps ("" step = nothing). Same rules as the steps and the server. */
export type Problem = { step: "company" | "location" | "trucks" | "documents"; text: [string, string] };
export function towSignupProblems(d: TowSignupFull): Problem[] {
  const out: Problem[] = [];
  if (d.baseLat === undefined || d.baseLng === undefined) out.push({ step: "location", text: ["Confirm the company location.", "أكّد موقع الشركة."] });
  if (d.trucks.length === 0) out.push({ step: "trucks", text: ["Add at least one tow truck.", "أضف شاحنة سحب واحدة على الأقل."] });
  for (const k of COMPANY_KINDS) if (!d.companyDocuments[k]) out.push({ step: "documents", text: ["A company document is missing.", "مستند من مستندات الشركة ناقص."] });
  for (const t of d.trucks) {
    const docs = d.truckDocuments[t.localId] ?? {};
    for (const kind of ["registration", "license"] as const) {
      const doc = docs[kind];
      const p = doc?.expiresAt ? parseExpiry(doc.expiresAt) : null;
      if (!doc || !p?.ok) out.push({ step: "documents", text: [`${t.plateNumber}: a document or its expiry date is missing.`, `${t.plateNumber}: مستند أو تاريخ انتهائه ناقص.`] });
      else if (p.expired) out.push({ step: "documents", text: [`${t.plateNumber}: a document has already expired.`, `${t.plateNumber}: انتهت صلاحية أحد المستندات.`] });
    }
  }
  return out;
}

const file = async (d: StagedDoc, withExpiry = false) => ({ name: d.fileName, dataBase64: await localFileToBase64(d.uri), ...(withExpiry ? { expiresAt: d.expiresAt } : {}) });

export async function submitTowSignup(d: TowSignupFull) {
  if (d.baseLat === undefined || d.baseLng === undefined) throw new Error("Confirm the company location.");
  const companyDocuments: Record<string, unknown> = {};
  for (const k of COMPANY_KINDS) if (d.companyDocuments[k]) companyDocuments[k] = await file(d.companyDocuments[k]!);
  const trucks = [];
  for (const t of d.trucks) {
    const docs = d.truckDocuments[t.localId] ?? {}; // keyed by localId, never by position
    trucks.push({
      localId: t.localId,
      plateNumber: t.plateNumber,
      truckType: t.truckType,
      make: t.make,
      model: t.model,
      location: { lat: t.baseLat, lng: t.baseLng, address: t.locationAddress, source: t.locationSource },
      photo: { name: t.photoUri.split("?")[0].split("/").pop() || "truck-photo.jpg", dataBase64: await localFileToBase64(t.photoUri) },
      registration: docs.registration ? await file(docs.registration, true) : undefined,
      license: docs.license ? await file(docs.license, true) : undefined,
    });
  }
  const res = await api<{ success: boolean; message: string; status: string }>("POST", "/auth/provider/tow-signup", {
    businessName: d.businessName,
    fullName: d.fullName,
    email: d.email,
    phoneNumber: d.phone,
    city: d.city,
    address: d.address,
    password: d.password,
    acceptTerms: true,
    location: { lat: d.baseLat, lng: d.baseLng, address: d.locationAddress ?? null, source: d.locationSource ?? null },
    companyDocuments,
    trucks,
  });
  setTowSignupDraft(null); // success only: the password and every staged reference are dropped
  return res;
}
