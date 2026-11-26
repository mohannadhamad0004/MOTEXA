// /mechanic (docs/guide/10-ui-system.md). While applying the application is a Form step flow (Professional profile · Service options ·
// Documents · Review and submit; Back + Save and continue / Submit in the sticky footer, "Save draft and close" in ⋮, "Discard
// changes?" on leave). Otherwise a Dashboard: Mo hero with the ONE action (Continue verification / Open requests), the requests
// waiting for an answer, real request counts, the application status, approved service modes, notifications, documents,
// appearance and Log out. Same calls and rules as before (GET/PUT /mechanics/me, documents, submit, notifications).
import { router, useFocusEffect, type Href } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Badge, Chip, ErrorState, GButton, GIcon, GText, HeroLayout, Note, Section, SkeletonRows, StatusChip, StepperHeader, Timeline, Toggle, Field, type GIconName } from "../../components/garage";
import { moHeroMedia } from "../../components/garage/MoHero";
import type { ItemAction } from "../../components/ItemActionsMenu";
import { mechanicApi, mechanicSpecializations, type MechanicProfile } from "../../components/mechanic-api";
import { SmartPicker, StepFooter, useDiscardGuard } from "../../components/manage/Form";
import { ManageEntry } from "../../components/manage/ManagePage";
import { Block, Facts, Kpis, LogOut, NeedsRow, Page } from "../../components/manage/Page";
import { CITIES, cityLabel } from "../../core/constants/cities";
import { normalizeNumberText } from "../../core/constants/numbers";
import { useL } from "../../core/hooks/useL";
import { useSessionUser } from "../../core/session/session";
import { gType, useGarageTheme } from "../../theme/garage";
import { AppearanceSection } from "../providerhub/AppearanceSection";
import { fmtDateTime } from "../requests/requestBits";
import { ProviderAccountNote } from "../work/ProviderAccountNote";
import { MechanicDocs, pickMechanicDocument } from "./documents";
import { mechanicAppStatus } from "./mechanicBits";
import { mechanicInbox } from "./mechanicsService";

type Form = {
  city: string; phoneNumber: string; specializations: string[]; yearsOfExperience: string; experienceSummary: string;
  offersWorkshop: boolean; offersOnSite: boolean; offersOnline: boolean; workshopName: string; workshopAddress: string; coverageAreas: string;
};
type Notice = { id: string; title: string; body: string; readAt: string | null; createdAt: string };
type Counts = { waiting: number; active: number; done: number; total: number };

const SKILL_ICON: Record<string, GIconName> = {
  Engine: "cog-outline", Brakes: "disc-outline", Electrical: "flash-outline", Diagnostics: "pulse-outline", "Air conditioning": "snow-outline",
  Transmission: "git-compare-outline", "Suspension & steering": "car-sport-outline", Bodywork: "hammer-outline",
};
const toForm = (p: MechanicProfile): Form => ({
  city: p.city || "", phoneNumber: p.phoneNumber || "", specializations: p.specializations, yearsOfExperience: p.yearsOfExperience === null ? "" : String(p.yearsOfExperience),
  experienceSummary: p.experienceSummary || "", offersWorkshop: p.offersWorkshop, offersOnSite: p.offersOnSite, offersOnline: p.offersOnline,
  workshopName: p.workshopName || "", workshopAddress: p.workshopAddress || "", coverageAreas: p.coverageAreas.join(", "),
});
const splitAreas = (s: string) => s.split(/[,،]/).map((v) => v.trim()).filter(Boolean);
const go = (path: string) => router.push(path as Href);

