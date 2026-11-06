// "My car in 3D": the customer's car as a real 3D model (features/car3d/models.ts) in their paint. Drag to turn, pinch to zoom,
// double-tap to reset. Under it: "Change car or colour" and the model's credit (CC BY requires it). Accessories come only from real
// published shop products.
// Opened from a product ("View on my car", ?product=<id>): that shop accessory is fitted on the car, with "Paint to match" and
// on / off per part (rims: the shop's finish instead of "Paint to match"). The fit itself is the stored auto-fit + the Parts Admin's correction (Adjust is admin-only,
// in /dept/accessory-zones -> Accessory fits; offsets customers saved earlier stay in the database but are not applied).
// A car without a real model yet: the "coming soon" card.
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Chip, EmptyState, GButton, GText, IconButton, Note } from "../../components/garage";
import { useL } from "../../core/hooks/useL";
import { carName } from "../../features/catalog/catalogBits";
import { openMyCarPicker, openEditGarageCar, useMyCar } from "../../features/catalog/myCar";
import { Car3DView } from "../../features/car3d/Car3DView";
import { ComingSoon } from "../../features/car3d/CarPreview";
import { DEFAULT_COLOR, NO_ADJUST } from "../../features/car3d/car3d";
import { useCatalogModel } from "../../features/car3d/runtimeModels";
import type { Kit } from "../../features/car3d/useCar3D";
import { ACCESSORY_TYPE_LABELS, RIM_FINISH_LABELS, bumperLabel, customerAccessoryApi, isBumper, type CustomerAccessory, type CustomerPart, type KitPart } from "../../features/accessory3d/api";
import { gType, useGarageTheme } from "../../theme/garage";


