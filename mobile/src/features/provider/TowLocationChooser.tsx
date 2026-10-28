// "Use my location" / "Choose on the map" + an explicit confirm, for the tow signup (the company base in Step 2, each truck in Step 3).
// A place only counts once it is a valid latitude + longitude AND the owner pressed Confirm; an address or city alone never does.
import { useState } from "react";
import { View } from "react-native";
import { Text } from "../../components/MotexaVisual";
import { cityCentre } from "../../core/constants/cities";
import { DButton, Pill, cardStyle, useDT } from "../department/ui";
import { fmtPoint } from "../department/LocationRow";
import { MAPS_AVAILABLE, PinMap } from "../shared/maps";
import { LocationProblem, reverseGeocode, useCurrentLocation } from "../shared/useCurrentLocation";
import type { TowSignupPlace } from "./towSignupDraft";

type Pt = { lat: number; lng: number };

export const validPoint = (p: Pt | null): p is Pt => !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180 && !(p.lat === 0 && p.lng === 0);

/**
 * `value` = the place already confirmed (or null). `onChange` gets the confirmed place, or null as soon as the pin is moved or a new
 * position is read (so the parent knows it is no longer confirmed). `startCity` only decides where the map first opens.
 */
export function TowLocationChooser({ value, startCity, onChange }: { value: TowSignupPlace | null; startCity: string; onChange: (p: TowSignupPlace | null) => void }) {
  const d = useDT();
  const loc = useCurrentLocation("signup");
  const [point, setPoint] = useState<Pt | null>(value ? { lat: value.baseLat, lng: value.baseLng } : null);
  const [source, setSource] = useState<TowSignupPlace["locationSource"]>(value?.locationSource ?? "manual");
  const [address, setAddress] = useState<string | null>(value?.locationAddress ?? null);
  const [confirmed, setConfirmed] = useState(!!value);
  const [busy, setBusy] = useState(false);

  const pick = (p: Pt, src: TowSignupPlace["locationSource"]) => {
    setPoint(p);
    setSource(src);
    setAddress(null);
    setConfirmed(false);
    onChange(null);
  };
  async function useMine() {
    const p = await loc.locate();
    if (p) pick({ lat: p.lat, lng: p.lng }, "current_location"); // a refusal shows its reason below; the map choice stays available
  }
  const startOnMap = () => {
    const c = cityCentre(startCity); // only where the map opens; the owner still places the pin and confirms
    if (c) pick({ lat: c.lat, lng: c.lng }, "manual");
  };
  async function confirm() {
    if (!validPoint(point) || busy) return;
    setBusy(true);
    const label = await reverseGeocode(point); // a readable label only; null is fine
    setAddress(label);
    setConfirmed(true);
    onChange({ baseLat: point.lat, baseLng: point.lng, locationAddress: label, locationSource: source });
    setBusy(false);
  }

  const ok = confirmed && validPoint(point);
  const sel = d.chip(ok ? "ok" : "amber");
  return (
    <View style={{ ...cardStyle(d), padding: 14, gap: 12 }}>
      {loc.dialog}
      <DButton variant="ghost" icon="locate-outline" label={loc.locating ? d.t("Finding your location…", "جارٍ تحديد موقعك…") : d.t("Use my location", "استخدم موقعي")} disabled={loc.locating} onPress={useMine} />
      <LocationProblem loc={loc} />
      {loc.message ? <Text style={{ color: d.muted, fontSize: 12, lineHeight: 19, textAlign: d.align }}>{d.t("You can still place the location on the map.", "ما زال بإمكانك تحديد الموقع على الخريطة.")}</Text> : null}
      {point && MAPS_AVAILABLE ? (
        <View style={{ height: 260, borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: d.border }}>
          <PinMap point={point} onChange={(p) => pick(p, "manual")} height={260} />
        </View>
      ) : !MAPS_AVAILABLE ? (
        <Text style={{ color: d.muted, fontSize: 12, lineHeight: 19, textAlign: d.align }}>{d.t("The map is shown in the MOTEXA app on your phone. Here you can use your location.", "تظهر الخريطة في تطبيق MOTEXA على هاتفك. هنا يمكنك استخدام موقعك.")}</Text>
      ) : (
        <DButton variant="ghost" icon="map-outline" label={d.t("Choose on the map", "اختر على الخريطة")} onPress={startOnMap} />
      )}
      {point && MAPS_AVAILABLE ? <Text style={{ color: d.muted, fontSize: 12, lineHeight: 19, textAlign: d.align }}>{d.t("Tap the map or drag the pin to move it.", "المس الخريطة أو اسحب الدبوس لتحريكه.")}</Text> : null}
      <View accessibilityLiveRegion="polite" style={{ borderRadius: 16, borderWidth: 1, borderColor: sel.border, backgroundColor: sel.bg, padding: 12, gap: 6 }}>
        <View style={{ flexDirection: d.row, alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Pill tone={ok ? "ok" : "amber"} icon={ok ? "checkmark-circle-outline" : "alert-circle-outline"} label={ok ? d.t("Location confirmed", "تم تأكيد الموقع") : point ? d.t("Not confirmed yet", "لم يتم التأكيد بعد") : d.t("No location selected", "لم يتم اختيار موقع")} />
          {point ? <Pill icon={source === "current_location" ? "locate-outline" : "pin-outline"} label={source === "current_location" ? d.t("Your location", "موقعك الحالي") : d.t("Placed on the map", "محدد على الخريطة")} /> : null}
        </View>
        {point ? <Text style={{ color: sel.fg, fontSize: 14, fontWeight: "700", textAlign: d.align, writingDirection: "ltr" }}>{fmtPoint(point.lat, point.lng)}</Text> : null}
        {address ? <Text style={{ color: sel.fg, fontSize: 12, lineHeight: 19, textAlign: d.align }}>{address}</Text> : null}
      </View>
      {point && !ok ? <DButton icon="checkmark-circle-outline" label={busy ? d.t("Confirming…", "جارٍ التأكيد…") : d.t("Confirm this location", "تأكيد هذا الموقع")} disabled={busy} onPress={confirm} /> : null}
    </View>
  );
}
