// Parts Admin: review the fits of ONE accessory on ALL its cars at once (universal rims x every car is too slow one by one).
// A grid of the cars with a thumbnail and a state. Only fits that PASSED the automatic fit check can be selected for "Approve";
// failed / not computed / needs-correction fits are not selectable and still need a single review (Accessory fits). "Unapprove" takes
// approved ones. One confirmation sheet; the server re-checks every state and writes the audit rows (who, how many, which cars).
import { Image } from "expo-image";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { Card, Chip, EmptyState, ErrorState, GButton, GIcon, GText, ListRow, Note, Section as GSection, Sheet, SkeletonRows, StatusChip, Tap, type Tone } from "../../components/garage";
import { apiUrl } from "../../core/config/api";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { gShape, gType, useGarageTheme } from "../../theme/garage";
import { DeptHead, DeptPage } from "../department/ui";
import { ACCESSORY_TYPE_LABELS, adminAccessoryApi, type AccessoryFits, type BulkFitsResult, type FitState } from "./api";

const STATE: Record<FitState, { en: string; ar: string; tone: Tone }> = {
  approved: { en: "Approved", ar: "معتمد", tone: "success" },
  passed: { en: "Passed", ar: "اجتاز الفحص", tone: "accent" },
  failed: { en: "Failed", ar: "فشل", tone: "danger" },
  not_computed: { en: "Not computed", ar: "لم يُحسب", tone: "neutral" },
  needs_correction: { en: "Needs correction", ar: "يحتاج إلى تصحيح", tone: "warning" },
  has_correction: { en: "Manual correction", ar: "تصحيح يدوي", tone: "warning" },
};
const ORDER: FitState[] = ["approved", "passed", "has_correction", "failed", "not_computed", "needs_correction"];
/** Why a state cannot be selected, in words. */
const WHY: Record<string, [string, string]> = {
  failed: ["Does not fit this car. Review it one by one.", "لا تناسب هذه السيارة. راجعها منفردة."],
  not_computed: ["Not computed yet. Wait for the fit or confirm the car's part map.", "لم تُحسب بعد. انتظر التركيب أو أكّد خريطة قطع السيارة."],
  needs_correction: ["Marked needs correction. Review it one by one.", "معلّمة تحتاج إلى تصحيح. راجعها منفردة."],
  has_correction: ["Has a manual correction, review on its own.", "عليها تصحيح يدوي، راجعها منفردة."],
};
/** "N fits" with the right Arabic number noun (1 تركيب واحد, 2 تركيبان, 3-10 تركيبات, else تركيبًا). */
const fitsWord = (n: number, ar: boolean) => (!ar ? `${n} ${n === 1 ? "fit" : "fits"}` : n === 1 ? "تركيب واحد" : n === 2 ? "تركيبان" : `${n} ${n <= 10 ? "تركيبات" : "تركيبًا"}`);
const SKIP: Record<string, [string, string]> = {
  FIT_FAILED: ["failed fit", "تركيب فاشل"], FIT_NOT_READY: ["not computed", "لم يُحسب"], NEEDS_CORRECTION: ["needs correction", "يحتاج إلى تصحيح"],
  ALREADY_APPROVED: ["already approved", "معتمد مسبقًا"], HAS_CORRECTION: ["has a manual correction, review on its own", "عليها تصحيح يدوي، راجعها منفردة"], FIT_NOT_APPROVED: ["not approved", "غير معتمد"], NOT_A_TARGET: ["not a car of this part", "ليست سيارة لهذه القطعة"],
};