export default function MechanicHome() {
  const customer = useSessionUser().role === "CUSTOMER"; // Work with MOTEXA applicant: still a customer account until approval
  const { t } = useL();
  const { g, align } = useGarageTheme();
  const [profile, setProfile] = useState<MechanicProfile | null>(null), [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false), [step, setStep] = useState(0), [privacy, setPrivacy] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]), [inbox, setInbox] = useState<Counts | null>(null);
  const scroll = useRef<ScrollView>(null);
  const apply = (p: MechanicProfile) => { setProfile(p); setForm(toForm(p)); };
  /** the inbox counts; a failure only hides the numbers (the inbox screen shows its own error) */
  const loadInbox = (): Promise<Counts | null> => customer ? Promise.resolve(null) : mechanicInbox.list().then((rows) => ({
    waiting: rows.filter((r) => r.status === "REQUESTED").length, active: rows.filter((r) => r.status === "ACCEPTED" || r.status === "IN_PROGRESS").length,
    done: rows.filter((r) => r.status === "COMPLETED").length, total: rows.length,
  })).catch(() => null);
  async function refresh() {
    apply((await mechanicApi<{ profile: MechanicProfile }>("/api/mechanics/me")).profile);
    const [n, counts] = await Promise.all([mechanicApi<{ notifications: Notice[] }>("/api/mechanics/notifications"), loadInbox()]);
    setNotices(n.notifications); setInbox(counts);
  }
  useFocusEffect(useCallback(() => {
    let alive = true;
    setBusy(true);
    void mechanicApi<{ profile: MechanicProfile }>("/api/mechanics/me").then(async (data) => {
      if (!alive) return;
      apply(data.profile);
      const [n, counts] = await Promise.all([mechanicApi<{ notifications: Notice[] }>("/api/mechanics/notifications"), loadInbox()]);
      if (alive) { setNotices(n.notifications); setInbox(counts); }
    }).catch((e) => { if (alive) setError(e.message); }).finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []));
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : t("Please try again.", "يرجى المحاولة مرة أخرى.")); } finally { setBusy(false); }
  }
  const change = <K extends keyof Form>(key: K, value: Form[K]) => setForm((v) => (v ? { ...v, [key]: value } : v));
  async function save() {
    if (!form) return;
    const data = await mechanicApi<{ profile: MechanicProfile }>("/api/mechanics/me", "PUT", {
      ...form, yearsOfExperience: form.yearsOfExperience === "" ? null : Number(form.yearsOfExperience), coverageAreas: splitAreas(form.coverageAreas),
    });
    apply(data.profile);
  }
  const dirty = editing && !!profile && !!form && JSON.stringify(form) !== JSON.stringify(toForm(profile));
  const guard = useDiscardGuard(dirty);
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [step, editing]);

  if (!profile || !form) {
    return (
      <Page title={t("Your MOTEXA mechanic account", "حسابك كميكانيكي في MOTEXA")} back={false}>
        {error ? (
          <View style={{ gap: 10 }}>
            <ErrorState text={error} onRetry={() => void run(refresh)} retryLabel={t("Retry", "إعادة المحاولة")} />
            <GButton variant="ghost" label={t("Go to sign in", "الذهاب لتسجيل الدخول")} onPress={() => router.replace("/auth/login")} />
          </View>
        ) : <SkeletonRows count={5} />}
      </Page>
    );
  }

  const status = mechanicAppStatus(profile.verificationStatus, t);
  const notes = (<>
    {error ? <Note tone="danger" icon="alert-circle-outline">{error}</Note> : null}
    {message ? <Note tone="success" icon="checkmark-circle-outline">{message}</Note> : null}
  </>);
  const toCustomer = () => router.replace("/customer/profile" as Href);

  // ---------------- the application: a step flow ----------------
  if (editing) {
    const STEPS = [t("Professional profile", "الملف المهني"), t("Service options", "طرق تقديم الخدمة"), t("Your documents", "وثائق التحقق"), t("Review and submit", "المراجعة والإرسال")];
    const closeDraft = () => void run(async () => { await save(); setEditing(false); setMessage(t("Your progress is saved.", "تم حفظ تقدّمك.")); });
    const actions: ItemAction[] = [
      { key: "draft", label: t("Save draft and close", "حفظ المسودة وإغلاق"), icon: "save-outline", run: closeDraft },
      ...(customer ? [{ key: "customer", label: t("Back to my customer account", "العودة إلى حسابي كزبون"), icon: "person-outline" as const, run: toCustomer }] : []),
    ];
    const submit = () => void run(async () => {
      await save();
      apply((await mechanicApi<{ profile: MechanicProfile }>("/api/mechanics/me/submit", "POST", { acceptPrivacy: privacy })).profile);
      guard.release(); setEditing(false); await refresh();
    });
    return (
      <Page title={t("Mechanic application", "طلب الانضمام كميكانيكي")} line={status.label} back={false} actions={actions} scrollRef={scroll}
        footer={<StepFooter back={step > 0 ? { label: t("Previous step", "الخطوة السابقة"), onPress: () => setStep((v) => v - 1) } : { label: t("Save draft", "حفظ المسودة"), onPress: closeDraft }}
          primary={step < 3 ? { label: t("Save and continue", "حفظ ومتابعة"), busy, onPress: () => void run(async () => { await save(); setStep((v) => v + 1); }) }
            : { label: t("Submit for verification", "إرسال طلب الاعتماد"), icon: "send-outline", busy, disabled: !privacy, onPress: submit }} />}>
        <StepperHeader steps={STEPS} index={step} label={(i, n) => t(`Step ${i} of ${n}`, `الخطوة ${i} من ${n}`)} />
        {notes}
        {step === 0 ? <ProfileStep form={form} change={change} /> : step === 1 ? <ServicesStep form={form} change={change} /> : step === 2 ? (
          <View>
            <Note icon="lock-closed-outline">{t("Identity and a training or experience certificate are required for everyone. Workshop services also need proof of ownership or authorized use. Documents are private.", "الهوية وشهادة تدريب أو خبرة مطلوبة للجميع. عند اختيار الورشة يُطلب إثبات ملكيتها أو حق استخدامها. الوثائق خاصة.")}</Note>
            <Block>
              <MechanicDocs documents={profile.documents} includeWorkshopProof={form.offersWorkshop} busy={busy}
                onUpload={(kind) => void run(async () => {
                  const doc = await pickMechanicDocument(kind);
                  if (!doc) return;
                  apply((await mechanicApi<{ profile: MechanicProfile }>("/api/mechanics/me/documents", "POST", doc)).profile);
                  setMessage(t("Document saved privately.", "تم حفظ المستند بشكل خاص."));
                })} />
            </Block>
          </View>
        ) : <ReviewStep profile={profile} form={form} privacy={privacy} setPrivacy={setPrivacy} goTo={setStep} />}
        {guard.sheet}
      </Page>
    );
  }

  // ---------------- home: a dashboard ----------------
  const approved = !!profile.canReceiveServices;
  const editable = ["DRAFT", "NEEDS_COMPLETION"].includes(profile.verificationStatus);
  const COPY: Record<string, [string, string]> = {
    DRAFT: ["Let’s build your profile", "لنبدأ ملفك المهني"], PENDING: ["Application under review", "طلبك قيد المراجعة"], NEEDS_COMPLETION: ["A few details need your attention", "طلبك يحتاج استكمالًا"],
    VERIFIED: ["Your application is approved", "تم اعتماد طلبك"], REJECTED: ["Application not approved", "لم يتم قبول الطلب"], SUSPENDED: ["Services temporarily suspended", "الخدمات معلّقة مؤقتًا"],
  };
  const copy = COPY[profile.verificationStatus] ?? COPY.DRAFT!;
  const title = approved ? t("Welcome back", "أهلًا بعودتك") : t(copy[0], copy[1]);
  const startEditing = () => { setStep(0); setPrivacy(false); setMessage(""); setEditing(true); };
  const action = editable
    ? { kind: "button" as const, icon: "create-outline" as const, label: profile.verificationStatus === "DRAFT" ? t("Continue", "متابعة") : t("Complete changes", "استكمال المطلوب"), onPress: startEditing }
    : approved ? { kind: "button" as const, icon: "construct-outline" as const, label: t("Open requests", "فتح الطلبات"), onPress: () => go("/mechanic/requests") } : undefined;
  const modes = [
    profile.offersWorkshop ? [t("Workshop", "الورشة"), profile.workshopName] : null,
    profile.offersOnSite ? [t("On-site", "ميداني"), profile.coverageAreas.join(t(", ", "، "))] : null,
    profile.offersOnline ? [t("Online consultation", "استشارات أونلاين"), t("Yes", "نعم")] : null,
  ].filter((x): x is [string, string] => !!x);
  return (
    <Page title={title} back={false} onRefresh={() => void run(refresh)} refreshing={false}
      hero={<HeroLayout config={{ tab: "mechanics", title, line: profile.user.fullName, action, top: { label: t("Mechanic", "ميكانيكي"), actions: [] }, media: moHeroMedia("mechanic", t("Mo, the MOTEXA mascot", "مو، تميمة موتيكسا")) }} />}>
      {notes}
      {approved ? (
        <Section title={t("Needs you now", "بحاجة إليك الآن")} style={{ marginTop: 0 }}>
          <View style={{ gap: 10 }}>
            {inbox?.waiting ? <NeedsRow icon="construct-outline" title={t("New requests waiting for your answer", "طلبات جديدة بانتظار ردّك")} count={inbox.waiting} onPress={() => go("/mechanic/requests?filter=new")} /> : null}
            {inbox && !inbox.waiting ? <Note tone="success" icon="checkmark-circle-outline">{t("Nothing is waiting for you.", "لا شيء بانتظارك.")}</Note> : null}
            <Kpis items={[
              { label: t("Waiting for you", "بانتظارك"), value: inbox?.waiting, icon: "time-outline", onPress: () => go("/mechanic/requests?filter=new") },
              { label: t("Active jobs", "أعمال نشطة"), value: inbox?.active, icon: "construct-outline", onPress: () => go("/mechanic/requests?filter=active") },
              { label: t("Completed jobs", "أعمال مكتملة"), value: inbox?.done, icon: "flag-outline", onPress: () => go("/mechanic/requests?filter=past") },
            ]} />
          </View>
        </Section>
      ) : inbox?.total ? (
        <ManageEntry icon="construct-outline" title={t("Service requests", "طلبات الخدمة")} sub={t("New requests reach you only while your account is approved.", "تصلك طلبات جديدة فقط عندما يكون حسابك معتمدًا.")} onPress={() => go("/mechanic/requests")} />
      ) : null}
      <Block title={t("Your application", "طلبك")} action={<StatusChip {...status} />}>
        <View style={{ paddingVertical: 8, gap: 8 }}>
          <GText soft style={[gType.bodySm, align]}>
            {profile.verificationStatus === "VERIFIED" ? t("Your professional application is approved. Your approved service modes are shown below.", "تم اعتماد طلبك المهني. طرق الخدمة المعتمدة تظهر بالأسفل.")
              : profile.verificationStatus === "DRAFT" ? t("Complete your professional information, upload your identity and submit for review. You cannot receive service requests before approval.", "استكمل معلوماتك المهنية وارفع الهوية وأرسل طلبك. لا يمكنك استقبال خدمات قبل الاعتماد.")
              : t("You can view your status and messages here. Receiving services remains unavailable until approval.", "يمكنك متابعة حالتك ورسائلك هنا. استقبال الخدمات يبقى غير متاح حتى الاعتماد.")}
          </GText>
          {profile.reviewNotes ? <Note tone="warning" icon="chatbox-ellipses-outline">{profile.reviewNotes}</Note> : null}
          {profile.verificationStatus === "DRAFT" ? <Checklist profile={profile} /> : null}
          {profile.submittedAt ? <AppTimeline profile={profile} /> : null}
        </View>
      </Block>
      {profile.verificationStatus === "VERIFIED" && modes.length ? <Block title={t("Approved service modes", "طرق الخدمة المعتمدة")}><Facts rows={modes} /></Block> : null}
      {notices.length ? (
        <Block title={t("Notifications", "الإشعارات")}>
          {notices.map((n, i) => (
            <View key={n.id} style={{ paddingVertical: 10, gap: 4, borderTopWidth: i ? 1 : 0, borderTopColor: g.line }}>
              <GText style={[gType.label, align, { fontWeight: "700" }]}>{n.title}</GText>
              <GText soft style={[gType.bodySm, align]}>{n.body}</GText>
              <GText soft style={[gType.tiny, align]}>{fmtDateTime(n.createdAt)}</GText>
              {!n.readAt ? <GButton variant="ghost" icon="checkmark-done-outline" label={t("Mark as read", "تعليم كمقروء")} disabled={busy}
                onPress={() => void run(async () => { await mechanicApi("/api/mechanics/notifications/" + n.id + "/read", "POST", {}); await refresh(); })} /> : null}
            </View>
          ))}
        </Block>
      ) : null}
      <Block title={t("Your documents", "وثائقك")}><MechanicDocs documents={profile.documents} /></Block>
      {!customer ? <AppearanceSection /> : null}
      {customer ? <GButton variant="secondary" icon="person-outline" label={t("Back to my customer account", "العودة إلى حسابي كزبون")} onPress={toCustomer} /> : <LogOut />}
    </Page>
  );
}

