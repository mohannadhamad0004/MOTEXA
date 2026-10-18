import { Badge } from "../../components/ui/Badge";
import { ImageTile } from "../../components/ui/Rows";
import { useL } from "../../core/hooks/useL";
import { Text } from "../../components/ui/Text";
import { useTheme } from "../../theme/useTheme";
import { View } from "react-native";
import { VerificationBadge } from "../shared/blocks";
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
    BUSY: { tone: "accent", icon: "navigate-outline", label: t("Busy", "مشغولة") },
    OUT_OF_SERVICE: { tone: "neutral", icon: "construct-outline", label: t("Out of service", "خارج الخدمة") },
  } as const;
  const k = m[value];
  return <Badge tone={k.tone} icon={k.icon} label={k.label} prefix={t("Status", "الحالة")} />;
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
        </View>
      </View>
    </View>
  );
}

export const docLabel = (t: (en: string, ar: string) => string, k: "REGISTRATION" | "INSURANCE") =>
  k === "REGISTRATION" ? t("Vehicle registration", "ترخيص المركبة") : t("Insurance", "التأمين");
