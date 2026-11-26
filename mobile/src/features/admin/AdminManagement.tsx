// Super admin › Administrators = List (docs/guide/10-ui-system.md): department as segmented tabs, ONE status chip row with counts,
// search, compact rows with ⋮ (suspend / reactivate / revoke: adminAccountActions), the account in a sheet (phone) or side panel
// (wide). "Invite administrator" is an entry row that opens the invite Form in a sheet (Send invitation = its one primary);
// `?invite=1` opens it directly, `?filter=invited` starts on the invitations. Same endpoints as before (/admin-invitations).
import * as Clipboard from "expo-clipboard";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Field, GButton, GIcon, GText, Note, Sheet, type GIconName, type Tone } from "../../components/garage";
import { showToast } from "../../components/ItemActionsMenu";
import { FilterChips, ManageEntry, ManagePage, ManageRow } from "../../components/manage/ManagePage";
import { Facts } from "../../components/manage/Page";
import { api } from "../../core/config/api";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { gShape, gType, useGarageTheme } from "../../theme/garage";
import { adminAccountActions } from "../department/adminAccountActions";

type Dept = "MANAGE_MECHANICS" | "MANAGE_SPARE_PARTS" | "MANAGE_TOWING";
type Status = "active" | "invited" | "suspended";
type Account = { id: string; name: string; email: string; dept: Dept; status: Status };
type ApiAdmin = { id: string; fullName: string; email: string; status: "ACTIVE" | "SUSPENDED"; adminPermissions: { permission: string }[] };
type ApiInvitation = { id: string; fullName: string; email: string; permission: string; status: "PENDING"; expiresAt: string };
const asDept = (p: string): Dept => (p === "MANAGE_MECHANICS" || p === "MANAGE_SPARE_PARTS" ? p : "MANAGE_TOWING");
const DEPTS: { key: Dept; icon: GIconName; en: string; ar: string; descEn: string; descAr: string; permEn: string; permAr: string }[] = [
  { key: "MANAGE_MECHANICS", icon: "construct-outline", en: "Mechanics", ar: "الميكانيكيون", descEn: "Manage mechanics and verification requests", descAr: "إدارة الميكانيكيين وطلبات اعتمادهم", permEn: "Manage mechanics", permAr: "إدارة الميكانيكيين" },
  { key: "MANAGE_SPARE_PARTS", icon: "cube-outline", en: "Spare parts", ar: "قطع الغيار", descEn: "Manage spare parts provider accounts", descAr: "إدارة حسابات مزودي قطع الغيار", permEn: "Manage spare parts", permAr: "إدارة قطع الغيار" },
  { key: "MANAGE_TOWING", icon: "car-outline", en: "Towing", ar: "السحب", descEn: "Manage towing provider accounts", descAr: "إدارة حسابات مزودي خدمات السحب", permEn: "Manage towing", permAr: "إدارة خدمات السحب" },
];
const isStatus = (v?: string): v is Status | "all" => v === "all" || v === "active" || v === "invited" || v === "suspended";

async function loadAccounts(): Promise<Account[]> {
  const data = await api<{ admins: ApiAdmin[]; invitations: ApiInvitation[] }>("GET", "/admin-invitations");
  return [
    ...data.invitations.map((i) => ({ id: i.id, name: i.fullName, email: i.email, dept: asDept(i.permission), status: "invited" as const })),
    ...data.admins.map((a) => ({ id: a.id, name: a.fullName, email: a.email, dept: asDept(a.adminPermissions[0]?.permission ?? ""), status: a.status === "ACTIVE" ? ("active" as const) : ("suspended" as const) })),
  ];
}

