// Every label a provider or reviewer sees for onboarding, in English and Arabic. No raw enum text reaches a screen.
import type { TruckType } from "../tow/towService";

export type T = (en: string, ar: string) => string;

/** Server texts that carry both languages are stored as "English||العربية". */
export const bi = (ar: boolean, v: string) => {
  const [en, a] = v.split("||");
  return ar && a ? a : en;
};

const DOC: Record<string, [string, string]> = {
  COMMERCIAL_REGISTRATION: ["Commercial registration", "السجل التجاري"],
  OWNER_ID: ["Owner ID", "هوية المالك"],
  DRIVER_LICENCE: ["Driver licence", "رخصة السائق"],
  TRADE_LICENCE: ["Trade / municipal licence", "رخصة المهن / البلدية"],
  STOREFRONT_PHOTO: ["Storefront photo", "صورة واجهة المتجر"],
  TRUCK_PHOTO: ["Truck photo", "صورة الشاحنة"],
  TRUCK_REGISTRATION: ["Vehicle licence", "رخصة المركبة"],
  TRUCK_INSURANCE: ["Insurance", "التأمين"],
  TRUCK_OPERATING_LICENSE: ["Tow truck operating licence", "رخصة تشغيل شاحنة السحب"],
  OPERATING_LICENSE: ["Tow truck operating licence", "رخصة تشغيل شاحنة السحب"],
  REGISTRATION: ["Vehicle licence", "رخصة المركبة"],
  INSURANCE: ["Insurance", "التأمين"],
  TOW_COMPANY_DOCUMENT: ["Company document", "مستند الشركة"],
  PARTS_SHOP_DOCUMENT: ["Shop document", "مستند المتجر"],
};
export const docLabel = (t: T, kind: string) => (DOC[kind] ? t(...DOC[kind]) : t("Document", "مستند"));

export const truckTypeLabel = (t: T, k: TruckType | string) =>
  ({ FLATBED: t("Flatbed", "سطحة"), HOOK_CHAIN: t("Hook & chain", "خطاف وسلسلة"), WHEEL_LIFT: t("Wheel lift", "رافعة عجلات"), HEAVY_DUTY: t("Heavy duty", "خدمة ثقيلة") })[k as TruckType] ?? t("Truck", "شاحنة");

export const appStatusLabel = (t: T, s: string) =>
  ({
    DRAFT: t("Draft", "مسودة"),
    PENDING: t("Submitted", "تم الإرسال"),
    NEEDS_CHANGES: t("Needs changes", "مطلوب تعديلات"),
    APPROVED: t("Approved", "معتمد"),
    REJECTED: t("Rejected", "مرفوض"),
  })[s] ?? s;

export const docStatusLabel = (t: T, s: string) => ({ PENDING: t("Waiting", "بانتظار المراجعة"), ACCEPTED: t("Accepted", "مقبول"), REJECTED: t("Rejected", "مرفوض") })[s] ?? s;

const FIELD: Record<string, [string, string]> = {
  name: ["Business name", "اسم النشاط"],
  nameAr: ["Arabic name", "الاسم بالعربية"],
  ownerName: ["Owner name", "اسم المالك"],
  phone: ["Phone", "الهاتف"],
  city: ["City", "المدينة"],
  address: ["Address", "العنوان"],
  location: ["Map location", "الموقع على الخريطة"],
  workingHours: ["Working hours", "ساعات العمل"],
  serviceCities: ["Coverage cities", "مدن التغطية"],
  truckTypes: ["Truck types", "أنواع الشاحنات"],
  categories: ["Categories", "الفئات"],
  brands: ["Main brands", "العلامات التجارية"],
  truck: ["Trucks", "الشاحنات"],
  category: ["Categories", "الفئات"],
  truckCountClaimed: ["Number of trucks", "عدد الشاحنات"],
  open24h: ["Working hours", "ساعات العمل"],
};
/** A field key, a `doc:KIND` key (flagged / checklist / missing) or a `rejected:PURPOSE` key. */
export function keyLabel(t: T, key: string) {
  if (key.startsWith("doc:")) return docLabel(t, key.slice(4));
  if (key.startsWith("rejected:")) return `${docLabel(t, key.slice(9))} (${t("rejected", "مرفوض")})`;
  return FIELD[key] ? t(...FIELD[key]) : key;
}

const ACTION: Record<string, [string, string]> = {
  REGISTERED: ["Account created", "تم إنشاء الحساب"],
  SUBMITTED: ["Submitted for review", "أُرسل للمراجعة"],
  RESUBMITTED: ["Resubmitted", "أُعيد إرساله"],
  DOC_UPLOADED: ["Document uploaded", "تم رفع مستند"],
  DOC_REMOVED: ["Document removed", "تم حذف مستند"],
  DOC_ACCEPTED: ["Document accepted", "تم قبول مستند"],
  DOC_REJECTED: ["Document rejected", "تم رفض مستند"],
  CHANGES_REQUESTED: ["Changes requested", "طُلبت تعديلات"],
  APPROVED: ["Approved", "تمت الموافقة"],
  REJECTED: ["Rejected", "تم الرفض"],
};
export const actionLabel = (t: T, a: string) => (ACTION[a] ? t(...ACTION[a]) : a);

export const fmtDay = (iso?: string | null) => (iso ? iso.slice(0, 10) : "");
export const fmtTime = (iso?: string | null) => (iso ? `${iso.slice(0, 10)} ${iso.slice(11, 16)}` : "");
