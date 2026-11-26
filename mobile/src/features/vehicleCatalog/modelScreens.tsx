// Parts admin 3D models on the one UI system: the 3D hub (Dashboard), every car with 3D (List: catalog models + open imports), one
// car model (Detail: facts, preview, provenance, viewer configuration; ONE primary = show / hide to customers; the rest in ⋮).
// Delete is permanent and shows what it affects first (AGENTS.md §4a).
import { router, useLocalSearchParams, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Chip, Field, GButton, GText, Note, Section, Sheet, StatusChip, Toggle, type Tone } from "../../components/garage";
import { FilterChips, ManageEntry, ManagePage, ManageRow } from "../../components/manage/ManagePage";
import { Block, Facts, NeedsRow, Page } from "../../components/manage/Page";
import { type ItemAction } from "../../components/ItemActionsMenu";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { gType, useGarageTheme } from "../../theme/garage";
import { GateSummary } from "../accessory3d/gate";
import { Car3DView } from "../car3d/Car3DView";
import { refreshRuntimeModels } from "../car3d/runtimeModels";
import { importActions, modelActions } from "../department/itemActions";
import { useThreeDCount } from "../department/partsAdmin";
import { vehicleCatalog, type ModelImport } from "./api";
import { GenerationUsage } from "./generationUsage";
import { threeDError } from "./lifecycleText";
import { modelApi, type DeleteImpact, type Managed3DModel, type ModelStatus } from "./modelApi";

const go = (path: string) => router.push(path as Href);
const STATUS: Record<ModelStatus, { en: string; ar: string; tone: Tone }> = {
  PUBLISHED: { en: "Published", ar: "منشور", tone: "success" }, HIDDEN: { en: "Hidden", ar: "مخفي", tone: "neutral" },
  IN_REVIEW: { en: "In review", ar: "قيد المراجعة", tone: "accent" }, FAILED: { en: "Failed", ar: "فشل", tone: "danger" },
};
const BODY_TYPES = [["sedan", "Sedan", "سيدان"], ["hatchback", "Hatchback", "هاتشباك"], ["suv", "SUV", "دفع رباعي"], ["van", "Van", "فان"], ["pickup", "Pickup", "بيك أب"]] as const;
const RUNNING = ["QUEUED", "DOWNLOADING", "CONVERTING", "OPTIMIZING", "VALIDATING", "GENERATING_PART_MAP"];
const importChip = (status: string, errorCode?: string | null): { en: string; ar: string; tone: Tone } => status === "READY" ? { en: "Ready for review", ar: "جاهز للمراجعة", tone: "accent" }
  : status === "FAILED" ? { en: "Import failed", ar: "فشل الاستيراد", tone: "danger" } : status === "DISCARDED" ? { en: "Discarded", ar: "مستبعد", tone: "neutral" }
  : status === "DRAFT" && errorCode ? { en: "Draft · needs you", ar: "مسودة · بحاجة إليك", tone: "warning" }
  : RUNNING.includes(status) ? { en: "Preparing", ar: "قيد التجهيز", tone: "neutral" } : { en: "Waiting for validation", ar: "بانتظار التحقق", tone: "warning" };

