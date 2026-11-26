// The parts shop's "Show it in 3D" request as a 5-step wizard (front / rear bumper, rear wing, rims):
//   1 What part?  2 Which car?  3 Photos of the part alone (4 guided slots, or "I have a 3D file")  4 Optional details  5 Review & submit.
// The draft is the server's ProductAccessory3D (same endpoints as the full form): it is created when the car is chosen (a bumper cannot be
// saved without one), photos upload as they are added, details save on Next. Reopening starts at the first step that still needs something.
// Other part types and body kits keep the full form (ShopAccessory3DScreen decides).
import * as DocumentPicker from "expo-document-picker";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card, GButton, GIcon, GText, Note, Sheet } from "../../components/garage";
import { StepFooter } from "../../components/manage/Form";
import { ManageHeader, Page } from "../../components/manage/Page";
import { apiUrl } from "../../core/config/api";
import { localFileToBase64 } from "../../core/constants/files";
import { isoLatin, rtl } from "../../core/constants/bidi";
import { normalizeNumberText } from "../../core/constants/numbers";
import { M, useReduced } from "../../motion";
import { photoErrorText, pickPhoto } from "../../core/hooks/pickPhoto";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { gShape, gType, useGarageTheme } from "../../theme/garage";
import { useVehicleList } from "../catalog/VehiclePicker";
import { threeDError } from "../vehicleCatalog/lifecycleText";
import { ACCESSORY_TYPE_LABELS, isBumper, shopAccessoryApi, typesForCategory, type Accessory } from "./api";
import { accessorySupport } from "./support";
import { PART_IMAGES, SLOT_LABELS, SlotArt, WIZARD_TYPES, slotKind, slotPart, type WizardType } from "./wizardArt";
import { PrivateImage } from "./screens";

type T = (en: string, ar: string) => string;
type Gen = { id: string; en: string; ar: string; years: string; photo: string | null; has3d: boolean };
const STEP_OF_FIELD: Record<string, number> = { type: 0, fits: 1, partPhotos: 2, installedPhotos: 3, installedGen: 3, size: 3, consent: 4 };
/** Typical sizes, the starting value when the shop says it knows the size (cm across the car; rims in inches). */
const TYPICAL: Record<WizardType, number> = { FRONT_BUMPER: 175, REAR_BUMPER: 175, WING: 130, RIMS: 17 };
const RIM_SIZES = [14, 15, 16, 17, 18, 19, 20, 21, 22];
const metres = (cm: number, t: T) => { const m = (cm / 100).toFixed(2).replace(/0$/, ""); return t(`about ${m} m wide`, `عرضها نحو ⁦${m}⁩ م`); };
/** Strong ease-out: step content and selection marks enter fast and settle. */
const OUT = Easing.bezier(0.23, 1, 0.32, 1);
/** The selected-card mark: fades in from 70 % (never from 0). */

