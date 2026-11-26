// The fit review editor's correction tools (Parts Admin, hard cases like a bumper fused into the body): phone-sized nudges with step
// sizes, the live fit check (FIT-QA's clip / gap of the part where it is now, from the viewer), before / after and Undo, and "Apply this
// correction to similar cars" (saved for review on each car after the server's own viewer check; never approved). Up to IN_APP_MAX cars
// run here one by one; more run as the accessory's background fit job (it goes on when this screen is left; progress on the job card).
import { type Href, router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Chip, GButton, GIcon, GText, Note, Rail, Sheet, SkeletonRows, Tabs } from "../../components/garage";
import { ManageCheck, ManageRow } from "../../components/manage/ManagePage";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { gShape, gType, useGarageTheme } from "../../theme/garage";
import type { FitAdjust } from "../car3d/car3d";
import type { FitCheck } from "../car3d/useCar3D";
import { threeDError } from "../vehicleCatalog/lifecycleText";
import { FIT_STATE_LABELS, adminAccessoryApi, type CorrectionCheck, type FitRow } from "./api";
import { IN_APP_MAX, atBound, axisNumber, nudge, unitOf, type Axis, type StepSize } from "./correction";
import { carsText } from "./progress";

type T = (en: string, ar: string) => string;
const ROWS: { axis: Axis; en: string; ar: string }[] = [
  { axis: "x", en: "Left / right", ar: "يسار / يمين" }, { axis: "y", en: "Down / up", ar: "أسفل / أعلى" }, { axis: "z", en: "Back / forward", ar: "خلف / أمام" },
  { axis: "rx", en: "Tilt", ar: "إمالة" }, { axis: "ry", en: "Turn", ar: "دوران" }, { axis: "s", en: "Size", ar: "الحجم" },
];
const SIZES: { key: StepSize; label: [string, string] }[] = [{ key: "fine", label: ["1 mm", "1 مم"] }, { key: "mid", label: ["5 mm", "5 مم"] }, { key: "coarse", label: ["1 cm", "1 سم"] }];
const unit = (axis: Axis, t: T) => ({ mm: t("mm", "مم"), deg: "°", pct: "%" })[unitOf(axis)];

/** FIT-QA's verdict of what is on screen: green when it passes (PERFECT / GOOD), red when it does not, "Checking…" in between. */
export function FitCheckPill({ check, checking, rims, saved }: { check: FitCheck | null; checking: boolean; rims: boolean; /** the server's stored check of this position */ saved?: boolean }) {
  const { t } = useL(); const { g, row, align } = useGarageTheme();
  const ok = !!check && !("error" in check) && check.tier !== "REFUSED";
  const c = checking || !check ? g.soft : "error" in check ? g.warning : ok ? g.success : g.danger;
  const text = checking || !check ? t("Checking the fit…", "جارٍ فحص التركيب…")
    : "error" in check ? t("The fit check could not run here.", "تعذّر تشغيل فحص التركيب هنا.")
    : `${check.tier === "PERFECT" ? t("Perfect fit", "تركيب ممتاز") : check.tier === "GOOD" ? t("Fit check passes", "يجتاز فحص التركيب") : t("Does not pass", "لا يجتاز الفحص")} · ${t("clip", "تداخل")} ${check.clipMm} ${t("mm", "مم")}${check.gapMm !== null ? ` · ${t("gap", "فراغ")} ${check.gapMm} ${t("mm", "مم")}` : ""} · ${t("limit", "الحد")} ${check.limitMm} ${t("mm", "مم")}`;
  return <View accessible accessibilityRole="text" accessibilityLiveRegion="polite" accessibilityLabel={text}
    style={[row, { alignItems: "center", gap: 8, minHeight: 44, paddingHorizontal: 12, borderRadius: gShape.small, borderWidth: 1.5, borderColor: c, backgroundColor: g.card }]}>
    {checking || !check ? <ActivityIndicator size="small" color={g.soft} /> : <GIcon name={ok ? "checkmark-circle" : "alert-circle"} size={20} color={c} />}
    <GText style={[gType.caption, align, { flex: 1, fontWeight: "700", color: checking || !check ? g.soft : g.ink }]}>{text}</GText>
    <GText soft style={[gType.tiny, { maxWidth: 86 }]}>{[saved ? t("server check", "فحص الخادم") : t("live", "مباشر"), rims ? t("clip only", "التداخل فقط") : null].filter(Boolean).join(" · ")}</GText>
  </View>;
}

