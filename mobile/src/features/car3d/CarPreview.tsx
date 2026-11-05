// Compact "See your car in 3D" card (Home, Profile): a slowly turning, non-interactive preview; the whole card opens the page.
// A car without a real model gets a quiet "3D for <car> is coming soon" card with its colour dot instead (no toy fallback).
import { router } from "expo-router";
import { View } from "react-native";
import { GIcon, GText, Tap } from "../../components/garage";
import { useL } from "../../core/hooks/useL";
import { gShape, gType, useGarageTheme } from "../../theme/garage";
import { carName } from "../catalog/catalogBits";
import { Car, useMyCar } from "../catalog/myCar";
import { DEFAULT_COLOR, useLook } from "./car3d";
import { Car3DView } from "./Car3DView";
import { useCatalogModel } from "./runtimeModels";

/** "3D for Audi A6 is coming soon" + the car's colour dot. */
export function ComingSoon({ car }: { car: Car }) {
  const { g, row, align } = useGarageTheme();
  const { t } = useL();
  const name = carName({ ...car, year: "" });
  return (
    <View style={[row, { alignItems: "center", gap: 12, padding: 14, borderRadius: gShape.cardLg, backgroundColor: g.card, borderWidth: 1, borderColor: g.line }]}>
      <View accessibilityLabel={t("Car colour", "لون السيارة")} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: car.color ?? DEFAULT_COLOR, borderWidth: 1, borderColor: g.line }} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <GText style={[gType.label, { fontWeight: "800" }, align]}>{t(`3D for ${name} is coming soon`, `العرض ثلاثي الأبعاد لـ ${name} قريبًا`)}</GText>
        <GText soft style={[gType.caption, align]}>{t("We're adding real 3D models car by car.", "نضيف نماذج ثلاثية الأبعاد حقيقية سيارة بعد سيارة.")}</GText>
      </View>
    </View>
  );
}

export function CarPreview() {
  const { g, row, align, shadow } = useGarageTheme();
  const { t } = useL();
  const { car } = useMyCar();
  const look = useLook();
  const model = useCatalogModel(car);
  if (!car) return null;
  if (!model) return <ComingSoon car={car} />;
  return (
    <Tap label={t("See your car in 3D", "شاهد سيارتك ثلاثية الأبعاد")} onPress={() => router.push("/customer/car3d")} style={[row, { alignItems: "center", gap: 12, padding: 10, borderRadius: gShape.cardLg, backgroundColor: g.card }, shadow(1)]}>
      <View pointerEvents="none" style={{ width: 128, height: 96, borderRadius: gShape.small, overflow: "hidden" }}>
        <Car3DView model={model} color={car.color ?? DEFAULT_COLOR} {...look} bg={g.cardSoft} style={{ flex: 1 }} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <GText style={[gType.label, { fontWeight: "800" }, align]}>{t("See your car in 3D", "شاهد سيارتك ثلاثية الأبعاد")}</GText>
        <GText soft numberOfLines={2} style={[gType.caption, align]}>{carName(car)}</GText>
      </View>
      <GIcon name="chevron-forward" size={18} color={g.soft} flip />
    </Tap>
  );
}