// ---------------- the 3D hub ----------------
export function ThreeDHub() {
  const { t } = useL();
  const { needs } = useThreeDCount();
  const imports = useLoad(vehicleCatalog.imports, [], 15000);
  const ready = (imports.data ?? []).filter(r => r.status === "READY" || r.status === "FAILED" || (r.status === "DRAFT" && !!r.errorCode)).length;
  return (
    <Page title={t("3D models", "النماذج ثلاثية الأبعاد")} line={t("Cars, accessories, part maps and fits", "السيارات والإكسسوارات وخرائط القطع والتركيب")} onRefresh={() => void imports.reload()} refreshing={false}>
      {needs || ready ? (
        <Section title={t("Needs you now", "بحاجة إليك الآن")}>
          <View style={{ gap: 8 }}>
            {needs ? <NeedsRow icon="cube-outline" title={t("3D requests waiting for you", "طلبات ثلاثية الأبعاد بانتظارك")} count={needs} onPress={() => go("/dept/3d/requests")} /> : null}
            {ready ? <NeedsRow icon="car-sport-outline" title={t("Car imports to review", "استيرادات سيارات للمراجعة")} count={ready} onPress={() => go("/dept/3d/vehicles?filter=IN_REVIEW")} /> : null}
          </View>
        </Section>
      ) : null}
      <View style={{ gap: 8 }}>
        <ManageEntry icon="add-circle-outline" title={t("Add 3D model", "إضافة نموذج ثلاثي الأبعاد")} sub={t("Sketchfab link or your own GLB", "رابط Sketchfab أو ملف GLB خاص بك")} onPress={() => go("/dept/3d/add")} />
        <ManageEntry icon="car-sport-outline" title={t("Car 3D models", "نماذج السيارات")} onPress={() => go("/dept/3d/vehicles")} />
        <ManageEntry icon="cube-outline" title={t("Accessory 3D models", "نماذج الإكسسوارات")} onPress={() => go("/dept/3d/accessories")} />
        <ManageEntry icon="document-text-outline" title={t("3D requests", "طلبات ثلاثية الأبعاد")} onPress={() => go("/dept/3d/requests")} />
        <ManageEntry icon="git-network-outline" title={t("Part maps", "خرائط القطع")} onPress={() => go("/dept/accessory-zones?mode=parts")} />
        <ManageEntry icon="construct-outline" title={t("Accessory fits", "تركيب الإكسسوارات")} onPress={() => go("/dept/accessory-zones?mode=fits")} />
        <ManageEntry icon="list-outline" title={t("Vehicle catalog", "كتالوج المركبات")} sub={t("Brands, models, generations", "الشركات والطرازات والأجيال")} onPress={() => go("/dept/vehicles")} />
      </View>
    </Page>
  );
}

/** "Limited: bumpers not separate" etc.: what this car's current model cannot show as a replacement part. */
const LIMIT_LABEL: Record<string, [string, string]> = { FRONT_BUMPER: ["front bumper", "المصد الأمامي"], REAR_BUMPER: ["rear bumper", "المصد الخلفي"], MIRROR_COVERS: ["mirror covers", "أغطية المرايا"], RIMS: ["rims", "الجنوط"], SIDE_SKIRTS: ["side skirts", "التنانير الجانبية"] };
export function LimitNote({ limits }: { limits: Partial<Record<string, string>>; generationId?: string; action?: boolean }) {
  const { t } = useL();
  const keys = Object.keys(limits);
  if (!keys.length) return null;
  const bumpers = keys.includes("FRONT_BUMPER") || keys.includes("REAR_BUMPER");
  return <Note tone="warning">{`${bumpers ? t("Limited: bumpers not separate", "محدود: المصدات غير منفصلة") : t("Limited parts", "قطع محدودة")}. ${t("Can't show a replacement", "لا يمكنه عرض بديل لـ")}: ${keys.map(k => t(...(LIMIT_LABEL[k] ?? [k, k]))).join(", ")}`}</Note>;
}

