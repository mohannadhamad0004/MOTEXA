// Feature 2 screens: the shop's "Submit for 3D" form, the Parts Admin review (/dept/accessory3d) and the zone editor
// (/dept/accessory-zones). Photos, generated models and previews are private: loaded with the session token into memory only.
import { type Href, router, useLocalSearchParams } from "expo-router";
import { photoErrorText, pickPhoto } from "../../core/hooks/pickPhoto";
import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Modal, Pressable, ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card, Chip, GButton, GText, Note, Rail, Section, SkeletonRows, StatusChip } from "../../components/garage";
import { ActionsSheet, type ItemAction } from "../../components/ItemActionsMenu";
import { ManageEntry, ManageHeader, ManagePage, ManageRow, useTwoPane } from "../../components/manage/ManagePage";
import { Page } from "../../components/manage/Page";
import { isoLatin } from "../../core/constants/bidi";
import { findCategory, labelOf } from "../../core/constants/categories";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { useVehicleList } from "../catalog/VehiclePicker";
import { vehicleCatalog } from "../vehicleCatalog/api";
import { gType, useGarageTheme } from "../../theme/garage";
import { PART_LABELS, type AccessoryType, type AccessoryZone, type PartLabel, type PartMap } from "../car3d/modelConfig";
import { Car3DView } from "../car3d/Car3DView";
import { refreshRuntimeModels, useCatalogModelKey } from "../car3d/runtimeModels";
import { normalizeNumberText } from "../../core/constants/numbers";
import { ACCESSORY_TYPE_LABELS, FIT_STATE_LABELS, type FitState, KIT_PART_TYPE, PREVIEW_VIEWS, REPLACES_STOCK, STATUS_LABELS, adminAccessoryApi, isBumper, shopAccessoryApi, sizeField, typesForCategory, type KitPart,
  type Accessory, type AccessoryStatus, type AutoFitRow, type PartMapDetail, type PartMapListItem, type Preview, type ZoneBox, RIM_FINISHES, RIM_FINISH_LABELS, type RimFinish } from "./api";
import { shapeSize } from "./partSize";
import { NO_ADJUST, type FitAdjust } from "../car3d/car3d";
import { GateSummary } from "./gate";
import { ThreeDRequestsList } from "../department/partsAdmin";
import {threeDError} from "../vehicleCatalog/lifecycleText";
import {accessoryProcessingLabel} from "./processing";
import { SupportWarning } from "./support";
import { ShopWizard } from "./ShopWizard";
import { WIZARD_TYPES, isWizardType } from "./wizardArt";
import { CorrectionPanel, SimilarSheet } from "./FitCorrection";
import { isCorrected, sameAdj } from "./correction";
import type { FitCheck } from "../car3d/useCar3D";

const tone = (s: AccessoryStatus) => s === "PUBLISHED" ? "success" : s === "REJECTED" ? "danger" : s === "DRAFT" ? "neutral" : s === "READY_FOR_FINAL_REVIEW" ? "accent" : "warning";
const VIEW_LABELS: Record<string, [string, string]> = { front: ["Front", "الأمام"], "front-three-quarter": ["Front 3/4", "أمام ٣/٤"], "left-side": ["Side", "الجانب"],
  "rear-three-quarter": ["Rear 3/4", "خلف ٣/٤"], rear: ["Rear", "الخلف"], "top-three-quarter": ["Above", "من الأعلى"] };

