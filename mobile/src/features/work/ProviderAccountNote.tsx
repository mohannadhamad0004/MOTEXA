// Work with MOTEXA: one account has one role. Said before applying and again before submitting (only to customer applicants).
import { Note } from "../../components/garage";
import { useL } from "../../core/hooks/useL";
import { useSessionUser } from "../../core/session/session";

export type WorkKind = "MECHANIC" | "TOW" | "PARTS";
type T = (en: string, ar: string) => string;

export const workKindLabel = (t: T, k: WorkKind) =>
  k === "MECHANIC" ? t("Mechanic", "ميكانيكي") : k === "TOW" ? t("Tow company", "شركة سحب") : t("Parts shop", "متجر قطع غيار");

export const providerAccountText = (t: T, k: WorkKind) =>
  t(
    `After approval, this account becomes a ${k === "MECHANIC" ? "mechanic" : k === "TOW" ? "tow company" : "parts shop"} account: the customer screens (tow and mechanic requests, parts orders, My Garage) are no longer available on it. To keep booking as a customer, use a separate email.`,
    `بعد الموافقة يصبح هذا الحساب حساب ${k === "MECHANIC" ? "ميكانيكي" : k === "TOW" ? "شركة سحب" : "متجر قطع غيار"}: لن تبقى شاشات الزبون (طلبات السحب والميكانيكي وطلبات القطع وكراجي) متاحة عليه. لمتابعة الحجز كزبون استخدم بريدًا إلكترونيًا آخر.`,
  );

/** Label + tone of an application status (mechanic and provider status names). */
export function applicationStatus(t: T, s: string): [string, "neutral" | "accent" | "warning" | "success" | "danger"] {
  if (s === "DRAFT") return [t("Not submitted yet", "لم يُرسل بعد"), "neutral"];
  if (s === "PENDING") return [t("Under review", "قيد المراجعة"), "accent"];
  if (s === "NEEDS_CHANGES" || s === "NEEDS_COMPLETION") return [t("Changes requested", "مطلوب تعديلات"), "warning"];
  if (s === "APPROVED" || s === "VERIFIED") return [t("Approved", "مقبول"), "success"];
  if (s === "SUSPENDED") return [t("Suspended", "موقوف"), "danger"];
  return [t("Rejected", "مرفوض"), "danger"];
}

/** In the application wizards, before Submit: shown to a customer applicant only. */
export function ProviderAccountNote({ kind }: { kind: WorkKind }) {
  const { t } = useL();
  if (useSessionUser().role !== "CUSTOMER") return null;
  return <Note icon="person-circle-outline">{providerAccountText(t, kind)}</Note>;
}
