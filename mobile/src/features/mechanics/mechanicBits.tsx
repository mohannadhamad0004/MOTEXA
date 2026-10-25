import { Avatar, Ltr, Rise } from "../../components/blueprint";
import { M } from "../../motion";
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
  const tone = { REQUESTED: "warning", ACCEPTED: "success", IN_PROGRESS: "success", COMPLETED: "success", DECLINED: "danger", CANCELLED: "danger" } as const;
  const icon = { REQUESTED: "time-outline", ACCEPTED: "checkmark-circle-outline", IN_PROGRESS: "construct-outline", COMPLETED: "flag-outline", DECLINED: "close-circle-outline", CANCELLED: "close-circle-outline" } as const;
  return <Badge tone={tone[value]} icon={icon[value]} label={label[value]} />;
}

/** One line per step that really happened, with its time. */
export function MechanicTimeline({ items }: { items: { status: MechanicRequestStatus; at: string }[] }) {
  const label = useMechanicStatusLabels();
  return <StatusTimeline items={items.map((it) => ({ key: it.status, label: label[it.status], at: fmtDateTime(it.at) }))} />;
}

/** The first letter of the name on a round blueprint tile. */
export function InitialAvatar({ name, size = 48 }: { name: string; size?: number }) {
  return <Avatar name={name} size={size} />;
}

export function VerifiedBadge() {
  const { t } = useL();
  return <Badge tone="success" icon="shield-checkmark-outline" label={t("Verified by MOTEXA", "موثّق من MOTEXA")} />;
}

/** Up to `max` skill pills and a bordered "+N" for the rest. */
export function SkillBadges({ skills, max = 3, after }: { skills: string[]; max?: number; /** ms: chips fade in one by one (35 ms apart) starting after this delay */ after?: number }) {
  const { c } = useTheme();
  const { row } = useL();
  const label = useSkillLabel();
  return (
    <View style={[row, { flexWrap: "wrap", gap: 6 }]}>
      {skills.slice(0, max).map((s, k) => (
        <Rise key={s} i={after === undefined ? 99 : 0} delay={(after ?? 0) + k * M.staggerFine} distance={4}>
          <View style={{ borderRadius: 999, backgroundColor: c.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: c.ink, fontSize: 11, fontWeight: "600" }}>{label(s)}</Text>
          </View>
        </Rise>
      ))}
      {skills.length > max ? (
        <View style={{ borderRadius: 999, borderWidth: 1, borderColor: c.line, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Ltr style={{ color: c.soft, fontSize: 11 }}>{`+${skills.length - max}`}</Ltr>
        </View>
      ) : null}
    </View>
  );
}
