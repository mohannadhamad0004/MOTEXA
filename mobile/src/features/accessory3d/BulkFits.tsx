// Parts Admin: review the fits of ONE accessory on ALL its cars (a universal rim can fit thousands). A compact, virtualized list paged and
// filtered on the server (brand / model / generation / fit state / search), one row per car with a checkbox and a ⋮ menu. Bulk actions on
// the selection: "Run auto-fit" (a background job on the server with a progress bar and an estimate; it keeps going when this screen is
// left; approved fits are skipped unless the admin explicitly includes them) and "Approve passed fits" (only fits that PASSED the automatic
// check; the server re-checks every one and says how many were skipped and why). "Select all matching" sends the filter, never the ids.
// 3D only on demand: tapping a row previews that one car (a sheet on phones, a side panel on wide screens), never several viewers at once.
import { router, useLocalSearchParams, type Href } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { Card, Chip, GButton, GIcon, GText, Note, OptionSheet, Rail, Sheet, SkeletonRows, StatusChip, Toggle, type Tone } from "../../components/garage";
import { ActionsSheet, showToast, type ItemAction } from "../../components/ItemActionsMenu";
import { ManageCheck, ManagePage, ManageRow, SelectBanner, useListWidth, useTwoPane } from "../../components/manage/ManagePage";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { gType, useGarageTheme } from "../../theme/garage";
import { NO_ADJUST } from "../car3d/car3d";
import { Car3DView } from "../car3d/Car3DView";
import { useCatalogModelKey } from "../car3d/runtimeModels";
import { threeDError } from "../vehicleCatalog/lifecycleText";
import { ACCESSORY_TYPE_LABELS, FIT_STATE_LABELS, adminAccessoryApi, type FitFilter, type FitJob, type FitJobSummary, type FitRow, type FitsPage, type FitState } from "./api";
import { MAX_PICKED, NONE, ALL_MATCHING, atLimit, etaText, isSelected, num, selectedCount, selectionBody, toggle, toggleRows, type Selection } from "./fitSelection";
import { fitKit } from "./screens";

type T = (en: string, ar: string) => string;
const STATE = FIT_STATE_LABELS;
/** the filter chips: "Needs manual correction" covers both a flagged fit and a stored correction (each is reviewed on its own) */
const FILTERS: { key: FitFilter["status"] | "all"; en: string; ar: string; count: (c: Record<FitState, number>) => number }[] = [
  { key: "all", en: "All", ar: "الكل", count: c => Object.values(c).reduce((a, b) => a + b, 0) },
  { key: "not_computed", en: "Not computed", ar: "لم يُحسب", count: c => c.not_computed },
  { key: "passed", en: "Passed", ar: "اجتاز الفحص", count: c => c.passed },
  { key: "failed", en: "Failed", ar: "فشل", count: c => c.failed },
  { key: "correction", en: "Needs manual correction", ar: "يحتاج إلى تصحيح يدوي", count: c => c.needs_correction + c.has_correction },
  { key: "approved", en: "Approved", ar: "معتمد", count: c => c.approved },
];
/** Why a car is in its state, for the preview. */
const WHY: Record<string, [string, string]> = {
  FIT_NOT_READY: ["Not computed yet. Run auto-fit on it.", "لم يُحسب بعد. شغّل التركيب التلقائي عليها."],
  PART_MAP_STALE: ["Confirm this car's part map first, then run auto-fit.", "أكّد خريطة قطع هذه السيارة أولًا، ثم شغّل التركيب التلقائي."],
  NEEDS_CORRECTION: ["Marked as needing a correction. Review it on its own.", "معلّمة بأنها تحتاج إلى تصحيح. راجعها منفردة."],
  HAS_CORRECTION: ["Has a manual correction: review it on its own (bulk never drops a correction).", "عليها تصحيح يدوي: راجعها منفردة (الاعتماد الجماعي لا يحذف أي تصحيح)."],
  FIT_CHECK_NOT_PASSED: ["The automatic fit check did not pass.", "لم يجتز فحص التركيب التلقائي."],
};
/** Why cars were left out of a bulk action ("80 failed"). */
const SKIP: Record<string, [string, string]> = {
  FIT_FAILED: ["failed", "فشل"], FIT_NOT_READY: ["not computed", "لم يُحسب"], PART_MAP_STALE: ["part map not confirmed", "خريطة القطع غير مؤكدة"],
  NEEDS_CORRECTION: ["need correction", "تحتاج إلى تصحيح"], HAS_CORRECTION: ["have a manual correction", "عليها تصحيح يدوي"], ALREADY_APPROVED: ["already approved", "معتمدة مسبقًا"],
  NOT_A_TARGET: ["not cars of this part", "ليست سيارات لهذه القطعة"], CHANGED: ["changed while approving", "تغيّرت أثناء الاعتماد"],
};
const ERRORS: Record<string, [string, string]> = {
  FIT_JOB_RUNNING: ["A fit run is already in progress for this accessory.", "يوجد تشغيل تركيب قيد التنفيذ لهذه القطعة."],
  NOTHING_TO_RUN: ["No car in this selection needs a fit run.", "لا توجد سيارة في هذا التحديد تحتاج إلى تشغيل التركيب."],
  CONFIRM_RESET_COUNT: ["The number of approved fits changed. Check it and confirm again.", "تغيّر عدد التركيبات المعتمدة. تحقّق منه وأكّد مجددًا."],
  FIT_JOB_NOT_RUNNING: ["This run is not running any more.", "هذا التشغيل لم يعد قيد التنفيذ."],
  INVALID_SELECTION: ["Choose cars, or select all matching the filter.", "اختر سيارات، أو حدّد كل ما يطابق الفلتر."],
};
const errText = (e: unknown, t: T) => { const code = (e as { data?: { code?: string } })?.data?.code ?? ""; return ERRORS[code] ? t(...ERRORS[code]!) : threeDError(e, t); };
/** "N fits" / "N cars" with the right Arabic number noun (1 واحد, 2 مثنى, 3-10 جمع, else مفرد منصوب). */
const fitsWord = (n: number, ar: boolean) => (!ar ? `${num(n)} ${n === 1 ? "fit" : "fits"}` : n === 1 ? "تركيب واحد" : n === 2 ? "تركيبان" : `${num(n)} ${n <= 10 ? "تركيبات" : "تركيبًا"}`);
const carsWord = (n: number, ar: boolean) => (!ar ? `${num(n)} ${n === 1 ? "car" : "cars"}` : n === 1 ? "سيارة واحدة" : n === 2 ? "سيارتان" : `${num(n)} ${n <= 10 ? "سيارات" : "سيارة"}`);
const skippedText = (skipped: Record<string, number>, t: T) => Object.entries(skipped).filter(([, n]) => n > 0).map(([code, n]) => `${num(n)} ${t(...(SKIP[code] ?? [code, code]))}`).join(" · ");
const skippedTotal = (skipped: Record<string, number>) => Object.values(skipped).reduce((a, b) => a + b, 0);
const carName = (r: FitRow, ar: boolean) => (ar ? `${r.makeAr} ${r.modelAr}` : `${r.make} ${r.model}`);
const years = (r: { yearFrom: number; yearTo: number }) => `${r.yearFrom}–${r.yearTo}`;
const ROW_H = 64;

