// "My car in 3D": the customer's car as a real 3D model (features/car3d/models.ts) in their paint. Drag to turn, pinch to zoom,
// double-tap to reset. Under it: rear wing, roof rack, "Change car or colour", and the model's credit (CC BY requires it).
// A car without a real model yet: the "coming soon" card.
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Chip, EmptyState, GButton, GText, IconButton } from "../../components/garage";
import { useL } from "../../core/hooks/useL";
import { carName } from "../../features/catalog/catalogBits";
import { openMyCarPicker, openEditGarageCar, useMyCar } from "../../features/catalog/myCar";
import { Car3DView } from "../../features/car3d/Car3DView";
import { ComingSoon } from "../../features/car3d/CarPreview";
import { DEFAULT_COLOR, NO_ADJUST, setLook, useLook, type BumperAdjust } from "../../features/car3d/car3d";
import { BUMPER_TESTS, modelFor } from "../../features/car3d/models";
import { gType, useGarageTheme } from "../../theme/garage";

// BODYKIT TEST: hand-fit rows, [label, field, step per tap]; positions in metres, angles in radians, scale as a factor
const NUDGE: [string, keyof BumperAdjust, number][] = [
  ["X", "x", 0.02], ["Y", "y", 0.02], ["Z", "z", 0.02], ["Rotate", "ry", 0.026], ["Tilt", "rx", 0.026], ["Scale", "s", 0.02],
];

export default function MyCar3D() {
  const { g, row, align } = useGarageTheme();
  const { t } = useL();
  const insets = useSafeAreaInsets();
  const { car, loaded } = useMyCar();
  const look = useLook();
  const model = modelFor(car);
  const kit = !!model && !!BUMPER_TESTS[model.key];
  const [adjusting, setAdjusting] = useState(false);
  const nudge = (f: keyof BumperAdjust, d: number) => setLook({ adj: { ...look.adj, [f]: Math.round((look.adj[f] + d) * 1000) / 1000 } });
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
          <GButton variant="secondary" icon="color-palette-outline" label={t("Edit active car or colour", "تعديل السيارة النشطة أو اللون")} onPress={() => car.id ? openEditGarageCar(car.id) : openMyCarPicker()} />
        </View>
      ) : (
        <>
          <Car3DView model={model} color={car.color ?? DEFAULT_COLOR} wing={look.wing} rack={look.rack} bumper={look.bumper} bumperPaint={look.bumperPaint} adj={look.adj} interactive bg={g.page} style={{ flex: 1, marginTop: 8 }} />
          <GText soft style={[gType.tiny, { textAlign: "center", marginTop: 4 }]}>{t("Drag to turn · pinch to zoom · double-tap to reset", "اسحب للتدوير · قرّب بإصبعين · انقر مرتين للإعادة")}</GText>
          <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 12, gap: 12 }}>
            {/* rim choice: only for rimsSwappable models, and not built yet (no rim set to swap in) */}
            <GText style={[gType.label, { fontWeight: "800" }, align]}>{t("Extras", "إضافات")}</GText>
            <View style={[row, { gap: 8, flexWrap: "wrap" }]}>
              <Chip label={t("Rear wing", "جناح خلفي")} on={look.wing} icon={look.wing ? "checkmark" : "add"} onPress={() => setLook({ wing: !look.wing })} />
              <Chip label={t("Roof rack", "حامل سقف")} on={look.rack} icon={look.rack ? "checkmark" : "add"} onPress={() => setLook({ rack: !look.rack })} />
              {kit ? <Chip label={t("Front bumper (test)", "مصد أمامي (تجريبي)")} on={look.bumper} icon={look.bumper ? "checkmark" : "add"} onPress={() => setLook({ bumper: !look.bumper })} /> : null}
              {kit && look.bumper ? <Chip label={t("Paint to match", "طلاء مطابق")} on={look.bumperPaint} icon={look.bumperPaint ? "checkmark" : "color-fill-outline"} onPress={() => setLook({ bumperPaint: !look.bumperPaint })} /> : null}
              {kit && look.bumper ? <Chip label={t("Adjust", "ضبط")} on={adjusting} icon="options-outline" onPress={() => setAdjusting(!adjusting)} /> : null}
            </View>
            {kit && look.bumper && adjusting ? (
              <View style={[row, { flexWrap: "wrap", gap: 6 }]}>
                {NUDGE.map(([label, f, step]) => (
                  <View key={f} style={[row, { alignItems: "center", gap: 6, width: "48%" }]}>
                    <GText style={[gType.label, { width: 58 }]}>{label}</GText>
                    <Chip label="−" on={false} onPress={() => nudge(f, -step)} />
                    <Chip label="+" on={false} onPress={() => nudge(f, step)} />
                    <GText soft style={gType.tiny}>{look.adj[f].toFixed(2)}</GText>
                  </View>
                ))}
                <Chip label={t("Reset", "إعادة")} on={false} onPress={() => setLook({ adj: NO_ADJUST })} />
              </View>
            ) : null}
            <GButton variant="secondary" icon="color-palette-outline" label={t("Edit active car or colour", "تعديل السيارة النشطة أو اللون")} onPress={() => car.id ? openEditGarageCar(car.id) : openMyCarPicker()} />
            <GText soft style={[gType.tiny, { textAlign: "center" }]}>{`${t("3D model", "نموذج ثلاثي الأبعاد")}: ${model.credit.author} (${model.credit.license})`}</GText>
          </View>
        </>
      )}
    </View>
  );
}
