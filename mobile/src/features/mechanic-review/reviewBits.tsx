import { Badge } from "../../components/ui/Badge";
import { useL } from "../../core/hooks/useL";
import type { Observation, ReviewStatus } from "./mechanicReviewService";

export function useReviewLabels() {
  const { t } = useL();
  const status: Record<ReviewStatus, string> = {
    PENDING_REVIEW: t("Pending", "قيد المراجعة"),
    NEEDS_CORRECTION: t("Needs correction", "يحتاج تصحيحًا"),
    MANUAL_REVIEW: t("Manual review", "مراجعة يدوية"),
    READY_FOR_AUTHORITY: t("Ready for authority", "جاهز للتحقق من الجهة"),
    REJECTED: t("Rejected", "مرفوض"),
  };
  const observation: Record<Observation, string> = {
    NOT_REVIEWED: t("Not reviewed", "لم تتم المراجعة"),
    INFORMATION_MATCHES: t("Information matches", "المعلومات مطابقة"),
    MISSING_INFORMATION: t("Missing information", "معلومات ناقصة"),
    DOCUMENT_UNREADABLE: t("Document unreadable", "المستند غير مقروء"),
    EXPIRED: t("Expired", "منتهي الصلاحية"),
    MANUAL_REVIEW_REQUIRED: t("Manual review required", "يتطلب مراجعة يدوية"),
  };
  const history: Record<string, string> = {
    SUBMITTED: t("Application submitted", "تم تقديم الطلب"),
    NEEDS_CORRECTION: t("Marked needs correction", "تم تحديده كيحتاج تصحيحًا"),
    MANUAL_REVIEW: t("Marked for manual review", "تم تحديده للمراجعة اليدوية"),
    READY_FOR_AUTHORITY: t("Marked ready for authority", "تم تحديده كجاهز للتحقق من الجهة"),
    REJECTED: t("Application rejected", "تم رفض الطلب"),
    SKILL_APPROVED: t("Skill approved", "تمت الموافقة على مهارة"),
    SKILL_REJECTED: t("Skill rejected", "تم رفض مهارة"),
    PRE_REVIEW_PROFESSIONAL: t("Professional pre-review noted", "تسجيل ملاحظة مراجعة مهنية"),
    PRE_REVIEW_WORKSHOP: t("Workshop pre-review noted", "تسجيل ملاحظة مراجعة الورشة"),
  };
  return { status, observation, history };
}

// "Ready" is deliberately not shown as verified: it only means internal review is complete.
export function ReviewStatusBadge({ value }: { value: ReviewStatus }) {
  const l = useReviewLabels().status;
  const m = {
    PENDING_REVIEW: { tone: "accent", icon: "time-outline" },
    NEEDS_CORRECTION: { tone: "accent", icon: "create-outline" },
    MANUAL_REVIEW: { tone: "neutral", icon: "eye-outline" },
    READY_FOR_AUTHORITY: { tone: "success", icon: "paper-plane-outline" },
    REJECTED: { tone: "danger", icon: "close-circle-outline" },
  } as const;
  return <Badge tone={m[value].tone} icon={m[value].icon} label={l[value]} />;
}

export function SkillStatusBadge({ value }: { value: "PENDING" | "APPROVED" | "REJECTED" }) {
  const { t } = useL();
  if (value === "APPROVED") return <Badge tone="success" icon="checkmark-circle-outline" label={t("Approved", "معتمدة")} />;
  if (value === "REJECTED") return <Badge tone="danger" icon="close-circle-outline" label={t("Rejected", "مرفوضة")} />;
  return <Badge tone="accent" icon="time-outline" label={t("Pending", "قيد المراجعة")} />;
}
