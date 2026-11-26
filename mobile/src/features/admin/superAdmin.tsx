// Super admin on the one UI system (docs/guide/10-ui-system.md): Home = Dashboard, Providers = List, Requests = List (what waits in
// each department), More = entry rows, Profile = account facts.
// Every number is real (GET /admin-management/dashboard, the department stats); a source that fails shows "—", nothing is estimated.
import { Href, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { GIcon, GText, HeroLayout, Note, Section, Sheet, StatusChip, type GIconName, type Tone } from "../../components/garage";
import { moHeroMedia } from "../../components/garage/MoHero";
import { FilterChips, ManageEntry, ManagePage, ManageRow } from "../../components/manage/ManagePage";
import { Block, Facts, Kpis, Loaded, LogOut, NeedsRow, Page } from "../../components/manage/Page";
import { api } from "../../core/config/api";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { gType, useGarageTheme } from "../../theme/garage";
import { adminAccessoryApi } from "../accessory3d/api";
import { rememberDepartment } from "../department/DepartmentContext";
import type { DeptKey } from "../department/departments";
import { NEEDS_ACTION } from "../department/partsAdmin";
import { AppearanceSection } from "../providerhub/AppearanceSection";

type T = (en: string, ar: string) => string;
const go = (path: string) => router.push(path as Href);
type Dashboard = { administrators: number; mechanics: number; pendingMechanics: number; activeMechanicRequests?: number; pendingInvitations: number; towCompanies?: { pending: number; approved: number }; partsShops?: { pending: number; approved: number } };
const useDashboard = () => useLoad(() => api<{ stats: Dashboard }>("GET", "/admin-management/dashboard").then((r) => r.stats), [], 30000);

// ---------------- what waits in each department (Requests tab + Home) ----------------
type Counts = { tow?: Record<string, number>; dash?: Dashboard; threeD?: number };
async function loadCounts(): Promise<Counts> {
  const [tow, dash, acc] = await Promise.allSettled([
    api<{ stats: Record<string, number> }>("GET", "/admin/tow/stats").then((r) => r.stats),
    api<{ stats: Dashboard }>("GET", "/admin-management/dashboard").then((r) => r.stats),
    adminAccessoryApi.list().then((l) => l.filter((a) => NEEDS_ACTION.includes(a.status)).length),
  ]);
  const ok = <V,>(r: PromiseSettledResult<V>) => (r.status === "fulfilled" ? r.value : undefined);
  return { tow: ok(tow), dash: ok(dash), threeD: ok(acc) };
}
type Item = { key: string; dept: DeptKey; path: string; icon: GIconName; en: string; ar: string; deptEn: string; deptAr: string; count: (c: Counts) => number | undefined };
const ITEMS: Item[] = [
  { key: "tow-companies", dept: "MANAGE_TOWING", path: "/dept/requests", icon: "business-outline", en: "Tow company applications", ar: "طلبات شركات السحب", deptEn: "Towing", deptAr: "السحب", count: (c) => c.tow?.pendingCompanies },
  { key: "tow-trucks", dept: "MANAGE_TOWING", path: "/dept/directory", icon: "car-outline", en: "Trucks to review", ar: "شاحنات بانتظار المراجعة", deptEn: "Towing", deptAr: "السحب", count: (c) => c.tow?.pendingTrucks },
  { key: "drivers", dept: "MANAGE_TOWING", path: "/dept/tows/drivers", icon: "id-card-outline", en: "Driver licences", ar: "رخص السائقين", deptEn: "Towing", deptAr: "السحب", count: (c) => c.tow?.pendingDrivers },
  { key: "shops", dept: "MANAGE_SPARE_PARTS", path: "/dept/requests", icon: "storefront-outline", en: "Parts shop applications", ar: "طلبات متاجر القطع", deptEn: "Spare parts", deptAr: "قطع الغيار", count: (c) => c.dash?.partsShops?.pending },
  { key: "3d", dept: "MANAGE_SPARE_PARTS", path: "/dept/requests?seg=3d", icon: "cube-outline", en: "3D requests", ar: "طلبات ثلاثية الأبعاد", deptEn: "Spare parts", deptAr: "قطع الغيار", count: (c) => c.threeD },
  { key: "mechanics", dept: "MANAGE_MECHANICS", path: "/dept/requests?seg=apps", icon: "construct-outline", en: "Mechanic applications", ar: "طلبات الميكانيكيين", deptEn: "Mechanics", deptAr: "الميكانيك", count: (c) => c.dash?.pendingMechanics },
];
const openItem = (i: Item) => { rememberDepartment(i.dept); go(i.path); };
const waitingTotal = (c: Counts) => { const known = ITEMS.map((i) => i.count(c)).filter((n): n is number => n !== undefined); return known.length ? known.reduce((a, b) => a + b, 0) : undefined; };

// ---------------- Home ----------------
export function SuperAdminHome() {
  const { t } = useL();
  const dash = useDashboard();
  const counts = useLoad(loadCounts, [], 30000);
  const d = dash.data;
  const waiting = counts.data ? waitingTotal(counts.data) : undefined;
  const title = t("Super admin", "المشرف العام");
  return (
    <Page title={title} back={false} tabBar onRefresh={() => { void dash.reload(); void counts.reload(); }} refreshing={false}
      hero={<HeroLayout config={{ tab: "home", title, line: d ? t(`${d.administrators} administrators · ${d.pendingInvitations} pending invitations`, `${d.administrators} مسؤولين · ${d.pendingInvitations} دعوات معلّقة`) : undefined,
        top: { label: "MOTEXA", actions: [] }, media: moHeroMedia("admin", t("Mo, the MOTEXA mascot", "مو، تميمة موتيكسا")),
        action: { kind: "button", icon: "person-add-outline", label: t("Invite administrator", "دعوة أدمن"), onPress: () => go("/admin/admin-management?invite=1") } }} />}>
      <Section title={t("Needs you now", "بحاجة إليك الآن")} style={{ marginTop: 0 }}>
        <View style={{ gap: 8 }}>
          {waiting ? <NeedsRow icon="clipboard-outline" title={t("Waiting for review", "بانتظار المراجعة")} sub={t("Across the three departments", "في الأقسام الثلاثة")} count={waiting} onPress={() => go("/admin/requests")} /> : null}
          {d?.pendingInvitations ? <NeedsRow icon="mail-unread-outline" title={t("Invitations not activated yet", "دعوات لم تُفعَّل بعد")} count={d.pendingInvitations} onPress={() => go("/admin/admin-management?filter=invited")} /> : null}
          {counts.data && d && !waiting && !d.pendingInvitations ? <Note tone="success" icon="checkmark-circle-outline">{t("Nothing is waiting for you.", "لا شيء بانتظارك.")}</Note> : null}
          {dash.error && !d ? <Note tone="danger" icon="alert-circle-outline">{t("Statistics could not load. Pull down to try again.", "تعذّر تحميل الإحصاءات. اسحب للأسفل للمحاولة مجددًا.")}</Note> : null}
        </View>
      </Section>
      <Kpis items={[
        { label: t("Administrators", "المسؤولون"), value: d?.administrators, icon: "shield-outline", onPress: () => go("/admin/admin-management") },
        { label: t("Pending invitations", "دعوات معلّقة"), value: d?.pendingInvitations, icon: "mail-outline", onPress: () => go("/admin/admin-management?filter=invited") },
        { label: t("Mechanics", "الميكانيكيون"), value: d?.mechanics, icon: "construct-outline", onPress: () => go("/admin/providers?category=MECHANIC") },
        { label: t("Active mechanic requests", "طلبات ميكانيكي نشطة"), value: d ? (d.activeMechanicRequests ?? 0) : null, icon: "build-outline" },
        { label: t("Approved parts shops", "متاجر قطع معتمدة"), value: d?.partsShops?.approved, icon: "storefront-outline", onPress: () => go("/admin/shops") },
        { label: t("Approved tow companies", "شركات سحب معتمدة"), value: d?.towCompanies?.approved, icon: "car-outline", onPress: () => go("/admin/tow") },
      ]} />
      <Section title={t("Shortcuts", "اختصارات")}>
        <View style={{ gap: 8 }}>
          <ManageEntry icon="people-outline" title={t("Administrators", "المسؤولون")} sub={t("Department accounts and invitations", "حسابات الأقسام والدعوات")} onPress={() => go("/admin/admin-management")} />
          <ManageEntry icon="storefront-outline" title={t("Parts shops", "متاجر القطع")} onPress={() => go("/admin/shops")} />
          <ManageEntry icon="car-outline" title={t("Tow companies", "شركات السحب")} onPress={() => go("/admin/tow")} />
        </View>
      </Section>
    </Page>
  );
}

// ---------------- Providers ----------------
type Provider = { id: string; fullName: string; email: string; role: string; status: string; mechanicProfile: { verificationStatus: string } | null };
const CATEGORIES = [
  { key: "ALL", en: "All", ar: "الكل" }, { key: "MECHANIC", en: "Mechanics", ar: "الميكانيكيون" },
  { key: "PARTS_PROVIDER", en: "Parts", ar: "القطع" }, { key: "TOW_PROVIDER", en: "Towing", ar: "السحب" },
] as const;
type Category = (typeof CATEGORIES)[number]["key"];
const ROLE: Record<string, [string, string]> = { MECHANIC: ["Mechanic", "ميكانيكي"], PARTS_PROVIDER: ["Parts shop", "متجر قطع"], TOW_PROVIDER: ["Tow company", "شركة سحب"] };
const accountStatus = (t: T, s: string): { label: string; tone: Tone } =>
  ({ ACTIVE: { label: t("Active", "مفعّل"), tone: "success" as Tone }, PENDING: { label: t("Pending", "بانتظار المراجعة"), tone: "accent" as Tone }, SUSPENDED: { label: t("Suspended", "معلّق"), tone: "warning" as Tone }, REJECTED: { label: t("Rejected", "مرفوض"), tone: "danger" as Tone } })[s] ?? { label: s, tone: "neutral" };
const VERIFY: Record<string, [string, string]> = { PENDING: ["Pending", "بانتظار المراجعة"], VERIFIED: ["Verified", "معتمد"], NEEDS_COMPLETION: ["Needs completion", "يحتاج استكمال"], REJECTED: ["Rejected", "مرفوض"], SUSPENDED: ["Suspended", "معلّق"], DRAFT: ["Draft", "مسودة"] };

/** Every provider account (read only): search by name or email, ONE chip row by kind with counts, `?category=` deep link. */
export function ProvidersPage() {
  const { t } = useL();
  const params = useLocalSearchParams<{ category?: string }>();
  const isCat = (v?: string): v is Category => CATEGORIES.some((c) => c.key === v);
  const [cat, setCat] = useState<Category>(isCat(params.category) ? params.category : "ALL"), [q, setQ] = useState("");
  useEffect(() => { if (isCat(params.category)) setCat(params.category); }, [params.category]);
  const state = useLoad(() => api<{ providers: Provider[] }>("GET", "/admin-management/providers").then((r) => r.providers), []);
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const found = (state.data ?? []).filter((p) => words.every((w) => `${p.fullName} ${p.email}`.toLowerCase().includes(w)));
  const rows = found.filter((p) => cat === "ALL" || p.role === cat);
  const active = (state.data ?? []).filter((p) => p.status === "ACTIVE").length;
  return (
    <ManagePage title={t("Providers", "مزودو الخدمة")} back={false} tabBar
      line={state.data ? t(`${state.data.length} providers · ${active} active accounts`, `${state.data.length} مزود خدمة · ${active} حسابات مفعّلة`) : undefined}
      search={{ value: q, onChange: setQ, placeholder: t("Search by name or email", "ابحث بالاسم أو البريد") }}
      filters={<FilterChips value={cat} onChange={setCat} filters={CATEGORIES.map((c) => ({ key: c.key, label: t(c.en, c.ar), count: state.data ? found.filter((p) => c.key === "ALL" || p.role === c.key).length : undefined }))} />}
      items={rows} keyOf={(p) => p.id}
      renderItem={(p) => {
        const role = ROLE[p.role];
        const v = p.mechanicProfile ? VERIFY[p.mechanicProfile.verificationStatus] : null;
        return <ManageRow title={p.fullName} status={accountStatus(t, p.status)}
          sub={[role ? t(role[0], role[1]) : p.role, `⁦${p.email}⁩`, v ? `${t("verification", "الاعتماد")}: ${t(v[0], v[1])}` : null].filter(Boolean).join(" · ")} />;
      }}
      loading={!state.data && !state.error} error={state.error} onRetry={() => void state.reload()}
      empty={{ text: q || cat !== "ALL" ? t("Nothing matches.", "لا توجد نتائج مطابقة.") : t("Accounts will appear here when registered in MOTEXA.", "تظهر الحسابات هنا بعد تسجيلها في MOTEXA."), action: q ? { label: t("Clear search", "مسح البحث"), onPress: () => setQ("") } : undefined }}
      onRefresh={() => void state.reload()} refreshing={false} />
  );
}

// ---------------- Requests: what waits in each department ----------------
export function SuperAdminRequests() {
  const { t } = useL();
  const state = useLoad(loadCounts, [], 30000);
  const c = state.data;
  const total = c ? waitingTotal(c) : undefined;
  return (
    <ManagePage title={t("Requests", "الطلبات")} back={false} tabBar
      line={!c ? undefined : total === undefined ? t("Counts could not load. Pull to refresh.", "تعذّر تحميل الأرقام. اسحب للتحديث.") : total === 0 ? t("Nothing is waiting for review in any department.", "لا شيء بانتظار المراجعة في أي قسم.") : t(`${total} waiting for review across departments`, `${total} بانتظار المراجعة في الأقسام`)}
      items={c ? [...ITEMS].sort((a, b) => (b.count(c) ?? 0) - (a.count(c) ?? 0)) : []} keyOf={(i) => i.key}
      renderItem={(i) => {
        const v = c ? i.count(c) : undefined;
        return <ManageRow title={t(i.en, i.ar)} sub={t(i.deptEn, i.deptAr)} leading={<GIcon name={i.icon} size={20} />}
          status={{ label: v === undefined ? "—" : String(v), tone: v ? "accent" : "neutral" }} onPress={() => openItem(i)} />;
      }}
      loading={!c && !state.error} error={state.error} onRetry={() => void state.reload()}
      empty={{ text: t("Nothing is waiting for review in any department.", "لا شيء بانتظار المراجعة في أي قسم.") }}
      onRefresh={() => void state.reload()} refreshing={false} />
  );
}

// ---------------- More ----------------
export function SuperAdminMore() {
  const { t } = useL();
  const [help, setHelp] = useState(false);
  return (
    <Page title={t("More", "المزيد")} line={t("Your account and workspace", "حسابك ومساحة عملك")} back={false} tabBar>
      <View style={{ gap: 8 }}>
        <ManageEntry icon="person-outline" title={t("My profile", "الملف الشخصي")} sub={t("Your account details and access", "بيانات حسابك وصلاحيات الوصول")} onPress={() => go("/admin/profile")} />
        <ManageEntry icon="people-outline" title={t("Admin management", "إدارة الأدمن")} sub={t("Department accounts and invitations", "حسابات الأقسام ودعوات الأدمن")} onPress={() => go("/admin/admin-management")} />
        <ManageEntry icon="help-circle-outline" title={t("Help & support", "المساعدة والدعم")} sub={t("Quick answers for your workspace", "إجابات سريعة لمساحة الإدارة")} onPress={() => setHelp(true)} />
      </View>
      <AppearanceSection />
      <LogOut />
      <HelpSheet visible={help} onClose={() => setHelp(false)} />
    </Page>
  );
}

function HelpSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useL();
  const { g, row, align } = useGarageTheme();
  const [open, setOpen] = useState<number | null>(0);
  const faq = [
    [t("How do I invite an administrator?", "كيف أدعو أدمن جديدًا؟"), t("Open Admin management, choose Invite administrator, then enter the name, email and department. The recipient completes email verification and chooses a password.", "افتح إدارة الأدمن ثم دعوة أدمن، وأدخل الاسم والبريد والقسم. يكمل المستلم التحقق من بريده وإنشاء كلمة المرور.")],
    [t("How do I recover a password?", "كيف أستعيد كلمة المرور؟"), t("On Sign in, choose Forgot password. Use the registered email to receive a code, verify it, then choose a new password.", "من صفحة تسجيل الدخول اختر نسيت كلمة المرور. استخدم البريد المسجّل لاستلام الرمز، ثم تحقق منه وأنشئ كلمة مرور جديدة.")],
    [t("How do I pause an admin account?", "كيف أعلّق حساب أدمن؟"), t("In Admin management, open the account's ⋮ menu, choose Suspend and confirm. You can reactivate it later.", "في إدارة الأدمن افتح قائمة ⋮ للحساب، واختر تعليق ثم أكّد. يمكنك إعادة تفعيله لاحقًا.")],
  ];
  return (
    <Sheet visible={visible} onClose={onClose} title={t("Help & support", "المساعدة والدعم")} closeLabel={t("Close", "إغلاق")}>
      <View>
        {faq.map(([q, a], i) => (
          <View key={q} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: g.line }}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: open === i }} onPress={() => setOpen(open === i ? null : i)} style={[row, { minHeight: 52, alignItems: "center", gap: 10, paddingVertical: 8 }]}>
              <GText style={[gType.label, align, { flex: 1, fontWeight: "700" }]}>{q}</GText>
              <GIcon name={open === i ? "chevron-up" : "chevron-down"} size={18} color={g.soft} />
            </Pressable>
            {open === i ? <GText soft style={[gType.bodySm, align, { paddingBottom: 12 }]}>{a}</GText> : null}
          </View>
        ))}
      </View>
    </Sheet>
  );
}

