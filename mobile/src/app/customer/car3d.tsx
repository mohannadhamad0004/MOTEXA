// "My car in 3D": the customer's car as a real 3D model (features/car3d/models.ts) in their paint. Drag to turn, pinch to zoom,
// double-tap to reset. Under it: rear wing, roof rack, "Change car or colour", and the model's credit (CC BY requires it).
// A car without a real model yet: the "coming soon" card.
import { router } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Chip, EmptyState, GButton, GText, IconButton } from "../../components/garage";
import { useL } from "../../core/hooks/useL";
import { carName } from "../../features/catalog/catalogBits";
import { openMyCarPicker, useMyCar } from "../../features/catalog/myCar";
import { Car3DView } from "../../features/car3d/Car3DView";
import { ComingSoon } from "../../features/car3d/CarPreview";
import { DEFAULT_COLOR, setLook, useLook } from "../../features/car3d/car3d";
import { modelFor } from "../../features/car3d/models";
import { gType, useGarageTheme } from "../../theme/garage";

export default function MyCar3D() {
  const { g, row, align } = useGarageTheme();
  const { t } = useL();
  const insets = useSafeAreaInsets();
  const { car, loaded } = useMyCar();
  const look = useLook();
  const model = modelFor(car);
  const back = () => (router.canGoBack() ? router.back() : router.navigate("/customer/profile"));

  return (
    <View style={{ flex: 1, backgroundColor: g.page, paddingTop: insets.top + 8 }}>
      <View style={[row, { alignItems: "center", gap: 12, paddingHorizontal: 20 }]}>
        <IconButton icon="arrow-back" label={t("Back", "رجوع")} onPress={back} flip />
        <View style={{ flex: 1, minWidth: 0 }}>
          <GText accessibilityRole="header" style={[gType.title, align]}>{t("My car in 3D", "سيارتي ثلاثية الأبعاد")}</GText>
          {car ? <GText soft numberOfLines={1} style={[gType.caption, align]}>{carName(car)}</GText> : null}
        </View>
      </View>

      {!car ? (
        loaded ? (
          <EmptyState text={t("Set your car to see it in 3D.", "حدّد سيارتك لتراها ثلاثية الأبعاد.")} action={{ label: t("Set your car", "حدّد سيارتك"), onPress: openMyCarPicker }} />
        ) : null
      ) : !model ? (
        <View style={{ padding: 20, gap: 12 }}>
          <ComingSoon car={car} />
          <GButton variant="secondary" icon="color-palette-outline" label={t("Change car or colour", "تغيير السيارة أو اللون")} onPress={openMyCarPicker} />
        </View>
      ) : (
        <>
          <Car3DView model={model} color={car.color ?? DEFAULT_COLOR} wing={look.wing} rack={look.rack} interactive bg={g.page} style={{ flex: 1, marginTop: 8 }} />
          <GText soft style={[gType.tiny, { textAlign: "center", marginTop: 4 }]}>{t("Drag to turn · pinch to zoom · double-tap to reset", "اسحب للتدوير · قرّب بإصبعين · انقر مرتين للإعادة")}</GText>
          <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 12, gap: 12 }}>
            {/* rim chips only for models whose wheels are separate meshes (none yet: the Corolla's are one combined mesh) */}
            <GText style={[gType.label, { fontWeight: "800" }, align]}>{t("Extras", "إضافات")}</GText>
            <View style={[row, { gap: 8, flexWrap: "wrap" }]}>
              <Chip label={t("Rear wing", "جناح خلفي")} on={look.wing} icon={look.wing ? "checkmark" : "add"} onPress={() => setLook({ wing: !look.wing })} />
              <Chip label={t("Roof rack", "حامل سقف")} on={look.rack} icon={look.rack ? "checkmark" : "add"} onPress={() => setLook({ rack: !look.rack })} />
            </View>
            <GButton variant="secondary" icon="color-palette-outline" label={t("Change car or colour", "تغيير السيارة أو اللون")} onPress={openMyCarPicker} />
            <GText soft style={[gType.tiny, { textAlign: "center" }]}>{`${t("3D model", "نموذج ثلاثي الأبعاد")}: ${model.credit.author} (CC BY)`}</GText>
          </View>
        </>
      )}
    </View>
  );
}
