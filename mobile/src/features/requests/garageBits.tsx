// Customer request pieces in the garage style: chat thread, timeline mapping, status tones. Provider screens keep requestBits.
import { useState } from "react";
import { TextInput, View } from "react-native";
import { Bubble, DateSeparator, GButton, GText, Note, SystemPill, TimelineStep, Tone } from "../../components/garage";
import type { TimelineItem } from "../../components/blueprint";
import { useL } from "../../core/hooks/useL";
import { gShape, useGarageTheme } from "../../theme/garage";
import { fmtDateTime } from "./requestBits";
import type { InquiryStatus, ThreadMessage, TowStatus } from "./requestsService";

/** buildTimeline() items -> garage Timeline steps (same real times; later steps without one). */
export const toSteps = (items: TimelineItem[]): TimelineStep[] =>
  items.map((it) => ({ label: it.label, at: it.at, state: it.state === "now" ? "current" : it.state === "next" ? "todo" : it.state === "failed" ? "failed" : "done" }));

export const towTone = (s: TowStatus): Tone => ({ REQUESTED: "accent", ACCEPTED: "success", EN_ROUTE: "success", IN_PROGRESS: "success", COMPLETED: "success", DECLINED: "danger", CANCELLED: "neutral" } as const)[s];
export const mechTone = (s: string): Tone => (({ REQUESTED: "accent", ACCEPTED: "success", IN_PROGRESS: "success", COMPLETED: "success", DECLINED: "danger", CANCELLED: "neutral" }) as Record<string, Tone>)[s] ?? "neutral";
export const inquiryTone = (s: InquiryStatus): Tone => ({ OPEN: "accent", ANSWERED: "success", CLOSED: "neutral" } as const)[s];

const dayKey = (iso: string) => iso.slice(0, 10);

/** Chat: date separators, a system pill for the start (and the close), bubbles (mine on the end side), and the reply box. */
export function GarageThread({ messages, canReply, busy, error, onSend, startedText, closedText }: { messages: ThreadMessage[]; canReply: boolean; busy: boolean; error: string | null; onSend: (body: string) => Promise<boolean>; startedText?: string; closedText?: string }) {
  const { t, isArabic } = useL();
  const { g, row, align } = useGarageTheme();
  const [text, setText] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const label = (iso: string) => (dayKey(iso) === today ? t("Today", "اليوم") : new Date(iso).toLocaleDateString(isArabic ? "ar" : "en", { day: "numeric", month: "short", year: "numeric" }));
  let last = "";
  return (
    <View>
      {startedText ? <SystemPill text={startedText} /> : null}
      {messages.map((m) => {
        const sep = dayKey(m.createdAt) !== last;
        last = dayKey(m.createdAt);
        return (
          <View key={m.id}>
            {sep ? <DateSeparator label={label(m.createdAt)} /> : null}
            <Bubble mine={m.mine} text={m.body} meta={`${m.mine ? t("You", "أنت") : m.from === "SHOP" ? t("Shop", "المتجر") : t("Customer", "العميل")} · ${fmtDateTime(m.createdAt).slice(11)}`} />
          </View>
        );
      })}
      {closedText ? <SystemPill text={closedText} /> : null}
      {canReply ? (
        <View style={{ marginTop: 12 }}>
          {error ? <Note tone="danger" icon="alert-circle-outline">{error}</Note> : null}
          <View style={[row, { alignItems: "flex-end", gap: 8 }]}>
            <TextInput
              value={text}
              onChangeText={setText}
              multiline
              maxLength={1000}
              placeholder={t("Write a reply", "اكتب ردًا")}
              placeholderTextColor={g.soft}
              accessibilityLabel={t("Your reply", "ردك")}
              style={[align, { flex: 1, minHeight: 50, maxHeight: 140, paddingHorizontal: 16, paddingVertical: 12, borderRadius: gShape.cardLg, borderWidth: 1, borderColor: g.line, backgroundColor: g.card, color: g.ink, fontSize: 15 }]}
            />
            <GButton
              icon="send"
              label={t("Send", "إرسال")}
              busy={busy}
              disabled={text.trim().length === 0}
              onPress={async () => {
                if (await onSend(text.trim())) setText("");
              }}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** Up to `max` approved skills as soft chips, then "+N". */
export function SkillChips({ skills, max = 3, label }: { skills: string[]; max?: number; label: (s: string) => string }) {
  const { g, row } = useGarageTheme();
  return (
    <View style={[row, { flexWrap: "wrap", gap: 6 }]}>
      {skills.slice(0, max).map((s) => (
        <View key={s} style={{ borderRadius: gShape.pill, backgroundColor: g.tint, paddingHorizontal: 10, paddingVertical: 4 }}>
          <GText style={{ fontSize: 11, lineHeight: 15, fontWeight: "700" }}>{label(s)}</GText>
        </View>
      ))}
      {skills.length > max ? (
        <View style={{ borderRadius: gShape.pill, borderWidth: 1, borderColor: g.line, paddingHorizontal: 10, paddingVertical: 4 }}>
          <GText soft style={{ fontSize: 11, lineHeight: 15, fontWeight: "700", writingDirection: "ltr" }}>{`+${skills.length - max}`}</GText>
        </View>
      ) : null}
    </View>
  );
}

/** A person: the first letter of the name on a soft round tile (no drawings). */
export function InitialBubble({ name, size = 52 }: { name: string; size?: number }) {
  const { g } = useGarageTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: g.tint, alignItems: "center", justifyContent: "center" }}>
      <GText style={{ fontSize: size * 0.4, lineHeight: size * 0.5, fontWeight: "800", color: g.accentText }}>{(name.trim()[0] ?? "?").toUpperCase()}</GText>
    </View>
  );
}