export function AdminManagement() {
  const { t } = useL();
  const params = useLocalSearchParams<{ invite?: string; filter?: string }>();
  const state = useLoad(loadAccounts, []);
  const [dept, setDept] = useState<Dept | "ALL">("ALL"), [status, setStatus] = useState<Status | "all">(isStatus(params.filter) ? params.filter : "all"), [q, setQ] = useState("");
  const [open, setOpen] = useState<Account | null>(null), [inviting, setInviting] = useState(params.invite === "1"), [link, setLink] = useState<string | null>(null);
  useEffect(() => { if (params.invite === "1") setInviting(true); if (isStatus(params.filter)) setStatus(params.filter); }, [params.invite, params.filter]);
  const statusLabel = (s: Status) => ({ active: t("Active", "نشط"), invited: t("Invited", "بانتظار التفعيل"), suspended: t("Suspended", "معلّق") })[s];
  const tone: Record<Status, Tone> = { active: "success", invited: "accent", suspended: "warning" };
  const deptLabel = (d: Dept) => { const x = DEPTS.find((y) => y.key === d)!; return t(x.en, x.ar); };
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const all = state.data ?? [];
  const inDept = all.filter((a) => (dept === "ALL" || a.dept === dept) && words.every((w) => `${a.name} ${a.email}`.toLowerCase().includes(w)));
  const order: Record<Status, number> = { invited: 0, suspended: 1, active: 2 };
  const rows = inDept.filter((a) => status === "all" || a.status === status).sort((a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name));
  const admins = all.filter((a) => a.status !== "invited").length, invites = all.filter((a) => a.status === "invited").length;
  const reload = () => state.reload();
  const actionsOf = (a: Account) => adminAccountActions(t, a, { open: () => setOpen(a), reload });
  return (
    <>
      <ManagePage title={t("Administrators", "المسؤولون")}
        line={state.data ? t(`${admins} admins · ${invites} pending invitations`, `${admins} مسؤولين · ${invites} دعوات معلّقة`) : undefined}
        tabs={{ value: dept, onChange: (k) => setDept(k as Dept | "ALL"), options: [{ key: "ALL", label: t("All", "الكل") }, ...DEPTS.map((d) => ({ key: d.key, label: t(d.en, d.ar), count: state.data ? all.filter((a) => a.dept === d.key && a.status !== "invited").length : undefined }))] }}
        search={{ value: q, onChange: setQ, placeholder: t("Name or email", "الاسم أو البريد") }}
        filters={<FilterChips value={status} onChange={setStatus} filters={[
          { key: "all", label: t("All", "الكل"), count: state.data ? inDept.length : undefined },
          ...(["active", "invited", "suspended"] as const).map((s) => ({ key: s, label: statusLabel(s), count: state.data ? inDept.filter((a) => a.status === s).length : undefined })),
        ]} />}
        above={<ManageEntry icon="person-add-outline" title={t("Invite administrator", "دعوة أدمن جديد")} sub={t("The invitation is sent by email and is valid for 24 hours.", "تُرسل الدعوة إلى البريد الإلكتروني، وصلاحيتها 24 ساعة.")} onPress={() => setInviting(true)} />}
        items={rows} keyOf={(a) => `${a.status === "invited" ? "invite" : "admin"}-${a.id}`}
        renderItem={(a) => <ManageRow title={a.name} sub={`${deptLabel(a.dept)} · ⁦${a.email}⁩`} status={{ label: statusLabel(a.status), tone: tone[a.status] }}
          active={open?.id === a.id} onPress={() => setOpen(a)} actions={actionsOf(a)} />}
        loading={!state.data && !state.error} error={state.error} onRetry={() => void reload()}
        empty={{ text: q || status !== "all" || dept !== "ALL" ? t("No accounts match this department and status.", "لا توجد حسابات تطابق هذا القسم والحالة.") : t("No administrators yet.", "لا يوجد مسؤولون بعد."), action: { label: t("Invite administrator", "دعوة أدمن جديد"), onPress: () => setInviting(true) } }}
        onRefresh={() => void reload()} refreshing={false} detailHint={t("Tap an account to see it here.", "اضغط على حساب لعرضه هنا.")}
        detail={open ? {
          title: open.name, onClose: () => setOpen(null),
          content: (
            <View style={{ gap: 12 }}>
              <Facts rows={[[t("Full name", "الاسم الكامل"), open.name], [t("Email address", "البريد الإلكتروني"), `⁦${open.email}⁩`], [t("Department", "القسم"), deptLabel(open.dept)],
                [t("Permission", "الصلاحية"), (() => { const d = DEPTS.find((x) => x.key === open.dept)!; return t(d.permEn, d.permAr); })()], [t("Status", "الحالة"), statusLabel(open.status)]]} />
              <Note icon="information-circle-outline">{open.status === "invited" ? t("Use ⋮ to revoke this invitation; the link then stops working.", "استخدم ⋮ لإلغاء هذه الدعوة؛ يتوقف الرابط بعدها.") : t("Suspended accounts can be reactivated. Account records are retained. Use ⋮ to change the status.", "يمكن إعادة تفعيل الحساب المعلّق، ولا تُحذف بياناته. استخدم ⋮ لتغيير الحالة.")}</Note>
            </View>
          ),
        } : null} />
      <InviteSheet visible={inviting} initialDept={dept === "ALL" ? "MANAGE_MECHANICS" : dept} onClose={() => setInviting(false)}
        onDone={(activation) => { setInviting(false); void reload(); if (activation) setLink(activation); else showToast(t("Invitation sent by email.", "تم إرسال الدعوة إلى البريد الإلكتروني.")); }} />
      <ActivationSheet link={link} onClose={() => setLink(null)} />
    </>
  );
}

