import { ProviderLayout } from "../../components/layout/ProviderLayout";
// Feature 2 screens: the shop's "Submit for 3D" form, the Parts Admin review (/dept/accessory3d) and the zone editor
// (/dept/accessory-zones). Photos, generated models and previews are private: loaded with the session token into memory only.
import { type Href, router, useLocalSearchParams } from "expo-router";
import { photoErrorText, pickPhoto } from "../../core/hooks/pickPhoto";
import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, ScrollView, TextInput, View } from "react-native";
import { Card, Chip, GarageHero, GaragePage, GButton, GText, Note, Section, StatusChip } from "../../components/garage";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { useVehicleList } from "../catalog/VehiclePicker";
import { gType, useGarageTheme } from "../../theme/garage";
import { PART_LABELS, type AccessoryType, type AccessoryZone, type PartLabel, type PartMap } from "../car3d/modelConfig";
import { Car3DView } from "../car3d/Car3DView";
import { refreshRuntimeModels, useCatalogModelKey } from "../car3d/runtimeModels";
import { normalizeNumberText } from "../../core/constants/numbers";
import { ACCESSORY_TYPE_LABELS, KIT_PART_TYPE, PREVIEW_VIEWS, REPLACES_STOCK, STATUS_LABELS, adminAccessoryApi, isBumper, shopAccessoryApi, sizeField, typesForCategory, type KitPart,
  type Accessory, type AccessoryStatus, type AutoFitRow, type PartMapDetail, type Preview, type ZoneBox, RIM_FINISHES, RIM_FINISH_LABELS, type RimFinish } from "./api";
import { NO_ADJUST, type FitAdjust } from "../car3d/car3d";
import { GateSummary } from "./gate";
import { DeptPage, Section as DeptSection, useDT } from "../department/ui";
import { ThreeDRequests, useThreeDCount } from "../department/ThreeDRequests";
import {threeDError} from "../vehicleCatalog/lifecycleText";
import {accessoryProcessingLabel} from "./processing";
import {AccessoryFinalReview} from "./FinalReview";
import { SupportWarning } from "./support";

const tone = (s: AccessoryStatus) => s === "PUBLISHED" ? "success" : s === "REJECTED" ? "danger" : s === "DRAFT" ? "neutral" : s === "READY_FOR_FINAL_REVIEW" ? "accent" : "warning";
const VIEW_LABELS: Record<string, [string, string]> = { front: ["Front", "الأمام"], "front-three-quarter": ["Front 3/4", "أمام ٣/٤"], "left-side": ["Side", "الجانب"],
  "rear-three-quarter": ["Rear 3/4", "خلف ٣/٤"], rear: ["Rear", "الخلف"], "top-three-quarter": ["Above", "من الأعلى"] };

const sizeLabel: Record<string, [string, string]> = { widthMm: ["Width across the car (mm)", "العرض على امتداد عرض السيارة (مم)"], lengthMm: ["Length along the car (mm)", "الطول على امتداد السيارة (مم)"],
  heightMm: ["Height (mm)", "الارتفاع (مم)"], depthMm: ["Depth (mm)", "العمق (مم)"], rimInches: ["Rim diameter (inches)", "قطر الجنط (إنش)"] };

function useWork() {
  const { t } = useL(); const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const work = async (fn: () => Promise<unknown>, after?: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await fn(); await after?.(); }
    catch (e) { setError(threeDError(e,t)); }
    finally { setBusy(false); }
  };
  return { busy, error, work };
}
function Field({ label, value, onChange, numeric, placeholder, editable = true }: { label: string; value: string; onChange: (v: string) => void; numeric?: boolean; placeholder?: string; editable?: boolean }) {
  const { g, align } = useGarageTheme();
  return <View style={{ gap: 6, flex: 1, minWidth: 140 }}>
    <GText style={[gType.label, align]}>{label}</GText>
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} editable={editable} keyboardType={numeric ? "decimal-pad" : "default"} placeholder={placeholder} placeholderTextColor={g.soft}
      style={{ borderWidth: 1, borderColor: g.line, borderRadius: 12, color: g.ink, padding: 12, minHeight: 48, textAlign: align.textAlign, backgroundColor: g.cardSoft, writingDirection: numeric ? "ltr" : undefined }} />
  </View>;
}
export function Check({ label, checked, onPress, disabled }: { label: string; checked: boolean; onPress: () => void; disabled?: boolean }) {
  const { g, row, align } = useGarageTheme();
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked, disabled }} accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[row, { minHeight: 48, gap: 12, alignItems: "center", paddingVertical: 8, opacity: disabled ? .5 : 1 }]}>
    <GText style={{ color: g.accentText, fontSize: 22 }}>{checked ? "☑" : "☐"}</GText>
    <GText style={[gType.bodySm, align, { flex: 1, minWidth: 0 }]}>{label}</GText>
  </Pressable>;
}
/** A private image fetched with the session (data URI in memory, never on disk). */
export function PrivateImage({ load, label, height = 150, width = "100%" }: { load: () => Promise<string>; label: string; height?: number; width?: number | `${number}%` }) {
  const { g } = useGarageTheme(); const { t } = useL();
  const [uri, setUri] = useState<string | null>(null), [failed, setFailed] = useState(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { let live = true; load().then(b => live && setUri(`data:image/jpeg;base64,${b}`), () => live && setFailed(true)); return () => { live = false; }; }, [label]);
  return uri ? <Image accessibilityLabel={label} source={{ uri }} resizeMode="cover" style={{ width, height, borderRadius: 12, backgroundColor: g.cardSoft }} />
    : <View style={{ width, height, borderRadius: 12, backgroundColor: g.cardSoft, alignItems: "center", justifyContent: "center", padding: 8 }}><GText soft style={gType.tiny}>{failed ? t("Could not load", "تعذّر التحميل") : t("Loading…", "جارٍ التحميل…")}</GText></View>;
}
function PreviewGrid({ preview, load }: { preview: NonNullable<Preview>; load: (view: string) => () => Promise<string> }) {
  const { t } = useL(); const { row, align } = useGarageTheme();
  // a new fit or render changes the key, so mounted images reload instead of showing the old six views
  const imgKey = `${preview.modelRevision}-${preview.generationId}-${preview.fitSnapshot?.fitVersion ?? 0}-${preview.fitSnapshot?.updatedAt ?? preview.renderedAt ?? ""}`;
  return <View style={{ gap: 8 }}>
    <GText soft style={[gType.caption, align]}>{`${t("Shown on", "معروضة على")} ${preview.generationName}`}</GText>
    <View style={[row, { flexWrap: "wrap", gap: 8 }]}>
      {PREVIEW_VIEWS.map(v => <View key={`${imgKey}-${v}`} style={{ width: "48%", gap: 4 }}>
        <PrivateImage load={load(`preview-${v}`)} label={`${imgKey}-${v}`} height={120} />
        <GText soft style={[gType.tiny, align]}>{t(...VIEW_LABELS[v]!)}</GText>
      </View>)}
    </View>
  </View>;
}
function PhotoStrip({ photos, load, onRemove }: { photos: { id: string }[]; load: (id: string) => () => Promise<string>; onRemove?: (id: string) => void }) {
  const { t } = useL(); const { row } = useGarageTheme();
  return <View style={[row, { flexWrap: "wrap", gap: 8 }]}>
    {photos.map((p, i) => <View key={p.id} style={{ width: "31%", gap: 4 }}>
      <PrivateImage load={load(p.id)} label={p.id} height={90} />
      {onRemove ? <GButton variant="secondary" label={t("Remove", "حذف")} onPress={() => onRemove(p.id)} /> : <GText soft style={gType.tiny}>{`#${i + 1}`}</GText>}
    </View>)}
  </View>;
}
/** Resized + converted to JPEG by the shared picker; failures say which step failed, in the current language. */
async function pickJpeg(t: (en: string, ar: string) => string) {
  try { return (await pickPhoto())?.base64 ?? null; } catch (e) { throw new Error(photoErrorText(e, t)); }
}
function StatusCard({ a, admin }: { a: Accessory; admin?: boolean }) {
  const { t } = useL(); const { align } = useGarageTheme();
  const processing=accessoryProcessingLabel(a);
  const label=processing?t(...processing):a.lifecycleState==="FAILED"?t("Generation failed","تعذّر الإنشاء"):a.deactivatedAt?t("Unpublished","غير منشور"):a.lifecycleState==="GENERATION_QUEUED"?t("Generation queued","الإنشاء في قائمة الانتظار"):t(...STATUS_LABELS[a.status]);
  return <Card>
    <View style={{ alignItems: "flex-start", gap: 8 }}>
      <StatusChip tone={tone(a.status)} label={label} icon="cube-outline" />
      <GText style={[gType.title, align]}>{t(...ACCESSORY_TYPE_LABELS[a.accessoryType])}</GText>
    </View>
    {a.status === "GENERATING"&&!processing ? <GText style={[align, { marginTop: 8 }]}>{`${a.generationStage}${a.providerProgress !== null ? ` · ${a.providerProgress}%` : ""}`}</GText> : null}
    {a.mock ? <View style={{ marginTop: 10 }}><Note>{t("Mock mode: a plain stand-in shape that tests the workflow. It is not your part and can never be published.", "الوضع التجريبي: شكل بديل بسيط لاختبار الخطوات، وليس قطعتك، ولا يمكن نشره أبدًا.")}</Note></View> : null}
    {a.reviewNotes ? <View style={{ marginTop: 10 }}><Note tone={a.status === "REJECTED" ? "danger" : "accent"}>{a.reviewNotes}</Note></View> : null}
    {a.failureReason ? <View style={{ marginTop: 10 }}><Note tone="warning">{a.generationErrorCode?threeDError({code:a.generationErrorCode,message:a.failureReason},t):t(a.failureReason,"تتطلب النتيجة مراجعة الإدارة. راجع حالة التركيب.")}</Note></View> : null}
    {admin && a.generationErrorCode ? <GText soft selectable style={[gType.caption, align, { marginTop: 6 }]}>{a.generationErrorCode}</GText> : null}
    {a.providerState==="SUCCEEDED"&&a.failureReason?<GText selectable style={{textAlign:"left",writingDirection:"ltr",marginTop:8}}>{a.failureReason}</GText>:null}
    {admin&&a.processing?<GText soft selectable style={[gType.caption,align,{marginTop:8}]}>{`${t("Source bytes","بايتات المصدر")}: ${a.processing.rawBytes??"—"} · ${t("Optimized bytes","البايتات بعد التحسين")}: ${a.processing.optimizedBytes??"—"} · ${t("Final limit","الحد النهائي")}: ${a.processing.finalLimitBytes??"—"}`}</GText>:null}
  </Card>;
}

/** One section of the shop form: registered by id (so the problem list can scroll to it) and outlined in red while it has a problem. The outline sits in
 *  the margin, so nothing shifts. Defined at top level so typing in a field never remounts it. */
function SpotView({ id, spots, on, children }: { id: string; spots: { current: Record<string, View | null> }; on: boolean; children: React.ReactNode }) {
  const { g } = useGarageTheme();
  return <View ref={r => { spots.current[id] = r; }} collapsable={false} style={{ borderWidth: 2, borderColor: on ? g.danger : "transparent", borderRadius: 16, margin: -2 }}>{children}</View>;
}

