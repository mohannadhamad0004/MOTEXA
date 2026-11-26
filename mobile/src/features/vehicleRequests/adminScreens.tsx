// Parts Admin side of customers' "request my car" (/dept/vehicles/requests, /dept/vehicles/:id) on the one UI system. The customer's
// own screens stay in screens.tsx. Detail: ONE primary action that follows the request's state; reject and a new attempt are in ⋮.
import { router, useLocalSearchParams, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Field, GButton, GText, Note, StatusChip, Toggle, type Tone } from "../../components/garage";
import { ReasonSheet, SmartPicker } from "../../components/manage/Form";
import { FilterChips, ManageEntry, ManagePage, ManageRow } from "../../components/manage/ManagePage";
import { Block, Facts, Page } from "../../components/manage/Page";
import { type ItemAction } from "../../components/ItemActionsMenu";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { gType, useGarageTheme } from "../../theme/garage";
import { catalogService } from "../catalog/catalogService";
import { refreshGarage } from "../catalog/myCar";
import { refreshRuntimeModels } from "../car3d/runtimeModels";
import { ModelPreview, Photo } from "../vehicle3d/submission";
import { vehicleCatalog } from "../vehicleCatalog/api";
import { threeDError } from "../vehicleCatalog/lifecycleText";
import { requestLabels, vehicleRequests, type VehicleRequest } from "./api";

const go = (path: string) => router.push(path as Href);
const GROUPS: { key: string; en: string; ar: string; of: string[] | null }[] = [
  { key: "ALL", en: "All", ar: "الكل", of: null },
  { key: "REVIEW", en: "Pending review", ar: "بانتظار المراجعة", of: ["PENDING_REVIEW"] },
  { key: "GEN", en: "Generating", ar: "قيد الإنشاء", of: ["APPROVED_FOR_GENERATION", "GENERATING", "PREPARING", "GENERATION_FAILED"] },
  { key: "FINAL", en: "Final review", ar: "المراجعة النهائية", of: ["READY_FOR_FINAL_REVIEW", "FINAL_REVIEW"] },
  { key: "DONE", en: "Done", ar: "منتهية", of: ["PUBLISHED", "REJECTED"] },
];
const RANK: Record<string, number> = { PENDING_REVIEW: 0, READY_FOR_FINAL_REVIEW: 1, FINAL_REVIEW: 1, GENERATION_FAILED: 2 };
const tone = (s: string): Tone => (s === "PUBLISHED" ? "success" : s === "REJECTED" || s === "GENERATION_FAILED" ? "danger" : s === "PENDING_REVIEW" || s.includes("FINAL") ? "accent" : "neutral");
const label = (t: (en: string, ar: string) => string, s: string) => t(...(requestLabels[s] ?? requestLabels.DRAFT!));

