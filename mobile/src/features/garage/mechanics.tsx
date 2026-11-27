// Garage owner: his mechanics = List: ONE chip row All · Free · Busy · Offline · In review with counts (`?filter=`), search, rows
// (photo, name, skills / current job, status). A row opens the mechanic (sheet on phones, side panel on wide): facts, his ID under
// review, Edit and Resend invitation. "Add a mechanic" = a three-step sheet (who · skills and ID · photo): a NEW mechanic login that
// stays "In review" until a MOTEXA mechanics admin approves his ID; he gets an email code to set his own password.
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Chip, Field, GButton, Note, type Tone } from "../../components/garage";
import { showToast } from "../../components/ItemActionsMenu";
import { FilterChips, ManageEntry, ManagePage, ManageRow } from "../../components/manage/ManagePage";
import { Block, Facts } from "../../components/manage/Page";
import { normalizeNumberText } from "../../core/constants/numbers";
import { publicImageUrl } from "../../core/constants/files";
import { uploadErrorText } from "../../core/hooks/pickPhoto";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { useGarageTheme } from "../../theme/garage";
import { PhotoField, StepSheet } from "../fleet/steps";
import { useMechanicStatusLabels, useSkillLabel } from "../mechanics/mechanicBits";
import { MECHANIC_SKILLS, REFRESH_MS, garageOwner, type GarageMechanicStatus, type GarageStaff, type StaffApproval } from "../mechanics/mechanicsService";
import { liveLabel } from "../tow/dispatchService";

type Filter = "ALL" | "FREE" | "BUSY" | "OFFLINE" | "REVIEW";
const isFilter = (v?: string): v is Filter => ["ALL", "FREE", "BUSY", "OFFLINE", "REVIEW"].includes(v ?? "");
const filterOf = (m: GarageStaff): Exclude<Filter, "ALL"> => (m.approval !== "APPROVED" ? "REVIEW" : m.status === "UNAPPROVED" ? "REVIEW" : (m.status as "FREE" | "BUSY" | "OFFLINE"));

/** One label + tone for a garage mechanic: his approval first (until approved), then FREE / BUSY / OFFLINE. */
export function useStaffStatus() {
  const { t } = useL();
  const A: Record<StaffApproval, [string, Tone]> = { PENDING: [t("In review", "قيد المراجعة"), "warning"], APPROVED: [t("Approved", "معتمد"), "success"], REJECTED: [t("Rejected", "مرفوض"), "danger"], SUSPENDED: [t("Suspended", "موقوف"), "danger"] };
  const S: Record<GarageMechanicStatus, [string, Tone]> = { FREE: [t("Free", "متاح"), "success"], BUSY: [t("Busy", "مشغول"), "accent"], OFFLINE: [t("Offline", "غير متصل"), "neutral"], UNAPPROVED: [t("Not approved", "غير معتمد"), "warning"] };
  return (m: { approval: StaffApproval; status: GarageMechanicStatus }) => {
    const [label, tone] = m.approval !== "APPROVED" ? A[m.approval] : S[m.status];
    return { label, tone };
  };
}