// ---------------- every car with 3D ----------------
type Filter = "ALL" | "PUBLISHED" | "HIDDEN" | "IN_REVIEW" | "FAILED";
type Row = { kind: "model"; m: Managed3DModel } | { kind: "import"; r: ModelImport };
export function VehicleModels() {
  const { t } = useL();
  const params = useLocalSearchParams<{ filter?: string }>();
  const data = useLoad(modelApi.list, [], 10000), imports = useLoad(vehicleCatalog.imports, [], 10000);
  const [q, setQ] = useState(""), [filter, setFilter] = useState<Filter>((["PUBLISHED", "HIDDEN", "IN_REVIEW", "FAILED"] as string[]).includes(params.filter ?? "") ? params.filter as Filter : "ALL");
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const hit = (s: string) => words.every(w => s.toLowerCase().includes(w));
  const rows: Row[] = [
    ...(imports.data ?? []).filter(r => r.status !== "PUBLISHED" && r.status !== "DISCARDED" && hit(`${r.make} ${r.model} ${r.code}`)).map(r => ({ kind: "import" as const, r })),
    ...(data.data ?? []).filter(m => hit(`${m.make} ${m.model} ${m.code}`)).map(m => ({ kind: "model" as const, m })),
  ];
  const bucket = (x: Row): Filter => x.kind === "model" ? x.m.status : x.r.status === "FAILED" ? "FAILED" : "IN_REVIEW";
  const shown = rows.filter(x => filter === "ALL" || bucket(x) === filter)
    .sort((a, b) => Number(bucket(b) === "IN_REVIEW" || bucket(b) === "FAILED") - Number(bucket(a) === "IN_REVIEW" || bucket(a) === "FAILED"));
  const count = (f: Filter) => rows.filter(x => f === "ALL" || bucket(x) === f).length;
  const published = (data.data ?? []).filter(m => m.status === "PUBLISHED").length;
  return (
    <ManagePage title={t("Car 3D models", "نماذج السيارات")} line={data.data ? t(`${data.data.length} models · ${published} published`, `${data.data.length} نموذج · ${published} منشور`) : undefined}
      search={{ value: q, onChange: setQ, placeholder: t("Search make, model or generation", "ابحث عن الشركة أو الطراز أو الجيل") }}
      filters={<FilterChips value={filter} onChange={setFilter} filters={(["ALL", "PUBLISHED", "HIDDEN", "IN_REVIEW", "FAILED"] as Filter[]).map(f => ({ key: f, label: f === "ALL" ? t("All", "الكل") : t(STATUS[f].en, STATUS[f].ar), count: data.data ? count(f) : undefined }))} />}
      above={<ManageEntry icon="add-circle-outline" title={t("Add 3D model", "إضافة نموذج ثلاثي الأبعاد")} onPress={() => go("/dept/3d/add")} />}
      items={shown} keyOf={x => (x.kind === "model" ? x.m.key : x.r.id)}
      renderItem={x => {
        if (x.kind === "import") { const c = importChip(x.r.status, x.r.errorCode); return <ManageRow title={`${x.r.make} ${x.r.model}`} status={{ label: t(c.en, c.ar), tone: c.tone }}
          sub={[x.r.code, t("Import", "استيراد"), x.r.source, new Date(x.r.createdAt).toLocaleDateString()].join(" · ")} onPress={() => go(`/dept/vehicles/imports/${x.r.id}`)} actions={importActions(t, x.r, () => imports.reload())} />; }
        const m = x.m;
        return <ManageRow title={`${m.make} ${m.model}`} status={{ label: t(STATUS[m.status].en, STATUS[m.status].ar), tone: STATUS[m.status].tone }}
          sub={[`${m.code} · ${m.yearFrom}–${m.yearTo}`, m.bytes === null ? t("file missing", "الملف مفقود") : `${(m.bytes / 1048576).toFixed(1)} MiB`, Object.keys(m.limits ?? {}).length ? t("limited parts", "قطع محدودة") : null].filter(Boolean).join(" · ")}
          onPress={() => go(`/dept/3d/vehicles/${m.key}`)} actions={modelActions(t, m, () => data.reload())} />;
      }}
      loading={!data.data && !data.error} error={data.error ? threeDError({ message: data.error }, t) : imports.error ? threeDError({ message: imports.error }, t) : null}
      onRetry={() => { void data.reload(); void imports.reload(); }}
      empty={{ text: q || filter !== "ALL" ? t("Nothing matches.", "لا توجد نتائج مطابقة.") : t("No car has a 3D model yet.", "لا توجد سيارة بنموذج ثلاثي الأبعاد بعد."), action: q || filter !== "ALL" ? { label: t("Clear filters", "مسح الفلاتر"), onPress: () => { setQ(""); setFilter("ALL"); } } : undefined }}
      onRefresh={() => { void data.reload(); void imports.reload(); }} refreshing={false}
      detailHint={t("Tap a car to open its 3D model.", "اضغط على سيارة لفتح نموذجها.")} />
  );
}