/** The list of accessories that have fits to review (published or ready for final review). */
export function BulkFitsPicker() {
  const { t } = useL();
  const list = useLoad(adminAccessoryApi.list, [], 15000);
  const [q, setQ] = useState("");
  const rows = (list.data ?? []).filter(a => ["PUBLISHED", "READY_FOR_FINAL_REVIEW"].includes(a.status) && !a.deactivatedAt);
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = rows.filter(a => words.every(w => `${a.productName} ${a.shopName}`.toLowerCase().includes(w)));
  return (
    <ManagePage
      title={t("Review by accessory", "المراجعة حسب القطعة")}
      line={list.data ? t(`${rows.length} accessories · all their cars at once`, `${rows.length} قطع · كل سياراتها معًا`) : undefined}
      search={{ value: q, onChange: setQ, placeholder: t("Search accessory or shop", "ابحث عن قطعة أو متجر") }}
      items={shown} keyOf={a => a.id}
      renderItem={a => <ManageRow title={a.productName} sub={`${a.shopName} · ${t(...ACCESSORY_TYPE_LABELS[a.accessoryType])}`}
        status={a.status === "PUBLISHED" ? { label: t("Published", "منشورة"), tone: "success" } : { label: t("Final review", "مراجعة نهائية"), tone: "warning" }}
        onPress={() => router.push(`/dept/accessory-fits?accessoryId=${encodeURIComponent(a.id)}` as Href)} />}
      loading={!list.data && !list.error} error={list.error} onRetry={() => void list.reload()}
      empty={{ text: rows.length ? t("No accessory matches.", "لا توجد قطعة مطابقة.") : t("No published accessory to review.", "لا توجد قطعة منشورة للمراجعة.") }}
      onRefresh={() => void list.reload()} refreshing={list.loading && !!list.data}
    />
  );
}

export function BulkFits() {
  const { accessoryId } = useLocalSearchParams<{ accessoryId?: string }>();
  if (!accessoryId) return <BulkFitsPicker />;
  return <BulkFitsList accessoryId={String(accessoryId)} />;
}

type Confirm = { kind: "approve"; approvable: number; skipped: Record<string, number>; error?: string } | { kind: "fit"; summary: FitJobSummary; include: boolean; error?: string };