function Nudge({ icon, label, disabled, onPress }: { icon: "remove" | "add"; label: string; disabled: boolean; onPress: () => void }) {
  const { g } = useGarageTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} hitSlop={4}
    style={({ pressed }) => ({ width: 56, height: 56, borderRadius: 16, borderWidth: 1, borderColor: g.line, backgroundColor: pressed ? g.tint : g.card, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.4 : 1 })}>
    <GIcon name={icon} size={26} color={g.ink} />
  </Pressable>;
}

/** The correction panel: step size, six rows of − value +, before / after, Undo, Reset, the live check and "Apply to similar cars". */
export function CorrectionPanel({ adj, onChange, view, setView, check, checking, saved, rims, canUndo, onUndo, onReset, corrected, changed, onSimilar, onDone }: {
  adj: FitAdjust; onChange: (a: FitAdjust) => void; view: "before" | "after"; setView: (v: "before" | "after") => void; check: FitCheck | null; checking: boolean; saved: boolean; rims: boolean;
  canUndo: boolean; onUndo: () => void; onReset: () => void; corrected: boolean; changed: boolean; onSimilar: () => void; onDone: () => void;
}) {
  const { t } = useL(); const { g, row, align } = useGarageTheme();
  const [size, setSize] = useState<StepSize>("mid");
  const before = view === "before";
  return <View style={{ gap: 10, padding: 14, borderRadius: gShape.small, borderWidth: 1, borderColor: g.line, backgroundColor: g.card }}>
    <View style={[row, { alignItems: "center", gap: 8 }]}>
      <GText accessibilityRole="header" style={[gType.label, align, { flex: 1, fontWeight: "800" }]}>{t("Correct the position", "تصحيح الموضع")}</GText>
      <GButton variant="ghost" label={t("Done", "تم")} onPress={onDone} />
    </View>
    <Tabs value={view} onChange={setView} options={[{ key: "before", label: t("Before", "قبل") }, { key: "after", label: t("After", "بعد") }]} />
    <FitCheckPill check={check} checking={checking} saved={saved} rims={rims} />
    {before ? <GText soft style={[gType.caption, align]}>{t("Showing the fit as it is saved now. Switch to After to adjust.", "يُعرض التركيب كما هو محفوظ الآن. انتقل إلى «بعد» للتعديل.")}</GText> : <>
      <View style={[row, { alignItems: "center", gap: 8 }]}>
        <GText soft style={[gType.caption, align]}>{t("Step", "الخطوة")}</GText>
        <Rail gap={8}>{SIZES.map(s => <Chip key={s.key} label={t(...s.label)} on={size === s.key} onPress={() => setSize(s.key)} />)}</Rail>
      </View>
      <GText soft style={[gType.tiny, align]}>{size === "fine" ? t("Turn 0.25° · size 0.1 %", "الدوران 0.25° · الحجم 0.1 %") : size === "mid" ? t("Turn 1° · size 0.5 %", "الدوران 1° · الحجم 0.5 %") : t("Turn 2° · size 1 %", "الدوران 2° · الحجم 1 %")}</GText>
      {ROWS.map(r => <View key={r.axis} style={[row, { alignItems: "center", gap: 10, minHeight: 60 }]}>
        <GText style={[gType.label, align, { flex: 1, minWidth: 0 }]}>{t(r.en, r.ar)}</GText>
        <Nudge icon="remove" label={`${t(r.en, r.ar)} −`} disabled={atBound(adj, r.axis, -1)} onPress={() => onChange(nudge(adj, r.axis, -1, size))} />
        <GText style={[gType.label, { width: 76, textAlign: "center", writingDirection: "ltr", fontWeight: "800" }]}>{`${axisNumber(adj, r.axis)} ${unit(r.axis, t)}`}</GText>
        <Nudge icon="add" label={`${t(r.en, r.ar)} +`} disabled={atBound(adj, r.axis, 1)} onPress={() => onChange(nudge(adj, r.axis, 1, size))} />
      </View>)}
      <View style={[row, { gap: 8 }]}>
        <GButton flex variant="secondary" icon="arrow-undo-outline" label={t("Undo", "تراجع")} disabled={!canUndo} onPress={onUndo} />
        <GButton flex variant="secondary" icon="refresh-outline" label={t("Auto-fit", "التركيب التلقائي")} disabled={!corrected} onPress={onReset} />
      </View>
    </>}
    {changed ? <GText soft style={[gType.caption, align]}>{t("Approve below to save this correction on this car.", "اعتمد في الأسفل لحفظ هذا التصحيح على هذه السيارة.")}</GText> : null}
    <GButton variant="secondary" icon="copy-outline" label={t("Apply this correction to similar cars", "تطبيق هذا التصحيح على سيارات مشابهة")} disabled={!corrected} onPress={onSimilar} />
  </View>;
}

