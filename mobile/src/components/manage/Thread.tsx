// Inbox template, the thread (docs/guide/10-ui-system.md §1): the page header (← back, trail, name, one line), the messages
// (bubbles, day separators, a "New messages" divider, system notes, attachments) and the message box pinned at the bottom.
// Polls every 15 s while open. The thread LIST is a ManagePage with ThreadRow rows.
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useL } from "../../core/hooks/useL";
import { privateImageSource } from "../../features/shared/api";
import type { Attachment, Message } from "../../features/provider/api";
import { bi } from "../../features/provider/labels";
import { useDocViewer } from "../../features/provider/ui";
import { gShape, gType, useGarageTheme } from "../../theme/garage";
import { pickMechanicDocument } from "../MechanicDocuments";
import { EmptyState, GIcon, GText, SkeletonRows } from "../garage";
import type { Crumb } from "../../core/nav/crumbs";
import type { ItemAction } from "../ItemActionsMenu";
import { ManageHeader, Page } from "./Page";
import { MANAGE_ROW_H } from "./ManagePage";

type Att = Message["attachments"][number];
const hhmm = (iso: string) => { const t = new Date(iso); return `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`; };
const dayKey = (iso: string) => { const t = new Date(iso); return `${t.getFullYear()}-${t.getMonth()}-${t.getDate()}`; };

/** One conversation in an Inbox list: name, last message, time, unread dot / count. */
export function ThreadRow({ name, last, at, unread, sub, status, onPress }: { name: string; last: string; at?: string | null; unread?: number; sub?: string; status?: ReactNode; onPress: () => void }) {
  const { t } = useL();
  const { g, row, align } = useGarageTheme();
  const when = at ? (dayKey(at) === dayKey(new Date().toISOString()) ? hhmm(at) : at.slice(0, 10)) : "";
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={[name, unread ? t(`${unread} unread`, `${unread} غير مقروءة`) : null, last].filter(Boolean).join(". ")} onPress={onPress}
      style={({ pressed }) => [row, { height: MANAGE_ROW_H + 8, alignItems: "center", gap: 10, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: g.line, opacity: pressed ? 0.7 : 1 }]}>
      <View style={{ width: 10, alignItems: "center" }}>{unread ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: g.accent }} /> : null}</View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View style={[row, { alignItems: "center", gap: 8 }]}>
          <GText numberOfLines={1} style={[gType.label, align, { flex: 1, fontWeight: unread ? "800" : "700" }]}>{name}</GText>
          {when ? <GText soft style={gType.tiny}>{when}</GText> : null}
        </View>
        <GText numberOfLines={1} soft={!unread} style={[gType.caption, align, unread ? { fontWeight: "700" } : null]}>{last || sub || ""}</GText>
      </View>
      {status}
    </Pressable>
  );
}

function Thumb({ a, onOpen, ink }: { a: Att; onOpen: () => void; ink: string }) {
  const { g, row } = useGarageTheme();
  const [src, setSrc] = useState<{ uri: string; headers: Record<string, string> } | null>(null);
  const image = a.mimeType.startsWith("image/");
  useEffect(() => { let alive = true; if (image) privateImageSource(a.uri).then(s => alive && setSrc(s), () => {}); return () => { alive = false; }; }, [a.uri, image]);
  return image ? (
    <Pressable accessibilityRole="button" accessibilityLabel={a.fileName} onPress={onOpen} style={{ width: 190, height: 130, borderRadius: 14, overflow: "hidden", backgroundColor: g.cardSoft, alignItems: "center", justifyContent: "center" }}>
      {src ? <Image source={src} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : <GIcon name="image-outline" size={28} color={ink} />}
    </Pressable>
  ) : (
    <Pressable accessibilityRole="button" accessibilityLabel={a.fileName} onPress={onOpen} style={[row, { minHeight: 44, alignItems: "center", gap: 8, paddingHorizontal: 10, borderRadius: 12, backgroundColor: g.cardSoft }]}>
      <GIcon name="document-text-outline" size={22} color={ink} />
      <GText numberOfLines={1} style={[gType.caption, { flex: 1, fontWeight: "700" }]}>{a.fileName}</GText>
    </Pressable>
  );
}

