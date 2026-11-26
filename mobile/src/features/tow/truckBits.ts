import { useL } from "../../core/hooks/useL";
import type { Truck, TruckType } from "./towService";

export function useTruckLabels() {
  const { t } = useL();
  const type: Record<TruckType, string> = {
    FLATBED: t("Flatbed", "سطحة"),
    HOOK_CHAIN: t("Hook & chain", "خطاف وسلسلة"),
    WHEEL_LIFT: t("Wheel lift", "رافعة عجلات"),
    HEAVY_DUTY: t("Heavy duty", "خدمة ثقيلة"),
  };
  return { type };
}

/** Which documents are expired, as "Vehicle registration (expired 2026-01-01)". */
export const expiredList = (t: (en: string, ar: string) => string, truck: Truck) =>
  (truck.expiredDocuments ?? []).map((d) => `${docLabel(t, d.kind)} (${t("expired", "منتهي")} ${d.expiresAt.slice(0, 10)})`);

export const docLabel = (t: (en: string, ar: string) => string, k: "REGISTRATION" | "INSURANCE" | "OPERATING_LICENSE") =>
  k === "REGISTRATION" ? t("Vehicle registration", "ترخيص المركبة") : k === "OPERATING_LICENSE" ? t("Operating licence", "رخصة التشغيل") : t("Insurance", "التأمين");
