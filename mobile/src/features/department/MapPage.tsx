// Full-screen map page: only the map, the pin, a back button and the place name. No forms, no lists.
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import InteractiveButton from "../../components/InteractiveButton";
import { Text } from "../../components/MotexaVisual";
import { MAPS_AVAILABLE, PinMap } from "../shared/maps";
import { MapUnavailable, fmtPoint } from "./LocationRow";
import { useDT } from "./ui";

export function BackButton({ onPress }: { onPress?: () => void }) {
  const d = useDT();
  return (
    <InteractiveButton
      accessibilityRole="button"
      accessibilityLabel={d.t("Back", "رجوع")}
      onPress={onPress ?? (() => router.back())}
      style={{ width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: d.dark ? "#2A1F18F2" : "#FFFCF6F2", borderWidth: 1, borderColor: d.border, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 }}
    >
      <Ionicons name={d.ar ? "arrow-forward" : "arrow-back"} size={22} color={d.ink} />
    </InteractiveButton>
  );
}

export default function MapPage() {
  const { lat, lng, name } = useLocalSearchParams<{ lat?: string; lng?: string; name?: string }>();
  const d = useDT();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const point = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && lat !== undefined ? { lat: Number(lat), lng: Number(lng) } : null;
  return (
    <View style={{ flex: 1, backgroundColor: d.dark ? "#1B1511" : "#F3E7D3" }}>
      {MAPS_AVAILABLE && point ? <PinMap point={point} height={height} /> : !MAPS_AVAILABLE ? <MapUnavailable point={point} /> : null}
      <View pointerEvents="box-none" style={{ position: "absolute", top: insets.top + 10, left: 14, right: 14, flexDirection: d.row, alignItems: "center", gap: 10 }}>
        <BackButton />
        <View style={{ flex: 1, minWidth: 0, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 9, backgroundColor: d.dark ? "#2A1F18F2" : "#FFFCF6F2", borderWidth: 1, borderColor: d.border }}>
          <Text numberOfLines={1} style={{ color: d.ink, fontSize: 15, lineHeight: 22, fontWeight: "700", textAlign: d.align }}>{name || d.t("Location", "الموقع")}</Text>
          {point ? <Text style={{ color: d.muted, fontSize: 11, lineHeight: 16, textAlign: d.align, writingDirection: "ltr" }}>{fmtPoint(point.lat, point.lng)}</Text> : null}
        </View>
      </View>
      {!point && MAPS_AVAILABLE ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 30 }}>
          <Text style={{ color: d.muted, fontSize: 14, textAlign: "center" }}>{d.t("This application has no location yet.", "لا يوجد موقع لهذا الطلب بعد.")}</Text>
        </View>
      ) : null}
    </View>
  );
}
