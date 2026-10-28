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
import { MechanicNote, useMechanicTheme } from "../../components/MechanicUI";
import { Text } from "../../components/MotexaVisual";
import * as Store from "../../components/SessionStore";
import { API_URL } from "../../core/config/api";
import { privateImageSource } from "../shared/api";
import { useDT } from "../department/ui";

// ---------------------------------------------------------------- vertical stepper
export type Step = { key: string; label: string; hint?: string; done: boolean };

/** Numbered steps joined by a line; the active step opens its content right under its title. Done = bronze with a check. */
export function VerticalStepper({ steps, current, onSelect, children }: { steps: Step[]; current: string; onSelect?: (key: string) => void; children: (key: string) => ReactNode }) {
  const d = useDT();
  const at = Math.max(0, steps.findIndex((x) => x.key === current));
  const doneCount = steps.filter((x) => x.done).length;
  return (
    <View>
      <View accessible accessibilityRole="progressbar" accessibilityLabel={d.t(`Step ${at + 1} of ${steps.length}`, `الخطوة ${at + 1} من ${steps.length}`)} style={{ marginBottom: 16, gap: 6 }}>
        <View style={{ flexDirection: d.row, justifyContent: "space-between" }}>
          <Text style={{ color: d.ink, fontSize: 12, fontWeight: "700" }}>{d.t(`Step ${at + 1} of ${steps.length}`, `الخطوة ${at + 1} من ${steps.length}`)}</Text>
          <Text style={{ color: d.muted, fontSize: 12 }}>{d.t(`${doneCount} done`, `${doneCount} مكتملة`)}</Text>
        </View>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: d.chip("neutral").bg, overflow: "hidden", flexDirection: d.row }}>
          <View style={{ width: `${(Math.max(doneCount, at) / steps.length) * 100}%`, backgroundColor: d.fill, borderRadius: 3 }} />
        </View>
      </View>
      {steps.map((s, i) => {
        const active = s.key === current;
        const last = i === steps.length - 1;
        return (
          <View key={s.key} style={{ flexDirection: d.row, gap: 12 }}>
            <View style={{ alignItems: "center", width: 34 }}>
              <View
                style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: s.done ? d.fill : active ? d.chip("bronze").bg : "transparent", borderWidth: 2, borderColor: s.done || active ? d.fill : d.border }}
              >
                {s.done ? <Ionicons name="checkmark" size={18} color={d.fillInk} /> : <Text style={{ fontSize: 13, fontWeight: "800", color: active ? d.chip("bronze").fg : d.muted }}>{i + 1}</Text>}
              </View>
              {!last ? <View style={{ flex: 1, width: 2, minHeight: 18, backgroundColor: s.done ? d.fill : d.border, marginVertical: 4, borderRadius: 1 }} /> : null}
            </View>
            <View style={{ flex: 1, minWidth: 0, paddingBottom: last ? 0 : 18 }}>
              <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={s.label} disabled={!onSelect} onPress={() => onSelect?.(s.key)} style={{ minHeight: 34, justifyContent: "center" }}>
                <Text style={{ fontSize: 16, lineHeight: 24, fontWeight: "700", color: active || s.done ? d.ink : d.muted, textAlign: d.align }}>{s.label}</Text>
                {s.hint ? <Text style={{ fontSize: 12, lineHeight: 18, color: d.muted, textAlign: d.align }}>{s.hint}</Text> : null}
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
