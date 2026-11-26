import { useL } from "../../core/hooks/useL";

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
