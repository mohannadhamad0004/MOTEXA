// Feature 2 on the customer's product page: "View on my car" (published part + a 3D model of the customer's fitting generation),
// "This part doesn't fit your <car>", and the always-visible "Installed look" gallery (drag-to-spin when the shop gave a 360° set).
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Image, PanResponder, ScrollView, View } from "react-native";
import { Badge, GButton, GText, Note, Section } from "../../components/garage";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import type { Car } from "../catalog/myCar";
import { gType, useGarageTheme } from "../../theme/garage";
import { customerAccessoryApi, RIM_FINISH_LABELS, type CustomerPart, type RimSpecs } from "./api";
import {threeDReason} from "../vehicleCatalog/lifecycleText";
import {selectPreviewCar} from "./eligibility";

/** All photos as data URIs (authenticated, memory only); null while loading. */
function usePhotos(ids: string[]) {
  const [uris, setUris] = useState<(string | null)[]>(() => ids.map(() => null));
  const [failed, setFailed] = useState(false), [tick, setTick] = useState(0);
  const key = ids.join(",");
  useEffect(() => {
    let live = true; setUris(ids.map(() => null)); setFailed(false);
    ids.forEach((id, i) => void customerAccessoryApi.photo(id).then(b => live && setUris(u => u.map((x, j) => j === i ? `data:image/jpeg;base64,${b}` : x)), () => { if (live) setFailed(true); }));
    return () => { live = false; };
  }, [key, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  return { uris, failed, retry: () => setTick(n => n + 1) };
}
/** Drag sideways to walk around the car: the photos are in order around it, one full drag across the width = one turn. */
function Spin({ uris, label }: { uris: (string | null)[]; label: string }) {
  const { g } = useGarageTheme(); const { t, isArabic } = useL();
  const [i, setI] = useState(0), start = useRef(0), width = useRef(320), at = useRef(0);
  at.current = i;
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true, onMoveShouldSetPanResponder: (_e, s) => Math.abs(s.dx) > 4,
    onPanResponderGrant: () => { start.current = at.current; },
    onPanResponderMove: (_e, s) => { const n = uris.length, step = Math.round((s.dx * (isArabic ? -1 : 1)) / (width.current / n)); setI(((start.current - step) % n + n) % n); },
  })).current;
  const uri = uris[i];
  return <View onLayout={e => { width.current = e.nativeEvent.layout.width; }} {...pan.panHandlers}
    accessible accessibilityRole="adjustable" accessibilityLabel={`${label}, ${t("photo", "صورة")} ${i + 1} / ${uris.length}`}
    accessibilityActions={[{ name: "increment" }, { name: "decrement" }]} onAccessibilityAction={e => setI(v => (v + (e.nativeEvent.actionName === "increment" ? 1 : -1) + uris.length) % uris.length)}
    style={{ height: 240, borderRadius: 16, overflow: "hidden", backgroundColor: g.cardSoft, alignItems: "center", justifyContent: "center" }}>
    {uri ? <Image source={{ uri }} resizeMode="cover" style={{ width: "100%", height: "100%" }} /> : <GText soft>{t("Loading…", "جارٍ التحميل…")}</GText>}
    <View style={{ position: "absolute", bottom: 8, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: g.card }}>
      <GText style={gType.tiny}>{`↔ ${t("Drag to turn", "اسحب للتدوير")} · ${i + 1}/${uris.length}`}</GText>
    </View>
  </View>;
}