export function ShopWizard({ productId, onDone }: { productId: string; onDone: () => void }) {
  const { t, isArabic } = useL(); const { g, row, align } = useGarageTheme();
  const state = useLoad(() => shopAccessoryApi.get(productId), [productId]);
  const vehicles = useVehicleList("fitment");
  const a: Accessory | null = state.data?.accessory ?? null;
  const types = WIZARD_TYPES.filter(k => typesForCategory(state.data?.category).includes(k));

  const [step, setStep] = useState(0), [type, setType] = useState<WizardType | null>(null), [fits, setFits] = useState<string[]>([]), [installedGen, setInstalledGen] = useState<string | null>(null);
  const [knowSize, setKnowSize] = useState(false), [sizeText, setSizeText] = useState(""), [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null), [errors, setErrors] = useState<Record<number, string[]>>({}), [sent, setSent] = useState(false);
  const [pick, setPick] = useState<null | { kind: "PART"; slot: number; photoId?: string; replace?: boolean } | { kind: "INSTALLED" }>(null), [search, setSearch] = useState("");
  const [dir, setDir] = useState<1 | -1>(1);
  const insets = useSafeAreaInsets(), reduced = useReduced();
  const scroll = useRef<ScrollView>(null);
  const go = (to: number) => { setDir(to >= step ? 1 : -1); setStep(to); };
  const top = () => (scroll.current as unknown as { scrollTo?: (o: { y: number; animated: boolean }) => void } | null)?.scrollTo?.({ y: 0, animated: true });

  // start from the saved draft (once), at the first step that still needs something
  const hydrated = useRef(false);
  useEffect(() => {
    if (!state.data || hydrated.current) return; hydrated.current = true;
    const t0 = (a?.accessoryType as WizardType | undefined) ?? (types.length === 1 ? types[0]! : null);
    setType(t0); setFits(a?.fitsGenerationIds ?? []); setInstalledGen(a?.installedGenerationId ?? null);
    const main = a ? (a.accessoryType === "RIMS" ? a.size.rimInches : a.size.widthMm) : null;
    if (main != null) { setKnowSize(true); setSizeText(String(a!.accessoryType === "RIMS" ? main : Math.round(main / 10))); }
    if (a) setStep(!a.fitsGenerationIds.length && !(a.accessoryType === "RIMS" && state.data.isUniversal) ? 1 : (a.partPhotos.length >= 2 || a.shopModel) ? 3 : 2);
    else if (t0) setStep(1); // only one part fits this product: it is chosen, start at the car
  }, [state.data]); // eslint-disable-line react-hooks/exhaustive-deps

  // leaving: the draft is saved as it goes, so ← and Android back simply leave (the same on every page)
  const exit = () => (router.canGoBack() ? router.back() : router.navigate("/provider/parts/products" as never));
  const rims = type === "RIMS", bySize = rims && !!state.data?.isUniversal, universalBumper = !!type && isBumper(type) && !!state.data?.isUniversal;
  const gens: Gen[] = useMemo(() => (vehicles.list ?? []).flatMap(v => (v.generations ?? []).map(x => ({ id: x.id, en: `${v.make} ${x.nameEn}`, ar: `${v.makeAr} ${x.nameAr}`, years: `${x.yearFrom}–${x.yearTo}`, photo: x.photoUrl, has3d: !!x.model3dKey }))), [vehicles.list]);
  const shown = (x: Gen) => (isArabic ? isoLatin(x.ar) : x.en);
  const genName = (id: string) => { const x = gens.find(y => y.id === id); return x ? shown(x) : "…"; };
  const support = useLoad(() => (type && isBumper(type) ? accessorySupport(type) : Promise.resolve([])), [type]);
  const cantShow = (id: string) => !!support.data?.some(u => u.generationId === id);
  const load = (id: string) => () => shopAccessoryApi.asset(productId, id);
  const slots = slotKind(type), slotPhoto = (i: number) => a?.partPhotos.find(p => p.slot === i), loose = (a?.partPhotos ?? []).filter(p => p.slot === undefined);
  const partCount = a?.partPhotos.length ?? 0, installed = a?.installedPhotos ?? [];
  const range = type && type !== "RIMS" ? state.data?.sizeRanges?.[type] : undefined;
  const sizeValue = knowSize ? Number(sizeText) : null;

  /** The draft as the server needs it; the fields this wizard does not show (other sizes, rim specs, notes) are kept as saved. */
  const body = () => {
    const s = a?.size, r = a?.rim, gen = installed.length ? (fits.length === 1 ? fits[0]! : installedGen) : installedGen && fits.includes(installedGen) ? installedGen : null;
    return { accessoryType: type, fitsGenerationIds: bySize ? [] : fits, installedGenerationId: bySize ? installedGen : gen, installed360: false, fitmentNotes: a?.fitmentNotes ?? null,
      widthMm: !rims ? (sizeValue ? Math.round(sizeValue * 10) : null) : s?.widthMm ?? null, heightMm: s?.heightMm ?? null, depthMm: s?.depthMm ?? null, lengthMm: s?.lengthMm ?? null,
      rimInches: rims ? sizeValue : null,
      ...(rims ? { rimWidthIn: r?.widthIn ?? null, rimPcd: r?.pcd ?? null, rimOffsetMm: r?.offsetMm ?? null, rimFinish: r?.finish ?? null } : {}) };
  };
  const save = () => shopAccessoryApi.save(productId, body());

  /** What blocks leaving a step (shown on that step). */
  const problems = (i: number): string[] => {
    const out: string[] = [];
    if (i === 0 && !type) out.push(t("Choose the part.", "اختر القطعة."));
    if (i === 1) {
      if (universalBumper) out.push(t("Bumpers are made for specific cars, but this product is marked Universal. Edit the product, untick Universal, then come back.", "المصدات مصنوعة لسيارات محددة، لكن هذا المنتج معلَّم «عام». عدّل المنتج وألغِ «عام» ثم ارجع."));
      else if (!bySize && !fits.length) out.push(t("Choose at least one car this part fits.", "اختر سيارة واحدة على الأقل تناسبها القطعة."));
    }
    if (i === 2 && partCount < 2 && !a?.shopModel) out.push(t(`Add at least 2 photos of the part (you have ${partCount}), or upload your 3D file.`, `أضف صورتين على الأقل للقطعة (لديك ${partCount})، أو ارفع ملفك ثلاثي الأبعاد.`));
    if (i === 3) {
      if (installed.length && !bySize && fits.length > 1 && !installedGen) out.push(t("Tap the car shown in your installed photos.", "اضغط على السيارة الظاهرة في صور التركيب."));
      if (installed.length && bySize && !installedGen) out.push(t("Choose the car shown in your installed photos.", "اختر السيارة الظاهرة في صور التركيب."));
      if (knowSize && type) {
        if (!sizeText.trim() || !(sizeValue! > 0)) out.push(rims ? t("Choose the rim size, or pick \"I don't know\".", "اختر مقاس الجنط، أو اختر «لا أعرف».") : t("Enter the width in centimetres, or pick \"I don't know\".", "أدخل العرض بالسنتيمتر، أو اختر «لا أعرف»."));
        else if (range && (sizeValue! * 10 < range.min || sizeValue! * 10 > range.max)) out.push(t(`That does not look right: a ${t(...ACCESSORY_TYPE_LABELS[type]).toLowerCase()} is usually ${range.min / 1000}–${range.max / 1000} m wide. Measure it from end to end, or pick "I don't know".`,
          `يبدو غير صحيح: عرض ${ACCESSORY_TYPE_LABELS[type][1]} عادةً بين ${range.min / 1000} و${range.max / 1000} م. قِسها من طرف إلى طرف، أو اختر «لا أعرف».`));
      }
    }
    if (i === 4 && !consent) out.push(t("Tick the box to confirm.", "ضع علامة على الخانة للتأكيد."));
    return out;
  };

  const run = async (key: string, fn: () => Promise<unknown>, onErrStep = step) => {
    setBusy(key);
    try { await fn(); await state.reload(); setErrors(e => ({ ...e, [onErrStep]: [] })); return true; }
    catch (e) {
      const issues = (e as { data?: { issues?: { field: string; message: string }[] } }).data?.issues;
      if (issues?.length) { const first = Math.min(...issues.map(i => STEP_OF_FIELD[i.field] ?? 4)); setErrors(issues.reduce<Record<number, string[]>>((m, i) => { const k = STEP_OF_FIELD[i.field] ?? 4; (m[k] = m[k] ?? []).push(i.message); return m; }, {})); go(first); top(); }
      else setErrors(x => ({ ...x, [onErrStep]: [threeDError(e, t)] }));
      return false;
    } finally { setBusy(null); }
  };
  const next = async () => {
    const p = problems(step); if (p.length) { setErrors(e => ({ ...e, [step]: p })); return; }
    if (step === 1 || step === 3) { if (!await run("save", save)) return; } // the draft (created on step 2) and its details
    if (step === 4) { if (await run("submit", async () => { await save(); await shopAccessoryApi.submit(productId); })) setSent(true); return; }
    setErrors(e => ({ ...e, [step]: [] })); go(step + 1); top();
  };
  const first = types.length === 1 ? 1 : 0; // one fitting part: its step is skipped
  const back = () => { if (step <= first) exit(); else { go(step - 1); top(); } };

  const addPhoto = async (from: "camera" | "library") => {
    const target = pick; setPick(null); if (!target) return;
    let b64: string | null = null;
    try { b64 = (await pickPhoto(from))?.base64 ?? null; } catch (e) { setErrors(x => ({ ...x, [step]: [photoErrorText(e, t)] })); return; }
    if (!b64) return;
    await run(target.kind === "PART" ? `slot-${target.slot}` : "installed", () => shopAccessoryApi.photo(productId, target.kind, b64!, "MAIN", target.kind === "PART" ? target.slot : undefined));
  };
  const removePhoto = (id: string) => { setPick(null); void run("remove", () => shopAccessoryApi.removePhoto(productId, id)); };
  const addModelFile = () => void DocumentPicker.getDocumentAsync({ type: ["model/gltf-binary", "application/octet-stream", "*/*"], copyToCacheDirectory: true }).then(async r => {
    if (r.canceled) return; const f = r.assets[0]!;
    if (!f.name.toLowerCase().endsWith(".glb")) return setErrors(x => ({ ...x, [step]: [t("Choose a .glb file (a 3D model in binary glTF).", "اختر ملفًا بامتداد ⁦.glb⁩ (نموذج ثلاثي الأبعاد).")] }));
    if ((f.size ?? 0) > 8 * 1024 * 1024) return setErrors(x => ({ ...x, [step]: [t("That file is larger than 8 MB. Ask for a lighter export (fewer polygons, smaller textures).", "الملف أكبر من ٨ ميغابايت. اطلب نسخة أخف (مضلعات أقل وخامات أصغر).")] }));
    await run("model", async () => shopAccessoryApi.modelFile(productId, await localFileToBase64(f.uri)));
  }).catch(e => setErrors(x => ({ ...x, [step]: [threeDError(e, t)] })));

  const steps = [t("Part", "القطعة"), t("Car", "السيارة"), t("Photos", "الصور"), t("Details", "التفاصيل"), t("Review", "المراجعة")];
  const title = (en: string, ar: string, sub?: string) => <View style={{ gap: 4, marginBottom: 14 }}>
    <GText accessibilityRole="header" style={[gType.display, align]}>{t(en, ar)}</GText>
    {sub ? <GText soft style={[gType.body, align]}>{sub}</GText> : null}
  </View>;
  const errorBox = errors[step]?.length ? <View style={{ marginTop: 12, gap: 6 }}>{errors[step]!.map(m => <Note key={m} tone="danger" icon="alert-circle-outline">{m}</Note>)}</View> : null;

  // ---------------- the steps ----------------
  const stepPart = <>
    {title("What part is it?", "ما القطعة؟", t("Pick the one you sell. Customers will see it on their own car.", "اختر القطعة التي تبيعها. سيراها العملاء على سياراتهم."))}
    {!types.length ? <Note tone="warning">{t("This product's category has no 3D parts. Body, Exterior accessories and Wheels products can be shown in 3D.", "فئة هذا المنتج لا تدعم القطع ثلاثية الأبعاد. منتجات الهيكل والإكسسوارات الخارجية والجنوط فقط.")}</Note> : null}
    <View style={[row, { flexWrap: "wrap", gap: 12 }]}>
      {types.map(k => { const on = type === k, wide = types.length % 2 === 1; return <Pressable key={k} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={t(...ACCESSORY_TYPE_LABELS[k])}
        onPress={() => { if (a && a.accessoryType !== k && fits.length) setInstalledGen(null); setType(k); setErrors(e => ({ ...e, 0: [] })); }}
        style={{ width: wide ? "100%" : "47.5%", padding: 8, paddingBottom: 12, gap: 8, borderRadius: gShape.card, backgroundColor: on ? g.tint : g.card, borderWidth: 2, borderColor: on ? g.accent : g.line }}>
        <Image source={PART_IMAGES[k]} contentFit="contain" style={{ width: "100%", aspectRatio: 3 / 2 }} accessibilityIgnoresInvertColors />
        <View style={[row, { alignItems: "center", justifyContent: "center", gap: 6, minHeight: 24 }]}>
          {on ? <Enter from={0.7} ms={200}><GIcon name="checkmark-circle" size={20} color={g.accent} /></Enter> : null}
          <GText style={[gType.title, { textAlign: "center" }]}>{t(...ACCESSORY_TYPE_LABELS[k])}</GText>
        </View>
      </Pressable>; })}
    </View>
  </>;

  const q = search.trim().toLowerCase();
  const results = q.length >= 2 ? gens.filter(x => !fits.includes(x.id) && (x.en.toLowerCase().includes(q) || x.ar.includes(search.trim()))).slice(0, 12) : gens.filter(x => x.has3d && !fits.includes(x.id)).slice(0, 8);
  const carRow = (x: Gen, chosen: boolean) => {
    const warn = !x.has3d ? t("No 3D model of this car yet: customers can't see parts on it in 3D.", "لا يوجد نموذج ثلاثي الأبعاد لهذه السيارة بعد: لن يرى العملاء القطع عليها.") : cantShow(x.id) ? t(`This car's 3D model can't show a new ${t(...ACCESSORY_TYPE_LABELS[type!]).toLowerCase()} yet. You can still add it; it shows once the car's model is improved.`, `لا يستطيع نموذج هذه السيارة عرض ${ACCESSORY_TYPE_LABELS[type!][1]} جديد بعد. يمكنك إضافتها، وستظهر عند تحسين نموذج السيارة.`) : null;
    return <Pressable key={x.id} accessibilityRole="button" accessibilityLabel={`${shown(x)}${chosen ? `, ${t("chosen, tap to remove", "مختارة، اضغط للإزالة")}` : ""}`}
      onPress={() => { setFits(chosen ? fits.filter(i => i !== x.id) : [...fits, x.id]); if (chosen && installedGen === x.id) setInstalledGen(null); setSearch(""); setErrors(e => ({ ...e, 1: [] })); }}
      style={({ pressed }) => [row, { gap: 12, padding: 10, borderRadius: gShape.small, backgroundColor: chosen ? g.tint : g.card, borderWidth: chosen ? 2 : 1, borderColor: chosen ? g.accent : g.line, alignItems: "center", opacity: pressed ? 0.9 : 1 }]}>
      <View style={{ width: 84, height: 58, borderRadius: 10, overflow: "hidden", backgroundColor: g.cardSoft, alignItems: "center", justifyContent: "center" }}>
        {x.photo ? <Image source={{ uri: apiUrl(x.photo) }} contentFit="cover" style={{ width: "100%", height: "100%" }} accessibilityLabel="" /> : <GIcon name="car-sport-outline" size={28} color={g.soft} />}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <GText numberOfLines={2} style={[gType.label, align, { fontWeight: "800" }]}>{shown(x)}</GText>
        <GText soft style={[gType.caption, align]}>{isArabic ? isoLatin(x.years) : x.years}</GText>
        {warn ? <View style={[row, { gap: 4, alignItems: "flex-start" }]}><GIcon name="alert-circle-outline" size={14} color={g.warning} /><GText style={[gType.tiny, align, { color: g.warning, flex: 1 }]}>{warn}</GText></View> : null}
      </View>
      <GIcon name={chosen ? "close-circle" : "add-circle-outline"} size={26} color={chosen ? g.accent : g.soft} />
    </Pressable>;
  };
  const stepCar = <>
    {title("Which car does it fit?", "ما السيارة المناسبة؟", bySize ? undefined : t("Choose every car generation it fits. Customers with these cars can view it on their car.", "اختر كل أجيال السيارات التي تناسبها. يمكن لأصحاب هذه السيارات رؤيتها على سياراتهم."))}
    {bySize ? <Card><View style={[row, { gap: 12, alignItems: "center" }]}><GIcon name="globe-outline" size={28} color={g.accent} /><View style={{ flex: 1 }}>
      <GText style={[gType.title, align]}>{t("Fits any car", "تناسب أي سيارة")}</GText>
      <GText soft style={[gType.body, align]}>{t("This product is Universal: the rims are fitted on any customer's car by measuring its wheels. Nothing to choose here.", "هذا المنتج «عام»: تُركَّب الجنوط على سيارة أي عميل بقياس عجلاتها. لا يوجد ما تختاره هنا.")}</GText>
    </View></View></Card> : universalBumper ? null : <>
      {fits.length ? <View style={{ gap: 8, marginBottom: 14 }}>
        <GText style={[gType.label, align, { fontWeight: "800" }]}>{t(`Chosen (${fits.length})`, `المختارة (${fits.length})`)}</GText>
        {fits.map(id => { const x = gens.find(y => y.id === id); return x ? carRow(x, true) : null; })}
      </View> : null}
      <View style={[row, { alignItems: "center", gap: 10, minHeight: 52, borderRadius: gShape.small, borderWidth: 1, borderColor: g.line, backgroundColor: g.card, paddingHorizontal: 14 }]}>
        <GIcon name="search-outline" size={20} color={g.soft} />
        <TextInput value={search} onChangeText={setSearch} placeholder={t("Search brand or model, e.g. BMW 3 Series", rtl(isoLatin("ابحث بالعلامة أو الطراز، مثل BMW الفئة 3")))} placeholderTextColor={g.soft} accessibilityLabel={t("Search cars", "ابحث عن سيارة")}
          style={{ flex: 1, color: g.ink, fontSize: 16, minHeight: 48, textAlign: align.textAlign, writingDirection: isArabic ? "rtl" : "ltr" }} />
      </View>
      <GText soft style={[gType.caption, align, { marginTop: 10, marginBottom: 8 }]}>{q.length >= 2 ? (results.length ? t("Tap a car to add it.", "اضغط على سيارة لإضافتها.") : "") : t("Cars with a 3D model (search to see every car):", "سيارات لها نموذج ثلاثي الأبعاد (ابحث لرؤية كل السيارات):")}</GText>
      {!vehicles.list && !vehicles.error ? <ActivityIndicator color={g.accent} /> : null}
      {vehicles.error ? <Note tone="danger">{vehicles.error}</Note> : null}
      {q.length >= 2 && !results.length && vehicles.list ? <View style={{ alignItems: "center", gap: 6, paddingVertical: 18 }}><GIcon name="car-outline" size={32} color={g.soft} /><GText soft style={[gType.body, { textAlign: "center" }]}>{t(`No car matches "${search.trim()}". Try the brand or the model name.`, `لا توجد سيارة تطابق "${search.trim()}". جرّب اسم العلامة أو الطراز.`)}</GText></View> : null}
      <View style={{ gap: 8 }}>{results.map(x => carRow(x, false))}</View>
    </>}
  </>;

  const slotCard = (i: number) => {
    const ph = slotPhoto(i), [en, ar] = SLOT_LABELS[slots][i]!;
    return <Pressable key={i} accessibilityRole="button" accessibilityLabel={`${t(en, ar)}: ${ph ? t("photo added, tap to view", "أُضيفت صورة، اضغط للعرض") : t("add a photo", "أضف صورة")}`} onPress={() => setPick({ kind: "PART", slot: i, photoId: ph?.id })}
      style={({ pressed }) => ({ width: "47.5%", borderRadius: gShape.card, borderWidth: ph ? 2 : 1.5, borderStyle: ph ? "solid" : "dashed", borderColor: ph ? g.success : g.line, backgroundColor: g.card, padding: 10, gap: 8, opacity: pressed ? 0.9 : 1 })}>
      <View style={{ height: 110, borderRadius: 12, overflow: "hidden", backgroundColor: g.cardSoft, alignItems: "center", justifyContent: "center" }}>
        {busy === `slot-${i}` ? <ActivityIndicator color={g.accent} /> : ph ? <PrivateImage load={load(ph.id)} label={ph.id} height={110} /> : <SlotArt part={slotPart(type)} slot={i} size={104} />}
      </View>
      <View style={[row, { alignItems: "center", gap: 6 }]}>
        {ph ? <Enter from={0.7} ms={200}><GIcon name="checkmark-circle" size={18} color={g.success} /></Enter> : <GIcon name="camera-outline" size={18} color={g.accentText} />}
        <GText style={[gType.label, align, { fontWeight: "800", flex: 1 }]}>{t(en, ar)}</GText>
      </View>
    </Pressable>;
  };
  /** A photo thumbnail with a small × badge in its top corner (44 px touch area). */
  const thumb = (id: string, w: number, h: number) => <View key={id} style={{ width: w, height: h }}>
    <PrivateImage load={load(id)} label={id} height={h} />
    <Pressable accessibilityRole="button" accessibilityLabel={t("Remove this photo", "احذف هذه الصورة")} disabled={!!busy} onPress={() => removePhoto(id)} hitSlop={8}
      style={{ position: "absolute", top: -6, [isArabic ? "left" : "right"]: -6, width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: g.ink, borderWidth: 2, borderColor: g.page, alignItems: "center", justifyContent: "center" }}><GIcon name="close" size={15} color={g.page} /></View>
    </Pressable>
  </View>;
  const filled = [0, 1, 2, 3].filter(i => slotPhoto(i)).length + loose.length;
  const stepPhotos = <>
    {title("Photos of the part alone", "صور القطعة وحدها", t("2 photos are enough, 4 give the best 3D model.", "تكفي صورتان، وأربع صور تعطي أفضل نموذج."))}
    <Card soft>
      {[["sunny-outline", t("Plain, light background (a wall or a sheet)", "خلفية فاتحة وسادة (جدار أو قماش)")], ["scan-outline", t("The whole part in the frame, nothing cut off", "القطعة كاملة في الصورة دون قص")], ["hand-left-outline", t("Only the part: no people, no other parts", "القطعة فقط: بلا أشخاص أو قطع أخرى")]].map(([ic, tx]) =>
        <View key={tx} style={[row, { gap: 10, alignItems: "center", paddingVertical: 4 }]}><GIcon name={ic as never} size={20} color={g.accentText} /><GText style={[gType.bodySm, align, { flex: 1 }]}>{tx}</GText></View>)}
    </Card>
    <View style={[row, { alignItems: "center", justifyContent: "space-between", marginTop: 16, marginBottom: 10 }]}>
      <GText style={[gType.label, { fontWeight: "800" }]}>{t(`${filled} of 4 photos`, `${filled} من 4 صور`)}</GText>
      <GText soft style={gType.caption}>{filled >= 4 ? t("Great: all angles", "ممتاز: كل الزوايا") : filled >= 2 ? t(`${4 - filled} more recommended`, `يُنصح بـ${4 - filled} أخرى`) : t(`${2 - filled} more needed`, `تحتاج ${2 - filled} أخرى`)}</GText>
    </View>
    <View style={{ height: 6, borderRadius: 3, backgroundColor: g.line, overflow: "hidden", marginBottom: 14, alignItems: isArabic ? "flex-end" : "flex-start" }}><Bar to={Math.min(4, filled) / 4} color={filled >= 2 ? g.success : g.accent} /></View>
    <View style={[row, { flexWrap: "wrap", gap: 12 }]}>{[0, 1, 2, 3].map(slotCard)}</View>
    {loose.length ? <View style={{ marginTop: 14, gap: 8 }}>
      <GText style={[gType.label, align, { fontWeight: "800" }]}>{t("Earlier photos", "صور سابقة")}</GText>
      <View style={[row, { flexWrap: "wrap", gap: 12, paddingTop: 6 }]}>{loose.map(p => thumb(p.id, 90, 70))}</View>
    </View> : null}
    <View style={[row, { alignItems: "center", gap: 10, marginVertical: 18 }]}><View style={{ flex: 1, height: 1, backgroundColor: g.line }} /><GText soft style={gType.caption}>{t("or", "أو")}</GText><View style={{ flex: 1, height: 1, backgroundColor: g.line }} /></View>
    <Card>
      <View style={[row, { gap: 12, alignItems: "center" }]}>
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: g.tint, alignItems: "center", justifyContent: "center" }}><GIcon name="cube-outline" size={26} color={g.accent} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <GText style={[gType.title, align]}>{t("I have a 3D file", "لدي ملف ثلاثي الأبعاد")}</GText>
          <GText soft style={[gType.caption, align]}>{a?.shopModel ? t("Your .glb file is attached. The MOTEXA team checks it and uses it as the 3D model.", "ملفك ⁦.glb⁩ مرفق. يفحصه فريق موتكسا ويستخدمه كنموذج ثلاثي الأبعاد.") : t("Upload a .glb file (up to 8 MB). Then photos are optional.", "ارفع ملف ⁦.glb⁩ (حتى ٨ ميغابايت). عندها تصبح الصور اختيارية.")}</GText>
        </View>
      </View>
      <View style={[row, { gap: 10, marginTop: 12 }]}>
        <GButton flex variant="secondary" icon={a?.shopModel ? "swap-horizontal-outline" : "cloud-upload-outline"} label={busy === "model" ? t("Uploading…", "جارٍ الرفع…") : a?.shopModel ? t("Replace file", "استبدال الملف") : t("Upload .glb file", "رفع ملف ⁦.glb⁩")} busy={busy === "model"} disabled={!!busy} onPress={addModelFile} />
        {a?.shopModel ? <GButton flex variant="danger" icon="trash-outline" label={t("Remove", "حذف")} disabled={!!busy} onPress={() => removePhoto(a.shopModel!.id)} /> : null}
      </View>
    </Card>
  </>;

  const stepBtn = (icon: "add" | "remove", label: string, by: 1 | -1) => <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => { if (!type) return; setSizeText(String(Math.max(1, Math.min(999, (Number(sizeText) || TYPICAL[type]) + by)))); setErrors(e => ({ ...e, 3: [] })); }}
    style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 1.5, borderColor: g.line, alignItems: "center", justifyContent: "center", backgroundColor: g.card }}><GIcon name={icon} size={26} color={g.ink} /></Pressable>;
  const stepDetails = <>
    {title("A few optional details", "تفاصيل اختيارية", t("Skip anything you don't know: the MOTEXA team fills it in.", "تخطَّ ما لا تعرفه: يكمله فريق موتكسا."))}
    <GText style={[gType.title, align, { marginBottom: 4 }]}>{t("Photos on a car", "صور على سيارة")}<GText soft style={gType.caption}>{`  ${t("optional · up to 3", "اختياري · حتى ٣")}`}</GText></GText>
    <GText soft style={[gType.caption, align, { marginBottom: 10 }]}>{t("If you have photos of the part fitted on a car, they help customers and our team.", "إن كانت لديك صور للقطعة مركّبة على سيارة فهي تساعد العملاء وفريقنا.")}</GText>
    <View style={[row, { flexWrap: "wrap", gap: 12, paddingTop: 6 }]}>
      {installed.map(p => thumb(p.id, 100, 80))}
      {installed.length < 3 ? <Pressable accessibilityRole="button" accessibilityLabel={t("Add a photo on a car", "أضف صورة على سيارة")} onPress={() => setPick({ kind: "INSTALLED" })}
        style={{ width: 100, height: 80, borderRadius: 12, borderWidth: 1.5, borderStyle: "dashed", borderColor: g.line, alignItems: "center", justifyContent: "center", backgroundColor: g.card }}>
        {busy === "installed" ? <ActivityIndicator color={g.accent} /> : <GIcon name="add" size={28} color={g.accentText} />}
      </Pressable> : null}
    </View>
    {installed.length && !bySize && fits.length > 1 ? <View style={{ marginTop: 12, gap: 8 }}>
      <GText style={[gType.label, align, { fontWeight: "800" }]}>{t("Which car is in these photos?", "ما السيارة في هذه الصور؟")}</GText>
      <View style={[row, { flexWrap: "wrap", gap: 8 }]}>{fits.map(id => <Pressable key={id} accessibilityRole="radio" accessibilityState={{ selected: installedGen === id }} onPress={() => setInstalledGen(id)}
        style={{ minHeight: 44, paddingHorizontal: 14, justifyContent: "center", borderRadius: gShape.pill, borderWidth: 1.5, borderColor: installedGen === id ? g.accent : g.line, backgroundColor: installedGen === id ? g.tint : g.card }}>
        <GText style={[gType.label, { fontWeight: "700" }]}>{genName(id)}</GText></Pressable>)}</View>
    </View> : null}
    {installed.length && bySize ? <Note>{t("Rims sold Universal: the MOTEXA team notes the car in the photos.", "جنوط عامة: يسجّل فريق موتكسا السيارة الظاهرة في الصور.")}</Note> : null}

    <View style={{ height: 1, backgroundColor: g.line, marginVertical: 20 }} />
    <GText style={[gType.title, align, { marginBottom: 10 }]}>{rims ? t("Rim size", "مقاس الجنط") : t("Size", "المقاس")}<GText soft style={gType.caption}>{`  ${t("optional", "اختياري")}`}</GText></GText>
    {([[false, t("I don't know", "لا أعرف"), t("The admin will measure it.", "سيقيسها المسؤول.")], [true, t("I know the size", "أعرف المقاس"), rims ? t("Pick the diameter in inches.", "اختر القطر بالإنش.") : t("Width from end to end.", "العرض من طرف إلى طرف.")]] as const).map(([v, l, s]) =>
      <Pressable key={String(v)} accessibilityRole="radio" accessibilityState={{ selected: knowSize === v }} accessibilityLabel={l}
        onPress={() => { setKnowSize(v); if (v && !sizeText && type) setSizeText(String(TYPICAL[type])); setErrors(e => ({ ...e, 3: [] })); }}
        style={[row, { alignItems: "center", gap: 12, minHeight: 60, padding: 12, marginBottom: 8, borderRadius: gShape.small, borderWidth: knowSize === v ? 2 : 1, borderColor: knowSize === v ? g.accent : g.line, backgroundColor: knowSize === v ? g.tint : g.card }]}>
        <GIcon name={knowSize === v ? "radio-button-on" : "radio-button-off"} size={22} color={knowSize === v ? g.accent : g.soft} />
        <View style={{ flex: 1 }}><GText style={[gType.label, align, { fontWeight: "800" }]}>{l}</GText><GText soft style={[gType.caption, align]}>{s}</GText></View>
      </Pressable>)}
    {knowSize && type ? (rims ? <View style={[row, { flexWrap: "wrap", gap: 8, marginTop: 4 }]}>{RIM_SIZES.map(n => <Pressable key={n} accessibilityRole="radio" accessibilityState={{ selected: sizeValue === n }} accessibilityLabel={t(`${n} inch`, `${n} إنش`)} onPress={() => { setSizeText(String(n)); setErrors(e => ({ ...e, 3: [] })); }}
        style={{ minWidth: 56, minHeight: 48, borderRadius: 12, borderWidth: 1.5, borderColor: sizeValue === n ? g.accent : g.line, backgroundColor: sizeValue === n ? g.tint : g.card, alignItems: "center", justifyContent: "center" }}>
        <GText style={[gType.title, { color: sizeValue === n ? g.accentText : g.ink }]}>{`${n}″`}</GText></Pressable>)}</View>
      : <Card soft style={{ marginTop: 4 }}>
        <View style={[row, { alignItems: "center", gap: 12 }]}>
          {stepBtn("remove", t("Narrower", "أضيق"), -1)}
          <View style={{ flex: 1, alignItems: "center", gap: 4 }}>
            <View style={[row, { alignItems: "center", justifyContent: "center", alignSelf: "stretch", minHeight: 60, borderRadius: gShape.small, borderWidth: 1.5, borderColor: g.line, backgroundColor: g.card, paddingHorizontal: 10 }]}>
              <TextInput value={sizeText} onChangeText={v => { setSizeText(normalizeNumberText(v).replace(/[^0-9]/g, "").slice(0, 3)); setErrors(e => ({ ...e, 3: [] })); }} keyboardType="number-pad" maxLength={3} selectTextOnFocus
                accessibilityLabel={t("Width in centimetres", "العرض بالسنتيمتر")} underlineColorAndroid="transparent"
                style={[{ fontSize: 30, fontWeight: "800", color: g.ink, width: 72, textAlign: "center", writingDirection: "ltr", padding: 0, borderWidth: 0 }, Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null]} />
              <GText style={[gType.title, { color: g.soft }]}>{t("cm", "سم")}</GText>
            </View>
            {sizeValue ? <GText soft style={[gType.caption, { textAlign: "center" }]}>{metres(sizeValue, t)}</GText> : null}
          </View>
          {stepBtn("add", t("Wider", "أعرض"), 1)}
        </View>
        <GText soft style={[gType.caption, { textAlign: "center", marginTop: 10 }]}>{t(`Started from a typical ${t(...ACCESSORY_TYPE_LABELS[type]).toLowerCase()}. Measure from one end to the other.`, `بدأنا من مقاس ${ACCESSORY_TYPE_LABELS[type][1]} المعتاد. قِس من طرف إلى الطرف الآخر.`)}</GText>
      </Card>) : null}
  </>;

  const editLink = (to: number) => <Pressable accessibilityRole="button" accessibilityLabel={`${t("Edit", "تعديل")} ${steps[to]}`} onPress={() => { go(to); top(); }} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 6 }}>
    <GText style={[gType.label, { color: g.accentText, fontWeight: "800" }]}>{t("Edit", "تعديل")}</GText></Pressable>;
  const reviewRow = (to: number, icon: string, label: string, children: React.ReactNode) => <View style={{ paddingVertical: 12, borderTopWidth: to ? 1 : 0, borderTopColor: g.line, gap: 8 }}>
    <View style={[row, { alignItems: "center", gap: 10 }]}><GIcon name={icon as never} size={20} color={g.accentText} /><GText soft style={[gType.caption, align, { flex: 1, fontWeight: "700" }]}>{label}</GText>{to >= first ? editLink(to) : null}</View>
    {children}
  </View>;
  const consentText = t("I own these photos and files. MOTEXA may create a 3D model of this part and show it, with my photos, to customers.", "أملك هذه الصور والملفات. يجوز لموتكسا إنشاء نموذج ثلاثي الأبعاد لهذه القطعة وعرضه مع صوري للعملاء.");
  const stepReview = <>
    {title("Check and send", "راجع وأرسل", t("The MOTEXA team reviews your request, then creates the 3D model.", "يراجع فريق موتكسا طلبك ثم ينشئ النموذج ثلاثي الأبعاد."))}
    <Card>
      {reviewRow(0, "cube-outline", t("Part", "القطعة"), type ? <View style={[row, { alignItems: "center", gap: 12 }]}><Image source={PART_IMAGES[type]} contentFit="contain" style={{ width: 96, aspectRatio: 3 / 2 }} accessibilityIgnoresInvertColors /><GText style={[gType.title, align, { flex: 1 }]}>{t(...ACCESSORY_TYPE_LABELS[type])}</GText></View> : null)}
      {reviewRow(1, "car-sport-outline", t("Fits", "تناسب"), bySize ? <GText style={[gType.body, align]}>{t("Any car (Universal)", "أي سيارة (عامة)")}</GText> : <View style={{ gap: 4 }}>{fits.map(id => <GText key={id} style={[gType.body, align]}>{`• ${genName(id)}`}{cantShow(id) ? <GText style={[gType.caption, { color: g.warning }]}>{`  ${t("(3D not possible yet)", "(العرض غير ممكن بعد)")}`}</GText> : null}</GText>)}</View>)}
      {reviewRow(2, "images-outline", t("Photos of the part", "صور القطعة"), <View style={{ gap: 8 }}>
        <View style={[row, { flexWrap: "wrap", gap: 8 }]}>{(a?.partPhotos ?? []).map(p => <View key={p.id} style={{ width: 72, gap: 2 }}><PrivateImage load={load(p.id)} label={p.id} height={60} />{p.slot !== undefined ? <GText soft numberOfLines={1} style={[gType.tiny, { textAlign: "center" }]}>{t(...SLOT_LABELS[slots][p.slot]!)}</GText> : null}</View>)}</View>
        {a?.shopModel ? <View style={[row, { gap: 6, alignItems: "center" }]}><GIcon name="cube" size={16} color={g.success} /><GText style={[gType.bodySm, align]}>{t("Your 3D file (.glb) is attached", "ملفك ثلاثي الأبعاد (⁦.glb⁩) مرفق")}</GText></View> : null}
        {!partCount && !a?.shopModel ? <GText style={[gType.bodySm, { color: g.danger }]}>{t("No photos yet", "لا توجد صور بعد")}</GText> : null}
      </View>)}
      {reviewRow(3, "options-outline", t("Details", "التفاصيل"), <View style={{ gap: 4 }}>
        <GText style={[gType.body, align]}>{installed.length ? t(`${installed.length} photo(s) on a car`, `${installed.length} صورة على سيارة`) : t("No photos on a car (optional)", "لا صور على سيارة (اختياري)")}</GText>
        <GText style={[gType.body, align]}>{knowSize && sizeValue ? (rims ? t(`${sizeValue}-inch rims`, `جنوط ${sizeValue} إنش`) : `${sizeValue} ${t("cm", "سم")} · ${metres(sizeValue, t)}`) : t("Size: the admin will measure it", "المقاس: سيقيسه المسؤول")}</GText>
      </View>)}
    </Card>
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: consent }} onPress={() => { setConsent(v => !v); setErrors(e => ({ ...e, 4: [] })); }}
      style={[row, { marginTop: 14, minHeight: 64, padding: 16, gap: 14, alignItems: "center", borderRadius: gShape.card, borderWidth: 2, borderColor: consent ? g.accent : g.line, backgroundColor: consent ? g.tint : g.card }]}>
      <View style={{ width: 28, height: 28, borderRadius: 8, borderWidth: 2, borderColor: consent ? g.accent : g.soft, backgroundColor: consent ? g.accent : "transparent", alignItems: "center", justifyContent: "center" }}>
        {consent ? <Enter from={0.7} ms={200}><GIcon name="checkmark" size={20} color={g.onAccent} /></Enter> : null}
      </View>
      <GText style={[gType.bodySm, align, { flex: 1, minWidth: 0 }]}>{consentText}</GText>
    </Pressable>
  </>;

  const sentView = <View style={{ alignItems: "center", gap: 14, paddingVertical: 40 }}>
    <Enter from={0.85} ms={420} settle style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: g.tint, alignItems: "center", justifyContent: "center" }}><GIcon name="checkmark-circle" size={64} color={g.success} /></Enter>
    <Enter ms={270}><GText accessibilityRole="header" style={[gType.display, { textAlign: "center" }]}>{t("Sent for review", "أُرسل للمراجعة")}</GText></Enter>
    <Enter ms={270}><GText soft style={[gType.body, { textAlign: "center", maxWidth: 320 }]}>{t("The MOTEXA team checks your photos and creates the 3D model. We'll notify you when customers can see it on their cars.", "يفحص فريق موتكسا صورك وينشئ النموذج ثلاثي الأبعاد. سنُعلمك عندما يستطيع العملاء رؤيته على سياراتهم.")}</GText></Enter>
    <Enter ms={270} style={{ alignSelf: "stretch", gap: 10, marginTop: 10 }}>
      <GButton icon="eye-outline" label={t("See the request status", "عرض حالة الطلب")} onPress={onDone} />
      <GButton variant="secondary" label={t("Back to my products", "العودة إلى منتجاتي")} onPress={() => router.navigate("/provider/parts/products" as never)} />
    </Enter>
  </View>;

  const busyLabel = busy === "submit" ? t("Sending…", "جارٍ الإرسال…") : busy === "save" ? t("Saving…", "جارٍ الحفظ…") : null;
  const needConsent = step === 4 && !consent;
  const note = busyLabel ?? (step === 2 && filled < 2 && !a?.shopModel ? t("Add 2 photos to continue", "أضف صورتين للمتابعة") : needConsent ? t("Tick the box above to send your request.", "ضع علامة على الخانة أعلاه لإرسال طلبك.") : undefined);
  const bar = sent || !state.data ? undefined : <View style={{ gap: 8 }}>
    {note ? <GText soft style={[gType.caption, align]}>{note}</GText> : null}
    <StepFooter back={step > first ? { label: t("Back", "رجوع"), onPress: back } : undefined}
      primary={{ icon: step === 4 ? "paper-plane-outline" : undefined, label: step === 4 ? t("Submit", "إرسال") : t("Next", "التالي"), busy: busy === "save" || busy === "submit", disabled: !!busy || needConsent, onPress: () => void next() }} />
  </View>;

  // a focused step flow on the common frame: ← back + trail, then the step, its progress and the product
  const n = steps.length - first, at = step - first;
  const header = <View style={{ gap: 10, marginBottom: 14 }}>
    <ManageHeader title={sent ? t("Show it in 3D", "اعرضها ثلاثية الأبعاد") : t(`Step ${at + 1} of ${n} · ${steps[step]}`, `الخطوة ${at + 1} من ${n} · ${steps[step]}`)} line={state.data?.productName ?? undefined} />
    {sent || !state.data ? null : <View style={[row, { gap: 6 }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: n }, (_, i) => <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: g.line, overflow: "hidden" }}><Bar to={i <= at ? 1 : 0} color={g.accent} /></View>)}
    </View>}
  </View>;
  const dx = (isArabic ? -1 : 1) * dir * 16;
  const viewing = pick?.kind === "PART" && pick.photoId && !pick.replace ? pick : null;

  return <Page title={t("Show it in 3D", "اعرضها ثلاثية الأبعاد")} list footer={bar}>
    <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: insets.bottom + 40 }}>
      {header}
      {state.error && !state.data ? <Note tone="danger">{state.error}</Note> : null}
      {!state.data ? <ActivityIndicator color={g.accent} style={{ marginTop: 40 }} /> : sent ? sentView : <>
        {a ? <View style={[row, { alignItems: "center", gap: 6, marginBottom: 12 }]}><GIcon name="cloud-done-outline" size={16} color={g.success} /><GText soft style={gType.caption}>{t("Draft saved automatically", "تُحفظ المسودة تلقائيًا")}</GText></View> : null}
        <Enter key={step} dx={dx} ms={240}>
          {[stepPart, stepCar, stepPhotos, stepDetails, stepReview][step]}
          {errorBox}
        </Enter>
        <View style={{ height: 160 }} />
      </>}
    </ScrollView>
    <Sheet visible={!!pick} onClose={() => setPick(null)} title={pick?.kind === "PART" ? t(...SLOT_LABELS[slots][pick.slot]!) : t("Photo on a car", "صورة على سيارة")} closeLabel={t("Close", "إغلاق")}>
      {viewing ? <View style={{ gap: 10 }}>
        <PrivateImage load={load(viewing.photoId!)} label={viewing.photoId!} height={280} />
        <View style={[row, { gap: 10, marginTop: 6 }]}>
          <GButton flex variant="secondary" icon="swap-horizontal-outline" label={t("Replace", "استبدال")} onPress={() => setPick({ ...viewing, replace: true })} />
          <GButton flex variant="danger" icon="trash-outline" label={t("Remove", "حذف")} onPress={() => removePhoto(viewing.photoId!)} />
        </View>
      </View> : <View style={{ gap: 10 }}>
        {pick?.kind === "PART" ? <View style={{ alignItems: "center", paddingBottom: 6 }}><SlotArt part={slotPart(type)} slot={pick.slot} size={150} /></View> : null}
        <GButton icon="camera-outline" label={t("Take a photo", "التقط صورة")} onPress={() => void addPhoto("camera")} />
        <GButton variant="secondary" icon="images-outline" label={t("Choose from gallery", "اختر من المعرض")} onPress={() => void addPhoto("library")} />
      </View>}
    </Sheet>
  </Page>;
}