export function AdminVehicleRequestList() {
  const { t } = useL();
  const list = useLoad(() => vehicleRequests.list(true), [], 10000);
  const [group, setGroup] = useState("ALL"), [q, setQ] = useState("");
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matching = (list.data ?? []).filter(r => { const hay = `${r.requestedMake} ${r.requestedModel} ${r.requestedYear} ${r.generationName ?? ""}`.toLowerCase(); return words.every(w => hay.includes(w)); });
  const g = GROUPS.find(x => x.key === group)!;
  const rows = matching.filter(r => !g.of || g.of.includes(r.requestStatus)).sort((a, b) => (RANK[a.requestStatus] ?? 9) - (RANK[b.requestStatus] ?? 9) || String(b.createdAt).localeCompare(String(a.createdAt)));
  const pending = (list.data ?? []).filter(r => r.requestStatus === "PENDING_REVIEW").length;
  return (
    <ManagePage title={t("Vehicle requests", "طلبات المركبات")} line={list.data ? t(`${list.data.length} requests · ${pending} to review`, `${list.data.length} طلب · ${pending} للمراجعة`) : undefined}
      search={{ value: q, onChange: setQ, placeholder: t("Search make, model or year", "ابحث عن الشركة أو الطراز أو السنة") }}
      filters={<FilterChips value={group} onChange={setGroup} filters={GROUPS.map(x => ({ key: x.key, label: t(x.en, x.ar), count: list.data ? matching.filter(r => !x.of || x.of.includes(r.requestStatus)).length : undefined }))} />}
      items={rows} keyOf={r => r.id}
      renderItem={r => <ManageRow title={`${r.requestedMake} ${r.requestedModel} ${r.requestedYear}`} status={{ label: label(t, r.requestStatus), tone: tone(r.requestStatus) }}
        sub={[r.generationId ? r.generationName : t("not linked to the catalog yet", "غير مرتبط بالكتالوج بعد"), r.demandCount ? t(`${r.demandCount} customers asked`, `${r.demandCount} عملاء طلبوها`) : null, new Date(r.createdAt).toLocaleDateString()].filter(Boolean).join(" · ")}
        onPress={() => go(`/dept/vehicles/${r.id}`)} />}
      loading={!list.data && !list.error} error={list.error ? t("Could not load requests. Refresh to retry.", "تعذّر تحميل الطلبات. حدّث للمحاولة.") : null} onRetry={() => void list.reload()}
      empty={{ text: t("No vehicle requests here.", "لا توجد طلبات مركبات هنا."), action: group !== "ALL" || q ? { label: t("Show all", "عرض الكل"), onPress: () => { setGroup("ALL"); setQ(""); } } : undefined }}
      onRefresh={() => void list.reload()} refreshing={false}
      detailHint={t("Tap a request to review it.", "اضغط على طلب لمراجعته.")} />
  );
}

export function AdminVehicleRequestDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useL();
  const item = useLoad(() => vehicleRequests.get(id, true), [id], 5000);
  const r = item.data;
  if (!r) return <Page title={t("Vehicle request", "طلب مركبة")}>{item.error ? <Note tone="danger">{t("Could not load this request.", "تعذّر تحميل هذا الطلب.")}</Note> : <GText soft>{t("Loading…", "جارٍ التحميل…")}</GText>}</Page>;
  return <Review key={r.id} r={r} reload={item.reload} />;
}