/** The invite Form: name, email, department (one of three); errors under the field; Send invitation = the one primary. */
function InviteSheet({ visible, initialDept, onClose, onDone }: { visible: boolean; initialDept: Dept; onClose: () => void; onDone: (activationLink: string | null) => void }) {
  const { t } = useL();
  const { g, row, align } = useGarageTheme();
  const [name, setName] = useState(""), [email, setEmail] = useState(""), [dept, setDept] = useState<Dept>(initialDept);
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({}), [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (visible) { setName(""); setEmail(""); setDept(initialDept); setErrors({}); setErr(null); } }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  const send = async () => {
    const cleanName = name.trim(), cleanEmail = email.trim().toLowerCase();
    const e = { name: cleanName ? undefined : t("Enter the full name.", "أدخل الاسم الكامل."), email: !cleanEmail ? t("Enter the email address.", "أدخل البريد الإلكتروني.") : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) ? t("Enter a valid email address.", "أدخل بريدًا إلكترونيًا صحيحًا.") : undefined };
    setErrors(e);
    if (e.name || e.email) return;
    setBusy(true); setErr(null);
    try {
      const r = await api<{ activationLink?: string }>("POST", "/admin-invitations", { fullName: cleanName, email: cleanEmail, permission: dept });
      onDone(typeof r.activationLink === "string" && r.activationLink ? r.activationLink : null);
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  return (
    <Sheet visible={visible} onClose={() => !busy && onClose()} tall title={t("Invite administrator", "دعوة أدمن جديد")} closeLabel={t("Close", "إغلاق")}
      footer={<GButton icon="paper-plane-outline" label={busy ? t("Sending invitation…", "جارٍ إرسال الدعوة…") : t("Send invitation", "إرسال الدعوة")} busy={busy} disabled={busy} onPress={() => void send()} />}>
      <View>
        <Field label={t("Full name", "الاسم الكامل")} value={name} onChangeText={setName} placeholder={t("Enter full name", "أدخل الاسم الكامل")} error={errors.name} />
        <Field label={t("Email address", "البريد الإلكتروني")} value={email} onChangeText={setEmail} placeholder={t("Enter email address", "أدخل البريد الإلكتروني")} keyboardType="email-address" autoCapitalize="none" error={errors.email} />
        <GText style={[gType.caption, align, { fontWeight: "700", marginBottom: 6 }]}>{t("Department permission", "صلاحية القسم")}</GText>
        <View accessibilityRole="radiogroup" style={{ gap: 8, marginBottom: 12 }}>
          {DEPTS.map((d) => {
            const on = d.key === dept;
            return (
              <Pressable key={d.key} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={t(d.en, d.ar)} onPress={() => setDept(d.key)}
                style={({ pressed }) => [row, { minHeight: 60, alignItems: "center", gap: 12, paddingHorizontal: 12, borderRadius: gShape.small, borderWidth: 1, borderColor: on ? g.accent : g.line, backgroundColor: on ? g.tint : pressed ? g.cardSoft : g.card }]}>
                <GIcon name={on ? "radio-button-on" : "radio-button-off"} size={20} />
                <GIcon name={d.icon} size={20} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <GText style={[gType.label, align, { fontWeight: "700" }]}>{t(d.en, d.ar)}</GText>
                  <GText soft style={[gType.caption, align]}>{t(d.descEn, d.descAr)}</GText>
                </View>
              </Pressable>
            );
          })}
        </View>
        <Note icon="information-circle-outline">{t("The invitation is sent by email and is valid for 24 hours. The recipient verifies the email and chooses a password.", "تُرسل الدعوة إلى البريد الإلكتروني وصلاحيتها 24 ساعة. يتحقق المستلم من بريده وينشئ كلمة المرور.")}</Note>
        {err ? <Note tone="danger" icon="alert-circle-outline">{err}</Note> : null}
      </View>
    </Sheet>
  );
}

/** Dev only (no mail provider): the server returns the activation link; copy it or open the activation page. */
function ActivationSheet({ link, onClose }: { link: string | null; onClose: () => void }) {
  const { t } = useL();
  const { align } = useGarageTheme();
  const token = (() => { try { return link ? new URL(link).searchParams.get("token") : null; } catch { return null; } })();
  return (
    <Sheet visible={link !== null} onClose={onClose} title={t("Administrator activation link", "رابط تفعيل المسؤول")} closeLabel={t("Close", "إغلاق")}>
      <View style={{ gap: 12 }}>
        <GText selectable style={[gType.bodySm, align, { writingDirection: "ltr" }]}>{link}</GText>
        <GButton variant="secondary" icon="copy-outline" label={t("Copy link", "نسخ الرابط")} onPress={() => { if (link) void Clipboard.setStringAsync(link).then(() => showToast(t("Activation link copied.", "تم نسخ رابط التفعيل."))); }} />
        <GButton icon="open-outline" label={t("Open activation", "فتح صفحة التفعيل")} disabled={!token}
          onPress={() => { if (!token) return; onClose(); router.push({ pathname: "/auth/admin-activation", params: { token } }); }} />
        {!token ? <Note tone="danger" icon="alert-circle-outline">{t("Activation token is missing.", "رمز التفعيل غير موجود.")}</Note> : null}
      </View>
    </Sheet>
  );
}