export const sizeLabel: Record<string, [string, string]> = { widthMm: ["Width across the car (mm)", "العرض على امتداد عرض السيارة (مم)"], lengthMm: ["Length along the car (mm)", "الطول على امتداد السيارة (مم)"],
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
export function PreviewGrid({ preview, load }: { preview: NonNullable<Preview>; load: (view: string) => () => Promise<string> }) {
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
export function PhotoStrip({ photos, load, onRemove, labels }: { photos: { id: string }[]; load: (id: string) => () => Promise<string>; onRemove?: (id: string) => void; labels?: (string | null)[] }) {
  const { t } = useL(); const { row } = useGarageTheme();
  return <View style={[row, { flexWrap: "wrap", gap: 8 }]}>
    {photos.map((p, i) => <View key={p.id} style={{ width: "31%", gap: 4 }}>
      <PrivateImage load={load(p.id)} label={p.id} height={90} />
      {onRemove ? <GButton variant="secondary" label={t("Remove", "حذف")} onPress={() => onRemove(p.id)} /> : <GText soft style={gType.tiny}>{labels?.[i] ?? `#${i + 1}`}</GText>}
    </View>)}
  </View>;
}
/** Resized + converted to JPEG by the shared picker; failures say which step failed, in the current language. */
async function pickJpeg(t: (en: string, ar: string) => string) {
  try { return (await pickPhoto())?.base64 ?? null; } catch (e) { throw new Error(photoErrorText(e, t)); }
}
function StatusCard({ a, admin, product }: { a: Accessory; admin?: boolean; product?: { category: string | null } | null }) {
  const { t, isArabic } = useL(); const { align } = useGarageTheme();
  const processing=accessoryProcessingLabel(a);
  const label=processing?t(...processing):a.lifecycleState==="FAILED"?t("Generation failed","تعذّر الإنشاء"):a.deactivatedAt?t("Unpublished","غير منشور"):a.lifecycleState==="GENERATION_QUEUED"?t("Generation queued","الإنشاء في قائمة الانتظار"):t(...STATUS_LABELS[a.status]);
  return <Card>
    <View style={{ alignItems: "flex-start", gap: 8 }}>
      <StatusChip tone={tone(a.status)} label={label} icon="cube-outline" />
      <GText style={[gType.title, align]}>{t(...ACCESSORY_TYPE_LABELS[a.accessoryType])}</GText>
      {product ? <GText soft style={[gType.caption, align]}>{`${t("Product category", "فئة المنتج")}: ${labelOf(findCategory(product.category), isArabic) || product.category || t("none", "بلا فئة")}`}</GText> : null}
    </View>
    {product && !typesForCategory(product.category).includes(a.accessoryType) ? <View style={{ marginTop: 10 }}><Note tone="warning" icon="alert-circle-outline">{t(
      `The product's category does not match a ${t(...ACCESSORY_TYPE_LABELS[a.accessoryType]).toLowerCase()}: check that the shop picked the right product.`,
      `فئة المنتج لا تطابق ${ACCESSORY_TYPE_LABELS[a.accessoryType][1]}: تأكد أن المتجر اختار المنتج الصحيح.`)}</Note></View> : null}
    {a.status === "GENERATING"&&!processing ? <GText style={[align, { marginTop: 8 }]}>{`${a.generationStage}${a.providerProgress !== null ? ` · ${a.providerProgress}%` : ""}`}</GText> : null}
    {a.mock ? <View style={{ marginTop: 10 }}><Note>{t("Mock mode: a plain stand-in shape that tests the workflow. It is not your part and can never be published.", "الوضع التجريبي: شكل بديل بسيط لاختبار الخطوات، وليس قطعتك، ولا يمكن نشره أبدًا.")}</Note></View> : null}
    {a.reviewNotes ? <View style={{ marginTop: 10 }}><Note tone={a.status === "REJECTED" ? "danger" : "accent"}>{a.reviewNotes}</Note></View> : null}
    {a.failureReason ? <View style={{ marginTop: 10 }}><Note tone="warning">{a.generationErrorCode?threeDError({code:a.generationErrorCode,message:a.failureReason},t):t(a.failureReason,"تتطلب النتيجة مراجعة الإدارة. راجع حالة التركيب.")}</Note></View> : null}
    {a.providerState==="SUCCEEDED"&&a.failureReason?<GText selectable style={{textAlign:"left",writingDirection:"ltr",marginTop:8}}>{a.failureReason}</GText>:null}
  </Card>;
}

/** One section of the shop form: registered by id (so the problem list can scroll to it) and outlined in red while it has a problem. The outline sits in
 *  the margin, so nothing shifts. Defined at top level so typing in a field never remounts it. */
function SpotView({ id, spots, on, children }: { id: string; spots: { current: Record<string, View | null> }; on: boolean; children: React.ReactNode }) {
  const { g } = useGarageTheme();
  return <View ref={r => { spots.current[id] = r; }} collapsable={false} style={{ borderWidth: 2, borderColor: on ? g.danger : "transparent", borderRadius: 16, margin: -2 }}>{children}</View>;
}

// ---------------- shop ----------------
/** The 5-step wizard for a new request or an editable draft of a front / rear bumper, rear wing or rims (single part); the full form
 *  below for every other type, a body kit, and any request that is under review or later (its status, preview, "Edit and resubmit"). */
export function ShopAccessory3DScreen() {
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const { t } = useL();
  const probe = useLoad(() => shopAccessoryApi.get(productId), [productId]);
  if (!probe.data) return <Page title={t("Show it in 3D", "اعرضها ثلاثية الأبعاد")}>{probe.error ? <Note tone="danger">{probe.error}</Note> : <SkeletonRows count={5} />}</Page>;
  const d = probe.data, a = d.accessory;
  const wizard = d.eligible && !d.parts.some(x => x.part !== "MAIN") && WIZARD_TYPES.some(k => typesForCategory(d.category).includes(k))
    && (!a || ((a.status === "DRAFT" || a.status === "REJECTED") && isWizardType(a.accessoryType)));
  return wizard ? <ShopWizard productId={productId} onDone={() => void probe.reload()} /> : <ClassicShopAccessory3DScreen />;
}
function ClassicShopAccessory3DScreen() {
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

  // ONE primary per state: Create the request · Submit for 3D · Edit and resubmit; saving the details and deleting a draft are in ⋮
  const primary = !state.data?.eligible || !form ? null
    : editable && !a ? { label: t("Create 3D request", "إنشاء طلب ثلاثي الأبعاد"), icon: "add" as const, disabled: busy || !form.type, onPress: () => void save() }
    : editable ? { label: t("Submit for 3D", "إرسال لإنشاء ثلاثي الأبعاد"), icon: "cube-outline" as const, disabled: busy, onPress: () => void submit() }
    : a && a.status !== "GENERATING" ? { label: t("Edit and resubmit", "تعديل وإعادة الإرسال"), icon: "create-outline" as const, disabled: busy, onPress: () => void work(() => shopAccessoryApi.revise(productId, part), state.reload) }
    : null;
  const menu: ItemAction[] = [
    ...(editable && a ? [{ key: "save", label: t("Save details", "حفظ التفاصيل"), icon: "save-outline" as const, disabled: busy || !form?.type, run: () => save() ?? undefined }] : []),
    ...(a?.status === "DRAFT" ? [{ key: "delete", label: t("Delete 3D request", "حذف طلب ثلاثي الأبعاد"), icon: "trash-outline" as const, destructive: true, disabled: busy,
      confirm: { title: t("Delete this 3D request?", "حذف طلب ثلاثي الأبعاد هذا؟"), confirmLabel: t("Delete", "حذف") }, run: () => work(() => shopAccessoryApi.remove(productId, part), state.reload) }] : []),
  ];
  return <Page title={t("Show it in 3D", "اعرضها ثلاثية الأبعاد")} line={t("Customers see this part on their own car.", "يرى العملاء هذه القطعة على سياراتهم.")} actions={menu.length ? menu : undefined}
    scrollRef={scrollRef} onRefresh={() => void state.reload()} refreshing={state.loading && !!state.data}
    footer={primary ? <GButton icon={primary.icon} label={primary.label} busy={busy} disabled={primary.disabled} onPress={primary.onPress} /> : undefined}>
    <View style={{ gap: 14 }}>
      {state.error && !state.data ? <Note tone="danger">{state.error}</Note> : null}
      {!state.data ? <GText>{t("Loading…", "جارٍ التحميل…")}</GText> : !state.data.eligible ? (
        <Note>{t("3D preview isn't available for this kind of part yet. It works for Bumpers & body kits, Wings & spoilers and Wheels (rims).", "المعاينة ثلاثية الأبعاد غير متاحة لهذا النوع من القطع بعد. تعمل مع فئات المصدات وأطقم الهيكل، والأجنحة والسبويلرات، والجنوط.")}</Note>
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
          </Card> : null}
          {a.status === "PUBLISHED" ? <Note tone="warning">{t("Editing takes the 3D view off customers' cars until Parts Admin publishes it again.", "التعديل يُخفي العرض ثلاثي الأبعاد عن العملاء حتى تعيد إدارة القطع نشره.")}</Note> : null}
        </> : null}
        {busy ? <GText soft>{t("Working…", "جارٍ التنفيذ…")}</GText> : null}
        {error && !serverIssues ? <Note tone="danger">{error}</Note> : null}
      </> : null}
    </View>
  </Page>;
}

// ---------------- Parts Admin ----------------
/** /dept/accessory3d: the same 3D requests list as Requests › 3D requests (kept as a route so old links work). */
export const AdminAccessory3DList = () => <ThreeDRequestsList />;

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
type ModeTabs = { value: string; options: { key: string; label: string }[]; onChange: (k: string) => void };
const zonesHref = (mode: Mode, key: string) => `/dept/accessory-zones?mode=${mode}&key=${encodeURIComponent(key)}` as Href;
const fittingTitle = (t: (en: string, ar: string) => string) => t("Accessory fitting", "تركيب الإكسسوارات");
/** /dept/accessory-zones: ONE screen, three tabs on ManagePage (Part maps · Fits · Zones), the same header and rows on each.
 *  A car opens its part-map / zone editor as its own screen (?mode=parts|zones&key=…); one fit opens its review (?mode=fits&key&accessoryId&generationId). */
export function AdminAccessoryZones() {
  const { t } = useL();
  const params=useLocalSearchParams<{mode?:string;key?:string;model3dKey?:string;accessoryId?:string;generationId?:string;requestId?:string;car?:string}>();
  const [mode, setMode] = useState<Mode>(params.mode==="fits"?"fits":params.mode==="zones"?"zones":"parts");
  if (params.mode === "fits" && params.key && params.accessoryId && params.generationId) return <FitReview fitKey={params.key} accessoryId={params.accessoryId} generationId={params.generationId} requestId={params.requestId} />;
  const carKey = params.model3dKey || params.key;
  if (carKey && params.mode !== "fits") return params.mode === "zones" ? <ZoneEditor carKey={carKey} /> : <PartMapEditor carKey={carKey} />;
  const tabs: ModeTabs = { value: mode, options: [{ key: "parts", label: t("Part maps", "خرائط القطع") }, { key: "fits", label: t("Fits", "التركيب") }, { key: "zones", label: t("Zones", "المناطق") }], onChange: k => setMode(k as Mode) };
  return mode === "parts" ? <PartMapList tabs={tabs} /> : mode === "fits" ? <FitsByCar tabs={tabs} initialCar={params.car} /> : <ZoneList tabs={tabs} />;
}

// ---------------- car names (shared by the three lists and the editors) ----------------
type CarLabel = { title: string; sub: string; find: string };
/** model3dKey -> "BMW 3 Series" + "E36 · 1990–2000" from the managed catalog (the 3D lists carry only the model's own name). */
function useCarLabels() {
  const { isArabic } = useL();
  const tax = useLoad(vehicleCatalog.list, []);
  return useMemo(() => {
    const m = new Map<string, CarLabel>();
    for (const v of tax.data?.vehicles ?? []) for (const gen of v.generations) if (gen.model3dKey) {
      const title = isArabic ? `${v.makeAr || v.displayMake} ${v.modelAr || v.model}` : `${v.displayMake} ${v.model}`, sub = `${gen.code} · ${gen.yearFrom}–${gen.yearTo}`;
      m.set(gen.model3dKey, { title: isArabic ? isoLatin(title) : title, sub: isArabic ? isoLatin(sub) : sub,
        find: [v.displayMake, v.makeAr, v.model, v.modelAr, gen.code, gen.yearFrom, gen.yearTo].join(" ").toLowerCase() });
    }
    return m;
  }, [tax.data, isArabic]);
}
/** A car the catalog does not know (a private import under review) keeps its model's own name. */
const labelFor = (labels: Map<string, CarLabel>, key: string, name: string, t: (en: string, ar: string) => string): CarLabel => labels.get(key)
  ?? { title: name, sub: key.startsWith("import-") ? t("Private import · not published", "استيراد خاص · غير منشور") : "", find: name.toLowerCase() };
const matchesCar = (l: CarLabel, name: string, q: string) => { const hay = `${l.find} ${l.title.toLowerCase()} ${name.toLowerCase()}`; return q.trim().toLowerCase().split(/\s+/).filter(Boolean).every(w => hay.includes(w)); };
type FilterChip<K extends string> = { key: K; en: string; ar: string; n: number };
function FilterRail<K extends string>({ filters, value, onChange, counted }: { filters: FilterChip<K>[]; value: K; onChange: (k: K) => void; counted: boolean }) {
  const { t } = useL();
  return <Rail gap={8}>{filters.map(f => <Chip key={f.key} label={t(f.en, f.ar)} count={counted ? f.n : undefined} on={value === f.key} onPress={() => onChange(f.key)} />)}</Rail>;
}

// ---------------- Part maps tab: one row per car, "To confirm" first; tap = its editor ----------------
type MapRow = { key: string; name: string; label: CarLabel; status: PartMapListItem["status"]; done: boolean };
function PartMapList({ tabs }: { tabs: ModeTabs }) {
  const { t } = useL();
  const maps = useLoad(() => adminAccessoryApi.partMaps(), []);
  const labels = useCarLabels();
  const [q, setQ] = useState(""), [show, setShow] = useState<"all" | "todo" | "done">("all"), [menu, setMenu] = useState<MapRow | null>(null), [pulling, setPulling] = useState(false);
  const rows: MapRow[] = (maps.data ?? []).map(m => ({ key: m.key, name: m.name, label: labelFor(labels, m.key, m.name, t), status: m.status, done: m.status === "confirmed" }));
  const matching = rows.filter(r => matchesCar(r.label, r.name, q));
  const shown = matching.filter(r => show === "all" || (show === "done") === r.done).sort((x, y) => Number(x.done) - Number(y.done) || x.label.title.localeCompare(y.label.title));
  const todo = rows.filter(r => !r.done).length;
  // the part map's own state, only when it is not the usual "proposed / confirmed"
  const note = (st: string) => st === "single" ? t("one piece: uses zones", "قطعة واحدة: تستخدم المناطق") : st === "none" || st === "stale" ? t("splitting into parts…", "جارٍ التقسيم إلى قطع…") : null;
  const open = (key: string) => router.push(zonesHref("parts", key));
  return <>
    <ManagePage
      title={fittingTitle(t)}
      line={maps.data ? t(`${rows.length} cars · ${todo} to confirm`, `${rows.length} سيارة · ${todo} بانتظار التأكيد`) : undefined}
      tabs={tabs}
      search={{ value: q, onChange: setQ, placeholder: t("Search car", "ابحث عن سيارة") }}
      filters={<FilterRail value={show} onChange={setShow} counted={!!maps.data} filters={[{ key: "all", en: "All", ar: "الكل", n: matching.length },
        { key: "todo", en: "To confirm", ar: "بانتظار التأكيد", n: matching.filter(r => !r.done).length }, { key: "done", en: "Confirmed", ar: "مؤكدة", n: matching.filter(r => r.done).length }]} />}
      items={shown} keyOf={r => r.key}
      renderItem={r => <ManageRow title={r.label.title} sub={[r.label.sub, note(r.status)].filter(Boolean).join(" · ")}
        status={r.done ? { label: t("Confirmed", "مؤكدة"), tone: "success" } : { label: t("To confirm", "بانتظار التأكيد"), tone: "accent" }} onPress={() => open(r.key)} onMenu={() => setMenu(r)} />}
      loading={!maps.data && !maps.error} error={maps.error} onRetry={() => void maps.reload()}
      empty={{ text: rows.length ? t("No car matches.", "لا توجد سيارة مطابقة.") : t("No car has a 3D model yet.", "لا توجد سيارة بنموذج ثلاثي الأبعاد بعد."), action: q || show !== "all" ? { label: t("Clear filters", "مسح الفلاتر"), onPress: () => { setQ(""); setShow("all"); } } : undefined }}
      onRefresh={() => { setPulling(true); void maps.reload().finally(() => setPulling(false)); }} refreshing={pulling}
      detailHint={t("Tap a car to open its part map. Only confirmed maps reach customers.", "اضغط على سيارة لفتح خريطة قطعها. تصل الخرائط المؤكدة فقط إلى العملاء.")}
    />
    <ActionsSheet visible={!!menu} onClose={() => setMenu(null)} title={menu?.label.title ?? ""} subtitle={menu?.label.sub || undefined} actions={menu ? [
      { key: "map", label: t("Open part map", "فتح خريطة القطع"), icon: "git-network-outline", run: () => open(menu.key) },
      ...(menu.key.startsWith("import-") ? [] : [
        { key: "fits", label: t("Its accessory fits", "تركيبات الإكسسوارات عليها"), icon: "list-outline" as const, run: () => router.push(`/dept/accessory-zones?mode=fits&car=${encodeURIComponent(menu.key)}` as Href) },
        { key: "zones", label: t("Its zones", "مناطقها"), icon: "cube-outline" as const, run: () => router.push(zonesHref("zones", menu.key)) },
      ]),
    ] : []} />
  </>;
}

// ---------------- Zones tab: still used while a car's part map is not confirmed (and for the RIMS wheel position) ----------------
type ZoneRow = { key: string; name: string; label: CarLabel; tuned: number; uses: boolean };
function ZoneList({ tabs }: { tabs: ModeTabs }) {
  const { t } = useL();
  const zones = useLoad(() => adminAccessoryApi.zones(), []), maps = useLoad(() => adminAccessoryApi.partMaps(), []);
  const labels = useCarLabels();
  const [q, setQ] = useState(""), [show, setShow] = useState<"all" | "uses" | "tuned">("all"), [menu, setMenu] = useState<ZoneRow | null>(null), [pulling, setPulling] = useState(false);
  const confirmed = new Set((maps.data ?? []).filter(m => m.status === "confirmed").map(m => m.key));
  const rows: ZoneRow[] = (zones.data ?? []).map(z => ({ key: z.key, name: z.name, label: labelFor(labels, z.key, z.name, t), tuned: Object.keys(z.zones).length, uses: !confirmed.has(z.key) }));
  const matching = rows.filter(r => matchesCar(r.label, r.name, q));
  const shown = matching.filter(r => show === "all" || (show === "uses" ? r.uses : r.tuned > 0)).sort((x, y) => Number(y.uses) - Number(x.uses) || x.label.title.localeCompare(y.label.title));
  const open = (key: string) => router.push(zonesHref("zones", key));
  return <>
    <ManagePage
      title={fittingTitle(t)}
      line={t("Zones: used while a car's part map is not confirmed", "المناطق: تُستخدم حتى تأكيد خريطة قطع السيارة")}
      tabs={tabs}
      search={{ value: q, onChange: setQ, placeholder: t("Search car", "ابحث عن سيارة") }}
      filters={<FilterRail value={show} onChange={setShow} counted={!!zones.data && !!maps.data} filters={[{ key: "all", en: "All", ar: "الكل", n: matching.length },
        { key: "uses", en: "Uses zones", ar: "تستخدم المناطق", n: matching.filter(r => r.uses).length }, { key: "tuned", en: "Tuned", ar: "مضبوطة", n: matching.filter(r => r.tuned > 0).length }]} />}
      items={shown} keyOf={r => r.key}
      renderItem={r => <ManageRow title={r.label.title} sub={[r.label.sub, r.tuned ? t(`${r.tuned} tuned`, `${r.tuned} مضبوطة`) : null].filter(Boolean).join(" · ")}
        status={r.uses ? { label: t("Uses zones", "تستخدم المناطق"), tone: "accent" } : { label: t("Part map", "خريطة القطع"), tone: "success" }} onPress={() => open(r.key)} onMenu={() => setMenu(r)} />}
      loading={!zones.data && !zones.error} error={zones.error ?? maps.error} onRetry={() => { void zones.reload(); void maps.reload(); }}
      empty={{ text: rows.length ? t("No car matches.", "لا توجد سيارة مطابقة.") : t("No car has a 3D model yet.", "لا توجد سيارة بنموذج ثلاثي الأبعاد بعد."), action: q || show !== "all" ? { label: t("Clear filters", "مسح الفلاتر"), onPress: () => { setQ(""); setShow("all"); } } : undefined }}
      onRefresh={() => { setPulling(true); void Promise.all([zones.reload(), maps.reload()]).finally(() => setPulling(false)); }} refreshing={pulling}
      detailHint={t("Tap a car to edit its zones. A confirmed part map comes first; zones cover the rest.", "اضغط على سيارة لتعديل مناطقها. تأتي خريطة القطع المؤكدة أولًا، وتغطي المناطق الباقي.")}
    />
    <ActionsSheet visible={!!menu} onClose={() => setMenu(null)} title={menu?.label.title ?? ""} subtitle={menu?.label.sub || undefined} actions={menu ? [
      { key: "zones", label: t("Edit zones", "تعديل المناطق"), icon: "cube-outline", run: () => open(menu.key) },
      { key: "map", label: t("Part map", "خريطة القطع"), icon: "git-network-outline", run: () => router.push(zonesHref("parts", menu.key)) },
    ] : []} />
  </>;
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
/** The 8 points of a shape, in order: 4 where the part meets the car, then 4 on its outer edge. */
const SHAPE_STEPS: [string, string][] = [
  ["seam with the car, far left (e.g. the wheel-arch seam).", "خط التقاء القطعة بالسيارة، أقصى اليسار (مثل خط قوس العجلة)."],
  ["seam with the car, top left (bonnet / boot line or light).", "خط التقاء القطعة بالسيارة، أعلى اليسار (خط غطاء المحرك / الصندوق أو الضوء)."],
  ["seam with the car, top right (bonnet / boot line or light).", "خط التقاء القطعة بالسيارة، أعلى اليمين (خط غطاء المحرك / الصندوق أو الضوء)."],
  ["seam with the car, far right (e.g. the wheel-arch seam).", "خط التقاء القطعة بالسيارة، أقصى اليمين (مثل خط قوس العجلة)."],
  ["outer edge, bottom left corner of the part.", "الحافة الخارجية، الزاوية السفلية اليسرى للقطعة."],
  ["outer edge, bottom right corner of the part.", "الحافة الخارجية، الزاوية السفلية اليمنى للقطعة."],
  ["outer edge, the part's outermost point on the left.", "الحافة الخارجية، أبعد نقطة للقطعة على اليسار."],
  ["outer edge, the part's outermost point on the right.", "الحافة الخارجية، أبعد نقطة للقطعة على اليمين."],
];
export const fmtSize = (z: { widthMm: number; heightMm: number; depthMm: number }) => `${z.widthMm} × ${z.heightMm} × ${z.depthMm}`;
const fromProposal = (d: PartMapDetail): PartMap => d.map ?? Object.fromEntries(Object.entries(d.proposal ?? {}).map(([k, v]) => [k, v!.ids]));
function PartMapEditor({ carKey: key }: { carKey: string }) {
  const { t } = useL(); const { g, row, align } = useGarageTheme();
  const labels = useCarLabels();
  const { busy, error, work } = useWork();
  const {label:requestedLabel,requestId}=useLocalSearchParams<{label?:string;requestId?:string}>();
  const [label, setLabel] = useState<PartLabel>(PART_LABELS.includes(requestedLabel as PartLabel)?requestedLabel as PartLabel:"SPOILER");
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
  // shape mode: 8 taps on the car (4 seams with the car, then 4 on the part's outer edge) make a convex shape; "add / remove pieces inside"
  // changes this label; each shape can be undone. The 8 points also give the part's real size (saved per label).
  const [boxMode, setBoxMode] = useState(false), [turning, setTurning] = useState(false), [missed, setMissed] = useState(false), [pts, setPts] = useState<number[][]>([]), [inside, setInside] = useState<string[] | null>(null), [undo, setUndo] = useState<PartMap[]>([]);
  // a bigger view: full screen (same label + points), and "Reset view" after zooming / panning / turning
  const [full, setFull] = useState(false), [resetView, setResetView] = useState(0);
  useEffect(() => { setPts([]); setInside(null); setUndo([]); }, [key]);
  const addPt = (p: number[]) => { setMissed(false); setInside(null); setPts(a => a.length >= 8 ? [p] : [...a, p]); };
  const size = shapeSize(pts), saved = detail?.sizes?.[label];
  // cut mode (WAY 2): a bumper merged into the body is drawn with the 8 points and cut out of the car while a replacement is on
  const cutLabel = label === "FRONT_BUMPER" || label === "REAR_BUMPER" ? label : null, cutOn = !!(cutLabel && detail?.cuts?.[cutLabel]);
  const merged = !!cutLabel && detail?.gate?.limited?.[cutLabel] === "NOT_SEPARATE";
  const setCut = (on: boolean) => { if (!cutLabel || !detail) return; void work(async () => { const cuts = await adminAccessoryApi.savePartCut(detail.key, cutLabel, { pts: on ? pts : null }); setDetail(d => d && { ...d, cuts }); }); };
  const applyBox = (add: boolean) => { if (!inside) return; const ids = new Set(inside); setUndo(u => [...u.slice(-19), draft]); setDraft(d => {
    const next: PartMap = {};
    for (const L of PART_LABELS) { let l = d[L] ?? []; if (add || L === label) l = l.filter(x => !ids.has(x)); if (add && L === label) l = [...l, ...inside]; if (l.length) next[L] = l; }
    return next;
  }); setPts([]); setInside(null); };
  // "Corner grow" (whole cm, saved on each tap) and the live preview: the editor's car is cut exactly as the customer's viewer cuts it
  const savedCut = cutLabel ? detail?.cuts?.[cutLabel] : undefined, [grow, setGrow] = useState(0), [preview, setPreview] = useState(false);
  useEffect(() => { setGrow(Math.round((savedCut?.sideGrow ?? 0) * 100)); }, [savedCut]);
  useEffect(() => { setPreview(false); }, [key, label]);
  const changeGrow = (d: number) => { if (!cutLabel || !detail) return; const next = Math.min(20, Math.max(0, grow + d)); if (next === grow) return; setGrow(next);
    void work(async () => { const cuts = await adminAccessoryApi.savePartCut(detail.key, cutLabel, { sideGrowCm: next }); setDetail(x => x && { ...x, cuts }); }); };
  const cutPreview = useMemo(() => preview && cutLabel && savedCut ? { label: cutLabel, pts: savedCut.pts, ...(grow ? { sideGrow: grow / 100 } : {}) } : null, [preview, cutLabel, savedCut, grow]);
  const partEdit = useMemo(() => ({ label, labels: draft, boxPts: boxMode ? pts : null, boxTurn: boxMode && turning, resetView, cutPreview }), [label, draft, boxMode, pts, turning, resetView, cutPreview]);
  const changed = !!detail && JSON.stringify(draft) !== JSON.stringify(detail.map ?? null);
  const statusText = (st: string) => st === "confirmed" ? t("Confirmed: used for customers", "مؤكدة: تُستخدم للعملاء") : st === "proposed" ? t("Proposed: not used yet (zones until confirmed)", "مقترحة: غير مستخدمة بعد (المناطق حتى التأكيد)")
    : st === "single" ? t("One piece (AI / scan model): accessories use the zone cut", "قطعة واحدة (نموذج ذكاء اصطناعي / مسح): تستخدم الإكسسوارات قص المناطق")
    : st === "stale" ? t("The model file changed: splitting again…", "تغيّر ملف النموذج: جارٍ التقسيم من جديد…") : t("Splitting into parts… pull to refresh", "جارٍ التقسيم إلى قطع… اسحب للتحديث");
  const usable = detail?.status === "proposed" || detail?.status === "confirmed";
  // one viewer at a time (inline or full screen): both read the same label + points, so switching keeps them
  const viewer = (style: object) => car ? <Car3DView model={car} assetLoader={assetLoader} color="#c3c7cc" bg={g.cardSoft} partEdit={partEdit} onPick={pick} onPieces={setPieces} onBoxPoint={addPt} onBoxIds={setInside} onBoxMiss={() => setMissed(true)} interactive style={style} /> : null;
  const boxControls = <>
            {merged || cutOn ? <View style={{ gap: 8 }}>
              {merged ? <Note tone="warning">{t(`This car's ${t(...PART_LABEL_NAMES[label]).toLowerCase()} isn't a separate piece. Draw it with 8 points to use cut mode.`, `${t(...PART_LABEL_NAMES[label])} في هذه السيارة ليس قطعة منفصلة. ارسمه بـ 8 نقاط لاستخدام وضع القص.`)}</Note> : null}
              <Check label={t("Cut this region (cut mode)", "قص هذه المنطقة (وضع القص)")} checked={cutOn} disabled={busy || !detail || (!cutOn && pts.length < 8)} onPress={() => setCut(!cutOn)} />
              <GText soft style={[gType.caption, align]}>{cutOn ? t("Cut mode is on: while a replacement bumper is shown, everything of the car inside the saved shape is cut away (lights, glass, wheels and exhaust stay).", "وضع القص مفعّل: أثناء عرض مصد بديل يُقص كل ما بداخل الشكل المحفوظ من السيارة (تبقى الأضواء والزجاج والعجلات والعادم).")
                : t("Place all 8 points, then turn this on to save the shape.", "ضع النقاط الثماني ثم فعّل هذا لحفظ الشكل.")}</GText>
              {cutOn ? <View style={{ gap: 8 }}>
                <View style={[row, { gap: 10, alignItems: "center", flexWrap: "wrap" }]}>
                  <GText style={[gType.label, align]}>{t("Corner grow", "توسيع الزوايا")}</GText>
                  <GButton variant="secondary" label="–" disabled={busy || grow <= 0} onPress={() => changeGrow(-1)} />
                  <GText style={{ minWidth: 56, textAlign: "center" }}>{`+${grow} ${t("cm", "سم")}`}</GText>
                  <GButton variant="secondary" label="+" disabled={busy || grow >= 20} onPress={() => changeGrow(1)} />
                </View>
                <GText soft style={[gType.caption, align]}>{t("Cuts further at the two ends of the bumper (rounded corners). Turn on the preview to see it.", "يقص أبعد عند طرفي المصد (الزوايا المستديرة). فعّل المعاينة لرؤيته.")}</GText>
                <Check label={t("Preview the cut on the car", "معاينة القص على السيارة")} checked={preview} onPress={() => setPreview(v => !v)} />
              </View> : null}
            </View> : null}
            <View style={[row, { gap: 8 }]}>
              <Chip label={t("Tap pieces", "اختيار بالضغط")} on={!boxMode} onPress={() => { setBoxMode(false); setPts([]); setInside(null); }} />
              <Chip label={t("8-point shape", "شكل من 8 نقاط")} on={boxMode} onPress={() => { setBoxMode(true); setTurning(false); }} />
            </View>
            {boxMode ? <View style={{ gap: 8 }}>
              <View style={[row, { gap: 8 }]}>
                <Chip label={t("Place points", "وضع النقاط")} on={!turning} onPress={() => setTurning(false)} />
                <Chip label={t("Turn the car", "تدوير السيارة")} on={turning} onPress={() => setTurning(true)} />
              </View>
              {missed && !turning ? <Note tone="warning">{t("That tap missed the car. Tap on the car body.", "لم تقع الضغطة على السيارة. اضغط على جسم السيارة.")}</Note> : null}
              <Note>{pts.length < 8 ? `${t(`Point ${pts.length + 1} of 8`, `النقطة ${pts.length + 1} من 8`)}: ${t(...SHAPE_STEPS[pts.length]!)} ${turning ? t("Drag to turn the car, then choose Place points.", "اسحب لتدوير السيارة، ثم اختر وضع النقاط.") : t("One tap = one point. Pinch to zoom, drag with two fingers to move the view; to turn the car choose Turn the car.", "ضغطة واحدة = نقطة واحدة. قرّب بإصبعين واسحب بإصبعين لتحريك العرض؛ لتدوير السيارة اختر تدوير السيارة.")}`
                : `${t("Pieces inside the shape", "القطع داخل الشكل")}: ${inside?.length ?? "…"}. ${t("Tap again to start a new shape.", "اضغط مجددًا لبدء شكل جديد.")}`}</Note>
              {size ? <View style={{ gap: 8 }}>
                <GText style={[gType.label, align]}>{`${t("Measured size", "المقاس المقاس")}: ${fmtSize(size)} ${t("(width × height × depth, mm)", "(العرض × الارتفاع × العمق، مم)")}`}</GText>
                <GButton variant="secondary" icon="resize-outline" label={`${t("Save size for", "حفظ المقاس لـ")} ${t(...PART_LABEL_NAMES[label])}`} disabled={busy || !detail}
                  onPress={() => void work(async () => { const sizes = await adminAccessoryApi.savePartSize(detail!.key, label, size); setDetail(d => d && { ...d, sizes }); })} />
              </View> : null}
              {saved ? <GText soft style={[gType.caption, align]}>{`${t("Saved size", "المقاس المحفوظ")}: ${fmtSize(saved)} ${t("mm", "مم")}`}</GText> : null}
              <View style={{ gap: 10 }}>
                <GButton label={t("Add pieces inside", "إضافة القطع داخل الشكل")} disabled={busy || !inside?.length} onPress={() => applyBox(true)} />
                <GButton variant="secondary" label={t("Remove pieces inside", "إزالة القطع داخل الشكل")} disabled={busy || !inside?.length} onPress={() => applyBox(false)} />
              </View>
              <View style={[row, { gap: 10, flexWrap: "wrap" }]}>
                <GButton flex variant="secondary" label={t("Undo last point", "تراجع عن آخر نقطة")} disabled={!pts.length} onPress={() => { setPts(a => a.slice(0, -1)); setInside(null); }} />
                <GButton flex variant="secondary" label={t("Clear points", "مسح النقاط")} disabled={!pts.length} onPress={() => { setPts([]); setInside(null); }} />
              </View>
              <View style={[row, { gap: 10 }]}>
                <GButton flex variant="secondary" label={t("Undo last shape", "التراجع عن آخر شكل")} disabled={!undo.length} onPress={() => { setDraft(undo[undo.length - 1]!); setUndo(u => u.slice(0, -1)); }} />
              </View>
            </View> : null}
  </>;
  const name = labelFor(labels, key, detail?.name ?? "", t);
  const short = !detail ? null : detail.status === "confirmed" ? { label: t("Confirmed", "مؤكدة"), tone: "success" as const } : detail.status === "proposed" ? { label: t("To confirm", "بانتظار التأكيد"), tone: "accent" as const }
    : detail.status === "single" ? { label: t("One piece", "قطعة واحدة"), tone: "neutral" as const } : { label: t("Splitting…", "جارٍ التقسيم…"), tone: "neutral" as const };
  const reload = () => work(async () => { const d = await adminAccessoryApi.partMap(key); setDetail(d); });
  const actions: ItemAction[] = detail ? [
    ...(car ? [{ key: "full", label: t("Full screen", "ملء الشاشة"), icon: "expand-outline" as const, run: () => setFull(true) },
      { key: "reset", label: t("Reset view", "إعادة ضبط العرض"), icon: "refresh" as const, run: () => setResetView(n => n + 1) }] : []),
    ...(usable ? [
      { key: "clear", label: t("Clear this label", "مسح هذه التسمية"), icon: "close-circle-outline" as const, disabled: busy || !draft[label]?.length, run: () => setDraft(d => { const n = { ...d }; delete n[label]; return n; }) },
      { key: "proposal", label: t("Back to the proposal", "العودة إلى الاقتراح"), icon: "arrow-undo-outline" as const, disabled: busy, run: () => setDraft(Object.fromEntries(Object.entries(detail.proposal ?? {}).map(([k, v]) => [k, v!.ids]))) },
      ...(detail.status === "confirmed" ? [{ key: "unconfirm", label: t("Unconfirm (use zones)", "إلغاء التأكيد (استخدام المناطق)"), icon: "remove-circle-outline" as const, destructive: true, disabled: busy,
        run: () => work(async () => { setDetail({ ...detail, ...await adminAccessoryApi.confirmPartMap(detail.key, detail.modelSha256!, null) }); }) }] : []),
    ] : []),
    { key: "split", label: t("Split into parts again", "التقسيم إلى قطع من جديد"), icon: "cut-outline", disabled: busy, run: () => work(async () => { const d = await adminAccessoryApi.segment(detail.key); setDetail(d); setDraft(fromProposal(d)); }) },
    ...(key.startsWith("import-") ? [] : [{ key: "zones", label: t("Zones of this car", "مناطق هذه السيارة"), icon: "cube-outline" as const, run: () => router.push(zonesHref("zones", key)) }]),
    ...(requestId ? [{ key: "request", label: t("Return to 3D request", "العودة إلى طلب النموذج"), icon: "document-text-outline" as const, run: () => router.replace(`/dept/accessory3d/${encodeURIComponent(requestId)}` as Href) }] : []),
  ] : [];
  // the one main action, sticky: confirm the map for customers
  const footer = detail && usable ? <GButton icon="checkmark-circle-outline" label={t("Confirm part map", "تأكيد خريطة القطع")} busy={busy} disabled={busy || !detail.modelSha256 || (detail.status === "confirmed" && !changed)}
    onPress={() => void work(async () => { setDetail({ ...detail, ...await adminAccessoryApi.confirmPartMap(detail.key, detail.modelSha256!, draft) }); })} /> : undefined;
  return (
    <Page title={name.title || t("Part map", "خريطة القطع")} line={name.sub || undefined} actions={actions} trail={[{ href: "/dept/accessory-zones", en: "Accessory fitting", ar: "تركيب الإكسسوارات" }]} footer={footer} onRefresh={() => void reload()} refreshing={false}>
      <Modal visible={full && !!car} animationType="fade" onRequestClose={() => setFull(false)} statusBarTranslucent>
        <SafeAreaView style={{ flex: 1, backgroundColor: g.page }}>
          <View style={[row, { alignItems: "center", gap: 10, padding: 12 }]}>
            <GButton variant="secondary" icon="arrow-back" label={t("Back", "رجوع")} onPress={() => setFull(false)} />
            <GText numberOfLines={1} style={[gType.label, align, { flex: 1 }]}>{t(...PART_LABEL_NAMES[label])}</GText>
            <GButton variant="secondary" icon="refresh" label={t("Reset view", "إعادة ضبط العرض")} onPress={() => setResetView(n => n + 1)} />
          </View>
          <View style={{ flex: 1 }}>{full ? viewer({ flex: 1 }) : null}</View>
          <ScrollView style={{ maxHeight: "42%" }} contentContainerStyle={{ padding: 12, gap: 8 }}>{boxControls}</ScrollView>
        </SafeAreaView>
      </Modal>
      <View style={{ gap: 12 }}>
        {!detail && !error ? <SkeletonRows count={4} /> : null}
        {detail && short ? <>
          <View style={[row, { alignItems: "center", gap: 8, flexWrap: "wrap" }]}>
            <StatusChip label={short.label} tone={short.tone} />
            <GText soft numberOfLines={2} style={[gType.caption, align, { flex: 1, minWidth: 160 }]}>{statusText(detail.status)}</GText>
          </View>
          <GateSummary gate={detail.gate} />
          {usable ? <>
            <Rail gap={8}>{PART_LABELS.map(L => {
              const p = detail.proposal?.[L];
              return <Chip key={L} label={`${t(...PART_LABEL_NAMES[L])} · ${draft[L]?.length ?? 0}${p ? ` (${Math.round(p.confidence * 100)}%)` : ""}`} on={label === L} onPress={() => setLabel(L)} />;
            })}</Rail>
            {car ? (full ? <View style={{ height: 320, borderRadius: 16, backgroundColor: g.cardSoft, alignItems: "center", justifyContent: "center" }}><GText soft>{t("Open in full screen", "مفتوح بملء الشاشة")}</GText></View> : viewer({ height: 320, borderRadius: 16 }))
              : <Note>{t("This car's 3D model is not in the app catalog yet.", "نموذج هذه السيارة غير موجود في كتالوج التطبيق بعد.")}</Note>}
            {boxControls}
            <Swatch color={PART_LABEL_COLORS[label]} label={`${t(...PART_LABEL_NAMES[label])}: ${boxMode ? t("pieces fully inside the shape", "القطع الموجودة كليًا داخل الشكل") : t("tap a piece to add or remove it", "اضغط على قطعة لإضافتها أو إزالتها")} · ${t("used by the", "يستخدمها")} ${t(...USED_BY[label])}`} />
            <GText soft style={[gType.caption, align]}>{`${t("Other labels are dimmed, grey = not mapped", "التسميات الأخرى باهتة، الرمادي = غير محدد")} · ${pieces ?? detail.pieces} ${t("pieces", "قطعة")}`}</GText>
            {detail.proposal?.[label] ? <GText soft style={[gType.caption, align]}>{`${t("Proposal", "الاقتراح")}: ${detail.proposal[label]!.ids.length} ${t("pieces", "قطعة")} · ${Math.round(detail.proposal[label]!.confidence * 100)}% · ${detail.proposal[label]!.by === "name+shape" ? t("name and shape", "الاسم والشكل") : t("shape only", "الشكل فقط")}`}</GText>
              : <GText soft style={[gType.caption, align]}>{t("No proposal for this label: tap the pieces, or leave it empty (the zone cut is used).", "لا يوجد اقتراح لهذه التسمية: اضغط على القطع، أو اتركها فارغة (يُستخدم قص المناطق).")}</GText>}
          </> : null}
        </> : null}
        {error ? <Note tone="danger">{error}</Note> : null}
      </View>
    </Page>
  );
}

// ---------------- accessory auto-fits ----------------
const WHEEL_NAMES: Record<string, [string, string]> = { FL: ["Front left", "أمامي يسار"], FR: ["Front right", "أمامي يمين"], RL: ["Rear left", "خلفي يسار"], RR: ["Rear right", "خلفي يمين"] };
/** Why an automatic wheel move stopped short (viewer fit warnings), in words. */
const RIM_NOTES: Record<string, [string, string]> = { // in this order
  ADMIN_OVERRIDE: ["your override", "تعديلك اليدوي"], KEPT_STOCK_POSITION: ["no safe move, kept in place", "لا توجد حركة آمنة، بقيت مكانها"],
  LIMITED_BY_CLEARANCE: ["stopped before touching the car", "توقفت قبل ملامسة السيارة"], MOVE_CLAMPED_40MM: ["moved the 40 mm maximum", "حُرّكت بالحد الأقصى 40 مم"],
  ARCH_NOT_MEASURED: ["fender not measured, kept in place", "تعذّر قياس الرفرف، بقيت مكانها"],
};
const BODY_NAMES: Record<string, [string, string]> = { sedan: ["boot lid", "غطاء الصندوق"], hatch: ["top of the tailgate", "أعلى الباب الخلفي"], roof: ["roof", "السقف"] };
/** The viewer kit of one stored fit (Accessory fits editor, bulk fits preview). A failed fit stores only its reason: the part is fitted
 *  live with the viewer's evidence flags so the admin sees why; `live` (a draft wheel inset) also ignores the stored fit. */
export const fitKit = (r: AutoFitRow, baseAdj: FitAdjust, live = false) => r.hasModel && r.fit ? { type: r.type, file: r.file??`private-accessory-${r.accessoryId}-${r.modelRevision}.glb`, assetLoader:r.file?undefined:()=>adminAccessoryApi.asset(r.accessoryId,"model"),
  size: r.fit.fit.failed ? { ...r.size, forceFit: true } : r.size, ...(r.fit.fit.failed ? { qaEvidence: true } : {}), finish: r.finish ?? null, paintMatch: false, adj: NO_ADJUST, fit: live || r.fit.fit.failed ? undefined : r.fit.fit, baseAdj } : null;
// Accessory fits = the cars list (one row per car with its counts) -> one car's fits (sheet / side panel) -> one fit's review (own screen).
type FitCounts = Record<FitState, number>;
type CarBucket = "failed" | "review" | "not_computed" | "approved" | "none";
const pendingOf = (c: FitCounts) => c.passed + c.needs_correction + c.has_correction;
/** a car's state = its most urgent fit: failed, then waiting for review, then not computed, then all approved */
const bucketOf = (c: FitCounts | null): CarBucket => (!c ? "none" : c.failed ? "failed" : pendingOf(c) ? "review" : c.not_computed ? "not_computed" : c.approved ? "approved" : "none");
const BUCKETS: CarBucket[] = ["failed", "review", "not_computed", "approved", "none"];
const BUCKET_LABEL: Record<Exclude<CarBucket, "none">, { en: string; ar: string; tone: "neutral" | "accent" | "success" | "danger" }> = {
  failed: { en: "Failed", ar: "فشل", tone: "danger" }, review: { en: "To review", ar: "للمراجعة", tone: "accent" },
  not_computed: { en: "Not computed", ar: "لم يُحسب", tone: "neutral" }, approved: { en: "Approved", ar: "معتمد", tone: "success" },
};
function countsText(c: FitCounts | null, t: (en: string, ar: string) => string) {
  const parts = c ? [pendingOf(c) ? t(`${pendingOf(c)} pending`, `${pendingOf(c)} بانتظار المراجعة`) : null, c.failed ? t(`${c.failed} failed`, `${c.failed} فاشلة`) : null,
    c.not_computed ? t(`${c.not_computed} not computed`, `${c.not_computed} غير محسوبة`) : null, c.approved ? t(`${c.approved} approved`, `${c.approved} معتمدة`) : null].filter(Boolean) : [];
  return parts.join(" · ") || t("No accessory fitted yet", "لا توجد قطع مركّبة بعد");
}
const fitReviewHref = (key: string, accessoryId: string, generationId: string) =>
  `/dept/accessory-zones?mode=fits&key=${encodeURIComponent(key)}&accessoryId=${encodeURIComponent(accessoryId)}&generationId=${encodeURIComponent(generationId)}` as Href;
type CarRow = { key: string; name: string; label: CarLabel; c: FitCounts | null; b: CarBucket };

function FitsByCar({ tabs, initialCar }: { tabs: ModeTabs; initialCar?: string }) {
  const { t, isArabic } = useL();
  const twoPane = useTwoPane();
  const models = useLoad(() => adminAccessoryApi.partMaps(), []);
  const labels = useCarLabels();
  const summary = useLoad(() => adminAccessoryApi.fitSummary(), [], 15000);
  const [q, setQ] = useState(""), [show, setShow] = useState<"all" | "review" | "failed" | "approved">("all");
  const [open, setOpen] = useState<string | null>(initialCar ?? null), [menu, setMenu] = useState<CarRow | null>(null), [pulling, setPulling] = useState(false);
  const counts = new Map((summary.data?.cars ?? []).map(c => [c.model3dKey, c.counts]));
  const cars: CarRow[] = (models.data ?? []).filter(m => !m.key.startsWith("import-")).map(m => { const c = counts.get(m.key) ?? null; return { key: m.key, name: m.name, label: labelFor(labels, m.key, m.name, t), c, b: bucketOf(c) }; });
  const matching = cars.filter(c => matchesCar(c.label, c.name, q));
  const shown = matching.filter(c => show === "all" || c.b === show).sort((x, y) => BUCKETS.indexOf(x.b) - BUCKETS.indexOf(y.b) || x.label.title.localeCompare(y.label.title));
  const pending = cars.reduce((n, c) => n + (c.c ? pendingOf(c.c) : 0), 0);
  const count = (b: CarBucket) => matching.filter(c => c.b === b).length;
  const openCar = cars.find(c => c.key === open) ?? null;
  const filters: { key: typeof show; en: string; ar: string; n: number }[] = [
    { key: "all", en: "All", ar: "الكل", n: matching.length }, { key: "review", en: "To review", ar: "للمراجعة", n: count("review") },
    { key: "failed", en: "Failed", ar: "فشل", n: count("failed") }, { key: "approved", en: "Approved", ar: "معتمد", n: count("approved") },
  ];
  // on phones the sheet closes first: a Modal would stay on top of the next screen
  const pick = (key: string, accessoryId: string, generationId: string) => { if (!twoPane) setOpen(null); router.push(fitReviewHref(key, accessoryId, generationId)); };
  return <>
    <ManagePage
      title={fittingTitle(t)}
      line={models.data && summary.data ? t(`${cars.length} cars · ${pending} fits to review`, `${cars.length} سيارة · ${pending} تركيب للمراجعة`) : undefined}
      tabs={tabs}
      search={{ value: q, onChange: setQ, placeholder: t("Search car", "ابحث عن سيارة") }}
      filters={<FilterRail value={show} onChange={setShow} counted={!!models.data} filters={filters} />}
      above={<ManageEntry icon="albums-outline" title={t("Review by accessory", "المراجعة حسب القطعة")} sub={summary.data ? t(`${summary.data.accessories} accessories · all their cars at once`, `${summary.data.accessories} قطع · كل سياراتها معًا`) : undefined}
        onPress={() => router.push("/dept/accessory-fits" as Href)} />}
      items={shown} keyOf={c => c.key}
      renderItem={c => { const l = c.b === "none" ? null : BUCKET_LABEL[c.b]; return <ManageRow title={c.label.title} sub={[c.label.sub, summary.data ? countsText(c.c, t) : null].filter(Boolean).join(" · ")} status={l ? { label: t(l.en, l.ar), tone: l.tone } : null}
        active={twoPane && open === c.key} onPress={() => setOpen(c.key)} onMenu={() => setMenu(c)} />; }}
      loading={!models.data && !models.error} error={models.error ?? summary.error} onRetry={() => { void models.reload(); void summary.reload(); }}
      empty={{ text: cars.length ? t("No car matches.", "لا توجد سيارة مطابقة.") : t("No car has a 3D model yet.", "لا توجد سيارة بنموذج ثلاثي الأبعاد بعد."), action: q || show !== "all" ? { label: t("Clear filters", "مسح الفلاتر"), onPress: () => { setQ(""); setShow("all"); } } : undefined }}
      onRefresh={() => { setPulling(true); void Promise.all([models.reload(), summary.reload()]).finally(() => setPulling(false)); }} refreshing={pulling}
      detail={openCar ? { title: [openCar.label.title, openCar.label.sub].filter(Boolean).join(" · "), onClose: () => setOpen(null), content: <CarFits key={openCar.key} carKey={openCar.key} onPick={pick} /> } : null}
      detailHint={t("Tap a car to see its fits.", "اضغط على سيارة لعرض تركيباتها.")}
    />
    <ActionsSheet visible={!!menu} onClose={() => setMenu(null)} title={menu?.label.title ?? ""} subtitle={menu ? [menu.label.sub, countsText(menu.c, t)].filter(Boolean).join(" · ") : undefined} actions={menu ? [
      { key: "fits", label: t("See its fits", "عرض تركيباتها"), icon: "list-outline", run: () => setOpen(menu.key) },
      { key: "map", label: t("Part map", "خريطة القطع"), icon: "git-network-outline", run: () => router.push(zonesHref("parts", menu.key)) },
      { key: "zones", label: t("Zones", "المناطق"), icon: "cube-outline", run: () => router.push(zonesHref("zones", menu.key)) },
    ] : []} />
  </>;
}

/** One car's fits, one row each; tap = that fit's review. */
function CarFits({ carKey, onPick }: { carKey: string; onPick: (key: string, accessoryId: string, generationId: string) => void }) {
  const { t } = useL();
  const s = useLoad(() => adminAccessoryApi.fitSummary(carKey), [carKey]);
  const fits = s.data?.fits ?? [];
  if (s.error && !s.data) return <Note tone="danger">{s.error}</Note>;
  if (!s.data) return <SkeletonRows count={3} />;
  if (!fits.length) return <Note>{t("No accessory is fitted on this car yet.", "لا توجد قطعة مركّبة على هذه السيارة بعد.")}</Note>;
  return <View>{fits.map(f => { const l = FIT_STATE_LABELS[f.status]; return <ManageRow key={`${f.accessoryId}|${f.generationId}`} title={f.productName}
    sub={`${t(...ACCESSORY_TYPE_LABELS[f.type])} · ${f.generation}`} status={{ label: t(l.en, l.ar), tone: l.tone }} onPress={() => onPick(carKey, f.accessoryId, f.generationId)} />; })}</View>;
}

/** One fit on one car: the 3D view, its state, Approve / Needs correction (the footer). The position correction opens under the viewer (nudges,
 *  live fit check, before / after, Undo, apply to similar cars); rerun and the wheel position are in ⋮. */
function FitReview({ fitKey, accessoryId, generationId, requestId }: { fitKey: string; accessoryId: string; generationId: string; requestId?: string }) {
  const { t } = useL(); const { g, row, align } = useGarageTheme();
  const { busy, error, work } = useWork();
  const fits = useLoad(() => adminAccessoryApi.autoFits(fitKey), [fitKey]);
  const car = useCatalogModelKey(fitKey);
  const r = (fits.data ?? []).find(x => x.accessoryId === accessoryId && x.generation.id === generationId) ?? null;
  const [adj, setAdjNow] = useState<FitAdjust>(NO_ADJUST), [history, setHistory] = useState<FitAdjust[]>([]), [view, setView] = useState<"before" | "after">("after");
  const [panel, setPanel] = useState<"adjust" | "wheels" | null>(null), [similar, setSimilar] = useState(false), [check, setCheck] = useState<FitCheck | null>(null);
  const [viewerFitError, setViewerFitError] = useState<string | null>(null), [fitReviewed, setFitReviewed] = useState(false);
  useEffect(() => { setViewerFitError(null); setFitReviewed(false); }, [r?.modelRevision, r?.fit?.approvedAt, adj]);
  const savedKey = JSON.stringify(r?.fit?.adj ?? null);
  useEffect(() => { setAdjNow(r?.fit?.adj ?? NO_ADJUST); setHistory([]); }, [r?.fit?.approvedAt, savedKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const saved = r?.fit?.adj ?? NO_ADJUST;
  // every change can be undone (the last 50); a change always shows "After"
  const setAdj = (next: FitAdjust) => { if (sameAdj(next, adj)) return; setHistory(h => [...h.slice(-49), adj]); setAdjNow(next); setView("after"); };
  const undo = () => { const prev = history[history.length - 1]; if (!prev) return; setHistory(h => h.slice(0, -1)); setAdjNow(prev); setView("after"); };
  // a fit being computed in the background: look again until it is there
  useEffect(() => { if (!r?.computing) return; const id = setTimeout(() => void fits.reload(), 6000); return () => clearTimeout(id); }, [fits.data]); // eslint-disable-line react-hooks/exhaustive-deps
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
  const draft = inset && (inset.front !== savedInset.front || inset.rear !== savedInset.rear) ? inset : null;
  const previewCar = useMemo(() => car && draft ? { ...car, zones: { ...(car.zones ?? {}), RIMS: { ...(car.zones?.RIMS ?? {}), wheelInsetMm: draft } } } : car, [car, draft]);
  const saveInset = (v: { front: number; rear: number }) => work(async () => {
    const { wheelInsetMm: _old, ...rest } = car?.zones?.RIMS ?? {}; // eslint-disable-line @typescript-eslint/no-unused-vars
    const zone = v.front || v.rear ? { ...rest, wheelInsetMm: v } : Object.keys(rest).length ? rest : null;
    await adminAccessoryApi.setZone(fitKey, "RIMS", zone);
  }, async () => { setInset(null); await Promise.all([fits.reload(), refreshRuntimeModels()]); });
  // a failed fit stores only its reason: the part is fitted live with the viewer's evidence flags (placed where the auto-fit put it, never
  // refused), so the admin sees why; it still cannot be approved (here or on the server)
  const shownAdj = view === "before" ? saved : adj;
  // while the correction panel is open the viewer measures the part where it is now (FIT-QA clip / gap) after every change
  const kit = useMemo(() => { const k = r ? fitKit(r, shownAdj, !!draft) : null; return k && panel === "adjust" ? { ...k, qaLive: true } : k; }, [r, shownAdj, draft, panel]);
  useEffect(() => { setCheck(null); }, [shownAdj, panel]);
  // at the saved position the server's own check of this stored fit is the answer (a replayed bumper corner can measure differently from the
  // fit that was checked); every other position is measured live by the viewer
  const savedCheck = useMemo((): FitCheck | null => {
    const q = (r?.fit?.fit.info as { qa?: { clipMm?: number; gapMm?: number; limitMm?: number; tier?: string; correction?: { adj?: FitAdjust; clipMm?: number; gapMm?: number; tier?: string } } } | undefined)?.qa;
    const c = !q ? null : sameAdj(shownAdj, NO_ADJUST) ? q : q.correction?.adj && sameAdj(shownAdj, q.correction.adj) ? q.correction : null;
    if (!q || !c || typeof c.clipMm !== "number" || typeof q.limitMm !== "number" || !(c.tier === "PERFECT" || c.tier === "GOOD" || c.tier === "REFUSED")) return null;
    return { clipMm: c.clipMm, gapMm: r!.type === "RIMS" ? null : c.gapMm ?? null, limitMm: q.limitMm, tier: c.tier };
  }, [r, shownAdj]);
  const gaps = (info.feetGapMm ?? info.topGapMm ?? []).map(x => x === null ? "—" : `${x} mm`).join(" / ");
  const corrected = isCorrected(adj), changed = !sameAdj(adj, saved);
  const state = !r ? null : r.computing ? { label: t("Computing the fit…", "جارٍ حساب التركيب…"), tone: "warning" as const } : failed ? { label: t("Does not fit this car", "لا تناسب هذه السيارة"), tone: "danger" as const }
    : r.fit?.approvedAt ? { label: t("Approved", "معتمد"), tone: "success" as const } : r.fit?.fit.needsCorrection ? { label: t("Needs correction", "يحتاج إلى تصحيح"), tone: "warning" as const }
    : r.fit ? { label: t("Waiting for your review", "بانتظار مراجعتك"), tone: "accent" as const } : { label: t("Not computed", "لم يُحسب"), tone: "neutral" as const };
  const measures = r?.fit && !failed ? [
    info.mount?.body ? `${t("on the", "على")} ${t(...(BODY_NAMES[info.mount.body] ?? ["body", "الهيكل"]))}` : null,
    info.spanM ? `${t("width", "العرض")} ${info.spanM} m` : null,
    info.heightAboveM ? `${t("height", "الارتفاع")} ${info.heightAboveM} m` : null,
    gaps ? `${t("gap", "الفراغ")} ${gaps}` : null,
    info.pitchDeg !== undefined ? `${t("tilt", "الميل")} ${info.pitchDeg}°` : null,
  ].filter(Boolean).join(" · ") : "";
  const actions: ItemAction[] = r ? [
    ...(r.fit && !failed ? [{ key: "rerun", label: t("Rerun automatic fit", "إعادة تشغيل التركيب التلقائي"), icon: "refresh-outline" as const, disabled: busy || r.computing, run: () => work(() => adminAccessoryApi.act(r.accessoryId, "refit"), fits.reload) }] : []),
    ...(r.fit ? [{ key: "adjust", label: t("Correct the position", "تصحيح الموضع"), icon: "move-outline" as const, run: () => setPanel("adjust") }] : []),
    ...(r.type === "RIMS" && r.fit && !failed ? [{ key: "wheels", label: t("Wheel position", "موضع العجلات"), icon: "disc-outline" as const, run: () => setPanel("wheels") }] : []),
    { key: "map", label: t("Part map of this car", "خريطة قطع هذه السيارة"), icon: "git-network-outline", run: () => router.push(`/dept/accessory-zones?key=${encodeURIComponent(fitKey)}&mode=parts` as Href) },
    ...(requestId ? [{ key: "request", label: t("Back to the 3D request", "العودة إلى طلب النموذج"), icon: "document-text-outline" as const, run: () => router.replace(`/dept/accessory3d/${encodeURIComponent(requestId)}` as Href) }] : []),
  ] : [];
  // the one main action: review (approve / needs correction); a failed or missing fit can only be run again
  const rerun = () => void work(() => adminAccessoryApi.act(r!.accessoryId, "refit"), fits.reload);
  const footer = !r ? undefined : !r.fit || failed ? (
    <GButton icon="refresh-outline" label={r.fit ? t("Rerun automatic fit", "إعادة تشغيل التركيب التلقائي") : t("Run automatic fit", "تشغيل التركيب التلقائي")} busy={busy || r.computing} disabled={busy || r.computing} onPress={rerun} />
  ) : (
    <View style={{ gap: 8 }}>
      <Check checked={fitReviewed} disabled={busy || !!failed || !!viewerFitError || !kit || !previewCar} onPress={() => setFitReviewed(v => !v)} label={t("I reviewed the part on this car.", "راجعت القطعة على هذه السيارة.")} />
      <View style={[row, { gap: 8 }]}>
        <GButton flex variant="secondary" label={t("Needs correction", "يحتاج إلى تصحيح")} disabled={busy || !!failed} onPress={() => void work(() => adminAccessoryApi.needsCorrection(r.accessoryId, r.generation.id), fits.reload)} />
        <GButton flex icon="checkmark-circle-outline" label={corrected ? t("Approve with correction", "اعتماد مع التصحيح") : t("Approve fit", "اعتماد التركيب")} busy={busy} disabled={busy || r.computing || !!failed || !fitReviewed || !!viewerFitError || !kit || !previewCar}
          onPress={() => void work(async () => { await adminAccessoryApi.approveFit(r.accessoryId, r.generation.id, corrected ? adj : null); await adminAccessoryApi.act(r.accessoryId, "preview", { generationId: r.generation.id }); }, fits.reload)} />
      </View>
    </View>
  );
  return (
    <Page title={r?.productName ?? t("Fit review", "مراجعة التركيب")} line={r ? `${r.generation.name} · ${t(...ACCESSORY_TYPE_LABELS[r.type])}` : undefined} actions={actions} trail={[{ href: "/dept/accessory-zones?mode=fits", en: "Accessory fitting", ar: "تركيب الإكسسوارات" }]} footer={footer} onRefresh={() => void fits.reload()} refreshing={fits.loading && !!fits.data}>
      <View style={{ gap: 12 }}>
        {fits.error && !fits.data ? <Note tone="danger">{fits.error}</Note> : null}
        {!fits.data && !fits.error ? <SkeletonRows count={4} /> : null}
        {fits.data && !r ? <Note>{t("This fit is no longer available on this car.", "لم يعد هذا التركيب متاحًا على هذه السيارة.")}</Note> : null}
        {r && state ? <>
          <View style={[row, { alignItems: "center", gap: 8, flexWrap: "wrap" }]}>
            <StatusChip label={state.label} tone={state.tone} />
            {measures ? <GText soft numberOfLines={2} style={[gType.caption, align, { flex: 1, minWidth: 160 }]}>{measures}</GText> : null}
          </View>
          {failed ? <View style={{ gap: 4 }}>
            <Note tone="danger">{t("Customers get \"3D preview not available\". Fix the cause (cut, part map or part), then run the fit again.", "يرى العملاء «المعاينة غير متاحة». أصلح السبب (القص أو خريطة القطع أو القطعة) ثم شغّل التركيب مجددًا.")}</Note>
            {/* the viewer's own measurement text (English, technical): its own left-to-right line, never inside the Arabic sentence */}
            <GText soft style={[gType.tiny, { writingDirection: "ltr", textAlign: "left" }]}>{failed}</GText>
          </View> : null}
          {kit && previewCar ? <Car3DView model={previewCar} color="#8b9baa" bg={g.cardSoft} kit={kit} onFitError={message => setViewerFitError(message)} onFitCheck={setCheck} interactive style={{ height: 320, borderRadius: 16 }} />
            : !r.fit ? <Note>{t("Not computed yet for this car.", "لم يُحسب لهذه السيارة بعد.")}</Note> : null}
          {viewerFitError ? <Note tone="danger">{viewerFitError}</Note> : null}
          {panel === "adjust" && r.fit ? <CorrectionPanel adj={adj} onChange={setAdj} view={view} setView={setView} check={savedCheck ?? check} checking={!savedCheck && !check} saved={!!savedCheck} rims={r.type === "RIMS"}
            canUndo={history.length > 0} onUndo={undo} onReset={() => setAdj(NO_ADJUST)} corrected={corrected} changed={changed} onSimilar={() => setSimilar(true)} onDone={() => { setPanel(null); setView("after"); }} />
            : r.fit && panel !== "wheels" ? <GButton variant="secondary" icon="move-outline" label={t("Correct the position", "تصحيح الموضع")} onPress={() => setPanel("adjust")} /> : null}
          {panel === "wheels" && r.type === "RIMS" && r.fit && !failed ? <Card style={{ gap: 6 }}>
            <View style={[row, { alignItems: "center" }]}>
              <GText style={[gType.label, align, { flex: 1, fontWeight: "800" }]}>{t("Wheel position", "موضع العجلات")}</GText>
              <GButton variant="ghost" label={t("Done", "تم")} onPress={() => setPanel(null)} />
            </View>
            <GText soft style={[gType.tiny, align]}>{t("Tyre face vs fender, before → after the automatic move (max 40 mm):", "وجه الإطار مقابل الرفرف، قبل ← بعد الحركة التلقائية (40 مم كحد أقصى):")}</GText>
            {wheels.map(w => { const notes = Object.keys(RIM_NOTES).filter(k => (w.warnings ?? []).includes(k)).map(k => t(...RIM_NOTES[k]!)); return <GText key={w.wheel} soft style={[gType.caption, align]}>
              {[`${t(...WHEEL_NAMES[w.wheel] ?? [w.wheel, w.wheel])}: ${clearText(w.archGapBeforeMm)} → ${clearText(w.archGapAfterMm)}`, ...notes].join(" · ")}</GText>; })}
            <GText style={[gType.label, align, { marginTop: 4 }]}>{t("Override (mm inward, this car, all rims)", "تعديل يدوي (مم للداخل، هذه السيارة، كل الجنوط)")}</GText>
            {(["front", "rear"] as const).map(ax => { const v = (inset ?? savedInset)[ax]; return <View key={ax} style={[row, { alignItems: "center", gap: 8 }]}>
              <GText style={[gType.label, align, { flex: 1 }]}>{ax === "front" ? t("Front axle", "المحور الأمامي") : t("Rear axle", "المحور الخلفي")}</GText>
              <GButton variant="secondary" label="−" onPress={() => setInset({ ...(inset ?? savedInset), [ax]: Math.max(0, v - 1) })} />
              <GText soft style={[gType.tiny, { width: 40, textAlign: "center", writingDirection: "ltr" }]}>{String(v)}</GText>
              <GButton variant="secondary" label="+" onPress={() => setInset({ ...(inset ?? savedInset), [ax]: Math.min(40, v + 1) })} />
            </View>; })}
            <View style={[row, { flexWrap: "wrap", gap: 8 }]}>
              <GButton label={t("Save override", "حفظ التعديل")} disabled={busy || !draft || (!draft.front && !draft.rear)} onPress={() => void saveInset(draft!)} />
              <GButton variant="secondary" label={t("Back to automatic", "العودة إلى التلقائي")} disabled={busy || !hasOverride} onPress={() => void saveInset({ front: 0, rear: 0 })} />
            </View>
            {draft ? <Note>{t("Previewing the draft: save it to refit every rim on this car.", "معاينة المسودة: احفظها لإعادة تركيب كل الجنوط على هذه السيارة.")}</Note> : hasOverride ? <Note>{t("This car uses your override.", "تستخدم هذه السيارة تعديلك.")}</Note> : null}
          </Card> : null}
          {changed && panel !== "adjust" ? <Note>{t("A position correction is applied. Approve to save it with the fit.", "تم تطبيق تصحيح للموضع. اعتمد لحفظه مع التركيب.")}</Note> : null}
        </> : null}
        {error ? <Note tone="danger">{error}</Note> : null}
      </View>
      {r ? <SimilarSheet visible={similar} onClose={() => { setSimilar(false); void fits.reload(); }} accessoryId={r.accessoryId} generationId={r.generation.id} adj={adj} /> : null}
    </Page>
  );
}

// ---------------- zone editor (fallback) ----------------
/** One car's zones, one task: pick a type, shape its boxes, save. Reset and the car's part map are in ⋮. */
function ZoneEditor({ carKey: key }: { carKey: string }) {
  const { t } = useL(); const { g, row, align } = useGarageTheme();
  const labels = useCarLabels();
  const list = useLoad(() => adminAccessoryApi.zones(), []);
  const { busy, error, work } = useWork();
  const [type, setType] = useState<AccessoryType>("FRONT_BUMPER");
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
  const name = labelFor(labels, key, model?.name ?? "", t);
  const inset = model?.zones[type]?.wheelInsetMm; // the RIMS wheel position (Fits tab) is kept when the box is saved / reset here
  const actions: ItemAction[] = model ? [
    { key: "reset", label: t("Reset this zone", "إعادة ضبط هذه المنطقة"), icon: "refresh", destructive: true, disabled: busy || !model.zones[type],
      run: () => work(() => adminAccessoryApi.setZone(model.key, type, inset ? { wheelInsetMm: inset } : null), list.reload) },
    { key: "map", label: t("Part map of this car", "خريطة قطع هذه السيارة"), icon: "git-network-outline", run: () => router.push(zonesHref("parts", key)) },
  ] : [];
  const footer = model ? <GButton label={t("Save zone", "حفظ المنطقة")} busy={busy} disabled={busy || !draft}
    onPress={() => void work(() => adminAccessoryApi.setZone(model.key, type, { ...draft, ...(inset ? { wheelInsetMm: inset } : {}) }), list.reload)} /> : undefined;
  return (
    <Page title={name.title || t("Zones", "المناطق")} line={name.sub || undefined} actions={actions} trail={[{ href: "/dept/accessory-zones", en: "Accessory fitting", ar: "تركيب الإكسسوارات" }]} footer={footer} onRefresh={() => void list.reload()} refreshing={list.loading && !!list.data}>
      <View style={{ gap: 12 }}>
        {list.error ? <Note tone="danger">{list.error}</Note> : null}
        {!list.data && !list.error ? <SkeletonRows count={4} /> : null}
        {list.data && !model ? <Note>{t("This car has no 3D model in the app catalog.", "لا يوجد نموذج ثلاثي الأبعاد لهذه السيارة في كتالوج التطبيق.")}</Note> : null}
        {model ? <>
          <GText soft style={[gType.caption, align]}>{t("Used while this car's part map is not confirmed, and for labels the map leaves empty.", "تُستخدم حتى تأكيد خريطة قطع هذه السيارة، وللتسميات التي تتركها الخريطة فارغة.")}</GText>
          <Rail gap={8}>{(Object.keys(ACCESSORY_TYPE_LABELS) as AccessoryType[]).map(k => <Chip key={k} label={t(...ACCESSORY_TYPE_LABELS[k])} on={type === k} onPress={() => setType(k)} />)}</Rail>
          {previewModel ? <Car3DView model={previewModel} color="#c3c7cc" bg={g.cardSoft} zonePreview={type} onZone={setZoneInfo} interactive style={{ height: 300, borderRadius: 16 }} />
            : <Note>{t("This car's 3D model is not in the app catalog yet: no live preview.", "نموذج هذه السيارة غير موجود في كتالوج التطبيق بعد: لا توجد معاينة مباشرة.")}</Note>}
          <Swatch color="#e53935" label={t("Red: the car's own part, hidden while the accessory is on", "الأحمر: قطعة السيارة الأصلية، تُخفى أثناء تركيب الإكسسوار")} />
          <Swatch color="#2e9d4f" label={t("Green: where the accessory goes", "الأخضر: مكان تركيب الإكسسوار")} />
          {zoneInfo ? <GText soft style={[gType.caption, align]}>{(zoneInfo.hidden ? `${t("Hidden", "مخفي")}: ${zoneInfo.hidden} · ${howLabel(zoneInfo.how)}` : t("Nothing of the car is hidden for this type.", "لا يُخفى شيء من السيارة لهذا النوع.")) + (zoneInfo.note ? ` · ${zoneInfo.note}` : "")}</GText> : null}
          <GText soft style={[gType.caption, align]}>{`${t("Current", "الحالية")}: ${source}${current?.meshes ? ` · ${current.meshes.length} ${t("meshes", "أجزاء")}` : ""}`}</GText>
          <GText style={[gType.label, align]}>{bodyKit ? t("Fit box (also what is hidden)", "صندوق التركيب (وهو أيضًا ما يُخفى)") : t("Where it goes", "مكان التركيب")}</GText>
          {fixedBox ? null : <Check label={t("Set the position with a box (else it is computed)", "حدّد المكان بصندوق (وإلا يُحسب تلقائيًا)")} checked={fitOn} onPress={() => setFitOn(v => !v)} />}
          {fitOn || fixedBox ? <BoxFields value={fit} onChange={v => { setFit(v); setFitOn(true); }} /> : null}
          {bodyKit ? <Note>{t("Bumpers / skirts: the car's own surface inside the box is hidden while the part is on, so keep it tight around the real part (an E36 front bumper: z 0.905–1, y 0–0.34).", "المصدات / التنانير: يُخفى سطح السيارة داخل الصندوق أثناء تركيب القطعة، فاجعله محكمًا حول القطعة الحقيقية (مصد E36 الأمامي: z 0.905–1، y 0–0.34).")}</Note> : null}
          {replaces ? <View style={{ gap: 8 }}>
            <GText style={[gType.label, align]}>{t("Car's own part to hide", "قطعة السيارة الأصلية المراد إخفاؤها")}</GText>
            <Check label={t("Cut it out with a box (when the model has no separate part)", "قصّها بصندوق (إذا لم تكن قطعة منفصلة في النموذج)")} checked={repOn} onPress={() => setRepOn(v => !v)} />
            {repOn ? <BoxFields value={rep} onChange={setRep} /> : null}
            {current?.replace?.meshes ? <GText soft style={[gType.caption, align]}>{`${t("Also hidden by name", "يُخفى أيضًا بالاسم")}: ${current.replace.meshes.length}`}</GText> : null}
            <Note>{t("Keep the box just above the body surface: everything of the car inside it disappears while the accessory is on, and comes back when it is off.", "اجعل الصندوق فوق سطح الهيكل مباشرة: كل ما بداخله من السيارة يختفي أثناء تركيب الإكسسوار ويعود عند إزالته.")}</Note>
          </View> : null}
        </> : null}
        {error ? <Note tone="danger">{error}</Note> : null}
      </View>
    </Page>
  );
}
