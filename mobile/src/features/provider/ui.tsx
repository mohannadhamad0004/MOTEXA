// UI shared by the provider onboarding and the department review: vertical stepper, document viewer (full-screen image with
// pinch / double-tap zoom, PDF opened with the system viewer) and chat bubbles. Colours come from Diala's mechanic theme.
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { ReactNode, useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, SafeAreaView, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { MechanicButton, MechanicNote, useMechanicTheme } from "../../components/MechanicUI";
import { Text } from "../../components/MotexaVisual";
import * as Store from "../../components/SessionStore";
import { API_URL } from "../../core/config/api";
import { privateImageSource } from "../shared/api";
import type { Message } from "./api";
import { bi, fmtTime } from "./labels";

// ---------------------------------------------------------------- vertical stepper
export type Step = { key: string; label: string; hint?: string; done: boolean };

/** Numbered steps joined by a line; the active step opens its content right under its title. */
export function VerticalStepper({ steps, current, onSelect, children }: { steps: Step[]; current: string; onSelect?: (key: string) => void; children: (key: string) => ReactNode }) {
  const m = useMechanicTheme();
  return (
    <View>
      {steps.map((s, i) => {
        const active = s.key === current;
        const last = i === steps.length - 1;
        return (
          <View key={s.key} style={{ flexDirection: m.row, gap: 12 }}>
            <View style={{ alignItems: "center", width: 30 }}>
              <View
                style={{ width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: active || s.done ? "#80502A" : "transparent", borderWidth: 1, borderColor: active || s.done ? "#80502A" : m.border }}
              >
                {s.done && !active ? <Ionicons name="checkmark" size={16} color="#FFF7E9" /> : <Text style={{ fontSize: 12, color: active ? "#FFF7E9" : m.muted }}>{i + 1}</Text>}
              </View>
              {!last ? <View style={{ flex: 1, width: 1, minHeight: 18, backgroundColor: s.done ? "#B38A5C" : m.border, marginVertical: 4 }} /> : null}
            </View>
            <View style={{ flex: 1, minWidth: 0, paddingBottom: last ? 0 : 18 }}>
              <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={s.label} disabled={!onSelect} onPress={() => onSelect?.(s.key)} style={{ minHeight: 30, justifyContent: "center" }}>
                <Text style={{ fontSize: 15, lineHeight: 24, fontWeight: "600", color: m.ink, textAlign: m.align }}>{s.label}</Text>
                {s.hint ? <Text style={{ fontSize: 11, lineHeight: 18, color: m.muted, textAlign: m.align }}>{s.hint}</Text> : null}
              </Pressable>
              {active ? <View style={{ marginTop: 10 }}>{children(s.key)}</View> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------- zoomable image
function ZoomableImage({ source }: { source: { uri: string; headers?: Record<string, string> } }) {
  const scale = useSharedValue(1);
  const saved = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const sx = useSharedValue(0);
  const sy = useSharedValue(0);
  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(1, Math.min(6, saved.value * e.scale));
    })
    .onEnd(() => {
      saved.value = scale.value;
      if (scale.value <= 1.01) {
        tx.value = withTiming(0);
        ty.value = withTiming(0);
        sx.value = 0;
        sy.value = 0;
      }
    });
  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1) {
        tx.value = sx.value + e.translationX;
        ty.value = sy.value + e.translationY;
      }
    })
    .onEnd(() => {
      sx.value = tx.value;
      sy.value = ty.value;
    });
  const dbl = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const to = scale.value > 1 ? 1 : 2.5;
      scale.value = withTiming(to);
      saved.value = to;
      if (to === 1) {
        tx.value = withTiming(0);
        ty.value = withTiming(0);
        sx.value = 0;
        sy.value = 0;
      }
    });
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }] }));
  return (
    <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, dbl)}>
      <Animated.View style={[{ flex: 1, width: "100%" }, style]}>
        <Image source={source} style={{ width: "100%", height: "100%" }} contentFit="contain" />
      </Animated.View>
    </GestureDetector>
  );
}

