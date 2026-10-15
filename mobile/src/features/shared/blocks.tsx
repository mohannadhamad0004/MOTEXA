import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { C } from "./palette";
import { Badge, Card, KV, Section, useL } from "./ui";

type V = "PENDING" | "APPROVED" | "REJECTED";

export function VerificationBadge({ value, prefix }: { value: V; prefix?: string }) {
  const { t } = useL();
  const map = {
    PENDING: { tone: "accent", icon: "time-outline", label: t("Pending", "قيد المراجعة") },
    APPROVED: { tone: "success", icon: "shield-checkmark-outline", label: t("Approved", "معتمد") },
    REJECTED: { tone: "danger", icon: "close-circle-outline", label: t("Rejected", "مرفوض") },
  } as const;
  const m = map[value];
  return <Badge tone={m.tone} icon={m.icon} label={m.label} prefix={prefix} />;
}

export const fmtDate = (iso?: string | null) => (iso ? iso.slice(0, 10) : "");
export const isExpired = (iso?: string | null) => !!iso && new Date(iso).getTime() < Date.now();

type Entry = { at: string; actor: string; action: string; reason?: string; danger?: boolean };

export function HistoryList({ items }: { items: Entry[] }) {
  const { t, row, align } = useL();
  const label: Record<string, string> = {
    SUBMITTED: t("Submitted", "تم التقديم"),
    APPROVED: t("Approved", "تمت الموافقة"),
    REJECTED: t("Rejected", "تم الرفض"),
  };
  return (
    <Card>
      {[...items].reverse().map((h, i) => (
        <View key={i} style={{ paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: "rgba(217,155,105,0.10)" }}>
          <View style={[row, { justifyContent: "space-between", gap: 10 }]}>
            <Text style={{ color: C.text, fontSize: 13, fontWeight: "800" }}>{label[h.action] ?? h.action}</Text>
            <Text style={{ color: C.textDim, fontSize: 11 }}>{fmtDate(h.at)}</Text>
          </View>
          <Text style={[{ color: C.textMuted, fontSize: 12, marginTop: 2 }, align]}>{h.actor}</Text>
          {h.reason ? <Text style={[{ color: h.danger === false ? C.textMuted : C.danger, fontSize: 12, marginTop: 4 }, align]}>{h.reason}</Text> : null}
        </View>
      ))}
    </Card>
  );
}

/** Private verification documents: file names only, shown to admin and the owning provider. */
export function PrivateDocs({
  title,
  docs,
}: {
  title: string;
  docs: { label: string; fileName: string; expiresAt?: string | null }[];
}) {
  const { t, row } = useL();
  return (
    <>
      <Section title={title} />
      <Card>
        {docs.map((d, i) => {
          const expired = isExpired(d.expiresAt);
          return (
            <View key={i} style={[row, { alignItems: "center", gap: 12, paddingVertical: 8 }]}>
              <Ionicons name="document-lock-outline" size={22} color={C.accent} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontSize: 13, fontWeight: "700" }}>{d.label}</Text>
                <Text numberOfLines={1} style={{ color: C.textDim, fontSize: 11, marginTop: 2 }}>
                  {d.fileName}
                  {d.expiresAt ? ` · ${t("expires", "ينتهي")} ${fmtDate(d.expiresAt)}` : ""}
                </Text>
              </View>
              {expired && <Badge tone="danger" label={t("Expired", "منتهية")} icon="alert-circle-outline" />}
            </View>
          );
        })}
        <Text style={{ color: C.textDim, fontSize: 11, marginTop: 8 }}>
          {t("Private: visible only to MOTEXA admins and the owner.", "خاصة: تظهر فقط لمسؤولي MOTEXA والمالك.")}
        </Text>
      </Card>
    </>
  );
}

export { KV };