type StepProps = { form: Form; change: <K extends keyof Form>(key: K, value: Form[K]) => void };

function ProfileStep({ form, change }: StepProps) {
  const { t, isArabic } = useL();
  const { row, align } = useGarageTheme();
  return (
    <View>
      <SmartPicker label={t("City", "المدينة")} value={form.city || null} onChange={(v) => change("city", v)}
        options={CITIES.map((c) => ({ id: c.name, label: cityLabel(c.name, isArabic), find: `${c.name} ${cityLabel(c.name, true)}` }))} suggested={form.city ? [form.city] : []} />
      <View style={{ height: 12 }} />
      <Field label={t("Phone number", "رقم الهاتف")} value={form.phoneNumber} onChangeText={(v) => change("phoneNumber", v)} keyboardType="phone-pad" />
      <GText style={[gType.caption, align, { fontWeight: "700", marginBottom: 6 }]}>{t("Specializations · Choose one or more", "التخصصات · اختر واحدًا أو أكثر")}</GText>
      <View style={[row, { flexWrap: "wrap", gap: 8, marginBottom: 14 }]}>
        {mechanicSpecializations.map(([key, en, ar]) => {
          const on = form.specializations.includes(key);
          return <Chip key={key} icon={SKILL_ICON[key]} label={t(en, ar)} on={on} onPress={() => change("specializations", on ? form.specializations.filter((s) => s !== key) : [...form.specializations, key])} />;
        })}
      </View>
      <Field label={t("Years of experience", "سنوات الخبرة")} value={form.yearsOfExperience} onChangeText={(v) => change("yearsOfExperience", normalizeNumberText(v).replace(/\D/g, ""))} keyboardType="number-pad" maxLength={2} />
      <Field label={t("Tell us about your experience", "نبذة عن خبرتك")} value={form.experienceSummary} onChangeText={(v) => change("experienceSummary", v)} multiline maxLength={2000} />
    </View>
  );
}

