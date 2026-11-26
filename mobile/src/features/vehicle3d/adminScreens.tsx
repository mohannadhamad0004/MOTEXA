// Parts Admin review of customers' car 3D submissions (/dept/3d-submissions, /dept/vehicle3d) on the one UI system: a List with one
// status chip row (pending review first) and a Detail with ONE primary action (Validate and approve; the server repeats every check),
// the rest in ⋮: validate again, the two orientation corrections, reject and request regeneration (both need review notes).
import { router, useLocalSearchParams, type Href } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Field, GButton, GText, Note, StatusChip, Toggle, type Tone } from "../../components/garage";
import { ReasonSheet } from "../../components/manage/Form";
import { FilterChips, ManagePage, ManageRow } from "../../components/manage/ManagePage";
import { Block, Facts, Page } from "../../components/manage/Page";
import { type ItemAction } from "../../components/ItemActionsMenu";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { gType, useGarageTheme } from "../../theme/garage";
import { refreshRuntimeModels } from "../car3d/runtimeModels";
import { submissionApi, views, type Submission } from "./api";
import { ModelPreview, Photo, statusLabels, validationArabic } from "./submission";

const TONE: Record<Submission["status"], Tone> = { DRAFT: "neutral", PROCESSING: "neutral", READY: "accent", SUBMITTED: "accent", APPROVED: "success", REJECTED: "danger", FAILED: "danger" };
const FILTERS: readonly [string, string, string][] = [["SUBMITTED", "Pending review", "قيد المراجعة"], ["PROCESSING", "Generating", "جارٍ الإنشاء"], ["FAILED", "Failed", "فشل الإنشاء"], ["APPROVED", "Approved", "معتمد"], ["ALL", "All", "الكل"]];

export function AdminVehicle3DList() {
  const { t } = useL();
  const list = useLoad(() => submissionApi.list(true), [], 15000);
  const [filter, setFilter] = useState("SUBMITTED"), [q, setQ] = useState("");
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matching = (list.data ?? []).filter(s => { const hay = `${s.make} ${s.model} ${s.year} ${s.generationName}`.toLowerCase(); return words.every(w => hay.includes(w)); });
  // "Rejected" folds into All (one chip row, max ~5)
  const rows = matching.filter(s => filter === "ALL" || s.status === filter).sort((a, b) => Number(b.status === "SUBMITTED") - Number(a.status === "SUBMITTED") || String(b.submittedAt ?? "").localeCompare(String(a.submittedAt ?? "")));
  const pending = (list.data ?? []).filter(s => s.status === "SUBMITTED").length;
  return (
    <ManagePage title={t("Customer car 3D", "نماذج سيارات العملاء")} line={list.data ? t(`${pending} waiting for review`, `${pending} بانتظار المراجعة`) : undefined}
      search={{ value: q, onChange: setQ, placeholder: t("Search make, model or year", "ابحث عن الشركة أو الطراز أو السنة") }}
      filters={<FilterChips value={filter} onChange={setFilter} filters={FILTERS.map(([key, en, ar]) => ({ key, label: t(en, ar), count: list.data ? matching.filter(s => key === "ALL" || s.status === key).length : undefined }))} />}
      items={rows} keyOf={s => s.id}
      renderItem={s => <ManageRow title={`${s.make} ${s.model} · ${s.year}`} status={{ label: t(statusLabels[s.status][0], statusLabels[s.status][1]), tone: TONE[s.status] }}
        sub={[s.generationName, s.submittedAt ? new Date(s.submittedAt).toLocaleDateString() : null, s.hasModel ? t("model ready", "النموذج جاهز") : t("no model yet", "لا يوجد نموذج")].filter(Boolean).join(" · ")}
        onPress={() => router.push(`/dept/3d-submissions/${s.id}` as Href)} />}
      loading={!list.data && !list.error} error={list.error ? t("Could not load submissions. Parts Admin access is required.", "تعذّر تحميل الطلبات. يلزم صلاحية إدارة قطع الغيار.") : null} onRetry={() => void list.reload()}
      empty={{ text: t("No models in this state.", "لا توجد نماذج بهذه الحالة."), action: filter !== "ALL" || q ? { label: t("Show all", "عرض الكل"), onPress: () => { setFilter("ALL"); setQ(""); } } : undefined }}
      onRefresh={() => void list.reload()} refreshing={false}
      detailHint={t("Tap a submission to verify it.", "اضغط على طلب للتحقق منه.")} />
  );
}