// ---------------- one car model ----------------
export function VehicleModelDetail() {
  const { key, preview, edit } = useLocalSearchParams<{ key: string; preview?: string; edit?: string }>();
  const { t } = useL();
  const data = useLoad(() => modelApi.get(key), [key]);
  const m = data.data;
  if (!m) return <Page title={t("Car 3D model", "نموذج سيارة")}>{data.error ? <Note tone="danger">{threeDError({ message: data.error }, t)}</Note> : <GText soft>{t("Loading…", "جارٍ التحميل…")}</GText>}</Page>;
  return <ModelBody key={`${key}-${m.revision}`} m={m} reload={data.reload} startPreview={preview === "1"} startEdit={edit === "1"} />;
}

function ModelBody({ m, reload, startPreview = false, startEdit = false }: { m: Managed3DModel; reload: () => Promise<unknown>; startPreview?: boolean; startEdit?: boolean }) {
  const { t } = useL();
  const { g, row, align } = useGarageTheme();
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [show, setShow] = useState(startPreview), [reviewed, setReviewed] = useState(false);
  const [editing, setEditing] = useState(startEdit), [deleting, setDeleting] = useState(false);
  const vc = m.viewerConfig as unknown as Record<string, unknown>;
  const [fields, setFields] = useState<Record<string, string>>(() => Object.fromEntries(["lengthM", "preRotateX", "rotateY", "groundOffset", "centerX"].map(k => [k, String(vc[k] ?? 0)])));
  const [paint, setPaint] = useState((m.viewerConfig.paintMaterials ?? []).join(", ")), [nodes, setNodes] = useState((m.viewerConfig.paintNodes ?? []).join(", "));
  const [keep, setKeep] = useState(!!m.viewerConfig.keepBox), [keepValues, setKeepValues] = useState([...(m.viewerConfig.keepBox?.y ?? [0, 1]), ...(m.viewerConfig.keepBox?.z ?? [0, 1])].map(String));
  const [baked, setBaked] = useState(!!m.viewerConfig.bakedPaint), [bakedValues, setBakedValues] = useState([...(m.viewerConfig.bakedPaint?.hue ?? [0, 360]), m.viewerConfig.bakedPaint?.sat ?? 0.2, m.viewerConfig.bakedPaint?.ref ?? 0.5].map(String));
  const work = async (fn: () => Promise<unknown>) => { setBusy(true); setError(null); try { await fn(); await refreshRuntimeModels(); await reload(); } catch (e) { setError(threeDError(e, t)); } finally { setBusy(false); } };
  const actions: ItemAction[] = [
    { key: "edit", label: t("Edit details", "تعديل التفاصيل"), icon: "create-outline", run: () => setEditing(true) },
    { key: "map", label: t("Edit / confirm part map", "تعديل / تأكيد خريطة القطع"), icon: "git-network-outline", run: () => go(`/dept/accessory-zones?key=${m.key}&mode=parts`) },
    { key: "zones", label: t("Accessory zones", "مناطق الإكسسوارات"), icon: "cube-outline", run: () => go(`/dept/accessory-zones?key=${m.key}&mode=zones`) },
    { key: "replace", label: t("Replace model", "استبدال النموذج"), icon: "swap-horizontal-outline", run: () => go(`/dept/3d/add?generationId=${m.generationId}`) },
    ...(m.importId ? [{ key: "source", label: t("View source validation", "عرض التحقق من المصدر"), icon: "document-text-outline" as const, run: () => go(`/dept/vehicles/imports/${m.importId}`) }] : []),
    { key: "delete", label: t("Delete 3D model…", "حذف النموذج ثلاثي الأبعاد…"), icon: "trash-outline", run: () => setDeleting(true) },
  ];
  const footer = (
    <View style={{ gap: 8 }}>
      {m.reviewRequired ? <Toggle label={t("I previewed and approve the changed geometry", "عاينتُ الشكل المعدّل وأوافق عليه")} value={reviewed} onChange={v => { if (show) setReviewed(v); }}
        sub={!show ? t("Open the preview first.", "افتح المعاينة أولًا.") : undefined} /> : null}
      <GButton variant={m.published ? "secondary" : "primary"} icon={m.published ? "eye-off-outline" : "eye-outline"} busy={busy}
        label={m.published ? t("Hide from customers", "إخفاء عن العملاء") : t("Show to customers", "إظهار للعملاء")} disabled={busy || !m.current || (!!m.reviewRequired && !reviewed)}
        onPress={() => void work(() => modelApi.publication(m.key, m.revision, !m.published, reviewed))} />
    </View>
  );
  const list = (s: string) => s.split(",").map(x => x.trim()).filter(Boolean);
  return (
    <Page title={`${m.make} ${m.model}`} line={`${m.code} · ${m.yearFrom}–${m.yearTo}`} actions={actions} footer={footer} onRefresh={() => void reload()} refreshing={false}>
      <View style={[row, { flexWrap: "wrap", gap: 8, alignItems: "center" }]}><StatusChip label={t(STATUS[m.status].en, STATUS[m.status].ar)} tone={STATUS[m.status].tone} /></View>
      {error ? <Note tone="danger">{error}</Note> : null}
      {m.current ? <LimitNote limits={m.limits ?? {}} /> : null}
      <Block title={t("Model", "النموذج")}>
        <Facts rows={[
          [t("Revision", "الإصدار"), String(m.revision)], [t("File size", "حجم الملف"), m.bytes === null ? t("File missing", "الملف مفقود") : `${(m.bytes / 1048576).toFixed(2)} MiB`],
          [t("Source", "المصدر"), m.source], [t("Part map", "خريطة القطع"), m.partMapStatus], [t("Paint", "الطلاء"), m.paintSupport ? t("Supported", "مدعوم") : t("Original finish", "اللون الأصلي")],
          [t("Created", "أُنشئ"), new Date(m.createdAt).toLocaleDateString()], [t("Updated", "حُدّث"), new Date(m.updatedAt).toLocaleDateString()],
        ]} />
      </Block>
      <Block title={t("Preview", "المعاينة")} action={<GButton variant="ghost" icon={show ? "eye-off-outline" : "cube-outline"} label={show ? t("Close preview", "إغلاق المعاينة") : t("Preview model", "معاينة النموذج")} onPress={() => setShow(!show)} />}>
        {show && m.bytes !== null ? <View style={{ paddingVertical: 8 }}><Car3DView model={m.viewerConfig} assetLoader={() => modelApi.asset(m.key)} interactive color="#c62828" bg={g.cardSoft} style={{ height: 310, borderRadius: 12 }} /></View>
          : <GText soft style={[gType.caption, align, { paddingVertical: 10 }]}>{m.bytes === null ? t("The model file is missing.", "ملف النموذج مفقود.") : t("Open the preview to check the model in 3D.", "افتح المعاينة لفحص النموذج ثلاثي الأبعاد.")}</GText>}
      </Block>
      <Block title={t("Provenance and rights", "المصدر والحقوق")}>
        <Facts rows={[[t("Title", "العنوان"), m.provenance.title], [t("Creator", "المنشئ"), m.provenance.author], [t("License", "الترخيص"), m.provenance.license],
          [t("Source link", "رابط المصدر"), m.provenance.url], [t("License link", "رابط الترخيص"), m.provenance.licenseUrl]]} />
        <View style={{ paddingVertical: 8 }}><GateSummary gate={m.qualityGate} /></View>
      </Block>
      <Block title={t("Viewer configuration", "إعدادات العارض")}>
        <View style={{ gap: 10, paddingVertical: 10 }}>
          {Object.entries(fields).map(([k, v]) => <Field key={k} label={k} value={v} onChangeText={s => setFields(f => ({ ...f, [k]: s }))} />)}
          <Field label={t("Paint materials (comma separated)", "خامات الطلاء (مفصولة بفواصل)")} value={paint} onChangeText={setPaint} />
          <Field label={t("Paint nodes (comma separated)", "عناصر الطلاء (مفصولة بفواصل)")} value={nodes} onChangeText={setNodes} />
          <Toggle label={t("Keep box enabled", "تفعيل منطقة إبقاء الهيكل")} value={keep} onChange={setKeep} />
          {keep ? keepValues.map((v, i) => <Field key={`k${i}`} label={["Y min", "Y max", "Z min", "Z max"][i]!} keyboardType="decimal-pad" value={v} onChangeText={s => setKeepValues(a => a.map((x, j) => (j === i ? s : x)))} />) : null}
          <Toggle label={t("Baked paint enabled", "تفعيل تلوين الخامة المدمجة")} value={baked} onChange={setBaked} />
          {baked ? bakedValues.map((v, i) => <Field key={`b${i}`} label={["Hue min", "Hue max", "Saturation", "Reference"][i]!} keyboardType="decimal-pad" value={v} onChangeText={s => setBakedValues(a => a.map((x, j) => (j === i ? s : x)))} />) : null}
          <Note>{t("Shape changes hide this car from customers until you preview and approve it again. Part maps and fits need renewed review.", "تُخفي تغييرات الشكل هذه السيارة عن العملاء إلى أن تعاينها وتعتمدها مجددًا. تحتاج خريطة القطع والتركيبات إلى مراجعة جديدة.")}</Note>
          <GButton variant="secondary" label={t("Validate and save configuration", "التحقق وحفظ الإعدادات")} disabled={busy || !m.current}
            onPress={() => void work(() => modelApi.configure(m.key, m.revision, { ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, Number(v)])), paintMaterials: list(paint), paintNodes: list(nodes),
              keepBox: keep ? { y: keepValues.slice(0, 2).map(Number), z: keepValues.slice(2).map(Number) } : null,
              bakedPaint: baked ? { hue: bakedValues.slice(0, 2).map(Number), sat: Number(bakedValues[2]), ref: Number(bakedValues[3]) } : null }))} />
        </View>
      </Block>
      <GenerationUsage id={m.generationId} isActive onDone={() => router.replace("/dept/3d/vehicles" as Href)} />
      <EditDetails m={m} visible={editing} onClose={() => setEditing(false)} busy={busy} work={work} />
      <DeleteModel m={m} visible={deleting} onClose={() => setDeleting(false)} />
    </Page>
  );
}