/** The list of accessories that have fits to review (published or ready for final review). */
export function BulkFitsPicker() {
  const { t } = useL();
  const list = useLoad(adminAccessoryApi.list, [], 15000);
  const rows = (list.data ?? []).filter(a => ["PUBLISHED", "READY_FOR_FINAL_REVIEW"].includes(a.status) && !a.deactivatedAt);
  return (
    <DeptPage back tabs={false} onRefresh={() => void list.reload()} refreshing={list.loading && !!list.data}>
      <DeptHead title={t("Review fits by accessory", "مراجعة التركيب حسب القطعة")} caption={t("Pick an accessory to review all its cars together.", "اختر قطعة لمراجعة كل سياراتها معًا.")} />
      {list.error && !list.data ? <ErrorState text={list.error} onRetry={list.reload} retryLabel={t("Retry", "إعادة المحاولة")} /> : null}
      {!list.data && !list.error ? <SkeletonRows count={4} /> : null}
      {list.data && !rows.length ? <EmptyState photo="empty.requests" text={t("No published accessory to review.", "لا توجد قطعة منشورة للمراجعة.")} /> : null}
      <Card pad={8}>
        {rows.map((a, i) => <ListRow key={a.id} divider={i > 0} icon="cube-outline" title={`${a.productName}`} sub={`${a.shopName} · ${t(...ACCESSORY_TYPE_LABELS[a.accessoryType])}`} onPress={() => router.push(`/dept/accessory-fits?accessoryId=${encodeURIComponent(a.id)}` as Href)} />)}
      </Card>
    </DeptPage>
  );
}

export function BulkFits() {
  const { accessoryId } = useLocalSearchParams<{ accessoryId?: string }>();
  if (!accessoryId) return <BulkFitsPicker />;
  return <BulkFitsGrid accessoryId={String(accessoryId)} />;
}

