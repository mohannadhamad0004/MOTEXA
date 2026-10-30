import { Badge } from "../../components/ui/Badge";
import { ImageTile } from "../../components/ui/Rows";
import { useL } from "../../core/hooks/useL";
import { Text } from "../../components/ui/Text";
import { useTheme } from "../../theme/useTheme";
import { View } from "react-native";
import { VerificationBadge } from "../shared/blocks";
import { Notice } from "../../components/ui/Feedback";
import type { Operational, Truck, TruckType } from "./towService";

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

/** Operational state. Deliberately a different shape/label from the verification badge. */
export function OperationalBadge({ value }: { value: Operational }) {
  const { t } = useL();
  const m = {
    AVAILABLE: { tone: "success", icon: "radio-button-on", label: t("Available", "متاح") },
    BUSY: { tone: "warning", icon: "navigate-outline", label: t("Busy", "مشغولة") },
    OUT_OF_SERVICE: { tone: "neutral", icon: "construct-outline", label: t("Out of service", "خارج الخدمة") },
  } as const;
  const k = m[value];
  return <Badge tone={k.tone} icon={k.icon} label={k.label} prefix={t("Status", "الحالة")} />;
}

/** Which documents are expired, as "Vehicle registration (expired 2026-01-01)". */
export const expiredList = (t: (en: string, ar: string) => string, truck: Truck) =>
  (truck.expiredDocuments ?? []).map((d) => `${docLabel(t, d.kind)} (${t("expired", "منتهي")} ${d.expiresAt.slice(0, 10)})`);

/** Truthful reason a truck gets no new work: its OWN documents expired. The company and its other trucks keep working. */
export function ExpiredNotice({ truck }: { truck: Truck }) {
  const { t, align } = useL();
  const list = expiredList(t, truck);
  if (!list.length) return null;
  return (
    <Notice tone="danger" icon="alert-circle-outline">
      {t("Truck documents expired: this truck cannot take new work until they are renewed.", "انتهت صلاحية مستندات الشاحنة: لا يمكنها استلام أعمال جديدة حتى يتم تجديدها.")}
      {"\n"}
      {list.join(t(", ", "، "))}
      {"\n"}
      {t("Your company and your other trucks are not affected. Jobs already accepted continue.", "شركتك وشاحناتك الأخرى غير متأثرة. الأعمال المقبولة سابقًا تستمر.")}
    </Notice>
  );
}

export function TruckSummary({ truck }: { truck: Truck }) {
  const { c: col } = useTheme();
  const { type } = useTruckLabels();
  const { t, row, align } = useL();
  return (
    <View style={[row, { gap: 14, alignItems: "center" }]}>
      <ImageTile uri={truck.photoUri} icon="car-sport-outline" size={64} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={[{ color: col.text, fontSize: 16, fontWeight: "800" }, align]}>
          {type[truck.type]} · {"⁦" + truck.plate + "⁩"}
        </Text>
        <Text numberOfLines={1} style={[{ color: col.textMuted, fontSize: 12, marginTop: 3 }, align]}>
          {[truck.make, truck.model, truck.year].filter(Boolean).join(" ")}
        </Text>
        <View style={[row, { flexWrap: "wrap", gap: 6, marginTop: 8 }]}>
          <VerificationBadge value={truck.verification} prefix={t("Approval", "الاعتماد")} />
          <OperationalBadge value={truck.operational} />
          {truck.expiredDocuments?.length ? <Badge tone="danger" icon="alert-circle-outline" label={t("Documents expired", "مستندات منتهية")} /> : null}
        </View>
      </View>
    </View>
  );
}

export const docLabel = (t: (en: string, ar: string) => string, k: "REGISTRATION" | "INSURANCE" | "OPERATING_LICENSE") =>
  k === "REGISTRATION" ? t("Vehicle registration", "ترخيص المركبة") : k === "OPERATING_LICENSE" ? t("Operating licence", "رخصة التشغيل") : t("Insurance", "التأمين");
