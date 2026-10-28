// A compact location row (pin icon, place, coordinates, one button). Used where a map used to sit inline:
// the admin review ("View on map") and the provider onboarding ("Pick location on map" / "Change").
import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";
import { Text } from "../../components/MotexaVisual";
import { cityLabel } from "../../core/constants/cities";
import { DButton, cardStyle, useDT } from "./ui";

export const fmtPoint = (lat: number, lng: number) => `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

export function LocationRow({
  point,
  city,
  address,
  buttonLabel,
  emptyLabel,
  onPress,
  flagged,
}: {
  point: { lat: number; lng: number } | null;
  city?: string | null;
  address?: string | null;
  buttonLabel: string;
  /** shown instead of the place when nothing is set yet */
  emptyLabel?: string;
  onPress: () => void;
  flagged?: boolean;
}) {
  const d = useDT();
  const cityText = city ? cityLabel(city, d.ar) : null;
  // the address often ends with the city already
  const hasCity = !!address && !!city && [city, cityText ?? ""].some((c) => c && address.toLowerCase().includes(c.toLowerCase()));
  const place = [address, hasCity ? null : cityText].filter(Boolean).join(" · ");
  return (
    <View style={{ ...cardStyle(d, flagged ? "bad" : undefined), padding: 14, gap: 12 }}>
      <View style={{ flexDirection: d.row, alignItems: "center", gap: 12 }}>
        <View style={{ width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: point ? d.chip("bronze").bg : d.chip("neutral").bg, borderWidth: 1, borderColor: point ? d.chip("bronze").border : d.chip("neutral").border }}>
          <Ionicons name={point ? "location" : "location-outline"} size={24} color={point ? d.chip("bronze").fg : d.muted} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={2} style={{ color: d.ink, fontSize: 14, lineHeight: 22, fontWeight: "700", textAlign: d.align }}>
            {point ? place || d.t("Location set", "تم تحديد الموقع") : (emptyLabel ?? d.t("No location yet", "لم يُحدد موقع بعد"))}
          </Text>
          {point ? <Text style={{ color: d.muted, fontSize: 12, lineHeight: 18, textAlign: d.align, writingDirection: "ltr" }}>{fmtPoint(point.lat, point.lng)}</Text> : null}
        </View>
      </View>
      <DButton label={buttonLabel} icon={point ? "map-outline" : "pin-outline"} variant={point ? "ghost" : "primary"} onPress={onPress} />
    </View>
  );
}

/** Shown instead of the map where maps do not run (the web build): the coordinates stay usable. */
export function MapUnavailable({ point }: { point: { lat: number; lng: number } | null }) {
  const d = useDT();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 }}>
      <View style={{ width: 84, height: 84, borderRadius: 42, alignItems: "center", justifyContent: "center", backgroundColor: d.chip("bronze").bg, borderWidth: 1, borderColor: d.chip("bronze").border }}>
        <Ionicons name="map-outline" size={40} color={d.chip("bronze").fg} />
      </View>
      <Text style={{ color: d.ink, fontSize: 15, lineHeight: 23, fontWeight: "700", textAlign: "center" }}>{d.t("The map is shown in the MOTEXA app on your phone.", "تظهر الخريطة في تطبيق MOTEXA على هاتفك.")}</Text>
      {point ? <Text style={{ color: d.muted, fontSize: 13, writingDirection: "ltr" }}>{fmtPoint(point.lat, point.lng)}</Text> : null}
    </View>
  );
}
