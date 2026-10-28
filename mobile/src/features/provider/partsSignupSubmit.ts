// Final submission of the parts shop signup: reads every staged file, sends ONE request, and (only on success) clears the in-memory draft.
// The server validates everything again and creates the account, shop and files in a single transaction, so a failure leaves nothing
// behind and the draft here stays intact for a retry.
import { api } from "../../core/config/api";
import { localFileToBase64 } from "../../core/constants/files";
import { PartsDocKind, PartsSignupFull, setPartsSignupDraft } from "./partsSignupDraft";

export const PARTS_KINDS: PartsDocKind[] = ["COMMERCIAL_REGISTRATION", "TRADE_LICENCE", "OWNER_ID", "STOREFRONT_PHOTO"];

export type PartsProblem = { step: "location" | "categories" | "documents"; text: [string, string] };
/** What is still missing (same rules as the steps and the server). */
export function partsSignupProblems(d: PartsSignupFull): PartsProblem[] {
  const out: PartsProblem[] = [];
  if (d.lat === undefined || d.lng === undefined) out.push({ step: "location", text: ["Confirm the shop location.", "أكّد موقع المتجر."] });
  if (d.categories.length === 0) out.push({ step: "categories", text: ["Choose at least one category.", "اختر فئة واحدة على الأقل."] });
  if (PARTS_KINDS.some((k) => !d.businessDocuments[k])) out.push({ step: "documents", text: ["A business document is missing.", "مستند من مستندات النشاط ناقص."] });
  return out;
}

export async function submitPartsSignup(d: PartsSignupFull) {
  if (d.lat === undefined || d.lng === undefined) throw new Error("Confirm the shop location.");
  const businessDocuments: Record<string, unknown> = {};
  for (const k of PARTS_KINDS) {
    const f = d.businessDocuments[k];
    if (f) businessDocuments[k] = { name: f.fileName, dataBase64: await localFileToBase64(f.uri) };
  }
  const res = await api<{ success: boolean; message: string; status: string }>("POST", "/auth/provider/parts-signup", {
    shopName: d.shopName,
    categories: d.categories,
    brandName: d.brandName,
    branchName: d.branchName,
    ownerName: d.ownerName,
    email: d.email,
    phoneNumber: d.phone,
    city: d.city,
    address: d.address,
    password: d.password,
    acceptTerms: true,
    location: { lat: d.lat, lng: d.lng, address: d.locationAddress ?? null, source: d.locationSource ?? null },
    businessDocuments,
  });
  setPartsSignupDraft(null); // success only: the password and every staged reference are dropped
  return res;
}