function Bubble({ msg, mine, name, onOpen }: { msg: Message; mine: boolean; name: string; onOpen: (a: Att) => void }) {
  const { g, align, isArabic } = useGarageTheme();
  const ink = mine ? g.onAccent : g.ink;
  return (
    <View style={{ flexDirection: mine ? (isArabic ? "row" : "row-reverse") : isArabic ? "row-reverse" : "row", marginVertical: 4 }}>
      <View style={{ maxWidth: "80%", paddingHorizontal: 13, paddingVertical: 9, gap: 5, borderRadius: 18, [mine ? "borderBottomEndRadius" : "borderBottomStartRadius"]: 5,
        backgroundColor: mine ? g.accent : g.card, borderWidth: mine ? 0 : 1, borderColor: g.line }}>
        <GText numberOfLines={1} style={[gType.tiny, { color: ink, opacity: 0.85, fontWeight: "800" }]}>{`${name} · ${hhmm(msg.at)}`}</GText>
        {msg.body && msg.body !== "📎" ? <GText selectable style={[gType.body, align, { color: ink }]}>{msg.body}</GText> : null}
        {msg.attachments.map(a => <Thumb key={a.id} a={a} ink={ink} onOpen={() => onOpen(a)} />)}
      </View>
    </View>
  );
}

function Divider({ label, accent }: { label: string; accent?: boolean }) {
  const { g, row } = useGarageTheme();
  return (
    <View style={[row, { alignItems: "center", gap: 8, marginVertical: 10 }]}>
      <View style={{ flex: 1, height: 1, backgroundColor: accent ? g.accent : g.line }} />
      <GText style={[gType.tiny, { color: accent ? g.accentText : g.soft, fontWeight: "800" }]}>{label}</GText>
      <View style={{ flex: 1, height: 1, backgroundColor: accent ? g.accent : g.line }} />
    </View>
  );
}