/** A progress fill that slides to its new value (220 ms ease-out; instant with reduced motion). */
function Bar({ to, color }: { to: number; color: string }) {
  const reduced = useReduced();
  const st = useAnimatedStyle(() => ({ width: reduced ? `${to * 100}%` : withTiming(`${to * 100}%`, { duration: 220, easing: OUT }) }), [to, reduced]);
  return <Animated.View style={[{ height: 6, backgroundColor: color }, st]} />;
}

/** Mount-in motion that runs the same on Android and web: fade + slide `dx` px and / or scale from `from`, ease-out (`settle` = a soft
 *  overshoot, used once on the success mark). Reduced motion: a short fade only. */
function Enter({ children, dx = 0, from = 1, ms, settle, style }: { children: React.ReactNode; dx?: number; from?: number; ms: number; settle?: boolean; style?: object }) {
  const reduced = useReduced(), p = useSharedValue(0);
  useEffect(() => { p.value = withTiming(1, { duration: reduced ? M.reduced : ms, easing: settle && !reduced ? Easing.bezier(0.34, 1.4, 0.64, 1) : OUT }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const st = useAnimatedStyle(() => ({ opacity: Math.min(1, p.value * 1.6), transform: reduced ? [] : [{ translateX: (1 - p.value) * dx }, { scale: from + (1 - from) * p.value }] }));
  return <Animated.View style={[style, st]}>{children}</Animated.View>;
}