export function AdminVehicle3DDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useL();
  const item = useLoad(() => submissionApi.get(id, true), [id]);
  const s = item.data;
  if (!s) return <Page title={t("Verify vehicle model", "التحقق من نموذج المركبة")}>{item.error ? <Note tone="danger">{t("Submission unavailable or access denied.", "الطلب غير متاح أو لا تملك الصلاحية.")}</Note> : <GText soft>{t("Loading…", "جارٍ التحميل…")}</GText>}</Page>;
  return <Review key={JSON.stringify([s.id, s.modelRevision, s.existingModel3dKey])} s={s} reload={item.reload} />;
}

function Review({ s, reload }: { s: Submission; reload: () => Promise<unknown> }) {
  const { t } = useL();
  const { row, align } = useGarageTheme();
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [showModel, setShowModel] = useState(true);
  const [verified, setVerified] = useState(false), [replace, setReplace] = useState(false), [ask, setAsk] = useState<null | "reject" | "regenerate">(null), [notes, setNotes] = useState("");
  const work = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await fn(); await reload(); }
    catch (e) { const message = (e as Error).message; setError(t(message || "Request failed. Try again.", validationArabic[message] ?? "تعذّر إكمال الطلب. تحقق من الصور والصلاحيات وأعد المحاولة.")); }
    finally { setBusy(false); }
  };
  const canFix = s.status !== "APPROVED" && (s.hasModel || s.hasRawModel);
  const reviewing = s.status === "SUBMITTED";
  const actions: ItemAction[] = [
    ...(canFix ? [
      { key: "validate", label: t("Validate again", "إعادة التحقق"), icon: "refresh-outline" as const, disabled: busy, run: () => work(async () => { setVerified(false); await submissionApi.validate(s.id); }) },
      { key: "front", label: t("Turn front by 180°", "تدوير المقدمة ١٨٠ درجة"), icon: "swap-horizontal-outline" as const, disabled: busy, run: () => work(async () => { setVerified(false); await submissionApi.validate(s.id, { ...s.preparationConfig, rotateY: Math.abs(s.preparationConfig?.rotateY ?? 0) < 0.01 ? Math.PI : 0 }); }) },
      { key: "up", label: t("Correct source up-axis −90°", "تصحيح المحور الرأسي −٩٠ درجة"), icon: "reload-outline" as const, disabled: busy, run: () => work(async () => { setVerified(false); await submissionApi.validate(s.id, { ...s.preparationConfig, preRotateX: -Math.PI / 2 }); }) },
    ] : []),
    ...(reviewing ? [
      { key: "regenerate", label: t("Request regeneration", "طلب إعادة الإنشاء"), icon: "sync-outline" as const, run: () => setAsk("regenerate") },
      { key: "reject", label: t("Reject", "رفض"), icon: "close-circle-outline" as const, run: () => setAsk("reject") },
    ] : []),
  ];
  const footer = reviewing ? (
    <View style={{ gap: 8 }}>
      <Toggle label={t("I verified brand, model, generation/body, approximate year, orientation, geometry, wheels, grounding, no unrelated scenery, visual quality and source rights.", "تحققت من الشركة والطراز والجيل والهيكل والسنة التقريبية والاتجاه والهندسة والعجلات والأرضية وعدم وجود مشاهد غريبة والجودة البصرية وحقوق المصدر.")}
        value={verified} onChange={v => { if (showModel && !busy) setVerified(v); }} sub={!showModel ? t("Open the 3D preview first.", "افتح العرض ثلاثي الأبعاد أولًا.") : undefined} />
      {s.existingModel3dKey ? <Toggle label={t("Replace existing model", "استبدال النموذج الحالي")} value={replace} onChange={v => !busy && setReplace(v)} /> : null}
      <GButton icon="checkmark-circle-outline" label={t("Validate and approve", "التحقق والموافقة")} busy={busy} disabled={busy || !verified || s.provider !== "MESHY" || (!!s.existingModel3dKey && !replace)}
        onPress={() => void work(async () => { await submissionApi.review(s.id, "approve", { notes, visuallyVerified: verified, modelRevision: s.modelRevision, ...(replace ? { replaceExistingKey: s.existingModel3dKey } : {}) }); await refreshRuntimeModels(); })} />
    </View>
  ) : undefined;
  return (
    <Page title={`${s.make} ${s.model} · ${s.year}`} line={s.generationName || t("Generation not selected", "لم يتم تحديد الجيل")} actions={actions} footer={footer} onRefresh={() => void reload()} refreshing={false}>
      <View style={[row, { gap: 8 }]}><StatusChip label={t(statusLabels[s.status][0], statusLabels[s.status][1])} tone={TONE[s.status]} /></View>
      {error ? <Note tone="danger">{error}</Note> : null}
      {s.reviewNotes ? <Note>{s.reviewNotes}</Note> : null}
      {s.status === "FAILED" ? <Note tone="danger">{t(s.failureReason ?? "Generation failed. Try clearer photos.", "تعذّر إنشاء النموذج. جرّب صورًا أوضح ثم أعد المحاولة.")}</Note> : null}
      {s.existingModel3dKey && reviewing ? <Note>{t("This generation already has a shared model. Approval requires explicit replacement.", "يوجد نموذج مشترك لهذا الجيل. تتطلب الموافقة استبداله صراحةً.")}</Note> : null}
      {reviewing ? <Field label={t("Review notes (optional for approval)", "ملاحظات المراجعة (اختيارية عند الموافقة)")} value={notes} onChangeText={setNotes} multiline maxLength={2000} /> : null}
      <Block title={t("Submission", "الطلب")}>
        <Facts rows={[
          [t("Provider", "مزود الإنشاء"), s.provider === "MESHY" ? "Meshy" : s.provider === "MOCK" ? t("Demo / mock", "تجريبي") : "—"],
          [t("Submitted", "تاريخ الإرسال"), s.submittedAt ? new Date(s.submittedAt).toLocaleDateString() : ""],
          [t("Validation", "التحقق"), s.validation ? (s.validation.valid ? t("Passed technical validation; visual check still required", "اجتاز الفحوص التقنية؛ ما زالت المراجعة البصرية مطلوبة") : t("Not passed", "لم يجتز")) : ""],
          [t("File size", "حجم الملف"), typeof s.validation?.bytes === "number" ? `${(s.validation.bytes / 1048576).toFixed(2)} MB` : ""],
          [t("Dimensions / metres", "الأبعاد / متر"), Array.isArray(s.validation?.dimensions) ? (s.validation!.dimensions as unknown[]).map(n => Number(n).toFixed(2)).join(" × ") : ""],
          [t("Error code", "رمز الخطأ"), s.generationErrorCode ?? ""], [t("Submission id", "معرّف الطلب"), s.id],
        ]} />
      </Block>
      {s.hasModel ? (
        <Block title={t("3D model", "النموذج ثلاثي الأبعاد")} action={<GButton variant="ghost" label={showModel ? t("Hide", "إخفاء") : t("Show", "عرض")} onPress={() => setShowModel(v => !v)} />}>
          {showModel ? <View style={{ paddingVertical: 8 }}><ModelPreview key={s.modelRevision} s={s} admin /></View> : <GText soft style={[gType.caption, align, { paddingVertical: 10 }]}>{t("Open the preview to verify the model.", "افتح المعاينة للتحقق من النموذج.")}</GText>}
        </Block>
      ) : null}
      <Block title={t("Photos", "الصور")}>
        <View style={{ gap: 10, paddingVertical: 8 }}>{views.map(view => <Photo key={`${view}:${s.photoRevision}`} s={s} view={view} admin />)}</View>
      </Block>
      <GText soft style={[gType.caption, align]}>{t("Meshy provenance and customer permission are recorded privately. Customer identity and provider task IDs are excluded from the shared catalog.", "يُحفظ مصدر Meshy وإذن العميل بشكل خاص. لا تظهر هوية العميل ومعرف المهمة في الكتالوج المشترك.")}</GText>
      <ReasonSheet visible={ask === "reject"} title={t("Reject this submission", "رفض هذا الطلب")} prompt={t("Review notes (required). The customer will see them.", "ملاحظات المراجعة (مطلوبة). سيراها العميل.")} confirmLabel={t("Reject", "رفض")} danger busy={busy}
        onCancel={() => setAsk(null)} onConfirm={notes => void work(() => submissionApi.review(s.id, "reject", { notes })).then(() => setAsk(null))} />
      <ReasonSheet visible={ask === "regenerate"} title={t("Request regeneration", "طلب إعادة الإنشاء")} prompt={t("What should change? (required)", "ما الذي يجب تغييره؟ (مطلوب)")} confirmLabel={t("Request regeneration", "طلب إعادة الإنشاء")} busy={busy}
        onCancel={() => setAsk(null)} onConfirm={notes => void work(() => submissionApi.requestRegeneration(s.id, notes)).then(() => setAsk(null))} />
    </Page>
  );
}
