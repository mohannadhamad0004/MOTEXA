// Tow admin: drivers' licences = List: ONE chip row Pending · Approved · Rejected · Suspended with counts, search, rows with ⋮
// (approve / reject / suspend, each audited and notified to the company and the driver). A row opens its details (licence photo,
// facts, edit name / phone / licence number) in a sheet on phones and the side panel on wide screens.
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Field, GButton, Note, StatusChip, type Tone } from "../../../components/garage";
import { showToast } from "../../../components/ItemActionsMenu";
import { FilterChips, ManagePage, ManageRow } from "../../../components/manage/ManagePage";
import { Block, Facts } from "../../../components/manage/Page";
import { privateImageSource } from "../../../core/config/api";
import { publicImageUrl } from "../../../core/constants/files";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { driverActions } from "../../../features/department/towActions";
import { AdminDriver, DriverApproval, adminDrivers } from "../../../features/tow/dispatchService";
import { gShape, useGarageTheme } from "../../../theme/garage";

const FILTERS: DriverApproval[] = ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"];

/** Licence image: private, so the request carries the admin's token. */
function Licence({ path }: { path: string }) {
  const { g } = useGarageTheme();
  const [src, setSrc] = useState<{ uri: string; headers: Record<string, string> } | null>(null);
  useEffect(() => { void privateImageSource(path).then(setSrc); }, [path]);
  return src ? <Image source={src} style={{ width: "100%", height: 200, borderRadius: gShape.small, backgroundColor: g.cardSoft }} contentFit="contain" accessibilityLabel="licence" /> : <View style={{ height: 200, borderRadius: gShape.small, backgroundColor: g.cardSoft }} />;
}

function DriverDetail({ d, onSaved }: { d: AdminDriver; onSaved: () => void }) {
  const { t } = useL();
  const { row } = useGarageTheme();
  const [f, setF] = useState({ name: d.name, phone: d.phone, licence: d.licenceNumber ?? "" }), [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);
  useEffect(() => setF({ name: d.name, phone: d.phone, licence: d.licenceNumber ?? "" }), [d]);
  const dirty = f.name.trim() !== d.name || f.phone.trim() !== d.phone || f.licence.trim() !== (d.licenceNumber ?? "");
  const save = async () => {
    setBusy(true); setErr(null);
    try {
      await adminDrivers.update(d.id, { ...(f.name.trim() !== d.name ? { name: f.name.trim() } : {}), ...(f.phone.trim() !== d.phone ? { phone: f.phone.trim() } : {}), ...(f.licence.trim() !== (d.licenceNumber ?? "") ? { licenceNumber: f.licence.trim() } : {}) });
      showToast(t("Driver updated.", "تم تحديث السائق."), "ok"); onSaved();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <View style={{ gap: 12 }}>
      {d.licenceUri ? <Licence path={d.licenceUri} /> : <Note tone="warning" icon="alert-circle-outline">{t("No licence photo.", "لا توجد صورة رخصة.")}</Note>}
      {d.approvalReason ? <Note icon="information-circle-outline">{d.approval === "PENDING" ? `${t("Changes requested", "طُلب تعديل")}: ${d.approvalReason}` : d.approvalReason}</Note> : null}
      <Block><Facts rows={[[t("Company", "الشركة"), d.company.name], [t("Email", "البريد"), d.email], [t("Phone", "الهاتف"), d.phone], [t("Licence number", "رقم الرخصة"), d.licenceNumber]]} /></Block>
      <Block title={t("Edit details", "تعديل البيانات")}>
        <View style={{ gap: 10, paddingVertical: 10 }}>
          <Field label={t("Name", "الاسم")} value={f.name} onChangeText={(v) => setF({ ...f, name: v })} maxLength={80} />
          <Field label={t("Phone", "الهاتف")} value={f.phone} onChangeText={(v) => setF({ ...f, phone: v })} keyboardType="phone-pad" maxLength={24} />
          <Field label={t("Licence number", "رقم الرخصة")} value={f.licence} onChangeText={(v) => setF({ ...f, licence: v })} maxLength={40} />
          {err ? <Note tone="danger" icon="alert-circle-outline">{err}</Note> : null}
          <View style={row}><GButton flex icon="checkmark" label={t("Save", "حفظ")} disabled={busy || !dirty || f.name.trim().length < 2} busy={busy} onPress={() => void save()} /></View>
        </View>
      </Block>
    </View>
  );
}

export default function DriverReview() {
  const { t } = useL();
  const { g } = useGarageTheme();
  const [filter, setFilter] = useState<DriverApproval>("PENDING"), [q, setQ] = useState(""), [open, setOpen] = useState<string | null>(null);
  // all four lists at once, so every chip shows its real count
  const state = useLoad(() => Promise.all(FILTERS.map((f) => adminDrivers.list(f))).then((r) => r.flat()), []);
  const label: Record<DriverApproval, string> = { PENDING: t("Pending", "قيد المراجعة"), APPROVED: t("Approved", "معتمد"), REJECTED: t("Rejected", "مرفوض"), SUSPENDED: t("Suspended", "موقوف") };
  const tone: Record<DriverApproval, Tone> = { PENDING: "warning", APPROVED: "success", REJECTED: "danger", SUSPENDED: "danger" };
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const found = (state.data ?? []).filter((d) => words.every((w) => `${d.name} ${d.company.name} ${d.licenceNumber ?? ""}`.toLowerCase().includes(w)));
  const rows = found.filter((d) => d.approval === filter);
  const current = (state.data ?? []).find((d) => d.id === open) ?? null;
  return (
    <ManagePage title={t("Drivers' licences", "رخص السائقين")} line={state.data ? t(`${found.filter((d) => d.approval === "PENDING").length} waiting for review`, `${found.filter((d) => d.approval === "PENDING").length} بانتظار المراجعة`) : undefined}
      search={{ value: q, onChange: setQ, placeholder: t("Driver, company or licence", "السائق أو الشركة أو الرخصة") }}
      filters={<FilterChips value={filter} onChange={setFilter} filters={FILTERS.map((f) => ({ key: f, label: label[f], count: state.data ? found.filter((d) => d.approval === f).length : undefined }))} />}
      items={rows} keyOf={(d) => d.id}
      renderItem={(d) => <ManageRow title={d.name} sub={[d.company.name, d.licenceNumber].filter(Boolean).join(" · ")} status={{ label: label[d.approval], tone: tone[d.approval] }} active={open === d.id}
        leading={publicImageUrl(d.photoUri) ? <Image source={{ uri: publicImageUrl(d.photoUri)! }} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: g.tint }} contentFit="cover" /> : undefined}
        onPress={() => setOpen(d.id)} actions={driverActions(t, d, { reload: state.reload, edit: () => setOpen(d.id) })} />}
      loading={!state.data && !state.error} error={state.error} onRetry={() => void state.reload()}
      empty={{ text: q ? t("No driver matches.", "لا يوجد سائق مطابق.") : t("No drivers here.", "لا يوجد سائقون هنا.") }}
      onRefresh={() => void state.reload()} refreshing={false}
      detail={current ? { title: current.name, content: <DriverDetail d={current} onSaved={() => void state.reload()} />, onClose: () => setOpen(null) } : null}
      detailHint={t("Tap a driver to see the licence.", "اضغط على سائق لرؤية الرخصة.")} />
  );
}