export default function MyCar3D() {
  const { g, row, align } = useGarageTheme();
  const { t } = useL();
  const insets = useSafeAreaInsets();
  const { product } = useLocalSearchParams<{ product?: string }>();
  const { car, loaded } = useMyCar();
  const model = useCatalogModel(car);
  const [acc, setAcc] = useState<CustomerAccessory>(null);
  // a body kit shows its front and rear bumper together; each one is switched on / off on its own
  const [off, setOff] = useState<Partial<Record<KitPart, boolean>>>({}), [paint, setPaint] = useState(false);
  const [fitErrors, setFitErrors] = useState<Record<string, string>>({});
  const genId = car?.generation?.id ?? null;
  const parts: CustomerPart[] = useMemo(() => acc ? acc.parts ?? [{ part: "MAIN", type: acc.type, fitsIds: acc.fits.map(f => f.id), model: acc.model, autoFit: acc.autoFit ?? null }] : [], [acc]);
  useEffect(() => {
    if (!product) { setAcc(null); return; }
    let live = true; setFitErrors({});
    customerAccessoryApi.get(product, genId).then(a => live && setAcc(a), () => live && setAcc(null));
    return () => { live = false; };
  }, [product, genId]);
  const fitting = parts.filter(x => !!x.model && !!genId && (!!x.universal || x.fitsIds.includes(genId))); // universal = a "Universal by size" rim
  // bumpers replace the car's own bumper: only on cars whose confirmed part map has it
  const shown = fitting.filter(x => !isBumper(x.type) || !!model?.partMap?.[bumperLabel(x.type)]);
  const noPreview = fitting.length > 0 && !shown.length;
  const fits = shown.length > 0;
  const kits: Kit[] = useMemo(() => shown.filter(x => !off[x.part]).map(x => ({ type: x.type, file: x.model!.file, size: x.model!.size, paintMatch: paint && x.type !== "RIMS", finish: x.model!.finish ?? null, adj: NO_ADJUST,
    fit: x.autoFit?.fit, baseAdj: x.autoFit?.adj ?? null })), [shown.map(x => x.part).join(), off, paint, acc]); // eslint-disable-line react-hooks/exhaustive-deps
  const back = () => (router.canGoBack() ? router.back() : router.navigate("/customer/profile"));
  const label = (x: { type: CustomerPart["type"] }) => t(...ACCESSORY_TYPE_LABELS[x.type]);
  const paintable = kits.some(k => k.type !== "RIMS"), rim = shown.find(x => x.type === "RIMS");

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
          <Car3DView model={model} color={car.color ?? DEFAULT_COLOR} kits={kits} onFitError={(m, k) => setFitErrors(e => ({ ...e, [k ?? "?"]: m }))} interactive bg={g.page} style={{ flex: 1, marginTop: 8 }} />
          <GText soft style={[gType.tiny, { textAlign: "center", marginTop: 4 }]}>{t("Drag to turn · pinch to zoom · double-tap to reset", "اسحب للتدوير · قرّب بإصبعين · انقر مرتين للإعادة")}</GText>
          {!model.paintMaterials.length && !model.bakedPaint ? <GText soft style={[gType.caption, { textAlign: "center", marginHorizontal: 20 }]}>{t("This model keeps its original finish; your selected paint is not applied.", "يحتفظ هذا النموذج بلونه الأصلي؛ لا يُطبّق عليه لون الطلاء المحدد.")}</GText> : null}
          <ScrollView style={{ flexGrow: 0, maxHeight: "50%" }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 12, gap: 12 }}>
            {acc && parts.some(x => x.model) && !fitting.length ? <Note tone="warning">{t(`This part doesn't fit your ${carName(car)}`, `هذه القطعة لا تناسب ${carName(car)}`)}</Note> : null}
            {noPreview ? <Note>{t("3D preview not available for this car.", "المعاينة ثلاثية الأبعاد غير متاحة لهذه السيارة.")}</Note> : null}
            {shown.filter(x => !off[x.part] && fitErrors[x.type]).map(x => <Note key={x.part} tone="danger">{`${label(x)}: ${t("it could not be placed cleanly on this car model.", "تعذّر وضعها بدقة على طراز هذه السيارة.")}`}</Note>)}
            {fits ? <>
              <GText style={[gType.label, { fontWeight: "800" }, align]}>{acc?.kit ? t("Body kit", "طقم هيكل") : label(shown[0]!)}</GText>
              <View style={[row, { gap: 8, flexWrap: "wrap" }]}>
                {shown.map(x => <Chip key={x.part} label={shown.length > 1 ? label(x) : off[x.part] ? t("Show on my car", "اعرضها على سيارتي") : t("On my car", "على سيارتي")} on={!off[x.part]} icon={!off[x.part] ? "checkmark" : "add"} onPress={() => setOff(o => ({ ...o, [x.part]: !o[x.part] }))} />)}
                {paintable ? <Chip label={t("Paint to match", "طلاء مطابق")} on={paint} icon={paint ? "checkmark" : "color-fill-outline"} onPress={() => setPaint(!paint)} /> : null}
              </View>
              {shown.length > 1 ? <GText soft style={[gType.tiny, align]}>{t("Switch each bumper on or off: the car's own bumper comes back when it is off.", "شغّل كل مصد أو أوقفه: يعود مصد السيارة الأصلي عند إيقافه.")}</GText> : null}
              {!paint && paintable ? <GText soft style={[gType.tiny, align]}>{t("Original finish as made by the shop's supplier.", "اللون الأصلي كما يصنعه مورد المتجر.")}</GText> : null}
              {rim?.model?.finish ? <GText soft style={[gType.tiny, align]}>{`${t("Finish", "اللون")}: ${t(...RIM_FINISH_LABELS[rim.model.finish])}`}</GText> : null}
              {rim?.universal ? <Note tone="warning">{t("Check PCD/offset with the shop before buying.", "تأكّد من مقاس البراغي (PCD) والإزاحة (Offset) مع المتجر قبل الشراء.")}</Note> : null}
              <GText soft style={[gType.tiny, align]}>{t("3D preview. The real fitment may differ slightly.", "معاينة ثلاثية الأبعاد. قد يختلف التركيب الفعلي قليلًا.")}</GText>
            </> : null}
            <GButton variant="secondary" icon="color-palette-outline" label={t("Edit active car or colour", "تعديل السيارة النشطة أو اللون")} onPress={() => car.id ? openEditGarageCar(car.id) : openMyCarPicker()} />
            <GText soft style={[gType.tiny, { textAlign: "center" }]}>{`${t("3D model", "نموذج ثلاثي الأبعاد")}: ${model.credit.author} (${model.credit.license})`}</GText>
          </ScrollView>
        </>
      )}
    </View>
  );
}
