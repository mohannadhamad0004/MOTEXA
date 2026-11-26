// The shop owner's 3D preview = Detail with the viewer as its body: the accessory alone or on one of its cars, colour, paint-to-match
// and each piece on / off. Private models load through the owner's authenticated, memory-only loader.
import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { Chip, GText, Note, Rail, Toggle } from "../../components/garage";
import { Block, Loaded, Page } from "../../components/manage/Page";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { gShape, gType, useGarageTheme } from "../../theme/garage";
import { portalApi } from "../provider/portal/api";
import type { Provider3dProduct } from "../provider/portal/types";
import { Car3DView } from "../car3d/Car3DView";
import { useCatalogModelKey } from "../car3d/runtimeModels";
import type { CarModel } from "../car3d/models";
import type { Kit } from "../car3d/useCar3D";
import { CAR_COLORS, DEFAULT_COLOR, NO_ADJUST } from "../car3d/car3d";
import { ACCESSORY_TYPE_LABELS, shopAccessoryApi, bumperLabel, isBumper } from "./api";
import { fitLabel, replacementLabel } from "./fitPresentation";

function Preview({ product: p }: { product: Provider3dProduct }) {
  const { t, isArabic } = useL();
  const { g, align } = useGarageTheme();
  const [selected, setSelected] = useState(p.parts.find((x) => x.hasModel)?.part ?? "MAIN"), [genId, setGenId] = useState(""), [off, setOff] = useState<string[]>([]),
    [paint, setPaint] = useState(false), [color, setColor] = useState(DEFAULT_COLOR), [error, setError] = useState<string | null>(null);
  const selectedPart = p.parts.find((x) => x.part === selected), gens = [...new Map(p.parts.flatMap((x) => x.generations).map((gn) => [gn.id, gn])).values()], car = useCatalogModelKey(gens.find((gn) => gn.id === genId)?.model3dKey);
  const standalone = useMemo<CarModel>(() => ({ key: `provider-${selectedPart?.id ?? "none"}`, generation: p.name, lengthM: 1.4, rotateY: 0, groundOffset: 0, paintNodes: [], paintMaterials: [], rimsSwappable: false, wing: { x: 0, y: 0, z: 0, scale: 1 }, rack: { x: 0, y: 0, z: 0, scale: 1 }, credit: { title: p.name, author: "", url: "", license: "" } }), [p.name, selectedPart?.id]);
  const kits = useMemo<Kit[]>(() => p.parts.filter((a) => a.hasModel && !off.includes(a.part) && a.generations.some((gn) => gn.id === genId && gn.fitState !== "FAILED") && (!isBumper(a.type) || !!car?.partMap?.[bumperLabel(a.type)]))
    .map((a) => { const f = a.generations.find((gn) => gn.id === genId); return { type: a.type, file: `provider-${a.id}.glb`, assetLoader: () => shopAccessoryApi.asset(p.id, "model", a.part), paintMatch: paint, adj: NO_ADJUST, fit: f?.autoFit?.fit, baseAdj: f?.autoFit?.adj, size: {} }; }), [p, off, genId, car, paint]);
  const box = { height: 360, borderRadius: gShape.card };
  if (!p.parts.some((x) => x.hasModel)) return <Note icon="cube-outline">{t("No model available yet. Submit your photos for Parts Admin review.", "لا يوجد نموذج متاح بعد. أرسل صورك لمراجعة إدارة القطع.")}</Note>;
  return (
    <>
      <View style={{ gap: 8 }}>
        <GText style={[gType.label, align, { fontWeight: "700" }]}>{t("Show", "العرض")}</GText>
        <Rail gap={8}>
          <Chip label={t("The accessory alone", "القطعة منفردة")} on={!genId} onPress={() => { setGenId(""); setError(null); }} />
          {gens.map((gn) => <Chip key={gn.id} icon="car-sport-outline" label={isArabic ? gn.nameAr : gn.name} on={genId === gn.id} onPress={() => { if (gn.has3d) { setGenId(gn.id); setOff([]); setError(null); } }} />)}
        </Rail>
      </View>
      {!genId ? (
        <>
          {p.parts.filter((a) => a.hasModel).length > 1 ? <Rail gap={8}>{p.parts.filter((a) => a.hasModel).map((a) => <Chip key={a.part} label={t(...ACCESSORY_TYPE_LABELS[a.type])} on={selected === a.part} onPress={() => setSelected(a.part)} />)}</Rail> : null}
          {selectedPart?.hasModel ? <Car3DView key={selectedPart.id} model={standalone} assetLoader={() => shopAccessoryApi.asset(p.id, "model", selectedPart.part)} color={color} bg={g.card} interactive style={box} /> : null}
        </>
      ) : car ? (
        <>
          <Car3DView key={genId} model={car} kits={kits} color={color} bg={g.card} interactive onFitError={() => setError(t("The accessory could not be placed cleanly on this car.", "تعذّر تركيب القطعة بدقة على هذه السيارة."))} style={box} />
          {!kits.length ? <Note tone="warning">{t("No enabled part can currently be previewed on this car. Bumpers require the confirmed stock-part map.", "لا توجد قطعة مفعّلة قابلة للمعاينة على هذه السيارة. تتطلب المصدات خريطة قطع أصلية مؤكدة.")}</Note> : null}
          {p.parts.filter((a) => a.generations.some((gn) => gn.id === genId)).map((a) => {
            const f = a.generations.find((gn) => gn.id === genId)!;
            return (
              <Block key={a.id} title={t(...ACCESSORY_TYPE_LABELS[a.type])}>
                <View style={{ paddingVertical: 8, gap: 4 }}>
                  <GText soft style={[gType.caption, align]}>{`${fitLabel(f.fitState, t)} · ${t("Replaces: ", "يستبدل: ")}${replacementLabel(f.replacement, t)}`}</GText>
                  <Toggle label={t("Show this piece", "إظهار هذه القطعة")} value={!off.includes(a.part)} onChange={() => setOff((v) => (v.includes(a.part) ? v.filter((x) => x !== a.part) : [...v, a.part]))} />
                </View>
              </Block>
            );
          })}
          <Toggle label={t("Paint to match the car", "مطابقة لون السيارة")} value={paint} onChange={setPaint} />
        </>
      ) : <GText soft style={[gType.caption, align]}>{t("Loading the active vehicle model…", "جارٍ تحميل نموذج السيارة النشط…")}</GText>}
      <Rail gap={8}>{CAR_COLORS.map((c) => <Chip key={c.hex} label={t(c.en, c.ar)} on={color === c.hex} onPress={() => setColor(c.hex)} />)}</Rail>
      {error ? <Note tone="danger" icon="alert-circle-outline">{error}</Note> : null}
      <GText soft style={[gType.caption, align]}>{t("Owner preview. Unpublished models are private. Fit approval and final publication remain with Parts Admin. Real fit may differ from the 3D preview.", "معاينة المالك. النماذج غير المنشورة خاصة. يبقى اعتماد التركيب والنشر النهائي لدى إدارة القطع. قد يختلف التركيب الفعلي عن المعاينة.")}</GText>
    </>
  );
}

export default function ProviderPreview() {
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const { t } = useL();
  const state = useLoad(() => portalApi.product3d(productId), [productId]);
  return (
    <Page title={state.data?.name ?? t("3D preview", "معاينة ثلاثية الأبعاد")} line={t("How customers will see it", "كما سيراها العملاء")}>
      <Loaded state={state}>{(p) => <Preview key={p.id} product={p} />}</Loaded>
    </Page>
  );
}
