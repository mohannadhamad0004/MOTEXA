// Parts Admin: one accessory 3D request (/dept/accessory3d/[id]), a Detail page (docs/guide/10-ui-system.md). The progress line on top
// (Photos → 3D model → Checked → Fits approved → Published, progress.ts) names the current step; the sticky footer is its ONE next action;
// secondary actions are in ⋮. The fits are one summary row that opens the bulk fits screen; file sizes, limits and model info are in a
// collapsed "Technical details". Internal notes (fitment notes, admin review notes) stay in the data and are not shown here.
import { type Href, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { Pressable, TextInput, View } from "react-native";
import { GButton, GIcon, GText, Note, Sheet, SkeletonRows } from "../../components/garage";
import { type ItemAction } from "../../components/ItemActionsMenu";
import { ManageEntry } from "../../components/manage/ManagePage";
import { Block, Facts, Page } from "../../components/manage/Page";
import { ReasonSheet } from "../../components/manage/Form";
import { isoLatin } from "../../core/constants/bidi";
import { normalizeNumberText } from "../../core/constants/numbers";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { gShape, gType, useGarageTheme } from "../../theme/garage";
import { Car3DView } from "../car3d/Car3DView";
import { threeDError } from "../vehicleCatalog/lifecycleText";
import { ACCESSORY_TYPE_LABELS, adminAccessoryApi, typesForCategory, type AdminAccessory } from "./api";
import { sizeMismatches, SIZE_LABEL } from "./partSize";
import { accessoryProcessingLabel } from "./processing";
import { fitsLeftLine, fitsLine, progress, STATE_LABELS, STEP_LABELS, type NextAction, type Step, type StepKey } from "./progress";
import { REVIEW_LABELS, reviewRoute } from "./reviewState";
import { Check, fmtSize, PhotoStrip, PreviewGrid, sizeLabel } from "./screens";
import { SupportWarning } from "./support";
import { SLOT_LABELS, slotKind } from "./wizardArt";

type T = (en: string, ar: string) => string;
type Act = Parameters<typeof adminAccessoryApi.act>[1];

/** bytes -> "97 KB" / "8.0 MB" */
const fileSize = (b: unknown, t: T) => typeof b !== "number" ? null : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} ${t("KB", "ك.ب")}` : `${(b / 1048576).toFixed(1)} ${t("MB", "م.ب")}`;
const ltr = (s: string) => <GText selectable style={[gType.bodySm, { writingDirection: "ltr", textAlign: "left" }]}>{s}</GText>;

export function AdminAccessory3DDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, isArabic } = useL(); const { align } = useGarageTheme();
  const item = useLoad(() => adminAccessoryApi.get(id), [id], 6000);
  const a = item.data;
  const fitsOn = a?.status === "PUBLISHED" || a?.status === "READY_FOR_FINAL_REVIEW";
  const fitPage = useLoad(() => (fitsOn ? adminAccessoryApi.fitsPage(id, {}, 0, 1) : Promise.resolve(null)), [id, fitsOn], 15000);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"start" | "replace" | "publish" | "reject" | null>(null), [showModel, setShowModel] = useState(false);
  const act = async (action: Act, body?: Record<string, unknown>) => {
    setBusy(true); setError(null);
    try { await adminAccessoryApi.act(id, action, body); await Promise.all([item.reload(), fitPage.reload()]); }
    catch (e) { setError(threeDError(e, t)); }
    finally { setBusy(false); }
  };

  if (!a) return <Page title={t("3D request", "طلب النموذج")}>{item.error ? <Note tone="danger">{item.error}</Note> : <SkeletonRows count={5} />}</Page>;

  const p = progress(a, fitPage.data?.counts);
  const cur = p.steps.find(s => s.key === p.current) ?? null;
  const left = Math.max(0, a.monthlyCredits - a.creditsThisMonth);
  const fitsHref = (status?: string) => `/dept/accessory-fits?accessoryId=${encodeURIComponent(a.id)}${status ? `&status=${status}` : ""}` as Href;
  const reviewStatus = p.fits ? (p.fits.toReview ? "review" : p.fits.failed ? "failed" : p.fits.notComputed ? "not_computed" : undefined) : "review";

  // ---- the ONE next action (sticky footer)
  const primary = (x: NextAction): { label: string; icon: "checkmark-circle-outline" | "cube-outline" | "refresh-outline" | "shield-checkmark-outline" | "car-sport-outline" | "git-network-outline" | "images-outline" | "cloud-upload-outline" | "eye-outline"; run: () => void; disabled?: boolean } => {
    switch (x.kind) {
      case "approve": return { label: t("Approve photos for 3D", "الموافقة على الصور لإنشاء النموذج"), icon: "checkmark-circle-outline", run: () => void act("approve") };
      case "useShopModel": return { label: t("Use the shop's 3D file", "استخدام ملف المتجر ثلاثي الأبعاد"), icon: "cube-outline", run: () => void act("use-shop-model") };
      case "start": return { label: t("Start 3D generation", "بدء إنشاء النموذج") + (a.estimatedProviderCredits ? ` · ${a.estimatedProviderCredits} ${t("credits", "رصيد")}` : ""), icon: "cube-outline",
        disabled: a.generationErrorCode === "PROVIDER_REQUEST_UNCONFIRMED", run: () => (a.mode === "real" ? setSheet("start") : void act("start", { confirmPaid: false })) };
      case "resume": return { label: t("Resume the same task (no new charge)", "استئناف المهمة نفسها (دون تكلفة جديدة)"), icon: "refresh-outline", run: () => void act("start", {}) };
      case "retryProcessing": return { label: t("Retry processing", "إعادة معالجة النموذج"), icon: "refresh-outline", run: () => void act("start", { retryProcessing: true }) };
      case "validate": return { label: t("Run the model check", "تشغيل فحص النموذج"), icon: "shield-checkmark-outline", run: () => void act("validate") };
      case "runFit": return { label: t("Run automatic fit", "تشغيل التركيب التلقائي"), icon: "refresh-outline", run: () => void act("refit") };
      case "reviewFits": return { label: p.fits && p.fits.toReview + p.fits.failed ? t(`Review fits (${p.fits.toReview + p.fits.failed})`, `مراجعة التركيب (${p.fits.toReview + p.fits.failed})`) : t("Review fits", "مراجعة التركيب"),
        icon: "car-sport-outline", run: () => router.push(fitsHref(reviewStatus)) };
      case "partMap": return { label: t("Open the part map", "فتح خريطة القطع"), icon: "git-network-outline", run: () => router.push(reviewRoute(a.id, x.target, "parts") as Href) };
      case "preview": return { label: t("Render the final preview", "عرض المعاينة النهائية"), icon: "images-outline", run: () => void act("preview", { generationId: x.generationId }) };
      case "publish": return { label: t("Publish", "نشر"), icon: "cloud-upload-outline", run: () => setSheet("publish") };
      case "reactivate": return { label: t("Publish again", "إعادة النشر"), icon: "eye-outline", run: () => void act("reactivate") };
    }
  };
  const next = p.action ? primary(p.action) : null;
  const footer = next ? <GButton icon={next.icon} label={next.label} busy={busy} disabled={busy || !!next.disabled} onPress={next.run} /> : undefined;

  // ---- secondary actions (⋮)
  const shopFileUsable = !!a.shopModel && ["PENDING_REVIEW", "APPROVED_FOR_GENERATION", "READY_FOR_FINAL_REVIEW"].includes(a.status) && !a.published && !(a.provider === "MANUAL" && a.hasModel);
  const menu: ItemAction[] = [
    ...(shopFileUsable && p.action?.kind !== "useShopModel" ? [{ key: "shopfile", label: t("Use the shop's 3D file instead (no Meshy credits)", "استخدام ملف المتجر بدلًا من ذلك (دون رصيد Meshy)"), icon: "cube-outline" as const,
      hint: t("A model made earlier stays until this one is published, then it is deleted for good.", "يبقى أي نموذج سابق حتى يُنشر هذا، ثم يُحذف نهائيًا."), run: () => act("use-shop-model") }] : []),
    ...(a.status === "PENDING_REVIEW" && a.shopModel && a.partPhotos.length ? [{ key: "approve", label: t("Approve the photos for paid generation instead", "الموافقة على الصور للإنشاء المدفوع بدلًا من ذلك"), icon: "images-outline" as const, run: () => act("approve") }] : []),
    ...(a.status === "READY_FOR_FINAL_REVIEW" && a.provider === "MESHY" && a.providerState === "SUCCEEDED" ? [{ key: "regen", label: t("Generate a new 3D model (paid)", "إنشاء نموذج جديد (مدفوع)"), icon: "cube-outline" as const, run: () => setSheet("replace") }] : []),
    ...(fitsOn ? [{ key: "fits", label: t("All fits of this part", "كل تركيبات هذه القطعة"), icon: "car-sport-outline" as const, run: () => router.push(fitsHref()) }] : []),
    ...(["PENDING_REVIEW", "APPROVED_FOR_GENERATION", "READY_FOR_FINAL_REVIEW"].includes(a.status) ? [{ key: "reject", label: t("Reject (shop must change it)", "رفض (على المتجر التعديل)"), icon: "close-circle-outline" as const, run: () => setSheet("reject") }] : []),
    ...(a.status === "PUBLISHED" && !a.deactivatedAt ? [{ key: "unpublish", label: t("Unpublish model", "إلغاء نشر النموذج"), icon: "eye-off-outline" as const, destructive: true,
      confirm: { title: t("Unpublish this 3D model?", "إلغاء نشر هذا النموذج؟"), message: t("Customers stop seeing this part on their car until you publish it again.", "يتوقف العملاء عن رؤية هذه القطعة على سياراتهم حتى تنشرها مجددًا."), confirmLabel: t("Unpublish", "إلغاء النشر") },
      run: () => act("unpublish") }] : []),
    ...(a.hasModel && a.status !== "PUBLISHED" && a.status !== "GENERATING" ? [{ key: "discard", label: t("Delete this private 3D model", "حذف هذا النموذج الخاص"), icon: "trash-outline" as const, destructive: true,
      confirm: { title: t("Delete the private 3D model?", "حذف النموذج الخاص؟"), message: t("The model file and its previews are deleted for good.", "يُحذف ملف النموذج ومعايناته نهائيًا."), confirmLabel: t("Delete", "حذف") }, run: () => act("discard-candidate") }] : []),
  ];

  // ---- the current step, in words
  const stepNote = (s: Step) => {
    if (s.key === "model" && a.status === "GENERATING") { const l = accessoryProcessingLabel(a); return `${l ? t(...l) : t("Creating the 3D model…", "جارٍ إنشاء النموذج…")}${a.providerProgress !== null ? ` · ${a.providerProgress}%` : ""}`; }
    if (s.key === "fits" && p.fits && !s.note) return fitsLeftLine(p.fits, isArabic) || fitsLine(p.fits, isArabic);
    return s.note ? t(...s.note) : null;
  };
  const asides = p.steps.filter(s => s.key !== p.current && s.note && (s.state === "skipped" || s.state === "done")).map(s => t(...s.note!));
  const failure = a.failureReason && (a.lifecycleState === "FAILED" || a.status === "APPROVED_FOR_GENERATION") ? threeDError(a.generationErrorCode ? { code: a.generationErrorCode, message: a.failureReason } : { message: a.failureReason }, t) : null;
  const categoryOff = a.product && !typesForCategory(a.product.category).includes(a.accessoryType);
  const measured = a.fits.flatMap(f => { const L = SIZE_LABEL[a.accessoryType], m = L ? f.partSizes?.[L] : null; return m ? [{ f, m, off: sizeMismatches(a.accessoryType, a.size, m) }] : []; });

  return <Page title={a.product?.name ?? t("3D request", "طلب النموذج")} line={[a.product?.shop.shopName, t(...ACCESSORY_TYPE_LABELS[a.accessoryType])].filter(Boolean).join(" · ")}
    actions={menu} footer={footer} onRefresh={() => { void item.reload(); void fitPage.reload(); }} refreshing={item.loading}>
    <ProgressLine steps={p.steps} current={p.current} />
    {cur ? <Note tone={cur.state === "attention" ? "warning" : "accent"} icon={cur.state === "attention" ? "alert-circle-outline" : "arrow-forward-circle-outline"}>
      {[t(...STEP_LABELS[cur.key]), stepNote(cur)].filter(Boolean).join(": ")}</Note>
      : <Note tone="success" icon="checkmark-circle-outline">{t("Published: customers with these cars can see it on their car.", "منشورة: يراها العملاء أصحاب هذه السيارات على سياراتهم.")}</Note>}
    {asides.map(x => <GText key={x} soft style={[gType.caption, align]}>{x}</GText>)}
    {a.status === "REJECTED" && a.reviewNotes ? <Note tone="danger" icon="chatbox-ellipses-outline">{`${t("Sent to the shop", "أُرسل إلى المتجر")}: ${a.reviewNotes}`}</Note> : null}
    {failure ? <Note tone="warning">{failure}</Note> : null}
    {a.mock ? <Note>{t("Mock mode: a plain stand-in shape that tests the workflow. It can never be published.", "الوضع التجريبي: شكل بديل بسيط لاختبار الخطوات، ولا يمكن نشره أبدًا.")}</Note> : null}
    {categoryOff ? <Note tone="warning" icon="alert-circle-outline">{t("The product's category does not match this part type: check that the shop picked the right product.", "فئة المنتج لا تطابق نوع هذه القطعة: تأكد أن المتجر اختار المنتج الصحيح.")}</Note> : null}
    {error ? <Note tone="danger">{error}</Note> : null}
    {busy ? <GText soft style={[gType.caption, align]}>{t("Working… (rendering a preview takes up to a minute)", "جارٍ التنفيذ… (عرض المعاينة قد يستغرق دقيقة)")}</GText> : null}

    {fitsOn ? (fitPage.data ? <ManageEntry icon="car-sport-outline" title={t("Fits on cars", "التركيب على السيارات")}
      sub={p.fits && p.fits.total ? fitsLine(p.fits, isArabic) : t("No car of this part has a 3D model yet", "لا توجد سيارة لهذه القطعة بنموذج ثلاثي الأبعاد بعد")}
      onPress={() => router.push(fitsHref(p.fits && p.fits.toReview + p.fits.failed ? reviewStatus : undefined))} />
      : fitPage.error ? <Note tone="danger">{fitPage.error}</Note> : <SkeletonRows count={1} />) : null}

    {a.hasModel || a.preview ? <Block title={t("3D model", "النموذج ثلاثي الأبعاد")}>
      <View style={{ paddingVertical: 10, gap: 10 }}>
        {a.preview ? <PreviewGrid preview={a.preview} load={v => () => adminAccessoryApi.asset(a.id, v)} /> : null}
        {a.hasModel ? <GButton variant="secondary" icon="cube-outline" label={showModel ? t("Hide the 3D viewer", "إخفاء العارض") : t("Open the 3D viewer", "فتح العارض ثلاثي الأبعاد")} onPress={() => setShowModel(v => !v)} /> : null}
        {showModel ? <PartViewer a={a} /> : null}
      </View>
    </Block> : null}

    {a.partPhotos.length || a.installedPhotos.length ? <Block title={t("Photos", "الصور")}>
      <View style={{ paddingVertical: 10, gap: 8 }}>
        {a.partPhotos.length ? <PhotoStrip photos={a.partPhotos} load={pid => () => adminAccessoryApi.asset(a.id, pid)} labels={a.partPhotos.map(x => x.slot !== undefined ? t(...SLOT_LABELS[slotKind(a.accessoryType)][x.slot]!) : null)} /> : null}
        {a.installedPhotos.length ? <>
          <GText soft style={[gType.caption, align]}>{`${t("Installed on a car", "مركّبة على سيارة")}${a.installed360 ? " · 360°" : ""}`}</GText>
          <PhotoStrip photos={a.installedPhotos} load={pid => () => adminAccessoryApi.asset(a.id, pid)} />
        </> : null}
        {a.status === "PENDING_REVIEW" ? <GText soft style={[gType.caption, align]}>{t("Check: the real part, a plain background, nothing private (plates, faces), the installed car matches, the size is plausible. Approving also shows the installed photos to customers.", "تحقق: القطعة الحقيقية، خلفية سادة، لا شيء خاص (لوحات، وجوه)، السيارة في صور التركيب مطابقة، المقاس منطقي. الموافقة تُظهر صور التركيب للعملاء أيضًا.")}</GText> : null}
      </View>
    </Block> : null}

    <Block title={t("Real size", "المقاس الحقيقي")}>
      <Facts rows={Object.entries(a.size).filter(([, v]) => v !== null).map(([k, v]) => [t(...sizeLabel[k]!), String(v)] as [string, string])} />
      {Object.values(a.size).every(v => v === null) ? <View style={{ paddingVertical: 10 }}><Note tone="warning" icon="resize-outline">{t("Size not given by the shop: measure it (part-map editor or the model).", "لم يُدخل المتجر المقاس: قِسه (محرر خريطة القطع أو النموذج).")}</Note></View> : null}
      {measured.filter(x => x.off.length).map(({ f, m, off }) => <View key={f.id} style={{ paddingBottom: 10 }}><Note tone="warning">
        {`${isArabic ? f.nameAr : f.name}: ${t("the real size differs by more than 15% from the part measured on this car", "المقاس الحقيقي يختلف بأكثر من 15% عن القطعة المقاسة على هذه السيارة")} (${fmtSize(m)} ${t("mm", "مم")}): ${off.map(o => `${t(...sizeLabel[o.field]!)} ${o.shop} ≠ ${o.measured}`).join(" · ")}`}</Note></View>)}
      <SupportWarning type={a.accessoryType} generationIds={a.fits.map(f => f.id)} name={gid => { const f = a.fits.find(x => x.id === gid); return f ? (isArabic ? f.nameAr : f.name) : gid; }} />
    </Block>

    <Fold title={t("Technical details", "التفاصيل التقنية")}>
      <TechFacts a={a} />
      {a.product ? <Credits a={a} onSaved={() => void item.reload()} /> : null}
    </Fold>

    <StartSheet visible={sheet === "start" || sheet === "replace"} replace={sheet === "replace"} a={a} left={left} busy={busy} onClose={() => setSheet(null)}
      onConfirm={body => { setSheet(null); void act("start", body); }} />
    <PublishSheet visible={sheet === "publish"} a={a} busy={busy} onClose={() => setSheet(null)} onConfirm={() => { setSheet(null); void act("publish", { visuallyVerified: true, modelRevision: a.modelRevision }); }} />
    <ReasonSheet visible={sheet === "reject"} title={t("Reject (shop must change it)", "رفض (على المتجر التعديل)")} prompt={t("Notes to the shop (required)", "ملاحظات للمتجر (مطلوبة)")} confirmLabel={t("Reject", "رفض")} danger busy={busy}
      onCancel={() => setSheet(null)} onConfirm={why => { setSheet(null); void act("reject", { notes: why }); }} />
  </Page>;
}

/** Photos → 3D model → Checked → Fits approved → Published: one dot per step (✓ done, – skipped, ! needs you), the current one ringed. */
function ProgressLine({ steps, current }: { steps: Step[]; current: StepKey | null }) {
  const { t } = useL(); const { g, row } = useGarageTheme();
  const tone = (s: Step) => s.state === "done" || s.state === "skipped" ? g.success : s.state === "attention" ? g.warning : s.state === "now" ? g.accent : g.line;
  const icon = (s: Step) => s.state === "done" ? "checkmark" : s.state === "skipped" ? "remove" : s.state === "attention" ? "alert" : s.state === "now" ? "ellipse" : null;
  return <View accessibilityRole="progressbar" accessibilityLabel={steps.map(s => `${t(...STEP_LABELS[s.key])}: ${t(...STATE_LABELS[s.state])}`).join(", ")}
    style={[row, { alignItems: "flex-start", paddingVertical: 4 }]}>
    {steps.map((s, i) => { const on = s.key === current, c = tone(s), ic = icon(s), filled = s.state === "done";
      return <View key={s.key} style={{ flex: 1, alignItems: "center", gap: 4, minWidth: 0 }}>
        <View style={[row, { alignSelf: "stretch", alignItems: "center" }]}>
          <View style={{ flex: 1, height: 2, backgroundColor: i ? tone(steps[i - 1]!) === g.success ? g.success : g.line : "transparent" }} />
          <View style={{ width: on ? 32 : 26, height: on ? 32 : 26, borderRadius: 16, borderWidth: 2, borderColor: c, backgroundColor: filled ? c : on ? g.tint : g.card, alignItems: "center", justifyContent: "center" }}>
            {ic ? <GIcon name={ic} size={ic === "ellipse" ? 10 : 15} color={filled ? g.card : c} /> : null}
          </View>
          <View style={{ flex: 1, height: 2, backgroundColor: i < steps.length - 1 ? tone(s) === g.success ? g.success : g.line : "transparent" }} />
        </View>
        <GText numberOfLines={2} style={[gType.tiny, { textAlign: "center", fontWeight: on ? "800" : "600", color: on ? g.ink : g.soft }]}>{t(...STEP_LABELS[s.key])}</GText>
        <GText numberOfLines={1} style={[gType.tiny, { textAlign: "center", color: s.state === "todo" ? g.soft : c, fontWeight: "700" }]}>{t(...STATE_LABELS[s.state])}</GText>
      </View>; })}
  </View>;
}

/** A section that starts closed (Technical details). */
function Fold({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false); const { g, row, align } = useGarageTheme();
  return <View style={{ borderRadius: gShape.small, borderWidth: 1, borderColor: g.line, backgroundColor: g.card }}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={title} onPress={() => setOpen(v => !v)}
      style={[row, { minHeight: 52, alignItems: "center", gap: 10, paddingHorizontal: 14 }]}>
      <GText style={[gType.label, align, { flex: 1, fontWeight: "800" }]}>{title}</GText>
      <GIcon name={open ? "chevron-up" : "chevron-down"} size={18} color={g.soft} />
    </Pressable>
    {open ? <View style={{ paddingHorizontal: 14, paddingBottom: 12, borderTopWidth: 1, borderTopColor: g.line }}>{children}</View> : null}
  </View>;
}

/** File sizes in KB / MB, the limit, the source and the check: only what is recorded (no "—" rows, no contradiction with the progress line). */
function TechFacts({ a }: { a: AdminAccessory }) {
  const { t, isArabic } = useL();
  const pr = (a.processing ?? {}) as Record<string, unknown>, v = (a.validation ?? {}) as Record<string, unknown>, m = a.review?.model;
  const source = a.mock ? t("Mock stand-in", "شكل تجريبي") : a.provider === "MESHY" ? t("Generated with Meshy from the photos", "أُنشئ عبر Meshy من الصور")
    : a.shopModel && a.provider === "MANUAL" ? t("The shop's own 3D file", "ملف المتجر ثلاثي الأبعاد") : a.provider === "MANUAL" ? t("Imported 3D file", "ملف ثلاثي الأبعاد مستورد") : null;
  const optimizing = !m || !a.processing ? null : m.keptOriginal && !m.optimized ? t("Not needed: original kept (under 8 MB)", "غير مطلوب: أُبقي الملف الأصلي (أقل من 8 ميغابايت)") : m.optimized ? t("Done", "تم") : t("Not done", "لم يتم");
  const count = (x: unknown) => typeof x === "number" ? String(x) : null;
  return <Facts rows={[
    [t("Model source", "مصدر النموذج"), source],
    a.providerTaskId ? [t("Meshy task", "مهمة Meshy"), ltr(a.providerTaskId)] : null,
    [t("Source file", "الملف الأصلي"), fileSize(pr.rawBytes ?? v.bytes, t)],
    [t("Optimized file", "الملف بعد التحسين"), fileSize(pr.optimizedBytes, t)],
    [t("Size limit", "الحد الأقصى للحجم"), fileSize(pr.finalLimitBytes, t)],
    [t("Optimizing", "التحسين"), optimizing],
    [t("Model check", "فحص النموذج"), m ? (REVIEW_LABELS[m.validation] ? t(...REVIEW_LABELS[m.validation]!) : m.validation) : null],
    m?.validation !== "PASSED" && m?.reason ? [t("Why", "السبب"), m.reason] : null,
    [t("Triangles", "المثلثات"), count(v.triangles)],
    [t("Materials", "المواد"), count(v.materials)],
    [t("Model revision", "إصدار النموذج"), a.modelRevision ? ltr(a.modelRevision) : null],
    a.generationErrorCode ? [t("Error code", "رمز الخطأ"), ltr(a.generationErrorCode)] : null,
    a.providerState === "SUCCEEDED" && a.failureReason ? [t("Last error", "آخر خطأ"), ltr(a.failureReason)] : null,
    [t("Shop generations this month", "إنشاءات المتجر هذا الشهر"), isArabic ? isoLatin(`${a.creditsThisMonth} / ${a.monthlyCredits}`) : `${a.creditsThisMonth} / ${a.monthlyCredits}`],
  ]} />;
}

/** The shop's monthly cap of paid generations. */
function Credits({ a, onSaved }: { a: AdminAccessory; onSaved: () => void }) {
  const { t } = useL(); const { g, row, align } = useGarageTheme();
  const [cap, setCap] = useState(String(a.monthlyCredits)), [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);
  useEffect(() => { setCap(String(a.monthlyCredits)); }, [a.monthlyCredits]);
  const save = async () => { setBusy(true); setErr(null); try { await adminAccessoryApi.setCredits(a.product!.shop.id, Number(cap)); onSaved(); } catch (e) { setErr(threeDError(e, t)); } finally { setBusy(false); } };
  const label = t("Paid 3D generations per month for this shop", "إنشاءات مدفوعة شهريًا لهذا المتجر");
  return <View style={{ gap: 6, paddingTop: 10 }}>
    <GText style={[gType.label, align]}>{label}</GText>
    <View style={[row, { gap: 8, alignItems: "center" }]}>
      <TextInputBox label={label} value={cap} onChange={v => setCap(normalizeNumberText(v))} />
      <GButton variant="secondary" label={t("Save", "حفظ")} busy={busy} disabled={busy || cap === "" || Number(cap) === a.monthlyCredits} onPress={() => void save()} />
    </View>
    {err ? <GText style={[gType.caption, align, { color: g.danger }]}>{err}</GText> : null}
  </View>;
}
function TextInputBox({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const { g } = useGarageTheme();
  return <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} keyboardType="number-pad"
    style={{ flex: 1, minHeight: 48, borderWidth: 1, borderColor: g.line, borderRadius: 12, color: g.ink, paddingHorizontal: 12, backgroundColor: g.cardSoft, writingDirection: "ltr", textAlign: "left" }} />;
}

/** Paid generation (a new one, or a replacement of the current result): the cost is confirmed first. */
function StartSheet({ visible, replace, a, left, busy, onClose, onConfirm }: { visible: boolean; replace: boolean; a: AdminAccessory; left: number; busy: boolean; onClose: () => void; onConfirm: (body: Record<string, unknown>) => void }) {
  const { t } = useL(); const { align } = useGarageTheme();
  const [paid, setPaid] = useState(false);
  useEffect(() => { if (visible) setPaid(false); }, [visible]);
  const cost = a.estimatedProviderCredits ?? (replace ? 30 : null);
  return <Sheet visible={visible} onClose={onClose} title={replace ? t("Generate a new 3D model?", "إنشاء نموذج جديد؟") : t("Start 3D generation?", "بدء إنشاء النموذج؟")} closeLabel={t("Close", "إغلاق")}>
    <View style={{ gap: 12 }}>
      <GText style={[gType.body, align]}>{`${t("Shop generations this month", "إنشاءات المتجر هذا الشهر")}: ${a.creditsThisMonth} / ${a.monthlyCredits}`}</GText>
      {replace ? <Note tone="warning">{t("This creates a new Meshy task. The current result stays until the new model is published, then it is deleted for good.", "يُنشئ هذا مهمة Meshy جديدة. تبقى النتيجة الحالية حتى يُنشر النموذج الجديد، ثم تُحذف نهائيًا.")}</Note> : null}
      {!a.paidEnabled ? <Note tone="warning">{t("Meshy generation is unavailable. Check the backend key and generation setting.", "إنشاء Meshy غير متاح. تحقق من مفتاح الخادم وإعداد الإنشاء.")}</Note> : null}
      {left === 0 ? <Note tone="warning">{t("This shop has no paid generations left this month.", "لم يبقَ لهذا المتجر إنشاءات مدفوعة هذا الشهر.")}</Note> : null}
      <Check checked={paid} disabled={busy} onPress={() => setPaid(v => !v)} label={cost ? t(`I confirm one paid Meshy generation, estimated ${cost} Meshy credits.`, `أؤكد إنشاءً واحدًا مدفوعًا بتكلفة تقديرية ${cost} من رصيد Meshy.`) : t("I confirm one paid Meshy generation.", "أؤكد إنشاءً واحدًا مدفوعًا عبر Meshy.")} />
      <GButton icon="cube-outline" label={t("Confirm and start", "تأكيد وبدء الإنشاء")} disabled={busy || !paid || !a.paidEnabled || left === 0}
        onPress={() => onConfirm(replace ? { confirmPaid: true, replaceRevision: a.revision } : { confirmPaid: true })} />
      <GButton variant="ghost" label={t("Cancel", "إلغاء")} onPress={onClose} />
    </View>
  </Sheet>;
}

/** Publish: the six views, one confirmation, then publish. */
function PublishSheet({ visible, a, busy, onClose, onConfirm }: { visible: boolean; a: AdminAccessory; busy: boolean; onClose: () => void; onConfirm: () => void }) {
  const { t } = useL(); const { align } = useGarageTheme();
  const [ok, setOk] = useState(false);
  useEffect(() => { if (visible) setOk(false); }, [visible]);
  return <Sheet visible={visible} onClose={onClose} tall title={t("Publish this 3D model?", "هل تريد نشر هذا النموذج؟")} closeLabel={t("Close", "إغلاق")}>
    <View style={{ gap: 12 }}>
      {a.preview ? <PreviewGrid preview={a.preview} load={v => () => adminAccessoryApi.asset(a.id, v)} /> : null}
      <GText style={[gType.body, align]}>{t("After publishing, customers with these cars can use View on my car.", "بعد النشر، يستطيع العملاء أصحاب هذه السيارات استخدام «العرض على سيارتي».")}</GText>
      <Check checked={ok} disabled={busy} onPress={() => setOk(v => !v)} label={t("I reviewed all six views: the real part, orientation, size and fit are correct.", "راجعت المناظر الستة: القطعة الحقيقية واتجاهها وحجمها وتركيبها صحيحة.")} />
      <GButton icon="cloud-upload-outline" label={t("Publish", "نشر")} busy={busy} disabled={busy || !ok || !a.review?.publication.canPublish} onPress={onConfirm} />
      <GButton variant="ghost" label={t("Cancel", "إلغاء")} onPress={onClose} />
    </View>
  </Sheet>;
}

/** The part alone in the viewer (private file while unpublished). */
function PartViewer({ a }: { a: AdminAccessory }) {
  const { g } = useGarageTheme();
  const file = a.review?.publication.file;
  const none = { x: 0, y: 0, z: 0, scale: 1 };
  return <Car3DView model={{ key: file?.replace(/\.glb$/, "") ?? `private-accessory-${a.id}-${a.modelRevision}`, generation: a.product?.name ?? "", lengthM: 1.7, rotateY: 0, groundOffset: 0, paintNodes: [], paintMaterials: [], rimsSwappable: false, wing: none, rack: none,
    credit: { title: a.product?.name ?? "", author: "", url: "", license: a.status === "PUBLISHED" ? "Published accessory" : "Private review" } }}
    assetLoader={file ? undefined : () => adminAccessoryApi.asset(a.id, "model")} color="#c3c7cc" bg={g.cardSoft} interactive style={{ height: 280, borderRadius: 16 }} />;
}
