// Full-screen location picker for the provider onboarding: the map (tap or drag the pin), "Use my location" and ONE
// "Confirm location" button. The chosen point is saved on the application (the draft) and handed back to the form.
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../../components/MotexaVisual";
import { cityCentre } from "../../core/constants/cities";
import { BackButton } from "../department/MapPage";
import { MapUnavailable, fmtPoint } from "../department/LocationRow";
import { DButton, cardStyle, useDT } from "../department/ui";
import { MAPS_AVAILABLE, PinMap } from "../shared/maps";
import { useCurrentLocation } from "../shared/useCurrentLocation";
import { onboarding } from "./api";

/** Router params cannot return a value, so the picker leaves the confirmed point here for the form to read once. */
let picked: { lat: number; lng: number } | null = null;
export const takePickedLocation = () => {
  const p = picked;
  picked = null;
  return p;
};

export default function LocationPicker() {
  const { lat, lng, city } = useLocalSearchParams<{ lat?: string; lng?: string; city?: string }>();
  const d = useDT();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const loc = useCurrentLocation();
  const start = lat !== undefined && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) ? { lat: Number(lat), lng: Number(lng) } : city ? cityCentre(city) : null;
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(start ? { lat: start.lat, lng: start.lng } : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function useMine() {
    const p = await loc.locate();
    if (p) setPoint({ lat: p.lat, lng: p.lng });
  }
  async function confirm() {
    if (!point || busy) return;
    setBusy(true);
    setError("");
    try {
      await onboarding.saveInfo({ baseLat: point.lat, baseLng: point.lng }); // the draft keeps it even if the form is closed
      picked = point;
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : d.t("Could not save the location.", "تعذّر حفظ الموقع."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: d.dark ? "#1B1511" : "#F3E7D3" }}>
      {loc.dialog}
      {MAPS_AVAILABLE && point ? <PinMap point={point} onChange={setPoint} height={height} /> : !MAPS_AVAILABLE ? <MapUnavailable point={point} /> : null}
      <View pointerEvents="box-none" style={{ position: "absolute", top: insets.top + 10, left: 14, right: 14, flexDirection: d.row, alignItems: "center", gap: 10 }}>
        <BackButton />
        <View style={{ flex: 1, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 9, backgroundColor: d.dark ? "#2A1F18F2" : "#FFFCF6F2", borderWidth: 1, borderColor: d.border }}>
          <Text numberOfLines={1} style={{ color: d.ink, fontSize: 15, lineHeight: 22, fontWeight: "700", textAlign: d.align }}>{d.t("Pick your location", "اختر موقعك")}</Text>
          <Text numberOfLines={1} style={{ color: d.muted, fontSize: 11, lineHeight: 16, textAlign: d.align }}>{d.t("Tap the map or drag the pin", "المس الخريطة أو اسحب الدبوس")}</Text>
        </View>
      </View>
      <View pointerEvents="box-none" style={{ position: "absolute", left: 14, right: 14, bottom: Math.max(insets.bottom, 14) }}>
        <View style={{ ...cardStyle(d), padding: 14, gap: 10, backgroundColor: d.dark ? "#2F231BF7" : "#FFFCF6F7" }}>
          {point ? <Text style={{ color: d.ink, fontSize: 13, fontWeight: "700", textAlign: "center", writingDirection: "ltr" }}>{fmtPoint(point.lat, point.lng)}</Text> : <Text style={{ color: d.muted, fontSize: 13, textAlign: "center" }}>{d.t("Use your location or choose your city first.", "استخدم موقعك أو اختر مدينتك أولًا.")}</Text>}
          {loc.message ? <Text accessibilityRole="alert" style={{ color: d.bad, fontSize: 12, textAlign: "center" }}>{loc.message}</Text> : null}
          {error ? <Text accessibilityRole="alert" style={{ color: d.bad, fontSize: 12, textAlign: "center" }}>{error}</Text> : null}
          <DButton variant="ghost" icon="locate-outline" label={loc.locating ? d.t("Finding your location…", "جارٍ تحديد موقعك…") : d.t("Use my location", "استخدم موقعي")} disabled={loc.locating} onPress={useMine} />
          <DButton icon="checkmark-circle-outline" label={d.t("Confirm location", "تأكيد الموقع")} disabled={!point || busy} onPress={confirm} />
        </View>
      </View>
    </View>
  );
}
