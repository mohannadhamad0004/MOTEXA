// A compact location row (pin, place, coordinates, one button), Garage kit. Used where a map used to sit inline: the admin review
// ("View on map") and the provider onboarding ("Pick location on map" / "Change").
import { View } from "react-native";
import { GButton, GIcon, GText } from "../../components/garage";
import { cityLabel } from "../../core/constants/cities";
import { useL } from "../../core/hooks/useL";
import { gShape, gType, useGarageTheme } from "../../theme/garage";

export const fmtPoint = (lat: number, lng: number) => `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

export function LocationRow({ point, city, address, buttonLabel, emptyLabel, onPress, flagged }: {
  point: { lat: number; lng: number } | null; city?: string | null; address?: string | null; buttonLabel: string;
  /** shown instead of the place when nothing is set yet */
  emptyLabel?: string; onPress: () => void; flagged?: boolean;
}) {
  const { t, isArabic } = useL();
  const { g, row, align } = useGarageTheme();
  const cityText = city ? cityLabel(city, isArabic) : null;
  // the address often ends with the city already
  const hasCity = !!address && !!city && [city, cityText ?? ""].some(c => c && address.toLowerCase().includes(c.toLowerCase()));
  const place = [address, hasCity ? null : cityText].filter(Boolean).join(" · ");
  return (
    <View style={{ borderRadius: gShape.small, borderWidth: 1, borderColor: flagged ? g.danger : g.line, backgroundColor: g.card, padding: 12, gap: 10 }}>
      <View style={[row, { alignItems: "center", gap: 12 }]}>
        <GIcon name={point ? "location" : "location-outline"} size={24} color={point ? g.accentText : g.soft} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <GText numberOfLines={2} style={[gType.bodySm, align, { fontWeight: "700" }]}>{point ? place || t("Location set", "تم تحديد الموقع") : (emptyLabel ?? t("No location yet", "لم يُحدد موقع بعد"))}</GText>
          {point ? <GText soft style={[gType.caption, align, { writingDirection: "ltr" }]}>{fmtPoint(point.lat, point.lng)}</GText> : null}
        </View>
      </View>
      <GButton label={buttonLabel} icon={point ? "map-outline" : "pin-outline"} variant={point ? "secondary" : "primary"} onPress={onPress} />
    </View>
  );
}

/** Shown instead of the map where maps do not run (the web build): the coordinates stay usable. */
export function MapUnavailable({ point }: { point: { lat: number; lng: number } | null }) {
  const { t } = useL();
  const { g } = useGarageTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 }}>
      <GIcon name="map-outline" size={40} color={g.accentText} />
      <GText style={[gType.body, { textAlign: "center", fontWeight: "700" }]}>{t("The map is shown in the MOTEXA app on your phone.", "تظهر الخريطة في تطبيق MOTEXA على هاتفك.")}</GText>
      {point ? <GText soft style={[gType.bodySm, { writingDirection: "ltr" }]}>{fmtPoint(point.lat, point.lng)}</GText> : null}
    </View>
  );
}