type Pick = { uri: string; base64: string };
function MechanicWizard({ staff, onClose, onSaved }: { staff?: GarageStaff; onClose: () => void; onSaved: () => void }) {
  const { t } = useL();
  const skillLabel = useSkillLabel();
  const { row } = useGarageTheme();
  const [fullName, setFullName] = useState(""), [email, setEmail] = useState(""), [phone, setPhone] = useState(staff?.phone ?? "");
  const [skills, setSkills] = useState<string[]>(staff?.skills ?? []);
  const [idPhoto, setIdPhoto] = useState<Pick | null>(null), [photo, setPhoto] = useState<Pick | null>(null);
  const validate = (s: number) => {
    if (s === 0) {
      if (!staff && fullName.trim().length < 3) return t("Enter the mechanic's full name.", "أدخل الاسم الكامل للميكانيكي.");
      if (!staff && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return t("Enter a valid email: the mechanic gets his sign-in code there.", "أدخل بريدًا صحيحًا: سيصل إليه رمز الدخول.");
      if (phone.trim().replace(/\D/g, "").length < 6) return t("Enter the mechanic's phone.", "أدخل هاتف الميكانيكي.");
    }
    if (s === 1) {
      if (!skills.length) return t("Choose at least one skill.", "اختر مهارة واحدة على الأقل.");
      if (!staff && !idPhoto) return t("Add a photo of the mechanic's ID.", "أضف صورة هوية الميكانيكي.");
    }
    return null;
  };
  const save = async () => {
    try {
      if (staff) {
        await garageOwner.edit(staff.id, {
          ...(phone.trim() !== staff.phone ? { phone: phone.trim() } : {}),
          ...(skills.join() !== staff.skills.join() ? { skills } : {}),
          ...(idPhoto ? { idPhoto: { dataBase64: idPhoto.base64, name: "id.jpg" } } : {}),
          ...(photo ? { photo: { dataBase64: photo.base64, name: "mechanic.jpg" } } : {}),
        });
      } else {
        await garageOwner.add({ fullName: fullName.trim(), email: email.trim(), phone: phone.trim(), skills, idPhoto: { dataBase64: idPhoto!.base64, name: "id.jpg" }, ...(photo ? { photo: { dataBase64: photo.base64, name: "mechanic.jpg" } } : {}) });
      }
    } catch (e) {
      throw new Error(uploadErrorText(e, t));
    }
    showToast(staff ? t("Mechanic updated.", "تم تحديث الميكانيكي.") : t("Mechanic added: waiting for MOTEXA to approve his ID.", "تمت إضافة الميكانيكي: بانتظار موافقة موتكسا على هويته."), "ok");
    onSaved();
  };
  return (
    <StepSheet
      visible
      title={staff ? t("Edit mechanic", "تعديل الميكانيكي") : t("Add a mechanic", "إضافة ميكانيكي")}
      steps={[t("Who", "من هو"), t("Skills and ID", "المهارات والهوية"), t("Photo", "الصورة")]}
      onClose={onClose}
      validate={validate}
      onSave={save}
      render={(s) =>
        s === 0 ? (
          <View>
            {!staff ? (
              <>
                <Field label={t("Full name", "الاسم الكامل")} value={fullName} onChangeText={setFullName} maxLength={80} />
                <Field label={t("Email (he signs in with it)", "البريد الإلكتروني (يسجّل الدخول به)")} value={email} onChangeText={setEmail} autoCapitalize="none" maxLength={120} />
              </>
            ) : null}
            <Field label={t("Phone (private, never shown to customers)", "الهاتف (خاص، لا يظهر للزبائن)")} value={phone} onChangeText={(v) => setPhone(normalizeNumberText(v))} keyboardType="phone-pad" maxLength={24} />
            {!staff ? <Note icon="mail-outline">{t("We email him a code to set his own password.", "نرسل له رمزًا بالبريد ليعيّن كلمة مروره بنفسه.")}</Note> : null}
          </View>
        ) : s === 1 ? (
          <View>
            <View style={[row, { flexWrap: "wrap", gap: 8, marginBottom: 12 }]}>
              {MECHANIC_SKILLS.map((k) => <Chip key={k} label={skillLabel(k)} on={skills.includes(k)} onPress={() => setSkills(skills.includes(k) ? skills.filter((x) => x !== k) : [...skills, k])} />)}
            </View>
            <PhotoField required={!staff} label={t("ID photo (private)", "صورة الهوية (خاصة)")} value={idPhoto?.uri ?? null} onChange={(uri, base64) => setIdPhoto({ uri, base64 })}
              hint={staff ? t("A new ID sends the mechanic to review again.", "هوية جديدة تعيد الميكانيكي إلى المراجعة.") : t("Only you and MOTEXA's review team see it.", "لا يراها إلا أنت وفريق المراجعة.")} />
          </View>
        ) : (
          <View>
            <PhotoField round label={t("Mechanic photo (optional)", "صورة الميكانيكي (اختيارية)")} value={photo?.uri ?? staff?.photoUri ?? null} onChange={(uri, base64) => setPhoto({ uri, base64 })} hint={t("Customers see it next to his first name.", "يراها الزبائن بجانب اسمه الأول.")} />
          </View>
        )
      }
    />
  );
}

function StaffDetail({ m, onEdit, onChanged }: { m: GarageStaff; onEdit: () => void; onChanged: () => void }) {
  const { t } = useL();
  const { row } = useGarageTheme();
  const skillLabel = useSkillLabel();
  const L = useMechanicStatusLabels();
  const status = useStaffStatus()(m);
  const [busy, setBusy] = useState(false);
  const invite = async () => {
    setBusy(true);
    try { await garageOwner.invite(m.id); showToast(t("Invitation sent again.", "أُعيد إرسال الدعوة."), "ok"); onChanged(); }
    catch (e) { showToast((e as Error).message, "bad"); }
    finally { setBusy(false); }
  };
  return (
    <View style={{ gap: 12 }}>
      {m.approval === "PENDING" ? <Note tone="warning" icon="time-outline">{m.approvalReason ? `${t("MOTEXA asked for a change", "طلبت موتكسا تعديلًا")}: ${m.approvalReason}` : t("Waiting for MOTEXA to check his ID. He can sign in, but gets requests only once approved.", "بانتظار تحقق موتكسا من هويته. يمكنه تسجيل الدخول لكنه لا يستقبل الطلبات إلا بعد الاعتماد.")}</Note> : null}
      {m.approval === "REJECTED" || m.approval === "SUSPENDED" ? <Note tone="danger" icon="close-circle-outline">{[status.label, m.approvalReason].filter(Boolean).join(": ")}</Note> : null}
      <Block>
        <Facts rows={[
          [t("Status", "الحالة"), status.label],
          [t("Email", "البريد"), m.email],
          [t("Phone", "الهاتف"), m.phone],
          [t("Skills", "المهارات"), m.skills.map(skillLabel).join(", ")],
          m.job ? [t("Current job", "المهمة الحالية"), `${m.job.customerFirstName} · ${L[m.job.status]}`] : null,
          m.approval === "APPROVED" && !m.offline ? [t("Location", "الموقع"), liveLabel(m.live, t)] : null,
        ]} />
      </Block>
      <View style={[row, { gap: 10 }]}>
        <GButton flex variant="secondary" icon="create-outline" label={t("Edit", "تعديل")} onPress={onEdit} />
        <GButton flex variant="secondary" icon="mail-outline" label={t("Resend invitation", "إعادة إرسال الدعوة")} busy={busy} disabled={busy} onPress={() => void invite()} />
      </View>
    </View>
  );
}

export function GarageMechanics() {
  const { t } = useL();
  const { g } = useGarageTheme();
  const skillLabel = useSkillLabel();
  const status = useStaffStatus();
  const params = useLocalSearchParams<{ filter?: string; add?: string }>();
  const [filter, setFilter] = useState<Filter>(isFilter(params.filter) ? params.filter : "ALL"), [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null), [wizard, setWizard] = useState<"add" | GarageStaff | null>(params.add ? "add" : null);
  useEffect(() => { if (isFilter(params.filter)) setFilter(params.filter); }, [params.filter]);
  useEffect(() => { if (params.add) setWizard("add"); }, [params.add]);
  const state = useLoad(() => garageOwner.mechanics(), [], REFRESH_MS);
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const found = (state.data ?? []).filter((m) => words.every((w) => `${m.name} ${m.email} ${m.skills.map(skillLabel).join(" ")}`.toLowerCase().includes(w)));
  const count = (f: Filter) => (f === "ALL" ? found.length : found.filter((m) => filterOf(m) === f).length);
  const rows = found.filter((m) => filter === "ALL" || filterOf(m) === filter);
  const current = (state.data ?? []).find((m) => m.id === open) ?? null;
  const label: Record<Filter, string> = { ALL: t("All", "الكل"), FREE: t("Free", "متاح"), BUSY: t("Busy", "مشغول"), OFFLINE: t("Offline", "غير متصل"), REVIEW: t("In review", "قيد المراجعة") };
  return (
    <>
      <ManagePage title={t("Mechanics", "الميكانيكيون")} back={false} tabBar
        line={state.data ? t(`${count("FREE")} free · ${count("BUSY")} busy · ${count("REVIEW")} in review`, `${count("FREE")} متاح · ${count("BUSY")} مشغول · ${count("REVIEW")} قيد المراجعة`) : undefined}
        search={{ value: q, onChange: setQ, placeholder: t("Name, email or skill", "الاسم أو البريد أو المهارة") }}
        filters={<FilterChips value={filter} onChange={setFilter} filters={(["ALL", "FREE", "BUSY", "OFFLINE", "REVIEW"] as Filter[]).map((k) => ({ key: k, label: label[k], count: state.data ? count(k) : undefined }))} />}
        above={<ManageEntry icon="person-add-outline" title={t("Add a mechanic", "إضافة ميكانيكي")} sub={t("A new login for him; MOTEXA checks his ID.", "حساب جديد له؛ تتحقق موتكسا من هويته.")} onPress={() => setWizard("add")} />}
        items={rows} keyOf={(m) => m.id}
        renderItem={(m) => (
          <ManageRow title={m.name} status={status(m)} active={open === m.id}
            sub={m.job ? `${m.job.customerFirstName} · ${t("on a job", "في مهمة")}` : m.skills.map(skillLabel).join(" · ")}
            leading={publicImageUrl(m.photoUri) ? <Image source={{ uri: publicImageUrl(m.photoUri)! }} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: g.tint }} contentFit="cover" /> : undefined}
            onPress={() => setOpen(m.id)} />
        )}
        loading={!state.data && !state.error} error={state.error} onRetry={() => void state.reload()}
        empty={{ text: q || filter !== "ALL" ? t("No mechanic matches.", "لا يوجد ميكانيكي مطابق.") : t("No mechanics yet. Add the first one.", "لا يوجد ميكانيكيون بعد. أضف الأول."), action: !q && filter === "ALL" ? { label: t("Add a mechanic", "إضافة ميكانيكي"), onPress: () => setWizard("add") } : undefined }}
        onRefresh={() => void state.reload()} refreshing={false}
        detail={current ? { title: current.name, content: <StaffDetail m={current} onEdit={() => setWizard(current)} onChanged={() => void state.reload()} />, onClose: () => setOpen(null) } : null}
        detailHint={t("Tap a mechanic to see him here.", "اضغط على ميكانيكي لعرضه هنا.")} />
      {wizard ? <MechanicWizard staff={wizard === "add" ? undefined : wizard} onClose={() => setWizard(null)} onSaved={() => { setWizard(null); void state.reload(); }} /> : null}
    </>
  );
}
