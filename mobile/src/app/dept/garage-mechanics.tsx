// Mechanics admin: garage mechanics' IDs = List (the tow drivers' licence review, for mechanics a garage added): ONE chip row
// Pending · Approved · Rejected · Suspended with counts, search, rows with ⋮ (approve / request changes / reject / suspend, each with
// a reason except approve; audited and notified to the garage owner and the mechanic). A row opens the private ID photo and the facts
// (sheet on phones, side panel on wide screens).
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Note, type Tone } from "../../components/garage";
import type { ItemAction } from "../../components/ItemActionsMenu";
import { FilterChips, ManagePage, ManageRow } from "../../components/manage/ManagePage";
import { Block, Facts } from "../../components/manage/Page";
import { privateImageSource } from "../../core/config/api";
import { publicImageUrl } from "../../core/constants/files";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { useSkillLabel } from "../../features/mechanics/mechanicBits";
import { adminGarages, type GarageStaff, type StaffApproval } from "../../features/mechanics/mechanicsService";
import { gShape, useGarageTheme } from "../../theme/garage";

const FILTERS: StaffApproval[] = ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"];
type T = (en: string, ar: string) => string;

/** ID image: private, so the request carries the admin's token. */
function IdPhoto({ path }: { path: string }) {
  const { g } = useGarageTheme();
  const [src, setSrc] = useState<{ uri: string; headers: Record<string, string> } | null>(null);
  useEffect(() => { void privateImageSource(path).then(setSrc); }, [path]);
  return src ? <Image source={src} style={{ width: "100%", height: 200, borderRadius: gShape.small, backgroundColor: g.cardSoft }} contentFit="contain" accessibilityLabel="ID" /> : <View style={{ height: 200, borderRadius: gShape.small, backgroundColor: g.cardSoft }} />;
}

function staffActions(t: T, m: GarageStaff, reload: () => unknown): ItemAction[] {
  const decide = (d: "APPROVE" | "REJECT" | "REQUEST_CHANGES" | "SUSPEND") => async (reason?: string) => { await adminGarages.review(m.id, d, reason); await reload(); };
  const out: ItemAction[] = [];
  if (m.approval !== "APPROVED") out.push({ key: "approve", label: t("Approve", "موافقة"), icon: "checkmark-circle-outline", confirm: { title: t("Approve this mechanic?", "الموافقة على هذا الميكانيكي؟"), message: t("He can go Online and take his garage's jobs.", "يمكنه الاتصال واستلام مهام كراجه.") }, success: t("Mechanic approved.", "تمت الموافقة على الميكانيكي."), run: decide("APPROVE") });
  if (m.approval === "PENDING") out.push({ key: "changes", label: t("Request changes", "طلب تعديل"), icon: "create-outline", confirm: { title: t("Ask the garage for a change", "اطلب تعديلًا من الكراج"), reason: { label: t("What should change? (the owner sees it)", "ما المطلوب تعديله؟ (يراه المالك)"), required: true }, confirmLabel: t("Send", "إرسال") }, success: t("Changes requested.", "طُلب التعديل."), run: decide("REQUEST_CHANGES") });
  if (m.approval === "PENDING") out.push({ key: "reject", label: t("Reject", "رفض"), icon: "close-circle-outline", destructive: true, confirm: { title: t("Reject this mechanic?", "رفض هذا الميكانيكي؟"), reason: { label: t("Reason (the owner and the mechanic see it)", "السبب (يراه المالك والميكانيكي)"), required: true }, confirmLabel: t("Reject", "رفض") }, success: t("Mechanic rejected.", "تم رفض الميكانيكي."), run: decide("REJECT") });
  if (m.approval === "APPROVED") out.push({ key: "suspend", label: t("Suspend", "إيقاف"), icon: "pause-circle-outline", destructive: true, confirm: { title: t("Suspend this mechanic?", "إيقاف هذا الميكانيكي؟"), message: t("He goes Offline at once and his position is forgotten.", "يصبح غير متصل فورًا ويُحذف موقعه."), reason: { label: t("Reason (the owner and the mechanic see it)", "السبب (يراه المالك والميكانيكي)"), required: true }, confirmLabel: t("Suspend", "إيقاف") }, success: t("Mechanic suspended.", "تم إيقاف الميكانيكي."), run: decide("SUSPEND") });
  return out;
}

