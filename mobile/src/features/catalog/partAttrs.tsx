
export type PartCondition = "NEW" | "USED" | "REFURBISHED";
export type PartType = "OEM" | "AFTERMARKET";

export const CONDITIONS: PartCondition[] = ["NEW", "USED", "REFURBISHED"];
export const PART_TYPES: PartType[] = ["OEM", "AFTERMARKET"];

export function usePartLabels() {
  const { t } = useL();
  const condition: Record<PartCondition, string> = {
    NEW: t("New", "جديدة"),
    USED: t("Used", "مستعملة"),
    REFURBISHED: t("Refurbished", "مجددة"),
  };
  const type: Record<PartType, string> = {
    OEM: t("Genuine OEM", "أصلية (OEM)"),
    AFTERMARKET: t("Aftermarket", "بديلة"),
  };
  return { condition, type, notSpecified: t("Not specified", "غير محدد") };
}

/** "Used" / "Refurbished". Nothing for a new part. */
export function ConditionBadge({ value }: { value: PartCondition }) {
  const { condition } = usePartLabels();
  if (value === "NEW") return null;
  return <Badge tone={value === "USED" ? "neutral" : "accent"} icon={value === "USED" ? "time-outline" : "refresh-outline"} label={condition[value]} />;
}import { Badge } from "../../components/ui/Badge";
import { useL } from "../../core/hooks/useL";

