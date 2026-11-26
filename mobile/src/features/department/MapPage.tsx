// Full-screen map page (Detail with a map body): only the map, the pin, a back button and the place name. No forms, no lists.
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GIcon, GText } from "../../components/garage";
import { useL } from "../../core/hooks/useL";
import { gType, useGarageTheme } from "../../theme/garage";
import { MAPS_AVAILABLE, PinMap } from "../shared/maps";
import { MapUnavailable, fmtPoint } from "./LocationRow";

export function BackButton({ onPress }: { onPress?: () => void }) {
  const { t } = useL();
  const { g } = useGarageTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t("Back", "رجوع")} onPress={onPress ?? (() => router.back())}
      style={({ pressed }) => ({ width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: g.card, borderWidth: 1, borderColor: g.line, opacity: pressed ? 0.8 : 1 })}>
      <GIcon name="arrow-back" size={22} color={g.ink} flip />
    </Pressable>
  );
}

export default function MapPage() {
  const { lat, lng, name } = useLocalSearchParams<{ lat?: string; lng?: string; name?: string }>();
  const { t } = useL();
  const { g, row, align } = useGarageTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const point = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && lat !== undefined ? { lat: Number(lat), lng: Number(lng) } : null;
  return (
    <View style={{ flex: 1, backgroundColor: g.page }}>
      {MAPS_AVAILABLE && point ? <PinMap point={point} height={height} /> : !MAPS_AVAILABLE ? <MapUnavailable point={point} /> : null}
      <View pointerEvents="box-none" style={[row, { position: "absolute", top: insets.top + 10, left: 14, right: 14, alignItems: "center", gap: 10 }]}>
        <BackButton />
        <View style={{ flex: 1, minWidth: 0, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 9, backgroundColor: g.card, borderWidth: 1, borderColor: g.line }}>
          <GText numberOfLines={1} style={[gType.bodySm, { fontWeight: "700" }, align]}>{name || t("Location", "الموقع")}</GText>
          {point ? <GText soft style={[gType.caption, align, { writingDirection: "ltr" }]}>{fmtPoint(point.lat, point.lng)}</GText> : null}
        </View>
      </View>
      {!point && MAPS_AVAILABLE ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 30 }}>
          <GText soft style={{ textAlign: "center" }}>{t("This application has no location yet.", "لا يوجد موقع لهذا الطلب بعد.")}</GText>
        </View>
      ) : null}
    </View>
  );
}