export default function GarageMechanicsReview() {
  const { t } = useL();
  const { g } = useGarageTheme();
  const skill = useSkillLabel();
  const [filter, setFilter] = useState<StaffApproval>("PENDING"), [q, setQ] = useState(""), [open, setOpen] = useState<string | null>(null);
  const state = useLoad(() => adminGarages.mechanics("ALL"), []);
  const label: Record<StaffApproval, string> = { PENDING: t("Pending", "قيد المراجعة"), APPROVED: t("Approved", "معتمد"), REJECTED: t("Rejected", "مرفوض"), SUSPENDED: t("Suspended", "موقوف") };
  const tone: Record<StaffApproval, Tone> = { PENDING: "warning", APPROVED: "success", REJECTED: "danger", SUSPENDED: "danger" };
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const found = (state.data ?? []).filter((m) => words.every((w) => `${m.name} ${m.garage.name} ${m.email}`.toLowerCase().includes(w)));
  const rows = found.filter((m) => m.approval === filter);
  const current = (state.data ?? []).find((m) => m.id === open) ?? null;
  return (
    <ManagePage title={t("Garage mechanics", "ميكانيكيو الكراجات")} line={state.data ? t(`${found.filter((m) => m.approval === "PENDING").length} waiting for review`, `${found.filter((m) => m.approval === "PENDING").length} بانتظار المراجعة`) : undefined}
      search={{ value: q, onChange: setQ, placeholder: t("Mechanic, garage or email", "الميكانيكي أو الكراج أو البريد") }}
      filters={<FilterChips value={filter} onChange={setFilter} filters={FILTERS.map((f) => ({ key: f, label: label[f], count: state.data ? found.filter((m) => m.approval === f).length : undefined }))} />}
      items={rows} keyOf={(m) => m.id}
      renderItem={(m) => <ManageRow title={m.name} sub={[m.garage.name, m.skills.map(skill).join(", ")].filter(Boolean).join(" · ")} status={{ label: label[m.approval], tone: tone[m.approval] }} active={open === m.id}
        leading={publicImageUrl(m.photoUri) ? <Image source={{ uri: publicImageUrl(m.photoUri)! }} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: g.tint }} contentFit="cover" /> : undefined}
        onPress={() => setOpen(m.id)} actions={staffActions(t, m, state.reload)} />}
      loading={!state.data && !state.error} error={state.error} onRetry={() => void state.reload()}
      empty={{ text: q ? t("No mechanic matches.", "لا يوجد ميكانيكي مطابق.") : t("No garage mechanics here.", "لا يوجد ميكانيكيو كراجات هنا.") }}
      onRefresh={() => void state.reload()} refreshing={false}
      detail={current ? { title: current.name, onClose: () => setOpen(null), content: (
        <View style={{ gap: 12 }}>
          {current.idUri ? <IdPhoto path={current.idUri} /> : <Note tone="warning" icon="alert-circle-outline">{t("No ID photo.", "لا توجد صورة هوية.")}</Note>}
          {current.approvalReason ? <Note icon="information-circle-outline">{current.approval === "PENDING" ? `${t("Changes requested", "طُلب تعديل")}: ${current.approvalReason}` : current.approvalReason}</Note> : null}
          <Block><Facts rows={[[t("Garage", "الكراج"), current.garage.name], [t("Email", "البريد"), current.email], [t("Phone", "الهاتف"), current.phone], [t("Skills", "المهارات"), current.skills.map(skill).join(", ")]]} /></Block>
          <Note icon="hand-left-outline">{t("Use ⋮ on the row to approve, request a change, reject or suspend.", "استخدم ⋮ في الصف للموافقة أو طلب تعديل أو الرفض أو الإيقاف.")}</Note>
        </View>
      ) } : null}
      detailHint={t("Tap a mechanic to see the ID.", "اضغط على ميكانيكي لرؤية الهوية.")} />
  );
}
