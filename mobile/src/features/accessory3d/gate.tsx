// The accessory quality gate of a car model, in words (EN / AR): shown in the import review before publishing and in the Parts Admin's
// part-map list. Codes come from the backend (car-part-map accessoryGate); numbers are written without a sign (RTL safe).
import { View } from "react-native";
import { GText, StatusChip } from "../../components/garage";
import { useL } from "../../core/hooks/useL";
import { gType } from "../../theme/garage";
import { ACCESSORY_TYPE_LABELS, type ModelGate } from "./api";

const PROBLEM: Record<ModelGate["problems"][number]["code"], [string, string]> = {
  LENGTH: ["Length {v} m is not a car's (2.5–6.5 m)", "الطول {v} م ليس طول سيارة (2.5–6.5 م)"],
  WIDTH: ["Width {v} m is not a car's (1.4–2.7 m)", "العرض {v} م ليس عرض سيارة (1.4–2.7 م)"],
  HEIGHT: ["Height {v} m is not a car's (1.0–3.2 m)", "الارتفاع {v} م ليس ارتفاع سيارة (1.0–3.2 م)"],
  SHAPE: ["Width / length {v} is not a car's shape", "نسبة العرض إلى الطول {v} ليست شكل سيارة"],
  WHEEL_SIZE: ["A wheel is {v} m across (real wheels 0.45–1.2 m)", "قطر إحدى العجلات {v} م (العجلات الحقيقية 0.45–1.2 م)"],
  WHEELS_IN_AIR: ["Part of the model hangs {v} mm below its tyres", "جزء من النموذج أخفض من الإطارات بمقدار {v} مم"],
};
const LIMIT: Record<NonNullable<ModelGate["limited"][keyof ModelGate["limited"]]>, [string, string]> = {
  NOT_SEPARATE: ["not a separate piece", "ليست قطعة منفصلة"], WHEELS_NOT_FOUND: ["the four wheels are not separate pieces", "العجلات الأربع ليست قطعًا منفصلة"],
  NEEDS_WHEELS: ["needs the four wheels", "تحتاج العجلات الأربع"], SINGLE_PIECE: ["the whole car is one piece", "السيارة كلها قطعة واحدة"],
};
export function GateSummary({ gate }: { gate: ModelGate | null | undefined }) {
  const { t, align } = useL();
  if (!gate) return <GText soft style={[gType.caption, align]}>{t("Accessory check: not measured yet", "فحص الإكسسوارات: لم يُقَس بعد")}</GText>;
  const label = gate.verdict === "FULL" ? t("Full accessories", "إكسسوارات كاملة") : gate.verdict === "LIMITED" ? t("Limited accessories", "إكسسوارات محدودة") : t("Model rejected", "النموذج مرفوض");
  return <View style={{ gap: 4 }}>
    <StatusChip label={label} tone={gate.verdict === "FULL" ? "success" : gate.verdict === "LIMITED" ? "warning" : "danger"} />
    {gate.problems.map(p => <GText key={p.code} style={[gType.caption, align]}>{t(...PROBLEM[p.code]).replace("{v}", String(Math.abs(p.value)))}</GText>)}
    {(gate.warnings ?? []).map(p => <GText key={"w" + p.code} soft style={[gType.caption, align]}>{`${t("Warning", "تنبيه")}: ${t(...PROBLEM[p.code]).replace("{v}", String(Math.abs(p.value)))}`}</GText>)}
    {Object.entries(gate.limited).map(([type, code]) => <GText key={type} soft style={[gType.caption, align]}>
      {`${t(...(ACCESSORY_TYPE_LABELS[type as keyof typeof ACCESSORY_TYPE_LABELS] ?? [type, type]))}: ${t(...LIMIT[code!])}`}</GText>)}
  </View>;
}
