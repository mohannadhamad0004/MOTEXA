// Application chat (provider <-> department admins), full screen: bubbles, date separators, system pills, attachment previews,
// an unread divider, an input bar pinned at the bottom and auto-scroll to the newest message. Polls every 15 s while open.
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CanvasFill } from "../../components/BrandSurfaces";
import { pickMechanicDocument } from "../../components/MechanicDocuments";
import { Text } from "../../components/MotexaVisual";
import { BackButton } from "../department/MapPage";
import { Avatar, cardStyle, useDT } from "../department/ui";
import { privateImageSource } from "../shared/api";
import type { Attachment, Message } from "./api";
import { bi } from "./labels";
import { useDocViewer } from "./ui";

type Att = Message["attachments"][number];

const hhmm = (iso: string) => {
  const t = new Date(iso);
  return `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
};
const dayKey = (iso: string) => {
  const t = new Date(iso);
  return `${t.getFullYear()}-${t.getMonth()}-${t.getDate()}`;
};

function Thumb({ a, onOpen }: { a: Att; onOpen: () => void }) {
  const d = useDT();
  const [src, setSrc] = useState<{ uri: string; headers: Record<string, string> } | null>(null);
  const image = a.mimeType.startsWith("image/");
  useEffect(() => {
    let alive = true;
    if (image) privateImageSource(a.uri).then((s) => alive && setSrc(s), () => {});
    return () => {
      alive = false;
    };
  }, [a.uri, image]);
  if (!image)
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={a.fileName} onPress={onOpen} style={{ flexDirection: d.row, alignItems: "center", gap: 8, padding: 10, borderRadius: 14, backgroundColor: "#00000022" }}>
        <Ionicons name="document-text" size={26} color={d.muted} />
        <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, fontWeight: "700" }}>{a.fileName}</Text>
      </Pressable>
    );
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={a.fileName} onPress={onOpen} style={{ width: 190, height: 130, borderRadius: 14, overflow: "hidden", backgroundColor: "#00000022", alignItems: "center", justifyContent: "center" }}>
      {src ? <Image source={src} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : <Ionicons name="image-outline" size={28} color={d.muted} />}
    </Pressable>
  );
}

function Bubble({ msg, mine, name, onOpen }: { msg: Message; mine: boolean; name: string; onOpen: (a: Att) => void }) {
  const d = useDT();
  const bg = mine ? d.fill : d.dark ? "#4A382B" : "#FFFFFF";
  const ink = mine ? d.fillInk : d.ink;
  const sub = mine ? d.fillInk : d.muted;
  return (
    // "me" sits at the end of the row (right in English, left in Arabic); the row mirrors by itself
    <View style={{ flexDirection: mine ? (d.ar ? "row" : "row-reverse") : d.row, alignItems: "flex-end", gap: 8, marginVertical: 5 }}>
      <Avatar name={name} size={32} tone={mine ? "bronze" : "neutral"} />
      <View
        style={{
          maxWidth: "78%",
          paddingHorizontal: 13,
          paddingVertical: 10,
          gap: 6,
          borderRadius: 20,
          [mine ? "borderBottomEndRadius" : "borderBottomStartRadius"]: 5,
          backgroundColor: bg,
          borderWidth: mine ? 0 : 1,
          borderColor: d.border,
          shadowColor: "#4F2D17",
          shadowOpacity: d.dark ? 0.3 : 0.08,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 1,
        }}
      >
        <View style={{ flexDirection: d.row, alignItems: "baseline", gap: 8 }}>
          <Text numberOfLines={1} style={{ flexShrink: 1, color: sub, fontSize: 11, lineHeight: 16, fontWeight: "800" }}>{name}</Text>
          <Text style={{ color: sub, fontSize: 10, lineHeight: 16, opacity: 0.85 }}>{hhmm(msg.at)}</Text>
        </View>
        {msg.body && msg.body !== "📎" ? <Text style={{ color: ink, fontSize: 14.5, lineHeight: 22, textAlign: d.align }}>{msg.body}</Text> : null}
        {msg.attachments.map((a) => (
          <View key={a.id} style={{ alignSelf: "stretch" }}>
            <Thumb a={a} onOpen={() => onOpen(a)} />
          </View>
        ))}
      </View>
    </View>
  );
}

function SystemPill({ msg }: { msg: Message }) {
  const d = useDT();
  const c = d.chip("neutral");
  return (
    <View style={{ alignItems: "center", marginVertical: 8 }}>
      <View style={{ flexDirection: d.row, alignItems: "center", gap: 6, maxWidth: "92%", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.bg }}>
        <Ionicons name="information-circle-outline" size={14} color={c.fg} />
        <Text style={{ flexShrink: 1, color: c.fg, fontSize: 11.5, lineHeight: 17, fontWeight: "600", textAlign: "center" }}>
          {bi(d.ar, msg.body)} · {hhmm(msg.at)}
        </Text>
      </View>
    </View>
  );
}

function Divider({ label, tone }: { label: string; tone?: "bronze" }) {
  const d = useDT();
  const color = tone === "bronze" ? d.fill : d.muted;
  return (
    <View style={{ flexDirection: d.row, alignItems: "center", gap: 10, marginVertical: 10 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: tone === "bronze" ? d.fill : d.border, opacity: 0.7 }} />
      <Text style={{ color, fontSize: 11, lineHeight: 16, fontWeight: "800" }}>{label}</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: tone === "bronze" ? d.fill : d.border, opacity: 0.7 }} />
    </View>
  );
}

function ChatSkeleton() {
  const d = useDT();
  const bar = (w: string, mine?: boolean) => (
    <View style={{ alignSelf: mine ? "flex-end" : "flex-start", width: w as never, height: 54, borderRadius: 20, backgroundColor: d.chip("neutral").bg, opacity: 0.7, marginVertical: 6 }} />
  );
  return (
    <View accessible accessibilityLabel={d.t("Loading messages", "جارٍ تحميل الرسائل")}>
      {bar("62%")}
      {bar("48%", true)}
      {bar("70%")}
    </View>
  );
}

export function ChatScreen({
  title,
  subtitle,
  badge,
  mine,
  names,
  load,
  markRead,
  send,
  onChange,
}: {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  mine: "PROVIDER" | "ADMIN";
  /** display names: me (the signed-in side) and the other side */
  names: { me: string; other: string };
  load: () => Promise<{ messages: Message[]; unread: number }>;
  markRead: () => Promise<unknown>;
  send: (body: string, attachment?: Attachment) => Promise<Message[]>;
  onChange?: () => void;
}) {
  const d = useDT();
  const insets = useSafeAreaInsets();
  const viewer = useDocViewer();
  const scroll = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [unreadFrom, setUnreadFrom] = useState<string | null>(null); // id of the first unread message when the chat was opened
  const first = useRef(true);
  const [text, setText] = useState("");
  const [file, setFile] = useState<{ name: string; base64: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const r = await load();
      if (!alive.current) return;
      if (first.current) {
        first.current = false;
        const theirs = r.messages.filter((x) => (mine === "PROVIDER" ? x.from !== "PROVIDER" : x.from === "PROVIDER"));
        setUnreadFrom(r.unread > 0 ? (theirs[Math.max(0, theirs.length - r.unread)]?.id ?? null) : null);
      }
      setMessages(r.messages);
      if (r.unread > 0) {
        await markRead();
        onChange?.();
      }
    } catch (e) {
      if (alive.current && !messages) setError(e instanceof Error ? e.message : "Error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, markRead, mine]);

  useFocusEffect(
    useCallback(() => {
      alive.current = true;
      void refresh();
      const timer = setInterval(() => void refresh(), 15000);
      return () => {
        alive.current = false;
        clearInterval(timer);
      };
    }, [refresh]),
  );

  async function attach() {
    setError("");
    try {
      const f = await pickMechanicDocument("MESSAGE");
      if (f) setFile({ name: f.fileName, base64: f.base64 });
    } catch (e) {
      setError(e instanceof Error ? e.message : d.t("The file could not be read.", "تعذّرت قراءة الملف."));
    }
  }
  async function submit() {
    if (busy || (!text.trim() && !file)) return;
    setBusy(true);
    setError("");
    try {
      setMessages(await send(text.trim(), file ? { name: file.name, dataBase64: file.base64 } : undefined));
      setText("");
      setFile(null);
      onChange?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : d.t("The message could not be sent.", "تعذّر إرسال الرسالة."));
    } finally {
      setBusy(false);
    }
  }

  const today = dayKey(new Date().toISOString());
  const yesterday = dayKey(new Date(Date.now() - 86400000).toISOString());
  const dayLabel = (iso: string) => (dayKey(iso) === today ? d.t("Today", "اليوم") : dayKey(iso) === yesterday ? d.t("Yesterday", "أمس") : iso.slice(0, 10));
  const canSend = !busy && (!!text.trim() || !!file);

  let lastDay = "";
  return (
    <View style={{ flex: 1 }}>
      <CanvasFill />
      {viewer.element}
      <View style={{ paddingTop: insets.top + 8, paddingBottom: 10, paddingHorizontal: 14, flexDirection: d.row, alignItems: "center", gap: 10, backgroundColor: d.dark ? "#291F19" : "#FBF1E2", borderBottomWidth: 1, borderBottomColor: d.border }}>
        <BackButton />
        <Avatar name={title} size={42} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: d.ink, fontSize: 16, lineHeight: 23, fontWeight: "800", textAlign: d.align }}>{title}</Text>
          {subtitle ? <Text numberOfLines={1} style={{ color: d.muted, fontSize: 12, lineHeight: 17, textAlign: d.align }}>{subtitle}</Text> : null}
        </View>
        {badge}
      </View>

      <ScrollView
        ref={scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
        contentContainerStyle={{ width: "100%", maxWidth: 680, alignSelf: "center", paddingHorizontal: 14, paddingTop: 8, paddingBottom: 16, flexGrow: 1 }}
      >
        {messages === null ? (
          error ? <Text accessibilityRole="alert" style={{ color: d.bad, textAlign: "center", marginTop: 30 }}>{error}</Text> : <ChatSkeleton />
        ) : messages.length === 0 ? (
          <View style={{ ...cardStyle(d), alignItems: "center", gap: 10, padding: 28, marginTop: 20 }}>
            <Ionicons name="chatbubbles-outline" size={34} color={d.accent} />
            <Text style={{ color: d.ink, fontSize: 14, fontWeight: "600", textAlign: "center" }}>{d.t("No messages yet.", "لا توجد رسائل بعد.")}</Text>
            <Text style={{ color: d.muted, fontSize: 12, textAlign: "center" }}>{d.t("Write the first message below.", "اكتب أول رسالة بالأسفل.")}</Text>
          </View>
        ) : (
          messages.map((m) => {
            const out: ReactNode[] = [];
            const k = dayKey(m.at);
            if (k !== lastDay) {
              lastDay = k;
              out.push(<Divider key={`d${m.id}`} label={dayLabel(m.at)} />);
            }
            if (m.id === unreadFrom) out.push(<Divider key={`u${m.id}`} tone="bronze" label={d.t("New messages", "رسائل جديدة")} />);
            out.push(
              m.from === "SYSTEM" ? (
                <SystemPill key={m.id} msg={m} />
              ) : (
                <Bubble key={m.id} msg={m} mine={m.from === mine} name={m.from === mine ? names.me : m.author || names.other} onOpen={(a) => viewer.open({ uri: a.uri, label: a.fileName, mimeType: a.mimeType })} />
              ),
            );
            return out;
          })
        )}
      </ScrollView>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 10), gap: 6, backgroundColor: d.dark ? "#241C16" : "#FBF1E2", borderTopWidth: 1, borderTopColor: d.border }}>
          {error && messages ? <Text accessibilityRole="alert" style={{ color: d.bad, fontSize: 12, textAlign: d.align }}>{error}</Text> : null}
          {file ? (
            <View style={{ flexDirection: d.row, alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: d.chip("bronze").bg, borderWidth: 1, borderColor: d.chip("bronze").border }}>
              <Ionicons name="attach" size={16} color={d.chip("bronze").fg} />
              <Text numberOfLines={1} style={{ flex: 1, color: d.chip("bronze").fg, fontSize: 12, fontWeight: "700", textAlign: d.align }}>{file.name}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={d.t("Remove attachment", "إزالة المرفق")} onPress={() => setFile(null)} hitSlop={10}>
                <Ionicons name="close-circle" size={20} color={d.chip("bronze").fg} />
              </Pressable>
            </View>
          ) : null}
          <View style={{ flexDirection: d.row, alignItems: "flex-end", gap: 8, width: "100%", maxWidth: 680, alignSelf: "center" }}>
            <Pressable accessibilityRole="button" accessibilityLabel={d.t("Attach a photo or PDF", "إرفاق صورة أو PDF")} onPress={attach} style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: d.border, backgroundColor: d.surface }}>
              <Ionicons name="attach" size={22} color={d.accent} />
            </Pressable>
            <TextInput
              value={text}
              onChangeText={setText}
              multiline
              maxLength={2000}
              placeholder={d.t("Write a message…", "اكتب رسالة…")}
              placeholderTextColor={d.muted}
              accessibilityLabel={d.t("Message", "الرسالة")}
              style={{ flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 22, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, color: d.ink, fontSize: 14.5, textAlign: d.align, borderWidth: 1, borderColor: d.border, backgroundColor: d.surface }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={d.t("Send", "إرسال")}
              accessibilityState={{ disabled: !canSend }}
              disabled={!canSend}
              onPress={submit}
              style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: d.fill, opacity: canSend ? 1 : 0.4 }}
            >
              <Ionicons name={d.ar ? "send" : "send"} size={19} color={d.fillInk} style={d.ar ? { transform: [{ scaleX: -1 }] } : undefined} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
