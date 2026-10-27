// One message thread (provider <-> department admins). Polls every 15 s while the screen is open (no websockets, no push).
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { View } from "react-native";
import { MechanicButton, MechanicField, MechanicNote, useMechanicTheme } from "../../components/MechanicUI";
import { pickMechanicDocument } from "../../components/MechanicDocuments";
import { Text } from "../../components/MotexaVisual";
import type { Attachment, Message } from "./api";
import { Bubble, useDocViewer } from "./ui";

export function ThreadView({
  mine,
  load,
  markRead,
  send,
  onChange,
}: {
  mine: "PROVIDER" | "ADMIN";
  load: () => Promise<Message[]>;
  markRead: () => Promise<unknown>;
  send: (body: string, attachment?: Attachment) => Promise<Message[]>;
  /** called after messages were read or sent, so badges elsewhere can refresh */
  onChange?: () => void;
}) {
  const m = useMechanicTheme();
  const viewer = useDocViewer();
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [text, setText] = useState("");
  const [file, setFile] = useState<{ name: string; base64: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const list = await load();
      if (!alive.current) return;
      setMessages(list);
      // opening the thread reads what the other side wrote
      if (list.some((x) => x.from !== mine && x.from !== "SYSTEM")) {
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
      const picked = await pickMechanicDocument("MESSAGE");
      if (picked) setFile({ name: picked.fileName, base64: picked.base64 });
    } catch (e) {
      setError(e instanceof Error ? e.message : m.t("The file could not be read.", "تعذّرت قراءة الملف."));
    }
  }

  async function submit() {
    if (busy || (!text.trim() && !file)) return;
    setBusy(true);
    setError("");
    try {
      const list = await send(text.trim(), file ? { name: file.name, dataBase64: file.base64 } : undefined);
      setMessages(list);
      setText("");
      setFile(null);
      onChange?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : m.t("The message could not be sent.", "تعذّر إرسال الرسالة."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 12 }}>
      {viewer.element}
      {error ? <MechanicNote error>{error}</MechanicNote> : null}
      {messages === null ? (
        <Text style={{ color: m.muted, fontSize: 13, textAlign: "center" }}>{m.t("Loading…", "جارٍ التحميل…")}</Text>
      ) : messages.length === 0 ? (
        <Text style={{ color: m.muted, fontSize: 13, lineHeight: 21, textAlign: "center", padding: 20 }}>{m.t("No messages yet. Write the first one.", "لا توجد رسائل بعد. اكتب أول رسالة.")}</Text>
      ) : (
        messages.map((x) => <Bubble key={x.id} msg={x} mine={x.from === mine} onOpen={(a) => viewer.open({ uri: a.uri, label: a.fileName, mimeType: a.mimeType })} />)
      )}
      <MechanicField label={m.t("Message", "الرسالة")} icon="chatbubble-ellipses-outline" value={text} onChangeText={setText} multiline maxLength={2000} placeholder={m.t("Write a message…", "اكتب رسالة…")} style={{ minHeight: 70, textAlignVertical: "top" }} />
      {file ? (
        <View style={{ flexDirection: m.row, alignItems: "center", gap: 8 }}>
          <Ionicons name="attach" size={18} color={m.muted} />
          <Text numberOfLines={1} style={{ flex: 1, color: m.ink, fontSize: 12, textAlign: m.align }}>{file.name}</Text>
          <Text accessibilityRole="button" onPress={() => setFile(null)} style={{ color: m.muted, fontSize: 12, padding: 8 }}>{m.t("Remove", "إزالة")}</Text>
        </View>
      ) : null}
      <MechanicButton secondary label={m.t("Attach a photo or PDF", "إرفاق صورة أو PDF")} onPress={attach} />
      <MechanicButton label={m.t("Send", "إرسال")} onPress={submit} busy={busy} disabled={busy || (!text.trim() && !file)} />
    </View>
  );
}