function ServicesStep({ form, change }: StepProps) {
  const { t } = useL();
  const { row } = useGarageTheme();
  const areas = splitAreas(form.coverageAreas);
  return (
    <View style={{ gap: 14 }}>
      <Block title={t("Where will you help customers?", "كيف ستقدم خدماتك للعملاء؟")}>
        <View style={{ paddingVertical: 6 }}>
          <GText soft style={gType.caption}>{t("Choose one or more service modes. Only the relevant details will appear.", "اختر طريقة أو أكثر، وستظهر لك البيانات المطلوبة لكل اختيار.")}</GText>
          <Toggle label={t("Workshop service", "الخدمة داخل الورشة")} sub={t("Customers visit your workshop", "يأتي العميل لورشتك")} value={form.offersWorkshop} onChange={(v) => change("offersWorkshop", v)} />
          <Toggle label={t("On-site service", "الخدمة عند العميل")} sub={t("Travel to your customer", "تصل إلى موقع العميل")} value={form.offersOnSite} onChange={(v) => change("offersOnSite", v)} />
          <Toggle label={t("Online consultation", "استشارة أونلاين")} sub={t("Consultations via your WhatsApp number", "استشارة عبر رقمك على واتساب")} value={form.offersOnline} onChange={(v) => change("offersOnline", v)} />
        </View>
      </Block>
      {form.offersWorkshop ? (
        <View>
          <Note icon="storefront-outline">{t("You will provide ownership, a rental agreement or authorization to use the workshop in Documents.", "سترفق في خطوة الوثائق سند ملكية أو عقد إيجار أو إثبات حق استخدام الورشة.")}</Note>
          <Field label={t("Workshop name", "اسم الورشة")} value={form.workshopName} onChangeText={(v) => change("workshopName", v)} />
          <Field label={t("Workshop location / address", "موقع وعنوان الورشة")} value={form.workshopAddress} onChangeText={(v) => change("workshopAddress", v)} multiline />
        </View>
      ) : null}
      {form.offersOnSite ? (
        <View>
          <Field label={t("Coverage cities · Separate with commas", "مدن التغطية · افصل بينها بفاصلة")} value={form.coverageAreas} onChangeText={(v) => change("coverageAreas", v)} />
          {areas.length ? <View style={[row, { flexWrap: "wrap", gap: 6 }]}>{areas.map((v, i) => <Badge key={`${v}-${i}`} tone="neutral" label={v} />)}</View> : null}
        </View>
      ) : null}
      {form.offersOnline ? (
        <Block title={t("WhatsApp consultation", "استشارة عبر واتساب")}>
          <View style={{ paddingTop: 10 }}>
            <Field label={t("WhatsApp contact number", "رقم التواصل على واتساب")} value={form.phoneNumber} onChangeText={(v) => change("phoneNumber", v)} keyboardType="phone-pad" placeholder="+970 59 123 4567" />
            <GText soft style={[gType.caption, { marginBottom: 10 }]}>{t("Use the number registered on your WhatsApp account. This is your application contact number; the customer starts a call from WhatsApp itself.", "استخدم الرقم المسجّل في حساب واتساب. هذا رقم التواصل في طلبك، وتبدأ المكالمة من تطبيق واتساب نفسه.")}</GText>
          </View>
        </Block>
      ) : null}
    </View>
  );
}