// ---------------- Profile ----------------
type Account = { fullName: string; email: string; role: string; status: string; adminPermissions?: ({ permission: string } | string)[] };
const PERMISSION: Record<string, [string, string]> = { MANAGE_MECHANICS: ["Mechanics management", "إدارة الميكانيكيين"], MANAGE_SPARE_PARTS: ["Spare parts management", "إدارة قطع الغيار"], MANAGE_TOWING: ["Towing management", "إدارة السحب"] };
/** The signed-in admin's account (read only: there is no endpoint to edit it), access, and Log out. */
export function AdminProfilePage() {
  const { t } = useL();
  const state = useLoad(() => api<{ user: Account }>("GET", "/auth/me").then((r) => r.user), []);
  const a = state.data;
  return (
    <Page title={t("My profile", "ملفي الشخصي")} line={a?.fullName} onRefresh={() => void state.reload()} refreshing={false}>
      <Loaded state={state}>{(a) => {
        const perms = (a.adminPermissions ?? []).map((x) => (typeof x === "string" ? x : x.permission));
        return (
          <>
            <View style={{ alignSelf: "flex-start" }}><StatusChip {...accountStatus(t, a.status)} /></View>
            <Block title={t("Account information", "معلومات الحساب")}>
              <Facts rows={[[t("Full name", "الاسم الكامل"), a.fullName], [t("Email address", "البريد الإلكتروني"), `⁦${a.email}⁩`], [t("Account role", "دور الحساب"), a.role === "SUPER_ADMIN" ? t("Super admin", "المشرف العام") : t("Administrator", "مسؤول")]]} />
            </Block>
            <Block title={t("Access & permissions", "الوصول والصلاحيات")}>
              {a.role === "SUPER_ADMIN" ? <Facts rows={[[t("Workspace access", "صلاحيات مساحة العمل"), t("Administrator accounts, invitations and platform oversight.", "إدارة حسابات أدمن الأقسام والدعوات والإشراف على المنصة.")]]} />
                : <Facts rows={perms.length ? perms.map((p) => [t("Department", "القسم"), PERMISSION[p] ? t(PERMISSION[p]![0], PERMISSION[p]![1]) : p] as [string, string]) : [[t("Department", "القسم"), t("No department permissions assigned.", "لم تُسند صلاحيات قسم لهذا الحساب.")]]} />}
            </Block>
          </>
        );
      }}</Loaded>
      <LogOut />
    </Page>
  );
}
