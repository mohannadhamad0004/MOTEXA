import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Notice } from "../../components/ui/Feedback";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { useL } from "../../core/hooks/useL";
import { Text } from "../../components/ui/Text";
import { StatusTimeline } from "../../components/ui/StatusTimeline";
import type { TimelineItem } from "../../components/blueprint";
import { useTheme } from "../../theme/useTheme";
import { useState } from "react";
import { View } from "react-native";
import type { InquiryStatus, ThreadMessage, TowProblem, TowStatus } from "./requestsService";

/** Local date and time, "2026-10-15 18:30". */
export function fmtDateTime(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function InquiryStatusBadge({ value }: { value: InquiryStatus }) {
  const { t } = useL();
  const m = {
    OPEN: { tone: "warning", icon: "chatbubble-outline", label: t("Open", "مفتوح") },
    ANSWERED: { tone: "success", icon: "checkmark-done-outline", label: t("Answered", "تم الرد") },
    CLOSED: { tone: "neutral", icon: "lock-closed-outline", label: t("Closed", "مغلق") },
  } as const;
  const k = m[value];
  return <Badge tone={k.tone} icon={k.icon} label={k.label} />;
}

export function useTowStatusLabels() {
  const { t } = useL();
  const label: Record<TowStatus, string> = {
    REQUESTED: t("Requested", "تم الطلب"),
    ACCEPTED: t("Accepted", "تم القبول"),
    DECLINED: t("Declined", "مرفوض"),
    EN_ROUTE: t("On the way", "في الطريق"),
    IN_PROGRESS: t("In progress", "قيد التنفيذ"),
    COMPLETED: t("Completed", "مكتمل"),
    CANCELLED: t("Cancelled", "ملغى"),
  };
  return label;
}

export function useProblemLabels() {
  const { t } = useL();
  const label: Record<TowProblem, string> = {
    WONT_START: t("Won't start", "لا تعمل"),
    ACCIDENT: t("Accident", "حادث"),
    FLAT_TIRE: t("Flat tire", "إطار مثقوب"),
    OVERHEATING: t("Overheating", "ارتفاع حرارة المحرك"),
    OUT_OF_FUEL: t("Out of fuel", "نفاد الوقود"),
    OTHER: t("Other", "أخرى"),
  };
  return label;
}

export function TowStatusBadge({ value }: { value: TowStatus }) {
  const label = useTowStatusLabels();
  const tone = { REQUESTED: "warning", ACCEPTED: "success", EN_ROUTE: "success", IN_PROGRESS: "success", COMPLETED: "success", DECLINED: "danger", CANCELLED: "danger" } as const;
  const icon = { REQUESTED: "time-outline", ACCEPTED: "checkmark-circle-outline", EN_ROUTE: "navigate-outline", IN_PROGRESS: "construct-outline", COMPLETED: "flag-outline", DECLINED: "close-circle-outline", CANCELLED: "close-circle-outline" } as const;
  return <Badge tone={tone[value]} icon={icon[value]} label={label[value]} />;
}

/** Status timeline: one line per step that happened, with its time. */
export function Timeline({ items }: { items: { status: TowStatus; at: string }[] }) {
  const label = useTowStatusLabels();
  return <StatusTimeline items={items.map((it) => ({ key: it.status, label: label[it.status], at: fmtDateTime(it.at) }))} />;
}

/** Message bubbles + reply box. Used by the customer's and the shop's inquiry screens. */
export function Thread({
  messages,
  canReply,
  busy,
  error,
  onSend,
}: {
  messages: ThreadMessage[];
  canReply: boolean;
  busy: boolean;
  error: string | null;
  onSend: (body: string) => Promise<boolean>;
}) {
  const { c: col } = useTheme();
  const { t, row, align } = useL();
  const [text, setText] = useState("");

  return (
    <>
      <SectionHeader title={t("Messages", "الرسائل")} />
      {messages.map((m) => (
        <View key={m.id} style={{ alignSelf: m.mine ? "flex-end" : "flex-start", maxWidth: "86%", marginBottom: 10 }}>
          <View
            style={{
              backgroundColor: m.mine ? col.accentSoft : col.surface,
              borderColor: m.mine ? col.accentBorder : col.border,
              borderWidth: 1,
              borderRadius: 16,
              padding: 12,
            }}
          >
            <Text style={[{ color: col.text, fontSize: 13, lineHeight: 20 }, align]}>{m.body}</Text>
          </View>
          <Text style={{ color: col.textDim, fontSize: 10, marginTop: 4, textAlign: m.mine ? "right" : "left" }}>
            {m.mine ? t("You", "أنت") : m.from === "SHOP" ? t("Shop", "المتجر") : t("Customer", "العميل")} · {fmtDateTime(m.createdAt)}
          </Text>
        </View>
      ))}
      {canReply ? (
        <View style={{ marginTop: 6 }}>
          <Input label={t("Your reply", "ردك")} value={text} onChangeText={setText} multiline maxLength={1000} />
          {error ? <Notice tone="danger" icon="alert-circle-outline">{error}</Notice> : null}
          <View style={[row]}>
            <View style={{ flex: 1 }}>
              <Button
                icon="send-outline"
                label={t("Send", "إرسال")}
                disabled={busy || text.trim().length === 0}
                onPress={async () => {
                  if (await onSend(text.trim())) setText("");
                }}
              />
            </View>
          </View>
        </View>
      ) : (
        <Notice icon="lock-closed-outline">{t("This question is closed. No new messages can be added.", "تم إغلاق هذا السؤال. لا يمكن إضافة رسائل جديدة.")}</Notice>
      )}
    </>
  );
}

/**
 * Timeline for the status screens: every step that really happened with its real time; for an open request the
 * steps still to come follow, without a time. Declined / cancelled requests only show what happened.
 */
export function buildTimeline<S extends string>(path: S[], happened: { status: S; at: string }[], current: S, label: Record<S, string>): TimelineItem[] {
  const at = new Map(happened.map((h) => [h.status, h.at]));
  const items: TimelineItem[] = [];
  const onPath = path.includes(current);
  for (const st of path) {
    if (at.has(st)) items.push({ key: st, label: label[st], at: fmtDateTime(at.get(st)), state: st === current ? "now" : "done" });
    else if (onPath) items.push({ key: st, label: label[st], state: "next" });
  }
  // statuses outside the path (declined, cancelled) come last, as the current step
  for (const h of happened) if (!path.includes(h.status)) items.push({ key: h.status, label: label[h.status], at: fmtDateTime(h.at), state: h.status === current ? "now" : "done" });
  return items;
}

/** One sentence that says where a tow request stands. */
export function towHeadline(t: (en: string, ar: string) => string, status: TowStatus, name: string) {
  switch (status) {
    case "REQUESTED":
      return t(`Waiting for ${name} to answer`, `بانتظار رد ${name}`);
    case "ACCEPTED":
      return t(`${name} accepted your request`, `${name} قبلت طلبك`);
    case "EN_ROUTE":
      return t(`${name} is on the way`, `${name} في الطريق إليك`);
    case "IN_PROGRESS":
      return t(`${name} is working on your car`, `${name} تعمل على سيارتك`);
    case "COMPLETED":
      return t("Tow completed", "اكتمل السحب");
    case "DECLINED":
      return t(`${name} declined your request`, `${name} رفضت طلبك`);
    default:
      return t("Request cancelled", "تم إلغاء الطلب");
  }
}