function ReviewStep({ profile, form, privacy, setPrivacy, goTo }: { profile: MechanicProfile; form: Form; privacy: boolean; setPrivacy: (v: boolean) => void; goTo: (step: number) => void }) {
  const { t, isArabic } = useL();
  const { g, row, align } = useGarageTheme();
  const spec = (v: string) => { const s = mechanicSpecializations.find((x) => x[0] === v); return s ? t(s[1], s[2]) : v; };
  const has = (kind: string) => profile.documents.some((d) => d.kind === kind);
  const up = (ok: boolean) => (ok ? t("Uploaded", "مرفوعة") : t("Not uploaded yet", "لم تُرفع بعد"));
  const sections = [
    { key: "personal", title: t("Personal details", "المعلومات الشخصية"), target: 0, lines: [profile.user.fullName, profile.user.email, cityLabel(form.city, isArabic), form.phoneNumber] },
    { key: "expertise", title: t("Specializations & experience", "التخصصات والخبرة"), target: 0, lines: [form.specializations.map(spec).join(t(", ", "، ")), form.yearsOfExperience ? `${form.yearsOfExperience} ${t("years of experience", "سنوات خبرة")}` : "", form.experienceSummary] },
    { key: "services", title: t("Service options", "طرق تقديم الخدمة"), target: 1, lines: [
      [form.offersWorkshop ? t("Workshop", "ورشة") : "", form.offersOnSite ? t("On-site", "ميداني") : "", form.offersOnline ? t("Online consultation", "أونلاين") : ""].filter(Boolean).join(" · "),
      form.offersWorkshop ? form.workshopName : "", form.offersWorkshop ? form.workshopAddress : "", form.offersOnSite ? form.coverageAreas : "", form.offersOnline ? t("WhatsApp: ", "واتساب: ") + form.phoneNumber : ""] },
    { key: "documents", title: t("Required documents", "الوثائق المطلوبة"), target: 2, lines: [t("Identity: ", "الهوية: ") + up(has("IDENTITY")), t("Certificate: ", "الشهادة: ") + up(has("CERTIFICATE")),
      form.offersWorkshop ? t("Workshop proof: ", "إثبات الورشة: ") + up(has("WORKSHOP_PROOF")) : ""] },
  ];
  return (
    <View style={{ gap: 14 }}>
      {sections.map((s) => {
        const lines = s.lines.filter(Boolean);
        return (
          <Block key={s.key} title={s.title} action={
            <Pressable accessibilityRole="button" accessibilityLabel={`${t("Edit", "تعديل")} ${s.title}`} onPress={() => goTo(s.target)} hitSlop={4} style={{ minHeight: 44, minWidth: 44, justifyContent: "center", paddingHorizontal: 6 }}>
              <GText style={[gType.caption, { color: g.accentText, fontWeight: "800" }]}>{t("Edit", "تعديل")}</GText>
            </Pressable>}>
            <View style={{ paddingVertical: 8, gap: 4 }}>
              {(lines.length ? lines : [t("Not entered yet", "لم تُدخل البيانات بعد")]).map((line, i) => <GText key={i} soft style={[gType.bodySm, align]}>{line}</GText>)}
            </View>
          </Block>
        );
      })}
      <ProviderAccountNote kind="MECHANIC" />
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: privacy }} onPress={() => setPrivacy(!privacy)} style={[row, { alignItems: "center", gap: 12, minHeight: 56 }]}>
        <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: privacy ? g.accent : g.soft, backgroundColor: privacy ? g.accent : "transparent", alignItems: "center", justifyContent: "center" }}>
          {privacy ? <GIcon name="checkmark" size={16} color={g.onAccent} /> : null}
        </View>
        <GText style={[gType.bodySm, align, { flex: 1 }]}>{t("I confirm my information is accurate and consent to private document review by authorized MOTEXA administrators.", "أؤكد صحة بياناتي وأوافق على مراجعة وثائقي بشكل خاص من أدمن MOTEXA المخوّل.")}</GText>
      </Pressable>
    </View>
  );
}