/** Opens a private PDF with the system viewer: download with the bearer token, then hand the file to the OS. */
async function openPdf(uri: string, t: (en: string, ar: string) => string) {
  const token = (await Store.getItemAsync("motexa_access_token")) ?? "";
  const url = `${API_URL}${uri}`;
  if (Platform.OS === "web") {
    const blob = await (await fetch(url, { headers: { Authorization: `Bearer ${token}` } })).blob();
    window.open(URL.createObjectURL(blob), "_blank");
    return;
  }
  if (!(await Sharing.isAvailableAsync())) throw new Error(t("Opening documents is not available on this device.", "فتح المستندات غير متاح على هذا الجهاز."));
  const file = await File.downloadFileAsync(url, new File(Paths.cache, `motexa-doc-${Date.now()}.pdf`), { headers: { Authorization: `Bearer ${token}` } });
  await Sharing.shareAsync(file.uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
}

/** `open(doc)` shows an image full screen (pinch or double-tap to zoom) or opens a PDF. Render `element` once in the screen. */
export function useDocViewer() {
  const m = useMechanicTheme();
  const [doc, setDoc] = useState<{ uri: string; label: string } | null>(null);
  const [src, setSrc] = useState<{ uri: string; headers: Record<string, string> } | null>(null);
  const [failed, setFailed] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const open = useCallback(
    (d: { uri: string; label: string; mimeType: string }) => {
      setNote(null);
      if (d.mimeType === "application/pdf") {
        openPdf(d.uri, m.t).catch((e) => setNote(e instanceof Error ? e.message : m.t("Could not open this document.", "تعذّر فتح هذا المستند.")));
        return;
      }
      setDoc(d);
    },
    [m.t],
  );
  useEffect(() => {
    let alive = true;
    setSrc(null);
    setFailed(false);
    if (doc) privateImageSource(doc.uri).then((s) => alive && setSrc(s), () => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [doc]);
  const element = (
    <>
      {note ? <MechanicNote error>{note}</MechanicNote> : null}
      <Modal visible={!!doc} animationType="fade" onRequestClose={() => setDoc(null)}>
        <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#120D0A" }}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={{ flexDirection: m.row, alignItems: "center", justifyContent: "space-between", padding: 14, gap: 10 }}>
              <Text numberOfLines={1} style={{ flex: 1, color: "#FFF1DF", fontSize: 15, fontWeight: "600", textAlign: m.align }}>{doc?.label}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={m.t("Close", "إغلاق")} onPress={() => setDoc(null)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="close" size={26} color="#FFF1DF" />
              </Pressable>
            </View>
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              {failed ? (
                <Text style={{ color: "#F1B8A0", fontSize: 13 }}>{m.t("Could not load this document.", "تعذّر تحميل هذا المستند.")}</Text>
              ) : src ? (
                <ZoomableImage source={src} />
              ) : (
                <ActivityIndicator size="large" color="#C98B5B" />
              )}
            </View>
            <Text style={{ color: "#D0B99C", fontSize: 11, textAlign: "center", paddingBottom: 12 }}>{m.t("Pinch or double-tap to zoom", "قرّب بإصبعين أو بنقرتين")}</Text>
          </SafeAreaView>
        </GestureHandlerRootView>
      </Modal>
    </>
  );
  return { open, element };
}

// ---------------------------------------------------------------- chat
export function Bubble({ msg, mine, onOpen }: { msg: Message; mine: boolean; onOpen: (a: Message["attachments"][number]) => void }) {
  const m = useMechanicTheme();
  if (msg.from === "SYSTEM")
    return (
      <View style={{ alignItems: "center", marginVertical: 6 }}>
        <Text style={{ color: m.muted, fontSize: 11, lineHeight: 18, textAlign: "center", paddingHorizontal: 18 }}>{bi(m.ar, msg.body)} · {fmtTime(msg.at)}</Text>
      </View>
    );
  return (
    <View style={{ alignItems: mine ? (m.ar ? "flex-start" : "flex-end") : m.ar ? "flex-end" : "flex-start", marginVertical: 4 }}>
      <View
        style={{ maxWidth: "86%", padding: 12, borderRadius: 18, gap: 6, borderWidth: 1, borderColor: m.border, backgroundColor: mine ? (m.dark ? "#5A3E2C" : "#F3DBBE") : m.surface }}
      >
        <Text style={{ fontSize: 11, color: m.muted, textAlign: m.align }}>{msg.author} · {fmtTime(msg.at)}</Text>
        {msg.body && msg.body !== "📎" ? <Text style={{ fontSize: 14, lineHeight: 22, color: m.ink, textAlign: m.align }}>{msg.body}</Text> : null}
        {msg.attachments.map((a) => (
          <Pressable key={a.id} accessibilityRole="button" accessibilityLabel={a.fileName} onPress={() => onOpen(a)} style={{ flexDirection: m.row, alignItems: "center", gap: 8, minHeight: 36 }}>
            <Ionicons name={a.mimeType === "application/pdf" ? "document-text-outline" : "image-outline"} size={20} color={m.muted} />
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, color: m.ink, textAlign: m.align }}>{a.fileName}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export { MechanicButton };