function BulkFitsGrid({ accessoryId }: { accessoryId: string }) {
  const { t, isArabic } = useL();
  const { g, row, align } = useGarageTheme();
  const state = useLoad(() => adminAccessoryApi.accessoryFits(accessoryId), [accessoryId], 6000);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FitState | "all">("all");
  const [confirm, setConfirm] = useState<"approve" | "unapprove" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkFitsResult | null>(null);
  const data: AccessoryFits | null = state.data;
  const cars = data?.cars ?? [];
  const byState = useMemo(() => { const m: Record<FitState, number> = { approved: 0, passed: 0, failed: 0, not_computed: 0, needs_correction: 0, has_correction: 0 }; for (const c of cars) m[c.status]++; return m; }, [cars]);
  const stateOf = (id: string) => cars.find(c => c.generationId === id)?.status;
  // a selection only ever holds cars that still exist in the right state (a refresh can change a state under it)
  const selected = [...sel].filter(id => { const s = stateOf(id); return s === "passed" || s === "approved"; });
  const nApprove = selected.filter(id => stateOf(id) === "passed").length, nUnapprove = selected.filter(id => stateOf(id) === "approved").length;
  const shown = cars.filter(c => filter === "all" || c.status === filter);
  const toggle = (id: string) => setSel(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const mixed = nApprove > 0 && nUnapprove > 0;

  const run = async () => {
    if (!confirm) return;
    const action = confirm, ids = selected.filter(id => stateOf(id) === (action === "approve" ? "passed" : "approved"));
    setBusy(true); setError(null);
    try {
      const r = await adminAccessoryApi.bulkFits(accessoryId, action, ids);
      setResult(r); setConfirm(null); setSel(new Set()); await state.reload();
    } catch (e) { setError(e instanceof Error ? e.message : t("Could not complete the review.", "تعذّر إكمال المراجعة.")); }
    finally { setBusy(false); }
  };
  const confirmCount = confirm === "approve" ? nApprove : nUnapprove;
  const footer = data ? (
    <View style={{ gap: 8 }}>
      <GButton label={`${t("Approve selected", "اعتماد المحدد")}${nApprove ? ` (${nApprove})` : ""}`} icon="checkmark-circle-outline" disabled={busy || !nApprove || mixed} onPress={() => setConfirm("approve")} />
      <GButton variant="secondary" label={`${t("Unapprove selected", "إلغاء اعتماد المحدد")}${nUnapprove ? ` (${nUnapprove})` : ""}`} disabled={busy || !nUnapprove || mixed} onPress={() => setConfirm("unapprove")} />
      {mixed ? <GText soft style={[gType.tiny, align]}>{t("You selected approved and passed cars together. Select one kind at a time.", "حددت سيارات معتمدة وأخرى اجتازت الفحص معًا. حدّد نوعًا واحدًا في كل مرة.")}</GText> : null}
    </View>
  ) : undefined;

  return (
    <DeptPage back tabs={false} footer={footer} onRefresh={() => void state.reload()} refreshing={state.loading && !!state.data}>
      <DeptHead title={data?.accessory.productName ?? t("Accessory fits", "تركيب القطعة")}
        caption={data ? `${t(...ACCESSORY_TYPE_LABELS[data.accessory.type])}${data.accessory.universal ? ` · ${t("Universal by size", "عام حسب المقاس")}` : ""} · ${cars.length} ${t("cars", "سيارة")}` : undefined} />
      {state.error && !data ? <ErrorState text={state.error} onRetry={state.reload} retryLabel={t("Retry", "إعادة المحاولة")} /> : null}
      {!data && !state.error ? <SkeletonRows count={4} /> : null}
      {data?.accessory.computing ? <Note>{t("Fits are being computed. The grid refreshes by itself.", "يجري حساب التركيب. تتحدّث الشبكة تلقائيًا.")}</Note> : null}
      {result ? (
        <Note tone={result.skipped.length ? "warning" : "success"} icon="checkmark-circle-outline">
          {`${result.action === "approve" ? t("Approved", "تم اعتماد") : t("Unapproved", "تم إلغاء اعتماد")} ${fitsWord(result.done.length, isArabic)}.${result.skipped.length ? ` ${t("Skipped", "تم تخطي")} ${result.skipped.length}: ${result.skipped.map(s => `${s.name} (${t(...(SKIP[s.code] ?? [s.code, s.code]))})`).join(", ")}.` : ""}`}
        </Note>
      ) : null}
      {data ? <>
        <View style={[row, { flexWrap: "wrap", gap: 8, marginBottom: 12 }]}>
          <Chip label={t("All", "الكل")} on={filter === "all"} count={cars.length} onPress={() => setFilter("all")} />
          {ORDER.filter(s => byState[s] > 0).map(s => <Chip key={s} label={t(STATE[s].en, STATE[s].ar)} on={filter === s} count={byState[s]} onPress={() => setFilter(s)} />)}
        </View>
        <View style={[row, { gap: 8, marginBottom: 12, flexWrap: "wrap" }]}>
          <GButton variant="secondary" label={`${t("Select all passed", "تحديد كل ما اجتاز الفحص")} (${byState.passed})`} icon="checkbox-outline" disabled={busy || !byState.passed}
            onPress={() => setSel(new Set(cars.filter(c => c.status === "passed").map(c => c.generationId)))} />
          <GButton variant="ghost" label={t("Clear", "مسح التحديد")} disabled={busy || !sel.size} onPress={() => setSel(new Set())} />
        </View>
        {error ? <Note tone="danger">{error}</Note> : null}
        <View style={[row, { flexWrap: "wrap", gap: 8 }]}>
          {shown.map(c => {
            const selectable = c.status === "passed" || c.status === "approved", on = sel.has(c.generationId), name = isArabic ? c.nameAr : c.name;
            const m = STATE[c.status];
            return (
              <Tap key={c.generationId} label={`${name}. ${t(m.en, m.ar)}${on ? `. ${t("Selected", "محدد")}` : ""}${selectable ? "" : `. ${t(...(WHY[c.status] ?? ["", ""]))}`}`}
                onPress={selectable ? () => toggle(c.generationId) : undefined} disabled={!selectable || busy}
                style={{ width: "31.8%", minHeight: 132, borderRadius: gShape.card, padding: 8, gap: 6, backgroundColor: g.card, borderWidth: on ? 2 : 1, borderColor: on ? g.accent : g.line, opacity: selectable ? 1 : 0.6 }}>
                <View style={{ height: 52, borderRadius: gShape.small, overflow: "hidden", backgroundColor: g.cardSoft, alignItems: "center", justifyContent: "center" }}>
                  {c.photoUrl ? <Image source={{ uri: apiUrl(c.photoUrl) }} contentFit="cover" style={{ width: "100%", height: "100%" }} accessibilityLabel={name} /> : <GIcon name="car-outline" size={24} color={g.soft} />}
                  {on ? <View style={{ position: "absolute", top: 3, [isArabic ? "left" : "right"]: 3, width: 20, height: 20, borderRadius: 10, backgroundColor: g.accent, alignItems: "center", justifyContent: "center" }}><GIcon name="checkmark" size={14} color={g.onAccent} /></View> : null}
                </View>
                <GText numberOfLines={2} style={[gType.tiny, align, { fontWeight: "700", minHeight: 28 }]}>{name}</GText>
                <StatusChip label={t(m.en, m.ar)} tone={m.tone} />
                {c.status === "has_correction" ? <GText soft numberOfLines={3} style={[gType.tiny, align]}>{t(...WHY.has_correction!)}</GText> : null}
              </Tap>
            );
          })}
        </View>
        {!shown.length ? <EmptyState photo="empty.search" text={t("No cars in this state.", "لا توجد سيارات بهذه الحالة.")} /> : null}
        {data.cars.some(c => !["approved", "passed"].includes(c.status)) ? (
          <View style={{ marginTop: 16 }}>
            <Note icon="information-circle-outline">{t("Failed, not computed, needs-correction and manually corrected fits cannot be selected here: bulk never drops a manual correction. Review them one by one in Accessory fits.", "لا يمكن تحديد التركيبات الفاشلة أو غير المحسوبة أو التي تحتاج إلى تصحيح أو عليها تصحيح يدوي هنا: الاعتماد الجماعي لا يحذف أي تصحيح يدوي. راجعها منفردة في «تركيب الإكسسوارات».")}</Note>
            <View style={{ marginTop: 8 }}><GButton variant="ghost" label={t("Open Accessory fits", "فتح تركيب الإكسسوارات")} onPress={() => router.push("/dept/accessory-zones?mode=fits" as Href)} /></View>
          </View>
        ) : null}
        <GSection title={t("Customers", "العملاء")}>
          <Note icon="eye-outline">{t("Customers only see fits that are approved.", "لا يرى العملاء إلا التركيبات المعتمدة.")}</Note>
        </GSection>
      </> : null}

      <Sheet visible={!!confirm} onClose={() => { if (!busy) setConfirm(null); }} title={`${confirm === "approve" ? t("Approve", "اعتماد") : t("Unapprove", "إلغاء اعتماد")} ${fitsWord(confirmCount, isArabic)}${t("?", "؟")}`} closeLabel={t("Close", "إغلاق")}>
        <View style={{ gap: 12 }}>
          <GText style={[gType.body, align]}>{confirm === "approve"
            ? t("Customers with these cars will see this part on their car in 3D. Each fit is approved as the automatic check computed it.", "سيرى العملاء أصحاب هذه السيارات هذه القطعة على سيارتهم ثلاثية الأبعاد. يُعتمد كل تركيب كما حسبه الفحص التلقائي.")
            : t("Customers with these cars stop seeing this part on their car in 3D until it is approved again.", "سيتوقف العملاء أصحاب هذه السيارات عن رؤية هذه القطعة على سيارتهم حتى يُعاد اعتمادها.")}</GText>
          <GText soft numberOfLines={4} style={[gType.caption, align]}>{selected.filter(id => stateOf(id) === (confirm === "approve" ? "passed" : "approved")).map(id => cars.find(c => c.generationId === id)).map(c => c ? (isArabic ? c.nameAr : c.name) : "").join(" · ")}</GText>
          {error ? <Note tone="danger">{error}</Note> : null}
          <GButton label={confirm === "approve" ? `${t("Approve", "اعتماد")} ${confirmCount}` : `${t("Unapprove", "إلغاء اعتماد")} ${confirmCount}`} variant={confirm === "approve" ? "primary" : "danger"} busy={busy} disabled={busy || !confirmCount} onPress={() => void run()} />
          <GButton variant="ghost" label={t("Cancel", "إلغاء")} disabled={busy} onPress={() => setConfirm(null)} />
        </View>
      </Sheet>
    </DeptPage>
  );
}