/** What a draft still needs: the four parts of the application, done ones ticked (calm, not errors). */
function Checklist({ profile }: { profile: MechanicProfile }) {
  const { t } = useL();
  const step = (ok: boolean, en: string, ar: string, hintEn: string, hintAr: string) => ({ label: t(en, ar), at: t(hintEn, hintAr), state: ok ? ("done" as const) : ("todo" as const) });
  return (
    <Timeline steps={[
      step(!!profile.specializations.length && profile.yearsOfExperience !== null, "Professional details", "المعلومات المهنية", "Your skills and experience", "تخصصاتك وخبرتك"),
      step(profile.offersWorkshop || profile.offersOnSite || profile.offersOnline, "Service options", "طرق تقديم الخدمة", "Choose how you serve customers", "اختر كيف تقدم خدماتك"),
      step(profile.documents.some((d) => d.kind === "IDENTITY"), "Identity & documents", "الهوية والوثائق", "Private professional verification", "وثائق التحقق الخاصة"),
      step(!!profile.submittedAt, "Review & submit", "المراجعة والإرسال", "Send to your Mechanics Admin", "أرسل طلبك لأدمن الميكانيكي"),
    ]} />
  );
}

function AppTimeline({ profile }: { profile: MechanicProfile }) {
  const { t } = useL();
  const decided = ["VERIFIED", "REJECTED", "NEEDS_COMPLETION", "SUSPENDED"].includes(profile.verificationStatus);
  return (
    <Timeline steps={[
      { label: t("Application received", "تم استلام الطلب"), at: fmtDateTime(profile.submittedAt), state: profile.submittedAt ? "done" : "todo" },
      { label: t("Administrator review", "مراجعة الأدمن"), at: t("Your file is submitted for professional review.", "ملفك مرسل للمراجعة المهنية."), state: decided ? "done" : profile.verificationStatus === "PENDING" ? "current" : "todo" },
      { label: t("Professional interview", "المقابلة المهنية"), state: profile.interviewResult ? "done" : "todo",
        at: profile.interviewResult === "PASSED" ? t("Interview passed", "تم اجتياز المقابلة") : profile.interviewResult === "FAILED" ? t("Interview result recorded", "تم تسجيل نتيجة المقابلة") : t("Waiting for the administrator", "بانتظار الأدمن") },
      { label: t("Review decision", "قرار المراجعة"), state: decided ? "done" : "todo",
        at: decided ? t("A decision is recorded on your application.", "تم تسجيل قرار على طلبك.") : t("You will be notified in the app.", "سيصلك إشعار داخل التطبيق.") },
    ]} />
  );
}