export function ThreadPage({ title, line, badge, mine, names, load, markRead, send, onChange, attachments = true, trail, tabBar = false, actions, closed, pollMs = 15000 }: {
  title: string; line?: string; badge?: ReactNode;
  /** the thread's secondary tasks (header ⋮) */
  actions?: ItemAction[];
  /** set when no more messages can be sent: shown instead of the message box */
  closed?: string;
  /** how often the thread is re-read while open (live job chats: 4 s) */
  pollMs?: number;
  /** which side the signed-in user is */
  mine: "PROVIDER" | "ADMIN";
  names: { me: string; other: string };
  load: () => Promise<{ messages: Message[]; unread: number }>;
  markRead: () => Promise<unknown>;
  send: (body: string, attachment?: Attachment) => Promise<Message[]>;
  onChange?: () => void;
  /** false: text only (order chats) */
  attachments?: boolean;
  trail?: Crumb[];
  /** a tab root: no back, room for the floating tab bar */
  tabBar?: boolean;
}) {
  const { t, isArabic } = useL();
  const { g, row, align } = useGarageTheme();
  const insets = useSafeAreaInsets();
  const viewer = useDocViewer();
  const scroll = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<Message[] | null>(null), [unreadFrom, setUnreadFrom] = useState<string | null>(null);
  const first = useRef(true), alive = useRef(true);
  const [text, setText] = useState(""), [file, setFile] = useState<{ name: string; base64: string } | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const r = await load();
      if (!alive.current) return;
      if (first.current) {
        first.current = false;
        const theirs = r.messages.filter(x => (mine === "PROVIDER" ? x.from !== "PROVIDER" : x.from === "PROVIDER"));
        setUnreadFrom(r.unread > 0 ? (theirs[Math.max(0, theirs.length - r.unread)]?.id ?? null) : null);
      }
      setMessages(r.messages);
      if (r.unread > 0) { await markRead(); onChange?.(); }
    } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : "Error"); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, markRead, mine]);
  useFocusEffect(useCallback(() => { alive.current = true; void refresh(); const timer = setInterval(() => void refresh(), pollMs); return () => { alive.current = false; clearInterval(timer); }; }, [refresh, pollMs]));
  const attach = async () => {
    setError("");
    try { const f = await pickMechanicDocument("MESSAGE"); if (f) setFile({ name: f.fileName, base64: f.base64 }); }
    catch (e) { setError(e instanceof Error ? e.message : t("The file could not be read.", "تعذّرت قراءة الملف.")); }
  };
  const submit = async () => {
    if (busy || (!text.trim() && !file)) return;
    setBusy(true); setError("");
    try { setMessages(await send(text.trim(), file ? { name: file.name, dataBase64: file.base64 } : undefined)); setText(""); setFile(null); onChange?.(); }
    catch (e) { setError(e instanceof Error ? e.message : t("The message could not be sent.", "تعذّر إرسال الرسالة.")); }
    finally { setBusy(false); }
  };
  const today = dayKey(new Date().toISOString()), yesterday = dayKey(new Date(Date.now() - 86400000).toISOString());
  const dayLabel = (iso: string) => (dayKey(iso) === today ? t("Today", "اليوم") : dayKey(iso) === yesterday ? t("Yesterday", "أمس") : iso.slice(0, 10));
  const canSend = !busy && (!!text.trim() || !!file);
  let lastDay = "";
  return (
    <Page title={title} back={!tabBar} list trail={trail}>
      {viewer.element}
      <View style={{ paddingHorizontal: 20, gap: 6, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: g.line }}>
        <ManageHeader title={title} line={line} actions={actions} />
        {badge ? <View style={[row]}>{badge}</View> : null}
      </View>
      <ScrollView ref={scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, flexGrow: 1 }}>
        {messages === null ? (error ? <GText accessibilityRole="alert" style={[gType.bodySm, { color: g.danger, textAlign: "center", marginTop: 30 }]}>{error}</GText> : <SkeletonRows count={4} />)
          : messages.length === 0 ? <EmptyState photo="empty.search" text={t("No messages yet. Write the first one below.", "لا توجد رسائل بعد. اكتب أول رسالة بالأسفل.")} />
          : messages.map(m => {
            const out: ReactNode[] = [];
            const k = dayKey(m.at);
            if (k !== lastDay) { lastDay = k; out.push(<Divider key={`d${m.id}`} label={dayLabel(m.at)} />); }
            if (m.id === unreadFrom) out.push(<Divider key={`u${m.id}`} accent label={t("New messages", "رسائل جديدة")} />);
            out.push(m.from === "SYSTEM"
              ? <View key={m.id} style={{ alignItems: "center", marginVertical: 6 }}><GText soft style={[gType.caption, { textAlign: "center", maxWidth: "92%" }]}>{`${bi(isArabic, m.body)} · ${hhmm(m.at)}`}</GText></View>
              : <Bubble key={m.id} msg={m} mine={m.from === mine} name={m.from === mine ? names.me : m.author || names.other} onOpen={a => viewer.open({ uri: a.uri, label: a.fileName, mimeType: a.mimeType })} />);
            return out;
          })}
      </ScrollView>
      {closed ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 12) + (tabBar ? 84 : 0), backgroundColor: g.card, borderTopWidth: 1, borderTopColor: g.line }}>
          <GText soft style={[gType.caption, align]}>{closed}</GText>
        </View>
      ) : (
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 10) + (tabBar ? 84 : 0), gap: 6, backgroundColor: g.card, borderTopWidth: 1, borderTopColor: g.line }}>
          {error && messages ? <GText accessibilityRole="alert" style={[gType.caption, align, { color: g.danger }]}>{error}</GText> : null}
          {file ? (
            <View style={[row, { alignItems: "center", gap: 8, paddingHorizontal: 12, minHeight: 36, borderRadius: gShape.small, backgroundColor: g.tint }]}>
              <GIcon name="attach" size={16} color={g.accentText} />
              <GText numberOfLines={1} style={[gType.caption, align, { flex: 1, fontWeight: "700" }]}>{file.name}</GText>
              <Pressable accessibilityRole="button" accessibilityLabel={t("Remove attachment", "إزالة المرفق")} onPress={() => setFile(null)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                <GIcon name="close-circle" size={20} color={g.accentText} />
              </Pressable>
            </View>
          ) : null}
          <View style={[row, { alignItems: "flex-end", gap: 8 }]}>
            {attachments ? (
              <Pressable accessibilityRole="button" accessibilityLabel={t("Attach a photo or PDF", "إرفاق صورة أو PDF")} onPress={() => void attach()}
                style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: g.line }}>
                <GIcon name="attach" size={22} color={g.accentText} />
              </Pressable>
            ) : null}
            <TextInput value={text} onChangeText={setText} multiline maxLength={2000} placeholder={t("Write a message…", "اكتب رسالة…")} placeholderTextColor={g.soft} accessibilityLabel={t("Message", "الرسالة")}
              style={{ flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 22, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, color: g.ink, fontSize: 15, textAlign: isArabic ? "right" : "left", borderWidth: 1, borderColor: g.line, backgroundColor: g.page }} />
            <Pressable accessibilityRole="button" accessibilityLabel={t("Send", "إرسال")} accessibilityState={{ disabled: !canSend }} disabled={!canSend} onPress={() => void submit()}
              style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: g.accent, opacity: canSend ? 1 : 0.4 }}>
              <GIcon name="send" size={19} color={g.onAccent} flip={isArabic} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
      )}
    </Page>
  );
}