function Review({ r, reload }: { r: VehicleRequest; reload: () => Promise<unknown> }) {
  const { t } = useL();
  const { row, align } = useGarageTheme();
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [showModel, setShowModel] = useState(true);
  const [notes, setNotes] = useState(""), [generationId, setGenerationId] = useState(r.generationId ?? ""), [year, setYear] = useState(String(r.year)), [replacement, setReplacement] = useState(false), [rejecting, setRejecting] = useState(false);
  const taxonomy = useLoad(() => vehicleCatalog.list(), []);
  const suggestions = useLoad(() => vehicleCatalog.suggestions(r.requestedMake, r.requestedModel, r.requestedYear), [r.id, r.generationId]);
  const gens = taxonomy.data?.vehicles.flatMap(v => v.generations.map(g => ({ id: g.id, label: `${v.displayMake} ${v.model} · ${g.code}`, sub: `${g.yearFrom}–${g.yearTo}` }))) ?? [];
  const work = async (fn: () => Promise<unknown>) => { setBusy(true); setError(null); try { await fn(); await reload(); } catch (e) { setError(threeDError(e, t)); } finally { setBusy(false); } };
  useEffect(() => { if (r.requestStatus === "PUBLISHED") { catalogService.invalidateVehicleList(); void refreshGarage(); void refreshRuntimeModels(); } }, [r.requestStatus]);
  const s = { ...r, id: r.submissionId };
  const reviewing = r.initialReviewState === "PENDING_REVIEW";
  const reason = r.status === "REJECTED" ? r.reviewNotes ?? r.initialReviewNotes : r.initialReviewNotes ?? r.reviewNotes;
  const footer = reviewing ? (
    <View style={{ gap: 8 }}>
      {r.existingModel3dKey ? <Toggle label={t("This generation already has a model. I am intentionally requesting a replacement candidate.", "يوجد نموذج لهذا الجيل. أطلب نموذجًا بديلًا بشكل مقصود.")} value={replacement} onChange={setReplacement} /> : null}
      <GButton icon="checkmark-circle-outline" label={t("Approve for generation", "الموافقة على إنشاء النموذج")} busy={busy} disabled={busy || !r.generationId || (!!r.existingModel3dKey && !replacement)}
        onPress={() => void work(() => vehicleRequests.action(r.id, "approve-initial", { notes, ...(replacement ? { existingModelKey: r.existingModel3dKey } : {}) }))} />
    </View>
  ) : ["APPROVED_FOR_GENERATION", "GENERATION_FAILED"].includes(r.requestStatus) ? (
    <GButton icon="play-outline" label={t("Start approved generation / retry", "بدء الإنشاء المعتمد / إعادة المحاولة")} busy={busy} disabled={busy} onPress={() => void work(() => vehicleRequests.action(r.id, "start-generation"))} />
  ) : r.requestStatus === "READY_FOR_FINAL_REVIEW" ? (
    <GButton icon="eye-outline" label={t("Begin final visual review", "بدء المراجعة البصرية النهائية")} busy={busy} disabled={busy || r.provider !== "MESHY"} onPress={() => void work(() => vehicleRequests.action(r.id, "final-review"))} />
  ) : r.requestStatus === "FINAL_REVIEW" ? (
    <GButton icon="open-outline" label={t("Open final review and publication", "فتح المراجعة النهائية والنشر")} onPress={() => go(`/dept/3d-submissions/${r.submissionId}`)} />
  ) : undefined;
  const actions: ItemAction[] = [
    ...(reviewing ? [{ key: "reject", label: t("Reject request", "رفض الطلب"), icon: "close-circle-outline" as const, run: () => setRejecting(true) }] : []),
    ...(r.initialReviewState === "APPROVED" && ["READY_FOR_FINAL_REVIEW", "REJECTED", "GENERATION_FAILED"].includes(r.requestStatus)
      ? [{ key: "again", label: t("Prepare a new generation attempt", "تجهيز محاولة إنشاء جديدة"), icon: "sync-outline" as const, disabled: busy, run: () => work(() => vehicleRequests.action(r.id, "regenerate")) }] : []),
    { key: "catalog", label: t("Create or edit catalog records", "إنشاء سجلات الكتالوج أو تعديلها"), icon: "list-outline", run: () => go("/dept/vehicles") },
  ];
  return (
    <Page title={`${r.requestedMake} ${r.requestedModel} ${r.requestedYear}`} line={label(t, r.requestStatus)} actions={actions} footer={footer} onRefresh={() => void reload()} refreshing={false}>
      <View style={[row, { gap: 8 }]}><StatusChip label={label(t, r.requestStatus)} tone={tone(r.requestStatus)} /></View>
      {error ? <Note tone="danger">{error}</Note> : null}
      {reason ? <Note>{reason}</Note> : null}
      {r.failureReason ? <Note tone="danger">{r.failureReason}</Note> : null}
      {["APPROVED_FOR_GENERATION", "GENERATION_FAILED"].includes(r.requestStatus) ? <Note tone="warning">{t("Real generation may spend Meshy credits. Start only this approved request.", "قد يستهلك الإنشاء الفعلي رصيد Meshy. ابدأ هذا الطلب المعتمد فقط.")}</Note> : null}
      <Block title={t("Request", "الطلب")}>
        <Facts rows={[
          [t("Catalog generation", "جيل الكتالوج"), r.generationId ? `${r.generationName}${r.vehicle3dMissing ? ` · ${t("3D model missing", "النموذج ثلاثي الأبعاد غير متوفر")}` : ""}` : t("Not linked yet", "غير مرتبط بعد")],
          [t("Requested generation", "الجيل المطلوب"), r.requestedGeneration ?? ""], [t("Trim", "الفئة"), r.trim ?? ""], [t("Customer notes", "ملاحظات العميل"), r.notes ?? ""],
          [t("Requested by", "عدد الطالبين"), r.demandCount ? String(r.demandCount) : ""], [t("Created", "أُنشئ"), new Date(r.createdAt).toLocaleDateString()], [t("Request id", "معرّف الطلب"), r.id],
        ]} />
      </Block>
      {reviewing ? (
        <Block title={t("Catalog assignment", "التصنيف في الكتالوج")}>
          <View style={{ gap: 10, paddingVertical: 10 }}>
            <SmartPicker label={t("Generation", "الجيل")} value={generationId} options={gens} suggested={suggestions.data?.generations.map(g => g.id)} onChange={setGenerationId}
              hint={t("Suggestions on top. Choose only after checking the photos.", "الاقتراحات في الأعلى. اختر بعد التحقق من الصور فقط.")} />
            <Field label={t("Correct manufacture year", "تصحيح سنة الصنع")} value={year} onChangeText={setYear} keyboardType="number-pad" />
            <GButton variant="secondary" label={t("Save corrected assignment", "حفظ التصنيف المصحح")} disabled={busy || !generationId} onPress={() => void work(() => vehicleRequests.correct(r.id, { generationId, year: Number(year) }))} />
            <Field label={t("Review notes (optional)", "ملاحظات المراجعة (اختيارية)")} value={notes} onChangeText={setNotes} multiline />
          </View>
        </Block>
      ) : null}
      {r.hasModel ? (
        <Block title={t("3D model", "النموذج ثلاثي الأبعاد")} action={<GButton variant="ghost" label={showModel ? t("Hide", "إخفاء") : t("Show", "عرض")} onPress={() => setShowModel(v => !v)} />}>
          {showModel ? <View style={{ paddingVertical: 8 }}><ModelPreview key={r.modelRevision} s={s} admin /></View> : null}
          <Facts rows={[[t("Provider", "مزود الإنشاء"), r.provider ?? "—"], [t("Validation", "التحقق"), r.validation?.valid ? t("Technical validation passed", "اجتاز التحقق التقني") : t("Technical validation pending", "التحقق التقني قيد الانتظار")],
            [t("Size / triangles", "الحجم / المثلثات"), `${r.validation?.bytes ?? "—"} / ${r.validation?.triangles ?? "—"}`],
            [t("Dimensions (m)", "الأبعاد (م)"), Array.isArray(r.validation?.dimensions) ? (r.validation!.dimensions as unknown[]).map(n => Number(n).toFixed(2)).join(" × ") : ""]]} />
          {r.generationMode === "mock" ? <Note>{t("Demo / mock model — cannot be published.", "نموذج تجريبي — لا يمكن نشره.")}</Note> : null}
        </Block>
      ) : null}
      <Block title={t("Photos", "الصور")}>
        <View style={{ gap: 10, paddingVertical: 8 }}>{(["front", "rear", "left", "right"] as const).map(view => <Photo key={view} s={s} view={view} admin />)}</View>
      </Block>
      <GText soft style={[gType.caption, align]}>{t("Customer identity stays private; only the approved 3D representation can be shared.", "تبقى هوية العميل خاصة؛ يمكن مشاركة النموذج المعتمد فقط.")}</GText>
      <ManageEntry icon="list-outline" title={t("Vehicle catalog", "كتالوج المركبات")} sub={t("Add a missing brand, model or generation", "أضف شركة أو طرازًا أو جيلًا غير موجود")} onPress={() => go("/dept/vehicles")} />
      <ReasonSheet visible={rejecting} title={t("Reject request", "رفض الطلب")} prompt={t("Rejection reason (required). The customer will see it.", "سبب الرفض (مطلوب). سيراه العميل.")} confirmLabel={t("Reject request", "رفض الطلب")} danger busy={busy}
        onCancel={() => setRejecting(false)} onConfirm={why => void work(() => vehicleRequests.action(r.id, "reject-initial", { notes: why })).then(() => setRejecting(false))} />
    </Page>
  );
}