function BulkFitsList({ accessoryId }: { accessoryId: string }) {
  const { t, isArabic } = useL();
  const { g, row, align } = useGarageTheme();
  const twoPane = useTwoPane(), { table, onListWidth } = useListWidth();

  // ---- filter + paged rows (the server filters; only the latest answer counts)
  const [filter, setFilter] = useState<FitFilter>({});
  const [q, setQ] = useState("");
  useEffect(() => { const id = setTimeout(() => setFilter(f => ((f.q ?? "") === q.trim() ? f : { ...f, q: q.trim() || undefined })), 300); return () => clearTimeout(id); }, [q]);
  const [page, setPage] = useState<FitsPage | null>(null), [cars, setCars] = useState<FitRow[]>([]);
  const [loading, setLoading] = useState(true), [loadingMore, setLoadingMore] = useState(false), [pulling, setPulling] = useState(false), [error, setError] = useState<string | null>(null);
  const req = useRef(0), loaded = useRef(0);
  loaded.current = cars.length;
  const load = useCallback(async (mode: "reset" | "more" | "refresh") => {
    const id = ++req.current;
    if (mode === "more") setLoadingMore(true); else if (mode === "reset") setLoading(true);
    try {
      if (mode === "more") {
        const p = await adminAccessoryApi.fitsPage(accessoryId, filter, loaded.current);
        if (id !== req.current) return;
        setPage(p); setCars(c => { const seen = new Set(c.map(x => x.generationId)); return [...c, ...p.cars.filter(x => !seen.has(x.generationId))]; });
      } else {
        // reset = the first page; refresh = every row already on screen again (pages of 100), so the scroll position holds
        const want = mode === "refresh" ? Math.max(50, loaded.current) : 50;
        let rows: FitRow[] = [], p: FitsPage;
        do { p = await adminAccessoryApi.fitsPage(accessoryId, filter, rows.length, Math.min(100, want - rows.length)); rows = [...rows, ...p.cars]; }
        while (rows.length < want && rows.length < p.total && p.cars.length);
        if (id !== req.current) return;
        setPage(p); setCars(rows);
      }
      setError(null);
    } catch (e) { if (id === req.current) setError(errText(e, t)); }
    finally { if (id === req.current) { setLoading(false); setLoadingMore(false); } }
  }, [accessoryId, filter, t]);
  const [sel, setSel] = useState<Selection>(NONE);
  // a new filter = a new list and a new selection
  useEffect(() => { setSel(NONE); void load("reset"); }, [load]);

  // ---- the background job (polled from the server: it survives leaving the screen)
  const [job, setJob] = useState<FitJob | null>(null), [hiddenJob, setHiddenJob] = useState<string | null>(null);
  const jobActive = !!job && (job.status === "QUEUED" || job.status === "RUNNING");
  useEffect(() => {
    let live = true; let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => { try { const j = await adminAccessoryApi.currentFitJob(accessoryId); if (live) setJob(j); } catch { /* the next tick retries */ } if (live) timer = setTimeout(tick, jobActive ? 3000 : 15000); };
    void tick();
    return () => { live = false; if (timer) clearTimeout(timer); };
  }, [accessoryId, jobActive]);
  // while it runs the list follows every 25 cars, and once more when it ends
  const jobStep = job ? `${job.id}:${job.status}:${Math.floor(job.position / 25)}` : "";
  const lastStep = useRef("");
  useEffect(() => { if (lastStep.current && jobStep && lastStep.current !== jobStep) void load("refresh"); lastStep.current = jobStep; }, [jobStep, load]);

  // ---- selection + bulk actions
  const total = page?.total ?? 0, count = selectedCount(sel, total);
  const [confirm, setConfirm] = useState<Confirm | null>(null), [busy, setBusy] = useState(false), [result, setResult] = useState<{ tone: Tone; text: string } | null>(null);
  const work = async (fn: () => Promise<void>, onError?: (msg: string) => void) => {
    setBusy(true);
    try { await fn(); } catch (e) { const msg = errText(e, t); if (onError) onError(msg); else showToast(msg, "bad"); } finally { setBusy(false); }
  };
  const body = selectionBody(sel, filter);
  const askApprove = () => work(async () => { const r = await adminAccessoryApi.approveFits(accessoryId, body, true); setConfirm({ kind: "approve", approvable: r.approvable ?? 0, skipped: r.skipped }); });
  const askFit = () => work(async () => { const r = await adminAccessoryApi.startFitJob(accessoryId, body, { dryRun: true }); setConfirm({ kind: "fit", summary: r.summary, include: false }); });
  const approve = () => work(async () => {
    const r = await adminAccessoryApi.approveFits(accessoryId, body);
    const n = r.approved ?? 0, k = skippedTotal(r.skipped);
    setConfirm(null); setSel(NONE);
    setResult({ tone: k ? "warning" : "success", text: `${t("Approved", "تم اعتماد")} ${fitsWord(n, isArabic)}.${k ? ` ${t("Skipped", "تم تخطي")} ${num(k)}: ${skippedText(r.skipped, t)}.` : ""}` });
    await load("refresh");
  }, msg => setConfirm(c => (c ? { ...c, error: msg } : c)));
  const runFit = (c: Extract<Confirm, { kind: "fit" }>) => work(async () => {
    const r = await adminAccessoryApi.startFitJob(accessoryId, body, c.include ? { includeApproved: true, confirmApprovedReset: c.summary.approvedSkipped } : {});
    setJob(r.job); setHiddenJob(null); setConfirm(null); setSel(NONE); setResult(null);
  }, async msg => {
    // the approved count changed under the sheet: show the new numbers before anything is reset
    const fresh = await adminAccessoryApi.startFitJob(accessoryId, body, { dryRun: true }).catch(() => null);
    setConfirm({ kind: "fit", summary: fresh?.summary ?? c.summary, include: c.include, error: msg });
  });
  const cancelJob = () => work(async () => { if (job) { await adminAccessoryApi.cancelFitJob(accessoryId, job.id); setJob(await adminAccessoryApi.currentFitJob(accessoryId)); await load("refresh"); } });

  // ---- one row's ⋮ menu (one shared sheet) and the on-demand 3D preview
  const [menu, setMenu] = useState<FitRow | null>(null), [preview, setPreview] = useState<FitRow | null>(null);
  useEffect(() => { if (preview && !cars.some(c => c.generationId === preview.generationId)) setPreview(null); }, [cars]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = preview ? cars.find(c => c.generationId === preview.generationId) ?? preview : null;
  const openReview = (r: FitRow) => router.push(`/dept/accessory-zones?mode=fits&key=${encodeURIComponent(r.model3dKey)}&accessoryId=${encodeURIComponent(accessoryId)}&generationId=${encodeURIComponent(r.generationId)}` as Href);
  const rowActions = (r: FitRow): ItemAction[] => {
    const name = carName(r, isArabic), one = { generationIds: [r.generationId] };
    const out: ItemAction[] = [
      { key: "preview", label: t("Preview in 3D", "معاينة ثلاثية الأبعاد"), icon: "cube-outline", run: () => setPreview(r) },
      { key: "review", label: t("Open full review", "فتح المراجعة الكاملة"), icon: "construct-outline", run: () => openReview(r) },
    ];
    if (r.status === "passed") out.push({ key: "approve", label: t("Approve this fit", "اعتماد هذا التركيب"), icon: "checkmark-circle-outline", success: t("Approved.", "تم الاعتماد."),
      run: async () => { const x = await adminAccessoryApi.approveFits(accessoryId, one); if (!x.approved) throw new Error(t("This fit changed. Refresh and check it again.", "تغيّر هذا التركيب. حدّث وافحصه مجددًا.")); await load("refresh"); }, error: e => errText(e, t) });
    out.push(r.status === "approved"
      ? { key: "refit", label: t("Re-run auto-fit on this car", "إعادة التركيب التلقائي على هذه السيارة"), icon: "refresh-outline", destructive: true, disabled: jobActive, hint: jobActive ? t("A fit run is in progress.", "يوجد تشغيل تركيب قيد التنفيذ.") : undefined,
          confirm: { title: t("Re-run an approved fit?", "إعادة تشغيل تركيب معتمد؟"), message: t(`The approval of ${name} is reset: customers with this car lose "View on my car" for this part until you approve it again.`, `يُلغى اعتماد ${name}: يفقد العملاء أصحاب هذه السيارة «اعرضها على سيارتي» لهذه القطعة حتى تعتمدها مجددًا.`), confirmLabel: t("Reset 1 approval and re-run", "إلغاء اعتماد واحد وإعادة التشغيل") },
          success: t("Auto-fit started.", "بدأ التركيب التلقائي."), run: async () => { setJob((await adminAccessoryApi.startFitJob(accessoryId, one, { includeApproved: true, confirmApprovedReset: 1 })).job); setHiddenJob(null); }, error: e => errText(e, t) }
      : { key: "refit", label: t("Run auto-fit on this car", "تشغيل التركيب التلقائي على هذه السيارة"), icon: "refresh-outline", disabled: jobActive, hint: jobActive ? t("A fit run is in progress.", "يوجد تشغيل تركيب قيد التنفيذ.") : undefined,
          success: t("Auto-fit started.", "بدأ التركيب التلقائي."), run: async () => { setJob((await adminAccessoryApi.startFitJob(accessoryId, one, {})).job); setHiddenJob(null); }, error: e => errText(e, t) });
    if (r.status === "approved") out.push({ key: "unapprove", label: t("Unapprove", "إلغاء الاعتماد"), icon: "close-circle-outline", destructive: true,
      confirm: { title: t("Unapprove this fit?", "إلغاء اعتماد هذا التركيب؟"), message: t("Customers with this car stop seeing this part on their car in 3D until it is approved again.", "يتوقف العملاء أصحاب هذه السيارة عن رؤية هذه القطعة على سيارتهم حتى تُعتمد مجددًا."), confirmLabel: t("Unapprove", "إلغاء الاعتماد") },
      success: t("Unapproved.", "تم إلغاء الاعتماد."), run: async () => { await adminAccessoryApi.bulkFits(accessoryId, "unapprove", [r.generationId]); await load("refresh"); }, error: e => errText(e, t) });
    return out;
  };

  const onToggle = useCallback((id: string) => setSel(s => toggle(s, id)), []);
  const onOpen = useCallback((r: FitRow) => setPreview(r), []);
  const onMenu = useCallback((r: FitRow) => setMenu(r), []);
  const limit = atLimit(sel);
  const renderItem = useCallback((item: FitRow) => (
    <FitRowView r={item} on={isSelected(sel, item.generationId)} blocked={limit && !isSelected(sel, item.generationId)} active={twoPane && preview?.generationId === item.generationId} table={table} onToggle={onToggle} onOpen={onOpen} onMenu={onMenu} />
  ), [sel, limit, twoPane, preview?.generationId, table, onToggle, onOpen, onMenu]);

  const onScreen = cars.map(c => c.generationId), allOnScreen = !sel.all && cars.length > 0 && onScreen.every(id => sel.ids.has(id));
  const a = page?.accessory;
  const footer = count > 0 ? (
    <View style={{ gap: 8 }}>
      <View style={[row, { alignItems: "center", gap: 8 }]}>
        <GText style={[gType.label, align, { flex: 1, fontWeight: "800" }]}>{t(`${num(count)} selected`, `تم تحديد ${num(count)}`)}</GText>
        <GButton variant="ghost" label={t("Clear", "مسح")} disabled={busy} onPress={() => setSel(NONE)} />
      </View>
      <View style={[row, { gap: 8 }]}>
        <GButton flex variant="secondary" icon="refresh-outline" label={t("Run auto-fit", "تشغيل التركيب التلقائي")} disabled={busy || jobActive} onPress={() => void askFit()} />
        <GButton flex icon="checkmark-done-outline" label={t("Approve passed", "اعتماد الناجحة")} disabled={busy} onPress={() => void askApprove()} />
      </View>
      {jobActive ? <GText soft style={[gType.tiny, align]}>{t("A fit run is in progress. Start another one when it is done.", "يوجد تشغيل تركيب قيد التنفيذ. ابدأ تشغيلًا آخر بعد انتهائه.")}</GText> : null}
    </View>
  ) : undefined;

  return (
    <>
      <ManagePage
        title={a?.productName ?? t("Accessory fits", "تركيب القطعة")}
        line={a ? `${t(...ACCESSORY_TYPE_LABELS[a.type])}${a.universal ? ` · ${t("Universal by size", "عام حسب المقاس")}` : ""} · ${carsWord(page!.all, isArabic)}` : undefined}
        search={{ value: q, onChange: setQ, placeholder: t("Search brand, model, generation, year", "ابحث بالماركة أو الطراز أو الجيل أو السنة") }}
        filters={<>
          <Facets page={page} filter={filter} setFilter={setFilter} />
          <Rail gap={8}>
            {FILTERS.map(f => <Chip key={f.key} label={t(f.en, f.ar)} count={page ? f.count(page.counts) : undefined} on={(filter.status ?? "all") === f.key}
              onPress={() => setFilter(x => ({ ...x, status: f.key === "all" ? undefined : f.key }))} />)}
          </Rail>
        </>}
        above={<>
          {job && hiddenJob !== job.id && (jobActive || recent(job)) ? <JobCard job={job} busy={busy} onCancel={() => void cancelJob()} onHide={() => setHiddenJob(job.id)} /> : null}
          {a?.computing ? <Note>{t("Fits are being computed after publishing. The list follows.", "يجري حساب التركيب بعد النشر. تتحدّث القائمة تلقائيًا.")}</Note> : null}
          {result ? <Note tone={result.tone} icon="checkmark-circle-outline">{result.text}</Note> : null}
        </>}
        listHead={<>
          {/* the table head: select the rows on screen / everything matching, and the column names on wide lists */}
          <View style={[row, { alignItems: "center", gap: 4, minHeight: 44, borderBottomWidth: 1, borderBottomColor: g.line }]}>
            <ManageCheck on={sel.all || allOnScreen} mixed={!sel.all && !allOnScreen && sel.ids.size > 0} disabled={!cars.length} label={t("Select all on screen", "تحديد كل ما على الشاشة")} onPress={() => setSel(s => toggleRows(s, onScreen))} />
            {table ? <Columns head /> : <GText soft style={[gType.caption, align, { flex: 1, fontWeight: "700" }]}>{t("Select all", "تحديد الكل")}</GText>}
            {!table ? <GText soft style={[gType.caption, { fontWeight: "700" }]}>{page ? carsWord(total, isArabic) : ""}</GText> : null}
          </View>
          {sel.all ? (
            <SelectBanner text={t(`All ${num(count)} matching cars are selected.`, `تم تحديد كل السيارات المطابقة (${num(count)}).`)} action={t("Clear selection", "مسح التحديد")} onPress={() => setSel(NONE)} />
          ) : total > 0 && (allOnScreen || sel.ids.size === 0) ? (
            <SelectBanner text={allOnScreen ? t(`The ${num(cars.length)} cars on screen are selected.`, `تم تحديد السيارات المعروضة (${num(cars.length)}).`) : null}
              action={t(`Select all ${num(total)} matching the filter`, `تحديد كل السيارات المطابقة للفلتر (${num(total)})`)} onPress={() => setSel(ALL_MATCHING)} />
          ) : null}
          {limit ? <GText soft style={[gType.tiny, align]}>{t(`At most ${MAX_PICKED} cars can be picked one by one. Use "Select all matching" for more.`, `يمكن اختيار ${MAX_PICKED} سيارة كحد أقصى واحدة تلو الأخرى. استخدم «تحديد كل ما يطابق» للمزيد.`)}</GText> : null}
        </>}
        items={cars} keyOf={r => r.generationId} renderItem={renderItem}
        loading={loading} error={error} onRetry={() => void load("reset")}
        empty={{ text: t("No cars match these filters.", "لا توجد سيارات تطابق هذه الفلاتر."), action: hasFilter(filter) ? { label: t("Clear filters", "مسح الفلاتر"), onPress: () => { setQ(""); setFilter({}); } } : undefined }}
        onEndReached={() => { if (!loading && !loadingMore && cars.length < total) void load("more"); }} loadingMore={loadingMore}
        listFooter={<>
          {cars.length && cars.length >= total ? <GText soft style={[gType.tiny, { textAlign: "center" }]}>{t(`All ${num(total)} cars shown.`, `تم عرض كل السيارات (${num(total)}).`)}</GText> : null}
          <Note icon="eye-outline">{t("Customers only see approved fits. Failed, not computed and manually corrected fits are never approved in bulk: review them one by one.", "لا يرى العملاء إلا التركيبات المعتمدة. لا تُعتمد التركيبات الفاشلة أو غير المحسوبة أو المصححة يدويًا جماعيًا: راجعها منفردة.")}</Note>
        </>}
        onRefresh={() => { setPulling(true); void Promise.all([load("refresh"), adminAccessoryApi.currentFitJob(accessoryId).then(setJob)]).finally(() => setPulling(false)); }} refreshing={pulling}
        bulkBar={footer}
        detail={shown ? { title: carName(shown, isArabic), onClose: () => setPreview(null), content: <FitPreview key={shown.generationId} accessoryId={accessoryId} r={shown} onReview={() => { if (!twoPane) setPreview(null); openReview(shown); }} /> } : null}
        detailHint={t("Tap a car to preview this part on it in 3D.", "اضغط على سيارة لمعاينة هذه القطعة عليها ثلاثية الأبعاد.")}
        onListWidth={onListWidth}
      />
      <ActionsSheet visible={!!menu} onClose={() => setMenu(null)} title={menu ? carName(menu, isArabic) : ""} subtitle={menu ? `${menu.code} · ${years(menu)} · ${t(STATE[menu.status].en, STATE[menu.status].ar)}` : undefined} actions={menu ? rowActions(menu) : []} />
      <ConfirmSheet confirm={confirm} busy={busy} onClose={() => { if (!busy) setConfirm(null); }} setConfirm={setConfirm} onApprove={() => void approve()} onRun={c => void runFit(c)} />
    </>
  );
}

const hasFilter = (f: FitFilter) => !!(f.q || f.make || f.model || f.generationId || f.status);
/** a finished run stays on screen for an hour (then the list says it all) */
const recent = (j: FitJob) => !!j.finishedAt && Date.now() - new Date(j.finishedAt).getTime() < 3_600_000;

/** One car: [checkbox] brand model / generation · years [state] [⋮]. Tap = preview; the checkbox selects. */
const FitRowView = memo(function FitRowView({ r, on, blocked, active, table, onToggle, onOpen, onMenu }: { r: FitRow; on: boolean; blocked: boolean; active: boolean; table: boolean; onToggle: (id: string) => void; onOpen: (r: FitRow) => void; onMenu: (r: FitRow) => void }) {
  const { t, isArabic } = useL();
  const st = STATE[r.status], name = carName(r, isArabic);
  return <ManageRow title={name} sub={`${r.code} · ${years(r)}`} status={{ label: t(st.en, st.ar), tone: st.tone }} active={active} statusWidth={table ? 150 : undefined}
    columns={table ? <Columns r={r} /> : undefined}
    check={{ on, disabled: blocked, label: `${t("Select", "تحديد")} ${name} ${r.code}`, onToggle: () => onToggle(r.generationId) }}
    onPress={() => onOpen(r)} pressLabel={`${name} ${r.code}, ${years(r)}. ${t(st.en, st.ar)}. ${t("Preview in 3D", "معاينة ثلاثية الأبعاد")}`} onMenu={() => onMenu(r)} />;
});

/** Wide lists: brand | model | generation | years (the head when `head`). */
function Columns({ r, head }: { r?: FitRow; head?: boolean }) {
  const { t, isArabic } = useL();
  const { row, align } = useGarageTheme();
  const cell = (key: string, text: string, w: number | undefined, bold = false) => <GText key={key} soft={head} numberOfLines={1} style={[head ? gType.caption : gType.label, align, w ? { width: w } : { flex: 1, minWidth: 0 }, { fontWeight: head || bold ? "700" : "500" }]}>{text}</GText>;
  const cells = head
    ? [cell("b", t("Brand", "الماركة"), 120), cell("m", t("Model", "الطراز"), undefined), cell("g", t("Generation", "الجيل"), 110), cell("y", t("Years", "السنوات"), 100), cell("s", t("Fit state", "حالة التركيب"), 150)]
    : [cell("b", isArabic ? r!.makeAr : r!.make, 120, true), cell("m", isArabic ? r!.modelAr : r!.model, undefined), cell("g", r!.code, 110), cell("y", years(r!), 100)];
  return <View style={[row, { flex: 1, minWidth: 0, alignItems: "center", gap: 8 }]}>{cells}{head ? <View style={{ width: 44 }} /> : null}</View>;
}

/** Brand → model → generation pickers (each one narrows the next). */
function Facets({ page, filter, setFilter }: { page: FitsPage | null; filter: FitFilter; setFilter: (f: (x: FitFilter) => FitFilter) => void }) {
  const { t, isArabic } = useL();
  const [open, setOpen] = useState<"make" | "model" | "generation" | null>(null);
  const f = page?.facets;
  const makeLabel = f?.makes.find(m => m.value === filter.make), modelLabel = f?.models.find(m => m.value === filter.model), gen = f?.generations.find(x => x.id === filter.generationId);
  const opts = open === "make" ? [{ key: "", label: t("All brands", "كل الماركات") }, ...(f?.makes ?? []).map(m => ({ key: m.value, label: isArabic ? m.ar : m.value }))]
    : open === "model" ? [{ key: "", label: t("All models", "كل الطرازات") }, ...(f?.models ?? []).map(m => ({ key: m.value, label: isArabic ? m.ar : m.value }))]
    : [{ key: "", label: t("All generations", "كل الأجيال") }, ...(f?.generations ?? []).map(x => ({ key: x.id, label: `${x.code} · ${years(x)}` }))];
  const value = open === "make" ? filter.make : open === "model" ? filter.model : filter.generationId;
  const pick = (k: string) => {
    setFilter(x => open === "make" ? { ...x, make: k || undefined, model: undefined, generationId: undefined } : open === "model" ? { ...x, model: k || undefined, generationId: undefined } : { ...x, generationId: k || undefined });
    setOpen(null);
  };
  return (
    <>
      <Rail gap={8}>
        <Chip icon="car-outline" label={makeLabel ? (isArabic ? makeLabel.ar : makeLabel.value) : t("Brand", "الماركة")} on={!!filter.make} onPress={() => setOpen("make")} />
        {filter.make ? <Chip icon="car-sport-outline" label={modelLabel ? (isArabic ? modelLabel.ar : modelLabel.value) : t("Model", "الطراز")} on={!!filter.model} onPress={() => setOpen("model")} /> : null}
        {filter.model ? <Chip icon="calendar-outline" label={gen ? `${gen.code} · ${years(gen)}` : t("Generation", "الجيل")} on={!!filter.generationId} onPress={() => setOpen("generation")} /> : null}
        {filter.make ? <Chip icon="close" label={t("Clear", "مسح")} onPress={() => setFilter(x => ({ ...x, make: undefined, model: undefined, generationId: undefined }))} /> : null}
      </Rail>
      <OptionSheet visible={!!open} onClose={() => setOpen(null)} closeLabel={t("Close", "إغلاق")} value={value ?? ""} options={opts} onSelect={pick}
        title={open === "make" ? t("Brand", "الماركة") : open === "model" ? t("Model", "الطراز") : t("Generation", "الجيل")} />
    </>
  );
}

/** The running (or just finished) "Run auto-fit" job: progress bar, counts, an estimate; it keeps running when the screen is left. */
function JobCard({ job, busy, onCancel, onHide }: { job: FitJob; busy: boolean; onCancel: () => void; onHide: () => void }) {
  const { t, isArabic } = useL();
  const { g, row, align } = useGarageTheme();
  const active = job.status === "QUEUED" || job.status === "RUNNING", pct = job.total ? Math.min(1, job.position / job.total) : 0;
  const title = { QUEUED: t("Auto-fit queued", "التركيب التلقائي في الانتظار"), RUNNING: t("Running auto-fit", "التركيب التلقائي قيد التشغيل"), DONE: t("Auto-fit finished", "انتهى التركيب التلقائي"),
    CANCELLED: t("Auto-fit cancelled", "أُلغي التركيب التلقائي"), FAILED: t("Auto-fit stopped", "توقف التركيب التلقائي") }[job.status];
  const eta = active ? etaText(job.etaSeconds, isArabic) ?? t("estimating time…", "جارٍ تقدير الوقت…") : null;
  const stats = [job.done ? t(`${num(job.done)} fitted`, `${num(job.done)} تم تركيبها`) : null, job.skipped ? t(`${num(job.skipped)} skipped`, `${num(job.skipped)} تم تخطيها`) : null,
    job.errors ? t(`${num(job.errors)} could not be computed`, `${num(job.errors)} تعذّر حسابها`) : null].filter(Boolean).join(" · ");
  return (
    <Card style={{ gap: 10 }}>
      <View style={[row, { alignItems: "center", gap: 8 }]}>
        <GIcon name={active ? "sync-outline" : job.status === "DONE" ? "checkmark-circle" : "alert-circle-outline"} size={20} color={active ? g.accent : job.status === "DONE" ? g.success : g.warning} />
        <GText style={[gType.label, align, { flex: 1, fontWeight: "800" }]}>{title}</GText>
        <GText soft style={[gType.caption, { fontWeight: "700", writingDirection: "ltr" }]}>{`${num(job.position)} / ${num(job.total)}`}</GText>
      </View>
      <View accessible accessibilityRole="progressbar" accessibilityLabel={title} accessibilityValue={{ min: 0, max: job.total, now: job.position }}
        style={{ height: 8, borderRadius: 4, backgroundColor: g.cardSoft, overflow: "hidden", borderWidth: 1, borderColor: g.line, flexDirection: isArabic ? "row-reverse" : "row" }}>
        <View style={{ width: `${Math.round(pct * 100)}%`, backgroundColor: job.status === "FAILED" ? g.warning : g.accent }} />
      </View>
      <GText soft style={[gType.caption, align]}>{[eta, stats].filter(Boolean).join(" · ") || t("Starting…", "جارٍ البدء…")}</GText>
      {job.includeApproved && active ? <Note tone="warning">{t("Approved fits are being re-run too: those cars need your approval again.", "يُعاد تشغيل التركيبات المعتمدة أيضًا: تحتاج تلك السيارات إلى اعتمادك مجددًا.")}</Note> : null}
      {job.status === "FAILED" ? <Note tone="danger">{job.error === "FIT_CHECKER_UNAVAILABLE" ? t("The fit checker could not run on the server, so the run stopped. The remaining cars were not changed.", "تعذّر تشغيل فاحص التركيب على الخادم فتوقف التشغيل. لم تتغير السيارات المتبقية.") : t("The run stopped: this accessory is no longer ready for fitting.", "توقف التشغيل: لم تعد هذه القطعة جاهزة للتركيب.")}</Note> : null}
      {active ? <GText soft style={[gType.tiny, align]}>{t("You can leave this screen: the run continues on the server.", "يمكنك مغادرة هذه الشاشة: يستمر التشغيل على الخادم.")}</GText> : null}
      {active ? <GButton variant="secondary" icon="stop-circle-outline" label={t("Cancel run", "إلغاء التشغيل")} busy={busy} disabled={busy} onPress={onCancel} />
        : <GButton variant="ghost" label={t("Hide", "إخفاء")} onPress={onHide} />}
    </Card>
  );
}

/** The two confirmations, with the server's own counts (dry run): approve passed fits / run auto-fit (+ the explicit approved-fits option). */
function ConfirmSheet({ confirm, busy, onClose, setConfirm, onApprove, onRun }: { confirm: Confirm | null; busy: boolean; onClose: () => void; setConfirm: (c: Confirm) => void; onApprove: () => void; onRun: (c: Extract<Confirm, { kind: "fit" }>) => void }) {
  const { t, isArabic } = useL();
  const { align } = useGarageTheme();
  if (!confirm) return null;
  if (confirm.kind === "approve") {
    const n = confirm.approvable, k = skippedTotal(confirm.skipped);
    return (
      <Sheet visible onClose={onClose} title={n ? t(`Approve ${fitsWord(n, false)}?`, `اعتماد ${fitsWord(n, true)}؟`) : t("Nothing to approve", "لا يوجد ما يُعتمد")} closeLabel={t("Close", "إغلاق")}>
        <View style={{ gap: 12 }}>
          {n ? <GText style={[gType.body, align]}>{t("Customers with these cars will see this part on their car in 3D, exactly as the automatic check computed it.", "سيرى العملاء أصحاب هذه السيارات هذه القطعة على سيارتهم ثلاثية الأبعاد، كما حسبها الفحص التلقائي تمامًا.")}</GText>
            : <GText style={[gType.body, align]}>{t("No car in this selection has a fit that passed the automatic check and waits for approval.", "لا توجد في هذا التحديد سيارة اجتاز تركيبها الفحص التلقائي وينتظر الاعتماد.")}</GText>}
          {k ? <Note tone="warning">{`${t("Skipped", "سيتم تخطي")} ${num(k)}: ${skippedText(confirm.skipped, t)}. ${t("Only passed fits are approved in bulk; review the others one by one.", "تُعتمد التركيبات الناجحة فقط جماعيًا؛ راجع الباقي منفردًا.")}`}</Note> : null}
          {confirm.error ? <Note tone="danger">{confirm.error}</Note> : null}
          <GButton label={t(`Approve ${num(n)}`, `اعتماد ${num(n)}`)} icon="checkmark-done-outline" busy={busy} disabled={busy || !n} onPress={onApprove} />
          <GButton variant="ghost" label={t("Cancel", "إلغاء")} disabled={busy} onPress={onClose} />
        </View>
      </Sheet>
    );
  }
  const s = confirm.summary, reset = confirm.include ? s.approvedSkipped : 0, runs = s.toRun + reset;
  return (
    <Sheet visible onClose={onClose} title={t("Run auto-fit?", "تشغيل التركيب التلقائي؟")} closeLabel={t("Close", "إغلاق")}>
      <View style={{ gap: 12 }}>
        <GText style={[gType.body, align]}>{runs
          ? t(`${carsWord(runs, false)} will be fitted again by the real viewer. The new fits wait for your review.`, `ستُركّب القطعة من جديد على ${carsWord(runs, true)} بالعارض الحقيقي. تنتظر التركيبات الجديدة مراجعتك.`)
          : t("Every selected car is approved, so nothing runs unless you include approved fits.", "كل السيارات المحددة معتمدة، فلن يُشغَّل شيء ما لم تُضمّن التركيبات المعتمدة.")}</GText>
        {s.approvedSkipped ? <>
          {!confirm.include ? <Note icon="shield-checkmark-outline">{s.approvedSkipped === 1
            ? t("1 approved fit is skipped and stays approved.", "سيتم تخطي تركيب واحد معتمد ويبقى معتمدًا.")
            : t(`${num(s.approvedSkipped)} approved fits are skipped and stay approved.`, `سيتم تخطي ${fitsWord(s.approvedSkipped, true)} معتمدة وتبقى معتمدة.`)}</Note> : null}
          <Toggle label={t("Also re-run approved fits (customers lose View on my car until re-approved)", "إعادة تشغيل التركيبات المعتمدة أيضًا (يفقد العملاء «اعرضها على سيارتي» حتى تُعتمد مجددًا)")}
            value={confirm.include} onChange={v => setConfirm({ ...confirm, include: v, error: undefined })} />
          {confirm.include ? <Note tone="danger" icon="warning-outline">{reset === 1
            ? t('1 approved fit will lose its approval. Customers with this car lose "View on my car" for this part until you approve it again.', "سيفقد تركيب معتمد واحد اعتماده. يفقد العملاء أصحاب هذه السيارة «اعرضها على سيارتي» لهذه القطعة حتى تعتمده مجددًا.")
            : t(`${num(reset)} approved fits will lose their approval. Customers with these cars lose "View on my car" for this part until you approve them again.`, `ستفقد ${fitsWord(reset, true)} معتمدة اعتمادها. يفقد العملاء أصحاب هذه السيارات «اعرضها على سيارتي» لهذه القطعة حتى تعتمدها مجددًا.`)}</Note> : null}
        </> : null}
        {runs > 50 ? <GText soft style={[gType.caption, align]}>{t("Many cars take a while: the run continues on the server and shows its progress here, even after you leave.", "تستغرق السيارات الكثيرة وقتًا: يستمر التشغيل على الخادم ويعرض تقدّمه هنا حتى بعد المغادرة.")}</GText> : null}
        {confirm.error ? <Note tone="danger">{confirm.error}</Note> : null}
        <GButton variant={reset ? "danger" : "primary"} icon="refresh-outline" busy={busy} disabled={busy || !runs}
          label={reset ? t(`Re-run ${num(runs)} and reset ${num(reset)} ${reset === 1 ? "approval" : "approvals"}`, `إعادة تشغيل ${num(runs)} وإلغاء ${num(reset)} اعتماد`) : t(`Run auto-fit on ${carsWord(runs, false)}`, `تشغيل التركيب على ${carsWord(runs, true)}`)}
          onPress={() => onRun(confirm)} />
        <GButton variant="ghost" label={t("Cancel", "إلغاء")} disabled={busy} onPress={onClose} />
      </View>
    </Sheet>
  );
}

/** ONE car in 3D with this part, on demand (the only viewer on the screen). */
function FitPreview({ accessoryId, r, onReview }: { accessoryId: string; r: FitRow; onReview: () => void }) {
  const { t, isArabic } = useL();
  const { g, row, align } = useGarageTheme();
  const fits = useLoad(() => adminAccessoryApi.autoFits(r.model3dKey), [r.model3dKey, r.status]);
  const stored = (fits.data ?? []).find(x => x.accessoryId === accessoryId && x.generation.id === r.generationId) ?? null;
  const car = useCatalogModelKey(r.model3dKey);
  const kit = useMemo(() => (stored ? fitKit(stored, NO_ADJUST) : null), [stored]);
  const st = STATE[r.status], why = r.reason ? WHY[r.reason] : null, failed = stored?.fit?.fit.failed;
  return (
    <View style={{ gap: 10 }}>
      <View style={[row, { alignItems: "center", gap: 8, flexWrap: "wrap" }]}>
        <StatusChip label={t(st.en, st.ar)} tone={st.tone} />
        <GText soft style={[gType.caption, align]}>{`${r.code} · ${years(r)}`}</GText>
      </View>
      {why ? <GText soft style={[gType.caption, align]}>{t(...why)}</GText> : null}
      {failed ? <Note tone="danger">{`${t("Does not fit this car", "لا تناسب هذه السيارة")}: ${failed}`}</Note> : null}
      {fits.error ? <Note tone="danger">{fits.error}</Note> : null}
      {!car ? <Note>{t("This car's 3D model is not available to preview.", "نموذج هذه السيارة ثلاثي الأبعاد غير متاح للمعاينة.")}</Note>
        : fits.data ? <>
          <Car3DView model={car} color="#8b9baa" bg={g.cardSoft} kit={kit ?? undefined} interactive style={{ height: 280, borderRadius: 16 }} />
          {!kit ? <GText soft style={[gType.tiny, align]}>{t("No current fit for this car yet: the car is shown without the part.", "لا يوجد تركيب حالي لهذه السيارة بعد: تظهر السيارة دون القطعة.")}</GText> : null}
        </> : <SkeletonRows count={3} />}
      <GButton variant="secondary" icon="construct-outline" label={t("Open full review", "فتح المراجعة الكاملة")} onPress={onReview} />
    </View>
  );
}
