import { Badge } from "../../components/ui/Badge";
import { Text } from "../../components/ui/Text";
import { StatusTimeline } from "../../components/ui/StatusTimeline";
import { useL } from "../../core/hooks/useL";
import { useTheme } from "../../theme/useTheme";
import { View } from "react-native";
import { fmtDateTime } from "../requests/requestBits";
import type { MechanicRequestStatus } from "./mechanicsService";

const SKILL_AR: Record<string, string> = {
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
    IN_PROGRESS: t("In progress", "قيد التنفيذ"),
    COMPLETED: t("Completed", "مكتمل"),
    DECLINED: t("Declined", "مرفوض"),
    CANCELLED: t("Cancelled", "ملغى"),
  };
  return label;
}

export function MechanicStatusBadge({ value }: { value: MechanicRequestStatus }) {
  const label = useMechanicStatusLabels();
  const tone = { REQUESTED: "accent", ACCEPTED: "success", IN_PROGRESS: "success", COMPLETED: "success", DECLINED: "danger", CANCELLED: "danger" } as const;
  const icon = { REQUESTED: "time-outline", ACCEPTED: "checkmark-circle-outline", IN_PROGRESS: "construct-outline", COMPLETED: "flag-outline", DECLINED: "close-circle-outline", CANCELLED: "close-circle-outline" } as const;
  return <Badge tone={tone[value]} icon={icon[value]} label={label[value]} />;
}

/** One line per step that really happened, with its time. */
export function MechanicTimeline({ items }: { items: { status: MechanicRequestStatus; at: string }[] }) {
  const label = useMechanicStatusLabels();
  return <StatusTimeline items={items.map((it) => ({ key: it.status, label: label[it.status], at: fmtDateTime(it.at) }))} />;
}

/** The first letter of the name in an accent circle. */
export function InitialAvatar({ name, size = 48 }: { name: string; size?: number }) {
  const { c } = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.accentSoft, borderWidth: 1, borderColor: c.accentBorder, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: c.accent, fontSize: size * 0.42, fontWeight: "800" }}>{name.trim().charAt(0).toUpperCase()}</Text>
    </View>
  );
}

export function VerifiedBadge() {
  const { t } = useL();
  return <Badge tone="success" icon="shield-checkmark-outline" label={t("Verified by MOTEXA", "موثّق من MOTEXA")} />;
}

/** Up to `max` skill badges and a "+N" for the rest. */
export function SkillBadges({ skills, max = 3 }: { skills: string[]; max?: number }) {
  const { row } = useL();
  const label = useSkillLabel();
  return (
    <View style={[row, { flexWrap: "wrap", gap: 6 }]}>
      {skills.slice(0, max).map((s) => (
        <Badge key={s} tone="accent" label={label(s)} />
      ))}
      {skills.length > max ? <Badge tone="neutral" label={`+${skills.length - max}`} /> : null}
    </View>
  );
}
