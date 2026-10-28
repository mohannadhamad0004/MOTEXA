// In-memory draft of the parts shop signup. One account = one physical shop / branch; the brand and branch name are optional labels
// (no parent company or branch relationships). Nothing is sent to the server yet. Never persisted to disk (it holds a password);
// gone when the app closes.
import type { StagedDoc } from "./towSignupDraft";

export type PartsSignupDraft = {
  shopName: string;
  brandName: string | null;
  branchName: string | null;
  ownerName: string;
  phone: string;
  email: string;
  password: string;
  city: string;
  address: string;
};

/** Step 2: the shop's own confirmed place. Latitude + longitude are the source of truth; the address text is only a readable label. */
export type PartsSignupPlace = { lat: number; lng: number; locationAddress: string | null; locationSource: "current_location" | "manual" };
/** Step 3: the documents the backend already requires for a parts shop (commercial registration, trade licence, owner ID) plus the storefront photo it requires before submitting. None expires in the current workflow, so no expiry date is asked. Each is a local file reference until the final step uploads it. */
export type PartsDocKind = "COMMERCIAL_REGISTRATION" | "TRADE_LICENCE" | "OWNER_ID" | "STOREFRONT_PHOTO";
export type PartsSignupFull = PartsSignupDraft & Partial<PartsSignupPlace> & {
    /** Step 3: the catalogue category keys this shop sells (the same keys the backend validates and PartsShopProfile.categories stores) */
    categories: string[];
    businessDocuments: Partial<Record<PartsDocKind, StagedDoc>>;
  };

let draft: PartsSignupFull | null = null;
export const getPartsSignupDraft = () => draft;
/** Step 1 saves its fields and keeps a location confirmed earlier. */
export const setPartsSignupDraft = (d: PartsSignupDraft | null) => {
  draft = d ? { ...d, lat: draft?.lat, lng: draft?.lng, locationAddress: draft?.locationAddress, locationSource: draft?.locationSource, categories: draft?.categories ?? [], businessDocuments: draft?.businessDocuments ?? {} } : null;
};
export const setPartsSignupLocation = (l: PartsSignupPlace) => {
  if (draft) draft = { ...draft, ...l };
};

/** Step 3: set (or clear, with null) one business document. */
export const setPartsDoc = (kind: PartsDocKind, doc: StagedDoc | null) => {
  if (!draft) return;
  const { [kind]: _old, ...rest } = draft.businessDocuments;
  draft = { ...draft, businessDocuments: doc ? { ...rest, [kind]: doc } : rest };
};

/** Step 3: replace the selected category keys. */
export const setPartsCategories = (categories: string[]) => {
  if (draft) draft = { ...draft, categories };
};
