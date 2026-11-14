import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Card, Chip, EmptyState, ErrorState, Field, GarageHero, GaragePage, GButton, GText, ListRow, Note, SkeletonRows, StatusChip, Tone } from "../../../components/garage";
import { privateImageSource } from "../../../core/config/api";
import { publicImageUrl } from "../../../core/constants/files";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { AdminDriver, DriverApproval, adminDrivers } from "../../../features/tow/dispatchService";
import { ItemRow, showToast } from "../../../components/ItemActionsMenu";
import { driverActions } from "../../../features/department/towActions";
import { gType, useGarageTheme } from "../../../theme/garage";

const FILTERS: DriverApproval[] = ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"];

/** Licence image: private, so the request carries the admin's token. */
function Licence({ path }: { path: string }) {
  const [src, setSrc] = useState<{ uri: string; headers: Record<string, string> } | null>(null);
  useEffect(() => {
    void privateImageSource(path).then(setSrc);
  }, [path]);
  return src ? <Image source={src} style={{ width: "100%", height: 200, borderRadius: 12 }} contentFit="contain" accessibilityLabel="licence" /> : null;
}

/** Tow admin: approve or reject a driver's licence, or suspend a driver. Every decision is audited and notifies the company and the driver. */
export default function DriverReview() {
  const { t } = useL();
  const { row, align } = useGarageTheme();
  const [filter, setFilter] = useState<DriverApproval>("PENDING");
  const state = useLoad(() => adminDrivers.list(filter), [filter]);
  const [edit, setEdit] = useState<{ d: AdminDriver; name: string; phone: string; licence: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const label: Record<DriverApproval, string> = { PENDING: t("Pending", "قيد المراجعة"), APPROVED: t("Approved", "معتمد"), REJECTED: t("Rejected", "مرفوض"), SUSPENDED: t("Suspended", "موقوف") };
  const tone: Record<DriverApproval, Tone> = { PENDING: "warning", APPROVED: "success", REJECTED: "danger", SUSPENDED: "danger" };
  const save = async () => {
    if (!edit) return;
    setBusy(true);
    setErr(null);
    try {
      const { d } = edit;
      await adminDrivers.update(d.id, { ...(edit.name.trim() !== d.name ? { name: edit.name.trim() } : {}), ...(edit.phone.trim() !== d.phone ? { phone: edit.phone.trim() } : {}), ...(edit.licence.trim() !== (d.licenceNumber ?? "") ? { licenceNumber: edit.licence.trim() } : {}) });
      setEdit(null);
      showToast(t("Driver updated.", "تم تحديث السائق."), "ok");
      state.reload();
    } catch (e: any) {
      setErr(e.message);
      showToast(e.message || t("That did not work. Try again.", "لم تنجح العملية. حاول مجددًا."), "bad");
    } finally {
      setBusy(false);
    }
  };
  return (
    <GaragePage onRefresh={state.reload} hero={<GarageHero variant="detail" onBack={() => (router.canGoBack() ? router.back() : router.navigate("/dept"))} title={t("Drivers' licences", "رخص السائقين")} line={state.data ? `${state.data.length}` : undefined} />}>
      <View style={[row, { gap: 8, flexWrap: "wrap", marginBottom: 12 }]}>
        {FILTERS.map((f) => <Chip key={f} label={label[f]} on={filter === f} onPress={() => setFilter(f)} />)}
      </View>
      {state.error && !state.data ? <ErrorState text={state.error} onRetry={state.reload} retryLabel={t("Retry", "إعادة المحاولة")} /> : null}
      {!state.data && !state.error ? <SkeletonRows count={3} /> : null}
      {state.data && !state.data.length ? <EmptyState photo="empty.requests" text={t("No drivers here.", "لا يوجد سائقون هنا.")} /> : null}
      {err ? <Note tone="danger" icon="alert-circle-outline">{err}</Note> : null}
      <View style={{ gap: 12 }}>
        {state.data?.map((d) => (
          <ItemRow key={d.id} title={d.name} subtitle={d.company.name} actions={driverActions(t, d, { reload: state.reload, edit: () => setEdit({ d, name: d.name, phone: d.phone, licence: d.licenceNumber ?? "" }) })}>
            <View style={[row, { alignItems: "center", gap: 10 }]}>
              {publicImageUrl(d.photoUri) ? <Image source={{ uri: publicImageUrl(d.photoUri)! }} style={{ width: 44, height: 44, borderRadius: 22 }} contentFit="cover" /> : null}
              <GText style={[gType.title, { flex: 1 }, align]}>{d.name}</GText>
              <StatusChip tone={tone[d.approval]} label={label[d.approval]} />
            </View>
            <ListRow icon="business-outline" title={d.company.name} sub={`${d.email} · ${d.phone}`} />
            <ListRow divider icon="card-outline" title={t("Licence number", "رقم الرخصة")} sub={d.licenceNumber ?? "-"} />
            {d.licenceUri ? <View style={{ marginVertical: 8 }}><Licence path={d.licenceUri} /></View> : <Note tone="warning" icon="alert-circle-outline">{t("No licence photo.", "لا توجد صورة رخصة.")}</Note>}
            {d.approvalReason ? <Note icon="information-circle-outline">{d.approval === "PENDING" ? `${t("Changes requested", "طُلب تعديل")}: ${d.approvalReason}` : d.approvalReason}</Note> : null}
            {edit?.d.id === d.id ? (
              <View>
                <Field label={t("Name", "الاسم")} value={edit.name} onChangeText={(v) => setEdit({ ...edit, name: v })} maxLength={80} />
                <Field label={t("Phone", "الهاتف")} value={edit.phone} onChangeText={(v) => setEdit({ ...edit, phone: v })} keyboardType="phone-pad" maxLength={24} />
                <Field label={t("Licence number", "رقم الرخصة")} value={edit.licence} onChangeText={(v) => setEdit({ ...edit, licence: v })} maxLength={40} />
                <View style={[row, { gap: 10 }]}>
                  <GButton flex variant="secondary" label={t("Cancel", "إلغاء")} onPress={() => setEdit(null)} />
                  <GButton flex label={t("Save", "حفظ")} disabled={busy || edit.name.trim().length < 2} busy={busy} onPress={() => void save()} />
                </View>
              </View>
            ) : null}
          </ItemRow>
        ))}
      </View>
    </GaragePage>
  );
}
