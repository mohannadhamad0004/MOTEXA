// Mechanics admin on the one UI system (docs/guide/10-ui-system.md): Home = Dashboard, Requests = List (segmented Mechanic requests |
// Applications), application review = Detail (/dept/review/mechanic/<userId>), Directory = List of verified mechanics, one mechanic
// request = Detail (/dept/mechanic-requests/<id>). Every number is real (GET /mechanics/admin counts, GET /admin/mechanics/stats);
// decisions use the same endpoints and the same "⋮" actions as before (mechanicActions.tsx).
import { Href, router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { Field, GButton, Note, Section, Sheet, StatusChip, Tabs, Timeline } from "../../components/garage";
import { showToast, type ItemAction } from "../../components/ItemActionsMenu";
import { mechanicApi, mechanicSpecializations, type MechanicProfile } from "../../components/mechanic-api";
import { FilterChips, ManageEntry, ManagePage, ManageRow } from "../../components/manage/ManagePage";
import { Block, CheckRow, Facts, History, Kpis, Loaded, NeedsRow, Page } from "../../components/manage/Page";
import { cityLabel } from "../../core/constants/cities";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { useGarageTheme } from "../../theme/garage";
import { MechanicDocs } from "../mechanics/documents";
import { ACTIVE_STATUSES, mechanicAdmin, type AdminRequestRow } from "../mechanics/mechanicAdminService";
import { mechanicAppStatus, useMechanicStatusLabels, useSkillLabel } from "../mechanics/mechanicBits";
import { mechTone } from "../requests/garageBits";
import { fmtDateTime } from "../requests/requestBits";
import { AdminHero } from "./adminHero";
import { useDepartment } from "./DepartmentContext";
import { mechanicApplicationActions } from "./mechanicActions";

type T = (en: string, ar: string) => string;
type Tabbed = { value: string; options: { key: string; label: string; count?: number }[]; onChange: (k: string) => void };
const go = (path: string) => router.push(path as Href);
const review = (userId: string) => go(`/dept/review/mechanic/${userId}`);
const useStats = () => useLoad(() => mechanicAdmin.stats(), [], 30000);
const useAppCounts = () => useLoad(() => mechanicApi<{ counts: Record<string, number> }>("/api/mechanics/admin").then((r) => r.counts), [], 30000);

// ---------------- Home ----------------
export function MechanicsAdminHome() {
  const { t } = useL();
  const { active } = useDepartment();
  const stats = useStats(), counts = useAppCounts();
  const s = stats.data, c = counts.data;
  const needs = [
    c?.PENDING ? { icon: "person-add-outline" as const, title: t("Applications to review", "طلبات انضمام للمراجعة"), count: c.PENDING, to: "/dept/requests?seg=apps" } : null,
    s?.waiting ? { icon: "time-outline" as const, title: t("Requests waiting for a mechanic", "طلبات بانتظار رد الميكانيكي"), count: s.waiting, to: "/dept/requests?seg=requests&filter=waiting" } : null,
  ].filter((x): x is NonNullable<typeof x> => !!x);
  return (
    <Page title={t(active.en, active.ar)} back={false} tabBar
      hero={<AdminHero dept="mechanics" title={t(active.en, active.ar)} line={s ? t(`${s.activeRequests} active requests · ${s.verifiedMechanics} verified mechanics`, `${s.activeRequests} طلبات نشطة · ${s.verifiedMechanics} ميكانيكيون موثّقون`) : t(active.blurbEn, active.blurbAr)} />}
      onRefresh={() => { void stats.reload(); void counts.reload(); }} refreshing={false}>
      <Section title={t("Needs you now", "بحاجة إليك الآن")} style={{ marginTop: 0 }}>
        <View style={{ gap: 8 }}>
          {needs.map((n) => <NeedsRow key={n.to} icon={n.icon} title={n.title} count={n.count} onPress={() => go(n.to)} />)}
          {s && c && !needs.length ? <Note tone="success" icon="checkmark-circle-outline">{t("Nothing is waiting for you.", "لا شيء بانتظارك.")}</Note> : null}
          {(stats.error && !s) || (counts.error && !c) ? <Note tone="danger" icon="alert-circle-outline">{t("Statistics could not load. Pull down to try again.", "تعذّر تحميل الإحصاءات. اسحب للأسفل للمحاولة مجددًا.")}</Note> : null}
        </View>
      </Section>
      <Kpis items={[
        { label: t("Pending applications", "طلبات قيد المراجعة"), value: c ? (c.PENDING ?? 0) : null, icon: "time-outline", onPress: () => go("/dept/requests?seg=apps") },
        { label: t("Needs completion", "تحتاج استكمالًا"), value: c ? (c.NEEDS_COMPLETION ?? 0) : null, icon: "document-text-outline", onPress: () => go("/dept/requests?seg=apps&filter=NEEDS_COMPLETION") },
        { label: t("Verified mechanics", "ميكانيكيون موثّقون"), value: s?.verifiedMechanics, icon: "shield-checkmark-outline", onPress: () => go("/dept/directory") },
        { label: t("Active requests", "طلبات نشطة"), value: s?.activeRequests, icon: "construct-outline", onPress: () => go("/dept/requests?seg=requests") },
      ]} />
      <Section title={t("Shortcuts", "اختصارات")}>
        <View style={{ gap: 8 }}>
          <ManageEntry icon="clipboard-outline" title={t("Mechanic requests", "طلبات الخدمة")} sub={t("Customer requests to mechanics", "طلبات الزبائن إلى الميكانيكيين")} onPress={() => go("/dept/requests?seg=requests")} />
          <ManageEntry icon="person-add-outline" title={t("Applications", "طلبات الانضمام")} sub={t("Professional applications to review", "طلبات مهنية للمراجعة")} onPress={() => go("/dept/requests?seg=apps")} />
          <ManageEntry icon="people-outline" title={t("Verified mechanics", "الميكانيكيون الموثّقون")} onPress={() => go("/dept/directory")} />
        </View>
      </Section>
    </Page>
  );
}

// ---------------- Requests: mechanic requests | applications ----------------
export function MechanicsRequests() {
  const { t } = useL();
  const params = useLocalSearchParams<{ seg?: string; q?: string; filter?: string }>();
  const [seg, setSeg] = useState<"requests" | "apps">(params.seg === "apps" ? "apps" : "requests");
  // "View their requests" (⋮ of a mechanic) arrives with ?seg=requests&q=<name>, also when this screen is already open
  useEffect(() => { if (params.seg === "apps" || params.seg === "requests") setSeg(params.seg); }, [params.seg, params.q, params.filter]);
  const stats = useStats(), counts = useAppCounts();
  const tabs: Tabbed = { value: seg, onChange: (k) => setSeg(k as "requests" | "apps"), options: [
    { key: "requests", label: t("Mechanic requests", "طلبات الخدمة"), count: stats.data?.activeRequests || undefined },
    { key: "apps", label: t("Applications", "طلبات الانضمام"), count: counts.data?.PENDING || undefined },
  ] };
  return seg === "apps" ? <ApplicationsList tabs={tabs} initial={params.filter} /> : <RequestsList tabs={tabs} initialQ={params.q} initial={params.filter} />;
}

/** "⋮" actions of a mechanic request: Open, and Cancel with a required reason while it is open (audited; both sides see the reason). */
export function mechanicRequestActions(t: T, r: { id: string; active: boolean }, reload: () => unknown, open = true): ItemAction[] {
  const out: ItemAction[] = open ? [{ key: "open", label: t("Open", "فتح"), icon: "open-outline", run: () => go(`/dept/mechanic-requests/${r.id}`) }] : [];
  if (r.active)
    out.push({
      key: "cancel", label: t("Cancel request…", "إلغاء الطلب…"), icon: "close-circle-outline", destructive: true,
      confirm: { title: t("Cancel this request?", "إلغاء هذا الطلب؟"), message: t("The customer and the mechanic are told the reason.", "يُبلَّغ الزبون والميكانيكي بالسبب."), reason: { label: t("Reason (the customer and the mechanic see it)", "السبب (يراه الزبون والميكانيكي)"), required: true }, confirmLabel: t("Cancel the request", "إلغاء الطلب") },
      success: t("Request cancelled.", "تم إلغاء الطلب."), run: async (reason) => { await mechanicAdmin.cancel(r.id, reason ?? ""); await reload(); },
    });
  return out;
}

type ReqFilter = "active" | "waiting" | "accepted" | "progress" | "history";
const REQ: Record<ReqFilter, { scope: "active" | "history"; status: string }> = {
  active: { scope: "active", status: "" }, waiting: { scope: "active", status: ACTIVE_STATUSES[0] }, accepted: { scope: "active", status: ACTIVE_STATUSES[1] },
  progress: { scope: "active", status: ACTIVE_STATUSES[2] }, history: { scope: "history", status: "" },
};
const isReq = (v?: string): v is ReqFilter => !!v && v in REQ;

/** Every mechanic request: ONE chip row (Active · Waiting · Accepted · In progress · History, counts from the stats), a search by customer,
 *  mechanic or city (server side), newest activity first. */
function RequestsList({ tabs, initialQ = "", initial }: { tabs: Tabbed; initialQ?: string; initial?: string }) {
  const { t, isArabic } = useL();
  const L = useMechanicStatusLabels();
  const [filter, setFilter] = useState<ReqFilter>(isReq(initial) ? initial : "active"), [q, setQ] = useState(initialQ);
  useEffect(() => { setQ(initialQ); }, [initialQ]);
  useEffect(() => { if (isReq(initial)) setFilter(initial); }, [initial]);
  const f = REQ[filter];
  const state = useLoad(() => mechanicAdmin.list(f.scope, f.status, q), [f.scope, f.status, q], 15_000);
  const stats = useStats();
  const s = stats.data;
  const line = (r: AdminRequestRow) => [`${r.mechanic.name}${r.mechanic.city ? ` (${cityLabel(r.mechanic.city, isArabic)})` : ""}`, `${r.vehicle.make} ${r.vehicle.model}`,
    r.city ? t(`car in ${cityLabel(r.city, false)}`, `السيارة في ${cityLabel(r.city, true)}`) : null, fmtDateTime(r.updatedAt)].filter(Boolean).join(" · ");
  return (
    <ManagePage title={t("Requests", "الطلبات")} back={false} tabBar tabs={tabs}
      line={s ? t(`${s.waiting} waiting · ${s.inProgress} in progress`, `${s.waiting} بانتظار الرد · ${s.inProgress} قيد التنفيذ`) : undefined}
      search={{ value: q, onChange: setQ, placeholder: t("Customer, mechanic or city", "الزبون أو الميكانيكي أو المدينة") }}
      filters={<FilterChips value={filter} onChange={setFilter} filters={[
        { key: "active", label: t("Active", "النشطة"), count: s?.activeRequests }, { key: "waiting", label: L.REQUESTED, count: s?.waiting },
        { key: "accepted", label: L.ACCEPTED, count: s?.accepted }, { key: "progress", label: L.IN_PROGRESS, count: s?.inProgress },
        { key: "history", label: t("History", "السجل") },
      ]} />}
      items={state.data ?? []} keyOf={(r) => r.id}
      renderItem={(r) => <ManageRow title={r.customerName} sub={line(r)} status={{ label: L[r.status], tone: mechTone(r.status) }}
        onPress={() => go(`/dept/mechanic-requests/${r.id}`)} actions={mechanicRequestActions(t, r, () => Promise.all([state.reload(), stats.reload()]))} />}
      loading={!state.data && !state.error} error={state.error} onRetry={() => void state.reload()}
      empty={{ text: q || filter !== "active" ? t("No requests match.", "لا توجد طلبات مطابقة.") : t("No active requests.", "لا توجد طلبات نشطة."), action: q ? { label: t("Clear search", "مسح البحث"), onPress: () => setQ("") } : undefined }}
      onRefresh={() => { void state.reload(); void stats.reload(); }} refreshing={false} detailHint={t("Tap a request to open it.", "اضغط على طلب لفتحه.")} />
  );
}

type AppRow = { id: string; userId: string; city: string; specializations: string[]; verificationStatus: string; submittedAt: string; interviewResult: string | null; user: { fullName: string; email: string } };
type AppFilter = "PENDING" | "NEEDS_COMPLETION" | "VERIFIED" | "SUSPENDED" | "ALL";
const isApp = (v?: string): v is AppFilter => ["PENDING", "NEEDS_COMPLETION", "VERIFIED", "SUSPENDED", "ALL"].includes(v ?? "");
const useSpec = () => { const { t } = useL(); return (v: string) => { const s = mechanicSpecializations.find((x) => x[0] === v); return s ? t(s[1], s[2]) : v; }; };

/** Professional applications: ONE chip row with the server counts (Pending first; Rejected is under All), a local search, ⋮ = the
 *  decisions the current status allows; tap = the review. */
function ApplicationsList({ tabs, initial }: { tabs: Tabbed; initial?: string }) {
  const { t, isArabic } = useL();
  const spec = useSpec();
  const [filter, setFilter] = useState<AppFilter>(isApp(initial) ? initial : "PENDING"), [q, setQ] = useState("");
  useEffect(() => { if (isApp(initial)) setFilter(initial); }, [initial]);
  const state = useLoad(() => mechanicApi<{ profiles: AppRow[]; counts: Record<string, number> }>("/api/mechanics/admin" + (filter === "ALL" ? "" : `?status=${filter}`)), [filter], 30000);
  const counts = state.data?.counts;
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const rows = (state.data?.profiles ?? []).filter((p) => words.every((w) => [p.user.fullName, p.user.email, p.city, cityLabel(p.city, true), ...p.specializations.map(spec)].join(" ").toLowerCase().includes(w)))
    .sort((a, b) => Number(b.verificationStatus === "PENDING") - Number(a.verificationStatus === "PENDING"));
  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : undefined;
  return (
    <ManagePage title={t("Requests", "الطلبات")} back={false} tabBar tabs={tabs}
      line={counts ? t(`${counts.PENDING ?? 0} pending · ${counts.NEEDS_COMPLETION ?? 0} need completion`, `${counts.PENDING ?? 0} قيد المراجعة · ${counts.NEEDS_COMPLETION ?? 0} تحتاج استكمالًا`) : undefined}
      search={{ value: q, onChange: setQ, placeholder: t("Name, email, city or skill", "الاسم أو البريد أو المدينة أو المهارة") }}
      filters={<FilterChips value={filter} onChange={setFilter} filters={[
        { key: "PENDING", label: t("Pending", "قيد المراجعة"), count: counts ? (counts.PENDING ?? 0) : undefined },
        { key: "NEEDS_COMPLETION", label: t("Needs completion", "يحتاج استكمالًا"), count: counts ? (counts.NEEDS_COMPLETION ?? 0) : undefined },
        { key: "VERIFIED", label: t("Approved", "معتمد"), count: counts ? (counts.VERIFIED ?? 0) : undefined },
        { key: "SUSPENDED", label: t("Suspended", "معلّق"), count: counts ? (counts.SUSPENDED ?? 0) : undefined },
        { key: "ALL", label: t("All", "الكل"), count: total },
      ]} />}
      items={rows} keyOf={(p) => p.id}
      renderItem={(p) => <ManageRow title={p.user.fullName} status={mechanicAppStatus(p.verificationStatus, t)}
        sub={[cityLabel(p.city, isArabic), p.specializations.slice(0, 3).map(spec).join(t(", ", "، ")), p.submittedAt?.slice(0, 10)].filter(Boolean).join(" · ")}
        onPress={() => review(p.userId)} actions={mechanicApplicationActions(t, p, { open: () => review(p.userId), reload: () => state.reload() })} />}
      loading={!state.data && !state.error} error={state.error} onRetry={() => void state.reload()}
      empty={{ text: q ? t("Nothing matches.", "لا توجد نتائج مطابقة.") : t("No applications in this status. Drafts appear here only after they are submitted.", "لا توجد طلبات بهذه الحالة. المسودات تظهر هنا فقط بعد إرسالها."),
        action: q ? { label: t("Clear search", "مسح البحث"), onPress: () => setQ("") } : undefined }}
      onRefresh={() => void state.reload()} refreshing={false} detailHint={t("Tap an application to review it.", "اضغط على طلب لمراجعته.")} />
  );
}

// ---------------- Directory: verified mechanics ----------------
export function MechanicsDirectory() {
  const { t, isArabic } = useL();
  const spec = useSpec();
  const state = useLoad(() => mechanicApi<{ profiles: AppRow[] }>("/api/mechanics/admin?status=VERIFIED").then((r) => r.profiles), [], 30000);
  const [q, setQ] = useState("");
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const rows = useMemo(() => (state.data ?? []).filter((p) => words.every((w) => [p.user.fullName, p.user.email, p.city, cityLabel(p.city, true), ...p.specializations.map(spec)].join(" ").toLowerCase().includes(w)))
    .sort((a, b) => a.user.fullName.localeCompare(b.user.fullName)), [state.data, q]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <ManagePage title={t("Verified mechanics", "الميكانيكيون الموثّقون")} back={false} tabBar
      line={state.data ? t(`${state.data.length} mechanics`, `${state.data.length} ميكانيكيين`) : undefined}
      search={{ value: q, onChange: setQ, placeholder: t("Name, email, city or skill", "الاسم أو البريد أو المدينة أو المهارة") }}
      items={rows} keyOf={(p) => p.id}
      renderItem={(p) => <ManageRow title={p.user.fullName} sub={[cityLabel(p.city, isArabic), p.specializations.slice(0, 3).map(spec).join(t(", ", "، "))].filter(Boolean).join(" · ")}
        onPress={() => review(p.userId)} actions={mechanicApplicationActions(t, p, { open: () => review(p.userId), reload: () => state.reload() })} />}
      loading={!state.data && !state.error} error={state.error} onRetry={() => void state.reload()}
      empty={{ text: q ? t("Nothing matches.", "لا توجد نتائج مطابقة.") : t("No verified mechanics yet.", "لا يوجد ميكانيكيون موثّقون بعد."), action: q ? { label: t("Clear search", "مسح البحث"), onPress: () => setQ("") } : undefined }}
      onRefresh={() => void state.reload()} refreshing={false} detailHint={t("Tap a mechanic to open their file.", "اضغط على ميكانيكي لفتح ملفه.")} />
  );
}

// ---------------- Application review (Detail) ----------------
/** One application: facts, private documents, the interview (pending only), decisions and history. Footer = Approve (pending, needs a
 *  passed interview) or Reactivate (suspended), each with optional notes; Request changes / Reject / Suspend (reason) are in ⋮. */
export function MechanicApplicationReview({ userId }: { userId: string }) {
  const { t, isArabic } = useL();
  const spec = useSpec();
  const state = useLoad(() => mechanicApi<{ profile: MechanicProfile }>("/api/mechanics/admin/" + userId).then((r) => r.profile), [userId]);
  const [interview, setInterview] = useState<"PASSED" | "FAILED">("PASSED"), [interviewNotes, setInterviewNotes] = useState("");
  const [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null), [deciding, setDeciding] = useState<"APPROVE" | "REACTIVATE" | null>(null);
  const p = state.data;
  useEffect(() => { if (p) { setInterview(p.interviewResult === "FAILED" ? "FAILED" : "PASSED"); setInterviewNotes(p.interviewNotes || ""); } }, [p?.id, p?.submissionVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true); setErr(null);
    try { await fn(); await state.reload(); if (ok) showToast(ok); return true; } catch (e) { setErr((e as Error).message); return false; } finally { setBusy(false); }
  };
  const status = p ? mechanicAppStatus(p.verificationStatus, t) : null;
  const actions: ItemAction[] = p ? mechanicApplicationActions(t, p, { open: () => undefined, reload: () => state.reload() }).filter((a) => !["open", "approve", "reactivate"].includes(a.key)) : [];
  const footer = p?.verificationStatus === "PENDING" ? <GButton icon="checkmark-circle-outline" label={t("Approve mechanic", "اعتماد الميكانيكي")} disabled={busy || p.interviewResult !== "PASSED"} onPress={() => setDeciding("APPROVE")} />
    : p?.verificationStatus === "SUSPENDED" ? <GButton icon="play-circle-outline" label={t("Reactivate services", "إعادة تفعيل الخدمات")} disabled={busy} onPress={() => setDeciding("REACTIVATE")} /> : undefined;
  return (
    <Page title={p?.user.fullName ?? t("Mechanic application", "طلب ميكانيكي")} line={p ? [status?.label, p.submittedAt ? `${t("submitted", "أُرسل")} ${p.submittedAt.slice(0, 10)}` : null].filter(Boolean).join(" · ") : undefined}
      actions={actions.length ? actions : undefined} onRefresh={() => void state.reload()} refreshing={false} footer={footer}>
      <Loaded state={state}>{(p) => (
        <>
          {status ? <View style={{ alignSelf: "flex-start" }}><StatusChip {...status} /></View> : null}
          {err ? <Note tone="danger" icon="alert-circle-outline">{err}</Note> : null}
          {p.reviewNotes ? <Note tone="warning" icon="chatbox-ellipses-outline">{p.reviewNotes}</Note> : null}
          {p.verificationStatus === "PENDING" ? (
            <Block title={t("Before approving", "قبل الاعتماد")}>
              <CheckRow ok={p.documents.some((d) => d.kind === "IDENTITY")} label={t("Identity document uploaded", "الهوية مرفوعة")} hint={t("Open it below before approving: the server checks you viewed it.", "افتحها بالأسفل قبل الاعتماد: يتحقق الخادم من أنك اطلعت عليها.")} />
              <CheckRow ok={p.interviewResult === "PASSED"} label={t("Professional interview passed", "اجتياز المقابلة المهنية")} hint={p.interviewResult === "FAILED" ? t("The interview was recorded as failed.", "سُجّلت المقابلة كغير ناجحة.") : undefined} />
            </Block>
          ) : null}
          <Block title={t("Personal & professional details", "البيانات الشخصية والمهنية")}>
            <Facts rows={[
              [t("Email", "البريد"), p.user.email], [t("Phone", "الهاتف"), p.phoneNumber], [t("City", "المدينة"), cityLabel(p.city, isArabic)],
              [t("Specializations", "التخصصات"), p.specializations.map(spec).join(t(", ", "، "))], [t("Experience years", "سنوات الخبرة"), p.yearsOfExperience === null ? null : String(p.yearsOfExperience)],
              [t("Experience", "الخبرة"), p.experienceSummary], [t("Workshop", "الورشة"), p.offersWorkshop ? [p.workshopName, p.workshopAddress].filter(Boolean).join(" · ") : null],
              [t("On-site", "الخدمة الميدانية"), p.offersOnSite ? p.coverageAreas.join(t(", ", "، ")) : null], [t("Online consultation", "استشارات أونلاين"), p.offersOnline ? t("Yes", "نعم") : t("No", "لا")],
            ]} />
          </Block>
          <Block title={t("Private documents", "الوثائق الخاصة")}><MechanicDocs documents={p.documents} /></Block>
          {p.verificationStatus === "PENDING" ? (
            <Block title={t("Professional interview", "المقابلة المهنية")}>
              <View style={{ paddingVertical: 10, gap: 10 }}>
                <Note icon="information-circle-outline">{t("Ask practical questions for the selected specializations, e.g. an engine overheats while driving: what safe checks come first? You record the outcome; AI does not make the decision.", "اطرح أسئلة عملية حسب التخصصات، مثلًا: ترتفع حرارة المحرك أثناء القيادة، ما الفحوصات الآمنة التي تبدأ بها؟ أنت تسجّل النتيجة؛ القرار ليس للذكاء الاصطناعي.")}</Note>
                <Tabs value={interview} onChange={setInterview} options={[{ key: "PASSED", label: t("Passed", "ناجح") }, { key: "FAILED", label: t("Failed", "لم يجتز") }]} />
                <Field label={t("Interview notes (min. 5 characters)", "ملاحظات المقابلة (٥ أحرف على الأقل)")} value={interviewNotes} onChangeText={setInterviewNotes} multiline maxLength={2000} />
                <GButton variant="secondary" icon="save-outline" label={t("Save interview result", "حفظ نتيجة المقابلة")} busy={busy} disabled={busy || interviewNotes.trim().length < 5}
                  onPress={() => void act(() => mechanicApi("/api/mechanics/admin/" + p.userId + "/interview", "POST", { result: interview, notes: interviewNotes, submissionVersion: p.submissionVersion }), t("Interview saved.", "تم حفظ المقابلة."))} />
              </View>
            </Block>
          ) : null}
          {p.history.length ? (
            <Block title={t("Verification history", "سجل التحقق")}>
              <History items={p.history.map((h) => ({ title: h.action.replaceAll("MECHANIC_", "").replaceAll("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()), at: fmtDateTime(h.createdAt), note: h.details?.notes || undefined }))} />
            </Block>
          ) : null}
          <DecisionSheet action={deciding} busy={busy} onClose={() => setDeciding(null)}
            onConfirm={(notes) => void act(() => mechanicApi("/api/mechanics/admin/" + p.userId + "/decision", "POST", { action: deciding, notes, submissionVersion: p.submissionVersion }),
              deciding === "APPROVE" ? t("Approved.", "تم الاعتماد.") : t("Reactivated.", "تمت إعادة التفعيل.")).then((ok) => ok && setDeciding(null))} />
        </>
      )}</Loaded>
    </Page>
  );
}

/** Approve / Reactivate: ask first, with optional notes (saved in the account history). */
function DecisionSheet({ action, busy, onClose, onConfirm }: { action: "APPROVE" | "REACTIVATE" | null; busy: boolean; onClose: () => void; onConfirm: (notes: string) => void }) {
  const { t } = useL();
  const { row } = useGarageTheme();
  const [notes, setNotes] = useState("");
  useEffect(() => { if (action) setNotes(""); }, [action]);
  const approve = action === "APPROVE";
  return (
    <Sheet visible={!!action} onClose={onClose} title={approve ? t("Approve this mechanic?", "اعتماد هذا الميكانيكي؟") : t("Reactivate this mechanic?", "إعادة تفعيل هذا الميكانيكي؟")} closeLabel={t("Close", "إغلاق")}>
      <View style={{ gap: 12 }}>
        <Note icon="information-circle-outline">{approve ? t("The mechanic becomes visible to customers and can receive requests.", "يظهر الميكانيكي للزبائن ويمكنه استقبال الطلبات.") : t("They become visible to customers again.", "يظهر للزبائن من جديد.")}</Note>
        <Field label={t("Notes (optional)", "ملاحظات (اختياري)")} value={notes} onChangeText={setNotes} multiline maxLength={1000} />
        <View style={[row, { gap: 10 }]}>
          <GButton flex variant="secondary" label={t("Cancel", "إلغاء")} disabled={busy} onPress={onClose} />
          <GButton flex label={approve ? t("Approve", "اعتماد") : t("Reactivate", "إعادة التفعيل")} busy={busy} disabled={busy} onPress={() => onConfirm(notes.trim())} />
        </View>
      </View>
    </Sheet>
  );
}

// ---------------- One mechanic request (Detail) ----------------
/** People, car, problem, the car's area, the steps with times. The address and phone appear only while the job is active (server rule).
 *  Cancel (reason required, audited) is in ⋮ while the request is open. */
export function AdminMechanicRequest({ id }: { id: string }) {
  const { t, isArabic } = useL();
  const L = useMechanicStatusLabels();
  const skill = useSkillLabel();
  const state = useLoad(() => mechanicAdmin.get(id), [id]);
  const r = state.data;
  const actions = r ? mechanicRequestActions(t, r, () => state.reload(), false) : [];
  return (
    <Page title={r?.customerName ?? t("Mechanic request", "طلب ميكانيكي")} line={r ? `${r.vehicle.make} ${r.vehicle.model}` : undefined}
      actions={actions.length ? actions : undefined} onRefresh={() => void state.reload()} refreshing={false}>
      <Loaded state={state}>{(r) => (
        <>
          <View style={{ alignSelf: "flex-start" }}><StatusChip tone={mechTone(r.status)} label={L[r.status]} /></View>
          <Note icon="eye-outline">{t("The exact address and the phone are shown only while the job is active; otherwise only the city.", "يظهر العنوان الدقيق والهاتف أثناء العمل النشط فقط؛ وإلا تظهر المدينة فقط.")}</Note>
          {r.cancelReason ? <Note tone="danger" icon="close-circle-outline">{`${r.cancelledBy === "ADMIN" ? t("Cancelled by MOTEXA", "ألغته موتكسا") : t("Cancelled by the customer", "ألغاه الزبون")}: ${r.cancelReason}`}</Note> : null}
          {r.declineReason ? <Note tone="danger" icon="close-circle-outline">{`${t("Declined", "مرفوض")}: ${r.declineReason}`}</Note> : null}
          <Block title={t("The request", "الطلب")}>
            <Facts rows={[
              [t("Customer", "الزبون"), r.customerName],
              [t("Mechanic", "الميكانيكي"), [r.mechanic.name, r.mechanic.workshopName, r.mechanic.city ? cityLabel(r.mechanic.city, isArabic) : null].filter(Boolean).join(" · ")],
              [t("Car", "السيارة"), [r.vehicle.make, r.vehicle.model, r.vehicle.year].filter(Boolean).join(" ")],
              r.skill ? [t("Skill", "المهارة"), skill(r.skill)] : null,
              [t("Problem", "المشكلة"), r.problemDescription], [t("Preferred time", "الوقت المفضل"), r.preferredTime],
            ]} />
          </Block>
          <Block title={t("Place", "المكان")}>
            <Facts rows={[
              [t("Car area", "منطقة السيارة"), r.city ? cityLabel(r.city, isArabic) : t("No pin", "لا يوجد دبوس")],
              r.location.approximate === false ? [t("Address", "العنوان"), r.location.text] : null,
              [t("Phone", "الهاتف"), r.contactPhone],
            ]} />
          </Block>
          <Block title={t("Steps", "الخطوات")}>
            <View style={{ paddingVertical: 10 }}>
              <Timeline steps={r.timeline.map((s) => ({ label: L[s.status], at: fmtDateTime(s.at), state: s.status === "CANCELLED" || s.status === "DECLINED" ? "failed" : "done" }))} />
            </View>
          </Block>
        </>
      )}</Loaded>
    </Page>
  );
}