type Result = { id: string; name: string; saved: boolean; check?: CorrectionCheck; error?: string };
const carName = (r: FitRow, ar: boolean) => (ar ? `${r.makeAr} ${r.modelAr} ${r.code}` : `${r.make} ${r.model} ${r.code}`);
const GROUP_TITLES: Record<"model3d" | "family" | "body", [string, string]> = { model3d: ["Same 3D model", "نموذج ثلاثي الأبعاد نفسه"], family: ["Same model, other generations", "الطراز نفسه، أجيال أخرى"], body: ["Same body type", "نوع الهيكل نفسه"] };
const BODY: Record<string, [string, string]> = { sedan: ["sedan", "سيدان"], hatchback: ["hatchback", "هاتشباك"], suv: ["SUV", "دفع رباعي"], van: ["van", "فان"], pickup: ["pickup", "بيك أب"] };

/** "Apply this correction to similar cars": the cars sharing this car's 3D body, with checkboxes; then each is checked by the server's
 *  viewer with the correction and saved for review. Approved cars start unticked (ticking one resets its approval). */
export function SimilarSheet({ visible, onClose, accessoryId, generationId, adj }: { visible: boolean; onClose: () => void; accessoryId: string; generationId: string; adj: FitAdjust }) {
  const { t, isArabic } = useL(); const { g, row, align } = useGarageTheme();
  const list = useLoad(() => (visible ? adminAccessoryApi.similarFits(accessoryId, generationId) : Promise.resolve(null)), [visible, accessoryId, generationId]);
  const [sel, setSel] = useState<Set<string>>(new Set()), [open, setOpen] = useState<Record<string, boolean>>({ model3d: true, family: true, body: false });
  const [run, setRun] = useState<{ done: number; total: number; results: Result[]; running: boolean } | null>(null), [jobStarted, setJobStarted] = useState(false), [err, setErr] = useState<string | null>(null);
  const stop = useRef(false);
  const groups = list.data?.groups;
  const all = groups ? [...groups.model3d, ...groups.family, ...groups.body] : [];
  // default ticks: same 3D model + same model, never an approved one
  useEffect(() => { if (groups) setSel(new Set([...groups.model3d, ...groups.family].filter(r => r.status !== "approved").map(r => r.generationId))); setRun(null); setJobStarted(false); setErr(null); }, [list.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const picked = all.filter(r => sel.has(r.generationId)), approvedPicked = picked.filter(r => r.status === "approved").length;
  const toggle = (id: string) => setSel(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleGroup = (rows: FitRow[]) => setSel(s => { const n = new Set(s), on = rows.every(r => n.has(r.generationId)); rows.forEach(r => (on ? n.delete(r.generationId) : n.add(r.generationId))); return n; });
  const busy = !!run?.running;

  const runHere = async () => {
    stop.current = false; setErr(null);
    // a new array on every update: the React Compiler caches what it derives from an array it has seen
    const results: Result[] = [];
    setRun({ done: 0, total: picked.length, results: [], running: true });
    for (const r of picked) {
      if (stop.current) break;
      try { const x = await adminAccessoryApi.suggestFit(accessoryId, r.generationId, adj, r.status === "approved"); results.push({ id: r.generationId, name: carName(r, isArabic), saved: x.saved, check: x.check }); }
      catch (e) { results.push({ id: r.generationId, name: carName(r, isArabic), saved: false, error: threeDError(e, t) }); }
      setRun({ done: results.length, total: picked.length, results: [...results], running: true });
    }
    setRun({ done: results.length, total: picked.length, results: [...results], running: false });
  };
  const runJob = async () => {
    setErr(null); setRun({ done: 0, total: picked.length, results: [], running: true });
    try {
      const body = { generationIds: picked.map(r => r.generationId) };
      // the server's own counts of what this run resets (approvals / saved corrections replaced), confirmed back exactly
      const dry = await adminAccessoryApi.startFitJob(accessoryId, body, { dryRun: true, includeApproved: true, includeCorrections: true, correction: adj });
      await adminAccessoryApi.startFitJob(accessoryId, body, { correction: adj, includeApproved: dry.summary.approvedReset > 0, confirmApprovedReset: dry.summary.approvedReset,
        includeCorrections: dry.summary.correctionsReset > 0, confirmCorrectionReset: dry.summary.correctionsReset });
      setJobStarted(true); setRun(null);
    } catch (e) { setErr(threeDError(e, t)); setRun(null); }
  };
  const many = picked.length > IN_APP_MAX;
  const savedN = run?.results.filter(r => r.saved).length ?? 0, failedN = (run?.results.length ?? 0) - savedN;
  const review = () => { onClose(); router.push(`/dept/accessory-fits?accessoryId=${encodeURIComponent(accessoryId)}&status=review` as Href); };

  const footer = jobStarted ? <GButton icon="pulse-outline" label={t("See the progress", "عرض التقدّم")} onPress={review} />
    : run && !run.running ? <View style={{ gap: 8 }}>
      {savedN ? <GButton icon="car-sport-outline" label={t("Review them", "راجعها")} onPress={review} /> : null}
      <GButton variant={savedN ? "ghost" : "primary"} label={t("Close", "إغلاق")} onPress={onClose} />
    </View>
    : run?.running && !many ? <GButton variant="secondary" icon="stop-circle-outline" label={t("Stop after this car", "التوقف بعد هذه السيارة")} onPress={() => { stop.current = true; }} />
    : <GButton icon="copy-outline" busy={busy} disabled={busy || !picked.length}
      label={!picked.length ? t("Choose cars", "اختر سيارات") : many ? t(`Apply to ${carsText(picked.length, false)} in the background`, `تطبيق على ${carsText(picked.length, true)} في الخلفية`) : t(`Apply to ${carsText(picked.length, false)}`, `تطبيق على ${carsText(picked.length, true)}`)}
      onPress={() => void (many ? runJob() : runHere())} />;

  return <Sheet visible={visible} onClose={() => { stop.current = true; onClose(); }} tall title={t("Apply to similar cars", "تطبيق على سيارات مشابهة")} closeLabel={t("Close", "إغلاق")} footer={footer}>
    <View style={{ gap: 12 }}>
      <GText soft style={[gType.caption, align]}>{t("Each car is checked with this correction by the viewer on the server. The ones that pass are saved for your review; nothing is approved.", "تُفحص كل سيارة مع هذا التصحيح بالعارض على الخادم. تُحفظ الناجحة لمراجعتك؛ ولا يُعتمد شيء.")}</GText>
      {jobStarted ? <Note tone="success" icon="checkmark-circle-outline">{t("Running in the background: it goes on if you leave. The progress is on the job card of this part's fits.", "يعمل في الخلفية ويستمر إن غادرت. التقدّم في بطاقة التشغيل ضمن تركيبات هذه القطعة.")}</Note>
        : run ? <View style={{ gap: 8 }}>
          <View style={[row, { alignItems: "center", gap: 8 }]}>
            {run.running ? <ActivityIndicator size="small" color={g.accent} /> : <GIcon name="checkmark-done-outline" size={20} color={g.success} />}
            <GText style={[gType.label, align, { flex: 1, fontWeight: "800" }]}>{run.running ? `${run.done} / ${run.total}` : [savedN ? t(`${savedN} saved for review`, `${savedN} محفوظة للمراجعة`) : null, failedN ? t(`${failedN} not changed`, `${failedN} لم تتغير`) : null].filter(Boolean).join(" · ")}</GText>
          </View>
          {run.results.map(r => <View key={r.id} style={[row, { alignItems: "center", gap: 8, minHeight: 36 }]}>
            <GIcon name={r.saved ? "checkmark-circle" : "close-circle"} size={18} color={r.saved ? g.success : g.danger} />
            <GText style={[gType.caption, align, { flex: 1 }]}>{r.name}</GText>
            <GText soft style={[gType.tiny, align, { flexShrink: 1 }]}>{r.error ?? (r.saved ? t("waits for review", "تنتظر المراجعة") : r.check?.gapMm !== undefined ? t(`does not pass · gap ${r.check.gapMm} mm · clip ${r.check.clipMm} mm`, `لا يجتاز · فراغ ${r.check.gapMm} مم · تداخل ${r.check.clipMm} مم`) : t("does not pass the fit check", "لا يجتاز فحص التركيب"))}</GText>
          </View>)}
        </View>
        : list.error ? <Note tone="danger">{list.error}</Note>
        : !groups ? <SkeletonRows count={4} />
        : !all.length ? <Note>{t("No other car of this part shares this car's 3D body, model or body type.", "لا توجد سيارة أخرى لهذه القطعة تشارك هذه السيارة هيكلها أو طرازها أو نوع هيكلها.")}</Note>
        : <>
          {(["model3d", "family", "body"] as const).map(k => { const rows = groups[k]; if (!rows.length) return null;
            const on = rows.filter(r => sel.has(r.generationId)).length, title = `${t(...GROUP_TITLES[k])}${k === "body" && list.data?.bodyType ? ` (${t(...(BODY[list.data.bodyType] ?? [list.data.bodyType, list.data.bodyType]))})` : ""}`;
            return <View key={k} style={{ gap: 2 }}>
              <View style={[row, { alignItems: "center", gap: 6, minHeight: 48 }]}>
                <ManageCheck on={on === rows.length} mixed={on > 0 && on < rows.length} label={`${t("Select all", "تحديد الكل")}: ${title}`} onPress={() => toggleGroup(rows)} />
                <Pressable accessibilityRole="button" accessibilityState={{ expanded: !!open[k] }} accessibilityLabel={title} onPress={() => setOpen(o => ({ ...o, [k]: !o[k] }))} style={[row, { flex: 1, alignItems: "center", gap: 6, minHeight: 48 }]}>
                  <GText style={[gType.label, align, { flex: 1, fontWeight: "800" }]}>{title}</GText>
                  <GText soft style={gType.caption}>{`${on} / ${rows.length}`}</GText>
                  <GIcon name={open[k] ? "chevron-up" : "chevron-down"} size={18} color={g.soft} />
                </Pressable>
              </View>
              {open[k] ? rows.map(r => { const st = FIT_STATE_LABELS[r.status];
                return <ManageRow key={r.generationId} title={carName(r, isArabic)} sub={`${r.yearFrom}–${r.yearTo}${r.status === "approved" ? ` · ${t("approved: ticking it resets the approval", "معتمدة: تحديدها يلغي الاعتماد")}` : ""}`}
                  status={{ label: t(st.en, st.ar), tone: st.tone }} check={{ on: sel.has(r.generationId), label: carName(r, isArabic), onToggle: () => toggle(r.generationId) }} onPress={() => toggle(r.generationId)} />; }) : null}
            </View>; })}
          {approvedPicked ? <Note tone="warning" icon="warning-outline">{t(`${approvedPicked} approved ${approvedPicked === 1 ? "fit loses its" : "fits lose their"} approval: customers with ${approvedPicked === 1 ? "that car" : "those cars"} lose "View on my car" for this part until you approve again.`, `${approvedPicked} من التركيبات المعتمدة ${approvedPicked === 1 ? "يفقد" : "تفقد"} الاعتماد: يفقد العملاء أصحابها «اعرضها على سيارتي» لهذه القطعة حتى تعتمدها مجددًا.`)}</Note> : null}
          {many ? <GText soft style={[gType.caption, align]}>{t(`More than ${IN_APP_MAX} cars run in the background on the server, with progress on the job card.`, `أكثر من ${IN_APP_MAX} سيارات تعمل في الخلفية على الخادم، مع التقدّم في بطاقة التشغيل.`)}</GText> : null}
        </>}
      {err ? <Note tone="danger">{err}</Note> : null}
    </View>
  </Sheet>;
}