/** The car's details: names EN/AR, aliases (shared by the whole make), production years, body type. */
function EditDetails({ m, visible, onClose, busy, work }: { m: Managed3DModel; visible: boolean; onClose: () => void; busy: boolean; work: (fn: () => Promise<unknown>) => Promise<void> }) {
  const { t } = useL();
  const { row } = useGarageTheme();
  const [nameEn, setNameEn] = useState(m.nameEn), [nameAr, setNameAr] = useState(m.nameAr), [aliases, setAliases] = useState(m.aliases.join(", ")), [from, setFrom] = useState(String(m.yearFrom)), [to, setTo] = useState(String(m.yearTo)), [body, setBody] = useState(m.bodyType ?? "");
  const list = aliases.split(",").map(x => x.trim()).filter(Boolean), aliasChanged = list.join("|") !== m.aliases.join("|");
  return (
    <Sheet visible={visible} onClose={onClose} tall title={t("Edit details", "تعديل التفاصيل")} closeLabel={t("Close", "إغلاق")}>
      <View style={{ gap: 10 }}>
        <Field label={t("Name (English)", "الاسم (إنجليزي)")} value={nameEn} onChangeText={setNameEn} />
        <Field label={t("Name (Arabic)", "الاسم (عربي)")} value={nameAr} onChangeText={setNameAr} />
        {m.brandId ? <Field label={t("Make aliases, comma separated (shared by every model of this make)", "أسماء بديلة للشركة، مفصولة بفواصل (مشتركة بين كل طرازاتها)")} value={aliases} onChangeText={setAliases} /> : null}
        <Field label={t("Production year from", "سنة الإنتاج من")} keyboardType="number-pad" value={from} onChangeText={setFrom} />
        <Field label={t("Production year to", "سنة الإنتاج إلى")} keyboardType="number-pad" value={to} onChangeText={setTo} />
        <GText style={gType.label}>{t("Body type", "نوع الهيكل")}</GText>
        <View style={[row, { flexWrap: "wrap", gap: 8 }]}>{BODY_TYPES.map(([id, en, ar]) => <Chip key={id} label={t(en, ar)} on={body === id} onPress={() => setBody(id)} />)}</View>
        <GButton label={t("Save details", "حفظ التفاصيل")} busy={busy} disabled={busy || !nameEn.trim() || !nameAr.trim()} onPress={() => void work(async () => {
          await vehicleCatalog.save("generations", m.generationId, { nameEn: nameEn.trim(), nameAr: nameAr.trim(), yearFrom: Number(from), yearTo: Number(to), bodyType: body || null });
          if (aliasChanged && m.brandId) try { await vehicleCatalog.save("brands", m.brandId, { aliases: list }); } catch { throw new Error(t("Details saved, but aliases failed — try again", "تم حفظ التفاصيل، لكن فشل حفظ الأسماء البديلة — حاول مرة أخرى")); }
          onClose();
        })} />
      </View>
    </Sheet>
  );
}

