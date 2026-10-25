import { Resolved } from "../../components/blueprint";
import { Text } from "../../components/ui/Text";
import { useTheme } from "../../theme/useTheme";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, SafeAreaView, TouchableOpacity, View } from "react-native";
import { privateImageSource } from "./api";
import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import { IconButton } from "../../components/ui/IconButton";
import { KV } from "../../components/ui/Rows";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { useL } from "../../core/hooks/useL";

type V = "PENDING" | "APPROVED" | "REJECTED";

export function VerificationBadge({ value, prefix }: { value: V; prefix?: string }) {
  const { t } = useL();
  const map = {
    PENDING: { tone: "warning", icon: "time-outline", label: t("Pending", "قيد المراجعة") },
    APPROVED: { tone: "success", icon: "shield-checkmark-outline", label: t("Approved", "معتمد") },
    REJECTED: { tone: "danger", icon: "close-circle-outline", label: t("Rejected", "مرفوض") },
  } as const;
  const m = map[value];
  return (
    <Resolved k={value} kind={value === "APPROVED" ? "check" : value === "REJECTED" ? "x" : null}>
      <Badge tone={m.tone} icon={m.icon} label={m.label} prefix={prefix} />
    </Resolved>
  );
}

export const fmtDate = (iso?: string | null) => (iso ? iso.slice(0, 10) : "");
export const isExpired = (iso?: string | null) => !!iso && new Date(iso).getTime() < Date.now();

type Entry = { at: string; actor: string; action: string; reason?: string; danger?: boolean };

export function HistoryList({ items }: { items: Entry[] }) {
  const { c: col } = useTheme();
  const { t, row, align } = useL();
  const label: Record<string, string> = {
    SUBMITTED: t("Submitted", "تم التقديم"),
    APPROVED: t("Approved", "تمت الموافقة"),
    REJECTED: t("Rejected", "تم الرفض"),
  };
  return (
    <Card>
      {[...items].reverse().map((h, i) => (
        <View key={i} style={{ paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: col.border }}>
          <View style={[row, { justifyContent: "space-between", gap: 10 }]}>
            <Text style={{ color: col.text, fontSize: 13, fontWeight: "800" }}>{label[h.action] ?? h.action}</Text>
            <Text style={{ color: col.textDim, fontSize: 11 }}>{fmtDate(h.at)}</Text>
          </View>
          <Text style={[{ color: col.textMuted, fontSize: 12, marginTop: 2 }, align]}>{h.actor}</Text>
          {h.reason ? <Text style={[{ color: h.danger === false ? col.textMuted : col.danger, fontSize: 12, marginTop: 4 }, align]}>{h.reason}</Text> : null}
        </View>
      ))}
    </Card>
  );
}

/** Full-screen viewer for one private image. The image is fetched with the bearer token, never from a public URL. */
function DocViewer({ doc, onClose }: { doc: { label: string; uri: string } | null; onClose: () => void }) {
  const { c: col } = useTheme();
  const { t, row } = useL();
  const [src, setSrc] = useState<{ uri: string; headers: Record<string, string> } | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const uri = doc?.uri ?? null;
  useEffect(() => {
    let alive = true;
    setSrc(null);
    setFailed(false);
    setLoading(!!uri);
    if (uri) privateImageSource(uri).then((s) => alive && setSrc(s), () => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [uri]);
  return (
    <Modal visible={!!doc} animationType="fade" onRequestClose={onClose} transparent={false}>
      <SafeAreaView style={{ flex: 1, backgroundColor: col.bg }}>
        <View style={[row, { alignItems: "center", justifyContent: "space-between", padding: 14 }]}>
          <Text numberOfLines={1} style={{ color: col.text, fontSize: 15, fontWeight: "800", flex: 1, marginHorizontal: 8 }}>{doc?.label}</Text>
          <IconButton icon="close" label={t("Close", "إغلاق")} onPress={onClose} />
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          {failed ? (
            <Text style={{ color: col.danger, fontSize: 13 }}>{t("Could not load this document.", "تعذّر تحميل هذا المستند.")}</Text>
          ) : src ? (
            <>
              <Image
                source={src}
                style={{ width: "100%", height: "100%" }}
                contentFit="contain"
                onLoad={() => setLoading(false)}
                onError={() => { setLoading(false); setFailed(true); }}
              />
              {loading && <ActivityIndicator style={{ position: "absolute" }} size="large" color={col.accent} />}
            </>
          ) : (
            <ActivityIndicator size="large" color={col.accent} />
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

/** Private verification documents. Tap a document (when it has a file) to open it in the viewer. */
export function PrivateDocs({
  title,
  docs,
}: {
  title: string;
  docs: { label: string; fileName: string; expiresAt?: string | null; uri?: string | null }[];
}) {
  const { c: col } = useTheme();
  const { t, row } = useL();
  const [open, setOpen] = useState<{ label: string; uri: string } | null>(null);
  return (
    <>
      <DocViewer doc={open} onClose={() => setOpen(null)} />
      <SectionHeader title={title} />
      <Card>
        {docs.map((d, i) => {
          const expired = isExpired(d.expiresAt);
          return (
            <TouchableOpacity
              key={i}
              disabled={!d.uri}
              accessibilityRole="button"
              accessibilityLabel={d.label}
              activeOpacity={0.7}
              onPress={() => d.uri && setOpen({ label: d.label, uri: d.uri })}
              style={[row, { alignItems: "center", gap: 12, paddingVertical: 8 }]}
            >
              <Ionicons name="document-lock-outline" size={22} color={col.accent} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: col.text, fontSize: 13, fontWeight: "700" }}>{d.label}</Text>
                <Text numberOfLines={1} style={{ color: col.textDim, fontSize: 11, marginTop: 2 }}>
                  {d.fileName}
                  {d.expiresAt ? ` · ${t("expires", "ينتهي")} ${fmtDate(d.expiresAt)}` : ""}
                </Text>
              </View>
              {expired && <Badge tone="danger" label={t("Expired", "منتهية")} icon="alert-circle-outline" />}
              {d.uri ? <Ionicons name="eye-outline" size={18} color={col.textMuted} /> : null}
            </TouchableOpacity>
          );
        })}
        <Text style={{ color: col.textDim, fontSize: 11, marginTop: 8 }}>
          {t("Private: visible only to MOTEXA admins and the owner.", "خاصة: تظهر فقط لمسؤولي MOTEXA والمالك.")}
        </Text>
      </Card>
    </>
  );
}

export { KV };
