import type { Tone } from "../../components/garage";
import { useL } from "../../core/hooks/useL";
import type { MechanicRequestStatus } from "./mechanicsService";

export const SKILL_AR: Record<string, string> = {
  Engine: "المحرك",
  Brakes: "الفرامل",
  Electrical: "الكهرباء",
  Diagnostics: "الفحص والتشخيص",
  "Air conditioning": "التكييف",
  Transmission: "ناقل الحركة",
  "Suspension & steering": "التعليق والمقود",
  Bodywork: "هيكل السيارة",
};

/** Skill name in the current language; a name this app does not know passes through. */
export function useSkillLabel() {
  const { isArabic } = useL();
  return (name: string) => (isArabic ? (SKILL_AR[name] ?? name) : name);
}

export function useMechanicStatusLabels() {
  const { t } = useL();
  const label: Record<MechanicRequestStatus, string> = {
    REQUESTED: t("Requested", "تم الطلب"),
    ACCEPTED: t("Accepted", "تم القبول"),
    EN_ROUTE: t("On the way", "في الطريق"),
    ARRIVED: t("Arrived", "وصل"),
    IN_PROGRESS: t("In progress", "قيد التنفيذ"),
    COMPLETED: t("Completed", "مكتمل"),
    DECLINED: t("Declined", "مرفوض"),
    CANCELLED: t("Cancelled", "ملغى"),
  };
  return label;
}

/** The steps of a request: on site the mechanic goes on the way and arrives before starting; a workshop visit starts after accepting. */
export const pathOf = (mode: string | null): MechanicRequestStatus[] =>
  mode === "ON_SITE" ? ["REQUESTED", "ACCEPTED", "EN_ROUTE", "ARRIVED", "IN_PROGRESS", "COMPLETED"] : ["REQUESTED", "ACCEPTED", "IN_PROGRESS", "COMPLETED"];

/** A mechanic application's status as the shared chip (mechanic home and the Mechanics admin use the same words). */
const APP: Record<string, [Tone, string, string]> = {
  DRAFT: ["neutral", "Draft", "مسودة"], PENDING: ["accent", "Under review", "قيد المراجعة"], NEEDS_COMPLETION: ["warning", "Needs completion", "يحتاج استكمالًا"],
  VERIFIED: ["success", "Approved", "معتمد"], REJECTED: ["danger", "Rejected", "مرفوض"], SUSPENDED: ["warning", "Suspended", "معلّق"],
};
export function mechanicAppStatus(status: string, t: (en: string, ar: string) => string): { label: string; tone: Tone } {
  const [tone, en, ar] = APP[status] ?? APP.DRAFT!;
  return { label: t(en, ar), tone };
}
