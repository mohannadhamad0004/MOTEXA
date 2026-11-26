// The provider's location = a map Detail: the map (tap or drag the pin), "Use my location", and ONE "Confirm location" in the footer.
// The chosen point is saved on the application (the draft) and handed back to the form.
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useWindowDimensions } from "react-native";
import { GButton, GText, Note } from "../../components/garage";
import { Page } from "../../components/manage/Page";
import { cityCentre } from "../../core/constants/cities";
import { useL } from "../../core/hooks/useL";
import { gType } from "../../theme/garage";
import { MapUnavailable, fmtPoint } from "../department/LocationRow";
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
  const { t } = useL();
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
      setError(e instanceof Error ? e.message : t("Could not save the location.", "تعذّر حفظ الموقع."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page title={t("Pick your location", "اختر موقعك")} line={t("Tap the map or drag the pin", "المس الخريطة أو اسحب الدبوس")}
      footer={<GButton icon="checkmark-circle-outline" label={t("Confirm location", "تأكيد الموقع")} busy={busy} disabled={!point || busy} onPress={() => void confirm()} />}>
      {loc.dialog}
      {MAPS_AVAILABLE && point ? <PinMap point={point} onChange={setPoint} height={Math.round(height * 0.5)} /> : !MAPS_AVAILABLE ? <MapUnavailable point={point} /> : null}
      <GText soft={!point} style={[gType.bodySm, { textAlign: "center", fontWeight: point ? "700" : "500", writingDirection: point ? "ltr" : undefined }]}>
        {point ? fmtPoint(point.lat, point.lng) : t("Use your location or choose your city first.", "استخدم موقعك أو اختر مدينتك أولًا.")}
      </GText>
      {loc.message ? <Note tone="danger" icon="location-outline">{loc.message}</Note> : null}
      {error ? <Note tone="danger" icon="alert-circle-outline">{error}</Note> : null}
      {loc.canOpenSettings ? <GButton variant="ghost" icon="settings-outline" label={t("Open Settings", "فتح الإعدادات")} onPress={() => void loc.openSettings()} /> : null}
      <GButton variant="secondary" icon="locate-outline" label={loc.locating ? t("Finding your location…", "جارٍ تحديد موقعك…") : t("Use my location", "استخدم موقعي")} disabled={loc.locating} onPress={() => void useMine()} />
    </Page>
  );
}