// ---------------- shop ----------------
export function ShopAccessory3DScreen() {
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const { t, isArabic } = useL(); const { g, row, align } = useGarageTheme();
  // a body kit = one product with a FRONT and / or a REAR bumper, each its own 3D part (photos, generation, review)
  const [part, setPart] = useState<KitPart>("MAIN"), [kitChosen, setKitChosen] = useState(false);
  const state = useLoad(() => shopAccessoryApi.get(productId, part), [productId, part], 8000);
  const parts = state.data?.parts ?? [], isKit = kitChosen || parts.some(x => x.part !== "MAIN");
  useEffect(() => { if (part === "MAIN" && parts.some(x => x.part !== "MAIN")) setPart(parts.find(x => x.part !== "MAIN")!.part); }, [parts.map(x => x.part).join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const vehicles = useVehicleList("fitment");
  const { busy, error, work } = useWork();
  const a = state.data?.accessory ?? null;
  const editable = !a || a.status === "DRAFT" || a.status === "REJECTED";
  const types = part === "MAIN" ? typesForCategory(state.data?.category) : [KIT_PART_TYPE[part]];
  const canKit = typesForCategory(state.data?.category).includes("FRONT_BUMPER") && !parts.some(x => x.part === "MAIN");
  const [form, setForm] = useState<{ type: AccessoryType | null; fits: string[]; size: Record<string, string>; installedGen: string | null; spin: boolean;
    rim: { widthIn: string; pcd: string; offsetMm: string; finish: RimFinish | null } } | null>(null);
  const [fitmentNotes,setFitmentNotes]=useState("");
  const [search, setSearch] = useState(""), [consent, setConsent] = useState(false);
  // submit checks: every missing / invalid item is listed at once, each one scrolls to its field (highlighted while it is wrong)
  type Spot = "type" | "fits" | "size" | "installedGen" | "partPhotos" | "installedPhotos" | "consent";
  type Issue = { field: Spot; msg: string };
  const scrollRef = useRef<ScrollView>(null), spots = useRef<Record<string, View | null>>({});
  const [tried, setTried] = useState(false), [serverIssues, setServerIssues] = useState<Issue[] | null>(null);
  // saved details only: adding / removing a photo bumps updatedAt but must not wipe what the shop is typing
  const detailsSig = JSON.stringify([a?.status, a?.accessoryType, a?.fitsGenerationIds, a?.size, a?.rim, a?.installedGenerationId, a?.installed360, a?.fitmentNotes]);
  useEffect(() => { // the form starts from the saved accessory (once per revision of it)
    if (!state.data) return;
    setFitmentNotes(a?.fitmentNotes??"");
    const s = a?.size;
    const r = a?.rim;
    setForm({ type: a?.accessoryType ?? types[0] ?? null, fits: a?.fitsGenerationIds ?? [], installedGen: a?.installedGenerationId ?? null, spin: a?.installed360 ?? false,
      rim: { widthIn: r?.widthIn != null ? String(r.widthIn) : "", pcd: r?.pcd ?? "", offsetMm: r?.offsetMm != null ? String(r.offsetMm) : "", finish: r?.finish ?? null },
      size: Object.fromEntries((["widthMm", "heightMm", "depthMm", "lengthMm", "rimInches"] as const).map(k => [k, s?.[k] != null ? String(s[k]) : ""])) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!state.data, detailsSig, part]);
  const gens = useMemo(() => (vehicles.list ?? []).flatMap(v => (v.generations ?? []).map(g => ({ id: g.id, en: `${v.make} ${g.nameEn}`, ar: `${v.makeAr} ${g.nameAr}`, years: `${g.yearFrom}–${g.yearTo}` }))), [vehicles.list]);
  const name = (id: string) => { const g = gens.find(x => x.id === id); return g ? (isArabic ? g.ar : g.en) : "…"; };
  const q = search.trim().toLowerCase();
  const matches = q.length >= 2 ? gens.filter(g => !form?.fits.includes(g.id) && g.id !== form?.installedGen && (g.en.toLowerCase().includes(q) || g.ar.includes(search.trim()))).slice(0, 12) : [];
  const saveBody = () => ({ fitmentNotes,accessoryType: form!.type, fitsGenerationIds: form!.fits, installedGenerationId: form!.installedGen, installed360: form!.spin,
    ...Object.fromEntries(Object.entries(form!.size).map(([k, v]) => [k, v.trim() === "" ? null : Number(v)])),
    ...(form!.type === "RIMS" ? { rimWidthIn: form!.rim.widthIn.trim() || null, rimPcd: form!.rim.pcd.trim() || null, rimOffsetMm: form!.rim.offsetMm.trim() || null, rimFinish: form!.rim.finish } : {}) });
  const save = () => form && work(() => shopAccessoryApi.save(productId, saveBody(), part), state.reload);
  /** Submit: check everything (list all problems, jump to the first), then save the details as they are on screen and submit: no separate "Save details". */
  const submit = async () => {
    setTried(true);
    setServerIssues(null);
    if (!form) return;
    if (issues.length) return scrollTo(issues[0]!.field);
    await work(async () => {
      try {
        await shopAccessoryApi.save(productId, saveBody(), part);
        await shopAccessoryApi.submit(productId, part);
      } catch (e) {
        const list = (e as { data?: { issues?: { field: Spot; message: string }[] } }).data?.issues;
        if (list?.length) { setServerIssues(list.map(i => ({ field: i.field, msg: i.message }))); scrollTo(list[0]!.field); }
        throw e;
      }
    }, state.reload);
  };
  const add = (kind: "PART" | "INSTALLED") => work(async () => { const b = await pickJpeg(t); if (b) await shopAccessoryApi.photo(productId, kind, b, part); }, state.reload);
  const bumper = !!form?.type && isBumper(form.type);
  // rims on a Universal product = "Universal by size": no generation list, fitted on any car's wheels
  const rims = form?.type === "RIMS", bySize = rims && !!state.data?.isUniversal;
  const need = form?.type ? sizeField(form.type) : "widthMm";
  const load = (id: string) => () => shopAccessoryApi.asset(productId, id, part);
  // exactly one car chosen in section 2: that is the car in the installed photos
  useEffect(() => {
    if (form && editable && !bySize && form.fits.length === 1 && form.installedGen !== form.fits[0]) setForm({ ...form, installedGen: form.fits[0]! });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form?.fits.join(), editable, bySize]);
  /** What is missing or wrong right now, in the order of the form. The server re-checks the same things (and the size ranges). */
  const issues: Issue[] = [];
  if (form && state.data) {
    const add = (field: Spot, msg: string) => void issues.push({ field, msg });
    const rm = form.type ? state.data.sizeRanges?.[form.type] : undefined;
    if (!form.type) add("type", t("Choose what the part is (section 1).", "اختر نوع القطعة (القسم ١)."));
    if (!bySize && !form.fits.length) add("fits", t("Choose at least one car it fits (section 2).", "اختر سيارة واحدة على الأقل تناسبها القطعة (القسم ٢)."));
    if (bumper && state.data.isUniversal) add("fits", t("Bumpers are car-specific: untick Universal on the product (section 2).", "المصدات خاصة بسيارات محددة: ألغِ خيار «عام» في المنتج (القسم ٢)."));
    const raw = (form.size[need] ?? "").trim(), nv = Number(raw);
    if (form.type) {
      if (!raw) add("size", t(`Enter the ${rims ? "rim diameter in inches" : "part's real size"} (section 3).`, `أدخل ${rims ? "قطر الجنط بالإنش" : "المقاس الحقيقي للقطعة"} (القسم ٣).`));
      else if (rims ? !(nv >= 12 && nv <= 26) : !Number.isInteger(nv)) add("size", rims ? t("Rim diameter is between 12 and 26 inches (section 3).", "قطر الجنط بين ١٢ و٢٦ إنش (القسم ٣).") : t("Use whole millimetres, without decimals (section 3).", "استخدم ملليمترات صحيحة بلا كسور (القسم ٣)."));
      else if (rm && (nv < rm.min || nv > rm.max)) add("size", t(`A ${t(...ACCESSORY_TYPE_LABELS[form.type]).toLowerCase()}'s ${rm.field === "widthMm" ? "width" : "length"} must be ${rm.min}–${rm.max} mm: you entered ${raw}. Measure the whole part, end to end (section 3).`,
        `${rm.field === "widthMm" ? "عرض" : "طول"} ${ACCESSORY_TYPE_LABELS[form.type][1]} يجب أن يكون بين ${rm.min} و${rm.max} مم: أدخلت ${raw}. قس القطعة كاملة من طرف إلى طرف (القسم ٣).`));
    }
    if (rims) {
      const w = form.rim.widthIn.trim(), pcd = form.rim.pcd.trim().toLowerCase().replace(/\s+/g, "").replace("×", "x"), et = form.rim.offsetMm.trim();
      if (w && !(Number(w) >= 4 && Number(w) <= 14)) add("size", t("Rim width is between 4 and 14 inches (section 3).", "عرض الجنط بين ٤ و١٤ إنش (القسم ٣)."));
      if (pcd && !/^[3-8]x\d{2,3}(\.\d)?$/.test(pcd)) add("size", t("PCD looks like 5x112 (section 3).", "PCD يكون مثل 5x112 (القسم ٣)."));
      if (et && !(Number.isInteger(Number(et)) && Number(et) >= -50 && Number(et) <= 80)) add("size", t("Offset (ET) is a whole number from -50 to 80 (section 3).", "الإزاحة ET عدد صحيح من -٥٠ إلى ٨٠ (القسم ٣)."));
    }
    if (!bySize && form.fits.length > 1 && !form.installedGen) add("installedGen", t("Tap the car shown in the installed photos (section 4).", "اضغط على السيارة الظاهرة في صور التركيب (القسم ٤)."));
    if (bySize && !form.installedGen) add("installedGen", t("Search and choose the car shown in the installed photos (section 4).", "ابحث واختر السيارة الظاهرة في صور التركيب (القسم ٤)."));
    if (a) {
      if (a.partPhotos.length < 2 || a.partPhotos.length > 4) add("partPhotos", t(`Add 2–4 photos of the loose part: you have ${a.partPhotos.length} (section 5).`, `أضف ٢–٤ صور للقطعة منفردة: لديك ${a.partPhotos.length} (القسم ٥).`));
      if (a.installedPhotos.length < 1) add("installedPhotos", t("Add at least one photo of the part installed on a car (section 6).", "أضف صورة واحدة على الأقل للقطعة مركّبة على سيارة (القسم ٦)."));
      else if (form.spin && a.installedPhotos.length < 12) add("installedPhotos", t(`A 360° set needs 12 or more photos: you have ${a.installedPhotos.length}. Add photos or untick 360° (sections 4 and 6).`, `مجموعة ٣٦٠° تحتاج ١٢ صورة أو أكثر: لديك ${a.installedPhotos.length}. أضف صورًا أو ألغِ ٣٦٠° (القسمان ٤ و٦).`));
      if (!consent) add("consent", t("Tick the box confirming you own the photos.", "ضع علامة على الخانة التي تؤكد ملكيتك للصور."));
    }
  }
  const shown = issues.length ? issues : serverIssues ?? [];
  const bad = (f: Spot) => tried && shown.some(i => i.field === f);
  const scrollTo = (f: Spot) => {
    const node = spots.current[f], sv = scrollRef.current as unknown as { getInnerViewRef?: () => unknown; scrollTo: (o: { y: number; animated: boolean }) => void } | null;
    if (!node || !sv) return;
    (node as unknown as { measureLayout: (rel: unknown, ok: (x: number, y: number) => void, no: () => void) => void }).measureLayout(sv.getInnerViewRef?.() ?? sv, (_x, y) => sv.scrollTo({ y: Math.max(0, y - 16), animated: true }), () => undefined);
  };
  const partStatus = (k: KitPart) => parts.find(x => x.part === k)?.status;

  return <ProviderLayout hero={<GarageHero variant="detail" backLabel={t("Back", "رجوع")} onBack={() => router.back()} title={t("Show it in 3D", "اعرضها ثلاثية الأبعاد")} line={t("Customers see this part on their own car.", "يرى العملاء هذه القطعة على سياراتهم.")} />}
    scrollRef={scrollRef} onRefresh={() => void state.reload()} refreshing={state.loading && !!state.data}>
    <View style={{ gap: 14 }}>
      {state.error && !state.data ? <Note tone="danger">{state.error}</Note> : null}
      {!state.data ? <GText>{t("Loading…", "جارٍ التحميل…")}</GText> : !state.data.eligible ? (
        <Note>{t("3D is available for body kits and exterior accessories (Body or Exterior accessories category) and rims (Wheels). Change the product's category first.", "العرض ثلاثي الأبعاد متاح لأطقم الهيكل والإكسسوارات الخارجية (فئة الهيكل أو الإكسسوارات الخارجية) والجنوط (فئة الجنوط). غيّر فئة المنتج أولًا.")}</Note>
      ) : form ? <>
        {canKit || isKit ? <Section title={t("One part or a body kit?", "قطعة واحدة أم طقم هيكل؟")}>
          {canKit && !parts.length ? <View style={[row, { flexWrap: "wrap", gap: 8 }]}>
            <Chip label={t("One part", "قطعة واحدة")} on={!isKit} onPress={() => { setKitChosen(false); setPart("MAIN"); }} />
            <Chip label={t("Body kit (front + rear bumper)", "طقم هيكل (مصد أمامي + خلفي)")} on={isKit} onPress={() => { setKitChosen(true); setPart("FRONT"); }} />
          </View> : null}
          {isKit ? <>
            <GText soft style={[gType.caption, align, { marginTop: 8 }]}>{t("Each bumper is its own 3D part: its own photos, generation and review. Customers can switch each one on and off.", "كل مصد قطعة ثلاثية الأبعاد مستقلة: صوره وإنشاؤه ومراجعته. يمكن للعميل تشغيل كل واحد وإيقافه.")}</GText>
            <View style={[row, { flexWrap: "wrap", gap: 8, marginTop: 8 }]}>{(["FRONT", "REAR"] as const).map(k => <Chip key={k}
              label={`${t(...ACCESSORY_TYPE_LABELS[KIT_PART_TYPE[k]])}${partStatus(k) ? ` · ${t(...STATUS_LABELS[partStatus(k)!]).split(":")[0]}` : ` · ${t("not added", "غير مضاف")}`}`}
              on={part === k} onPress={() => setPart(k)} />)}</View>
          </> : null}
        </Section> : null}
        {a ? <StatusCard a={a} /> : null}
        {a?.preview ? <Section title={t("Your private 3D preview", "معاينتك الخاصة ثلاثية الأبعاد")}><PreviewGrid preview={a.preview} load={load} /></Section> : null}

        <SpotView id="type" spots={spots} on={bad("type")}><Section title={t("1. What is it?", "١. ما القطعة؟")}>
          <View style={[row, { flexWrap: "wrap", gap: 8 }]}>{types.map(k => <Chip key={k} label={t(...ACCESSORY_TYPE_LABELS[k])} on={form.type === k} onPress={() => editable && setForm({ ...form, type: k })} />)}</View>
          {(form.type === "FRONT_BUMPER" && /\brear\b|خلف/i.test(state.data.productName ?? "")) || (form.type === "REAR_BUMPER" && /\bfront\b|أمام/i.test(state.data.productName ?? "")) ? <View style={{ marginTop: 8 }}><Note tone="warning" icon="alert-circle-outline">{t(`The product is called "${state.data.productName}" but you chose ${t(...ACCESSORY_TYPE_LABELS[form.type!]).toLowerCase()}. Check it is the right one.`, `اسم المنتج "${state.data.productName}" لكنك اخترت ${ACCESSORY_TYPE_LABELS[form.type!][1]}. تأكد أنه الصحيح.`)}</Note></View> : null}
        </Section></SpotView>

        <SpotView id="fits" spots={spots} on={bad("fits")}><Section title={t("2. Which cars does it fit?", "٢. ما السيارات المناسبة؟")}>
          {bumper ? <Note icon="car-outline" tone={state.data.isUniversal ? "danger" : undefined}>{state.data.isUniversal
            ? t("Bumpers are made for specific cars: untick Universal on the product, then choose the exact generations.", "المصدات مصنوعة لسيارات محددة: ألغِ خيار «عام» في المنتج ثم اختر الأجيال بدقة.")
            : t("Bumpers are car-specific: choose the exact generation(s). Customers see \"View on my car\" only for those cars.", "المصدات خاصة بسيارات محددة: اختر الجيل أو الأجيال بدقة. يرى العملاء «اعرضها على سيارتي» لتلك السيارات فقط.")}</Note> : null}
          {rims ? <Note icon="disc-outline">{bySize
            ? t("Universal by size: fitted on any customer's car by measuring its wheels in 3D. Customers are reminded to check PCD/offset with you before buying.", "عام حسب المقاس: يُركَّب على سيارة أي عميل بقياس عجلاتها ثلاثيًا. نذكّر العملاء بالتأكد من مقاس البراغي والإزاحة معك قبل الشراء.")
            : t("Choose the exact generations, or tick Universal on the product to sell these rims Universal by size.", "اختر الأجيال بدقة، أو فعّل «عام» في المنتج لبيع هذه الجنوط عامة حسب المقاس.")}</Note> : null}
          {bySize ? null : <>
          <View style={[row, { flexWrap: "wrap", gap: 8 }]}>{form.fits.map(id => <Chip key={id} label={`${name(id)}  ✕`} on onPress={() => editable && setForm({ ...form, fits: form.fits.filter(x => x !== id), installedGen: form.installedGen === id ? null : form.installedGen })} />)}</View>
          <SupportWarning type={form.type} generationIds={form.fits} name={name} />
          {editable ? <View style={{ marginTop: 10, gap: 8 }}>
            <Field label={t("Search a car generation", "ابحث عن جيل السيارة")} value={search} onChange={setSearch} placeholder={t("e.g. E36, Corolla", "مثال: E36، كورولا")} />
            {vehicles.error ? <Note tone="danger">{vehicles.error}</Note> : null}
            {matches.map(g => <Chip key={g.id} icon="add" label={`${isArabic ? g.ar : g.en} · ${g.years}`} onPress={() => { setForm({ ...form, fits: [...form.fits, g.id] }); setSearch(""); }} />)}
          </View> : null}
          </>}
        </Section></SpotView>

        <SpotView id="size" spots={spots} on={bad("size")}><Section title={t("3. Real size", "٣. المقاس الحقيقي")}>
          <GText soft style={[gType.caption, align, { marginBottom: 8 }]}>{t("Used to scale the part on the customer's car. The first field is required.", "يُستخدم لضبط مقاس القطعة على سيارة العميل. الحقل الأول مطلوب.")}{form.type && state.data.sizeRanges?.[form.type] ? ` ${t(`Expected: ${state.data.sizeRanges[form.type]!.min}–${state.data.sizeRanges[form.type]!.max} mm.`, `المتوقع: ${state.data.sizeRanges[form.type]!.min}–${state.data.sizeRanges[form.type]!.max} مم.`)}` : ""}</GText>
          <View style={[row, { flexWrap: "wrap", gap: 10 }]}>
            {[need, ...(need === "rimInches" ? [] : (["widthMm", "heightMm", "depthMm", "lengthMm"] as const).filter(k => k !== need))].map(k =>
              <Field key={k} numeric editable={editable} label={t(...sizeLabel[k]!) + (k === need ? " *" : "")} value={form.size[k] ?? ""} onChange={v => setForm({ ...form, size: { ...form.size, [k]: normalizeNumberText(v) } })} />)}
            {rims ? <>
              <Field numeric editable={editable} label={t("Rim width (inches, e.g. 8)", "عرض الجنط (إنش، مثال 8)")} value={form.rim.widthIn} onChange={v => setForm({ ...form, rim: { ...form.rim, widthIn: normalizeNumberText(v) } })} />
              <Field editable={editable} label={t("Bolt pattern / PCD (e.g. 5x120)", "توزيع البراغي / PCD (مثال 5x120)")} value={form.rim.pcd} onChange={v => setForm({ ...form, rim: { ...form.rim, pcd: normalizeNumberText(v) } })} />
              <Field editable={editable} label={t("Offset ET (mm, e.g. 35)", "الإزاحة ET (مم، مثال 35)")} value={form.rim.offsetMm} onChange={v => setForm({ ...form, rim: { ...form.rim, offsetMm: normalizeNumberText(v) } })} />
            </> : null}
          </View>
          {rims ? <>
            <GText style={[gType.label, align, { marginTop: 12, marginBottom: 6 }]}>{t("Finish (the 3D rim uses it)", "اللون (يستخدمه الجنط ثلاثي الأبعاد)")}</GText>
            <View style={[row, { flexWrap: "wrap", gap: 8 }]}>{RIM_FINISHES.map(f => <Chip key={f} label={t(...RIM_FINISH_LABELS[f])} on={form.rim.finish === f} onPress={() => editable && setForm({ ...form, rim: { ...form.rim, finish: form.rim.finish === f ? null : f } })} />)}</View>
            <GText soft style={[gType.tiny, align, { marginTop: 6 }]}>{t("Optional fields are shown on the product page. Rims keep their finish: customers can't paint them to match.", "الحقول الاختيارية تظهر في صفحة المنتج. تحتفظ الجنوط بلونها: لا يمكن للعميل طلاؤها بلون السيارة.")}</GText>
          </> : null}
        </Section></SpotView>

        <SpotView id="installedGen" spots={spots} on={bad("installedGen")}><Section title={t("4. Car shown in the installed photos", "٤. السيارة في صور التركيب")}>
          {bySize ? <View style={{ gap: 8 }}>
            {form.installedGen ? <View style={[row]}><Chip label={name(form.installedGen)} on /></View> : null}
            {editable ? <Field label={t("Search a car generation", "ابحث عن جيل السيارة")} value={search} onChange={setSearch} placeholder={t("e.g. E36, Corolla", "مثال: E36، كورولا")} /> : null}
            {editable ? matches.map(g => <Chip key={g.id} icon="add" label={`${isArabic ? g.ar : g.en} · ${g.years}`} onPress={() => { setForm({ ...form, installedGen: g.id }); setSearch(""); }} />) : null}
          </View>
          : form.fits.length ? <View style={[row, { flexWrap: "wrap", gap: 8 }]}>{form.fits.map(id => <Chip key={id} label={name(id)} on={form.installedGen === id} onPress={() => editable && setForm({ ...form, installedGen: id })} />)}</View>
            : <GText soft style={align}>{t("Choose the cars it fits first.", "اختر السيارات المناسبة أولًا.")}</GText>}
          <Check label={t("The installed photos are a 360° set (12 or more, taken all around the car, in order)", "صور التركيب مجموعة ٣٦٠° (١٢ صورة أو أكثر حول السيارة بالترتيب)")} checked={form.spin} disabled={!editable} onPress={() => setForm({ ...form, spin: !form.spin })} />
        </Section></SpotView>
        {editable ? <GButton label={a ? t("Save details", "حفظ التفاصيل") : t("Create 3D request", "إنشاء طلب ثلاثي الأبعاد")} disabled={busy || !form.type} onPress={() => void save()} /> : null}

        {a ? <>
          <SpotView id="partPhotos" spots={spots} on={bad("partPhotos")}><Section title={t("5. Photos of the loose part (2–4)", "٥. صور القطعة منفردة (٢–٤)")}>
            <Note icon="camera-outline">{t("Plain, light background. The part alone, whole and in focus. 2–4 different angles: front, back, and from each end.", "خلفية فاتحة وسادة. القطعة وحدها كاملة وواضحة. ٢–٤ زوايا مختلفة: أمام وخلف ومن كل طرف.")}</Note>
            <View style={{ marginTop: 10 }}><PhotoStrip photos={a.partPhotos} load={load} onRemove={editable ? id => void work(() => shopAccessoryApi.removePhoto(productId, id, part), state.reload) : undefined} /></View>
            {editable && a.partPhotos.length < 4 ? <GButton style={{ marginTop: 10 }} variant="secondary" icon="add" label={t("Add part photo", "إضافة صورة القطعة")} disabled={busy} onPress={() => void add("PART")} /> : null}
          </Section></SpotView>
          <SpotView id="installedPhotos" spots={spots} on={bad("installedPhotos")}><Section title={t("6. Installed on a car (1–24)", "٦. مركّبة على سيارة (١–٢٤)")}>
            <Note icon="camera-outline">{t("Front, side, rear and 3/4 views of the part on the car. For a 360° view take 12 or more photos walking around the car, keeping the same distance.", "صور أمامية وجانبية وخلفية و٣/٤ للقطعة على السيارة. لعرض ٣٦٠° التقط ١٢ صورة أو أكثر وأنت تدور حول السيارة على المسافة نفسها.")}</Note>
            <View style={{ marginTop: 10 }}><PhotoStrip photos={a.installedPhotos} load={load} onRemove={editable ? id => void work(() => shopAccessoryApi.removePhoto(productId, id, part), state.reload) : undefined} /></View>
            {editable && a.installedPhotos.length < 24 ? <GButton style={{ marginTop: 10 }} variant="secondary" icon="add" label={t("Add installed photo", "إضافة صورة تركيب")} disabled={busy} onPress={() => void add("INSTALLED")} /> : null}
          </Section></SpotView>
          {editable ? <Card style={{ marginTop: 14 }}>
            <Field label={t("Fitment notes (optional)","ملاحظات التركيب (اختيارية)")} value={fitmentNotes} onChange={setFitmentNotes}/>
            <SpotView id="consent" spots={spots} on={bad("consent")}><Check checked={consent} disabled={busy} onPress={() => setConsent(v => !v)} label={t("I own these photos. MOTEXA may create a 3D model of this part (with Meshy) and show it and the installed photos to customers.", "أملك هذه الصور. يجوز لموتكسا إنشاء نموذج ثلاثي الأبعاد لهذه القطعة (عبر Meshy) وعرضه وعرض صور التركيب للعملاء.")} /></SpotView>
            {tried && shown.length ? <View style={{ gap: 6, marginVertical: 8 }}>
              <Note tone="danger" icon="alert-circle-outline">{t(`${shown.length} ${shown.length === 1 ? "thing needs" : "things need"} fixing before you can submit. Tap one to go to it:`, `${shown.length} ${shown.length === 1 ? "أمر يحتاج" : "أمور تحتاج"} إلى تصحيح قبل الإرسال. اضغط على أحدها للانتقال إليه:`)}</Note>
              {shown.map((i, k) => <Pressable key={k + i.msg} accessibilityRole="button" accessibilityLabel={i.msg} onPress={() => scrollTo(i.field)} style={[row, { minHeight: 44, alignItems: "center", gap: 8, paddingVertical: 6 }]}>
                <GText style={{ color: g.danger, fontSize: 18 }}>•</GText>
                <GText style={[gType.bodySm, align, { flex: 1, minWidth: 0, color: g.danger }]}>{i.msg}</GText>
                <GText style={{ color: g.accentText }}>{isArabic ? "‹" : "›"}</GText>
              </Pressable>)}
            </View> : null}
            <GButton icon="cube-outline" label={t("Submit for 3D", "إرسال لإنشاء ثلاثي الأبعاد")} disabled={busy} onPress={() => void submit()} />
          </Card> : a.status !== "GENERATING" ? <GButton variant="secondary" label={t("Edit and resubmit", "تعديل وإعادة الإرسال")} disabled={busy} onPress={() => void work(() => shopAccessoryApi.revise(productId, part), state.reload)} /> : null}
          {a.status === "PUBLISHED" ? <Note tone="warning">{t("Editing takes the 3D view off customers' cars until Parts Admin publishes it again.", "التعديل يُخفي العرض ثلاثي الأبعاد عن العملاء حتى تعيد إدارة القطع نشره.")}</Note> : null}
          {a.status === "DRAFT" ? <GButton variant="danger" label={t("Delete 3D request", "حذف طلب ثلاثي الأبعاد")} disabled={busy} onPress={() => void work(() => shopAccessoryApi.remove(productId, part), state.reload)} /> : null}
        </> : null}
        {busy ? <GText soft>{t("Working…", "جارٍ التنفيذ…")}</GText> : null}
        {error && !serverIssues ? <Note tone="danger">{error}</Note> : null}
      </> : null}
    </View>
  </ProviderLayout>;
}

// ---------------- Parts Admin ----------------
/** /dept/accessory3d: the same "3D requests" list as Requests > 3D requests (kept as a route so old links work). */
export function AdminAccessory3DList() {
  const d = useDT();
  const { list } = useThreeDCount();
  return <DeptPage back onRefresh={() => void list.reload()} refreshing={list.loading && !!list.data}>
    <DeptSection title={d.t("3D requests", "طلبات ثلاثية الأبعاد")} caption={d.t("Every request a shop submitted, newest first. Open one to review it.", "كل طلب أرسله متجر، الأحدث أولًا. افتح طلبًا لمراجعته.")} />
    <ThreeDRequests list={list} />
    <View style={{ marginTop: 12 }}><GButton variant="secondary" icon="options-outline" label={d.t("Fitting zones per car model", "مناطق التركيب لكل طراز")} onPress={() => router.push("/dept/accessory-zones" as Href)} /></View>
  </DeptPage>;
}

export function AdminAccessory3DDetail() {
  const { id } = useLocalSearchParams<{ id: string }>(); const { t, isArabic } = useL(); const { row, align } = useGarageTheme();
  const item = useLoad(() => adminAccessoryApi.get(id), [id], 6000);
  const { busy, error, work } = useWork();
  const [notes, setNotes] = useState(""), [paid, setPaid] = useState(false), [cap, setCap] = useState("");
  const [replacement, setReplacement] = useState(false), [replacementPaid, setReplacementPaid] = useState(false);
  const a = item.data;
  useEffect(() => { if (a) setCap(String(a.monthlyCredits)); }, [a?.monthlyCredits]);
  const act = (action: Parameters<typeof adminAccessoryApi.act>[1], body?: Record<string, unknown>) => work(() => adminAccessoryApi.act(id, action, body), item.reload);
  const load = (asset: string) => () => adminAccessoryApi.asset(id, asset);
  const left = a ? Math.max(0, a.monthlyCredits - a.creditsThisMonth) : 0;
  return <GaragePage hero={<GarageHero variant="detail" backLabel={t("Back", "رجوع")} onBack={() => router.back()} title={a?.product?.name ?? t("Accessory", "إكسسوار")} line={a?.product ? `${a.product.shop.shopName} · ${a.product.brand} ${a.product.partNumber}` : undefined} />}
    onRefresh={() => void item.reload()} refreshing={item.loading && !!item.data}>
    {!a ? (item.error ? <Note tone="danger">{item.error}</Note> : <GText>{t("Loading…", "جارٍ التحميل…")}</GText>) : <View style={{ gap: 14 }}>
      <StatusCard a={a} admin />
      {a.hasModel||a.providerState==="SUCCEEDED"||a.status==="READY_FOR_FINAL_REVIEW"||a.status==="PUBLISHED"?<AccessoryFinalReview a={a} busy={busy} act={act}>{a.preview?<PreviewGrid preview={a.preview} load={load}/>:null}</AccessoryFinalReview>:null}
      {a.provider==="MESHY"&&a.providerTaskId?<Card><GText>{t("Meshy task","مهمة Meshy")}</GText><GText selectable style={{writingDirection:"ltr",textAlign:"left"}}>{a.providerTaskId}</GText></Card>:null}
      {a.status === "READY_FOR_FINAL_REVIEW" && a.provider === "MESHY" && a.providerState === "SUCCEEDED" ? <Card>
        <GButton variant="secondary" label={t("Generate a new 3D (costs Meshy credits)", "إنشاء نموذج ثلاثي الأبعاد جديد (يستهلك رصيد Meshy)")} disabled={busy} onPress={() => { setReplacement(true); setReplacementPaid(false); }} />
        {replacement ? <View style={{ gap: 10, marginTop: 12 }}>
          <Note tone="warning">{t(`This creates a new Meshy task and costs approximately ${a.estimatedProviderCredits ?? 30} credits. The existing task and result remain in history.`, `سيُنشئ هذا مهمة Meshy جديدة بتكلفة تقديرية ${a.estimatedProviderCredits ?? 30} رصيدًا. تبقى المهمة والنتيجة الحاليتان في السجل.`)}</Note>
          <Check checked={replacementPaid} disabled={busy} onPress={() => setReplacementPaid(v => !v)} label={t("I confirm the cost of a new generation", "أؤكد تكلفة إنشاء نموذج جديد")} />
          <GButton label={t("Confirm and start paid generation", "تأكيد وبدء الإنشاء المدفوع")} disabled={busy || !replacementPaid || !a.paidEnabled || left === 0} onPress={() => void act("start", { confirmPaid: true, replaceRevision: a.revision })} />
          <GButton variant="secondary" label={t("Cancel", "إلغاء")} onPress={() => { setReplacement(false); setReplacementPaid(false); }} />
        </View> : null}
      </Card> : null}
      {a.status === "APPROVED_FOR_GENERATION" && a.resumable ? <Card>
        <Note>{t("Resume the saved Meshy task. No new task or charge is created.", "استأنف مهمة Meshy المحفوظة دون إنشاء مهمة أو تكلفة جديدة.")}</Note>
        <GButton icon="refresh" label={t("Resume the same task (no new charge)", "استئناف المهمة نفسها (دون تكلفة جديدة)")} disabled={busy} onPress={() => void act("start", {})} />
      </Card> : a.status === "APPROVED_FOR_GENERATION" && a.providerState !== "SUCCEEDED" ? <Card>
        <GText style={[gType.label, align]}>{t("Generate with Meshy", "إنشاء عبر Meshy")}</GText>
        <GText soft style={align}>{`${t("Shop generations this month", "إنشاءات المتجر هذا الشهر")}: ${a.creditsThisMonth} / ${a.monthlyCredits}`}</GText>
        {!a.paidEnabled?<Note tone="warning">{t("Meshy generation is unavailable. Check the backend key and generation setting.", "إنشاء Meshy غير متاح. تحقق من مفتاح الخادم وإعداد الإنشاء.")}</Note>:null}
        {a.mode==="real"?<Check checked={paid} disabled={busy} onPress={()=>setPaid(v=>!v)} label={a.estimatedProviderCredits?t(`I confirm one paid Meshy generation, estimated ${a.estimatedProviderCredits} Meshy credits.`,`أؤكد إنشاءً واحدًا مدفوعًا بتكلفة تقديرية ${a.estimatedProviderCredits} من رصيد Meshy.`):t("I confirm one paid Meshy generation.","أؤكد إنشاءً واحدًا مدفوعًا عبر Meshy.")}/>:null}
        <GButton icon="cube-outline" label={t("Start 3D Generation", "بدء إنشاء النموذج")+(a.estimatedProviderCredits?` · ${a.estimatedProviderCredits} ${t("Meshy credits","من رصيد Meshy")}`:"")} disabled={busy||a.generationErrorCode==="PROVIDER_REQUEST_UNCONFIRMED"||(a.mode==="real"&&(!paid||!a.paidEnabled||left===0))} onPress={()=>void act("start",{confirmPaid:paid})}/>
      </Card>:null}
      {a.fitmentNotes?<Note>{a.fitmentNotes}</Note>:null}
      {a.status==="PUBLISHED"?<GButton variant={a.deactivatedAt?"secondary":"danger"} label={a.deactivatedAt?t("Reactivate model","إعادة نشر النموذج"):t("Unpublish model","إلغاء نشر النموذج")} disabled={busy} onPress={()=>void act(a.deactivatedAt?"reactivate":"unpublish")}/>:null}
      {a.hasModel&&a.status!=="PUBLISHED"&&a.status!=="GENERATING"?<GButton variant="danger" label={t("Discard private candidate (retain task history)","حذف النموذج الخاص مع حفظ تاريخ المهمة")} disabled={busy} onPress={()=>void act("discard-candidate")}/>:null}
      <Card>
        <GText style={[gType.label, align]}>{t("Real size", "المقاس الحقيقي")}</GText>
        {Object.entries(a.size).filter(([, v]) => v !== null).map(([k, v]) => <GText key={k} soft style={align}>{`${t(...sizeLabel[k]!)}: ${v}`}</GText>)}
        <GText style={[gType.label, align, { marginTop: 10 }]}>{t("Fits", "تناسب")}</GText>
        {a.fits.map(f => <GText key={f.id} soft style={align}>{`${isArabic ? f.nameAr : f.name} (${f.years[0]}–${f.years[1]})${f.id === a.installedGenerationId ? ` · ${t("in the installed photos", "في صور التركيب")}` : ""}${f.has3d ? " · 3D" : ""}`}</GText>)}
        <SupportWarning type={a.accessoryType} generationIds={a.fits.map(f => f.id)} name={id => { const f = a.fits.find(x => x.id === id); return f ? (isArabic ? f.nameAr : f.name) : id; }} />
      </Card>
      <Section title={t("Loose part photos (sent to the 3D provider)", "صور القطعة (تُرسل لمزود النموذج)")}><PhotoStrip photos={a.partPhotos} load={load} /></Section>
      <Section title={`${t("Installed photos", "صور التركيب")}${a.installed360 ? " · 360°" : ""}`}><PhotoStrip photos={a.installedPhotos} load={load} /></Section>

      {a.status === "PENDING_REVIEW" ? <Card>
        <Note>{t("Check: photos show the real part, plain background for the loose part, nothing private (plates, faces), the installed car matches, the size is plausible. Approving also shows the installed photos to customers.", "تحقق: الصور للقطعة الحقيقية، خلفية سادة للقطعة المنفردة، لا شيء خاص (لوحات، وجوه)، السيارة في صور التركيب مطابقة، المقاس منطقي. الموافقة تُظهر صور التركيب للعملاء أيضًا.")}</Note>
        <GButton style={{ marginTop: 10 }} label={t("Approve for 3D generation", "الموافقة على إنشاء النموذج")} disabled={busy} onPress={() => void act("approve")} />
      </Card> : null}

      {["PENDING_REVIEW", "APPROVED_FOR_GENERATION", "READY_FOR_FINAL_REVIEW"].includes(a.status) ? <Card>
        <Field label={t("Notes to the shop", "ملاحظات للمتجر")} value={notes} onChange={setNotes} />
        <GButton style={{ marginTop: 10 }} variant="danger" label={t("Reject (shop must change it)", "رفض (على المتجر التعديل)")} disabled={busy || !notes.trim()} onPress={() => void act("reject", { notes })} />
      </Card> : null}

      {a.product ? <Card>
        <View style={[row, { gap: 10, alignItems: "flex-end", flexWrap: "wrap" }]}>
          <Field numeric label={t("Paid 3D generations per month for this shop", "إنشاءات مدفوعة شهريًا لهذا المتجر")} value={cap} onChange={v => setCap(normalizeNumberText(v))} />
          <GButton variant="secondary" label={t("Save", "حفظ")} disabled={busy || cap === ""} onPress={() => void work(() => adminAccessoryApi.setCredits(a.product!.shop.id, Number(cap)), item.reload)} />
        </View>
      </Card> : null}
      {busy ? <GText soft>{t("Working… (rendering a preview takes up to a minute)", "جارٍ التنفيذ… (عرض المعاينة قد يستغرق دقيقة)")}</GText> : null}
      {error ? <Note tone="danger">{error}</Note> : null}
    </View>}
  </GaragePage>;
}

// ---------------- zone editor ----------------
/** The viewer's default boxes (sceneHtml KIT); types without one are computed from the wheels / roof / mirrors. */
const DEFAULT_BOX: Partial<Record<AccessoryType, ZoneBox>> = {
  FRONT_BUMPER: { x: [0, 1], y: [0, .45], z: [.88, 1] }, REAR_BUMPER: { x: [0, 1], y: [0, .45], z: [0, .12] },
  FRONT_LIP: { x: [0, 1], y: [0, .45], z: [.94, 1] }, REAR_DIFFUSER: { x: [0, 1], y: [0, .45], z: [0, .06] },
};
/** Starting points for a stock-part box (the admin tunes it with the red preview). */
const REPLACE_START: Partial<Record<AccessoryType, ZoneBox>> = {
  WING: { x: [.15, .85], y: [.72, .9], z: [0, .08] }, SPOILER: { x: [.15, .85], y: [.72, .9], z: [0, .08] },
  ROOF_RACK: { x: [.05, .95], y: [.93, 1.01], z: [.3, .7] }, MIRROR_COVERS: { x: [-.01, 1.01], y: [.55, .75], z: [.55, .7] }, RIMS: { x: [-.01, 1.01], y: [0, .45], z: [0, 1] },
};
const toFields = (b: ZoneBox) => [b.x[0], b.x[1], b.y[0], b.y[1], b.z[0], b.z[1]].map(String);
const toBox = (f: string[]): ZoneBox | null => {
  const n = f.map(Number);
  return n.length === 6 && n.every(v => Number.isFinite(v) && v >= -.5 && v <= 1.5) && n[0]! < n[1]! && n[2]! < n[3]! && n[4]! < n[5]! ? { x: [n[0]!, n[1]!], y: [n[2]!, n[3]!], z: [n[4]!, n[5]!] } : null;
};
const BOX_LABELS: [string, string][] = [["x from", "x من"], ["x to", "x إلى"], ["y from (ground)", "y من (الأرض)"], ["y to", "y إلى"], ["z from (0 = rear)", "z من (0 = الخلف)"], ["z to (1 = front)", "z إلى (1 = الأمام)"]];
function BoxFields({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const { t } = useL(); const { row } = useGarageTheme();
  return <View style={[row, { flexWrap: "wrap", gap: 10, marginTop: 8 }]}>{BOX_LABELS.map((l, i) => <Field key={i} numeric label={t(...l)} value={value[i] ?? ""} onChange={v => onChange(value.map((x, j) => j === i ? normalizeNumberText(v) : x))} />)}</View>;
}
function Swatch({ color, label }: { color: string; label: string }) {
  const { row, align } = useGarageTheme();
  return <View style={[row, { alignItems: "center", gap: 6, flexShrink: 1 }]}><View style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: color }} /><GText style={[gType.caption, align, { flexShrink: 1 }]}>{label}</GText></View>;
}
type Mode = "parts" | "zones" | "fits";
/** /dept/accessory-zones: the part map per car model (default), the zone cut as the fallback for unconfirmed / one-piece models. */
export function AdminAccessoryZones() {
  const params=useLocalSearchParams<{mode?:string}>();
  const [mode, setMode] = useState<Mode>(params.mode==="fits"?"fits":params.mode==="zones"?"zones":"parts");
  return mode === "parts" ? <PartMapEditor mode={mode} setMode={setMode} /> : mode === "fits" ? <AutoFitEditor mode={mode} setMode={setMode} /> : <ZoneEditor mode={mode} setMode={setMode} />;
}
function ModeSwitch({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  const { t } = useL(); const { row } = useGarageTheme();
  return <View style={[row, { gap: 8, flexWrap: "wrap" }]}>
    <Chip label={t("Part map", "خريطة القطع")} on={mode === "parts"} onPress={() => setMode("parts")} />
    <Chip label={t("Accessory fits", "تركيب الإكسسوارات")} on={mode === "fits"} onPress={() => setMode("fits")} />
    <Chip label={t("Zones (fallback)", "المناطق (بديل)")} on={mode === "zones"} onPress={() => setMode("zones")} />
  </View>;
}

// ---------------- part-map editor ----------------
const PART_LABEL_NAMES: Record<PartLabel, [string, string]> = {
  FRONT_BUMPER: ["Front bumper", "المصد الأمامي"], REAR_BUMPER: ["Rear bumper", "المصد الخلفي"], SPOILER: ["Spoiler", "السبويلر"], SIDE_SKIRTS: ["Side skirts", "التنانير الجانبية"],
  MIRRORS: ["Mirrors", "المرايا"], WHEELS: ["Wheels", "العجلات"], ROOF_RAILS: ["Roof rails", "قضبان السقف"],
};
/** Same colours as the viewer (sceneHtml PART_COLORS). */
const PART_LABEL_COLORS: Record<PartLabel, string> = { FRONT_BUMPER: "#1e88e5", REAR_BUMPER: "#8e24aa", SPOILER: "#e53935", SIDE_SKIRTS: "#fb8c00", MIRRORS: "#00acc1", WHEELS: "#43a047", ROOF_RAILS: "#c0a000" };
const USED_BY: Record<PartLabel, [string, string]> = {
  FRONT_BUMPER: ["front bumper (a front lip only takes its position)", "المصد الأمامي (الشفة الأمامية تأخذ موضعه فقط)"], REAR_BUMPER: ["rear bumper (a diffuser only takes its position)", "المصد الخلفي (الناشر يأخذ موضعه فقط)"],
  SPOILER: ["wing / spoiler", "الجناح / السبويلر"], SIDE_SKIRTS: ["side skirts", "التنانير الجانبية"], MIRRORS: ["mirror covers", "أغطية المرايا"],
  WHEELS: ["rims (tyre-named pieces stay)", "الجنوط (تبقى القطع المسماة إطارًا)"], ROOF_RAILS: ["roof rack", "حامل السقف"],
};
const fromProposal = (d: PartMapDetail): PartMap => d.map ?? Object.fromEntries(Object.entries(d.proposal ?? {}).map(([k, v]) => [k, v!.ids]));
function PartMapEditor({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  const { t } = useL(); const { g, row, align } = useGarageTheme();
  const list = useLoad(() => adminAccessoryApi.partMaps(), []);
  const { busy, error, work } = useWork();
  const {model3dKey, key:routeKey,label:requestedLabel,requestId}=useLocalSearchParams<{model3dKey?:string;key?:string;label?:string;requestId?:string}>();const requestedKey=model3dKey??routeKey;
  const [key, setKey] = useState<string | null>(requestedKey??null), [label, setLabel] = useState<PartLabel>(PART_LABELS.includes(requestedLabel as PartLabel)?requestedLabel as PartLabel:"SPOILER");
  const [detail, setDetail] = useState<PartMapDetail | null>(null), [draft, setDraft] = useState<PartMap>({}), [pieces, setPieces] = useState<number | null>(null);
  const car = detail?.viewerConfig ?? null;
  const assetLoader = useMemo(() => key ? () => adminAccessoryApi.partMapAsset(key) : undefined, [key]);
  useEffect(() => { setDetail(null); setPieces(null); if (key) void work(async () => { const d = await adminAccessoryApi.partMap(key); setDetail(d); setDraft(fromProposal(d)); }); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  // a tap: the piece joins the chosen label (and leaves any other), or leaves it when it was already there
  const pick = (id: string) => setDraft(d => {
    const was = (d[label] ?? []).includes(id), next: PartMap = {};
    for (const L of PART_LABELS) { const ids = (d[L] ?? []).filter(x => x !== id); if (L === label && !was) ids.push(id); if (ids.length) next[L] = ids; }
    return next;
  });
  // box mode: 4 taps on the car make a box; "add / remove pieces inside" changes this label; each box can be undone
  const [boxMode, setBoxMode] = useState(false), [pts, setPts] = useState<number[][]>([]), [inside, setInside] = useState<string[] | null>(null), [undo, setUndo] = useState<PartMap[]>([]);
  useEffect(() => { setPts([]); setInside(null); setUndo([]); }, [key]);
  const addPt = (p: number[]) => { setInside(null); setPts(a => a.length >= 4 ? [p] : [...a, p]); };
  const applyBox = (add: boolean) => { if (!inside) return; const ids = new Set(inside); setUndo(u => [...u.slice(-19), draft]); setDraft(d => {
    const next: PartMap = {};
    for (const L of PART_LABELS) { let l = d[L] ?? []; if (add || L === label) l = l.filter(x => !ids.has(x)); if (add && L === label) l = [...l, ...inside]; if (l.length) next[L] = l; }
    return next;
  }); setPts([]); setInside(null); };
  const partEdit = useMemo(() => ({ label, labels: draft, boxPts: boxMode ? pts : null }), [label, draft, boxMode, pts]);
  const changed = !!detail && JSON.stringify(draft) !== JSON.stringify(detail.map ?? null);
  const confirmed = (list.data ?? []).filter(m => m.status === "confirmed").length;
  const statusText = (st: string) => st === "confirmed" ? t("Confirmed: used for customers", "مؤكدة: تُستخدم للعملاء") : st === "proposed" ? t("Proposed: not used yet (zones until confirmed)", "مقترحة: غير مستخدمة بعد (المناطق حتى التأكيد)")
    : st === "single" ? t("One piece (AI / scan model): accessories use the zone cut", "قطعة واحدة (نموذج ذكاء اصطناعي / مسح): تستخدم الإكسسوارات قص المناطق")
    : st === "stale" ? t("The model file changed: splitting again…", "تغيّر ملف النموذج: جارٍ التقسيم من جديد…") : t("Splitting into parts… pull to refresh", "جارٍ التقسيم إلى قطع… اسحب للتحديث");
  const usable = detail?.status === "proposed" || detail?.status === "confirmed";
  return <GaragePage hero={<GarageHero variant="detail" backLabel={t("Back", "رجوع")} onBack={() => router.back()} title={t("Car part maps", "خرائط قطع السيارات")} line={t("Which pieces of each car an accessory replaces. Only confirmed maps reach customers.", "أي قطع من كل سيارة يستبدلها الإكسسوار. تصل الخرائط المؤكدة فقط إلى العملاء.")} />}
    onRefresh={() => void list.reload()} refreshing={list.loading && !!list.data}>
    <View style={{ gap: 14 }}>
      <ModeSwitch mode={mode} setMode={setMode} />
      {requestId?<GButton variant="secondary" label={t("Return to 3D request","العودة إلى طلب النموذج")} onPress={()=>router.replace(`/dept/accessory3d/${encodeURIComponent(requestId)}` as Href)}/>:null}
      {list.error ? <Note tone="danger">{list.error}</Note> : null}
      {list.data ? <GText soft style={[gType.caption, align]}>{`${t("Confirmed", "مؤكدة")}: ${confirmed} / ${list.data.length} · ${t("To confirm", "بانتظار التأكيد")}: ${list.data.length - confirmed}`}</GText> : null}
      <View style={[row, { flexWrap: "wrap", gap: 8 }]}>{(list.data ?? []).map(m => <Chip key={m.key} label={m.name} on={key === m.key} icon={m.status === "confirmed" ? "checkmark-circle" : undefined} onPress={() => setKey(m.key)} />)}</View>
      {key && detail ? <Card>
        <StatusChip label={statusText(detail.status)} tone={detail.status === "confirmed" ? "success" : detail.status === "proposed" ? "warning" : "neutral"} />
        <View style={{ marginTop: 8 }}><GateSummary gate={(list.data ?? []).find(m => m.key === key)?.gate} /></View>
        {usable ? <>
          <View style={[row, { flexWrap: "wrap", gap: 8, marginTop: 12 }]}>{PART_LABELS.map(L => {
            const p = detail.proposal?.[L];
            return <Chip key={L} label={`${t(...PART_LABEL_NAMES[L])} · ${draft[L]?.length ?? 0}${p ? ` (${Math.round(p.confidence * 100)}%)` : ""}`} on={label === L} onPress={() => setLabel(L)} />;
          })}</View>
          <View style={{ marginTop: 12, gap: 8 }}>
            {car ? <Car3DView model={car} assetLoader={assetLoader} color="#c3c7cc" bg={g.cardSoft} partEdit={partEdit} onPick={pick} onPieces={setPieces} onBoxPoint={addPt} onBoxIds={setInside} interactive style={{ height: 320, borderRadius: 16 }} />
              : <Note>{t("This car's 3D model is not in the app catalog yet.", "نموذج هذه السيارة غير موجود في كتالوج التطبيق بعد.")}</Note>}
            <View style={[row, { gap: 8 }]}>
              <Chip label={t("Tap pieces", "اختيار بالضغط")} on={!boxMode} onPress={() => { setBoxMode(false); setPts([]); setInside(null); }} />
              <Chip label={t("Box", "مربع تحديد")} on={boxMode} onPress={() => setBoxMode(true)} />
            </View>
            {boxMode ? <View style={{ gap: 8 }}>
              <Note>{pts.length < 4 ? `${t(`Tap 4 corners around the ${t(...PART_LABEL_NAMES[label]).toLowerCase()}`, `اضغط على 4 زوايا حول ${t(...PART_LABEL_NAMES[label])}`)} (${pts.length}/4). ${t("Turn the car between taps so the box also reaches the ends near the wheels.", "أدر السيارة بين الضغطات ليصل المربع أيضًا إلى الأطراف قرب العجلات.")}`
                : `${t("Pieces inside the box", "القطع داخل المربع")}: ${inside?.length ?? "…"}. ${t("Tap again to start a new box.", "اضغط مجددًا لبدء مربع جديد.")}`}</Note>
              <View style={[row, { gap: 10, flexWrap: "wrap" }]}>
                <GButton flex label={t("Add pieces inside", "إضافة القطع داخل المربع")} disabled={busy || !inside?.length} onPress={() => applyBox(true)} />
                <GButton flex variant="secondary" label={t("Remove pieces inside", "إزالة القطع داخل المربع")} disabled={busy || !inside?.length} onPress={() => applyBox(false)} />
              </View>
              <View style={[row, { gap: 10, flexWrap: "wrap" }]}>
                <GButton flex variant="secondary" label={t("Clear the points", "مسح النقاط")} disabled={!pts.length} onPress={() => { setPts([]); setInside(null); }} />
                <GButton flex variant="secondary" label={t("Undo the last box", "التراجع عن آخر مربع")} disabled={!undo.length} onPress={() => { setDraft(undo[undo.length - 1]!); setUndo(u => u.slice(0, -1)); }} />
              </View>
            </View> : null}
            <Swatch color={PART_LABEL_COLORS[label]} label={`${t(...PART_LABEL_NAMES[label])}: ${boxMode ? t("pieces fully inside the box", "القطع الموجودة كليًا داخل المربع") : t("tap a piece to add or remove it", "اضغط على قطعة لإضافتها أو إزالتها")} · ${t("used by the", "يستخدمها")} ${t(...USED_BY[label])}`} />
            <GText soft style={[gType.caption, align]}>{`${t("Other labels are dimmed, grey = not mapped", "التسميات الأخرى باهتة، الرمادي = غير محدد")} · ${pieces ?? detail.pieces} ${t("pieces", "قطعة")}`}</GText>
            {detail.proposal?.[label] ? <GText soft style={[gType.caption, align]}>{`${t("Proposal", "الاقتراح")}: ${detail.proposal[label]!.ids.length} ${t("pieces", "قطعة")} · ${Math.round(detail.proposal[label]!.confidence * 100)}% · ${detail.proposal[label]!.by === "name+shape" ? t("name and shape", "الاسم والشكل") : t("shape only", "الشكل فقط")}`}</GText>
              : <GText soft style={[gType.caption, align]}>{t("No proposal for this label: tap the pieces, or leave it empty (the zone cut is used).", "لا يوجد اقتراح لهذه التسمية: اضغط على القطع، أو اتركها فارغة (يُستخدم قص المناطق).")}</GText>}
          </View>
          <View style={[row, { gap: 10, marginTop: 12, flexWrap: "wrap" }]}>
            <GButton flex label={t("Confirm part map", "تأكيد خريطة القطع")} disabled={busy || !detail.modelSha256 || (detail.status === "confirmed" && !changed)}
              onPress={() => void work(async () => { setDetail({ ...detail, ...await adminAccessoryApi.confirmPartMap(detail.key, detail.modelSha256!, draft) }); }, list.reload)} />
            <GButton flex variant="secondary" label={t("Clear this label", "مسح هذه التسمية")} disabled={busy || !draft[label]?.length} onPress={() => setDraft(d => { const n = { ...d }; delete n[label]; return n; })} />
          </View>
          <View style={{ gap: 8, marginTop: 8 }}>
            <GButton variant="secondary" label={t("Back to the proposal", "العودة إلى الاقتراح")} disabled={busy} onPress={() => setDraft(Object.fromEntries(Object.entries(detail.proposal ?? {}).map(([k, v]) => [k, v!.ids])))} />
            {detail.status === "confirmed" ? <GButton variant="secondary" label={t("Unconfirm (use zones)", "إلغاء التأكيد (استخدام المناطق)")} disabled={busy}
              onPress={() => void work(async () => { setDetail({ ...detail, ...await adminAccessoryApi.confirmPartMap(detail.key, detail.modelSha256!, null) }); }, list.reload)} /> : null}
          </View>
        </> : null}
        <View style={{ marginTop: 8 }}><GButton variant="secondary" label={t("Split into parts again", "التقسيم إلى قطع من جديد")} disabled={busy}
          onPress={() => void work(async () => { const d = await adminAccessoryApi.segment(detail.key); setDetail(d); setDraft(fromProposal(d)); }, list.reload)} /></View>
      </Card> : key ? <Note>{busy ? t("Loading…", "جارٍ التحميل…") : t("Could not load this car's part map.", "تعذّر تحميل خريطة قطع هذه السيارة.")}</Note> : <Note>{t("Choose a car model.", "اختر طراز سيارة.")}</Note>}
      {error ? <Note tone="danger">{error}</Note> : null}
    </View>
  </GaragePage>;
}

// ---------------- accessory auto-fits ----------------
// Admin correction rows (same bounds as the customer's Adjust: ±0.5 m, ±0.8 rad, 80–125 %)
const FIT_NUDGE: [string, string, keyof FitAdjust, number, number][] = [
  ["Left / right", "يسار / يمين", "x", 0.01, 0.5], ["Up / down", "أعلى / أسفل", "y", 0.005, 0.5], ["Back / forward", "خلف / أمام", "z", 0.01, 0.5],
  ["Tilt", "إمالة", "rx", 0.01, 0.8], ["Size", "الحجم", "s", 0.01, 0],
];
const fitBound = (f: keyof FitAdjust, v: number, lim: number) => Math.round((f === "s" ? Math.min(1.25, Math.max(0.8, v)) : Math.min(lim, Math.max(-lim, v))) * 1000) / 1000;
const WHEEL_NAMES: Record<string, [string, string]> = { FL: ["Front left", "أمامي يسار"], FR: ["Front right", "أمامي يمين"], RL: ["Rear left", "خلفي يسار"], RR: ["Rear right", "خلفي يمين"] };
/** Why an automatic wheel move stopped short (viewer fit warnings), in words. */
const RIM_NOTES: Record<string, [string, string]> = { // in this order
  ADMIN_OVERRIDE: ["your override", "تعديلك اليدوي"], KEPT_STOCK_POSITION: ["no safe move, kept in place", "لا توجد حركة آمنة، بقيت مكانها"],
  LIMITED_BY_CLEARANCE: ["stopped before touching the car", "توقفت قبل ملامسة السيارة"], MOVE_CLAMPED_40MM: ["moved the 40 mm maximum", "حُرّكت بالحد الأقصى 40 مم"],
  ARCH_NOT_MEASURED: ["fender not measured, kept in place", "تعذّر قياس الرفرف، بقيت مكانها"],
};
const BODY_NAMES: Record<string, [string, string]> = { sedan: ["boot lid", "غطاء الصندوق"], hatch: ["top of the tailgate", "أعلى الباب الخلفي"], roof: ["roof", "السقف"] };
function AutoFitEditor({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  const { t } = useL(); const { g, row, align } = useGarageTheme();
  const models = useLoad(() => adminAccessoryApi.partMaps(), []);
  const { busy, error, work } = useWork();
  const params=useLocalSearchParams<{key?:string;accessoryId?:string;generationId?:string;requestId?:string}>();
  const [key, setKey] = useState<string | null>(params.key??null), [sel, setSel] = useState<string | null>(params.accessoryId&&params.generationId?`${params.accessoryId}|${params.generationId}`:null), [adj, setAdj] = useState<FitAdjust>(NO_ADJUST);
  const [viewerFitError,setViewerFitError]=useState<string|null>(null), [fitReviewed,setFitReviewed]=useState(false);
  const fits = useLoad(() => key ? adminAccessoryApi.autoFits(key) : Promise.resolve([]), [key]);
  const car = useCatalogModelKey(key);
  const rowKey = (r: AutoFitRow) => `${r.accessoryId}|${r.generation.id}`;
  const r = (fits.data ?? []).find(x => rowKey(x) === sel) ?? null;
  useEffect(()=>{setViewerFitError(null);setFitReviewed(false);},[sel,r?.modelRevision,r?.fit?.approvedAt,adj]);
  useEffect(() => { setAdj(r?.fit?.adj ?? NO_ADJUST); }, [sel, r?.fit?.approvedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  // fits are computed in the background: look again while any is still computing
  useEffect(() => { if (!(fits.data ?? []).some(x => x.computing)) return; const id = setTimeout(() => void fits.reload(), 6000); return () => clearTimeout(id); }, [fits.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const info = (r?.fit?.fit.info ?? {}) as { body?: string; mount?: { body?: string; widthM?: number; bodyWidthM?: number; scaleBy?: string }; feetGapMm?: (number | null)[]; topGapMm?: (number | null)[]; spanM?: number; heightAboveM?: number; pitchDeg?: number };
  const failed = r?.fit?.fit.failed ?? null;
  // rims: each wheel is placed automatically (tyre face just inside the fender); a Parts Admin inset per axle (the car's RIMS zone, all rim
  // products on this car) overrides it; a draft is previewed live before it is saved
  const wheels = ((info as { wheels?: { wheel: string; archGapBeforeMm: number | null; archGapAfterMm: number | null; warnings?: string[] }[] }).wheels ?? []);
  const savedInset = car?.zones?.RIMS?.wheelInsetMm ?? { front: 0, rear: 0 }, hasOverride = !!car?.zones?.RIMS?.wheelInsetMm;
  // no signed numbers in the text (a minus flips in Arabic): "24 mm outside" / "6 mm inside"
  const mmText = (v: number | null) => `${v === null ? "—" : Math.abs(v)} ${t("mm", "مم")}`;
  const clearText = (v: number | null) => v === null ? "—" : v < 0 ? `${mmText(v)} ${t("outside", "للخارج")}` : `${mmText(v)} ${t("inside", "للداخل")}`;
  const [inset, setInset] = useState<{ front: number; rear: number } | null>(null);
  useEffect(() => { setInset(null); }, [key]);
  const draft = inset && (inset.front !== savedInset.front || inset.rear !== savedInset.rear) ? inset : null;
  const previewCar = useMemo(() => car && draft ? { ...car, zones: { ...(car.zones ?? {}), RIMS: { ...(car.zones?.RIMS ?? {}), wheelInsetMm: draft } } } : car, [car, draft]);
  const saveInset = (v: { front: number; rear: number }) => work(async () => {
    const { wheelInsetMm: _old, ...rest } = car?.zones?.RIMS ?? {}; // eslint-disable-line @typescript-eslint/no-unused-vars
    const zone = v.front || v.rear ? { ...rest, wheelInsetMm: v } : Object.keys(rest).length ? rest : null;
    await adminAccessoryApi.setZone(key!, "RIMS", zone);
  }, async () => { setInset(null); await Promise.all([fits.reload(), refreshRuntimeModels()]); });
  const kit = useMemo(() => r?.hasModel && r.fit && !r.fit.fit.failed ? { type: r.type, file: r.file??`private-accessory-${r.accessoryId}-${r.modelRevision}.glb`, assetLoader:r.file?undefined:()=>adminAccessoryApi.asset(r.accessoryId,"model"), size: r.size, finish: r.finish ?? null, paintMatch: false, adj: NO_ADJUST, fit: draft ? undefined : r.fit.fit, baseAdj: adj } : null, [r, adj, draft]);
  const gaps = (info.feetGapMm ?? info.topGapMm ?? []).map(x => x === null ? "—" : `${x} mm`).join(" / ");
  return <GaragePage hero={<GarageHero variant="detail" backLabel={t("Back", "رجوع")} onBack={() => router.back()} title={t("Accessory fits", "تركيب الإكسسوارات")} line={t("Each accessory is fitted to each car once, from the car's real shape. Check it, correct it if needed, approve.", "تُركّب كل قطعة على كل سيارة مرة واحدة، من شكل السيارة الحقيقي. افحصها وصحّحها إن لزم ثم اعتمدها.")} />}
    onRefresh={() => { void models.reload(); void fits.reload(); }} refreshing={(models.loading && !!models.data) || (fits.loading && !!fits.data)}>
    <View style={{ gap: 14 }}>
      <ModeSwitch mode={mode} setMode={setMode} />
      {params.requestId?<GButton variant="secondary" label={t("Return to 3D request","العودة إلى طلب النموذج")} onPress={()=>router.replace(`/dept/accessory3d/${encodeURIComponent(params.requestId!)}` as Href)}/>:null}
      {models.error ? <Note tone="danger">{models.error}</Note> : null}
      <View style={[row, { flexWrap: "wrap", gap: 8 }]}>{(models.data ?? []).map(m => <Chip key={m.key} label={m.name} on={key === m.key} onPress={() => { setKey(m.key); setSel(null); }} />)}</View>
      {key ? <Card>
        {fits.error ? <Note tone="danger">{fits.error}</Note> : null}
        {fits.data && !fits.data.length ? <Note>{t("No generated accessory is available for this vehicle.", "لا توجد قطعة مُنشأة متاحة لهذه السيارة.")}</Note> : null}
        <View style={[row, { flexWrap: "wrap", gap: 8 }]}>{(fits.data ?? []).map(x => <Chip key={rowKey(x)} label={`${x.productName} · ${t(...ACCESSORY_TYPE_LABELS[x.type])}`} on={sel === rowKey(x)}
          icon={x.fit?.approvedAt ? "checkmark-circle" : undefined} onPress={() => setSel(rowKey(x))} />)}</View>
        {r ? <View style={{ marginTop: 12, gap: 8 }}>
          <StatusChip label={r.computing ? t("Computing the fit…", "جارٍ حساب التركيب…") : failed ? t("Does not fit this car", "لا تناسب هذه السيارة") : r.fit?.approvedAt ? t("Approved", "معتمد") : r.fit?.fit.needsCorrection?t("Needs correction","يحتاج إلى تصحيح"):r.fit?t("Auto-fit, not reviewed yet", "تركيب تلقائي، لم يُراجع بعد"):t("Fit not run","لم يُنفّذ التركيب")} tone={failed ? "danger" : r.fit?.approvedAt ? "success" : "warning"} />
          {failed ? <Note tone="danger">{`${t("Customers with this car get \"3D preview not available\" for this part. Reason", "يرى العملاء الذين يملكون هذه السيارة «المعاينة غير متاحة» لهذه القطعة. السبب")}: ${failed}`}</Note> : null}
          <GText soft style={[gType.caption, align]}>{r.generation.name}</GText>
          {r.fit && !failed ? <GText style={[gType.bodySm, align]}>{[
            info.mount?.body ? `${t("On the", "على")} ${t(...(BODY_NAMES[info.mount.body] ?? ["body", "الهيكل"]))}` : null,
            info.spanM ? `${t("width", "العرض")} ${info.spanM} m / ${t("mount", "سطح التركيب")} ${info.mount?.widthM ?? "—"} m / ${t("body", "الهيكل")} ${info.mount?.bodyWidthM ?? "—"} m` : null,
            info.heightAboveM ? `${t("height", "الارتفاع")} ${info.heightAboveM} m` : null,
            gaps ? `${t("gap at each foot", "الفراغ عند كل قدم")}: ${gaps}` : null,
            info.pitchDeg !== undefined ? `${t("tilt", "الميل")} ${info.pitchDeg}°` : null,
          ].filter(Boolean).join(" · ")}</GText> : null}
          {kit && previewCar ? <Car3DView model={previewCar} color="#8b9baa" bg={g.cardSoft} kit={kit} onFitError={message=>setViewerFitError(message)} interactive style={{ height: 300, borderRadius: 16 }} /> : null}
          {viewerFitError?<Note tone="danger">{viewerFitError}</Note>:null}
          <GButton variant="secondary" label={t("Rerun automatic fit","إعادة تشغيل التركيب التلقائي")} disabled={busy||r.computing} onPress={()=>void work(()=>adminAccessoryApi.act(r.accessoryId,"refit"),fits.reload)}/>
          {r.type === "RIMS" && r.fit && !failed ? <View style={{ gap: 6, paddingVertical: 4 }}>
            <GText style={[gType.label, { fontWeight: "800" }, align]}>{t("Wheel position (automatic)", "موضع العجلات (تلقائي)")}</GText>
            <GText soft style={[gType.tiny, align]}>{t("Each wheel moves along its own axle so the tyre sits just inside the fender (at most 40 mm, never into the brakes or the car). Tyre face vs fender:", "تتحرك كل عجلة على محورها ليستقر الإطار داخل الرفرف مباشرة (40 مم كحد أقصى، دون ملامسة الفرامل أو السيارة). وجه الإطار مقابل الرفرف:")}</GText>
            {wheels.map(w => { const notes = Object.keys(RIM_NOTES).filter(k => (w.warnings ?? []).includes(k)).map(k => t(...RIM_NOTES[k]!)); return <GText key={w.wheel} soft style={[gType.caption, align]}>
              {[`${t(...WHEEL_NAMES[w.wheel] ?? [w.wheel, w.wheel])}: ${t("before", "قبل")} ${clearText(w.archGapBeforeMm)}`, `${t("after", "بعد")} ${clearText(w.archGapAfterMm)}`, ...notes].join(" · ")}</GText>; })}
            <GText style={[gType.label, align]}>{t("Override (mm inward, this car, all rims)", "تعديل يدوي (مم للداخل، هذه السيارة، كل الجنوط)")}</GText>
            {(["front", "rear"] as const).map(ax => { const v = (inset ?? savedInset)[ax]; return <View key={ax} style={[row, { alignItems: "center", gap: 8 }]}>
              <GText style={[gType.label, align, { flex: 1 }]}>{ax === "front" ? t("Front axle (mm)", "المحور الأمامي (مم)") : t("Rear axle (mm)", "المحور الخلفي (مم)")}</GText>
              <GButton variant="secondary" label="−" onPress={() => setInset({ ...(inset ?? savedInset), [ax]: Math.max(0, v - 1) })} />
              <GText soft style={[gType.tiny, { width: 40, textAlign: "center", writingDirection: "ltr" }]}>{String(v)}</GText>
              <GButton variant="secondary" label="+" onPress={() => setInset({ ...(inset ?? savedInset), [ax]: Math.min(40, v + 1) })} />
            </View>; })}
            <View style={[row, { flexWrap: "wrap", gap: 8 }]}>
              <GButton label={t("Save override", "حفظ التعديل")} disabled={busy || !draft || (!draft.front && !draft.rear)} onPress={() => void saveInset(draft!)} />
              <GButton variant="secondary" label={t("Back to automatic", "العودة إلى التلقائي")} disabled={busy || !hasOverride} onPress={() => void saveInset({ front: 0, rear: 0 })} />
            </View>
            {draft ? <Note>{t("Preview of the draft override: save it to refit every rim on this car.", "معاينة التعديل المقترح: احفظه لإعادة تركيب كل الجنوط على هذه السيارة.")}</Note> : hasOverride ? <Note>{t("This car uses your override instead of the automatic position.", "تستخدم هذه السيارة تعديلك بدلاً من الموضع التلقائي.")}</Note> : null}
          </View> : null}
          {r.fit && !failed ? <View style={{ gap: 6 }}>
            {FIT_NUDGE.map(([en, ar, f, step, lim]) => <View key={f} style={[row, { alignItems: "center", gap: 8 }]}>
              <GText style={[gType.label, align, { flex: 1 }]}>{t(en, ar)}</GText>
              <GButton variant="secondary" label="−" onPress={() => setAdj(a => ({ ...a, [f]: fitBound(f, a[f] - step, lim) }))} />
              <GText soft style={[gType.tiny, { width: 48, textAlign: "center", writingDirection: "ltr" }]}>{adj[f].toFixed(3)}</GText>
              <GButton variant="secondary" label="+" onPress={() => setAdj(a => ({ ...a, [f]: fitBound(f, a[f] + step, lim) }))} />
            </View>)}
            <Check checked={fitReviewed} disabled={busy||!!viewerFitError||!kit||!previewCar} onPress={()=>setFitReviewed(v=>!v)} label={t("I reviewed the generated part on this vehicle.","راجعت القطعة المُنشأة على هذه السيارة.")}/>
            <GButton label={t("Approve fit", "اعتماد التركيب")} disabled={busy||r.computing||!fitReviewed||!!viewerFitError||!kit||!previewCar} onPress={() => void work(async()=>{await adminAccessoryApi.approveFit(r.accessoryId, r.generation.id, JSON.stringify(adj) === JSON.stringify(NO_ADJUST) ? null : adj);await adminAccessoryApi.act(r.accessoryId,"preview",{generationId:r.generation.id});}, fits.reload)} />
            <GButton variant="secondary" label={t("Needs correction","يحتاج إلى تصحيح")} disabled={busy} onPress={()=>void work(()=>adminAccessoryApi.needsCorrection(r.accessoryId,r.generation.id),fits.reload)}/>
            <GButton variant="secondary" label={t("Reset to auto-fit", "العودة إلى التركيب التلقائي")} disabled={busy} onPress={() => setAdj(NO_ADJUST)} />
          </View> : null}
        </View> : null}
      </Card> : <Note>{t("Choose a car model.", "اختر طراز سيارة.")}</Note>}
      {error ? <Note tone="danger">{error}</Note> : null}
    </View>
  </GaragePage>;
}

// ---------------- zone editor (fallback) ----------------
function ZoneEditor({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  const { t } = useL(); const { g, row, align } = useGarageTheme();

  const list = useLoad(() => adminAccessoryApi.zones(), []);
  const { busy, error, work } = useWork();
  const params=useLocalSearchParams<{key?:string}>();
  const [key, setKey] = useState<string | null>(params.key??null), [type, setType] = useState<AccessoryType>("FRONT_BUMPER");
  const [fit, setFit] = useState<string[]>([]), [fitOn, setFitOn] = useState(false), [rep, setRep] = useState<string[]>([]), [repOn, setRepOn] = useState(false);
  const [zoneInfo, setZoneInfo] = useState<{ hidden: number; how: string | null; note: string | null } | null>(null);
  const model = list.data?.find(m => m.key === key) ?? null;
  const car = useCatalogModelKey(key);
  const current = model ? model.zones[type] ?? model.fileZones[type] ?? null : null;
  const replaces = REPLACES_STOCK.includes(type), bodyKit = type === "FRONT_BUMPER" || type === "REAR_BUMPER" || type === "SIDE_SKIRTS";
  const fixedBox = !!DEFAULT_BOX[type] || bodyKit; // these always have a fit box (default or computed)
  const source = model?.zones[type] ? t("Admin-tuned", "مضبوطة من الإدارة") : model?.fileZones[type] ? t("From the model file", "من ملف النموذج") : DEFAULT_BOX[type] ? t("Default", "افتراضية") : t("Computed (wheels / roof / mirrors)", "محسوبة (العجلات / السقف / المرايا)");
  useEffect(() => { // the editor starts from the saved zone of this car + type
    const b = current?.box ?? DEFAULT_BOX[type];
    setFitOn(!!current?.box); setFit(toFields(b ?? { x: [0, 1], y: [0, .15], z: [.25, .75] }));
    setRepOn(!!current?.replace?.box); setRep(toFields(current?.replace?.box ?? REPLACE_START[type] ?? { x: [0, 1], y: [0, 1], z: [0, 1] }));
  }, [key, type, model]); // eslint-disable-line react-hooks/exhaustive-deps
  const fitBox = toBox(fit), repBox = toBox(rep);
  const valid = (!fitOn || !!fitBox) && (!repOn || !!repBox);
  const draft: AccessoryZone | null = useMemo(() => {
    if (!valid) return null;
    const z: AccessoryZone = {};
    if (fitOn && fitBox) z.box = fitBox;
    if (current?.meshes) z.meshes = current.meshes;
    const keepMeshes = current?.replace?.meshes;
    if (replaces && ((repOn && repBox) || keepMeshes)) z.replace = { ...(repOn && repBox ? { box: repBox } : {}), ...(keepMeshes ? { meshes: keepMeshes } : {}) };
    return z.box || z.meshes || z.replace ? z : null;
  }, [valid, fitOn, fit.join(), repOn, rep.join(), current, replaces]); // eslint-disable-line react-hooks/exhaustive-deps
  // the preview follows the draft, debounced (each change rebuilds the car's cut zones)
  const draftKey = JSON.stringify(draft);
  const [shown, setShown] = useState<AccessoryZone | null>(null);
  useEffect(() => { const id = setTimeout(() => setShown(draftKey === "null" ? null : JSON.parse(draftKey)), 500); return () => clearTimeout(id); }, [draftKey]);
  const previewModel = useMemo(() => {
    if (!car) return null;
    const zones = { ...(car.zones ?? {}) }; if (shown) zones[type] = shown; else delete zones[type];
    return { ...car, zones };
  }, [car, shown, type]);
  useEffect(() => { setZoneInfo(null); }, [previewModel]);
  const howLabel = (h: string | null) => h === "stock meshes" ? t("the model's own separate part", "القطعة المنفصلة في النموذج") : h === "separate meshes" ? t("separate parts", "أجزاء منفصلة") : h ? t("cut out of the body", "مقصوصة من الهيكل") : "";
  return <GaragePage hero={<GarageHero variant="detail" backLabel={t("Back", "رجوع")} onBack={() => router.back()} title={t("Fitting zones", "مناطق التركيب")} line={t("Fractions of the car's box. Saved zones reach the app without an update.", "نسب من صندوق السيارة. تصل المناطق المحفوظة للتطبيق دون تحديث.")} />}
    onRefresh={() => void list.reload()} refreshing={list.loading && !!list.data}>
    <View style={{ gap: 14 }}>
      <ModeSwitch mode={mode} setMode={setMode} />
      <Note>{t("Zones are used only for car models without a confirmed part map (or for labels the map leaves empty), and for one-piece AI / scanned models.", "تُستخدم المناطق فقط لطرازات السيارات التي ليس لها خريطة قطع مؤكدة (أو للتسميات الفارغة في الخريطة)، وللنماذج المكوّنة من قطعة واحدة.")}</Note>
      {list.error ? <Note tone="danger">{list.error}</Note> : null}
      <View style={[row, { flexWrap: "wrap", gap: 8 }]}>{(list.data ?? []).map(m => <Chip key={m.key} label={m.name} on={key === m.key} count={Object.keys(m.zones).length || undefined} onPress={() => setKey(m.key)} />)}</View>
      {model ? <Card>
        <View style={[row, { flexWrap: "wrap", gap: 8 }]}>{(Object.keys(ACCESSORY_TYPE_LABELS) as AccessoryType[]).map(k => <Chip key={k} label={t(...ACCESSORY_TYPE_LABELS[k])} on={type === k} onPress={() => setType(k)} />)}</View>

        <View style={{ marginTop: 12, gap: 8 }}>
          {previewModel ? <Car3DView model={previewModel} color="#c3c7cc" bg={g.cardSoft} zonePreview={type} onZone={setZoneInfo} interactive style={{ height: 300, borderRadius: 16 }} />
            : <Note>{t("This car's 3D model is not in the app catalog yet: no live preview.", "نموذج هذه السيارة غير موجود في كتالوج التطبيق بعد: لا توجد معاينة مباشرة.")}</Note>}
          <Swatch color="#e53935" label={t("Red: the car's own part, hidden while the accessory is on", "الأحمر: قطعة السيارة الأصلية، تُخفى أثناء تركيب الإكسسوار")} />
          <Swatch color="#2e9d4f" label={t("Green: where the accessory goes", "الأخضر: مكان تركيب الإكسسوار")} />
          {zoneInfo ? <GText soft style={[gType.caption, align]}>{(zoneInfo.hidden ? `${t("Hidden", "مخفي")}: ${zoneInfo.hidden} · ${howLabel(zoneInfo.how)}` : t("Nothing of the car is hidden for this type.", "لا يُخفى شيء من السيارة لهذا النوع.")) + (zoneInfo.note ? ` · ${zoneInfo.note}` : "")}</GText> : null}
        </View>

        <GText soft style={[gType.caption, align, { marginTop: 12 }]}>{`${t("Current", "الحالية")}: ${source}${current?.meshes ? ` · ${current.meshes.length} ${t("meshes", "أجزاء")}` : ""}`}</GText>
        <GText style={[gType.label, align, { marginTop: 10 }]}>{bodyKit ? t("Fit box (also what is hidden)", "صندوق التركيب (وهو أيضًا ما يُخفى)") : t("Where it goes", "مكان التركيب")}</GText>
        {fixedBox ? null : <Check label={t("Set the position with a box (else it is computed)", "حدّد المكان بصندوق (وإلا يُحسب تلقائيًا)")} checked={fitOn} onPress={() => setFitOn(v => !v)} />}
        {fitOn || fixedBox ? <BoxFields value={fit} onChange={v => { setFit(v); setFitOn(true); }} /> : null}
        {bodyKit ? <Note>{t("Bumpers / skirts: the car's own surface inside the box is hidden while the part is on, so keep it tight around the real part (an E36 front bumper: z 0.905–1, y 0–0.34).", "المصدات / التنانير: يُخفى سطح السيارة داخل الصندوق أثناء تركيب القطعة، فاجعله محكمًا حول القطعة الحقيقية (مصد E36 الأمامي: z 0.905–1، y 0–0.34).")}</Note> : null}

        {replaces ? <View style={{ marginTop: 12 }}>
          <GText style={[gType.label, align]}>{t("Car's own part to hide", "قطعة السيارة الأصلية المراد إخفاؤها")}</GText>
          <Check label={t("Cut it out with a box (when the model has no separate part)", "قصّها بصندوق (إذا لم تكن قطعة منفصلة في النموذج)")} checked={repOn} onPress={() => setRepOn(v => !v)} />
          {repOn ? <BoxFields value={rep} onChange={setRep} /> : null}
          {current?.replace?.meshes ? <GText soft style={[gType.caption, align]}>{`${t("Also hidden by name", "يُخفى أيضًا بالاسم")}: ${current.replace.meshes.length}`}</GText> : null}
          <Note>{t("Keep the box just above the body surface: everything of the car inside it disappears while the accessory is on, and comes back when it is off.", "اجعل الصندوق فوق سطح الهيكل مباشرة: كل ما بداخله من السيارة يختفي أثناء تركيب الإكسسوار ويعود عند إزالته.")}</Note>
        </View> : null}

        <View style={[row, { gap: 10, marginTop: 12 }]}>
          {/* the RIMS wheel inset (Accessory fits tab) is kept when the box is saved / reset here */}
          <GButton flex label={t("Save zone", "حفظ المنطقة")} disabled={busy || !draft} onPress={() => void work(() => adminAccessoryApi.setZone(model.key, type, { ...draft, ...(model.zones[type]?.wheelInsetMm ? { wheelInsetMm: model.zones[type]!.wheelInsetMm } : {}) }), list.reload)} />
          <GButton flex variant="secondary" label={t("Reset", "إعادة الضبط")} disabled={busy || !model.zones[type]} onPress={() => void work(() => adminAccessoryApi.setZone(model.key, type, model.zones[type]?.wheelInsetMm ? { wheelInsetMm: model.zones[type]!.wheelInsetMm } : null), list.reload)} />
        </View>
      </Card> : <Note>{t("Choose a car model.", "اختر طراز سيارة.")}</Note>}
      {error ? <Note tone="danger">{error}</Note> : null}
    </View>
  </GaragePage>;
}