/** Delete 3D model: permanent (GLB file, part map, zones, this car's accessory fits, its import). Shows what is affected, then asks to confirm. */
function DeleteModel({ m, visible, onClose }: { m: Managed3DModel; visible: boolean; onClose: () => void }) {
  const { t } = useL();
  const [impact, setImpact] = useState<DeleteImpact | null>(null), [sure, setSure] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<void>) => { setBusy(true); setError(null); try { await fn(); } catch (e) { setError(threeDError(e, t)); } finally { setBusy(false); } };
  const close = () => { setImpact(null); setSure(false); setError(null); onClose(); };
  const rows: [keyof DeleteImpact, string, string][] = [["garageCars", "Customer Garage cars of this generation lose the 3D view", "سيارات العملاء من هذا الجيل تفقد العرض ثلاثي الأبعاد"], ["shopAccessories", "Shop accessories for this car can no longer be shown on it", "إكسسوارات المتاجر لهذه السيارة لن تظهر عليها"], ["accessoryFits", "Accessory fits deleted", "تركيبات إكسسوارات تُحذف"], ["partMaps", "Part map deleted", "خريطة القطع تُحذف"], ["zones", "Accessory zones deleted", "مناطق الإكسسوارات تُحذف"], ["imports", "Import record deleted", "سجل الاستيراد يُحذف"]];
  useEffect(() => { if (visible && !impact) void run(async () => setImpact(await modelApi.deleteImpact(m.key))); }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Sheet visible={visible} onClose={close} title={t("Delete 3D model", "حذف النموذج ثلاثي الأبعاد")} closeLabel={t("Close", "إغلاق")}>
      <View style={{ gap: 10 }}>
        {!impact ? <GText soft>{error ? "" : t("Checking what is affected…", "جارٍ التحقق مما سيتأثر…")}</GText> : <>
          <Note tone="warning">{impact.published ? t("Customers see this model now. It disappears for them immediately.", "يرى العملاء هذا النموذج الآن، وسيختفي عنهم فورًا.") : t("This model is not shown to customers.", "هذا النموذج غير ظاهر للعملاء.")}</Note>
          <Facts rows={rows.filter(([k]) => Number(impact[k]) > 0).map(([k, en, ar]) => [t(en, ar), String(impact[k])] as [string, string])} />
          <GText soft>{t("The GLB file and these records are deleted permanently. This cannot be undone.", "يُحذف ملف GLB وهذه السجلات نهائيًا ولا يمكن التراجع.")}</GText>
          <Toggle label={t("I understand and want to delete this 3D model permanently", "أفهم ذلك وأريد حذف هذا النموذج نهائيًا")} value={sure} onChange={setSure} />
          <GButton variant="danger" label={t("Delete permanently", "حذف نهائي")} busy={busy} disabled={busy || !sure} onPress={() => void run(async () => { await modelApi.deleteModel(m.key); await refreshRuntimeModels(); close(); router.replace("/dept/3d/vehicles" as Href); })} />
        </>}
        {error ? <Note tone="danger">{error}</Note> : null}
      </View>
    </Sheet>
  );
}