export function ProductAccessory3D({ productId, car, onPreview }: { productId: string; car: Car | null; onPreview?:()=>void }) {
  const { t, isArabic } = useL(); const { g, row, align } = useGarageTheme();
  const state = useLoad(() => customerAccessoryApi.get(productId,car?.generation?.id), [productId,car?.generation?.id],6000);
  const choices=useLoad(()=>onPreview?Promise.resolve([]):customerAccessoryApi.garage(productId),[productId,!!onPreview],6000);
  const [selected,setSelected]=useState<string|null>(null);
  const chosen=selectPreviewCar(choices.data??[],selected);
  const a = state.data;
  const installed = a?.installed ?? null;
  const { uris, failed: photosFailed, retry: retryPhotos } = usePhotos(installed?.photoIds ?? []);
  if (!a) return state.error ? <View style={{ gap: 10, marginTop: 12 }}>
    <Note tone="danger">{t("Couldn't check 3D availability.", "تعذّر التحقق من توفر النموذج ثلاثي الأبعاد.")}</Note>
    <GButton variant="secondary" label={t("Retry", "إعادة المحاولة")} onPress={() => void state.reload()} />
  </View> : null;
  const genId = car?.generation?.id ?? null;
  // a "Universal by size" rim fits any car (its wheels are measured in 3D); everything else fits its chosen generations
  const parts: CustomerPart[] = a.parts ?? [{ part: "MAIN", type: a.type, fitsIds: a.fits.map(f => f.id), universal: a.universal, model: a.model, autoFit: null }];
  // bumpers / body kits replace the car's own bumper: only where its confirmed part map has that bumper
  const viewable = chosen?.allowed===true;
  const onYourCar = !!installed?.generation && installed.generation.id === genId;
  const badge = installed?.generation ? (onYourCar ? t("Shown on your car model", "معروضة على طراز سيارتك") : `${t("Shown on", "معروضة على")} ${isArabic ? installed.generation.nameAr : installed.generation.nameEn}`) : null;
  return <>
    {onPreview && parts.some(x=>x.model) ? <GButton label={t("Preview published 3D", "معاينة النموذج المنشور")} onPress={onPreview}/> : null}
    {parts.length > 1 ? <View style={[row, { marginTop: 12 }]}><Badge label={`3D · ${t("Front + rear", "أمامي + خلفي")}`} tone="neutral" /></View> : null}
    {!onPreview?<View style={{gap:10,marginTop:12}}>
      {choices.data&&choices.data.length>1?choices.data.filter(c=>c.allowed).map(c=><GButton key={c.carId} variant="secondary" label={`${chosen?.carId===c.carId?"✓ ":""}${c.make} ${c.model} ${c.year}`} onPress={()=>setSelected(c.carId)}/>):null}
      {viewable&&parts.some(x=>x.model)?<GButton icon="cube-outline" label={t("View on my car","اعرضها على سيارتي")} onPress={()=>router.push({pathname:"/customer/car3d",params:{product:productId,carId:chosen!.carId}})}/>:<>
        <Note>{threeDReason(!parts.some(x=>x.model)?"NO_ACCESSORY_3D":chosen?.reason??"NO_COMPATIBLE_GARAGE_CAR",t)}</Note>
        {chosen?.reason==="NO_VEHICLE_3D"?<GButton variant="secondary" label={t("Request my car in 3D","طلب سيارتي ثلاثية الأبعاد")} onPress={()=>router.push({pathname:"/customer/vehicle-requests/[id]",params:{id:"new",garageCarId:chosen.carId}} as never)}/>:!chosen?<GButton variant="secondary" label={t("Open Garage","فتح الكراج")} onPress={()=>router.push("/customer/garage" as never)}/>:null}
      </>}
      {choices.error?<Note tone="danger">{t("Could not check your Garage. Refresh to retry.","تعذّر فحص كراجك. حدّث لإعادة المحاولة.")}</Note>:null}
    </View>:null}
    {a.rim ? <RimSpecsCard rim={a.rim} universal={!!a.universal} /> : null}
    {installed && installed.photoIds.length ? <Section title={t("Installed look", "شكلها بعد التركيب")}>
      {badge ? <View style={[row, { marginBottom: 8 }]}><Badge label={badge} tone={onYourCar ? "success" : "neutral"} /></View> : null}
      {installed.spin && uris.length >= 12 ? <Spin uris={uris} label={t("Installed look, 360°", "شكلها بعد التركيب ٣٦٠°")} />
        : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {uris.map((u, i) => <View key={i} style={{ width: 260, height: 180, borderRadius: 16, overflow: "hidden", backgroundColor: g.cardSoft, alignItems: "center", justifyContent: "center" }}>
            {u ? <Image accessibilityLabel={`${t("Installed look", "شكلها بعد التركيب")} ${i + 1}`} source={{ uri: u }} resizeMode="cover" style={{ width: "100%", height: "100%" }} /> : <GText soft style={gType.tiny}>{t("Loading…", "جارٍ التحميل…")}</GText>}
          </View>)}
        </ScrollView>}
      {photosFailed && uris.some(u => !u) ? <View style={{ gap: 8, marginTop: 8 }}>
        <Note tone="danger">{t("Couldn't load the installed-look photos.", "تعذّر تحميل صور شكلها بعد التركيب.")}</Note>
        <GButton variant="secondary" label={t("Retry", "إعادة المحاولة")} onPress={retryPhotos} />
      </View> : null}
      <GText soft style={[gType.tiny, align, { marginTop: 6 }]}>{t("Photos from the shop, checked by MOTEXA.", "صور من المتجر، راجعتها موتكسا.")}</GText>
    </Section> : null}
  </>;
}

/** A rim's specs (only what the shop filled in) and, for "Universal by size", the PCD / offset reminder. */
function RimSpecsCard({ rim, universal }: { rim: RimSpecs; universal: boolean }) {
  const { t } = useL(); const { row, align } = useGarageTheme();
  const lines: [string, string][] = [
    [t("Diameter", "القطر"), rim.inches != null ? `${rim.inches}″` : ""],
    [t("Width", "العرض"), rim.widthIn != null ? `${rim.widthIn}J` : ""],
    [t("Bolt pattern (PCD)", "توزيع البراغي (PCD)"), rim.pcd ?? ""],
    [t("Offset", "الإزاحة"), rim.offsetMm != null ? `ET${rim.offsetMm}` : ""],
    [t("Finish", "اللون"), rim.finish ? t(...RIM_FINISH_LABELS[rim.finish]) : ""],
  ];
  const shown = lines.filter(([, v]) => v);
  return <Section title={t("Rim specs", "مواصفات الجنط")}>
    {universal ? <View style={[row, { marginBottom: 8 }]}><Badge label={t("Universal by size", "عام حسب المقاس")} tone="neutral" /></View> : null}
    {shown.map(([k, v]) => <View key={k} style={[row, { justifyContent: "space-between", gap: 12, paddingVertical: 4 }]}>
      <GText soft style={[gType.caption, align]}>{k}</GText><GText style={[gType.caption, { fontWeight: "700" }]}>{v}</GText>
    </View>)}
    {universal ? <View style={{ marginTop: 8 }}><Note icon="alert-circle-outline" tone="warning">{t("Check PCD/offset with the shop before buying.", "تأكّد من مقاس البراغي (PCD) والإزاحة (Offset) مع المتجر قبل الشراء.")}</Note></View> : null}
  </Section>;
}
